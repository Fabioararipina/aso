'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { format } from 'date-fns';

export default function RecepcaoPage() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Use environment variable or default to localhost:5000
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchAgendamentos();

    const socket = io(API_URL);

    socket.on('novo-agendamento', (novoAgendamento) => {
      // Adiciona à lista se não existir
      setAgendamentos((prev) => {
        if (prev.find(a => a.id === novoAgendamento.id)) return prev;
        return [...prev, novoAgendamento].sort((a, b) => new Date(a.data_consulta) - new Date(b.data_consulta));
      });
    });

    socket.on('agendamento-confirmado', ({ agendamento_id }) => {
      setAgendamentos((prev) => prev.filter(a => a.id !== parseInt(agendamento_id)));
    });

    socket.on('agendamento-cancelado', ({ agendamento_id }) => {
      setAgendamentos((prev) => prev.filter(a => a.id !== parseInt(agendamento_id)));
    });

    return () => socket.disconnect();
  }, []);

  const fetchAgendamentos = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/agendamentos/pendentes`);
      setAgendamentos(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setLoading(false);
    }
  };

  const handleConfirmar = async (id) => {
    if (!confirm('Confirmar este agendamento?')) return;
    try {
      await axios.put(`${API_URL}/api/agendamentos/${id}/confirmar`);
      // A lista será atualizada via socket, mas podemos otimizar removendo imediatamente
      setAgendamentos(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      alert('Erro ao confirmar agendamento');
    }
  };

  const handleRecusar = async (id) => {
    if (!confirm('Recusar/Cancelar este agendamento?')) return;
    try {
      await axios.put(`${API_URL}/api/agendamentos/${id}/cancelar`);
      setAgendamentos(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      alert('Erro ao recusar agendamento');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 bg-white p-6 rounded-xl shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">Painel da Recepção</h1>
          <p className="text-gray-600 mt-2">Gerencie os agendamentos pendentes em tempo real.</p>
        </header>

        {loading ? (
          <p className="text-center text-gray-600 animate-pulse">Carregando lista de espera...</p>
        ) : agendamentos.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">✓</div>
            <p className="text-xl text-gray-600 font-medium">Nenhum agendamento pendente no momento.</p>
            <p className="text-gray-400 text-sm mt-2">Novos pedidos aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {agendamentos.map((agendamento) => (
              <div key={agendamento.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-100">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-gray-900 leading-tight">{agendamento.paciente_nome}</h3>
                      <p className="text-sm text-gray-500 mt-1 font-mono">{agendamento.whatsapp}</p>
                    </div>
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Pendente
                    </span>
                  </div>
                  
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="flex items-center text-gray-700">
                      <span className="text-xs font-bold text-gray-400 uppercase w-16">Médico</span>
                      <span className="font-semibold text-gray-900">{agendamento.medico_nome}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <span className="text-xs font-bold text-gray-400 uppercase w-16">Data</span>
                      <span className="font-medium text-gray-900">{format(new Date(agendamento.data_consulta), 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <span className="text-xs font-bold text-gray-400 uppercase w-16">Horário</span>
                      <span className="font-medium text-gray-900">{agendamento.horario}</span>
                    </div>
                  </div>
                </div>

                <div className="flex border-t border-gray-100">
                  <button
                    onClick={() => handleConfirmar(agendamento.id)}
                    className="flex-1 bg-white hover:bg-green-50 text-green-600 font-bold py-4 px-4 transition border-r border-gray-100 hover:text-green-700"
                  >
                    CONFIRMAR
                  </button>
                  <button
                    onClick={() => handleRecusar(agendamento.id)}
                    className="flex-1 bg-white hover:bg-red-50 text-red-600 font-bold py-4 px-4 transition hover:text-red-700"
                  >
                    RECUSAR
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
