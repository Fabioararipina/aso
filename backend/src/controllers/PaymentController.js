const MercadoPagoService = require('../services/payment/mercadoPagoService');
const Agendamento = require('../models/Agendamento');

class PaymentController {
  static async gerarLink(req, res) {
    try {
      const { id } = req.params;
      const dados = await MercadoPagoService.criarPreferencia(id);
      res.json(dados);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async gerarPix(req, res) {
    try {
      const { id } = req.params; // ID do agendamento
      console.log(`[PAGAMENTO] Solicitando PIX para agendamento: ${id}`);
      const dados = await MercadoPagoService.criarPix(id);
      res.json(dados);
    } catch (error) {
      console.error(`[ERRO PIX] Falha ao gerar PIX para agendamento ${req.params.id}:`, error);
      // Se o erro for do Mercado Pago, ele vem com detalhes no .message ou .cause
      const mensagemErro = error.message || 'Erro interno ao gerar PIX';
      res.status(500).json({ erro: mensagemErro, detalhes: error.cause || null });
    }
  }

  static async webhook(req, res) {
    try {
      console.log('--- RECEBENDO WEBHOOK MERCADO PAGO ---');
      console.log('Body:', JSON.stringify(req.body, null, 2));
      console.log('Query:', JSON.stringify(req.query, null, 2));
      
      const { type, action, data } = req.body;
      
      // O Mercado Pago pode enviar 'type' ou 'action' dependendo da versão/evento
      const eventoTipo = type || action;
      
      if (eventoTipo === 'payment' || action === 'payment.created' || action === 'payment.updated') {
        const paymentId = data?.id || req.body.resource?.split('/').pop();
        
        if (paymentId) {
          console.log(`[WEBHOOK] Processando pagamento ID: ${paymentId}`);
          const status = await MercadoPagoService.processarWebhook(paymentId);
          console.log(`[WEBHOOK] Status processado: ${status}`);
          
          if (status === 'approved') {
             const io = req.app.get('io');
             if (io) {
               io.emit('pagamento-aprovado', { payment_id: paymentId });
             }
          }
        }
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('[ERRO WEBHOOK]:', error);
      res.status(500).send('Erro');
    }
  }

  static async consultarStatus(req, res) {
    try {
      const { id } = req.params; // ID do agendamento
      const agendamento = await Agendamento.buscarPorId(id);
      
      if (!agendamento) return res.status(404).json({ erro: 'Não encontrado' });

      res.json({
        id: agendamento.id,
        payment_status: agendamento.payment_status,
        qr_code: agendamento.qr_code,
        qr_code_base64: agendamento.qr_code_base64
      });
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }
}

module.exports = PaymentController;
