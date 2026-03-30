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
    { name: 'Recepção', path: '/recepcao/aso', icon: '🏥' },
    { name: 'Salas', path: '/admin/salas', icon: '🚪' },
    { name: 'Usuários', path: '/admin/usuarios', icon: '👥' },
    { name: 'TV Config', path: '/admin/tv', icon: '⚙️' },
    { name: 'TV Painel', path: '/tv/aso', icon: '📺' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">

      {/* SIDEBAR */}
      <aside className="bg-gradient-to-b from-[#3d7a52] to-[#2d5c3e] text-white w-full md:w-64 flex-shrink-0 shadow-xl">
        <div className="p-6 border-b border-white/10">
          <img src="/logo-aso.png" alt="ASO Saúde" className="h-10" />
          <p className="text-green-100 text-xs font-medium opacity-80 mt-1">Gestão de Fila</p>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center space-x-3 p-3 rounded-xl transition duration-200 group
                  ${isActive ? 'bg-white text-[#3d7a52] shadow-lg font-bold' : 'text-green-50 hover:bg-[#2d5c3e] hover:text-white'}
                `}
              >
                <span className={`text-xl ${isActive ? 'scale-110' : 'group-hover:scale-110 transition'}`}>{item.icon}</span>
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-white/10 space-y-3">
          {user && (
            <div className="px-1">
              <p className="text-green-100 text-xs font-medium opacity-70">Logado como</p>
              <p className="text-white text-sm font-semibold truncate">{user.nome}</p>
              <span className="inline-block text-xs bg-white/20 text-green-50 px-2 py-0.5 rounded-full mt-0.5">
                {user.perfil}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-green-100 hover:text-red-200 text-sm font-medium transition w-full"
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
