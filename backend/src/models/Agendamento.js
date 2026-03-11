const db = require('../config/database');

class Agendamento {
  static async criar(dados) {
    const { paciente_id, medico_id, data_consulta, horario, tipo_consulta, valor, observacoes } = dados;
    const result = await db.query(
      'INSERT INTO agendamentos (paciente_id, medico_id, data_consulta, horario, tipo_consulta, valor, observacoes, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [paciente_id, medico_id, data_consulta, horario, tipo_consulta || 'PRIMEIRA_VEZ', valor, observacoes, 'PENDENTE']
    );
    return result.rows[0];
  }

  static async listarPorMedicoEData(medico_id, data) {
    const result = await db.query(
      'SELECT a.*, p.nome as paciente_nome, p.whatsapp FROM agendamentos a JOIN pacientes p ON a.paciente_id = p.id WHERE a.medico_id = $1 AND a.data_consulta = $2 AND a.status != $3 ORDER BY a.horario',
      [medico_id, data, 'CANCELADO']
    );
    return result.rows;
  }

  static async listarTodosPorData(data) {
    const result = await db.query(
      'SELECT a.*, p.nome as paciente_nome, m.nome as medico_nome FROM agendamentos a JOIN pacientes p ON a.paciente_id = p.id JOIN medicos m ON a.medico_id = m.id WHERE a.data_consulta = $1 ORDER BY a.horario',
      [data]
    );
    return result.rows;
  }

  static async listarParaTv(data) {
    // Busca agendamentos do dia + Média de tempo do médico + Foto + ATRASO
    const query = `
      SELECT
        a.id, a.horario, a.status, a.inicio_atendimento, a.tipo_consulta,
        p.nome as paciente_nome,
        m.id as medico_id, m.nome as medico_nome, m.foto_path, m.atraso_minutos,
        (
          SELECT AVG(EXTRACT(EPOCH FROM (ult.atualizado_em - ult.inicio_atendimento))/60)::INTEGER
          FROM (
            SELECT atualizado_em, inicio_atendimento FROM agendamentos a2
            WHERE a2.medico_id = m.id AND a2.status = 'CONCLUIDO' AND a2.inicio_atendimento IS NOT NULL
            AND EXTRACT(EPOCH FROM (a2.atualizado_em - a2.inicio_atendimento))/60 >= 2
            ORDER BY a2.data_consulta DESC, a2.horario DESC
            LIMIT 10
          ) ult
        ) as tempo_medio
      FROM agendamentos a
      JOIN pacientes p ON a.paciente_id = p.id
      JOIN medicos m ON a.medico_id = m.id
      WHERE a.data_consulta = $1 
      AND a.status IN ('CONFIRMADO', 'PRESENTE', 'EM_ATENDIMENTO')
      ORDER BY a.horario ASC
    `;
    const result = await db.query(query, [data]);
    return result.rows;
  }

  static async listarPendentes() {
    const result = await db.query(
      'SELECT a.*, p.nome as paciente_nome, p.whatsapp, m.nome as medico_nome FROM agendamentos a JOIN pacientes p ON a.paciente_id = p.id JOIN medicos m ON a.medico_id = m.id WHERE a.status = $1 ORDER BY a.data_consulta, a.horario',
      ['PENDENTE']
    );
    return result.rows;
  }

  static async confirmar(id) {
    const result = await db.query(
      'UPDATE agendamentos SET status = $1, atualizado_em = NOW() WHERE id = $2 RETURNING *',
      ['CONFIRMADO', id]
    );
    return result.rows[0];
  }

  static async cancelar(id) {
    const result = await db.query(
      'UPDATE agendamentos SET status = $1, atualizado_em = NOW() WHERE id = $2 RETURNING *',
      ['CANCELADO', id]
    );
    return result.rows[0];
  }

  static async atualizarStatus(id, status) {
    let query = 'UPDATE agendamentos SET status = $1, atualizado_em = NOW()';
    const params = [status, id];

    if (status === 'EM_ATENDIMENTO') {
      query += ', inicio_atendimento = NOW()';
    }

    query += ' WHERE id = $2 RETURNING *';

    const result = await db.query(query, params);
    return result.rows[0];
  }

  static async calcularTempoMedio(medico_id) {
    // Pega os últimos 10 atendimentos concluídos com duração >= 2 min (ignora cliques acidentais)
    const query = `
      SELECT AVG(duracao)::INTEGER as media_minutos FROM (
        SELECT EXTRACT(EPOCH FROM (atualizado_em - inicio_atendimento))/60 as duracao
        FROM agendamentos
        WHERE medico_id = $1
        AND status = 'CONCLUIDO'
        AND inicio_atendimento IS NOT NULL
        AND EXTRACT(EPOCH FROM (atualizado_em - inicio_atendimento))/60 >= 2
        ORDER BY data_consulta DESC, horario DESC
        LIMIT 10
      ) as ultimos
    `;
    const result = await db.query(query, [medico_id]);
    return result.rows[0]?.media_minutos || 20; // Default 20 min
  }

