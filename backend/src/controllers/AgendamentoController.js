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
🎫 *SOLICITAÇÃO DE AGENDAMENTO*
-------------------------------
Olá, *${agendamentoCompleto.paciente_nome}*!
Recebemos seu pedido.

👨‍⚕️ *Especialista:* Dr(a). ${agendamentoCompleto.medico_nome}
📅 *Data:* ${new Date(agendamentoCompleto.data_consulta).toLocaleDateString('pt-BR')}
⏰ *Horário:* ${agendamentoCompleto.horario.slice(0, 5)}
📂 *Status:* 🟡 PENDENTE

-------------------------------
ℹ️ *Aguarde a confirmação.*
Você receberá uma nova mensagem assim que o horário for aprovado pela recepção.

💳 *DICA:*
Conheça o *Cartão Essencial Saúde* e ganhe descontos exclusivos:
${process.env.FRONTEND_URL || 'http://192.168.20.19:3000'}/cartao
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

  static async verFila(req, res) {
    try {
      const { id } = req.params;
      const dados = await Agendamento.buscarPosicaoFila(id);
      if (!dados) return res.status(404).json({ erro: 'Agendamento não encontrado' });
      res.json(dados);
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
      const now = new Date();
      const hoje = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const lista = await Agendamento.listarParaTv(hoje);

      // Agrupar por médico para calcular previsão cumulativa
      const filasPorMedico = {};
      const listaProcessada = lista.map(item => {
        const medicoId = item.medico_id;
        const tempoMedio = item.tempo_medio || 20; // Default 20 min
        const atrasoMedico = item.atraso_minutos || 0;

        if (!filasPorMedico[medicoId]) {
          // O atraso inicial da fila é o atraso informado pelo médico
          filasPorMedico[medicoId] = atrasoMedico; 
        }

        let previsao = 'Em breve';
        
        if (item.status === 'EM_ATENDIMENTO') {
          previsao = 'Agora';
        } else {
          // Calcula hora estimada: Agora + Acumulado (inclui atraso)
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

      // Garante que usa o IP correto se não houver variável de ambiente
      const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.20.19:3000';
      const linkFila = `${frontendUrl}/agendamento/fila/${id}`;
      
      const msg = `
🎫 *COMPROVANTE DE AGENDAMENTO*
-------------------------------
Olá, *${agendamentoCompleto.paciente_nome}*!
Seu horário está garantido.

👨‍⚕️ *Especialista:* Dr(a). ${agendamentoCompleto.medico_nome}
📅 *Data:* ${new Date(agendamentoCompleto.data_consulta).toLocaleDateString('pt-BR')}
⏰ *Horário:* ${agendamentoCompleto.horario.slice(0,5)}

📍 *Local:* Clínica Essencial Saúde

🔗 *ACOMPANHE SUA VEZ:*
Toque no link abaixo para ver sua posição na fila em tempo real:
${linkFila}

_Por favor, chegue com 10 minutos de antecedência._
`;
      
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
      const now = new Date();
      const hoje = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const dataFiltro = data || hoje; 
      
      const agendamentos = await Agendamento.listarPorMedicoEData(medico_id, dataFiltro);
      res.json(agendamentos);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async alterarStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    try {
      console.log(`[STATUS] Alterando agendamento ${id} para: ${status}`);
      
      const agendamento = await Agendamento.atualizarStatus(id, status);
      const agendamentoCompleto = await Agendamento.buscarPorId(id);
      
      const io = req.app.get('io');
      
      // Evento geral de atualização
      io.emit('agendamento-atualizado', agendamento);
      
      // Se for chamar o paciente, emite evento específico para TV e manda ZAP
      if (status === 'EM_ATENDIMENTO') {
        console.log(`[STATUS] Chamar paciente: ${agendamentoCompleto.paciente_nome}`);
        io.emit('chamar-paciente', agendamentoCompleto);
        
        // 1. Avisa o paciente atual
        const linkFila = `${process.env.FRONTEND_URL || 'http://192.168.20.19:3000'}/agendamento/fila/${id}`;
        const msgAtual = `
🔔 *SUA VEZ CHEGOU!*
-------------------------------
Olá, *${agendamentoCompleto.paciente_nome}*!

👨‍⚕️ *Dr(a). ${agendamentoCompleto.medico_nome}* já está lhe aguardando no consultório.

📍 *Dirija-se à sala de atendimento.*
Boa consulta!
`;
        whatsappService.enviarMensagem(agendamentoCompleto.whatsapp, msgAtual).then(sent => {
           console.log(`[ZAP] Mensagem "Sua Vez" para ${agendamentoCompleto.paciente_nome}: ${sent ? 'OK' : 'FALHA'}`);
        });

        // 2. Avisa os PRÓXIMOS da fila (até 4 pessoas)
        const now = new Date();
        const hoje = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        const tempoMedio = await Agendamento.calcularTempoMedio(agendamentoCompleto.medico_id);
        
        // Busca os próximos 4 pacientes confirmados/presentes
        const proximos = await Agendamento.buscarProximosDaFila(agendamentoCompleto.medico_id, hoje, 4);
        console.log(`[STATUS] Notificando ${proximos.length} pacientes na fila.`);
        
        proximos.forEach((p, index) => {
          // Wrap individual message sending in a try-catch to prevent crashing the whole request
          try {
            const posicao = index + 1;
            const tempoEstimado = tempoMedio * posicao;
            let msgProximo = '';
            const linkFilaProx = `${process.env.FRONTEND_URL || 'http://192.168.20.19:3000'}/agendamento/fila/${p.id}`;

            if (posicao === 1) {
               msgProximo = `
⏳ *PREPARE-SE!*
-------------------------------
Olá, *${p.paciente_nome}*.
Você é o *PRÓXIMO* da fila!

👨‍⚕️ *Especialista:* Dr(a). ${agendamentoCompleto.medico_nome}
⏱️ *Tempo Estimado:* ~${tempoEstimado} min

🔗 *Acompanhe:*
${linkFilaProx}

_Por favor, fique atento(a) à chamada._
`;
            } else {
               msgProximo = `
🚶 *A FILA ANDOU*
-------------------------------
Olá, *${p.paciente_nome}*.
Um atendimento foi iniciado.

👥 *Sua Posição:* ${posicao}º lugar
⏱️ *Tempo Estimado:* ~${tempoEstimado} min

🔗 *Acompanhe:*
${linkFilaProx}
`;
            }

            // Delay pequeno para não bloquear
            setTimeout(() => {
               whatsappService.enviarMensagem(p.whatsapp, msgProximo)
                .then(sent => console.log(`[ZAP] Notificação fila para ${p.paciente_nome} (pos ${posicao}): ${sent ? 'OK' : 'FALHA'}`))
                .catch(err => console.error(`Erro ao enviar msg para fila (${p.paciente_nome}):`, err));
            }, index * 2000);
          } catch (innerError) {
             console.error(`Erro na lógica de notificação fila para ${p.paciente_nome}:`, innerError);
          }
        });
      }

      res.json(agendamento);
    } catch (error) {
      console.error(`[ERRO STATUS] ${id}:`, error);
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
      const legenda = `
📄 *DOCUMENTO DIGITAL*
-------------------------------
Olá, *${agendamentoCompleto.paciente_nome}*.
Aqui está o documento da sua consulta.

👨‍⚕️ *Profissional:* Dr(a). ${agendamentoCompleto.medico_nome}
📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}

_Guarde este arquivo com segurança._
`;
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

  static async listarHistorico(req, res) {
    try {
      const { paciente_id } = req.params;
      const historico = await Agendamento.listarHistorico(paciente_id);
      res.json(historico);
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }
}

module.exports = AgendamentoController;
