const Agendamento = require('../models/Agendamento');
const Paciente = require('../models/Paciente');
const whatsappService = require('../services/whatsapp/whatsappService');

class AgendamentoController {
  static async criar(req, res) {
    try {
      const { nome, whatsapp, email, medico_id, data_consulta, horario, observacoes } = req.body;
      
      let paciente = await Paciente.buscarPorWhatsapp(whatsapp);
      if (!paciente) {
        paciente = await Paciente.criar({ nome, whatsapp, email });
      }
      
      const agendamento = await Agendamento.criar({
        paciente_id: paciente.id,
        medico_id,
        data_consulta,
        horario,
        observacoes
      });

      // Busca dados completos para notificação
      const agendamentoCompleto = await Agendamento.buscarPorId(agendamento.id);

      // Envia WhatsApp estilo "Cupom"
      const msg = `
*ESSENCIAL SAÚDE*

🎫 *SOLICITAÇÃO RECEBIDA* 🎫
--------------------------------
Olá *${agendamentoCompleto.paciente_nome}*,
Recebemos seu pedido de agendamento.

👨‍⚕️ *Profissional:* ${agendamentoCompleto.medico_nome}
📅 *Data:* ${new Date(agendamentoCompleto.data_consulta).toLocaleDateString('pt-BR')}
⏰ *Horário:* ${agendamentoCompleto.horario.slice(0, 5)}
📂 *Status:* 🟡 PENDENTE

--------------------------------
ℹ️ *Aguarde a confirmação.*
Você receberá uma nova mensagem assim que o horário for aprovado pela recepção.

🌳 *CONHEÇA AGORA:*
*Cartão Essencial Saúde*
Descontos exclusivos em consultas e exames:
${process.env.FRONTEND_URL}/cartao

🎁 *Tem alguém precisando cuidar da saúde?*
Indique clicando aqui:
${process.env.FRONTEND_URL}/agendamento/sucesso?id=${agendamento.id}
`;
      whatsappService.enviarMensagem(agendamentoCompleto.whatsapp, msg);

      const io = req.app.get('io');
      io.emit('novo-agendamento', agendamentoCompleto); // Envia completo para a recepção já ver o nome
      
      res.json({ sucesso: true, agendamento });
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async buscarPorId(req, res) {
    try {
      const { id } = req.params;
      const agendamento = await Agendamento.buscarPorId(id);
      if (!agendamento) return res.status(404).json({ erro: 'Não encontrado' });
      res.json(agendamento);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async listarPorDia(req, res) {
    try {
      const { data } = req.query; // YYYY-MM-DD
      const agendamentos = await Agendamento.listarTodosPorData(data);
      res.json(agendamentos);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async dadosTv(req, res) {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const lista = await Agendamento.listarParaTv(hoje);

      // Agrupar por médico para calcular previsão cumulativa
      const filasPorMedico = {};
      const listaProcessada = lista.map(item => {
        const medicoId = item.medico_id;
        const tempoMedio = item.tempo_medio || 20; // Default 20 min

        if (!filasPorMedico[medicoId]) {
          filasPorMedico[medicoId] = 0; // Minutos acumulados
        }

        let previsao = 'Em breve';
        
        if (item.status === 'EM_ATENDIMENTO') {
          previsao = 'Agora';
        } else {
          // Calcula hora estimada: Agora + Acumulado
          const minutosEspera = filasPorMedico[medicoId];
          const dataPrevisao = new Date();
          dataPrevisao.setMinutes(dataPrevisao.getMinutes() + minutosEspera);
          
          previsao = dataPrevisao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          
          // Incrementa fila para o próximo
          filasPorMedico[medicoId] += tempoMedio;
        }

        return { ...item, previsao };
      });

      res.json(listaProcessada);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async listarPendentes(req, res) {
    try {
      const pendentes = await Agendamento.listarPendentes();
      res.json(pendentes);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async confirmar(req, res) {
    try {
      const { id } = req.params;
      const agendamento = await Agendamento.confirmar(id);
      
      // Buscar dados completos para mandar o zap personalizado
      const agendamentoCompleto = await Agendamento.buscarPorId(id);
      
      console.log('Tentando enviar WhatsApp de confirmação para:', agendamentoCompleto.whatsapp);

      const msg = `Olá ${agendamentoCompleto.paciente_nome}, seu agendamento com Dr(a). ${agendamentoCompleto.medico_nome} no dia ${new Date(agendamentoCompleto.data_consulta).toLocaleDateString('pt-BR')} às ${agendamentoCompleto.horario.slice(0,5)} foi CONFIRMADO.`;
      
      const enviou = await whatsappService.enviarMensagem(agendamentoCompleto.whatsapp, msg);
      console.log('Resultado do envio WhatsApp:', enviou ? 'SUCESSO' : 'FALHA');

      const io = req.app.get('io');
      io.emit('agendamento-confirmado', { agendamento_id: id });
      
      res.json(agendamento);
    } catch (error) {
      console.error('Erro no confirmar:', error);
      res.status(500).json({ erro: error.message });
    }
  }

  static async cancelar(req, res) {
    try {
      const { id } = req.params;
      const agendamento = await Agendamento.cancelar(id);
      
      const io = req.app.get('io');
      io.emit('agendamento-cancelado', { agendamento_id: id });
      
      res.json(agendamento);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async listarPorMedico(req, res) {
    try {
      const { medico_id } = req.params;
      const { data } = req.query;
      // Se vier data na query usa ela, senão usa hoje
      const dataFiltro = data || new Date().toISOString().split('T')[0]; 
      
      const agendamentos = await Agendamento.listarPorMedicoEData(medico_id, dataFiltro);
      res.json(agendamentos);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async alterarStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const agendamento = await Agendamento.atualizarStatus(id, status);
      const agendamentoCompleto = await Agendamento.buscarPorId(id);
      
      const io = req.app.get('io');
      
      // Evento geral de atualização
      io.emit('agendamento-atualizado', agendamento);
      
      // Se for chamar o paciente, emite evento específico para TV e manda ZAP
      if (status === 'EM_ATENDIMENTO') {
        io.emit('chamar-paciente', agendamentoCompleto);
        
        // 1. Avisa o paciente atual
        const msgAtual = `🔔 *SUA VEZ!* \nOlá ${agendamentoCompleto.paciente_nome}, o Dr(a). ${agendamentoCompleto.medico_nome} já está lhe aguardando no consultório. Pode entrar!`;
        whatsappService.enviarMensagem(agendamentoCompleto.whatsapp, msgAtual);

        // 2. Avisa o PRÓXIMO da fila
        const hoje = new Date().toISOString().split('T')[0];
        const proximo = await Agendamento.buscarProximoDaFila(agendamentoCompleto.medico_id, hoje);
        
        if (proximo) {
          const tempoMedio = await Agendamento.calcularTempoMedio(agendamentoCompleto.medico_id);
          const msgProximo = `⏳ *PREPARE-SE!* \nOlá ${proximo.paciente_nome}, você é o próximo da fila para atendimento com Dr(a). ${agendamentoCompleto.medico_nome}. \nTempo estimado: ~${tempoMedio} min. \nPor favor, fique atento(a)!`;
          whatsappService.enviarMensagem(proximo.whatsapp, msgProximo);
        }
      }

      res.json(agendamento);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async enviarProntuario(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
      }

      const { id } = req.params;
      const filePath = req.file.path;

      // Atualiza banco e marca como CONCLUIDO
      const agendamento = await Agendamento.salvarProntuario(id, filePath);
      const agendamentoCompleto = await Agendamento.buscarPorId(id);

      // Envia via WhatsApp
      const legenda = `📄 Olá ${agendamentoCompleto.paciente_nome}, aqui está o seu documento (Prontuário/Receita) da consulta com Dr(a). ${agendamentoCompleto.medico_nome}.`;
      await whatsappService.enviarArquivo(agendamentoCompleto.whatsapp, filePath, legenda);

      // Notifica frontends
      const io = req.app.get('io');
      io.emit('agendamento-atualizado', agendamento);

      res.json({ sucesso: true, mensagem: 'Prontuário enviado com sucesso.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ erro: error.message });
    }
  }

  static async receberFeedback(req, res) {
    try {
      const { id } = req.params;
      const { nota, comentario } = req.body;

      const agendamento = await Agendamento.salvarNps(id, nota, comentario);

      // Se a nota for baixa, alerta a gestão (console ou log por enquanto)
      if (nota <= 6) {
        console.log(`⚠️ ALERTA DE DETRATOR: Agendamento ${id} deu nota ${nota}. Motivo: ${comentario}`);
        // Futuramente mandar zap pro gerente
      }

      res.json({ sucesso: true, agendamento });
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }
}

module.exports = AgendamentoController;
