'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CalendarioRecepcaoPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [medicos, setMedicos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // { medicoId, hora, agendamento? }
  const [form, setForm] = useState({ nome: '', whatsapp: '', observacoes: '' });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-agendamento.primeatende.com.br';

  useEffect(() => {
    fetchDados();
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
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getAgendamento = (medicoId, hora) => {
    return agendamentos.find(a => a.medico_id === medicoId && a.horario.startsWith(hora));
  };

  const handleOpenModal = (medicoId, hora, agendamento = null) => {
    setSelectedSlot({ medicoId, hora, agendamento });
    if (agendamento) {
      setForm({ nome: agendamento.paciente_nome, whatsapp: agendamento.whatsapp, observacoes: agendamento.observacoes || '' });
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

  // --- GERAÇÃO DINÂMICA DE LINHAS (SLOTS) ---
  // Combina horas padrão (30 em 30min) + Horários exatos dos agendamentos existentes
  const gerarLinhasDoTempo = () => {
    const temposSet = new Set();
    
    // 1. Adiciona grade padrão (para não ficar vazio) - 07:00 às 20:00
    for(let i=7; i<=20; i++) {
      temposSet.add(`${i.toString().padStart(2, '0')}:00`);
      temposSet.add(`${i.toString().padStart(2, '0')}:30`);
    }

    // 2. Adiciona horários dos agendamentos reais (para garantir que apareçam)
    agendamentos.forEach(a => {
      if (a.horario) {
        temposSet.add(a.horario.slice(0, 5));
      }
    });

    // 3. Converte para array e ordena
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
        <button onClick={fetchDados} className="bg-[#5b8dfd] text-white px-4 py-2 rounded hover:bg-blue-600 text-sm font-bold shadow-sm transition">Atualizar</button>
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
                  return (
                    <div 
                      key={`${m.id}-${hora}`} 
                      className={`border-r last:border-r-0 p-1 min-h-[70px] transition-colors relative group
                        ${!agendamento ? 'bg-emerald-50/30 hover:bg-emerald-100/50' : ''}`}
                      onClick={() => handleOpenModal(m.id, hora, agendamento)}
                    >
                      {agendamento ? (
                        <div className={`
                          h-full rounded-lg p-2 text-[11px] border-l-4 shadow-sm cursor-pointer hover:shadow-md transition transform hover:scale-[1.01]
                          ${agendamento.status === 'PENDENTE' ? 'bg-yellow-50 border-yellow-500 text-yellow-900' : ''}
                          ${agendamento.status === 'CONFIRMADO' ? 'bg-blue-50 border-blue-500 text-blue-900' : ''}
                          ${agendamento.status === 'PRESENTE' ? 'bg-emerald-100 border-emerald-600 text-emerald-900' : ''}
                          ${agendamento.status === 'EM_ATENDIMENTO' ? 'bg-blue-600 border-blue-800 text-white animate-pulse' : ''}
                          ${agendamento.status === 'CONCLUIDO' ? 'bg-gray-100 border-gray-400 text-gray-500 opacity-75' : ''}
                          ${agendamento.status === 'CANCELADO' ? 'bg-red-50 border-red-500 text-red-900 line-through opacity-50' : ''}
                        `}>
                          <div className="font-black truncate uppercase">{agendamento.paciente_nome}</div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="font-bold opacity-70">{agendamento.status.replace('_', ' ')}</span>
                            {agendamento.status === 'PENDENTE' && <span className="animate-bounce">🔔</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm">LIVRE +</span>
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
