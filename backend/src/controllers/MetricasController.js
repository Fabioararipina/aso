const pool = require('../config/database');

exports.obterIndicadores = async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    const hoje = new Date();
    const dataInicio = inicio || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const dataFim    = fim    || new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

    // 1. KPIs gerais
    const { rows: [kpis] } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'CONCLUIDO'  THEN 1 END) AS concluidos,
        COUNT(CASE WHEN status = 'CANCELADO'  THEN 1 END) AS cancelados,
        COUNT(CASE WHEN status IN ('PRESENTE','EM_ATENDIMENTO') THEN 1 END) AS em_andamento,
        AVG(
          CASE WHEN status = 'CONCLUIDO' AND atualizado_em IS NOT NULL
          THEN EXTRACT(EPOCH FROM (atualizado_em - criado_em)) / 60 END
        )::NUMERIC(10,1) AS tempo_medio_min
      FROM atendimentos
      WHERE criado_em::date BETWEEN $1 AND $2
    `, [dataInicio, dataFim]);

    // 2. Volume diário
    const { rows: evolucao_diaria } = await pool.query(`
      SELECT to_char(criado_em::date, 'DD/MM') AS dia, COUNT(*) AS qtd
      FROM atendimentos
      WHERE criado_em::date BETWEEN $1 AND $2
      GROUP BY criado_em::date
      ORDER BY criado_em::date
    `, [dataInicio, dataFim]);

    // 3. Por tipo de ASO
    const { rows: tipos_aso } = await pool.query(`
      SELECT COALESCE(tipo_aso, 'Não informado') AS tipo, COUNT(*) AS qtd
      FROM atendimentos
      WHERE criado_em::date BETWEEN $1 AND $2
      GROUP BY tipo_aso
      ORDER BY qtd DESC
    `, [dataInicio, dataFim]);

    // 4. Top empresas
    const { rows: top_empresas } = await pool.query(`
      SELECT COALESCE(empresa, 'Não informada') AS empresa, COUNT(*) AS total
      FROM atendimentos
      WHERE criado_em::date BETWEEN $1 AND $2
      GROUP BY empresa
      ORDER BY total DESC
      LIMIT 10
    `, [dataInicio, dataFim]);

    // 5. Performance por sala (tempo médio de espera e de atendimento)
    const { rows: performance_salas } = await pool.query(`
      SELECT
        s.nome AS sala,
        COUNT(fs.id) AS total_pacientes,
        COUNT(CASE WHEN fs.status = 'CONCLUIDO_SALA' THEN 1 END) AS concluidos,
        AVG(
          CASE WHEN fs.chamado_em IS NOT NULL
          THEN EXTRACT(EPOCH FROM (fs.chamado_em - a.criado_em)) / 60 END
        )::INTEGER AS espera_media_min,
        AVG(
          CASE WHEN fs.concluido_em IS NOT NULL AND fs.chamado_em IS NOT NULL
          THEN EXTRACT(EPOCH FROM (fs.concluido_em - fs.chamado_em)) / 60 END
        )::INTEGER AS duracao_media_min
      FROM fila_salas fs
      JOIN salas s ON s.id = fs.sala_id
      JOIN atendimentos a ON a.id = fs.atendimento_id
      WHERE a.criado_em::date BETWEEN $1 AND $2
      GROUP BY s.id, s.nome
      ORDER BY s.nome
    `, [dataInicio, dataFim]);

    // 6. Horários de pico (check-ins por hora)
    const { rows: horarios_pico } = await pool.query(`
      SELECT EXTRACT(HOUR FROM criado_em)::INTEGER AS hora, COUNT(*) AS volume
      FROM atendimentos
      WHERE criado_em::date BETWEEN $1 AND $2
      GROUP BY hora
      ORDER BY hora
    `, [dataInicio, dataFim]);

    res.json({
      periodo: { inicio: dataInicio, fim: dataFim },
      kpis,
      evolucao_diaria,
      tipos_aso,
      top_empresas,
      performance_salas,
      horarios_pico,
    });
  } catch (err) {
    console.error('[Metricas]', err);
    res.status(500).json({ error: err.message });
  }
};
