'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminMedicosPage() {
  const [medicos, setMedicos] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [nome, setNome] = useState('');
  const [crm, setCrm] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [foto, setFoto] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.20.19:5000';

  useEffect(() => {
    fetchMedicos();
  }, []);

  const fetchMedicos = () => {
    setError(null);
    axios.get(`${API_URL}/api/medicos`)
      .then(res => {
        console.log('Medicos loaded:', res.data);
        setMedicos(res.data);
      })
      .catch(err => {
        console.error('Error loading medicos:', err);
        setError('Erro ao carregar médicos: ' + (err.response?.data?.erro || err.message));
      });
  };

  const handleEdit = (medico) => {
    setEditingId(medico.id);
    setNome(medico.nome);
    setCrm(medico.crm);
    setEspecialidade(medico.especialidade);
    setFoto(null); // Reseta o input de arquivo
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Sobe para o form
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNome('');
    setCrm('');
    setEspecialidade('');
    setFoto(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome || !especialidade || !crm) return alert('Preencha os campos obrigatórios');
    
    const formData = new FormData();
    formData.append('nome', nome);
    formData.append('crm', crm);
    formData.append('especialidade', especialidade);
    if (foto) {
      formData.append('foto', foto);
    }

    try {
      if (editingId) {
        // ATUALIZAR
        await axios.put(`${API_URL}/api/medicos/${editingId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Médico atualizado!');
      } else {
        // CRIAR
        await axios.post(`${API_URL}/api/medicos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Médico cadastrado!');
      }
      
      fetchMedicos();
      handleCancelEdit();
    } catch (error) {
      alert('Erro: ' + error.message);
    }
  };

  const handleRemove = async (id, nome) => {
    if (!confirm(`Tem certeza que deseja remover ${nome}? Isso apagará a grade de horários dele também.`)) return;
    try {
      await axios.delete(`${API_URL}/api/medicos/${id}`);
      fetchMedicos();
    } catch (error) {
      alert('Erro: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Gestão de Equipe Médica</h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* FORMULÁRIO */}
          <div className="bg-white p-6 rounded-xl shadow h-fit border-t-4 border-blue-500">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-700">
                {editingId ? 'Editar Profissional' : 'Novo Profissional'}
              </h2>
              {editingId && (
                <button onClick={handleCancelEdit} className="text-sm text-red-500 hover:underline">
                  Cancelar Edição
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Foto {editingId && '(Deixe vazio para manter)'}</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => setFoto(e.target.files[0])}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Dr. João Silva"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">CRM (Registro)</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 12345/PE"
                  value={crm}
                  onChange={e => setCrm(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Especialidade</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Cardiologista"
                  value={especialidade}
                  onChange={e => setEspecialidade(e.target.value)}
                />
              </div>
              <button className={`w-full text-white py-3 rounded-lg font-bold transition ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {editingId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR'}
              </button>
            </form>
          </div>

          {/* LISTA */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-700">Equipe Atual ({medicos.length})</h2>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                <strong className="font-bold">Ops! </strong>
                <span className="block sm:inline">{error}</span>
                <p className="text-xs mt-1">Tentando conectar em: {API_URL}</p>
              </div>
            )}

            {medicos.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum médico cadastrado.</p>
            ) : (
              <ul className="space-y-3">
                {medicos.map(m => (
                  <li key={m.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100 group hover:border-blue-200 transition">
                    <div className="flex items-center space-x-3">
                      {m.foto_path ? (
                        <img 
                          src={`${API_URL}/uploads/medicos/${m.foto_path}`} 
                          alt={m.nome} 
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                          👨‍⚕️
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-gray-800 block">{m.nome}</span>
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-blue-600 font-medium">{m.especialidade}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500">CRM {m.crm}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEdit(m)}
                        className="text-gray-400 hover:text-blue-500 p-2 transition"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleRemove(m.id, m.nome)}
                        className="text-gray-400 hover:text-red-500 p-2 transition"
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
