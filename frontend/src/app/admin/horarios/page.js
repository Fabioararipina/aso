'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminHorariosPage() {
  const [medicos, setMedicos] = useState([]);
  const [selectedMedico, setSelectedMedico] = useState('');
  const [horarios, setHorarios] = useState([]);
  
  const [tipoAgendamento, setTipoAgendamento] = useState('recorrente'); // 'recorrente' ou 'data'
  const [form, setForm] = useState({ dia_semana: '1', data_especifica: '', hora_inicio: '08:00', hora_fim: '12:00', duracao: '30' });

  // Use environment variable or default to localhost:5000
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.20.19:5000';

  useEffect(() => {
    axios.get(`${API_URL}/api/medicos`).then(res => setMedicos(res.data));
  }, []);

  useEffect(() => {
    if (selectedMedico) {
      axios.get(`${API_URL}/api/medicos/${selectedMedico}/horarios`)
        .then(res => setHorarios(res.data));
    }
  }, [selectedMedico]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedMedico) return alert('Selecione um médico');
    
    // Limpa dados irrelevantes baseado no tipo
    const payload = { ...form };
    if (tipoAgendamento === 'recorrente') {
      delete payload.data_especifica;
    } else {
      delete payload.dia_semana;
      if (!payload.data_especifica) return alert('Selecione uma data');
    }

    try {
      await axios.post(`${API_URL}/api/medicos/${selectedMedico}/horarios`, payload);
      const res = await axios.get(`${API_URL}/api/medicos/${selectedMedico}/horarios`);
      setHorarios(res.data);
      alert('Horário adicionado!');
    } catch (error) {
      alert('Erro: ' + error.message);
    }
  };

  const handleRemove = async (id) => {
    if (!confirm('Remover este horário?')) return;
    try {
      await axios.delete(`${API_URL}/api/medicos/horarios/${id}`);
      setHorarios(prev => prev.filter(h => h.id !== id));
    } catch (error) {
      alert('Erro: ' + error.message);
    }
  };

  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Configurar Grade de Horários</h1>
        
        <div className="mb-8">
          <label className="block text-gray-700 font-bold mb-2">Selecione o Médico</label>
          <select 
            className="w-full p-3 border rounded-lg text-gray-900"
            value={selectedMedico}
            onChange={(e) => { setSelectedMedico(e.target.value); setHorarios([]); }}
          >
            <option value="">-- Selecione --</option>
            {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>

        {selectedMedico && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* FORMULÁRIO */}
            <div className="bg-gray-50 p-6 rounded-lg border">
              <h2 className="text-xl font-bold mb-4 text-gray-700">Adicionar Turno</h2>
              
              {/* Toggle Tipo */}
              <div className="flex bg-gray-200 rounded p-1 mb-4">
                <button 
                  type="button"
                  className={`flex-1 py-1 rounded text-sm font-bold ${tipoAgendamento === 'recorrente' ? 'bg-white shadow' : 'text-gray-600'}`}
                  onClick={() => setTipoAgendamento('recorrente')}
                >
                  Semanal (Padrão)
                </button>
                <button 
                  type="button"
                  className={`flex-1 py-1 rounded text-sm font-bold ${tipoAgendamento === 'data' ? 'bg-white shadow' : 'text-gray-600'}`}
                  onClick={() => setTipoAgendamento('data')}
                >
                  Data Específica
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                
                {tipoAgendamento === 'recorrente' ? (
                  <div>
                    <label className="block text-sm text-gray-600">Dia da Semana</label>
                    <select 
                      className="w-full p-2 border rounded text-gray-900"
                      value={form.dia_semana}
                      onChange={e => setForm({...form, dia_semana: e.target.value})}
                    >
                      {dias.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm text-gray-600">Data Exata</label>
                    <input 
                      type="date" 
                      className="w-full p-2 border rounded text-gray-900"
                      value={form.data_especifica}
                      onChange={e => setForm({...form, data_especifica: e.target.value})}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600">Início</label>
                    <input 
                      type="time" 
                      className="w-full p-2 border rounded text-gray-900"
                      value={form.hora_inicio}
                      onChange={e => setForm({...form, hora_inicio: e.target.value})}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600">Fim</label>
                    <input 
                      type="time" 
                      className="w-full p-2 border rounded text-gray-900"
                      value={form.hora_fim}
                      onChange={e => setForm({...form, hora_fim: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600">Duração (minutos)</label>
                  <input 
                    type="number" 
                    min="5"
                    step="5"
                    className="w-full p-2 border rounded text-gray-900"
                    value={form.duracao}
                    onChange={e => setForm({...form, duracao: e.target.value})}
                  />
                </div>

                <button className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">
                  ADICIONAR
                </button>
              </form>
            </div>

            {/* LISTA */}
            <div>
              <h2 className="text-xl font-bold mb-4 text-gray-700">Horários Cadastrados</h2>
              {horarios.length === 0 ? (
                <p className="text-gray-500">Nenhum horário definido.</p>
              ) : (
                <ul className="space-y-2 max-h-[400px] overflow-y-auto">
                  {horarios.map(h => (
                    <li key={h.id} className={`flex justify-between items-center bg-white border p-3 rounded shadow-sm ${h.data_especifica ? 'border-l-4 border-l-orange-500' : ''}`}>
                      <div>
                        {h.data_especifica ? (
                          <span className="font-bold text-orange-600 block">
                            📅 {new Date(h.data_especifica).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="font-bold text-gray-800 block">🔄 {dias[h.dia_semana]}</span>
                        )}
                        <span className="text-sm text-gray-600">{h.hora_inicio.slice(0,5)} às {h.hora_fim.slice(0,5)}</span>
                        <span className="text-xs text-blue-600 block mt-1">⏱️ Intervalo: {h.duracao_consulta || 30} min</span>
                      </div>
                      <button 
                        onClick={() => handleRemove(h.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-bold"
                      >
                        Remover
                      </button>
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
