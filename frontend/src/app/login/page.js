'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, isAuthenticated } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/portal';

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Se já está autenticado, redireciona
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace(redirect);
    }
  }, [redirect, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      await login(usuario, senha);
      router.replace(redirect);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5b8dfd] to-[#4a7ecc] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        {/* Logo / Título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#5b8dfd] to-[#4a7ecc] rounded-2xl mb-4 shadow-lg">
            <span className="text-2xl">🏥</span>
          </div>
          <h1 className="text-2xl font-black text-gray-800">Essencial Saúde</h1>
          <p className="text-gray-400 text-sm mt-1">Painel de Gestão</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Usuário
            </label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Digite seu usuário"
              required
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-[#5b8dfd] focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-[#5b8dfd] focus:border-transparent transition"
            />
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-gradient-to-r from-[#5b8dfd] to-[#4a7ecc] text-white font-bold py-3 px-4
                       rounded-xl shadow-lg hover:shadow-xl transition-all duration-200
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Acesso restrito a colaboradores autorizados
        </p>
      </div>
    </div>
  );
}
