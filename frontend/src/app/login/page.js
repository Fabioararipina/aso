'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isAuthenticated, getUser } from '../../lib/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Se já está autenticado, redireciona conforme perfil
  useEffect(() => {
    if (isAuthenticated()) {
      const user = getUser();
      const dest = redirectParam || getDefaultRoute(user?.perfil);
      router.replace(dest);
    }
  }, [redirectParam, router]);

  function getDefaultRoute(perfil) {
    if (perfil === 'ADMIN') return '/admin/salas';
    if (perfil === 'RECEPCAO') return '/recepcao/aso';
    if (perfil === 'OPERADOR') return '/operador';
    return '/recepcao/aso';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Usuário ou senha inválidos.');

      localStorage.setItem('auth_token', data.token);

      const dest = redirectParam || getDefaultRoute(data.perfil);
      router.replace(dest);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3d7a52] to-[#2d5c3e] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        {/* Logo / Título */}
        <div className="text-center mb-8">
          <img src="/logo-aso.png" alt="ASO Saúde" className="h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-gray-800">ASO Saúde</h1>
          <p className="text-gray-400 text-sm mt-1">Medicina do Trabalho</p>
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
                         focus:outline-none focus:ring-2 focus:ring-[#3d7a52] focus:border-[#3d7a52] transition"
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
                         focus:outline-none focus:ring-2 focus:ring-[#3d7a52] focus:border-[#3d7a52] transition"
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
            className="w-full bg-[#3d7a52] hover:bg-[#2d5c3e] text-white font-bold py-3 px-4
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
