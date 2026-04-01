'use client';

const TOKEN_KEY = 'auth_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Verifica expiração
    if (payload.exp * 1000 < Date.now()) {
      logout();
      return null;
    }
    return payload; // { id, usuario, perfil, nome, medico_id }
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return getUser() !== null;
}

export async function login(usuario, senha) {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://api-aso.primeatende.com.br');

  const res = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao fazer login.');

  localStorage.setItem(TOKEN_KEY, data.token);
  return data; // { token, perfil, nome }
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
