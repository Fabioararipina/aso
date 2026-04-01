const pool = require('../config/database');
const whatsappService = require('../services/whatsappService');
const previsaoService = require('../services/previsaoService');

exports.criar = async (req, res) => {
  const { paciente_id, empresa, cnpj, funcao, tipo_aso, salas_ids, exames_por_sala } = req.body;
  if (!paciente_id || !salas_ids || !salas_ids.length) {
    return res.status(400).json({ error: 'paciente_id e salas_ids são obrigatórios' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [atendimento] } = await client.query(
      `INSERT INTO atendimentos (paciente_id, empresa, cnpj, funcao, tipo_aso, status)
       VALUES ($1,$2,$3,$4,$5,'PRESENTE') RETURNING *`,
      [paciente_id, empresa || null, cnpj || null, funcao || null, tipo_aso || null]
    );
    for (let i = 0; i < salas_ids.length; i++) {
      const posicao = await _proxima_posicao(client, salas_ids[i]);
      const { rows: [filaSala] } = await client.query(
        'INSERT INTO fila_salas (atendimento_id, sala_id, posicao) VALUES ($1,$2,$3) RETURNING id',
        [atendimento.id, salas_ids[i], posicao]
      );
      // Salvar exames selecionados para esta sala
      const examesDaSala = exames_por_sala && exames_por_sala[String(salas_ids[i])];
      if (examesDaSala && examesDaSala.length > 0) {
        for (const subtipo_exame_id of examesDaSala) {
          await client.query(
            'INSERT INTO atendimento_sala_exames (fila_sala_id, subtipo_exame_id) VALUES ($1, $2)',
            [filaSala.id, subtipo_exame_id]
          );
        }
      }
    }
    await client.query('COMMIT');
    // Send WhatsApp MSG1
    const { rows: [paciente] } = await pool.query('SELECT * FROM pacientes WHERE id=$1', [paciente_id]);
    const previsoes = await previsaoService.calcularTodasSalas(atendimento.id);
    await whatsappService.enviarCheckin(paciente, previsoes);
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
        json_agg(json_build_object(
          'id',fs.id,'sala_id',fs.sala_id,'sala_nome',s.nome,'sala_slug',s.slug,'status',fs.status,'posicao',fs.posicao,
          'exames_selecionados', (SELECT COALESCE(array_agg(ase.subtipo_exame_id), ARRAY[]::int[]) FROM atendimento_sala_exames ase WHERE ase.fila_sala_id = fs.id)
        ) ORDER BY fs.sala_id) as salas
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

exports.editar = async (req, res) => {
  const { nome, whatsapp, salas_ids, exames_por_sala } = req.body;
  const atendimento_id = req.params.id;

  if (!salas_ids || !salas_ids.length) {
    return res.status(400).json({ error: 'Selecione pelo menos uma sala' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Atualiza nome/whatsapp do paciente
    if (nome || whatsapp) {
      const { rows: [at] } = await client.query('SELECT paciente_id FROM atendimentos WHERE id=$1', [atendimento_id]);
      if (nome) await client.query('UPDATE pacientes SET nome=$1 WHERE id=$2', [nome.trim(), at.paciente_id]);
      if (whatsapp) await client.query('UPDATE pacientes SET whatsapp=$1 WHERE id=$2', [whatsapp.replace(/\D/g, ''), at.paciente_id]);
    }

    // Salas atuais PENDENTE (ainda não atendidas — únicas que podem ser alteradas)
    const { rows: salasAtuais } = await client.query(
      "SELECT sala_id FROM fila_salas WHERE atendimento_id=$1 AND status='PENDENTE'",
      [atendimento_id]
    );
    const idsAtuais = salasAtuais.map(s => s.sala_id);
    const idsNovos = salas_ids.map(Number);

    // Remover salas que foram desmarcadas (só PENDENTE)
    const remover = idsAtuais.filter(id => !idsNovos.includes(id));
    for (const sala_id of remover) {
      await client.query(
        "DELETE FROM fila_salas WHERE atendimento_id=$1 AND sala_id=$2 AND status='PENDENTE'",
        [atendimento_id, sala_id]
      );
    }

    // Adicionar salas novas que não existiam
    const { rows: todasSalas } = await client.query(
      'SELECT id, sala_id FROM fila_salas WHERE atendimento_id=$1',
      [atendimento_id]
    );
    const jaExistem = todasSalas.map(s => s.sala_id);
    const adicionar = idsNovos.filter(id => !jaExistem.includes(id));
    for (const sala_id of adicionar) {
      const posicao = await _proxima_posicao(client, sala_id);
      const { rows: [novaFila] } = await client.query(
        'INSERT INTO fila_salas (atendimento_id, sala_id, posicao) VALUES ($1,$2,$3) RETURNING id',
        [atendimento_id, sala_id, posicao]
      );
      // Salvar exames para sala nova
      const examesDaSala = exames_por_sala?.[String(sala_id)];
      if (examesDaSala?.length > 0) {
        for (const subtipo_exame_id of examesDaSala) {
          await client.query(
            'INSERT INTO atendimento_sala_exames (fila_sala_id, subtipo_exame_id) VALUES ($1,$2)',
            [novaFila.id, subtipo_exame_id]
          );
        }
      }
    }

    // Atualizar exames das salas PENDENTE existentes
    if (exames_por_sala) {
      const { rows: salasPendentes } = await client.query(
        "SELECT id, sala_id FROM fila_salas WHERE atendimento_id=$1 AND status='PENDENTE'",
        [atendimento_id]
      );
      for (const fs of salasPendentes) {
        const examesDaSala = exames_por_sala[String(fs.sala_id)];
        if (examesDaSala !== undefined) {
          // Remove exames antigos e insere novos
          await client.query('DELETE FROM atendimento_sala_exames WHERE fila_sala_id=$1', [fs.id]);
          for (const subtipo_exame_id of examesDaSala) {
            await client.query(
              'INSERT INTO atendimento_sala_exames (fila_sala_id, subtipo_exame_id) VALUES ($1,$2)',
              [fs.id, subtipo_exame_id]
            );
          }
        }
      }
    }

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) { io.emit('tv:atualizar'); io.emit('fila:atualizada', {}); }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
