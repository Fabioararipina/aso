const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
const Agendamento = require('../../models/Agendamento');
const whatsappService = require('../whatsapp/whatsappService');

// Inicializa o cliente com o Token do .env
const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
});

class MercadoPagoService {
  
  static async criarPreferencia(agendamentoId) {
    try {
      const agendamento = await Agendamento.buscarPorId(agendamentoId);
      if (!agendamento) throw new Error('Agendamento não encontrado');

      const preference = new Preference(client);
      
      const frontendUrl = process.env.FRONTEND_URL || 'https://portal.primeatende.com.br';
      const apiUrl = process.env.API_URL || 'https://api-agendamento.primeatende.com.br';

      const body = {
        items: [
          {
            id: agendamento.id.toString(),
            title: `Consulta Médica - ${agendamento.medico_nome}`,
            quantity: 1,
            unit_price: Number(agendamento.valor) || 150.00,
            currency_id: 'BRL'
          }
        ],
        payer: {
          email: agendamento.email || 'paciente@email.com',
          name: agendamento.paciente_nome
        },
        back_urls: {
          success: `${frontendUrl}/agendamento/sucesso?id=${agendamento.id}`,
          failure: `${frontendUrl}/agendamento/sucesso?id=${agendamento.id}`,
          pending: `${frontendUrl}/agendamento/sucesso?id=${agendamento.id}`
        },
        auto_return: 'approved',
        notification_url: `${apiUrl}/api/pagamentos/webhook`,
        external_reference: agendamento.id.toString()
      };

      const result = await preference.create({ body });
      
      const db = require('../../config/database');
      await db.query(
        `UPDATE agendamentos SET payment_link = $1 WHERE id = $2`,
        [result.init_point, agendamentoId]
      );

      return {
        init_point: result.init_point,
        id: result.id
      };
    } catch (error) {
      console.error('Erro ao criar preferência:', error);
      throw error;
    }
  }

  static async criarPix(agendamentoId) {
    try {
      const agendamento = await Agendamento.buscarPorId(agendamentoId);
      if (!agendamento) throw new Error('Agendamento não encontrado');

      if (agendamento.payment_status === 'approved') {
        throw new Error('Agendamento já está pago.');
      }

      const payment = new Payment(client);
      const Paciente = require('../../models/Paciente');
      const paciente = await Paciente.buscarPorId(agendamento.paciente_id);
      const payerEmail = paciente && paciente.email ? paciente.email : 'paciente@email.com';
      
      const apiUrl = process.env.API_URL || 'https://api-agendamento.primeatende.com.br';

      const body = {
        transaction_amount: Number(agendamento.valor) || 150.00,
        description: `Consulta Médica - ${agendamento.medico_nome}`,
        payment_method_id: 'pix',
        payer: {
          email: payerEmail,
          first_name: agendamento.paciente_nome.split(' ')[0],
          last_name: agendamento.paciente_nome.split(' ').slice(1).join(' ') || 'Paciente',
          entity_type: 'individual',
          type: 'customer',
        },
        notification_url: `${apiUrl}/api/pagamentos/webhook`
      };

      const result = await payment.create({ body });
      
      const qrCode = result.point_of_interaction.transaction_data.qr_code;
      const qrCodeBase64 = result.point_of_interaction.transaction_data.qr_code_base64;
      const paymentId = result.id.toString();
      const ticketUrl = result.point_of_interaction.transaction_data.ticket_url;

      const db = require('../../config/database');
      await db.query(
        `UPDATE agendamentos SET 
          payment_id = $1, 
          qr_code = $2, 
          qr_code_base64 = $3, 
          payment_link = $4 
         WHERE id = $5`,
        [paymentId, qrCode, qrCodeBase64, ticketUrl, agendamentoId]
      );

      return {
        id: paymentId,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        ticket_url: ticketUrl,
        status: result.status
      };

    } catch (error) {
      console.error('Erro ao criar PIX:', error);
      throw error;
    }
  }

  static async processarWebhook(id) {
    try {
      const payment = new Payment(client);
      const pagamento = await payment.get({ id });

      console.log(`[WEBHOOK] Pagamento ${id} status: ${pagamento.status}`);

      if (pagamento.status === 'approved') {
        const db = require('../../config/database');
        
        const result = await db.query(
          `UPDATE agendamentos SET 
            payment_status = 'approved', 
            status = 'CONFIRMADO' 
           WHERE payment_id = $1 
           RETURNING *`,
          [id.toString()]
        );

        const agendamento = result.rows[0];

        if (agendamento) {
          console.log(`[PAGAMENTO] Agendamento ${agendamento.id} CONFIRMADO via PIX!`);
          
          const frontendUrl = process.env.FRONTEND_URL || 'https://portal.primeatende.com.br';
          
          const msg = `
✅ *PAGAMENTO CONFIRMADO!*
-------------------------------
Olá, *${agendamento.paciente_nome || 'Paciente'}*!
Recebemos seu pagamento via PIX.

Seu agendamento está *100% confirmado*.

👨‍⚕️ *Médico:* ${agendamento.medico_nome || 'Especialista'}
📅 *Data:* ${new Date(agendamento.data_consulta).toLocaleDateString('pt-BR')}
⏰ *Horário:* ${agendamento.horario}

🔗 *Acompanhe sua vez:*
${frontendUrl}/agendamento/fila/${agendamento.id}
`;
          const AgendamentoModel = require('../../models/Agendamento');
          const dadosCompletos = await AgendamentoModel.buscarPorId(agendamento.id);
          await whatsappService.enviarMensagem(dadosCompletos.whatsapp, msg);
        }
      }

      return pagamento.status;

    } catch (error) {
      console.error('Erro no Webhook:', error);
      throw error;
    }
  }
}

module.exports = MercadoPagoService;
