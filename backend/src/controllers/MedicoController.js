const Medico = require('../models/Medico');
const Agendamento = require('../models/Agendamento');
const whatsappService = require('../services/whatsapp/whatsappService');

class MedicoController {
  static async listar(req, res) {
    try {
      const medicos = await Medico.listar();
      res.json(medicos);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async notificarAtraso(req, res) {
    try {
      const { id } = req.params; // medico_id
      const { minutos } = req.body;
      
      // 1. Atualiza no banco para refletir na TV
      await Medico.definirAtraso(id, minutos);

      // 2. Notifica via WhatsApp
      const hoje = new Date().toISOString().split('T')[0];
      const agendamentos = await Agendamento.listarFilaParaAtraso(id, hoje);

      let cont = 0;
      for (const ag of agendamentos) {
        const linkFila = `${process.env.FRONTEND_URL || 'http://192.168.20.19:3000'}/agendamento/fila/${ag.id}`;
        
        const msg = `
⚠️ *AVISO DE ATRASO*
-------------------------------
Olá, *${ag.paciente_nome}*.
Houve um imprevisto na agenda.

👨‍⚕️ *Profissional:* Dr(a). ${ag.medico_nome}
⏱️ *Atraso Estimado:* ${minutos} minutos

Agradecemos a compreensão.
Sua posição na fila continua garantida.

🔗 *Acompanhe:*
${linkFila}
`;
        
        await whatsappService.enviarMensagem(ag.whatsapp, msg);
        cont++;
      }

      res.json({ sucesso: true, mensagens_enviadas: cont });
    } catch (error) {
      console.error('Erro ao notificar atraso:', error);
      res.status(500).json({ erro: error.message });
    }
  }

  static async adicionarHorario(req, res) {
    try {
      const { id } = req.params; // medico_id
      const { dia_semana, hora_inicio, hora_fim, data_especifica, duracao } = req.body;
      const horario = await Medico.adicionarHorario(id, dia_semana, hora_inicio, hora_fim, data_especifica, duracao);
      res.json(horario);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async listarHorarios(req, res) {
    try {
      const { id } = req.params;
      const horarios = await Medico.listarHorarios(id);
      res.json(horarios);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async removerHorario(req, res) {
    try {
      const { id } = req.params; // id do slot
      await Medico.removerHorario(id);
      res.json({ sucesso: true });
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async disponiveis(req, res) {
    try {
      const { id } = req.params; // medico_id
      const { data } = req.query; // YYYY-MM-DD
      
      // Ajuste de fuso horário simples (considerando que o input vem YYYY-MM-DD correto)
      // O new Date(data) pega UTC meia noite. O getDay() retorna dia da semana UTC.
      // Para garantir, vamos criar a data adicionando horas para cair no dia certo localmente
      const dataObj = new Date(data + 'T12:00:00'); 
      
      const slots = await Medico.buscarHorariosDisponiveis(id, data);
      res.json(slots);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async criar(req, res) {
    try {
      console.log('Recebendo requisição de criação de médico...');
      console.log('Body:', req.body);
      console.log('File:', req.file);

      const { nome, especialidade, crm, valor_consulta } = req.body;
      const foto_path = req.file ? req.file.filename : null; 
      
      const medico = await Medico.criar(nome, especialidade, foto_path, crm, valor_consulta);
      console.log('Médico criado com sucesso:', medico);
      res.json(medico);
    } catch (error) {
      console.error('ERRO AO CRIAR MÉDICO:', error);
      res.status(500).json({ erro: error.message, stack: error.stack });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, especialidade, crm, valor_consulta } = req.body;
      const foto_path = req.file ? req.file.filename : null;
      
      const medico = await Medico.atualizar(id, nome, especialidade, crm, foto_path, valor_consulta);
      res.json(medico);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async excluir(req, res) {
    try {
      const { id } = req.params;
      await Medico.excluir(id);
      res.json({ sucesso: true });
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }
}

module.exports = MedicoController;
