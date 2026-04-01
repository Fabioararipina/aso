'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { authHeaders } from '../../../lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function maskWhatsapp(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const STATUS_LABEL = {
  PRESENTE:       { label: 'Aguardando', bg: '#fef9c3', color: '#a16207' },
  EM_ATENDIMENTO: { label: 'Em atend.',  bg: '#dbeafe', color: '#1d4ed8' },
  CONCLUIDO:      { label: 'Concluído',  bg: '#dcfce7', color: '#16a34a' },
  CANCELADO:      { label: 'Cancelado',  bg: '#fee2e2', color: '#dc2626' },
};
const SALA_STATUS_COLOR = {
  PENDENTE:       '#fbbf24',
  EM_ATENDIMENTO: '#3b82f6',
  CONCLUIDO_SALA: '#22c55e',
};

export default function RecepcaoAsoPage() {
  const [tab, setTab] = useState('checkin');
  const [salas, setSalas] = useState([]);

  // Check-in state
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [salasSelecionadas, setSalasSelecionadas] = useState([]);
  const [examesSelecionados, setExamesSelecionados] = useState({}); // { [salaId]: number[] }
  const [mostrarOpcionais, setMostrarOpcionais] = useState(false);
  const [empresa, setEmpresa] = useState('');
  const [funcao, setFuncao] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Modal de seleção de exames
  const [examesModalSala, setExamesModalSala] = useState(null); // sala object
  const [tipoExpandidoId, setTipoExpandidoId] = useState(null);

  // Pacientes de hoje
  const [pacientes, setPacientes] = useState([]);
  const [loadingPacientes, setLoadingPacientes] = useState(false);
  const [acaoLoading, setAcaoLoading] = useState('');

  // Modal de atraso
  const [atrasoModal, setAtrasoModal] = useState(null);
  const [atrasoMinutos, setAtrasoMinutos] = useState('15');

  // Modal de edição
  const [editModal, setEditModal] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editSalas, setEditSalas] = useState([]);
  const [editExamesSelecionados, setEditExamesSelecionados] = useState({});
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  // Contexto do modal de exames: 'checkin' | 'edit'
  const [examesModalContext, setExamesModalContext] = useState('checkin');

  useEffect(() => {
    axios.get(`${API_URL}/api/salas`, { headers: authHeaders() })
      .then(r => { if (r.data?.length) setSalas(r.data.filter(s => s.ativo)); })
      .catch(() => {});
  }, []);

  const fetchPacientes = useCallback(() => {
    setLoadingPacientes(true);
    axios.get(`${API_URL}/api/atendimentos/hoje`, { headers: authHeaders() })
      .then(r => setPacientes(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingPacientes(false));
  }, []);

  useEffect(() => {
    if (tab === 'hoje') fetchPacientes();
  }, [tab, fetchPacientes]);

  function toggleSala(id) {
    setSalasSelecionadas(prev => {
      if (prev.includes(id)) {
        // Remover exames desta sala ao desselecionar
        setExamesSelecionados(es => { const n = { ...es }; delete n[id]; return n; });
        return prev.filter(s => s !== id);
      }
      return [...prev, id];
    });
  }

  function toggleSubtipo(salaId, subtipoId) {
    const setter = examesModalContext === 'edit' ? setEditExamesSelecionados : setExamesSelecionados;
    setter(prev => {
      const current = prev[salaId] || [];
      const next = current.includes(subtipoId)
        ? current.filter(id => id !== subtipoId)
        : [...current, subtipoId];
      return { ...prev, [salaId]: next };
    });
  }

  function countSelecionados(salaId) {
    const state = examesModalContext === 'edit' ? editExamesSelecionados : examesSelecionados;
    return (state[salaId] || []).length;
  }

  function abrirExamesModal(sala, context) {
    setExamesModalContext(context);
    setExamesModalSala(sala);
    setTipoExpandidoId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!nome.trim()) return setError('Nome é obrigatório');
    const waDig = whatsapp.replace(/\D/g, '');
    if (waDig.length < 10 || waDig.length > 11) return setError('WhatsApp inválido — informe com DDD');
    if (salasSelecionadas.length === 0) return setError('Selecione pelo menos uma sala');
    setLoading(true);
    try {
      let paciente = null;
      try {
        const check = await axios.get(`${API_URL}/api/pacientes/buscar?whatsapp=${waDig}`, { headers: authHeaders() });
        paciente = check.data;
      } catch {}
      if (!paciente) {
        const resp = await axios.post(`${API_URL}/api/pacientes`, { nome: nome.trim(), whatsapp: waDig }, { headers: authHeaders() });
        paciente = resp.data;
      }
      // Montar exames_por_sala (apenas salas com exames selecionados)
      const exames_por_sala = {};
      Object.entries(examesSelecionados).forEach(([salaId, ids]) => {
        if (ids.length > 0) exames_por_sala[salaId] = ids;
      });
      await axios.post(`${API_URL}/api/atendimentos`, {
        paciente_id: paciente.id,
        salas_ids: salasSelecionadas,
        empresa: empresa.trim() || undefined,
        funcao: funcao.trim() || undefined,
        cnpj: cnpj.trim() || undefined,
        exames_por_sala: Object.keys(exames_por_sala).length > 0 ? exames_por_sala : undefined,
      }, { headers: authHeaders() });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao realizar check-in. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setNome(''); setWhatsapp(''); setSalasSelecionadas([]); setExamesSelecionados({});
    setEmpresa(''); setFuncao(''); setCnpj(''); setMostrarOpcionais(false);
    setError(''); setSuccess(false);
  }

  async function handleCancelar(atendimentoId) {
    if (!confirm('Cancelar este atendimento?')) return;
    setAcaoLoading(`cancelar-${atendimentoId}`);
    try {
      await axios.patch(`${API_URL}/api/atendimentos/${atendimentoId}/cancelar`, {}, { headers: authHeaders() });
      fetchPacientes();
    } catch (err) {
      alert('Erro ao cancelar: ' + (err.response?.data?.error || err.message));
    } finally { setAcaoLoading(''); }
  }

  function abrirModalEditar(p) {
    const salasPendentes = (p.salas || []).filter(s => s.sala_id).map(s => s.sala_id);
    // Inicializa exames a partir dos dados já salvos
    const examesInit = {};
    (p.salas || []).forEach(s => {
      if (s.sala_id && s.exames_selecionados?.length > 0) {
        examesInit[s.sala_id] = s.exames_selecionados;
      }
    });
    setEditNome(p.paciente_nome || '');
    setEditWhatsapp(maskWhatsapp(p.whatsapp || ''));
    setEditSalas(salasPendentes);
    setEditExamesSelecionados(examesInit);
    setEditModal({ id: p.id });
  }

  async function confirmarEdicao() {
    setSalvandoEdit(true);
    const exames_por_sala = {};
    Object.entries(editExamesSelecionados).forEach(([salaId, ids]) => {
      if (ids.length > 0) exames_por_sala[salaId] = ids;
    });
    try {
      await axios.put(`${API_URL}/api/atendimentos/${editModal.id}`, {
        nome: editNome.trim(),
        whatsapp: editWhatsapp.replace(/\D/g, ''),
        salas_ids: editSalas,
        exames_por_sala: Object.keys(exames_por_sala).length > 0 ? exames_por_sala : undefined,
      }, { headers: authHeaders() });
      setEditModal(null);
      fetchPacientes();
    } catch (err) {
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSalvandoEdit(false);
    }
  }

  function abrirModalAtraso(salaSlug, salaNome) {
    setAtrasoMinutos('15');
    setAtrasoModal({ salaSlug, salaNome });
  }

  async function confirmarAtraso() {
    const { salaSlug, salaNome } = atrasoModal;
    const mins = parseInt(atrasoMinutos) || 0;
    setAtrasoModal(null);
    setAcaoLoading(`atraso-${salaSlug}`);
    try {
      const res = await axios.post(`${API_URL}/api/fila/${salaSlug}/atraso`, { minutos_atraso: mins }, { headers: authHeaders() });
      alert(`✅ ${res.data.notificados} paciente(s) notificado(s) sobre +${mins} min de atraso em ${salaNome}.`);
    } catch (err) {
      alert('Erro: ' + (err.response?.data?.error || err.message));
    } finally { setAcaoLoading(''); }
  }

  // Salas selecionadas que têm tipos de exame configurados
  const salasComExames = salas.filter(s => salasSelecionadas.includes(s.id) && s.tipos_exame?.length > 0);

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-[#e8f5ee] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#3d7a52]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-gray-800 mb-1">Check-in realizado!</h2>
          <p className="text-gray-500 text-sm mb-6"><strong>{nome}</strong> foi adicionado(a) à fila.</p>
          <button onClick={resetForm} className="w-full bg-[#3d7a52] text-white font-bold py-3 rounded-xl hover:bg-[#2d5c3e] transition">
            Novo Check-in
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-black text-gray-800">Check-in ASO</h1>
          <p className="text-gray-400 text-sm mt-1">Medicina Ocupacional</p>
        </div>

        <div className="flex bg-white rounded-xl shadow-sm mb-5 p-1 gap-1">
          {[{ id: 'checkin', label: 'Novo Check-in' }, { id: 'hoje', label: 'Pacientes de Hoje' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${tab === t.id ? 'bg-[#3d7a52] text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Check-in ── */}
        {tab === 'checkin' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">

            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                placeholder="Nome do paciente" autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3d7a52] transition" />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                WhatsApp <span className="text-red-500">*</span>
              </label>
              <input type="tel" value={whatsapp} onChange={e => setWhatsapp(maskWhatsapp(e.target.value))}
                placeholder="(87) 99999-9999"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3d7a52] transition" />
            </div>

            {/* Informações opcionais (empresa, função, CNPJ) */}
            <div>
              <button type="button" onClick={() => setMostrarOpcionais(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition">
                <span className={`transition-transform ${mostrarOpcionais ? 'rotate-90' : ''}`}>▶</span>
                Informações da empresa <span className="text-gray-400 font-normal">(opcional)</span>
              </button>
              {mostrarOpcionais && (
                <div className="mt-3 space-y-3 pl-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Empresa</label>
                    <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)}
                      placeholder="Nome da empresa contratante"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3d7a52] transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Cargo / Função</label>
                    <input type="text" value={funcao} onChange={e => setFuncao(e.target.value)}
                      placeholder="Ex: Motorista, Operador, Técnico..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3d7a52] transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">CNPJ</label>
                    <input type="text" value={cnpj} onChange={e => setCnpj(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3d7a52] transition" />
                  </div>
                </div>
              )}
            </div>

            {/* Salas */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Salas de atendimento <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {salas.map(sala => {
                  const selected = salasSelecionadas.includes(sala.id);
                  return (
                    <button key={sala.id} type="button" onClick={() => toggleSala(sala.id)}
                      className={`rounded-xl px-4 py-3 text-left border-2 transition-all font-semibold text-sm ${
                        selected ? 'border-[#3d7a52] bg-[#e8f5ee] text-[#3d7a52]' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}>
                      {selected && <span className="mr-1">✓</span>}{sala.nome}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botões para abrir modal de exames por sala */}
            {salasComExames.length > 0 && (
              <div className="border border-blue-100 bg-blue-50 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Exames por sala</p>
                <div className="flex flex-wrap gap-2">
                  {salasComExames.map(sala => {
                    const count = countSelecionados(sala.id);
                    return (
                      <button key={sala.id} type="button"
                        onClick={() => abrirExamesModal(sala, 'checkin')}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border-2 transition-all ${count > 0 ? 'border-[#3d7a52] bg-[#e8f5ee] text-[#3d7a52]' : 'border-blue-200 bg-white text-blue-600 hover:border-blue-400'}`}>
                        📋 {sala.nome}
                        {count > 0 && (
                          <span className="bg-[#3d7a52] text-white text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-[#3d7a52] text-white font-black py-3.5 rounded-xl hover:bg-[#2d5c3e] transition disabled:opacity-60 disabled:cursor-not-allowed text-base">
              {loading ? 'Registrando...' : 'Confirmar Check-in'}
            </button>
          </form>
        )}

        {/* ── Tab: Pacientes de Hoje ── */}
        {tab === 'hoje' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Registrar Atraso por Sala</p>
              <div className="flex flex-wrap gap-2">
                {salas.map(sala => (
                  <button key={sala.id} onClick={() => abrirModalAtraso(sala.slug, sala.nome)}
                    disabled={acaoLoading === `atraso-${sala.slug}`}
                    className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-3 py-2 rounded-lg hover:bg-amber-100 transition disabled:opacity-50">
                    ⚠️ {acaoLoading === `atraso-${sala.slug}` ? 'Enviando...' : sala.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <span className="font-bold text-gray-700 text-sm">
                  Atendimentos de hoje <span className="text-gray-400 font-normal ml-2">{pacientes.length}</span>
                </span>
                <button onClick={fetchPacientes} disabled={loadingPacientes}
                  className="text-xs text-[#3d7a52] font-bold hover:underline disabled:opacity-50">
                  {loadingPacientes ? 'Carregando...' : '↻ Atualizar'}
                </button>
              </div>
              {pacientes.length === 0 && !loadingPacientes && (
                <div className="py-12 text-center text-gray-400 text-sm">Nenhum atendimento hoje.</div>
              )}
              {pacientes.map(p => {
                const si = STATUS_LABEL[p.status] || STATUS_LABEL.PRESENTE;
                const podeCancel = p.status !== 'CANCELADO' && p.status !== 'CONCLUIDO';
                return (
                  <div key={p.id} className="px-5 py-4 border-b border-gray-50 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800 text-sm">{p.paciente_nome}</span>
                          <span style={{ background: si.bg, color: si.color }} className="text-xs font-bold px-2 py-0.5 rounded-full">{si.label}</span>
                          {p.empresa && <span className="text-xs text-gray-400 font-medium">{p.empresa}</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{p.whatsapp}{p.funcao ? ` · ${p.funcao}` : ''}</p>
                        {p.salas && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.salas.filter(s => s.sala_nome).map((s, i) => (
                              <span key={i}
                                style={{ background: SALA_STATUS_COLOR[s.status] + '33', color: SALA_STATUS_COLOR[s.status], border: `1px solid ${SALA_STATUS_COLOR[s.status]}66` }}
                                className="text-xs font-semibold px-2 py-0.5 rounded">
                                {s.sala_nome}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {podeCancel && (
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button onClick={() => abrirModalEditar(p)}
                            className="text-xs bg-blue-50 border border-blue-200 text-blue-600 font-bold px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
                            ✏️ Editar
                          </button>
                          <button onClick={() => handleCancelar(p.id)} disabled={acaoLoading === `cancelar-${p.id}`}
                            className="text-xs bg-red-50 border border-red-200 text-red-600 font-bold px-3 py-1.5 rounded-lg hover:bg-red-100 transition disabled:opacity-50">
                            {acaoLoading === `cancelar-${p.id}` ? '...' : '✕ Cancelar'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Modal de edição de atendimento */}
    {editModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h2 className="text-lg font-black text-gray-800 mb-4">✏️ Editar Atendimento</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Nome completo</label>
              <input
                type="text"
                value={editNome}
                onChange={e => setEditNome(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3d7a52] text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">WhatsApp</label>
              <input
                type="tel"
                value={editWhatsapp}
                onChange={e => setEditWhatsapp(maskWhatsapp(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3d7a52] text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Salas</label>
              <div className="grid grid-cols-2 gap-2">
                {salas.map(sala => {
                  const selected = editSalas.includes(sala.id);
                  return (
                    <button
                      key={sala.id}
                      type="button"
                      onClick={() => setEditSalas(prev =>
                        prev.includes(sala.id) ? prev.filter(s => s !== sala.id) : [...prev, sala.id]
                      )}
                      className={`rounded-xl px-3 py-2.5 text-left border-2 transition-all font-semibold text-sm ${
                        selected
                          ? 'border-[#3d7a52] bg-[#e8f5ee] text-[#3d7a52]'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {selected && <span className="mr-1">✓</span>}{sala.nome}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Exames por sala (para salas selecionadas que têm tipos_exame) */}
            {salas.filter(s => editSalas.includes(s.id) && s.tipos_exame?.length > 0).length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Tipos de exame</label>
                <div className="flex flex-col gap-2">
                  {salas.filter(s => editSalas.includes(s.id) && s.tipos_exame?.length > 0).map(sala => {
                    const count = (editExamesSelecionados[sala.id] || []).length;
                    return (
                      <button
                        key={sala.id}
                        type="button"
                        onClick={() => abrirExamesModal(sala, 'edit')}
                        className="flex items-center justify-between px-4 py-2.5 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition text-sm font-semibold"
                      >
                        <span>🔬 {sala.nome}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${count > 0 ? 'bg-[#3d7a52] text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {count > 0 ? `${count} selecionado${count !== 1 ? 's' : ''}` : 'Configurar'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={confirmarEdicao}
              disabled={salvandoEdit || editSalas.length === 0}
              className="flex-1 bg-[#3d7a52] text-white font-bold py-2.5 rounded-xl hover:bg-[#2d5c3e] transition disabled:opacity-50 text-sm"
            >
              {salvandoEdit ? 'Salvando...' : '✓ Salvar'}
            </button>
            <button
              onClick={() => setEditModal(null)}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal de seleção de exames */}
    {examesModalSala && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div>
              <h3 className="font-black text-gray-800">Selecionar Exames</h3>
              <p className="text-xs text-gray-400 mt-0.5">{examesModalSala.nome}</p>
            </div>
            <button onClick={() => setExamesModalSala(null)}
              className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 font-bold transition text-sm">✕</button>
          </div>

          <div className="px-6 py-4 space-y-2 overflow-y-auto flex-1">
            {examesModalSala.tipos_exame.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum tipo de exame cadastrado para esta sala.</p>
            ) : examesModalSala.tipos_exame.map(tipo => {
              const expanded = tipoExpandidoId === tipo.id;
              const selecionados = (examesModalContext === 'edit' ? editExamesSelecionados : examesSelecionados)[examesModalSala.id] || [];
              const countTipo = (tipo.subtipos || []).filter(st => selecionados.includes(st.id)).length;
              return (
                <div key={tipo.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button type="button"
                    onClick={() => setTipoExpandidoId(expanded ? null : tipo.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition font-semibold text-sm ${expanded ? 'bg-[#3d7a52] text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'}`}>
                    <span>{tipo.nome}</span>
                    <div className="flex items-center gap-2">
                      {countTipo > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${expanded ? 'bg-white/25 text-white' : 'bg-[#3d7a52] text-white'}`}>
                          {countTipo}
                        </span>
                      )}
                      <span>{expanded ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-4 py-3 space-y-2 bg-white">
                      {(!tipo.subtipos || tipo.subtipos.length === 0) ? (
                        <p className="text-xs text-gray-400">Nenhum sub-tipo cadastrado para este tipo.</p>
                      ) : tipo.subtipos.map(st => {
                        const checked = selecionados.includes(st.id);
                        return (
                          <label key={st.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition border ${checked ? 'bg-[#e8f5ee] border-[#3d7a52]' : 'border-gray-100 hover:bg-gray-50'}`}>
                            <input type="checkbox" checked={checked}
                              onChange={() => toggleSubtipo(examesModalSala.id, st.id)}
                              className="w-4 h-4 accent-[#3d7a52] cursor-pointer flex-shrink-0" />
                            <span className={`text-sm font-medium ${checked ? 'text-[#3d7a52]' : 'text-gray-700'}`}>{st.nome}</span>
                            {checked && <span className="ml-auto text-[#3d7a52] text-xs font-bold">✓</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button type="button" onClick={() => setExamesModalSala(null)}
              className="w-full bg-[#3d7a52] hover:bg-[#2d5c3e] text-white font-bold py-3 rounded-xl transition">
              Confirmar ({countSelecionados(examesModalSala.id)} selecionado{countSelecionados(examesModalSala.id) !== 1 ? 's' : ''})
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal de atraso */}
    {atrasoModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <h3 className="text-base font-black text-gray-800 mb-1">Registrar Atraso</h3>
          <p className="text-sm text-gray-500 mb-5">
            Sala <strong>{atrasoModal.salaNome}</strong> — todos os pacientes pendentes serão notificados via WhatsApp.
          </p>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Quantos minutos de atraso?</label>
          <div className="flex items-center gap-2 mb-6">
            <input type="number" min="1" max="180" value={atrasoMinutos} onChange={e => setAtrasoMinutos(e.target.value)}
              autoFocus className="w-28 border-2 border-amber-300 rounded-xl px-4 py-2.5 text-gray-800 text-lg font-bold text-center focus:outline-none focus:border-amber-500 transition" />
            <span className="text-gray-500 text-sm font-medium">minutos</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setAtrasoModal(null)}
              className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">Cancelar</button>
            <button onClick={confirmarAtraso} disabled={!atrasoMinutos || parseInt(atrasoMinutos) < 1}
              className="flex-1 bg-amber-500 text-white font-bold py-2.5 rounded-xl hover:bg-amber-600 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              ⚠️ Notificar Atraso
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
