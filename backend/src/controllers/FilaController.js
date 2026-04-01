const pool = require('../config/database');
const whatsappService = require('../services/whatsappService');
const previsaoService = require('../services/previsaoService');

exports.listarPorSala = async (req, res) => {
  try {
    const { rows: [sala] } = await pool.query('SELECT * FROM salas WHERE slug=$1', [req.params.sala_slug]);
    if (!sala) return res.status(404).json({ error: 'Sala não encontrada' });
    const { rows } = await pool.query(`
      SELECT fs.*, a.id as atendimento_id, p.nome as paciente_nome,
        json_agg(json_build_object('sala_nome',s2.nome,'sala_slug',s2.slug,'status',fs2.status) ORDER BY s2.id) as todas_salas,
        (SELECT COUNT(*) FROM atendimento_sala_exames ase WHERE ase.fila_sala_id = fs.id)::int as exames_count,
        (
          SELECT COUNT(*) FROM fila_salas fs3
          JOIN salas s3 ON s3.id = fs3.sala_id
          WHERE fs3.atendimento_id = a.id
            AND s3.administrativa = true
            AND fs3.status IN ('PENDENTE','EM_ATENDIMENTO')
        )::int > 0 AS bloqueado_por_adm
      FROM fila_salas fs
      JOIN atendimentos a ON a.id = fs.atendimento_id
      JOIN pacientes p ON p.id = a.paciente_id
      LEFT JOIN fila_salas fs2 ON fs2.atendimento_id = a.id
      LEFT JOIN salas s2 ON s2.id = fs2.sala_id
      WHERE fs.sala_id=$1 AND fs.status IN ('PENDENTE','EM_ATENDIMENTO') AND a.status != 'CANCELADO'
      GROUP BY fs.id, a.id, p.nome
      ORDER BY fs.posicao ASC
    `, [sala.id]);
    const fila = rows.map(item => ({
      ...item,
      bloqueado_por_adm: sala.requer_adm ? item.bloqueado_por_adm : false
    }));
    res.json({ sala, fila });
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

    // Se esta sala requer liberação administrativa, verifica se alguma sala adm ainda está pendente
    if (sala.requer_adm) {
      const { rows: admPendentes } = await pool.query(
        `SELECT 1 FROM fila_salas fs JOIN salas s ON s.id = fs.sala_id
         WHERE fs.atendimento_id=$1 AND s.administrativa = true AND fs.status IN ('PENDENTE','EM_ATENDIMENTO')`,
        [filaItem.atendimento_id]
      );
      if (admPendentes.length > 0) {
        return res.status(403).json({ error: 'Paciente aguardando liberação da sala administrativa.' });
      }
    }

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

    // Sala administrativa: sem mensagens WhatsApp (controle interno)
    if (!sala.administrativa) {
      const previsoes = await previsaoService.calcularTodasSalas(filaItem.atendimento_id);
      await whatsappService.enviarChamada(paciente, sala.nome, previsoes);
      await _verificarContagem(sala.id);
    }

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

exports.registrarAtraso = async (req, res) => {
  const { sala_slug } = req.params;
  const minutos_atraso = parseInt(req.body?.minutos_atraso) || 0;
  try {
    const { rows: [sala] } = await pool.query('SELECT * FROM salas WHERE slug=$1', [sala_slug]);
    if (!sala) return res.status(404).json({ error: 'Sala não encontrada' });

    const { rows: fila } = await pool.query(
      `SELECT fs.id, fs.posicao,
              p.id as paciente_id, p.nome as paciente_nome, p.whatsapp
       FROM fila_salas fs
       JOIN atendimentos a ON a.id = fs.atendimento_id
       JOIN pacientes p ON p.id = a.paciente_id
       WHERE fs.sala_id=$1 AND fs.status='PENDENTE'
       ORDER BY fs.posicao ASC`,
      [sala.id]
    );

    if (fila.length === 0) return res.json({ success: true, notificados: 0 });

    for (let i = 0; i < fila.length; i++) {
      // minutos_atraso é o delay extra informado pela recepção;
      // somamos à espera normal baseada na posição do paciente na fila
      const minutosRestantes = minutos_atraso + (i + 1) * (sala.tempo_medio_min || 15);
      const agora = new Date();
      let base = new Date(agora);
      if (sala.hora_inicio) {
        const [hh, mm] = sala.hora_inicio.split(':');
        const inicio = new Date();
        inicio.setHours(parseInt(hh), parseInt(mm), 0, 0);
        if (inicio > agora) base = inicio;
      }
      base.setMinutes(base.getMinutes() + minutosRestantes);
      const nova_previsao = base.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      await whatsappService.enviarAtraso(
        { id: fila[i].paciente_id, nome: fila[i].paciente_nome, whatsapp: fila[i].whatsapp },
        sala.nome,
        nova_previsao
      );

      // Reseta contagem para que o sistema envie novamente do início
      await pool.query(
        'UPDATE fila_salas SET ultima_contagem_enviada=NULL WHERE id=$1',
        [fila[i].id]
      );
    }

    const io = req.app.get('io');
    if (io) io.emit('fila:atualizada', { sala_slug });

    res.json({ success: true, notificados: fila.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

async function _verificarContagem(sala_id) {
  const { rows: fila } = await pool.query(
    `SELECT fs.id, fs.posicao, fs.ultima_contagem_enviada,
            p.id as paciente_id, p.nome as paciente_nome, p.whatsapp
     FROM fila_salas fs
     JOIN atendimentos a ON a.id = fs.atendimento_id
     JOIN pacientes p ON p.id = a.paciente_id
     WHERE fs.sala_id=$1 AND fs.status='PENDENTE'
     ORDER BY fs.posicao ASC`,
    [sala_id]
  );
  const { rows: [sala] } = await pool.query('SELECT * FROM salas WHERE id=$1', [sala_id]);
  const limiar = sala.limiar_contagem ?? 5;

  for (let i = 0; i < fila.length; i++) {
    const posicaoAtual = i; // 0-indexed: 0 = próximo a ser chamado
    const ultimaEnviada = fila[i].ultima_contagem_enviada;

    // Só envia se dentro do limiar E a posição diminuiu para um novo nível
    if (posicaoAtual <= limiar && (ultimaEnviada === null || posicaoAtual < ultimaEnviada)) {
      await whatsappService.enviarContagem(
        { id: fila[i].paciente_id, nome: fila[i].paciente_nome, whatsapp: fila[i].whatsapp },
        sala.nome,
        posicaoAtual,
        sala.tempo_medio_min
      );
      await pool.query(
        'UPDATE fila_salas SET ultima_contagem_enviada=$1 WHERE id=$2',
        [posicaoAtual, fila[i].id]
      );
    }
  }
}