  static async buscarProximosDaFila(medico_id, data, limite = 1) {
    const query = `
      SELECT a.*, p.nome as paciente_nome, p.whatsapp 
      FROM agendamentos a
      JOIN pacientes p ON a.paciente_id = p.id
      WHERE a.medico_id = $1 
      AND a.data_consulta = $2 
      AND a.status IN ('CONFIRMADO', 'PRESENTE')
      ORDER BY a.horario ASC
      LIMIT $3
    `;
    const result = await db.query(query, [medico_id, data, limite]);
    return result.rows;
  }

  static async buscarPosicaoFila(id) {
    try {
      // 1. Busca dados do próprio agendamento
      const agendamento = await this.buscarPorId(id);
      if (!agendamento) return null;

      // 2. Busca quantos estão na frente dele
      const queryPosicao = `
        SELECT COUNT(*)::int as qtd 
        FROM agendamentos 
        WHERE medico_id = $1 
        AND data_consulta = $2 
        AND status IN ('CONFIRMADO', 'PRESENTE', 'EM_ATENDIMENTO')
        AND horario < $3
      `;
      const resultPosicao = await db.query(queryPosicao, [agendamento.medico_id, agendamento.data_consulta, agendamento.horario]);
      const posicao = resultPosicao.rows[0].qtd || 0;

      // 3. Busca Atraso do Médico
      const medicoResult = await db.query('SELECT atraso_minutos FROM medicos WHERE id = $1', [agendamento.medico_id]);
      const atraso = medicoResult.rows[0]?.atraso_minutos || 0;

      return {
        ...agendamento,
        posicao,
        atraso,
        previsao: agendamento.horario.slice(0, 5) // Simplificado por enquanto
      };
    } catch (error) {
      console.error('[ERRO CRÍTICO SIMPLIFICADO] buscarPosicaoFila:', error);
      throw error;
    }
  }

  static async buscarPorId(id) {
    const result = await db.query(
      'SELECT a.*, p.nome as paciente_nome, m.nome as medico_nome, m.especialidade, p.whatsapp FROM agendamentos a JOIN pacientes p ON a.paciente_id = p.id JOIN medicos m ON a.medico_id = m.id WHERE a.id = $1',
      [id]
    );
    return result.rows[0]; // Retorna undefined se não achar
  }

  static async salvarProntuario(id, path) {
    const result = await db.query(
      'UPDATE agendamentos SET prontuario_path = $1, status = $2, atualizado_em = NOW() WHERE id = $3 RETURNING *',
      [path, 'CONCLUIDO', id]
    );
    return result.rows[0];
  }

  static async salvarNps(id, nota, comentario) {
    const result = await db.query(
      'UPDATE agendamentos SET nps_nota = $1, nps_comentario = $2 WHERE id = $3 RETURNING *',
      [nota, comentario, id]
    );
    return result.rows[0];
  }

  static async listarFilaParaAtraso(medico_id, data) {
    const result = await db.query(
      `SELECT a.*, p.nome as paciente_nome, p.whatsapp, m.nome as medico_nome 
       FROM agendamentos a 
       JOIN pacientes p ON a.paciente_id = p.id 
       JOIN medicos m ON a.medico_id = m.id 
       WHERE a.medico_id = $1 AND a.data_consulta = $2 
       AND a.status IN ('CONFIRMADO', 'PRESENTE')`,
      [medico_id, data]
    );
    return result.rows;
  }

  static async trocarHorarios(id1, horario1, medicoId1, id2, horario2, medicoId2) {
    await db.query('BEGIN');
    try {
      await db.query(
        'UPDATE agendamentos SET horario = $1, medico_id = $2, atualizado_em = NOW() WHERE id = $3',
        [horario2, medicoId2, id1]
      );
      await db.query(
        'UPDATE agendamentos SET horario = $1, medico_id = $2, atualizado_em = NOW() WHERE id = $3',
        [horario1, medicoId1, id2]
      );
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  }

  static async moverAgendamento(id, novoHorario, novoMedicoId) {
    let query = 'UPDATE agendamentos SET horario = $1, atualizado_em = NOW()';
    const params = [novoHorario];

    if (novoMedicoId) {
      query += ', medico_id = $3 WHERE id = $2 RETURNING *';
      params.push(id, novoMedicoId);
    } else {
      query += ' WHERE id = $2 RETURNING *';
      params.push(id);
    }

    const result = await db.query(query, params);
    return result.rows[0];
  }

  static async listarHistorico(paciente_id) {
    const result = await db.query(
      `SELECT a.*, m.nome as medico_nome, m.especialidade
       FROM agendamentos a
       JOIN medicos m ON a.medico_id = m.id
       WHERE a.paciente_id = $1 AND a.status = 'CONCLUIDO'
       ORDER BY a.data_consulta DESC`,
      [paciente_id]
    );
    return result.rows;
  }
}

module.exports = Agendamento;
