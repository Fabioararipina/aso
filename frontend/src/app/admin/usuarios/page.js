'use client';

import { useState, useEffect } from 'react';
import { getToken } from '../../../lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PERFIS = ['ADMIN', 'RECEPCAO', 'OPERADOR'];

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [salas, setSalas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', usuario: '', senha: '', perfil: 'RECEPCAO', sala_id: '' });
  const [salvando, setSalvando] = useState(false);

  const headers = { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const [resU, resS] = await Promise.all([
        fetch(`${API_URL}/api/auth/usuarios`, { headers }),
        fetch(`${API_URL}/api/salas`, { headers }),
      ]);
      if (!resU.ok) throw new Error('Erro ao carregar usuários.');
      setUsuarios(await resU.json());
      if (resS.ok) setSalas(await resS.json());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleCriar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      const body = { ...form, sala_id: form.sala_id || null };
      const res = await fetch(`${API_URL}/api/auth/usuarios`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar usuário.');
      setSucesso(`Usuário "${form.usuario}" criado com sucesso.`);
      setForm({ nome: '', usuario: '', senha: '', perfil: 'RECEPCAO', sala_id: '' });
      setShowForm(false);
      carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleDesativar(id, nome) {
    if (!confirm(`Desativar o usuário "${nome}"?`)) return;
    setErro('');
    setSucesso('');
    try {
      const res = await fetch(`${API_URL}/api/auth/usuarios/${id}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao desativar usuário.');
      }
      setSucesso(`Usuário "${nome}" desativado.`);
      carregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  function nomeSala(sala_id) {
    if (!sala_id) return '—';
    const s = salas.find(s => s.id === sala_id);
    return s ? s.nome : sala_id;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Usuários do Sistema</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os acessos ao ASO Saúde</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setErro(''); setSucesso(''); }}
          className="bg-[#5b8dfd] hover:bg-[#4a7ecc] text-white font-bold px-5 py-2.5 rounded-xl shadow transition"
        >
          {showForm ? 'Cancelar' : '+ Novo Usuário'}
        </button>
      </div>

      {/* Feedback */}
      {erro && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{erro}</div>
      )}
      {sucesso && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">{sucesso}</div>
      )}

      {/* Formulário de criação */}
      {showForm && (
        <form onSubmit={handleCriar} className="bg-white rounded-2xl shadow p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-700 mb-4">Novo Usuário</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome completo</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b8dfd]"
                placeholder="Ex: João da Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Login (usuário)</label>
              <input
                type="text"
                required
                value={form.usuario}
                onChange={e => setForm({ ...form, usuario: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b8dfd]"
                placeholder="Ex: joao.silva"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                required
                minLength={4}
                value={form.senha}
                onChange={e => setForm({ ...form, senha: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b8dfd]"
                placeholder="Mínimo 4 caracteres"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Perfil</label>
              <select
                value={form.perfil}
                onChange={e => setForm({ ...form, perfil: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b8dfd]"
              >
                {PERFIS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Sala associada (opcional)</label>
              <select
                value={form.sala_id}
                onChange={e => setForm({ ...form, sala_id: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b8dfd]"
              >
                <option value="">Nenhuma</option>
                {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={salvando}
              className="bg-[#5b8dfd] hover:bg-[#4a7ecc] disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl shadow transition"
            >
              {salvando ? 'Salvando...' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      )}

      {/* Tabela de usuários */}
      <div className="bg-white rounded-2xl shadow overflow-hidden border border-gray-100">
        {carregando ? (
          <div className="p-10 text-center text-gray-400">Carregando...</div>
        ) : usuarios.length === 0 ? (
          <div className="p-10 text-center text-gray-400">Nenhum usuário encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                <th className="px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Nome</th>
                <th className="px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Usuário</th>
                <th className="px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Perfil</th>
                <th className="px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Sala</th>
                <th className="px-5 py-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => (
                <tr key={u.id} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">{u.nome}</td>
                  <td className="px-5 py-3 text-gray-600 font-mono">{u.usuario}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full
                      ${u.perfil === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                        u.perfil === 'RECEPCAO' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'}`}>
                      {u.perfil}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{nomeSala(u.sala_id)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full
                      ${u.ativo !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.ativo !== false && (
                      <button
                        onClick={() => handleDesativar(u.id, u.nome)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition"
                      >
                        Desativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
