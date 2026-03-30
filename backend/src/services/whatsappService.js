/**
 * ASO Saúde — WhatsApp Messaging Service
 * Wraps the Baileys WhatsApp connection from services/whatsapp/whatsappService.js
 * Provides 6 message types for the queue management flow.
 */

const pool = require('../config/database');

// Lazy-load the Baileys service to avoid circular deps
let _baileys = null;
function getBaileys() {
  if (!_baileys) {
    try {
      _baileys = require('./whatsapp/whatsappService');
    } catch (e) {
      console.warn('[WA-ASO] Baileys service não encontrado:', e.message);
    }
  }
  return _baileys;
}

const ENABLED = process.env.WHATSAPP_ENABLED !== 'false';

async function _enviar(whatsapp, mensagem) {
  if (!ENABLED) {
    console.log(`[WA-ASO] (desabilitado) Para ${whatsapp}: ${mensagem.slice(0, 80)}...`);
    return false;
  }
  const baileys = getBaileys();
  if (!baileys) {
    console.warn('[WA-ASO] Baileys não disponível');
    return false;
  }
  try {
    return await baileys.enviarMensagem(whatsapp, mensagem);
  } catch (err) {
    console.error('[WA-ASO] Erro ao enviar:', err.message);
    return false;
  }
}

async function _logMensagem(paciente_id, tipo, mensagem) {
  try {
    await pool.query(
      'INSERT INTO wa_mensagens_log (paciente_id, tipo, mensagem) VALUES ($1, $2, $3)',
      [paciente_id, tipo, mensagem]
    );
  } catch (err) {
    console.error('[WA-ASO] Erro ao logar mensagem:', err.message);
  }
}

/**
 * MSG1 — Check-in confirmado
 * Enviado quando o paciente é cadastrado na recepção e inserido nas filas.
 */
async function enviarCheckin(paciente, nomes_salas) {
  const listaSalas = nomes_salas.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const mensagem = `Olá, *${paciente.nome}*! 👋

Seu check-in no *ASO Saúde* foi confirmado com sucesso.

Você será atendido nas seguintes salas:
${listaSalas}

Por favor, aguarde ser chamado. Você receberá uma mensagem quando for sua vez em cada sala.

_Não saia das dependências da clínica._`;

  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'CHECKIN', mensagem);
}

/**
 * MSG2 — Paciente chamado para uma sala
 * Enviado quando o operador chama o paciente.
 * Inclui previsão para as próximas salas.
 */
async function enviarChamada(paciente, sala_nome, previsoes) {
  let linhasPrevisao = '';
  if (previsoes && previsoes.length > 0) {
    const proximas = previsoes.filter(p => p.posicao > 0);
    if (proximas.length > 0) {
      linhasPrevisao = '\n\nPrevisão para próximas salas:\n' +
        proximas.map(p => `• ${p.sala_nome}: ~${p.previsao}`).join('\n');
    }
  }

  const mensagem = `🔔 *${paciente.nome}*, é a sua vez!

Por favor, dirija-se agora à sala:
*${sala_nome}*${linhasPrevisao}

_Apresente-se imediatamente ao atendente._`;

  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'CHAMADA', mensagem);
}

/**
 * MSG3 — Contagem regressiva na fila
 * Enviado para pacientes que estão nas primeiras posições (0-5) após alguém ser chamado.
 * posicao=0 significa que é o próximo, posicao=1 é o segundo, etc.
 */
async function enviarContagem(paciente, sala_nome, posicao, tempo_medio) {
  let mensagem;
  if (posicao === 0) {
    mensagem = `⚡ *${paciente.nome}*, você é o *próximo* na fila!

Sala: *${sala_nome}*

Por favor, fique próximo à entrada da sala. Você será chamado em instantes.`;
  } else {
    const tempoEstimado = posicao * tempo_medio;
    mensagem = `⏳ *${paciente.nome}*, você está na posição *${posicao + 1}* da fila.

Sala: *${sala_nome}*
Previsão: ~${tempoEstimado} minutos

Aguarde na área de espera. Você será avisado quando chegar sua vez.`;
  }

  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'CONTAGEM', mensagem);
}

/**
 * MSG4 — Notificação de atraso
 * Enviado quando o tempo estimado aumenta significativamente.
 */
async function enviarAtraso(paciente, sala_nome, nova_previsao) {
  const mensagem = `⚠️ *${paciente.nome}*, informamos que houve um atraso no atendimento.

Sala: *${sala_nome}*
Nova previsão: ~${nova_previsao}

Pedimos desculpas pelo transtorno. Por favor, continue aguardando.`;

  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'ATRASO', mensagem);
}

/**
 * MSG5 — Atendimento concluído em todas as salas
 * Enviado quando o paciente conclui o atendimento em todas as salas do ASO.
 */
async function enviarConclusao(paciente) {
  const mensagem = `✅ *${paciente.nome}*, seu *ASO* foi concluído!

Todos os exames e consultas foram realizados com sucesso.

Dirija-se à *recepção* para receber os próximos passos e orientações sobre o laudo.

Obrigado por utilizar o *ASO Saúde*. Até a próxima! 😊`;

  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'CONCLUSAO', mensagem);
}

/**
 * MSG6 — Follow-up 15 dias após o atendimento
 * Enviado automaticamente 15 dias depois para avaliar satisfação.
 */
async function enviarFollowup(paciente) {
  const mensagem = `Olá, *${paciente.nome}*! 👋

Há 15 dias você realizou seu *ASO* conosco. Esperamos que tudo tenha corrido bem!

Gostaríamos de saber como foi sua experiência. Sua opinião é muito importante para continuarmos melhorando nosso atendimento.

Como você avalia nosso atendimento?
⭐ 1 - Ruim
⭐⭐ 2 - Regular
⭐⭐⭐ 3 - Bom
⭐⭐⭐⭐ 4 - Muito Bom
⭐⭐⭐⭐⭐ 5 - Excelente

Responda com o número correspondente.

_ASO Saúde — Medicina Ocupacional_`;

  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'FOLLOWUP', mensagem);
}

// Re-export baileys methods for compatibility
function setIo(io) {
  const baileys = getBaileys();
  if (baileys && baileys.setIo) baileys.setIo(io);
}

function inicializar() {
  const baileys = getBaileys();
  if (baileys && baileys.inicializar) baileys.inicializar();
}

function getStatus() {
  const baileys = getBaileys();
  if (baileys && baileys.getStatus) return baileys.getStatus();
  return { ready: false };
}

function pausarMensagens() {
  const baileys = getBaileys();
  if (baileys) baileys.pausarMensagens();
}

function retomarMensagens() {
  const baileys = getBaileys();
  if (baileys) baileys.retomarMensagens();
}

async function enviarMensagem(numero, texto) {
  return _enviar(numero, texto);
}

async function reconectar() {
  const baileys = getBaileys();
  if (baileys && baileys.reconectar) return baileys.reconectar();
}

module.exports = {
  // ASO-specific messages
  enviarCheckin,
  enviarChamada,
  enviarContagem,
  enviarAtraso,
  enviarConclusao,
  enviarFollowup,
  // Baileys passthrough
  setIo,
  inicializar,
  getStatus,
  pausarMensagens,
  retomarMensagens,
  enviarMensagem,
  reconectar,
};
