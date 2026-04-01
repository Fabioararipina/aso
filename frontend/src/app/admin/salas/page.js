'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { authHeaders } from '../../../lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const EMPTY_FORM = { nome: '', slug: '', tempo_medio_min: 15, ativo: true, administrativa: false, requer_adm: false, hora_inicio: '' };

export default function AdminSalasPage() {
  const [salas, setSalas]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [editId, setEditId]         = useState(null);
  const [saving, setSaving]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Painel Tipos (nível 2)
  const [tiposPanelId, setTiposPanelId]     = useState(null); // salaId
  const [tiposData, setTiposData]           = useState({});   // { [salaId]: [{id, nome, subtipos:[]}] }
  const [novoTipo, setNovoTipo]             = useState('');
  const [addingTipo, setAddingTipo]         = useState(false);
  const [editandoTipo, setEditandoTipo]     = useState(null); // {id, nome}

  // Painel Sub-tipos (nível 3)
  const [subPanelTipoId, setSubPanelTipoId]     = useState(null); // tipo.id
  const [novoSubtipo, setNovoSubtipo]           = useState('');
  const [addingSub, setAddingSub]               = useState(false);
  const [editandoSub, setEditandoSub]           = useState(null); // {id, nome}

  useEffect(() => { fetchSalas(); }, []);

  async function fetchSalas() {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/salas`, { headers: authHeaders() });
      setSalas(data);
      const initial = {};
      data.forEach(s => { initial[s.id] = s.tipos_exame || []; });
      setTiposData(initial);
    } catch { setError('Erro ao carregar salas'); }
    finally { setLoading(false); }
  }

  function openNova() { setForm(EMPTY_FORM); setEditId(null); setError(''); setModalOpen(true); }
  function openEditar(sala) {
    setForm({ nome: sala.nome, slug: sala.slug, tempo_medio_min: sala.tempo_medio_min, ativo: sala.ativo, administrativa: sala.administrativa || false, requer_adm: sala.requer_adm || false, hora_inicio: sala.hora_inicio ? sala.hora_inicio.slice(0,5) : '' });
    setEditId(sala.id); setError(''); setModalOpen(true);
  }
  function handleNomeChange(nome) {
    const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    setForm(f => ({ ...f, nome, ...(editId === null ? { slug } : {}) }));
  }

  async function handleSalvar() {
    if (!form.nome.trim() || !form.slug.trim()) { setError('Nome e slug são obrigatórios'); return; }
    setSaving(true); setError('');
    try {
      if (editId) {
        const { data } = await axios.put(`${API_URL}/api/salas/${editId}`, form, { headers: authHeaders() });
        setSalas(prev => prev.map(s => s.id === editId ? { ...data, tipos_exame: tiposData[editId] || [] } : s));
      } else {
        const { data } = await axios.post(`${API_URL}/api/salas`, form, { headers: authHeaders() });
        setSalas(prev => [...prev, { ...data, tipos_exame: [] }]);
        setTiposData(prev => ({ ...prev, [data.id]: [] }));
      }
      setModalOpen(false);
    } catch (err) { setError(err.response?.data?.error || 'Erro ao salvar'); }
    finally { setSaving(false); }
  }

  async function handleExcluir(id) {
    try {
      await axios.delete(`${API_URL}/api/salas/${id}`, { headers: authHeaders() });
      setSalas(prev => prev.filter(s => s.id !== id));
      setConfirmDelete(null);
      if (tiposPanelId === id) { setTiposPanelId(null); setSubPanelTipoId(null); }
    } catch (err) { alert(err.response?.data?.error || 'Erro ao excluir'); }
  }

  function toggleTiposPanel(salaId) {
    if (tiposPanelId === salaId) { setTiposPanelId(null); setSubPanelTipoId(null); }
    else { setTiposPanelId(salaId); setNovoTipo(''); setEditandoTipo(null); setSubPanelTipoId(null); }
  }

  // ── Tipos ──────────────────────────────────────────────

  async function handleAddTipo(salaId) {
    if (!novoTipo.trim()) return;
    setAddingTipo(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/salas/${salaId}/tipos-exame`, { nome: novoTipo.trim() }, { headers: authHeaders() });
      data.subtipos = [];
      setTiposData(prev => ({ ...prev, [salaId]: [...(prev[salaId] || []), data] }));
      setNovoTipo('');
    } catch (err) { alert(err.response?.data?.error || 'Erro ao adicionar'); }
    finally { setAddingTipo(false); }
  }

  async function handleDeleteTipo(salaId, tipoId) {
    if (!confirm('Excluir este tipo e todos os seus sub-tipos?')) return;
    try {
      await axios.delete(`${API_URL}/api/tipos-exame/${tipoId}`, { headers: authHeaders() });
      setTiposData(prev => ({ ...prev, [salaId]: prev[salaId].filter(t => t.id !== tipoId) }));
      if (subPanelTipoId === tipoId) setSubPanelTipoId(null);
    } catch (err) { alert(err.response?.data?.error || 'Erro ao excluir'); }
  }

  async function handleSaveEditTipo(salaId) {
    if (!editandoTipo?.nome?.trim()) return;
    try {
      const { data } = await axios.put(`${API_URL}/api/tipos-exame/${editandoTipo.id}`, { nome: editandoTipo.nome.trim() }, { headers: authHeaders() });
      setTiposData(prev => ({ ...prev, [salaId]: prev[salaId].map(t => t.id === data.id ? { ...t, nome: data.nome } : t) }));
      setEditandoTipo(null);
    } catch (err) { alert(err.response?.data?.error || 'Erro ao salvar'); }
  }

  // ── Sub-tipos ───────────────────────────────────────────

  function toggleSubPanel(tipoId) {
    if (subPanelTipoId === tipoId) { setSubPanelTipoId(null); }
    else { setSubPanelTipoId(tipoId); setNovoSubtipo(''); setEditandoSub(null); }
  }

  async function handleAddSub(salaId, tipoId) {
    if (!novoSubtipo.trim()) return;
    setAddingSub(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/tipos-exame/${tipoId}/subtipos`, { nome: novoSubtipo.trim() }, { headers: authHeaders() });
      setTiposData(prev => ({
        ...prev,
        [salaId]: prev[salaId].map(t => t.id === tipoId ? { ...t, subtipos: [...(t.subtipos || []), data] } : t)
      }));
      setNovoSubtipo('');
    } catch (err) { alert(err.response?.data?.error || 'Erro ao adicionar'); }
    finally { setAddingSub(false); }
  }

  async function handleDeleteSub(salaId, tipoId, subId) {
    if (!confirm('Excluir este sub-tipo?')) return;
    try {
      await axios.delete(`${API_URL}/api/subtipos-exame/${subId}`, { headers: authHeaders() });
      setTiposData(prev => ({
        ...prev,
        [salaId]: prev[salaId].map(t => t.id === tipoId ? { ...t, subtipos: (t.subtipos || []).filter(s => s.id !== subId) } : t)
      }));
    } catch (err) { alert(err.response?.data?.error || 'Erro ao excluir'); }
  }

  async function handleSaveEditSub(salaId, tipoId) {
    if (!editandoSub?.nome?.trim()) return;
    try {
      const { data } = await axios.put(`${API_URL}/api/subtipos-exame/${editandoSub.id}`, { nome: editandoSub.nome.trim() }, { headers: authHeaders() });
      setTiposData(prev => ({
        ...prev,
        [salaId]: prev[salaId].map(t => t.id === tipoId
          ? { ...t, subtipos: (t.subtipos || []).map(s => s.id === data.id ? data : s) }
          : t
        )
      }));
      setEditandoSub(null);
    } catch (err) { alert(err.response?.data?.error || 'Erro ao salvar'); }
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <>
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Salas de Atendimento</h1>
          <p className="text-sm text-gray-400 mt-1">Gerencie salas, tipos e sub-tipos de exame</p>
        </div>
        <button onClick={openNova} className="flex items-center gap-2 bg-[#3d7a52] hover:bg-[#2d5c3e] text-white font-bold px-5 py-2.5 rounded-xl transition">
          <span className="text-lg leading-none">+</span> Nova Sala
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Carregando...</div>
      ) : salas.length === 0 ? (
        <div className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-dashed border-gray-200">Nenhuma sala cadastrada.</div>
      ) : (
        <div className="space-y-3">
          {salas.map(sala => {
            const tipos = tiposData[sala.id] || [];
            const totalSubs = tipos.reduce((acc, t) => acc + (t.subtipos?.length || 0), 0);
            const panelOpen = tiposPanelId === sala.id;
            return (
              <div key={sala.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${!sala.ativo ? 'opacity-60' : 'border-transparent'}`}>

                {/* ── Linha da Sala ── */}
                <div className="p-5 flex items-center gap-4 flex-wrap">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${sala.ativo ? 'bg-[#3d7a52]' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800">{sala.nome}</span>
                      {!sala.ativo && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inativa</span>}
                      {sala.administrativa && <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">Adm</span>}
                      {sala.requer_adm && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">Req. Adm</span>}
                      {tipos.length > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-semibold">
                          {tipos.length} tipo{tipos.length > 1 ? 's' : ''} · {totalSubs} sub-tipo{totalSubs !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded">{sala.slug}</span>
                      <span className="ml-2">· {sala.tempo_medio_min} min/paciente</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    <button onClick={() => toggleTiposPanel(sala.id)}
                      className={`px-4 py-2 text-sm font-medium rounded-xl transition border ${panelOpen ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-600 border-blue-100 hover:bg-blue-50'}`}>
                      📋 Exames {panelOpen ? '▲' : '▼'}
                    </button>
                    <button onClick={() => openEditar(sala)}
                      className="px-4 py-2 text-sm font-medium text-[#3d7a52] border border-[#d1e8da] hover:bg-[#e8f5ee] rounded-xl transition">Editar</button>
                    <button onClick={() => setConfirmDelete(sala)}
                      className="px-4 py-2 text-sm font-medium text-red-500 border border-red-100 hover:bg-red-50 rounded-xl transition">Excluir</button>
                  </div>
                </div>

                {/* ── Painel Tipos (nível 2) ── */}
                {panelOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tipos de Exame — {sala.nome}</p>
                    {tipos.length === 0 && (
                      <p className="text-sm text-gray-400 mb-3">Nenhum tipo cadastrado. Adicione abaixo.</p>
                    )}

                    <div className="space-y-2 mb-4">
                      {tipos.map(tipo => {
                        const subOpen = subPanelTipoId === tipo.id;
                        const subtipos = tipo.subtipos || [];
                        return (
                          <div key={tipo.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">

                            {/* Linha do Tipo */}
                            <div className="flex items-center gap-2 px-4 py-2.5">
                              {editandoTipo?.id === tipo.id ? (
                                <>
                                  <input type="text" value={editandoTipo.nome}
                                    onChange={e => setEditandoTipo(p => ({ ...p, nome: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEditTipo(sala.id); if (e.key === 'Escape') setEditandoTipo(null); }}
                                    autoFocus className="flex-1 text-sm border border-blue-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500" />
                                  <button onClick={() => handleSaveEditTipo(sala.id)} className="text-xs font-bold text-white bg-[#3d7a52] px-3 py-1.5 rounded-lg">✓</button>
                                  <button onClick={() => setEditandoTipo(null)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">✕</button>
                                </>
                              ) : (
                                <>
                                  <span className="flex-1 text-sm font-semibold text-gray-700">{tipo.nome}</span>
                                  {subtipos.length > 0 && (
                                    <span className="text-xs bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full font-semibold">
                                      {subtipos.length} sub
                                    </span>
                                  )}
                                  <button onClick={() => toggleSubPanel(tipo.id)}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition border ${subOpen ? 'bg-purple-600 text-white border-purple-600' : 'text-purple-600 border-purple-100 hover:bg-purple-50'}`}>
                                    Sub-tipos {subOpen ? '▲' : '▼'}
                                  </button>
                                  <button onClick={() => setEditandoTipo({ id: tipo.id, nome: tipo.nome })} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1">✏️</button>
                                  <button onClick={() => handleDeleteTipo(sala.id, tipo.id)} className="text-xs text-red-400 hover:text-red-600 font-bold px-2 py-1">✕</button>
                                </>
                              )}
                            </div>

                            {/* Painel Sub-tipos (nível 3) */}
                            {subOpen && (
                              <div className="border-t border-purple-100 bg-purple-50 px-4 py-3">
                                <p className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-2">Sub-tipos de {tipo.nome}</p>
                                {subtipos.length === 0 && (
                                  <p className="text-xs text-gray-400 mb-2">Nenhum sub-tipo. Adicione abaixo.</p>
                                )}
                                <div className="space-y-1.5 mb-3">
                                  {subtipos.map(st => (
                                    <div key={st.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-purple-100">
                                      {editandoSub?.id === st.id ? (
                                        <>
                                          <input type="text" value={editandoSub.nome}
                                            onChange={e => setEditandoSub(p => ({ ...p, nome: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEditSub(sala.id, tipo.id); if (e.key === 'Escape') setEditandoSub(null); }}
                                            autoFocus className="flex-1 text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none" />
                                          <button onClick={() => handleSaveEditSub(sala.id, tipo.id)} className="text-xs font-bold text-white bg-[#3d7a52] px-2 py-1 rounded">✓</button>
                                          <button onClick={() => setEditandoSub(null)} className="text-xs text-gray-500 px-2 py-1 rounded border border-gray-200">✕</button>
                                        </>
                                      ) : (
                                        <>
                                          <span className="flex-1 text-xs font-medium text-gray-700">{st.nome}</span>
                                          <button onClick={() => setEditandoSub({ id: st.id, nome: st.nome })} className="text-xs text-blue-500 hover:text-blue-700 px-1.5 py-1">✏️</button>
                                          <button onClick={() => handleDeleteSub(sala.id, tipo.id, st.id)} className="text-xs text-red-400 hover:text-red-600 font-bold px-1.5 py-1">✕</button>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <input type="text" value={novoSubtipo} onChange={e => setNovoSubtipo(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddSub(sala.id, tipo.id); }}
                                    placeholder="Ex: Admissional, Demissional, Periódico..."
                                    className="flex-1 text-xs border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400 transition bg-white" />
                                  <button onClick={() => handleAddSub(sala.id, tipo.id)} disabled={addingSub || !novoSubtipo.trim()}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg transition disabled:opacity-50 text-xs whitespace-nowrap">
                                    {addingSub ? '...' : '+ Add'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Adicionar novo tipo */}
                    <div className="flex gap-2">
                      <input type="text" value={novoTipo} onChange={e => setNovoTipo(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTipo(sala.id); }}
                        placeholder="Ex: Audiometria, Raio-X, Espirometria..."
                        className="flex-1 text-sm border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#3d7a52] transition bg-white" />
                      <button onClick={() => handleAddTipo(sala.id)} disabled={addingTipo || !novoTipo.trim()}
                        className="bg-[#3d7a52] hover:bg-[#2d5c3e] text-white font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50 text-sm whitespace-nowrap">
                        {addingTipo ? '...' : '+ Tipo'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* Modal nova/editar sala */}
    {modalOpen && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h2 className="text-lg font-black text-gray-800 mb-5">{editId ? 'Editar Sala' : 'Nova Sala'}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Sala</label>
              <input type="text" value={form.nome} onChange={e => handleNomeChange(e.target.value)} placeholder="Ex: Sala 06"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#3d7a52] transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug <span className="text-gray-400 font-normal">(sem espaços)</span></label>
              <input type="text" value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                placeholder="Ex: sala-06"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-[#3d7a52] transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tempo médio por paciente (minutos)</label>
              <input type="number" min={1} max={120} value={form.tempo_medio_min}
                onChange={e => setForm(f => ({ ...f, tempo_medio_min: parseInt(e.target.value) || 1 }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#3d7a52] transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Horário de início do atendimento
                <span className="text-xs text-gray-400 font-normal ml-1">(opcional — usado para calcular previsão)</span>
              </label>
              <input type="time" value={form.hora_inicio}
                onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#3d7a52] transition" />
              {form.hora_inicio && <p className="text-xs text-blue-500 mt-1">Previsão calculada a partir das {form.hora_inicio}, nunca antes.</p>}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                className={`w-11 h-6 rounded-full transition-colors ${form.ativo ? 'bg-[#3d7a52]' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.ativo ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-gray-600">Sala {form.ativo ? 'ativa' : 'inativa'}</span>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setForm(f => ({ ...f, administrativa: !f.administrativa, requer_adm: false }))}
                className={`w-11 h-6 rounded-full transition-colors ${form.administrativa ? 'bg-purple-500' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.administrativa ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <div>
                <span className="text-sm text-gray-600">Sala {form.administrativa ? 'administrativa' : 'operacional'}</span>
                {form.administrativa && <p className="text-xs text-purple-500 mt-0.5">Não aparece na TV. Libera paciente para outras salas.</p>}
              </div>
            </div>
            {!form.administrativa && (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setForm(f => ({ ...f, requer_adm: !f.requer_adm }))}
                  className={`w-11 h-6 rounded-full transition-colors ${form.requer_adm ? 'bg-orange-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.requer_adm ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <div>
                  <span className="text-sm text-gray-600">Requer liberação administrativa</span>
                  {form.requer_adm && <p className="text-xs text-orange-500 mt-0.5">Bloqueado até sala adm. concluir o atendimento.</p>}
                </div>
              </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-red-700 text-sm">{error}</div>}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition">Cancelar</button>
            <button onClick={handleSalvar} disabled={saving} className="flex-1 py-2.5 bg-[#3d7a52] hover:bg-[#2d5c3e] text-white font-bold rounded-xl transition disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    )}

    {confirmDelete && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-black text-gray-800 mb-2">Excluir sala?</h2>
          <p className="text-sm text-gray-500 mb-6">Tem certeza que deseja excluir <strong>{confirmDelete.nome}</strong>? Salas com pacientes na fila não podem ser excluídas.</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition">Cancelar</button>
            <button onClick={() => handleExcluir(confirmDelete.id)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition">Excluir</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
