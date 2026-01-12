const cron = require('node-cron');
const db = require('../../config/database');
const whatsappService = require('../whatsapp/whatsappService');

class NpsService {
  constructor() {
    this.iniciarCron();
  }

  iniciarCron() {
    // Roda a cada 30 minutos
    cron.schedule('*/30 * * * *', async () => {
      console.log('🔎 Buscando agendamentos para enviar NPS...');
      await this.enviarPesquisasPendentes();
    });
  }

  async enviarPesquisasPendentes() {
    try {
      // Busca agendamentos CONCLUÍDOS há mais de 2 horas e que AINDA NÃO receberam NPS
      // Usa intervalo de 2 horas atrás até 24h atrás para não mandar coisa velha demais
      const query = `
        SELECT a.id, p.nome, p.whatsapp 
        FROM agendamentos a
        JOIN pacientes p ON a.paciente_id = p.id
        WHERE a.status = 'CONCLUIDO' 
        AND a.nps_enviado = FALSE
        AND a.atualizado_em < NOW() - INTERVAL '2 hours'
        AND a.atualizado_em > NOW() - INTERVAL '24 hours'
      `;
      
      const { rows } = await db.query(query);

      for (const agendamento of rows) {
        await this.enviarNps(agendamento);
      }
    } catch (error) {
      console.error('Erro ao processar NPS:', error);
    }
  }

  async enviarNps(agendamento) {
    const link = `${process.env.FRONTEND_URL}/feedback/${agendamento.id}`;
    const msg = `Olá ${agendamento.nome}, esperamos que sua consulta tenha sido ótima! 🌟\n\nPoderia avaliar nosso atendimento rapidinho?\nÉ só clicar aqui: ${link}`;

    const enviado = await whatsappService.enviarMensagem(agendamento.whatsapp, msg);

    if (enviado) {
      await db.query('UPDATE agendamentos SET nps_enviado = TRUE WHERE id = $1', [agendamento.id]);
      console.log(`NPS enviado para ${agendamento.nome} (ID: ${agendamento.id})`);
    }
  }
}

module.exports = new NpsService();
