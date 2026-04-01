'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_COLORS = {
  PENDENTE:       { bg: '#fbbf24', border: '#d97706', label: 'Aguardando' },
  EM_ATENDIMENTO: { bg: '#3b82f6', border: '#1d4ed8', label: 'Em Atend.' },
  CONCLUIDO_SALA: { bg: '#22c55e', border: '#15803d', label: 'Concluído' },
};

function SalaSquare({ status, nome }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.PENDENTE;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span title={`${nome}: ${style.label}`} style={{
        display: 'inline-block', width: 26, height: 26, borderRadius: 5,
        border: `2px solid ${style.border}`, background: style.bg, flexShrink: 0,
      }} />
      <span style={{ fontSize: 8, color: '#9ca3af', maxWidth: 34, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {nome}
      </span>
    </div>
  );
}

export default function OperadorPage() {
  const params = useParams();
  const sala = params.sala;

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  const [showOperacao, setShowOperacao] = useState(false);
  const [todosAtendimentos, setTodosAtendimentos] = useState([]);
  const [loadingOperacao, setLoadingOperacao] = useState(false);

  // Modal de exames
  const [examesModal, setExamesModal] = useState({ open: false, filaId: null, nome: '' });
  const [examesItems, setExamesItems] = useState([]);
  const [examesLoading, setExamesLoading] = useState(false);

  const authHeader = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchFila = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/fila/${sala}`, { headers: authHeader() });
      setInfo(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar fila');
    } finally {
      setLoading(false);
    }
  }, [sala]);

  const fetchOperacao = useCallback(async () => {
    setLoadingOperacao(true);
    try {
      const res = await axios.get(`${API_URL}/api/atendimentos/hoje`, { headers: authHeader() });
      setTodosAtendimentos(res.data || []);
    } catch {}
    finally { setLoadingOperacao(false); }
  }, []);

  useEffect(() => {
    fetchFila();
    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('fila:atualizada', () => { fetchFila(); if (showOperacao) fetchOperacao(); });
    socket.on('tv:atualizar',    () => { fetchFila(); if (showOperacao) fetchOperacao(); });
    return () => socket.disconnect();
  }, [fetchFila, fetchOperacao, showOperacao]);

  useEffect(() => {
    if (showOperacao) fetchOperacao();
  }, [showOperacao, fetchOperacao]);

  async function openExamesModal(filaId, pacienteNome, status) {
    setExamesModal({ open: true, filaId, nome: pacienteNome, status });
    setExamesItems([]);
    setExamesLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/fila-salas/${filaId}/exames`, { headers: authHeader() });
      setExamesItems(res.data || []);
    } catch {}
    finally { setExamesLoading(false); }
  }

  async function toggleExameConcluido(exameId, concluido) {
    try {
      await axios.patch(`${API_URL}/api/exames-selecionados/${exameId}/concluir`, { concluido }, { headers: authHeader() });
      setExamesItems(prev => prev.map(e => e.id === exameId ? { ...e, concluido } : e));
    } catch { alert('Erro ao atualizar exame'); }
  }

  async function handleChamar(fila_id) {
    setActionLoading(`chamar-${fila_id}`);
    try {
      await axios.post(`${API_URL}/api/fila/${sala}/chamar`, { fila_id }, { headers: authHeader() });
      await fetchFila();
      if (showOperacao) fetchOperacao();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao chamar paciente');
    } finally { setActionLoading(null); }
  }

  async function handleConcluir(id) {
    setActionLoading(`concluir-${id}`);
    try {
      await axios.post(`${API_URL}/api/fila/${id}/concluir`, {}, { headers: authHeader() });
      await fetchFila();
      if (showOperacao) fetchOperacao();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao concluir');
    } finally { setActionLoading(null); }
  }

  async function handleChamarDoPainel(salaSlug, filaId) {
    setActionLoading(`op-${filaId}`);
    try {
      await axios.post(`${API_URL}/api/fila/${salaSlug}/chamar`, { fila_id: filaId }, { headers: authHeader() });
      await Promise.all([fetchFila(), fetchOperacao()]);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao chamar paciente');
    } finally { setActionLoading(null); }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-white text-lg">Carregando fila...</div></div>;
  }
  if (error && !info) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-red-400 text-lg">{error}</div></div>;
  }

  const salaInfo = info?.sala;
  const fila = info?.fila || [];
  const emAtendimento = fila.filter(f => f.status === 'EM_ATENDIMENTO');
  const pendentes     = fila.filter(f => f.status === 'PENDENTE');

  const ocupacaoPorSala = {};
  todosAtendimentos.forEach(at => {
    (at.salas || []).filter(s => s.sala_nome).forEach(s => {
      if (!ocupacaoPorSala[s.sala_nome]) ocupacaoPorSala[s.sala_nome] = { pendente: 0, em_atendimento: 0 };
      if (s.status === 'PENDENTE')       ocupacaoPorSala[s.sala_nome].pendente++;
      if (s.status === 'EM_ATENDIMENTO') ocupacaoPorSala[s.sala_nome].em_atendimento++;
    });
  });

  const ativos = todosAtendimentos.filter(a => a.status !== 'CANCELADO' && a.status !== 'CONCLUIDO');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">{salaInfo?.nome || sala}</h1>
          <p className="text-gray-400 text-xs">Operador — {fila.length} paciente(s) na fila</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="bg-green-500 w-2 h-2 rounded-full inline-block"></span>
            <span className="text-xs text-gray-300">Ao vivo</span>
          </div>
          <button onClick={() => setShowOperacao(true)}
            style={{ background: '#1e3a5f', border: '1px solid #2563eb', color: '#93c5fd', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            📊 Ver operação de hoje
          </button>
        </div>
      </header>

      <main className="p-3 max-w-3xl mx-auto">
        {emAtendimento.length > 0 && (
          <div className="mb-3">
            <h2 className="text-xs font-bold uppercase text-[#3d7a52] tracking-wider mb-2">Em Atendimento</h2>
            <div className="space-y-1.5">
              {emAtendimento.map(item => (
                <PatientCard key={item.id} item={item}
                  onConcluir={() => handleConcluir(item.id)}
                  onExames={() => openExamesModal(item.id, item.paciente_nome, 'EM_ATENDIMENTO')}
                  actionLoading={actionLoading} />
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xs font-bold uppercase text-yellow-400 tracking-wider mb-2">
            Fila de Espera ({pendentes.length})
          </h2>
          {pendentes.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-4 text-center text-gray-400 text-sm">Nenhum paciente aguardando.</div>
          ) : (
            <div className="space-y-1.5">
              {pendentes.map((item, index) => (
                <PatientCard key={item.id} item={item} position={index + 1}
                  onChamar={() => handleChamar(item.id)}
                  onExames={() => openExamesModal(item.id, item.paciente_nome, 'PENDENTE')}
                  actionLoading={actionLoading} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Modal de Exames ── */}
      {examesModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setExamesModal({ open: false, filaId: null, nome: '' })}>
          <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontWeight: 900, fontSize: 15, color: '#f9fafb' }}>📋 Exames</p>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{examesModal.nome}</p>
              </div>
              <button onClick={() => setExamesModal({ open: false, filaId: null, nome: '' })}
                style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>
                ✕
              </button>
            </div>

            {examesModal.status === 'PENDENTE' && (
              <div style={{ background: '#1c1f2e', border: '1px solid #374151', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔒</span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Chame o paciente primeiro para marcar os exames como executados.</span>
              </div>
            )}

            {examesLoading ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px 0' }}>Carregando...</p>
            ) : examesItems.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
                Nenhum exame selecionado para este paciente nesta sala.
              </p>
            ) : (() => {
              // Agrupa por tipo de exame
              const grupos = examesItems.reduce((acc, e) => {
                const key = e.tipo_exame_id;
                if (!acc[key]) acc[key] = { tipo_nome: e.tipo_nome, items: [] };
                acc[key].items.push(e);
                return acc;
              }, {});
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Object.values(grupos).map((grupo, gi) => (
                    <div key={gi}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, paddingLeft: 2 }}>
                        {grupo.tipo_nome}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {grupo.items.map(e => {
                          const bloqueado = examesModal.status === 'PENDENTE';
                          return (
                            <label key={e.id} style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              background: bloqueado ? '#0f172a' : e.concluido ? '#0d2b1a' : '#111827',
                              border: `1px solid ${bloqueado ? '#1e293b' : e.concluido ? '#16a34a' : '#374151'}`,
                              borderRadius: 10, padding: '10px 14px',
                              cursor: bloqueado ? 'not-allowed' : 'pointer',
                              opacity: bloqueado ? 0.6 : 1,
                            }}>
                              <input type="checkbox" checked={e.concluido}
                                onChange={() => !bloqueado && toggleExameConcluido(e.id, !e.concluido)}
                                disabled={bloqueado}
                                style={{ width: 18, height: 18, accentColor: '#22c55e', cursor: bloqueado ? 'not-allowed' : 'pointer', flexShrink: 0 }} />
                              <span style={{
                                fontSize: 14, fontWeight: 600,
                                color: bloqueado ? '#4b5563' : e.concluido ? '#4ade80' : '#e5e7eb',
                                textDecoration: e.concluido ? 'line-through' : 'none',
                              }}>{e.subtipo_nome}</span>
                              {e.concluido && !bloqueado && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#22c55e', fontWeight: 700 }}>✓ Feito</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Painel Operação de Hoje ── */}
      {showOperacao && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) setShowOperacao(false); }}>
          <div style={{ background: '#111827', minHeight: '100%', maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
            <div style={{ background: '#1f2937', borderBottom: '1px solid #374151', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>
                <p style={{ fontWeight: 900, fontSize: 16, color: '#f9fafb' }}>Operação de Hoje</p>
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                  {ativos.length} paciente(s) ativos · sala atual: <strong style={{ color: '#93c5fd' }}>{salaInfo?.nome || sala}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={fetchOperacao} disabled={loadingOperacao}
                  style={{ background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                  {loadingOperacao ? '...' : '↻ Atualizar'}
                </button>
                <button onClick={() => setShowOperacao(false)}
                  style={{ background: '#374151', color: '#f9fafb', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 900 }}>
                  ✕
                </button>
              </div>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {Object.keys(ocupacaoPorSala).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Ocupação por Sala</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(ocupacaoPorSala).map(([nome, counts]) => {
                      const isCurrentSala = nome === (salaInfo?.nome || sala);
                      return (
                        <div key={nome} style={{ background: isCurrentSala ? '#1e3a5f' : '#1f2937', border: `1px solid ${isCurrentSala ? '#2563eb' : '#374151'}`, borderRadius: 10, padding: '8px 14px', minWidth: 90 }}>
                          <p style={{ fontSize: 11, fontWeight: 800, color: isCurrentSala ? '#93c5fd' : '#e5e7eb', marginBottom: 6 }}>{nome} {isCurrentSala && '◀'}</p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>{counts.pendente}</p>
                              <p style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>aguardando</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ fontSize: 18, fontWeight: 900, color: '#3b82f6', lineHeight: 1 }}>{counts.em_atendimento}</p>
                              <p style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>em atend.</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'center' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pacientes</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  {Object.entries(STATUS_COLORS).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: v.bg, border: `1px solid ${v.border}`, display: 'inline-block' }} />
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{v.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {loadingOperacao ? (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0' }}>Carregando...</div>
              ) : ativos.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0' }}>Nenhum paciente ativo hoje.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ativos.slice().sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em)).map(at => {
                    const salas = (at.salas || []).filter(s => s.sala_nome);
                    const minhaEntrada = salas.find(s => s.sala_slug === sala);
                    const possoChama = minhaEntrada?.status === 'PENDENTE';
                    const estouAtendendo = minhaEntrada?.status === 'EM_ATENDIMENTO';
                    const jaConcluido = minhaEntrada?.status === 'CONCLUIDO_SALA';
                    const destaque = possoChama;
                    const isCallingThis = actionLoading === `op-${minhaEntrada?.id}`;
                    const hora = at.criado_em ? new Date(at.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

                    return (
                      <div key={at.id} style={{
                        background: destaque ? '#0d2b0d' : estouAtendendo ? '#0d1f3c' : '#1f2937',
                        border: `1px solid ${destaque ? '#16a34a' : estouAtendendo ? '#2563eb' : '#374151'}`,
                        borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <div style={{ minWidth: 130 }}>
                          <p style={{ fontWeight: 900, fontSize: 14, color: '#f9fafb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {at.paciente_nome}
                          </p>
                          <p style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                            {hora}{at.empresa ? ` · ${at.empresa}` : ''}
                          </p>
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          {salas.map((s, i) => {
                            const isCurrentSalaSquare = s.sala_slug === sala;
                            return (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <span title={`${s.sala_nome}: ${STATUS_COLORS[s.status]?.label || s.status}`} style={{
                                  display: 'inline-block', width: 26, height: 26, borderRadius: 5,
                                  border: `2px solid ${isCurrentSalaSquare ? '#ffffff' : (STATUS_COLORS[s.status]?.border || '#d97706')}`,
                                  background: STATUS_COLORS[s.status]?.bg || '#fbbf24',
                                  outline: isCurrentSalaSquare ? '2px solid #2563eb' : 'none', outlineOffset: 1,
                                }} />
                                <span style={{ fontSize: 8, color: isCurrentSalaSquare ? '#93c5fd' : '#6b7280', maxWidth: 34, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isCurrentSalaSquare ? 700 : 400 }}>
                                  {s.sala_nome}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ flexShrink: 0, minWidth: 90, textAlign: 'right' }}>
                          {possoChama && (
                            <button onClick={() => handleChamarDoPainel(sala, minhaEntrada.id)} disabled={isCallingThis}
                              style={{ background: isCallingThis ? '#374151' : '#16a34a', color: '#fff', fontWeight: 700, fontSize: 12, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: isCallingThis ? 'not-allowed' : 'pointer' }}>
                              {isCallingThis ? '...' : '▶ Chamar'}
                            </button>
                          )}
                          {estouAtendendo && <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>Em atend.</span>}
                          {jaConcluido && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✓ Concluído</span>}
                          {!minhaEntrada && <span style={{ fontSize: 10, color: '#4b5563' }}>Não nesta sala</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PatientCard({ item, position, onChamar, onConcluir, onExames, actionLoading }) {
  const isCalling    = actionLoading === `chamar-${item.id}`;
  const isConcluding = actionLoading === `concluir-${item.id}`;
  const isPendente   = item.status === 'PENDENTE';
  const isEmAtend    = item.status === 'EM_ATENDIMENTO';
  const todasSalas   = item.todas_salas || [];
  const examesCount  = item.exames_count || 0;

  const emOutraSala      = todasSalas.some(s => s.status === 'EM_ATENDIMENTO');
  const bloqueadoPorAdm  = item.bloqueado_por_adm === true;

  return (
    <div style={{
      background: isEmAtend ? '#0d2b1a' : '#1f2937',
      border: `1px solid ${isEmAtend ? '#3d7a52' : '#374151'}`,
      borderRadius: 10, padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {position && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
          {position}
        </div>
      )}
      {isEmAtend && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3d7a52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
          ▶
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ fontWeight: 900, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 100 }}>
          {item.paciente_nome}
        </p>
        {/* Botão de exames */}
        {examesCount > 0 && (
          <button onClick={onExames}
            style={{ background: '#1e3a5f', border: '1px solid #2563eb', color: '#93c5fd', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            📋 Exames ({examesCount})
          </button>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {todasSalas.map((s, i) => (
            <SalaSquare key={i} status={s.status} nome={s.sala_nome} />
          ))}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        {isPendente && (
          bloqueadoPorAdm ? (
            <span title="Aguardando liberação da sala administrativa"
              style={{ fontSize: 11, color: '#a855f7', fontWeight: 700, background: '#2e1065', border: '1px solid #7e22ce', borderRadius: 8, padding: '6px 10px', whiteSpace: 'nowrap' }}>
              🔒 Aguard. Adm
            </span>
          ) : emOutraSala ? (
            <span title="Paciente já está em atendimento em outra sala"
              style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, background: '#1e3a5f', border: '1px solid #2563eb', borderRadius: 8, padding: '6px 10px', whiteSpace: 'nowrap' }}>
              Em outra sala
            </span>
          ) : (
            <button onClick={onChamar} disabled={isCalling}
              style={{ background: isCalling ? '#374151' : '#3d7a52', color: '#fff', fontWeight: 700, fontSize: 13, padding: '6px 16px', borderRadius: 8, border: 'none', cursor: isCalling ? 'not-allowed' : 'pointer', minWidth: 80 }}>
              {isCalling ? '...' : 'Chamar'}
            </button>
          )
        )}
        {isEmAtend && (
          <button onClick={onConcluir} disabled={isConcluding}
            style={{ background: isConcluding ? '#374151' : '#16a34a', color: '#fff', fontWeight: 700, fontSize: 13, padding: '6px 16px', borderRadius: 8, border: 'none', cursor: isConcluding ? 'not-allowed' : 'pointer', minWidth: 80 }}>
            {isConcluding ? '...' : 'Concluído'}
          </button>
        )}
      </div>
    </div>
  );
}
