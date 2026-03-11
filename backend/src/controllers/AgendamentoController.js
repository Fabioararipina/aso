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
      } else if (email && !paciente.email) {
        // Se o paciente já existe mas não tinha email, atualiza (opcional, mas bom pra garantir)
        // Por simplicidade, vamos assumir que o email que veio no request será usado para o pagamento
        paciente.email = email; 
      }

      // Busca o valor da consulta do médico selecionado
      const MedicoModel = require('../models/Medico');
      const medico = await MedicoModel.buscarPorId(medico_id);
      
      // Se o valor vier no body (ex: 0 para retorno), usa ele. 
      // Se não vier (null/undefined), usa o do médico ou 150 padrão.
      let valorFinal = 150.00;
      if (req.body.valor !== undefined && req.body.valor !== null) {
        valorFinal = req.body.valor;
      } else if (medico) {
        valorFinal = medico.valor_consulta;
      }
      
      const agendamento = await Agendamento.criar({
        paciente_id: paciente.id,
        medico_id,
        data_consulta,
        horario,
        observacoes,
        valor: valorFinal,
        tipo_consulta: req.body.tipo_consulta
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

⚠️ *Atenção:* O horário acima é uma *estimativa*. O atendimento pode começar um pouco antes ou depois, dependendo do movimento do dia e da duração de cada consulta. Não se preocupe — quando chegar a sua vez, você vai receber um aviso aqui mesmo pelo WhatsApp! 😊

-------------------------------
ℹ️ *Aguarde a confirmação.*
Você receberá uma nova mensagem assim que o horário for aprovado pela recepção.

💳 *DICA:*
Conheça o *Cartão Essencial Saúde* e ganhe descontos exclusivos:
https://cartao.cartaoessencialsaude.com.br/
`;
      whatsappService.enviarMensagem(agendamentoCompleto.whatsapp, msg);

      const io = req.app.get('io');
      io.emit('novo-agendamento', agendamentoCompleto); // Envia completo para a recepção já ver o nome
      
      res.json({ sucesso: true, agendamento });
    } catch (error) {
      res.status(500).json({ erro: error.message });
    }
  }

  static async encaixar(req, res) {
    try {
      const { nome, whatsapp, medico_id, observacoes } = req.body;

      // Busca ou cria paciente
      let paciente = await Paciente.buscarPorWhatsapp(whatsapp);
      if (!paciente) {
        paciente = await Paciente.criar({ nome, whatsapp, email: null });
      }

      // Horário atual no fuso do Brasil
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const horario = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':00';
      const data_consulta = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

      const MedicoModel = require('../models/Medico');
      const medico = await MedicoModel.buscarPorId(medico_id);

      // Cria o agendamento como ENCAIXE
      const agendamento = await Agendamento.criar({
        paciente_id: paciente.id,
        medico_id,
        data_consulta,
        horario,
        tipo_consulta: 'ENCAIXE',
        valor: medico ? medico.valor_consulta : 150.00,
        observacoes: observacoes || 'Encaixe / Atendimento Prioritário'
      });

      // Confirma e marca como PRESENTE automaticamente (já está na clínica)
      await Agendamento.atualizarStatus(agendamento.id, 'PRESENTE');
      const agendamentoCompleto = await Agendamento.buscarPorId(agendamento.id);

      // Calcula tempo médio e notifica todos que estão esperando
      const tempoMedio = await Agendamento.calcularTempoMedio(medico_id);
      const esperando = await Agendamento.buscarProximosDaFila(medico_id, data_consulta, 20);

      esperando.forEach((p, index) => {
        try {
          setTimeout(() => {
            const linkFila = `${process.env.FRONTEND_URL || 'https://portal.primeatende.com.br'}/agendamento/fila/${p.id}`;
            const msg = `
🚨 *AVISO DE ENCAIXE*
-------------------------------
Olá, *${p.paciente_nome}*!

Um atendimento prioritário foi encaixado na agenda de Dr(a). ${agendamentoCompleto.medico_nome}.

⏱️ *Atraso estimado:* ~${tempoMedio} minuto(s)

Pedimos desculpas pela espera.
Agradecemos sua compreensão! 🙏

🔗 *Acompanhe sua posição:*
${linkFila}
`;
            whatsappService.enviarMensagem(p.whatsapp, msg)
              .then(sent => console.log(`[ZAP] Aviso encaixe para ${p.paciente_nome}: ${sent ? 'OK' : 'FALHA'}`))
              .catch(err => console.error('Erro ao notificar encaixe:', err));
          }, index * 1500);
        } catch (err) {
          console.error('Erro na notificação de encaixe:', err);
        }
      });

      const io = req.app.get('io');
      io.emit('novo-agendamento', agendamentoCompleto);
      io.emit('encaixe-adicionado', { medico_id, agendamento: agendamentoCompleto, tempoMedio });

      res.json({ sucesso: true, agendamento: agendamentoCompleto });
    } catch (error) {
      console.error('Erro ao encaixar:', error);
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
      // Usar fuso horário do Brasil (UTC-3)
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const hoje = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const lista = await Agendamento.listarParaTv(hoje);

      // filasPorMedico guarda o horário de término estimado do último atendimento (Date)
      // Apenas PRESENTE entra na fila real. CONFIRMADO mostra o horário agendado.
      const filasPorMedico = {};
      const listaProcessada = lista.map(item => {
        const medicoId = item.medico_id;
        const tempoMedioMs = (item.tempo_medio || 20) * 60000;
        const atrasoMedico = item.atraso_minutos || 0;

        const [h, m] = item.horario.split(':');
        const horarioAgendado = new Date(now);
        horarioAgendado.setHours(parseInt(h), parseInt(m), 0, 0);

        let previsao = 'Em breve';

        if (item.status === 'EM_ATENDIMENTO') {
          previsao = 'Agora';
          // Estima término descontando tempo já consumido
          let fimEstimado;
          if (item.inicio_atendimento) {
            const elapsed = (now - new Date(item.inicio_atendimento)) / 60000;
            const restante = Math.max(5, (item.tempo_medio || 20) - elapsed);
            fimEstimado = new Date(now.getTime() + restante * 60000);
          } else {
            fimEstimado = new Date(now.getTime() + tempoMedioMs);
          }
          filasPorMedico[medicoId] = fimEstimado;

        } else if (item.status === 'PRESENTE') {
          // Está fisicamente na clínica — entra na fila real
          const fimAnterior = filasPorMedico[medicoId] || new Date(now.getTime() + atrasoMedico * 60000);
          const inicioEstimado = new Date(Math.max(fimAnterior.getTime(), now.getTime()));
          previsao = inicioEstimado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          filasPorMedico[medicoId] = new Date(inicioEstimado.getTime() + tempoMedioMs);

        } else {
          // CONFIRMADO — ainda não chegou, mostra o horário agendado + atraso do médico
          const inicioComAtraso = new Date(horarioAgendado.getTime() + atrasoMedico * 60000);
          previsao = inicioComAtraso.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
      const frontendUrl = process.env.FRONTEND_URL || 'https://portal.primeatende.com.br';
      const linkFila = `${frontendUrl}/agendamento/fila/${id}`;
      
      const msg = `
🎫 *COMPROVANTE DE AGENDAMENTO*
-------------------------------
Olá, *${agendamentoCompleto.paciente_nome}*!
Seu horário está garantido.

👨‍⚕️ *Especialista:* Dr(a). ${agendamentoCompleto.medico_nome}
📅 *Data:* ${new Date(agendamentoCompleto.data_consulta).toLocaleDateString('pt-BR')}
⏰ *Horário:* ${agendamentoCompleto.horario.slice(0,5)}

⚠️ *Atenção:* O horário acima é uma *estimativa*. O atendimento pode começar um pouco antes ou depois, dependendo do movimento do dia e da duração de cada consulta. Não se preocupe — quando chegar a sua vez, você vai receber um aviso aqui mesmo pelo WhatsApp! 😊

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
      // Se vier data na query usa ela, senão usa hoje (fuso horário Brasil)
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
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
      
      // Se marcou AUSENTE, avisa o paciente via WhatsApp
      if (status === 'AUSENTE') {
        const msgAusente = `
😕 *VOCÊ FOI CHAMADO(A)!*
-------------------------------
Olá, *${agendamentoCompleto.paciente_nome}*!

Tentamos te chamar, mas você não estava disponível no momento.

👨‍⚕️ *Profissional:* Dr(a). ${agendamentoCompleto.medico_nome}

Fique por perto! Você será chamado(a) novamente em breve.
_Não se afaste da clínica._
`;
        whatsappService.enviarMensagem(agendamentoCompleto.whatsapp, msgAusente).then(sent => {
          console.log(`[ZAP] Aviso de ausência para ${agendamentoCompleto.paciente_nome}: ${sent ? 'OK' : 'FALHA'}`);
        });
      }

      // Se for chamar o paciente, emite evento específico para TV e manda ZAP
      if (status === 'EM_ATENDIMENTO') {
        console.log(`[STATUS] Chamar paciente: ${agendamentoCompleto.paciente_nome}`);
        io.emit('chamar-paciente', agendamentoCompleto);
        
        // 1. Avisa o paciente atual
        const linkFila = `${process.env.FRONTEND_URL || 'https://portal.primeatende.com.br'}/agendamento/fila/${id}`;
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
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
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
            const linkFilaProx = `${process.env.FRONTEND_URL || 'https://portal.primeatende.com.br'}/agendamento/fila/${p.id}`;

            if (posicao === 1) {
               msgProximo = `
⏳ *PREPARE-SE!*
-------------------------------
Olá, *${p.paciente_nome}*.
Você é o *PRÓXIMO* da fila!

👨‍⚕️ *Especialista:* Dr(a). ${agendamentoCompleto.medico_nome}
⏱️ *Tempo Estimado:* ~${tempoEstimado} min

⚠️ *Atenção:* Este tempo é apenas uma estimativa. O atendimento pode ocorrer um pouco antes ou depois, conforme o andamento das consultas. Fique por perto e aguarde o aviso!

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

⚠️ *Atenção:* Este tempo é apenas uma estimativa. O atendimento pode ocorrer um pouco antes ou depois, conforme o andamento das consultas. Fique por perto e aguarde o aviso!

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

      // Envia link NPS quando consulta é concluída
      if (status === 'CONCLUIDO') {
        const linkNps = `${process.env.FRONTEND_URL || 'https://portal.primeatende.com.br'}/feedback/${id}`;
        const msgNps = `
⭐ *PESQUISA DE SATISFAÇÃO*
-------------------------------
Olá, *${agendamentoCompleto.paciente_nome}*!

Sua consulta com Dr(a). *${agendamentoCompleto.medico_nome}* foi concluída.

Sua opinião é muito importante para nós! 💙
Responda nossa pesquisa rápida:

👉 ${linkNps}

Obrigado pela confiança na *Essencial Saúde*!
`;
        setTimeout(() => {
          whatsappService.enviarMensagem(agendamentoCompleto.whatsapp, msgNps)
            .then(sent => console.log(`[ZAP] NPS para ${agendamentoCompleto.paciente_nome}: ${sent ? 'OK' : 'FALHA'}`))
            .catch(err => console.error('Erro ao enviar NPS:', err));
        }, 3000);
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

      // Envia link NPS após o prontuário (com delay para não sobrepor o PDF)
      const linkNps = `${process.env.FRONTEND_URL || 'https://portal.primeatende.com.br'}/feedback/${id}`;
      const msgNps = `
⭐ *PESQUISA DE SATISFAÇÃO*
-------------------------------
Olá, *${agendamentoCompleto.paciente_nome}*!

Sua consulta com Dr(a). *${agendamentoCompleto.medico_nome}* foi concluída.

Sua opinião é muito importante para nós! 💙
Responda nossa pesquisa rápida:

👉 ${linkNps}

Obrigado pela confiança na *Essencial Saúde*!
`;
      setTimeout(() => {
        whatsappService.enviarMensagem(agendamentoCompleto.whatsapp, msgNps)
          .then(sent => console.log(`[ZAP] NPS para ${agendamentoCompleto.paciente_nome}: ${sent ? 'OK' : 'FALHA'}`))
          .catch(err => console.error('Erro ao enviar NPS:', err));
      }, 3000);

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

  static async trocar(req, res) {
    const { id1, horario1, medico_id1, id2, horario2, medico_id2 } = req.body;
    try {
      await Agendamento.trocarHorarios(id1, horario1, medico_id1, id2, horario2, medico_id2);
      const io = req.app.get('io');
      io.emit('agendamento-atualizado', { id1, id2 });
      res.json({ sucesso: true });
    } catch (error) {
      console.error('[ERRO TROCAR]', error);
      res.status(500).json({ erro: error.message });
    }
  }

  static async mover(req, res) {
    const { id } = req.params;
    const { horario, medico_id } = req.body;
    try {
      const agendamento = await Agendamento.moverAgendamento(id, horario, medico_id || null);
      const io = req.app.get('io');
      io.emit('agendamento-atualizado', agendamento);
      res.json({ sucesso: true, agendamento });
    } catch (error) {
      console.error(`[ERRO MOVER] ${id}:`, error);
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
