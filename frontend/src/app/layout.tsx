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

  // Rotas que exigem autenticação e layout administrativo
  const adminRoutes = ['/recepcao', '/admin', '/operador'];

  // Rotas públicas (sem autenticação): TV panels, login
  const publicPrefixes = ['/tv', '/login'];

  const isAdmin = adminRoutes.some(route => pathname?.startsWith(route)) &&
    !publicPrefixes.some(p => pathname?.startsWith(p));

  return (
    <html lang="pt-br">
      <head>
        <title>ASO Saúde</title>
        <meta name="description" content="Sistema de gestão de fila — ASO Saúde" />
      </head>
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
