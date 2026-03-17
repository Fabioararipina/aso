'use client';

import "./globals.css";
import { usePathname } from "next/navigation";
import AdminLayout from "../components/AdminLayout";
import AuthGuard from "../components/AuthGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  // Lista de rotas que DEVEM ter o layout administrativo e autenticação
  const adminRoutes = ['/portal', '/recepcao', '/medico', '/admin'];

  // Verifica se a rota atual começa com algum dos prefixos admin (ex: /admin/horarios)
  const isAdmin = adminRoutes.some(route => pathname?.startsWith(route)) && pathname !== '/tv';

  return (
    <html lang="pt-br">
      <body className="antialiased font-sans bg-gray-50">
        {isAdmin ? (
          <AuthGuard>
            <AdminLayout>{children}</AdminLayout>
          </AuthGuard>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
