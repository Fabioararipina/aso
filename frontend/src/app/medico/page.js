'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { format } from 'date-fns';

export default function MedicoPage() {
  const [medicos, setMedicos] = useState([]);
  const [selectedMedico, setSelectedMedico] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
      // O socket vai atualizar a lista, mas podemos forçar visualmente para ser instantâneo
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: novoStatus } : a));
    } catch (error) {
      alert('Erro ao atualizar status');
    }
  };

  // Filtrar apenas agendamentos relevantes para o fluxo do dia
  const fila = agendamentos.filter(a => ['CONFIRMADO', 'PRESENTE', 'EM_ATENDIMENTO', 'CONCLUIDO'].includes(a.status));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header / Seleção de Médico e Data */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8 bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <h1 className="text-2xl font-bold text-gray-800 whitespace-nowrap">Painel Médico</h1>
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
          
          <div className="w-full md:w-auto">
             <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-2 border rounded border-gray-300 text-gray-700 w-full"
            />
          </div>
        </div>

        {!selectedMedico ? (
          <div className="text-center text-gray-500 mt-20">
            Selecione seu perfil acima para visualizar sua agenda.
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Status: EM ATENDIMENTO (Destaque) */}
            {fila.find(a => a.status === 'EM_ATENDIMENTO') && (
              <div className="bg-blue-600 text-white rounded-xl shadow-lg p-6 mb-8 transform scale-105 border-4 border-blue-400">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-blue-100 text-sm uppercase tracking-wide font-bold">Em Atendimento</p>
                    <h2 className="text-4xl font-bold mt-2">
                      {fila.find(a => a.status === 'EM_ATENDIMENTO').paciente_nome}
                    </h2>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <label className="bg-white text-blue-600 hover:bg-gray-100 font-bold py-3 px-8 rounded-full shadow-lg transition transform hover:scale-105 cursor-pointer">
                      <span>📤 FINALIZAR E ENVIAR PDF</span>
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
                      className="text-white text-sm underline hover:text-blue-200"
                    >
                      Finalizar sem arquivo
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
                    <li key={agendamento.id} className={`border-b border-gray-100 p-6 flex items-center justify-between hover:bg-gray-50 transition ${agendamento.status === 'CONCLUIDO' ? 'opacity-50 bg-gray-50' : ''}`}>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <span className="block text-xl font-bold text-gray-800">{agendamento.horario.slice(0, 5)}</span>
                        </div>
                        <div>
                          <p className="font-bold text-lg text-gray-900">{agendamento.paciente_nome}</p>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            agendamento.status === 'CONFIRMADO' ? 'bg-yellow-100 text-yellow-800' :
                            agendamento.status === 'PRESENTE' ? 'bg-green-100 text-green-800' :
                            'bg-gray-200 text-gray-600'
                          }`}>
                            {agendamento.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        {agendamento.status === 'CONFIRMADO' && (
                          <button 
                            onClick={() => atualizarStatus(agendamento.id, 'PRESENTE')}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded"
                          >
                            Chegou
                          </button>
                        )}
                        
                        {agendamento.status === 'PRESENTE' && (
                          <button 
                            onClick={() => atualizarStatus(agendamento.id, 'EM_ATENDIMENTO')}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded shadow"
                          >
                            CHAMAR
                          </button>
                        )}
                        
                        {agendamento.status === 'CONCLUIDO' && (
                          <span className="text-green-600 font-medium flex items-center">
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
