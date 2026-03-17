'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';
import { isAuthenticated, getToken, logout } from '../lib/auth';

// Configura o header de autorização do axios para todas as chamadas
// (executado durante o render, antes dos useEffect dos filhos)
function setupAxios() {
  const token = getToken();
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

// Interceptor de resposta: redireciona para login em caso de 401
let interceptorRegistered = false;
function setupInterceptor(router) {
  if (interceptorRegistered) return;
  interceptorRegistered = true;
  axios.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error.response?.status === 401) {
        logout();
        delete axios.defaults.headers.common['Authorization'];
        router.replace('/login');
      }
      return Promise.reject(error);
    }
  );
}

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [autenticado, setAutenticado] = useState(false);

  // Configura axios durante o render (síncrono, antes dos effects dos filhos)
  setupAxios();

  useEffect(() => {
    setupInterceptor(router);

    if (!isAuthenticated()) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else {
      setAutenticado(true);
    }
  }, [pathname, router]);

  if (!autenticado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Verificando acesso...</div>
      </div>
    );
  }

  return <>{children}</>;
}
