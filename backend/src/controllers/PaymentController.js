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
      const dados = await MercadoPagoService.criarPix(id);
      res.json(dados);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async webhook(req, res) {
    try {
      const { type, data } = req.body;
      
      if (type === 'payment') {
        const id = data.id;
        const status = await MercadoPagoService.processarWebhook(id);
        
        // Se aprovado, emite evento para o frontend
        if (status === 'approved') {
           const io = req.app.get('io');
           io.emit('pagamento-aprovado', { payment_id: id });
        }
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error(error);
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
