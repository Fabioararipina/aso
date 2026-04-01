'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}
function authHeaders() {
  return { headers: { Authorization: `Bearer ${getToken()}` } };
}

const STATUS_INFO = {
  conectado:          { color: '#22c55e', bg: '#f0fdf4', border: '#86efac', label: 'Conectado', icon: '✅' },
  conectando:         { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', label: 'Conectando...', icon: '⏳' },
  reconectando:       { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', label: 'Reconectando...', icon: '🔄' },
  aguardando_leitura: { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', label: 'Aguardando leitura do QR', icon: '📱' },
  iniciando:          { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', label: 'Iniciando...', icon: '🚀' },
  deslogado:          { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', label: 'Deslogado', icon: '🔴' },
  desconectado:       { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', label: 'Desconectado', icon: '⚫' },
};

const TIPO_BADGE = {
  CHECKIN:  { label: 'Check-in',  bg: '#dcfce7', color: '#16a34a' },
  CHAMADA:  { label: 'Chamada',   bg: '#dbeafe', color: '#1d4ed8' },
  CONTAGEM: { label: 'Contagem',  bg: '#fef9c3', color: '#a16207' },
  ATRASO:   { label: 'Atraso',    bg: '#fee2e2', color: '#dc2626' },
  CONCLUSAO:{ label: 'Conclusão', bg: '#d1fae5', color: '#065f46' },
  FOLLOWUP: { label: 'Follow-up', bg: '#ede9fe', color: '#7c3aed' },
};

export default function AdminWhatsappPage() {
  const [status, setStatus] = useState('desconectado');
  const [qrCode, setQrCode] = useState(null);
  const [pausado, setPausado] = useState(false);
  const [loading, setLoading] = useState('');
  const [mensagens, setMensagens] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [expandida, setExpandida] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [editando, setEditando] = useState(null); // tipo sendo editado
  const [editCorpo, setEditCorpo] = useState('');
  const [editTitulo, setEditTitulo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [testeNumero, setTesteNumero] = useState('');
  const [testeMensagem, setTesteMensagem] = useState('Olá! Esta é uma mensagem de teste do ASO Saúde. 👋');
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [testeResultado, setTesteResultado] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Busca status inicial
    axios.get(`${API_URL}/api/whatsapp/status`, authHeaders())
      .then(r => {
        setStatus(r.data.ready ? 'conectado' : 'desconectado');
        setPausado(r.data.mensagensPausadas || false);
      })
      .catch(() => {});

    fetchLog();
    axios.get(`${API_URL}/api/whatsapp/templates`, authHeaders())
      .then(r => setTemplates(r.data)).catch(() => {});

    // Conecta socket como admin
    const token = getToken();
    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('whatsapp-status', ({ status: s }) => {
      setStatus(s);
      if (s === 'conectado') setQrCode(null);
    });
    socket.on('whatsapp-qr', (qr) => {
      setQrCode(qr || null);
    });

    return () => socket.disconnect();
  }, []);

  function startEdit(tpl) {
    setEditando(tpl.tipo);
    setEditTitulo(tpl.titulo);
    setEditCorpo(tpl.corpo);
  }

  async function saveTemplate() {
    setSalvando(true);
    try {
      const res = await axios.put(`${API_URL}/api/whatsapp/templates/${editando}`,
        { titulo: editTitulo, corpo: editCorpo }, authHeaders());
      setTemplates(prev => prev.map(t => t.tipo === editando ? res.data : t));
      setEditando(null);
    } catch (err) {
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSalvando(false);
    }
  }

  function fetchLog(tipo = filtroTipo) {
    const params = tipo ? `?tipo=${tipo}&limit=100` : '?limit=100';
    axios.get(`${API_URL}/api/whatsapp/log${params}`, authHeaders())
      .then(r => setMensagens(r.data))
      .catch(() => {});
  }

  async function handleReconectar() {
    setLoading('reconectar');
    try {
      await axios.post(`${API_URL}/api/whatsapp/reconnect`, {}, authHeaders());
    } catch (err) {
      alert('Erro ao reconectar: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading('');
    }
  }

  async function handlePausar() {
    try {
      await axios.post(`${API_URL}/api/whatsapp/pausar`, {}, authHeaders());
      setPausado(true);
    } catch {}
  }

  async function handleRetomar() {
    try {
      await axios.post(`${API_URL}/api/whatsapp/retomar`, {}, authHeaders());
      setPausado(false);
    } catch {}
  }

  async function handleEnviarTeste() {
    const numero = testeNumero.replace(/\D/g, '');
    if (numero.length < 10) { setTesteResultado({ ok: false, msg: 'Número inválido. Use DDD + número (ex: 87999999999)' }); return; }
    if (!testeMensagem.trim()) { setTesteResultado({ ok: false, msg: 'Digite uma mensagem.' }); return; }
    setEnviandoTeste(true);
    setTesteResultado(null);
    try {
      const res = await axios.post(`${API_URL}/api/whatsapp/enviar`, { numero, mensagem: testeMensagem }, authHeaders());
      if (res.data.success) {
        setTesteResultado({ ok: true, msg: `Mensagem enviada para ${numero}!` });
      } else {
        setTesteResultado({ ok: false, msg: 'WhatsApp retornou falha. Verifique a conexão.' });
      }
    } catch (err) {
      setTesteResultado({ ok: false, msg: err.response?.data?.message || err.message });
    } finally {
      setEnviandoTeste(false);
    }
  }

  const si = STATUS_INFO[status] || STATUS_INFO.desconectado;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1a2e22' }}>📱 WhatsApp</h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
          Gerencie a conexão e o envio de mensagens automáticas.
        </p>
      </div>

      {/* Status card */}
      <div style={{
        background: si.bg, border: `1px solid ${si.border}`,
        borderRadius: 14, padding: '20px 24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>{si.icon}</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status da conexão</p>
            <p style={{ fontSize: 18, fontWeight: 900, color: si.color, marginTop: 2 }}>{si.label}</p>
          </div>
        </div>
        <button
          onClick={handleReconectar}
          disabled={!!loading}
          style={{
            background: '#3d7a52', color: '#fff', border: 'none',
            borderRadius: 10, padding: '10px 20px', fontWeight: 700,
            fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading === 'reconectar' ? '🔄 Reconectando...' : '🔄 Reconectar'}
        </button>
      </div>

      {/* QR Code */}
      {qrCode && (
        <div style={{
          background: '#fff', border: '1px solid #bfdbfe', borderRadius: 14,
          padding: '28px', marginBottom: 20, textAlign: 'center',
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>
            📱 Escaneie o QR Code com o WhatsApp
          </p>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
            Abra o WhatsApp → Configurações → Dispositivos conectados → Conectar dispositivo
          </p>
          <img
            src={qrCode}
            alt="QR Code WhatsApp"
            style={{ width: 260, height: 260, border: '4px solid #e0f2fe', borderRadius: 12 }}
          />
        </div>
      )}

      {/* Controle de mensagens */}
      <div style={{
        background: '#fff', border: '1px solid #d1fae5', borderRadius: 14,
        padding: '20px 24px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1a2e22', marginBottom: 4 }}>Envio de mensagens</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Pausar impede o envio de novas mensagens sem desconectar o WhatsApp.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: pausado ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${pausado ? '#fca5a5' : '#86efac'}`,
            borderRadius: 999, padding: '4px 14px', fontSize: 13, fontWeight: 700,
            color: pausado ? '#dc2626' : '#16a34a',
          }}>
            <span>{pausado ? '⏸' : '▶'}</span>
            {pausado ? 'Pausado' : 'Ativo'}
          </div>
          {pausado ? (
            <button
              onClick={handleRetomar}
              style={{ background: '#3d7a52', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              ▶ Retomar envio
            </button>
          ) : (
            <button
              onClick={handlePausar}
              style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              ⏸ Pausar envio
            </button>
          )}
        </div>
      </div>

      {/* Envio de teste */}
      <div style={{ background: '#fff', border: '1px solid #ddd6fe', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1a2e22', marginBottom: 4 }}>Enviar mensagem de teste</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Envie uma mensagem avulsa para verificar se a conexão está funcionando.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="tel"
            value={testeNumero}
            onChange={e => setTesteNumero(e.target.value)}
            placeholder="Número com DDD (ex: 87999999999)"
            style={{ fontSize: 14, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd6fe', background: '#faf5ff', color: '#1a2e22', outline: 'none' }}
          />
          <textarea
            value={testeMensagem}
            onChange={e => setTesteMensagem(e.target.value)}
            rows={3}
            style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd6fe', background: '#faf5ff', color: '#1a2e22', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleEnviarTeste}
              disabled={enviandoTeste}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: 14, cursor: enviandoTeste ? 'not-allowed' : 'pointer', opacity: enviandoTeste ? 0.6 : 1 }}
            >
              {enviandoTeste ? '⏳ Enviando...' : '📤 Enviar teste'}
            </button>
            {testeResultado && (
              <span style={{ fontSize: 13, fontWeight: 600, color: testeResultado.ok ? '#16a34a' : '#dc2626' }}>
                {testeResultado.ok ? '✅' : '❌'} {testeResultado.msg}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Templates de mensagens */}
      <div style={{ background: '#fff', border: '1px solid #d1fae5', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0fdf4' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1a2e22' }}>Mensagens automáticas</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Clique em Editar para personalizar o texto. Use as variáveis indicadas.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {templates.map((tpl, idx) => {
            const badge = TIPO_BADGE[tpl.tipo] || { label: tpl.tipo, bg: '#f3f4f6', color: '#374151' };
            const isEdit = editando === tpl.tipo;
            return (
              <div key={tpl.tipo} style={{ borderBottom: idx < templates.length - 1 ? '1px solid #f0fdf4' : 'none', padding: '16px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isEdit ? 12 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2e22' }}>{tpl.titulo}</span>
                  </div>
                  {!isEdit ? (
                    <button onClick={() => startEdit(tpl)} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: '1px solid #d1fae5', background: '#f0fdf4', color: '#3d7a52', fontWeight: 700, cursor: 'pointer' }}>
                      ✏️ Editar
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveTemplate} disabled={salvando} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: 'none', background: '#3d7a52', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>
                        {salvando ? 'Salvando...' : '✓ Salvar'}
                      </button>
                      <button onClick={() => setEditando(null)} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {!isEdit ? (
                  <pre style={{ marginTop: 8, fontSize: 12, color: '#64748b', whiteSpace: 'pre-wrap', fontFamily: 'inherit', background: '#f8fffe', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${badge.color}` }}>
                    {tpl.corpo}
                  </pre>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      value={editTitulo}
                      onChange={e => setEditTitulo(e.target.value)}
                      placeholder="Título"
                      style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1fae5', background: '#f8fffe', color: '#1a2e22' }}
                    />
                    <textarea
                      value={editCorpo}
                      onChange={e => setEditCorpo(e.target.value)}
                      rows={8}
                      style={{ fontSize: 13, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1fae5', background: '#f8fffe', color: '#1a2e22', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.6 }}
                    />
                    <p style={{ fontSize: 11, color: '#94a3b8' }}>Variáveis disponíveis: <code style={{ background: '#f0fdf4', padding: '1px 5px', borderRadius: 4 }}>{tpl.variaveis}</code></p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Log de mensagens */}
      <div style={{ background: '#fff', border: '1px solid #d1fae5', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1a2e22' }}>
            Histórico de mensagens
            <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>{mensagens.length} registro(s)</span>
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={filtroTipo}
              onChange={e => { setFiltroTipo(e.target.value); fetchLog(e.target.value); }}
              style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #d1fae5', background: '#f0fdf4', color: '#1a2e22', cursor: 'pointer' }}
            >
              <option value="">Todos os tipos</option>
              {Object.entries(TIPO_BADGE).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button
              onClick={() => fetchLog()}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #d1fae5', background: '#f0fdf4', color: '#3d7a52', fontWeight: 700, cursor: 'pointer' }}
            >
              ↻ Atualizar
            </button>
          </div>
        </div>

        {mensagens.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            Nenhuma mensagem enviada ainda.
          </div>
        ) : (
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {mensagens.map(m => {
              const badge = TIPO_BADGE[m.tipo] || { label: m.tipo, bg: '#f3f4f6', color: '#374151' };
              const isOpen = expandida === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setExpandida(isOpen ? null : m.id)}
                  style={{
                    padding: '12px 24px',
                    borderBottom: '1px solid #f9fafb',
                    cursor: 'pointer',
                    background: isOpen ? '#f8fffe' : '#fff',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                      background: badge.bg, color: badge.color,
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2e22', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.paciente_nome || '—'}
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', flexShrink: 0 }}>
                      {new Date(m.enviado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && (
                    <div style={{
                      marginTop: 10, background: '#f0fdf4', borderRadius: 8,
                      padding: '12px 14px', fontSize: 13, color: '#374151',
                      whiteSpace: 'pre-wrap', lineHeight: 1.6,
                      borderLeft: `3px solid ${badge.color}`,
                    }}>
                      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                        📱 {m.whatsapp}
                      </p>
                      {m.mensagem}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
