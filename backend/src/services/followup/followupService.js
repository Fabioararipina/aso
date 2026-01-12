const cron = require('node-cron');
const db = require('../../config/database');
const whatsappService = require('../whatsapp/whatsappService');

class FollowupService {
  constructor() {
    this.iniciarCron();
  }

  iniciarCron() {
    // Roda todos os dias às 09:00 da manhã
    cron.schedule('0 9 * * *', async () => {
      console.log('🗓️ Iniciando rotina de Follow-up (15 dias)...');
      await this.enviarFollowups();
    });
  }

  async enviarFollowups() {
    try {
      // Busca consultas concluídas há exatos 15 dias
      // A query compara a data da consulta com a data de 15 dias atrás
      const query = `
        SELECT a.id, p.nome, p.whatsapp, m.nome as medico_nome, a.data_consulta
        FROM agendamentos a
        JOIN pacientes p ON a.paciente_id = p.id
        JOIN medicos m ON a.medico_id = m.id
        WHERE a.status = 'CONCLUIDO' 
        AND a.data_consulta = CURRENT_DATE - INTERVAL '15 days'
      `;
      
      const { rows } = await db.query(query);

      if (rows.length === 0) {
        console.log('Nenhum follow-up para hoje.');
        return;
      }

      for (const item of rows) {
        const msg = `Olá ${item.nome}, tudo bem? 🌿\n\nJá se passaram 15 dias da sua consulta com Dr(a). ${item.medico_nome}. \n\nComo você está se sentindo? O tratamento deu certo?\nEstamos à disposição caso precise agendar um retorno!`;
        
        await whatsappService.enviarMensagem(item.whatsapp, msg);
        console.log(`Follow-up enviado para ${item.nome}`);
      }
    } catch (error) {
      console.error('Erro ao processar Follow-up:', error);
    }
  }
}

module.exports = new FollowupService();
