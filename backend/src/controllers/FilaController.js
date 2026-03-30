const pool = require('../config/database');
const whatsappService = require('../services/whatsappService');
const previsaoService = require('../services/previsaoService');

exports.listarPorSala = async (req, res) => {
  try {
    const { rows: [sala] } = await pool.query('SELECT * FROM salas WHERE slug=$1', [req.params.sala_slug]);
    if (!sala) return res.status(404).json({ error: 'Sala não encontrada' });
    const { rows } = await pool.query(`
      SELECT fs.*, a.id as atendimento_id, p.nome as paciente_nome,
        json_agg(json_build_object('sala_nome',s2.nome,'sala_slug',s2.slug,'status',fs2.status) ORDER BY s2.id) as todas_salas
      FROM fila_salas fs
      JOIN atendimentos a ON a.id = fs.atendimento_id
      JOIN pacientes p ON p.id = a.paciente_id
      LEFT JOIN fila_salas fs2 ON fs2.atendimento_id = a.id
      LEFT JOIN salas s2 ON s2.id = fs2.sala_id
      WHERE fs.sala_id=$1 AND fs.status IN ('PENDENTE','EM_ATENDIMENTO') AND a.status != 'CANCELADO'
      GROUP BY fs.id, a.id, p.nome
      ORDER BY fs.posicao ASC
    `, [sala.id]);
    res.json({ sala, fila: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.chamar = async (req, res) => {
  const { fila_id } = req.body;
  const { sala_slug } = req.params;
  try {
    const { rows: [sala] } = await pool.query('SELECT * FROM salas WHERE slug=$1', [sala_slug]);
    if (!sala) return res.status(404).json({ error: 'Sala não encontrada' });

    let filaItem;
    if (fila_id) {
      const { rows: [item] } = await pool.query('SELECT * FROM fila_salas WHERE id=$1', [fila_id]);
      filaItem = item;
    } else {
      const { rows: [item] } = await pool.query(
        "SELECT * FROM fila_salas WHERE sala_id=$1 AND status='PENDENTE' ORDER BY posicao ASC LIMIT 1",
        [sala.id]
      );
      filaItem = item;
    }
    if (!filaItem) return res.status(404).json({ error: 'Nenhum paciente na fila' });

    await pool.query(
      "UPDATE fila_salas SET status='EM_ATENDIMENTO', chamado_em=NOW() WHERE id=$1",
      [filaItem.id]
    );
    await pool.query(
      "UPDATE atendimentos SET status='EM_ATENDIMENTO', atualizado_em=NOW() WHERE id=$1 AND status='PRESENTE'",
      [filaItem.atendimento_id]
    );

    const { rows: [paciente] } = await pool.query(
      'SELECT p.* FROM pacientes p JOIN atendimentos a ON a.paciente_id=p.id WHERE a.id=$1',
      [filaItem.atendimento_id]
    );

    // Calculate positions for other rooms and send WA
    const previsoes = await previsaoService.calcularTodasSalas(filaItem.atendimento_id);
    await whatsappService.enviarChamada(paciente, sala.nome, previsoes);

    // Notify others in queue for countdown
    await _verificarContagem(filaItem.atendimento_id, sala.id, paciente);

    const io = req.app.get('io');
    if (io) {
      io.emit('fila:atualizada', { sala_slug });
      io.emit('tv:atualizar');
      io.emit('paciente:chamado', { paciente_nome: paciente.nome, sala_nome: sala.nome });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.concluir = async (req, res) => {
  try {
    const { rows: [filaItem] } = await pool.query(
      "UPDATE fila_salas SET status='CONCLUIDO_SALA', concluido_em=NOW() WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    if (!filaItem) return res.status(404).json({ error: 'Item não encontrado' });

    // Check if all rooms are done
    const { rows: pendentes } = await pool.query(
      "SELECT * FROM fila_salas WHERE atendimento_id=$1 AND status != 'CONCLUIDO_SALA'",
      [filaItem.atendimento_id]
    );

    const io = req.app.get('io');
    if (pendentes.length === 0) {
      await pool.query(
        "UPDATE atendimentos SET status='CONCLUIDO', atualizado_em=NOW() WHERE id=$1",
        [filaItem.atendimento_id]
      );
      const { rows: [paciente] } = await pool.query(
        'SELECT p.* FROM pacientes p JOIN atendimentos a ON a.paciente_id=p.id WHERE a.id=$1',
        [filaItem.atendimento_id]
      );
      await whatsappService.enviarConclusao(paciente);
      if (io) io.emit('paciente:concluido', { atendimento_id: filaItem.atendimento_id });
    }
    if (io) {
      io.emit('fila:atualizada', {});
      io.emit('tv:atualizar');
    }
    res.json({ success: true, concluido_total: pendentes.length === 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

async function _verificarContagem(atendimento_id, sala_id, paciente_chamado) {
  // After calling someone, notify patients who are now closer in queue
  const { rows: fila } = await pool.query(
    "SELECT fs.*, p.nome as paciente_nome, p.whatsapp FROM fila_salas fs JOIN atendimentos a ON a.id=fs.atendimento_id JOIN pacientes p ON p.id=a.paciente_id WHERE fs.sala_id=$1 AND fs.status='PENDENTE' ORDER BY fs.posicao ASC",
    [sala_id]
  );
  const { rows: [sala] } = await pool.query('SELECT * FROM salas WHERE id=$1', [sala_id]);
  for (let i = 0; i < fila.length; i++) {
    const posicao = i; // 0-indexed: 0 = next
    if (posicao <= 5) {
      await whatsappService.enviarContagem(
        { nome: fila[i].paciente_nome, whatsapp: fila[i].whatsapp },
        sala.nome,
        posicao,
        sala.tempo_medio_min
      );
    }
  }
}
