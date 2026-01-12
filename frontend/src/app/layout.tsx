'use client';

import "./globals.css";
import { usePathname } from "next/navigation";
import AdminLayout from "../components/AdminLayout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  
  // Lista de rotas que DEVEM ter o layout administrativo
  const adminRoutes = ['/portal', '/recepcao', '/medico', '/admin'];
  
  // Verifica se a rota atual começa com algum dos prefixos admin (ex: /admin/horarios)
  const isAdmin = adminRoutes.some(route => pathname?.startsWith(route)) && pathname !== '/tv';

  return (
    <html lang="pt-br">
      <body className="antialiased font-sans bg-gray-50">
        {isAdmin ? (
          <AdminLayout>{children}</AdminLayout>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
