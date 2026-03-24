const cron = require('node-cron');
const db = require('../../config/database');
const whatsappService = require('../whatsapp/whatsappService');

class ConfirmacaoService {
  constructor() {
    this.iniciarCron();
  }

  iniciarCron() {
    // Roda de hora em hora (ex: 08:00, 09:00...)
    cron.schedule('0 * * * *', async () => {
      console.log('⏳ Verificando agendamentos pendentes para cobrança...');
      await this.processarCobrancas();
    });
  }

  ehHorarioComercial() {
    const hora = new Date().getHours();
    return hora >= 8 && hora < 18;
  }

  async processarCobrancas() {
    // Se não for horário comercial, não manda mensagem (para não acordar ninguém)
    // Mas a lógica de expiração poderia rodar. Vamos respeitar o silêncio por enquanto.
    if (!this.ehHorarioComercial()) return;

    try {
      // Busca pendentes criados nas últimas 24h
      const query = `
        SELECT a.id, p.nome, p.whatsapp, a.criado_em, m.nome as medico_nome, a.horario
        FROM agendamentos a
        JOIN pacientes p ON a.paciente_id = p.id
        JOIN medicos m ON a.medico_id = m.id
        WHERE a.status = 'PENDENTE'
        AND a.criado_em > NOW() - INTERVAL '24 hours'
      `;
      
      const { rows } = await db.query(query);

      for (const item of rows) {
        await this.analisarAgendamento(item);
      }
    } catch (error) {
      console.error('Erro na rotina de confirmação:', error);
    }
  }

  async analisarAgendamento(item) {
    const agora = new Date();
    const criadoEm = new Date(item.criado_em);
    const diffHoras = Math.floor((agora - criadoEm) / (1000 * 60 * 60));

    // Lógica de Régua de Cobrança
    // Hora 1: Aviso suave
    // Hora 2: Aviso urgência
    // Hora 3: Ultimato
    // Hora 4: Cancelamento

    let msg = '';

    if (diffHoras === 1) {
      msg = `Olá ${item.nome}, seu horário com Dr(a) ${item.medico_nome} às ${item.horario.slice(0,5)} ainda não está garantido. ⏳\n\nEntre em contato com a recepção para confirmar ou realizar o pagamento.`;
    } else if (diffHoras === 2) {
      msg = `⚠️ ${item.nome}, faltam apenas 2 horas para sua pré-reserva expirar. \n\nGaranta seu atendimento agora enviando o comprovante ou confirmando presença.`;
    } else if (diffHoras === 3) {
      msg = `🚨 ÚLTIMO AVISO: Seu agendamento será cancelado automaticamente em 1 hora se não houver confirmação.\n\nNão perca sua vaga com Dr(a) ${item.medico_nome}!`;
    } else if (diffHoras >= 4) {
      // CANCELAR
      await db.query("UPDATE agendamentos SET status = 'CANCELADO', atualizado_em = NOW() WHERE id = $1", [item.id]);
      msg = `❌ Seu pré-agendamento expirou e a vaga foi liberada.\n\nCaso ainda queira ser atendido, por favor realize um novo agendamento no site.`;
      console.log(`Agendamento ${item.id} cancelado por falta de confirmação.`);
    }

    if (msg) {
      await whatsappService.enviarMensagem(item.whatsapp, msg);
    }
  }
}

module.exports = new ConfirmacaoService();
