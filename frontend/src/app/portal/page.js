'use client';

import Link from 'next/link';

export default function PortalPage() {
  const cards = [
    { title: 'Recepção (Agenda)', desc: 'Calendário visual de todos os médicos', href: '/recepcao/calendario', color: 'bg-blue-600', icon: '📅' },
    { title: 'Painel Médico', desc: 'Realizar atendimentos e chamar pacientes', href: '/medico', color: 'bg-green-600', icon: '👨‍⚕️' },
    { title: 'Equipe Médica', desc: 'Cadastrar médicos e especialidades', href: '/admin/medicos', color: 'bg-orange-600', icon: '📋' },
    { title: 'Configurar Horários', desc: 'Definir grade de trabalho dos médicos', href: '/admin/horarios', color: 'bg-purple-600', icon: '⏰' },
    { title: 'Configurar TV', desc: 'Gerenciar propagandas e clima', href: '/admin/tv', color: 'bg-pink-600', icon: '🖥️' },
    { title: 'WhatsApp Admin', desc: 'Conectar QR Code e ver status', href: '/admin', color: 'bg-teal-600', icon: '💬' },
    { title: 'TV Sala de Espera', desc: 'Abrir display de chamadas', href: '/tv', color: 'bg-gray-800', icon: '📺' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-10 text-center md:text-left">
        <h1 className="text-4xl font-bold text-gray-800">Bem-vindo ao Portal</h1>
        <p className="text-gray-600 mt-2 text-lg">Selecione o módulo que deseja acessar.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link 
            key={card.href} 
            href={card.href}
            className="group block bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 transform hover:-translate-y-1"
          >
            <div className={`h-2 ${card.color}`}></div>
            <div className="p-8">
              <div className={`w-14 h-14 ${card.color} rounded-xl flex items-center justify-center text-3xl mb-4 text-white shadow-lg group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{card.title}</h3>
              <p className="text-gray-500">{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
