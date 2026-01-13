const db = require('../config/database');

class MetricasController {
  static async obterIndicadores(req, res) {
    try {
      const { inicio, fim } = req.query;
      
      // Default: Mês atual se não vier data
      const dataInicio = inicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const dataFim = fim || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

      // 1. KPIs Gerais
      const kpisQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'CONCLUIDO' THEN 1 END) as concluidos,
          COUNT(CASE WHEN status = 'CANCELADO' THEN 1 END) as cancelados,
          COUNT(CASE WHEN status = 'PENDENTE' THEN 1 END) as pendentes,
          AVG(CASE WHEN nps_nota IS NOT NULL THEN nps_nota END)::NUMERIC(10,1) as nps_medio,
          SUM(valor) as faturamento_estimado
        FROM agendamentos
        WHERE data_consulta BETWEEN $1 AND $2
      `;
      const kpis = await db.query(kpisQuery, [dataInicio, dataFim]);

      // 2. Gráfico: Atendimentos por Dia
      const evolucaoQuery = `
        SELECT to_char(data_consulta, 'DD/MM') as dia, COUNT(*) as qtd
        FROM agendamentos
        WHERE data_consulta BETWEEN $1 AND $2
        GROUP BY data_consulta
        ORDER BY data_consulta
      `;
      const evolucao = await db.query(evolucaoQuery, [dataInicio, dataFim]);

      // 3. Performance por Médico (Com Tempos Médios)
      // Obs: Tempo de Espera = (Inicio Atendimento - Horario Agendado)
      // Obs: Duração = (Atualizado_em (Conclusão) - Inicio Atendimento)
      const medicosQuery = `
        SELECT 
          m.nome,
          COUNT(a.id) as total_agendamentos,
          COUNT(CASE WHEN a.status = 'CONCLUIDO' THEN 1 END) as atendidos,
          AVG(a.nps_nota)::NUMERIC(10,1) as nota_media,
          
          -- Tempo Médio de Espera (em minutos) (Considerando apenas quem foi atendido)
          AVG(
            CASE WHEN a.inicio_atendimento IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (a.inicio_atendimento - (a.data_consulta + a.horario::time))) / 60 
            END
          )::INTEGER as espera_media,

          -- Tempo Médio de Duração (em minutos)
          AVG(
            CASE WHEN a.inicio_atendimento IS NOT NULL AND a.status = 'CONCLUIDO'
            THEN EXTRACT(EPOCH FROM (a.atualizado_em - a.inicio_atendimento)) / 60 
            END
          )::INTEGER as duracao_media

        FROM agendamentos a
        JOIN medicos m ON a.medico_id = m.id
        WHERE a.data_consulta BETWEEN $1 AND $2
        GROUP BY m.id, m.nome
        ORDER BY atendidos DESC
      `;
      const performanceMedicos = await db.query(medicosQuery, [dataInicio, dataFim]);

      // 4. Horários de Pico (Heatmap simples)
      const picoQuery = `
        SELECT SUBSTRING(horario::text, 1, 2) as hora, COUNT(*) as volume
        FROM agendamentos
        WHERE data_consulta BETWEEN $1 AND $2
        GROUP BY 1
        ORDER BY 1
      `;
      const pico = await db.query(picoQuery, [dataInicio, dataFim]);

      // 5. Novos vs Retorno
      const tiposQuery = `
        SELECT tipo_consulta, COUNT(*) as qtd
        FROM agendamentos
        WHERE data_consulta BETWEEN $1 AND $2
        GROUP BY tipo_consulta
      `;
      const tipos = await db.query(tiposQuery, [dataInicio, dataFim]);

      // 6. Demanda por Especialidade
      const especialidadesQuery = `
        SELECT m.especialidade, COUNT(a.id) as volume
        FROM agendamentos a
        JOIN medicos m ON a.medico_id = m.id
        WHERE a.data_consulta BETWEEN $1 AND $2
        GROUP BY m.especialidade
        ORDER BY volume DESC
      `;
      const especialidades = await db.query(especialidadesQuery, [dataInicio, dataFim]);

      res.json({
        periodo: { inicio: dataInicio, fim: dataFim },
        kpis: kpis.rows[0],
        evolucao_diaria: evolucao.rows,
        performance_medicos: performanceMedicos.rows,
        horarios_pico: pico.rows,
        tipos_consulta: tipos.rows,
        especialidades: especialidades.rows
      });

    } catch (error) {
      console.error('Erro ao gerar métricas:', error);
      res.status(500).json({ erro: error.message });
    }
  }
}

module.exports = MetricasController;
