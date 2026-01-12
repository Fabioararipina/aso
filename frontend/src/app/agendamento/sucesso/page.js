'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';

export default function SucessoPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [agendamento, setAgendamento] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use environment variable or default to localhost:5000
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (id) {
      // Cria uma rota específica para buscar um agendamento público?
      // Por segurança, geralmente não expomos dados de outros, mas como é logo após o cadastro e pelo ID, vamos permitir temporariamente buscar pelo ID.
      // O ideal seria um token, mas vamos usar uma rota existente ou nova.
      // Vou usar a rota de médico que busca por ID no backend, mas precisamos de uma rota pública ou protegida.
      // Vamos criar um endpoint simples GET /api/agendamentos/:id no backend para isso funcionar.
      // Vou assumir que ela existe ou usarei uma query direta. 
      // Espera, não temos rota GET /:id pública. Vou ter que criar rapidinho no backend ou usar a do médico mascarada.
      // Vou usar uma lógica de buscar detalhes.
      axios.get(`${API_URL}/api/agendamentos/detalhes/${id}`)
        .then(res => setAgendamento(res.data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100">Carregando ticket...</div>;
  if (!agendamento) return <div className="min-h-screen flex items-center justify-center bg-gray-100">Agendamento não encontrado.</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-0 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        
        {/* HEADER TICKET */}
        <div className="bg-blue-600 p-6 text-center text-white relative">
          <div className="w-16 h-16 bg-white text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg">
            ✓
          </div>
          <h1 className="text-2xl font-bold">Solicitação Recebida!</h1>
          <p className="text-blue-100 text-sm mt-1">Aguardando confirmação</p>
          
          {/* Recorte Ticket (Bolinhas) */}
          <div className="absolute bottom-0 left-0 w-full h-4 bg-gray-100" style={{ clipPath: 'polygon(0 50%, 5% 0, 10% 50%, 15% 0, 20% 50%, 25% 0, 30% 50%, 35% 0, 40% 50%, 45% 0, 50% 50%, 55% 0, 60% 50%, 65% 0, 70% 50%, 75% 0, 80% 50%, 85% 0, 90% 50%, 95% 0, 100% 50%, 100% 100%, 0 100%)' }}></div>
        </div>

        {/* BODY TICKET */}
        <div className="p-8 space-y-6 bg-white relative">
          
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">PROTOCOLO</p>
            <p className="text-3xl font-mono font-bold text-gray-800">#{agendamento.id.toString().padStart(6, '0')}</p>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Paciente</span>
              <span className="font-bold text-gray-800">{agendamento.paciente_nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Profissional</span>
              <span className="font-bold text-gray-800">{agendamento.medico_nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Data</span>
              <span className="font-bold text-gray-800">{new Date(agendamento.data_consulta).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Horário</span>
              <span className="font-bold text-blue-600 bg-blue-50 px-2 rounded">{agendamento.horario.slice(0,5)}</span>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 flex items-start gap-2">
            <span>⚠️</span>
            <p>Seu horário está reservado temporariamente. Você receberá a confirmação final via WhatsApp em breve.</p>
          </div>
        </div>

        {/* BANNER PROMOCIONAL */}
        <Link href="/cartao" className="block bg-gradient-to-r from-green-500 to-green-600 p-4 text-white text-center relative overflow-hidden hover:opacity-95 transition">
          <div className="absolute top-0 right-0 p-1 opacity-20 text-4xl">🌳</div>
          <p className="text-xs font-bold uppercase tracking-wider text-green-100 mb-1">CONHEÇA AGORA</p>
          <h3 className="text-lg font-bold">Cartão Essencial Saúde</h3>
          <p className="text-sm">Descontos exclusivos em consultas e exames ›</p>
        </Link>

        {/* FOOTER - INDICAÇÃO VIRAL */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
          
          <a 
            href={`https://wa.me/?text=Oi! Sou eu, ${agendamento.paciente_nome}. Lembrei que você estava precisando cuidar da saúde. Marquei minha consulta na Essencial Saúde agora, super fácil. Dá uma olhada: ${window.location.origin}`}
            target="_blank"
            className="block w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 text-center transition shadow-lg transform hover:-translate-y-1 flex items-center justify-center gap-2 text-sm"
          >
            <span>🎁</span> Tem alguém precisando cuidar da saúde? Indique clicando aqui.
          </a>

          <p className="text-xs text-center text-gray-400 mt-2">
            Gostou do atendimento? <a href="#" className="text-blue-500 underline">Avalie no Google</a>
          </p>
        </div>
      </div>
    </div>
  );
}