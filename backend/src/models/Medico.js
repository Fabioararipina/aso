const db = require('../config/database');

class Medico {
  static async listar() {
    const result = await db.query('SELECT * FROM medicos ORDER BY nome');
    return result.rows;
  }

  static async buscarPorId(id) {
    const result = await db.query('SELECT * FROM medicos WHERE id = $1', [id]);
    return result.rows[0];
  }

  // Métodos de Grade de Horários
  static async adicionarHorario(medico_id, dia_semana, hora_inicio, hora_fim, data_especifica, duracao_consulta) {
    const result = await db.query(
      'INSERT INTO horarios_medicos (medico_id, dia_semana, hora_inicio, hora_fim, data_especifica, duracao_consulta) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [medico_id, dia_semana, hora_inicio, hora_fim, data_especifica || null, duracao_consulta || 30]
    );
    return result.rows[0];
  }

  static async listarHorarios(medico_id) {
    // Ordena: Datas específicas primeiro, depois dias da semana
    const result = await db.query(
      'SELECT * FROM horarios_medicos WHERE medico_id = $1 ORDER BY data_especifica DESC NULLS LAST, dia_semana, hora_inicio',
      [medico_id]
    );
    return result.rows;
  }

  static async removerHorario(id) {
    await db.query('DELETE FROM horarios_medicos WHERE id = $1', [id]);
  }

  static async criar(nome, especialidade, foto_path, crm, valor_consulta) {
    const result = await db.query(
      'INSERT INTO medicos (nome, especialidade, foto_path, crm, valor_consulta) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, especialidade, foto_path, crm || '00000', valor_consulta || 150.00] 
    );
    return result.rows[0];
  }

  static async atualizar(id, nome, especialidade, crm, foto_path, valor_consulta) {
    let query = 'UPDATE medicos SET nome = $1, especialidade = $2, crm = $3, valor_consulta = $4';
    const params = [nome, especialidade, crm, valor_consulta || 150.00];
    
    // Se enviou foto nova, atualiza. Se não, mantém a antiga.
    if (foto_path) {
      query += ', foto_path = $5';
      params.push(foto_path);
      params.push(id); // ID vira o $6
      query += ' WHERE id = $6 RETURNING *';
    } else {
      params.push(id); // ID vira o $5
      query += ' WHERE id = $5 RETURNING *';
    }

    const result = await db.query(query, params);
    return result.rows[0];
  }

  static async excluir(id) {
    // 1. Remove dependências de Horários
    await db.query('DELETE FROM horarios_medicos WHERE medico_id = $1', [id]);
    
    // 2. Remove dependências de Bloqueios
    await db.query('DELETE FROM bloqueios_agenda WHERE medico_id = $1', [id]);

    // 3. Remove dependências de Agendamentos (Cuidado: apaga histórico)
    await db.query('DELETE FROM agendamentos WHERE medico_id = $1', [id]);

    // 4. Remove o Médico
    await db.query('DELETE FROM medicos WHERE id = $1', [id]);
  }

  static async definirAtraso(id, minutos) {
    const result = await db.query(
      'UPDATE medicos SET atraso_minutos = $1 WHERE id = $2 RETURNING *',
      [minutos, id]
    );
    return result.rows[0];
  }

  // Gera slots disponíveis para um dia específico
  static async buscarHorariosDisponiveis(medico_id, data) {
    // 1. Verificar se existe regra ESPECÍFICA para esta data
    let grade = await db.query(
      'SELECT * FROM horarios_medicos WHERE medico_id = $1 AND data_especifica = $2',
      [medico_id, data]
    );

    // 2. Se não tiver regra específica, busca a regra RECORRENTE (Dia da Semana)
    if (grade.rows.length === 0) {
      // FIX: Adiciona T12:00:00 para garantir que pegamos o dia correto independente do fuso horário
      const diaSemana = new Date(data + 'T12:00:00').getDay(); 
      grade = await db.query(
        'SELECT * FROM horarios_medicos WHERE medico_id = $1 AND dia_semana = $2 AND data_especifica IS NULL',
        [medico_id, diaSemana]
      );
    }

    if (grade.rows.length === 0) return [];

    // 3. Buscar agendamentos já marcados nessa data
    const ocupados = await db.query(
      'SELECT horario FROM agendamentos WHERE medico_id = $1 AND data_consulta = $2 AND status != $3',
      [medico_id, data, 'CANCELADO']
    );
    const horariosOcupados = new Set(ocupados.rows.map(r => r.horario.slice(0, 5)));

    // 4. Gerar slots
    let slots = [];
    for (const turno of grade.rows) {
      let atual = new Date(`${data}T${turno.hora_inicio}`);
      const fim = new Date(`${data}T${turno.hora_fim}`);
      const duracao = turno.duracao_consulta || 30;

      while (atual < fim) {
        const horaString = atual.toTimeString().slice(0, 5);
        
        if (!horariosOcupados.has(horaString)) {
          slots.push(horaString);
        }
        
        atual.setMinutes(atual.getMinutes() + duracao);
      }
    }

    return slots;
  }
}

module.exports = Medico;