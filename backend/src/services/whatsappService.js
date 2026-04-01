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

async function _getTemplate(tipo) {
  try {
    const { rows } = await pool.query('SELECT corpo FROM wa_templates WHERE tipo=$1', [tipo]);
    return rows[0]?.corpo || null;
  } catch { return null; }
}

function _render(template, vars) {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v ?? ''), template);
}

async function enviarCheckin(paciente, previsoes) {
  // previsoes: [{ sala_nome, posicao, previsao }] do previsaoService
  const listaSalas = previsoes.map((p, i) => {
    const horario = p.posicao === 0
      ? '_(próximo a ser chamado)_'
      : `_previsão: ~${p.previsao}_`;
    return `${i + 1}. *${p.sala_nome}* — ${horario}`;
  }).join('\n');

  const mensagem = `Olá, *${paciente.nome}*! 👋

Seu check-in no *ASO Saúde* foi confirmado.

Você será atendido nas seguintes salas:
${listaSalas}

Você *receberá uma mensagem* quando sua vez estiver chegando — fique à vontade para aguardar onde preferir, não precisa ficar na recepção.

_ASO Saúde — Medicina Ocupacional_`;

  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'CHECKIN', mensagem);
}

async function enviarChamada(paciente, sala_nome, previsoes) {
  const proximas = (previsoes || []).filter(p => p.posicao > 0);
  const previsoesTxt = proximas.length > 0
    ? '\n\nPrevisão para próximas salas:\n' + proximas.map(p => `• ${p.sala_nome}: ~${p.previsao}`).join('\n')
    : '';
  const tpl = await _getTemplate('CHAMADA') ||
    '🔔 *{nome}*, é a sua vez!\n\nDirija-se à sala: *{sala_nome}*{previsoes}\n\n_Apresente-se imediatamente._';
  const mensagem = _render(tpl, { nome: paciente.nome, sala_nome, previsoes: previsoesTxt });
  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'CHAMADA', mensagem);
}

async function enviarContagem(paciente, sala_nome, posicao, tempo_medio) {
  const URGENCIA = {
    0: { emoji: '🚨', tom: 'Apresente-se *imediatamente*!' },
    1: { emoji: '🔴', tom: 'Retorne *imediatamente* — você é o próximo!' },
    2: { emoji: '⚠️', tom: '*Volte agora* — só 2 pessoas na frente.' },
    3: { emoji: '⏰', tom: 'Prepare-se para voltar.' },
    4: { emoji: '⏳', tom: 'Pode continuar fora por enquanto.' },
    5: { emoji: '📢', tom: 'Vá se organizando para retornar.' },
  };

  let mensagem;
  if (posicao === 0) {
    const tpl = await _getTemplate('CONTAGEM_PROXIMO') ||
      '🚨 *{nome}*, *VOCÊ É O PRÓXIMO!*\n\nSala: *{sala_nome}*\n\nApresente-se imediatamente ao atendente.';
    mensagem = _render(tpl, { nome: paciente.nome, sala_nome });
  } else {
    const u = URGENCIA[posicao] || URGENCIA[5];
    const tempo_estimado = posicao * (tempo_medio || 15);
    const tpl = await _getTemplate('CONTAGEM_FILA') ||
      '{emoji} *{nome}*, você tem *{posicao} pessoa(s)* na frente.\n\nSala: *{sala_nome}*\nPrevisão: ~{tempo_estimado} min\n\n{tom}';
    mensagem = _render(tpl, {
      nome: paciente.nome,
      sala_nome,
      posicao,
      tempo_estimado,
      emoji: u.emoji,
      tom: u.tom,
    });
  }
  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'CONTAGEM', mensagem);
}

async function enviarAtraso(paciente, sala_nome, nova_previsao) {
  const tpl = await _getTemplate('ATRASO') ||
    '⚠️ *{nome}*, houve um atraso no atendimento.\n\nSala: *{sala_nome}*\nNova previsão: ~{nova_previsao}\n\nPedimos desculpas pelo transtorno.';
  const mensagem = _render(tpl, { nome: paciente.nome, sala_nome, nova_previsao });
  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'ATRASO', mensagem);
}

async function enviarConclusao(paciente) {
  const tpl = await _getTemplate('CONCLUSAO') ||
    '✅ *{nome}*, seu *ASO* foi concluído!\n\nDirija-se à *recepção* para orientações sobre o laudo.\n\nObrigado por utilizar o *ASO Saúde*! 😊';
  const mensagem = _render(tpl, { nome: paciente.nome });
  await _enviar(paciente.whatsapp, mensagem);
  await _logMensagem(paciente.id, 'CONCLUSAO', mensagem);
}

async function enviarFollowup(paciente) {
  const tpl = await _getTemplate('FOLLOWUP') ||
    'Olá, *{nome}*! 👋\n\nHá 15 dias você realizou seu *ASO* conosco.\n\nComo você avalia nosso atendimento?\n⭐ 1 - Ruim  ⭐⭐ 2 - Regular  ⭐⭐⭐ 3 - Bom  ⭐⭐⭐⭐ 4 - Muito Bom  ⭐⭐⭐⭐⭐ 5 - Excelente\n\nResponda com o número.\n\n_ASO Saúde_';
  const mensagem = _render(tpl, { nome: paciente.nome });
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
