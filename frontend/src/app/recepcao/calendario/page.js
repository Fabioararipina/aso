'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CalendarioRecepcaoPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [medicos, setMedicos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [slotsPorMedico, setSlotsPorMedico] = useState({}); // { medicoId: ['07:00', '07:20', ...] }
  const [loading, setLoading] = useState(true);

  // Estados do Modal de agendamento
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ nome: '', whatsapp: '', observacoes: '' });

  // Estados do Modal de Encaixe
  const [showEncaixeModal, setShowEncaixeModal] = useState(false);
  const [formEncaixe, setFormEncaixe] = useState({ nome: '', whatsapp: '', medico_id: '', observacoes: '' });
  const [loadingEncaixe, setLoadingEncaixe] = useState(false);

  // Estado do botão de pausa de mensagens
  const [mensagensPausadas, setMensagensPausadas] = useState(false);

  // Estado de drag-and-drop
  const [draggedAgendamento, setDraggedAgendamento] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-agendamento.primeatende.com.br';

  useEffect(() => {
    fetchDados();
    // Verifica estado inicial das mensagens
    axios.get(`${API_URL}/api/whatsapp/status`)
      .then(res => setMensagensPausadas(res.data.mensagensPausadas || false))
      .catch(() => {});
  }, [selectedDate]);

  const fetchDados = async () => {
    setLoading(true);
    try {
      const dataStr = format(selectedDate, 'yyyy-MM-dd');
      const [resMedicos, resAgendamentos] = await Promise.all([
        axios.get(`${API_URL}/api/medicos`),
        axios.get(`${API_URL}/api/agendamentos/recepcao/dia?data=${dataStr}`)
      ]);
      setMedicos(resMedicos.data);
      setAgendamentos(resAgendamentos.data);

      // Busca slots reais de cada médico (por ID) para saber quais linhas mostrar e quais bloquear
      const slotsPromises = resMedicos.data.map(m =>
        axios.get(`${API_URL}/api/medicos/${m.id}/disponiveis?data=${dataStr}`)
          .then(r => ({ id: m.id, slots: r.data }))
          .catch(() => ({ id: m.id, slots: [] }))
      );
      const resultados = await Promise.all(slotsPromises);
      const mapa = {};
      resultados.forEach(({ id, slots }) => { mapa[id] = slots; });
      setSlotsPorMedico(mapa);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getAgendamento = (medicoId, hora) => {
    const matches = agendamentos.filter(a => a.medico_id === medicoId && a.horario.startsWith(hora));
    // Prioriza agendamento ativo sobre cancelado; se só houver cancelados, retorna null (slot livre)
    return matches.find(a => a.status !== 'CANCELADO') || null;
  };

  const handleOpenModal = (medicoId, hora, agendamento = null) => {
    // Slot cancelado é tratado como livre para novo agendamento
    const agendamentoAtivo = agendamento?.status === 'CANCELADO' ? null : agendamento;
    setSelectedSlot({ medicoId, hora, agendamento: agendamentoAtivo });
    if (agendamentoAtivo) {
      setForm({ nome: agendamentoAtivo.paciente_nome, whatsapp: agendamentoAtivo.whatsapp, observacoes: agendamentoAtivo.observacoes || '' });
    } else {
      setForm({ nome: '', whatsapp: '', observacoes: '' });
    }
    setShowModal(true);
  };

  const handleStatusUpdate = async (novoStatus) => {
    try {
      await axios.put(`${API_URL}/api/agendamentos/${selectedSlot.agendamento.id}/status`, { status: novoStatus });
      setShowModal(false);
      fetchDados();
    } catch (e) { alert('Erro ao atualizar status'); }
  };

  const handleEncaixar = async (e) => {
    e.preventDefault();
    setLoadingEncaixe(true);
    try {
      await axios.post(`${API_URL}/api/agendamentos/encaixe`, formEncaixe);
      setShowEncaixeModal(false);
      setFormEncaixe({ nome: '', whatsapp: '', medico_id: '', observacoes: '' });
      fetchDados();
    } catch (error) {
      alert('Erro ao encaixar: ' + (error.response?.data?.erro || error.message));
    } finally {
      setLoadingEncaixe(false);
    }
  };

  const toggleMensagens = async () => {
    const rota = mensagensPausadas ? 'retomar' : 'pausar';
    try {
      const res = await axios.post(`${API_URL}/api/whatsapp/${rota}`);
      setMensagensPausadas(res.data.mensagensPausadas);
    } catch (error) {
      alert('Erro ao alterar estado das mensagens');
    }
  };

  const handleDragStart = (agendamento) => {
    setDraggedAgendamento(agendamento);
  };

  const handleDragEnd = () => {
    setDraggedAgendamento(null);
  };

  const handleDrop = async (medicoId, hora) => {
    if (!draggedAgendamento) return;
    // Não fazer nada se soltar no mesmo slot
    if (draggedAgendamento.medico_id === medicoId && draggedAgendamento.horario.startsWith(hora)) {
      setDraggedAgendamento(null);
      return;
    }
    const slotDestino = getAgendamento(medicoId, hora);
    try {
      if (slotDestino && slotDestino.id !== draggedAgendamento.id) {
        // Slot ocupado: troca os horários dos dois pacientes
        await axios.post(`${API_URL}/api/agendamentos/trocar`, {
          id1: draggedAgendamento.id,
          horario1: draggedAgendamento.horario,
          medico_id1: draggedAgendamento.medico_id,
          id2: slotDestino.id,
          horario2: slotDestino.horario,
          medico_id2: slotDestino.medico_id,
        });
      } else {
        // Slot livre: move para cá
        await axios.put(`${API_URL}/api/agendamentos/${draggedAgendamento.id}/mover`, {
          horario: hora + ':00',
          medico_id: medicoId,
        });
      }
      setDraggedAgendamento(null);
      fetchDados();
    } catch (error) {
      alert('Erro ao reorganizar: ' + (error.response?.data?.erro || error.message));
      setDraggedAgendamento(null);
    }
  };

  const handleAgendarBalcao = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        medico_id: selectedSlot.medicoId,
        data_consulta: format(selectedDate, 'yyyy-MM-dd'),
        horario: selectedSlot.hora,
      };
      const res = await axios.post(`${API_URL}/api/agendamentos`, payload);
      // Confirma automaticamente se é balcão
      await axios.put(`${API_URL}/api/agendamentos/${res.data.agendamento.id}/confirmar`);
      setShowModal(false);
      fetchDados();
    } catch (e) { alert('Erro ao agendar'); }
  };

  // Verifica se um médico específico tem aquele horário disponível (ou ocupado por agendamento)
  const medicoTemSlot = (medicoId, hora) => {
    const slots = slotsPorMedico[medicoId] || [];
    const temSlotLivre = slots.includes(hora);
    const temAgendamentoAtivo = agendamentos.some(a => a.medico_id === medicoId && a.horario.startsWith(hora) && a.status !== 'CANCELADO');
    return temSlotLivre || temAgendamentoAtivo;
  };

  // --- GERAÇÃO DINÂMICA DE LINHAS (SLOTS) ---
  const gerarLinhasDoTempo = () => {
    const temposSet = new Set();

    // 1. União de todos os slots de todos os médicos (define as linhas da grade)
    Object.values(slotsPorMedico).forEach(slots =>
      slots.forEach(hora => temposSet.add(hora))
    );

    // 2. Agendamentos já marcados (garante que apareçam mesmo se slot não está mais livre)
    agendamentos.forEach(a => {
      if (a.horario) temposSet.add(a.horario.slice(0, 5));
    });

    // 3. Fallback: se nenhum médico tem grade configurada, usa grade padrão 30/30
    if (temposSet.size === 0) {
      for (let i = 7; i <= 20; i++) {
        temposSet.add(`${i.toString().padStart(2, '0')}:00`);
        temposSet.add(`${i.toString().padStart(2, '0')}:30`);
      }
    }

    return Array.from(temposSet).sort();
  };

  const horas = gerarLinhasDoTempo();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col h-screen overflow-hidden">
      
      {/* HEADER CONTROLES */}
      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm z-10">
        <h1 className="text-xl font-bold text-gray-800">Agenda Diária</h1>
        <div className="flex items-center space-x-4">
          <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-2 hover:bg-gray-100 rounded">◀</button>
          <span className="font-bold text-lg text-blue-900 capitalize border px-4 py-1 rounded bg-blue-50">
            {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </span>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 hover:bg-gray-100 rounded">▶</button>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={toggleMensagens}
            title={mensagensPausadas ? 'Clique para retomar o envio de mensagens WhatsApp' : 'Clique para pausar o envio de mensagens WhatsApp'}
            className={`px-4 py-2 rounded text-sm font-bold shadow transition ${
              mensagensPausadas
                ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 animate-pulse'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {mensagensPausadas ? '🔕 Msgs PAUSADAS — Retomar' : '🔔 Pausar Msgs'}
          </button>
          <button
            onClick={() => setShowEncaixeModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold shadow transition"
          >
            🚨 Encaixar Urgência
          </button>
          <button onClick={fetchDados} className="bg-[#5b8dfd] text-white px-4 py-2 rounded hover:bg-blue-600 text-sm font-bold shadow-sm transition">Atualizar</button>
        </div>
      </header>

      {/* GRID DA AGENDA */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full text-gray-500 font-bold animate-pulse text-xl">
            Sincronizando Agenda...
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow border overflow-hidden min-w-[800px]">
            <div className="grid border-b sticky top-0 bg-white z-10" style={{ gridTemplateColumns: `60px repeat(${medicos.length}, 1fr)` }}>
              <div className="p-3 text-xs text-gray-400 font-bold border-r bg-gray-50 flex items-center justify-center uppercase tracking-widest">HORA</div>
              {medicos.map(m => (
                <div key={m.id} className="p-3 border-r last:border-r-0 text-center bg-blue-50 border-b-2 border-blue-200">
                  <span className="block font-bold text-gray-800 truncate uppercase text-sm">{m.nome}</span>
                  <span className="text-xs text-blue-500 font-medium">{m.especialidade}</span>
                </div>
              ))}
            </div>

            {horas.map(hora => (
              <div key={hora} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `60px repeat(${medicos.length}, 1fr)` }}>
                <div className="p-2 text-[10px] font-bold text-gray-400 border-r flex items-center justify-center bg-gray-50 border-dashed">
                  {hora}
                </div>

                {medicos.map(m => {
                  const agendamento = getAgendamento(m.id, hora);
                  const temSlot = medicoTemSlot(m.id, hora);

                  // Médico não tem esse horário na agenda e não há agendamento: célula bloqueada
                  if (!temSlot) {
                    return (
                      <div key={`${m.id}-${hora}`} className="border-r last:border-r-0 p-1 min-h-[70px] bg-gray-100/60" />
                    );
                  }

                  const isDraggingOver = draggedAgendamento && draggedAgendamento.id !== agendamento?.id;
                  const isSwapTarget = isDraggingOver && !!agendamento;

                  return (
                    <div
                      key={`${m.id}-${hora}`}
                      className={`border-r last:border-r-0 p-1 min-h-[70px] transition-colors relative group
                        ${!agendamento ? 'bg-emerald-50/30 hover:bg-emerald-100/50' : ''}
                        ${isDraggingOver && !agendamento ? 'ring-2 ring-inset ring-blue-400 ring-dashed' : ''}
                        ${isSwapTarget ? 'ring-2 ring-inset ring-orange-400 ring-dashed' : ''}`}
                      onClick={() => !draggedAgendamento && handleOpenModal(m.id, hora, agendamento)}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={() => handleDrop(m.id, hora)}
                    >
                      {agendamento ? (
                        <div
                          draggable
                          onDragStart={() => handleDragStart(agendamento)}
                          onDragEnd={handleDragEnd}
                          className={`
                            h-full rounded-lg p-2 text-[11px] border-l-4 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition transform hover:scale-[1.01]
                            ${draggedAgendamento?.id === agendamento.id ? 'opacity-40' : ''}
                            ${agendamento.status === 'PENDENTE' ? 'bg-yellow-50 border-yellow-500 text-yellow-900' : ''}
                            ${agendamento.status === 'CONFIRMADO' ? 'bg-blue-50 border-blue-500 text-blue-900' : ''}
                            ${agendamento.status === 'PRESENTE' ? 'bg-emerald-100 border-emerald-600 text-emerald-900' : ''}
                            ${agendamento.status === 'EM_ATENDIMENTO' ? 'bg-blue-600 border-blue-800 text-white animate-pulse' : ''}
                            ${agendamento.status === 'CONCLUIDO' ? 'bg-gray-100 border-gray-400 text-gray-500 opacity-75' : ''}
                            ${agendamento.status === 'AUSENTE' ? 'bg-orange-50 border-orange-500 text-orange-900' : ''}
                            ${agendamento.status === 'CANCELADO' ? 'bg-red-50 border-red-500 text-red-900 line-through opacity-50' : ''}
                          `}
                        >
                          <div className="font-black truncate uppercase flex items-center gap-1">
                            {agendamento.tipo_consulta === 'ENCAIXE' && <span title="Encaixe Urgente">🚨</span>}
                            {agendamento.paciente_nome}
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="font-bold opacity-70">{agendamento.status.replace('_', ' ')}</span>
                            {agendamento.status === 'PENDENTE' && <span className="animate-bounce">🔔</span>}
                            {agendamento.tipo_consulta === 'ENCAIXE' && <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1 rounded">URGENTE</span>}
                          </div>
                        </div>
                      ) : (
                        <div className={`h-full w-full flex items-center justify-center transition-opacity ${draggedAgendamento ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold shadow-sm ${draggedAgendamento ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'}`}>
                            {draggedAgendamento ? 'SOLTAR AQUI' : 'LIVRE +'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE ENCAIXE */}
      {showEncaixeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-red-600 p-4 text-white flex justify-between items-center">
              <h2 className="font-bold text-lg">🚨 Encaixar Urgência</h2>
              <button onClick={() => setShowEncaixeModal(false)} className="text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">O paciente será adicionado ao topo da fila. Todos aguardando serão avisados pelo WhatsApp sobre o atraso.</p>
              <form onSubmit={handleEncaixar} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Médico</label>
                  <select
                    required
                    className="w-full p-3 border rounded-xl text-gray-900"
                    value={formEncaixe.medico_id}
                    onChange={e => setFormEncaixe({ ...formEncaixe, medico_id: e.target.value })}
                  >
                    <option value="">Selecione o médico...</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome do Paciente</label>
                  <input
                    required
                    className="w-full p-3 border rounded-xl text-gray-900"
                    value={formEncaixe.nome}
                    onChange={e => setFormEncaixe({ ...formEncaixe, nome: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">WhatsApp</label>
                  <input
                    required
                    className="w-full p-3 border rounded-xl text-gray-900"
                    placeholder="879..."
                    value={formEncaixe.whatsapp}
                    onChange={e => setFormEncaixe({ ...formEncaixe, whatsapp: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Motivo / Observação</label>
                  <input
                    className="w-full p-3 border rounded-xl text-gray-900"
                    placeholder="Ex: Dor aguda, retorno urgente..."
                    value={formEncaixe.observacoes}
                    onChange={e => setFormEncaixe({ ...formEncaixe, observacoes: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingEncaixe}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50"
                >
                  {loadingEncaixe ? 'Encaixando...' : '🚨 CONFIRMAR ENCAIXE'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GESTÃO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h2 className="font-bold">
                {selectedSlot?.agendamento ? 'Detalhes do Agendamento' : 'Novo Agendamento Balcão'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-2xl">&times;</button>
            </div>

            <div className="p-6">
              {selectedSlot?.agendamento ? (
                // VIEW / ACTIONS PARA EXISTENTE
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-xl border">
                    <p className="text-xs text-gray-400 font-bold uppercase mb-1">Paciente</p>
                    <p className="text-xl font-bold text-gray-800">{selectedSlot.agendamento.paciente_nome}</p>
                    <p className="text-blue-600 font-mono text-sm">{selectedSlot.agendamento.whatsapp}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {selectedSlot.agendamento.status === 'PENDENTE' && (
                      <button onClick={() => handleStatusUpdate('CONFIRMADO')} className="bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600">CONFIRMAR</button>
                    )}
                    {(selectedSlot.agendamento.status === 'CONFIRMADO') && (
                      <button onClick={() => handleStatusUpdate('PRESENTE')} className="bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600">MARCAR CHEGADA</button>
                    )}
                    <button onClick={() => handleStatusUpdate('CANCELADO')} className="bg-red-100 text-red-600 font-bold py-3 rounded-xl hover:bg-red-200">CANCELAR</button>
                  </div>
                </div>
              ) : (
                // FORMULÁRIO PARA NOVO
                <form onSubmit={handleAgendarBalcao} className="space-y-4">
                  <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 mb-4">
                    Agendando para às <strong>{selectedSlot?.hora}</strong> com o médico selecionado.
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome do Paciente</label>
                    <input required className="w-full p-3 border rounded-xl text-gray-900" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">WhatsApp</label>
                    <input required className="w-full p-3 border rounded-xl text-gray-900" placeholder="879..." value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 shadow-lg">CADASTRAR E CONFIRMAR</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}
