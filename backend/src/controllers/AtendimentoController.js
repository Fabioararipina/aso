const pool = require('../config/database');
const whatsappService = require('../services/whatsappService');

exports.criar = async (req, res) => {
  const { paciente_id, empresa, cnpj, funcao, tipo_aso, salas_ids } = req.body;
  if (!paciente_id || !salas_ids || !salas_ids.length) {
    return res.status(400).json({ error: 'paciente_id e salas_ids são obrigatórios' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [atendimento] } = await client.query(
      `INSERT INTO atendimentos (paciente_id, empresa, cnpj, funcao, tipo_aso, status)
       VALUES ($1,$2,$3,$4,$5,'PRESENTE') RETURNING *`,
      [paciente_id, empresa, cnpj, funcao, tipo_aso]
    );
    for (let i = 0; i < salas_ids.length; i++) {
      const posicao = await _proxima_posicao(client, salas_ids[i]);
      await client.query(
        'INSERT INTO fila_salas (atendimento_id, sala_id, posicao) VALUES ($1,$2,$3)',
        [atendimento.id, salas_ids[i], posicao]
      );
    }
    await client.query('COMMIT');
    // Send WhatsApp MSG1
    const { rows: [paciente] } = await pool.query('SELECT * FROM pacientes WHERE id=$1', [paciente_id]);
    const { rows: salas } = await pool.query('SELECT nome FROM salas WHERE id = ANY($1)', [salas_ids]);
    await whatsappService.enviarCheckin(paciente, salas.map(s => s.nome));
    const io = req.app.get('io');
    if (io) io.emit('tv:atualizar');
    res.status(201).json(atendimento);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

async function _proxima_posicao(client, sala_id) {
  const { rows } = await client.query(
    "SELECT COALESCE(MAX(posicao),0)+1 as pos FROM fila_salas WHERE sala_id=$1 AND status IN ('PENDENTE','EM_ATENDIMENTO')",
    [sala_id]
  );
  return rows[0].pos;
}

exports.listarHoje = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, p.nome as paciente_nome, p.whatsapp,
        json_agg(json_build_object('id',fs.id,'sala_id',fs.sala_id,'sala_nome',s.nome,'sala_slug',s.slug,'status',fs.status,'posicao',fs.posicao) ORDER BY fs.sala_id) as salas
      FROM atendimentos a
      JOIN pacientes p ON p.id = a.paciente_id
      LEFT JOIN fila_salas fs ON fs.atendimento_id = a.id
      LEFT JOIN salas s ON s.id = fs.sala_id
      WHERE a.criado_em::date = CURRENT_DATE AND a.status != 'CANCELADO'
      GROUP BY a.id, p.nome, p.whatsapp
      ORDER BY a.criado_em DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelar = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE atendimentos SET status='CANCELADO', atualizado_em=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Atendimento não encontrado' });
    const io = req.app.get('io');
    if (io) io.emit('tv:atualizar');
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
