'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, logout } from '../lib/auth';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  const menuItems = [
    { name: 'Portal Início', path: '/portal', icon: '🏠' },
    { name: 'Recepção (Agenda)', path: '/recepcao/calendario', icon: '📅' },
    { name: 'Lista de Pendentes', path: '/recepcao', icon: '📝' },
    { name: 'Painel Médico', path: '/medico', icon: '👨‍⚕️' },
    { name: 'TV Espera', path: '/tv', icon: '📺' },
    { name: 'Equipe Médica', path: '/admin/medicos', icon: '📋' },
    { name: 'Admin Horários', path: '/admin/horarios', icon: '⏰' },
        {name: 'Configurar TV', path: '/admin/tv', icon: '🖥️' },
        { name: 'Relatórios e Métricas', path: '/admin/metricas', icon: '📊' },
    { name: 'Usuários do Sistema', path: '/admin/usuarios', icon: '👥' },
        { name: 'Admin WhatsApp', path: '/admin', icon: '💬' },
      ];

  // Não exibe layout na TV ou login (futuro)
  if (pathname === '/tv') return children;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      
      {/* SIDEBAR MOBILE / DESKTOP */}
      <aside className="bg-gradient-to-b from-[#5b8dfd] to-[#4a7ecc] text-white w-full md:w-64 flex-shrink-0 shadow-xl">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-2xl font-black tracking-tight">Essencial Saúde</h1>
          <p className="text-blue-100 text-xs font-medium opacity-80">Sistema de Gestão Inteligente</p>
        </div>
        
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`flex items-center space-x-3 p-3 rounded-xl transition duration-200 group
                  ${isActive ? 'bg-white text-[#5b8dfd] shadow-lg font-bold' : 'text-blue-50 hover:bg-white/10 hover:text-white'}
                `}
              >
                <span className={`text-xl ${isActive ? 'scale-110' : 'group-hover:scale-110 transition'}`}>{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-white/10 space-y-3">
          {/* Usuário logado */}
          {user && (
            <div className="px-1">
              <p className="text-blue-100 text-xs font-medium opacity-70">Logado como</p>
              <p className="text-white text-sm font-semibold truncate">{user.nome}</p>
              <span className="inline-block text-xs bg-white/20 text-blue-50 px-2 py-0.5 rounded-full mt-0.5">
                {user.perfil}
              </span>
            </div>
          )}

          <Link href="/" className="flex items-center space-x-2 text-blue-100 hover:text-white text-sm font-medium transition">
            <span>⬅</span>
            <span>Voltar ao Site Público</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-blue-100 hover:text-red-200 text-sm font-medium transition w-full"
          >
            <span>🚪</span>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        {children}
      </main>

    </div>
  );
}
