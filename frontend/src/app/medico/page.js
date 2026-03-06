'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { format } from 'date-fns';

export default function MedicoPage() {
  const [medicos, setMedicos] = useState([]);
  const [selectedMedico, setSelectedMedico] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  });
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Estados para Atraso
  const [modalAtrasoOpen, setModalAtrasoOpen] = useState(false);
  const [tempoAtraso, setTempoAtraso] = useState(15);


  // Estados para Histórico
  const [modalHistoricoOpen, setModalHistoricoOpen] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [pacienteHistoricoNome, setPacienteHistoricoNome] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-agendamento.primeatende.com.br';

  useEffect(() => {
    // Carregar lista de médicos para seleção (simulando login)
    axios.get(`${API_URL}/api/medicos`)
      .then(res => setMedicos(res.data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (!selectedMedico) return;

    fetchAgendamentos();
    const socket = io(API_URL);

    // Escutar atualizações gerais (ex: recepção confirmou alguém)
    socket.on('agendamento-confirmado', () => fetchAgendamentos());
    socket.on('agendamento-atualizado', () => fetchAgendamentos());
    socket.on('novo-agendamento', () => fetchAgendamentos());

    return () => socket.disconnect();
  }, [selectedMedico, selectedDate]);

  const fetchAgendamentos = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/agendamentos/medico/${selectedMedico}?data=${selectedDate}`);
      setAgendamentos(res.data);
    } catch (error) {
      console.error('Erro ao buscar agenda:', error);
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatus = async (id, novoStatus) => {
    try {
      await axios.put(`${API_URL}/api/agendamentos/${id}/status`, { status: novoStatus });
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: novoStatus } : a));
    } catch (error) {
      alert('Erro ao atualizar status');
    }
  };

  const enviarAtraso = async () => {
    if (!confirm(`Confirma enviar aviso de atraso de ${tempoAtraso} min para todos os pacientes da fila?`)) return;
    try {
      await axios.post(`${API_URL}/api/medicos/${selectedMedico}/atraso`, { minutos: tempoAtraso });
      alert('Avisos enviados com sucesso!');
      setModalAtrasoOpen(false);
    } catch (error) {
      alert('Erro ao enviar avisos: ' + (error.response?.data?.erro || error.message));
    }
  };

  const abrirHistorico = async (pacienteId, nome) => {
    setPacienteHistoricoNome(nome);
    setModalHistoricoOpen(true);
    setHistorico([]); // Limpa anterior
    try {
      const res = await axios.get(`${API_URL}/api/agendamentos/paciente/${pacienteId}/historico`);
      setHistorico(res.data);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  // Filtrar apenas agendamentos relevantes para o fluxo do dia
  // Encaixe urgente aparece primeiro na fila
  const fila = agendamentos
    .filter(a => ['CONFIRMADO', 'PRESENTE', 'EM_ATENDIMENTO', 'AUSENTE', 'CONCLUIDO'].includes(a.status))
    .sort((a, b) => {
      // EM_ATENDIMENTO sempre primeiro
      if (a.status === 'EM_ATENDIMENTO') return -1;
      if (b.status === 'EM_ATENDIMENTO') return 1;
      // CONCLUIDO sempre por último
      if (a.status === 'CONCLUIDO') return 1;
      if (b.status === 'CONCLUIDO') return -1;
      // ENCAIXE sobe para o topo dos pendentes
      if (a.tipo_consulta === 'ENCAIXE' && b.tipo_consulta !== 'ENCAIXE') return -1;
      if (b.tipo_consulta === 'ENCAIXE' && a.tipo_consulta !== 'ENCAIXE') return 1;
      // Demais ordenam por horário
      return a.horario.localeCompare(b.horario);
    });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header / Seleção de Médico e Data */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8 bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <img src="/logo.png" alt="Logo" className="h-12 w-auto" />
            <h1 className="text-2xl font-bold text-gray-800 whitespace-nowrap border-l pl-4 border-gray-200">Painel Médico</h1>
            <select 
              value={selectedMedico}
              onChange={(e) => setSelectedMedico(e.target.value)}
              className="p-2 border rounded border-gray-300 text-gray-700 w-full md:w-auto"
            >
              <option value="">Selecione seu perfil...</option>
              {medicos.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
             <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-2 border rounded border-gray-300 text-gray-700 flex-1"
            />
            {selectedMedico && (
              <button
                onClick={() => setModalAtrasoOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 rounded text-sm whitespace-nowrap"
              >
                ⏱️ Avisar Atraso
              </button>
            )}
          </div>
        </div>

        {/* MODAL ATRASO */}
        {modalAtrasoOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Informar Atraso na Agenda</h3>
              <p className="text-sm text-gray-600 mb-4">Isso enviará um WhatsApp para todos os pacientes aguardando.</p>
              
              <div className="flex gap-2 mb-4">
                {[10, 15, 30, 45, 60].map(m => (
                  <button 
                    key={m}
                    onClick={() => setTempoAtraso(m)}
                    className={`flex-1 py-2 rounded font-bold border ${tempoAtraso === m ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-300'}`}
                  >
                    {m}m
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-600 mb-1">Outro tempo (minutos)</label>
                <input 
                  type="number" 
                  value={tempoAtraso} 
                  onChange={(e) => setTempoAtraso(Number(e.target.value))}
                  className="w-full p-2 border rounded border-gray-300 text-gray-900 font-bold text-center"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={enviarAtraso} className="flex-1 bg-orange-600 text-white py-2 rounded font-bold">ENVIAR AVISO</button>
                <button onClick={() => setModalAtrasoOpen(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded font-bold">CANCELAR</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL HISTORICO */}
        {modalHistoricoOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="p-6 border-b flex justify-between items-center bg-blue-50 rounded-t-xl">
                <div>
                  <h3 className="font-bold text-xl text-blue-900">Histórico Clínico</h3>
                  <p className="text-blue-700">{pacienteHistoricoNome}</p>
                </div>
                <button onClick={() => setModalHistoricoOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                {historico.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Nenhum atendimento anterior encontrado.</p>
                ) : (
                  <ul className="space-y-4">
                    {historico.map(h => (
                      <li key={h.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex justify-between mb-2">
                          <span className="font-bold text-gray-800">{new Date(h.data_consulta).toLocaleDateString('pt-BR')}</span>
                          <span className="text-sm bg-green-100 text-green-700 px-2 rounded-full">{h.medico_nome}</span>
                        </div>
                        {h.prontuario_path ? (
                          <a 
                            href={`${API_URL}/${h.prontuario_path.replace(/\\/g, '/')}`} 
                            target="_blank" 
                            className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-2"
                          >
                            📄 Ver Prontuario/Receita (PDF)
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sem anexo</span>
                        )}
                        {h.observacoes && (
                           <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">"{h.observacoes}"</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedMedico ? (
          <div className="text-center text-gray-500 mt-20">
            Selecione seu perfil acima para visualizar sua agenda.
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Status: EM ATENDIMENTO (Destaque) */}
            {fila.find(a => a.status === 'EM_ATENDIMENTO') && (
              <div className="bg-blue-600 text-white rounded-xl shadow-lg p-6 mb-8 transform scale-105 border-4 border-blue-400 relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                  <div className="text-center md:text-left">
                    <p className="text-blue-100 text-sm uppercase tracking-wide font-bold mb-1">Em Atendimento</p>
                    <h2 className="text-4xl font-bold mb-2">
                      {fila.find(a => a.status === 'EM_ATENDIMENTO').paciente_nome}
                    </h2>
                    <button 
                      onClick={() => abrirHistorico(fila.find(a => a.status === 'EM_ATENDIMENTO').paciente_id, fila.find(a => a.status === 'EM_ATENDIMENTO').paciente_nome)}
                      className="text-white text-sm bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded-full flex items-center gap-1 mx-auto md:mx-0 w-fit"
                    >
                      📋 Ver Histórico Completo
                    </button>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                    <label className="w-full md:w-auto bg-white text-blue-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-xl shadow-lg transition transform hover:scale-105 cursor-pointer text-center flex flex-col items-center gap-1">
                      <span className="text-lg">📤 FINALIZAR</span>
                      <span className="text-xs font-normal opacity-80">(Anexar PDF e Enviar)</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            if(confirm(`Deseja finalizar o atendimento de ${fila.find(a => a.status === 'EM_ATENDIMENTO').paciente_nome} e enviar este arquivo?`)) {
                              const formData = new FormData();
                              formData.append('file', e.target.files[0]);
                              const id = fila.find(a => a.status === 'EM_ATENDIMENTO').id;

                              setLoading(true);
                              axios.post(`${API_URL}/api/agendamentos/${id}/prontuario`, formData)
                                .then(() => {
                                  alert('Atendimento finalizado e PDF enviado!');
                                  fetchAgendamentos();
                                })
                                .catch(err => alert('Erro ao enviar: ' + err.message))
                                .finally(() => setLoading(false));
                            }
                          }
                        }}
                      />
                    </label>
                    <button
                      onClick={() => atualizarStatus(fila.find(a => a.status === 'EM_ATENDIMENTO').id, 'CONCLUIDO')}
                      className="text-white text-sm underline hover:text-blue-200 mt-2"
                    >
                      Finalizar sem arquivo
                    </button>
                    <button
                      onClick={() => {
                        const pac = fila.find(a => a.status === 'EM_ATENDIMENTO');
                        if (confirm(`Marcar ${pac.paciente_nome} como AUSENTE? O paciente receberá um aviso pelo WhatsApp.`))
                          atualizarStatus(pac.id, 'AUSENTE');
                      }}
                      className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl shadow transition text-sm"
                    >
                      😕 PACIENTE AUSENTE
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista da Fila */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Fila de {format(new Date(selectedDate), 'dd/MM/yyyy')}</h3>
                <span className="text-sm text-gray-500">{fila.length} pacientes</span>
              </div>
              
              {loading ? (
                <div className="p-6 text-center text-gray-500">Carregando...</div>
              ) : fila.length === 0 ? (
                <div className="p-6 text-center text-gray-500">Nenhum paciente na fila.</div>
              ) : (
                <ul>
                  {fila
                    .filter(a => a.status !== 'EM_ATENDIMENTO') // Remove o que já está em destaque
                    .map((agendamento) => (
                    <li key={agendamento.id} className={`border-b border-gray-100 p-6 flex items-center justify-between hover:bg-gray-50 transition
                      ${agendamento.status === 'CONCLUIDO' ? 'opacity-50 bg-gray-50' : ''}
                      ${agendamento.tipo_consulta === 'ENCAIXE' ? 'bg-red-50 border-l-4 border-red-500' : ''}`}>

                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <span className="block text-xl font-bold text-gray-800">{agendamento.horario.slice(0, 5)}</span>
                          {agendamento.tipo_consulta === 'ENCAIXE' && (
                            <span className="text-xs font-bold text-red-600 bg-red-100 px-1 rounded">🚨 URGENTE</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-lg text-gray-900">{agendamento.paciente_nome}</p>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            agendamento.status === 'CONFIRMADO' ? 'bg-yellow-100 text-yellow-800' :
                            agendamento.status === 'PRESENTE' ? 'bg-green-100 text-green-800' :
                            agendamento.status === 'AUSENTE' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-200 text-gray-600'
                          }`}>
                            {agendamento.status === 'AUSENTE' ? '😕 AUSENTE' : agendamento.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        {/* Botão CHEGOU removido a pedido. A recepção que faz isso. */}
                        
                        {(agendamento.status === 'PRESENTE' || agendamento.status === 'CONFIRMADO') && (
                          <button
                            onClick={() => atualizarStatus(agendamento.id, 'EM_ATENDIMENTO')}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded shadow"
                          >
                            CHAMAR
                          </button>
                        )}

                        {agendamento.status === 'AUSENTE' && (
                          <button
                            onClick={() => atualizarStatus(agendamento.id, 'EM_ATENDIMENTO')}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded shadow animate-pulse"
                          >
                            🔁 CHAMAR NOVAMENTE
                          </button>
                        )}
                        
                        {agendamento.status === 'CONCLUIDO' && (
                          <span className="text-green-600 font-medium flex items-center gap-2">
                             <button onClick={() => abrirHistorico(agendamento.paciente_id, agendamento.paciente_nome)} className="text-blue-500 text-xs underline">
                              Histórico
                             </button>
                             ✓ Atendido
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
