'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const PERFIS = ['ADMIN', 'RECEPCAO', 'MEDICO'];

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulário novo usuário
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState('RECEPCAO');
  const [medicoId, setMedicoId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [sucessoForm, setSucessoForm] = useState('');

  // Troca de senha
  const [trocandoSenhaId, setTrocandoSenhaId] = useState(null);
  const [novaSenha, setNovaSenha] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-agendamento.primeatende.com.br';

  useEffect(() => {
    fetchUsuarios();
    fetchMedicos();
  }, []);

  async function fetchUsuarios() {
    try {
      const res = await axios.get(`${API_URL}/auth/usuarios`);
      setUsuarios(res.data.filter(u => u.perfil !== 'TV'));
    } catch (err) {
      console.error('Erro ao buscar usuários', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMedicos() {
    try {
      const res = await axios.get(`${API_URL}/api/medicos`);
      setMedicos(res.data);
    } catch (err) {
      console.error('Erro ao buscar médicos', err);
    }
  }

  async function handleCriar(e) {
    e.preventDefault();
    setErroForm('');
    setSucessoForm('');
    setSalvando(true);
    try {
      await axios.post(`${API_URL}/auth/usuarios`, {
        nome,
        usuario,
        senha,
        perfil,
        medico_id: perfil === 'MEDICO' && medicoId ? parseInt(medicoId) : null,
      });
      setSucessoForm(`Usuário "${usuario}" criado com sucesso!`);
      setNome(''); setUsuario(''); setSenha(''); setPerfil('RECEPCAO'); setMedicoId('');
      fetchUsuarios();
    } catch (err) {
      setErroForm(err.response?.data?.error || 'Erro ao criar usuário.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleTrocarSenha(id) {
    if (!novaSenha || novaSenha.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    try {
      await axios.put(`${API_URL}/auth/usuarios/${id}/senha`, { senha: novaSenha });
      alert('Senha alterada com sucesso!');
      setTrocandoSenhaId(null);
      setNovaSenha('');
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao trocar senha.');
    }
  }

  async function handleDesativar(id, nomeUsuario) {
    if (!confirm(`Desativar o usuário "${nomeUsuario}"? Ele não conseguirá mais fazer login.`)) return;
    try {
      await axios.delete(`${API_URL}/auth/usuarios/${id}`);
      fetchUsuarios();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao desativar usuário.');
    }
  }

  const perfilBadge = (p) => {
    if (p === 'ADMIN') return 'bg-red-100 text-red-700';
    if (p === 'RECEPCAO') return 'bg-blue-100 text-blue-700';
    if (p === 'MEDICO') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Usuários do Sistema</h1>

      <div className="grid md:grid-cols-2 gap-8">

        {/* FORMULÁRIO */}
        <div className="bg-white rounded-xl shadow p-6 h-fit">
          <h2 className="text-xl font-bold text-gray-700 mb-4">Novo Usuário</h2>
          <form onSubmit={handleCriar} className="space-y-4">

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Nome completo</label>
              <input
                required value={nome} onChange={e => setNome(e.target.value)}
                placeholder="Ex: Maria da Silva"
                className="w-full border rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Login (usuário)</label>
              <input
                required value={usuario} onChange={e => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))}
                placeholder="Ex: maria.silva"
                className="w-full border rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Senha inicial</label>
              <input
                required type="password" value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                className="w-full border rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Perfil</label>
              <div className="flex gap-2">
                {PERFIS.map(p => (
                  <button
                    key={p} type="button" onClick={() => setPerfil(p)}
                    className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${perfil === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {p === 'ADMIN' ? 'Admin' : p === 'RECEPCAO' ? 'Recepção' : 'Médico'}
                  </button>
                ))}
              </div>
            </div>

            {perfil === 'MEDICO' && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Médico vinculado</label>
                <select
                  value={medicoId} onChange={e => setMedicoId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— Selecione o médico —</option>
                  {medicos.map(m => (
                    <option key={m.id} value={m.id}>{m.nome} — {m.especialidade}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Opcional: vincula o login ao painel do médico correspondente.</p>
              </div>
            )}

            {erroForm && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erroForm}</p>}
            {sucessoForm && <p className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">{sucessoForm}</p>}

            <button
              type="submit" disabled={salvando}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-60"
            >
              {salvando ? 'Criando...' : 'Criar usuário'}
            </button>
          </form>
        </div>

        {/* LISTA */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold text-gray-700 mb-4">Usuários cadastrados</h2>

          {loading ? (
            <p className="text-gray-400 text-sm">Carregando...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum usuário cadastrado.</p>
          ) : (
            <ul className="space-y-3">
              {usuarios.map(u => (
                <li key={u.id} className={`border rounded-xl p-4 ${!u.ativo ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-800">{u.nome}</p>
                      <p className="text-sm text-gray-500">@{u.usuario}</p>
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${perfilBadge(u.perfil)}`}>
                        {u.perfil === 'RECEPCAO' ? 'Recepção' : u.perfil}
                      </span>
                      {!u.ativo && <span className="ml-2 text-xs text-red-400 font-semibold">Desativado</span>}
                    </div>

                    {u.ativo && (
                      <div className="flex flex-col gap-1 text-right">
                        <button
                          onClick={() => { setTrocandoSenhaId(trocandoSenhaId === u.id ? null : u.id); setNovaSenha(''); }}
                          className="text-blue-500 text-xs font-semibold hover:underline"
                        >
                          Trocar senha
                        </button>
                        <button
                          onClick={() => handleDesativar(u.id, u.usuario)}
                          className="text-red-400 text-xs font-semibold hover:underline"
                        >
                          Desativar
                        </button>
                      </div>
                    )}
                  </div>

                  {trocandoSenhaId === u.id && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="password"
                        value={novaSenha}
                        onChange={e => setNovaSenha(e.target.value)}
                        placeholder="Nova senha (mín. 6 chars)"
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <button
                        onClick={() => handleTrocarSenha(u.id)}
                        className="bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg"
                      >
                        Salvar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
