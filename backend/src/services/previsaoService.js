const pool = require('../config/database');

function calcularBase(hora_inicio) {
  const agora = new Date();
  if (!hora_inicio) return agora;
  const [hh, mm] = hora_inicio.split(':');
  const inicio = new Date();
  inicio.setHours(parseInt(hh), parseInt(mm), 0, 0);
  return inicio > agora ? inicio : agora;
}

async function calcularTodasSalas(atendimento_id) {
  const { rows: filas } = await pool.query(`
    SELECT fs.sala_id, s.nome, s.tempo_medio_min, s.hora_inicio,
      (SELECT COUNT(*) FROM fila_salas fs2 WHERE fs2.sala_id=fs.sala_id AND fs2.status='PENDENTE' AND fs2.posicao < fs.posicao) as posicao
    FROM fila_salas fs
    JOIN salas s ON s.id=fs.sala_id
    WHERE fs.atendimento_id=$1 AND fs.status='PENDENTE'
  `, [atendimento_id]);

  return filas.map(f => {
    const base = calcularBase(f.hora_inicio);
    const minutos = parseInt(f.posicao) * f.tempo_medio_min;
    const previsao = new Date(base.getTime() + minutos * 60000);
    return {
      sala_nome: f.nome,
      posicao: parseInt(f.posicao),
      previsao: previsao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  });
}

module.exports = { calcularTodasSalas };
