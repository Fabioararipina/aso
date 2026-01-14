'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import axios from 'axios';
import io from 'socket.io-client';

export default function FilaPage() {
  const { id } = useParams(); // ID do agendamento
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-agendamento.primeatende.com.br';

  useEffect(() => {
    fetchStatus();

    const socket = io(API_URL);
    socket.on('connect_error', () => {
       console.log('Socket connection error');
    });
    socket.on('agendamento-atualizado', () => fetchStatus());
    socket.on('chamar-paciente', () => fetchStatus());
    socket.on('agendamento-confirmado', () => fetchStatus());

    return () => socket.disconnect();
  }, [id]);

  const fetchStatus = async () => {
    try {
      setError(null);
      const res = await axios.get(`${API_URL}/api/agendamentos/${id}/posicao`);
      setDados(res.data);
    } catch (error) {
      console.error('Erro ao buscar fila:', error);
      setError('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Carregando status...</div>;
  
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500 gap-4">
      <p>{error}</p>
      <button 
        onClick={() => { setLoading(true); fetchStatus(); }}
        className="px-4 py-2 bg-[#5b8dfd] text-white rounded-lg hover:bg-blue-600 transition"
      >
        Tentar Novamente
      </button>
    </div>
  );

  if (!dados) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Agendamento não encontrado.</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        
        {/* HEADER */}
        <div className={`p-8 text-center text-white flex flex-col items-center transition-colors duration-500 ${
          dados.status === 'EM_ATENDIMENTO' ? 'bg-[#71ca4f] animate-pulse' : 
          dados.status === 'CONCLUIDO' ? 'bg-gray-600' : 
          'bg-[#5b8dfd]'
        }`}>
          <div className="bg-white p-2 rounded-xl mb-4 shadow-sm w-24 h-24 flex items-center justify-center">
             <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Olá, {dados.paciente_nome.split(' ')[0]}</h1>
          <p className="opacity-90 text-sm font-medium">Acompanhamento em Tempo Real</p>
        </div>

        {/* CORPO */}
        <div className="p-8 text-center space-y-8">
          
          {/* STATUS PRINCIPAL */}
          <div>
            {dados.status === 'PENDENTE' && (
              <div className="text-yellow-600 font-bold text-xl flex flex-col items-center gap-2">
                <span className="text-4xl">⏳</span>
                Aguardando Confirmação
              </div>
            )}
            
            {(dados.status === 'CONFIRMADO' || dados.status === 'PRESENTE') && (
              <>
                {dados.posicao > 0 ? (
                  <>
                    <div className="text-6xl font-black text-[#5b8dfd] mb-2">{dados.posicao}</div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">PESSOAS NA SUA FRENTE</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl font-black text-[#5b8dfd] mb-2">PRÓXIMO</div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">VOCÊ É O PRÓXIMO DA FILA</p>
                  </>
                )}
              </>
            )}

            {dados.status === 'EM_ATENDIMENTO' && (
              <>
                <div className="text-5xl font-black text-[#71ca4f] mb-2">SUA VEZ!</div>
                <p className="text-gray-600 font-medium">Dirija-se ao consultório.</p>
              </>
            )}

            {dados.status === 'CONCLUIDO' && (
              <div className="text-gray-500 font-bold text-xl flex flex-col items-center gap-2">
                <span className="text-4xl text-[#71ca4f]">✅</span>
                Atendimento Finalizado
              </div>
            )}
          </div>

          {/* DETALHES PREVISÃO */}
          {(dados.status === 'CONFIRMADO' || dados.status === 'PRESENTE') && (
            <div className="bg-[#5b8dfd]/5 rounded-xl p-6 border border-[#5b8dfd]/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#5b8dfd]"></div>
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-xs text-[#5b8dfd] uppercase font-bold mb-1">Médico(a)</p>
                  <p className="font-bold text-gray-800 truncate leading-tight">{dados.medico_nome}</p>
                </div>
                <div>
                  <p className="text-xs text-[#5b8dfd] uppercase font-bold mb-1">Previsão</p>
                  <p className="font-bold text-gray-800 text-xl leading-tight">{dados.previsao}</p>
                </div>
              </div>
              
              {dados.atraso > 0 && (
                <div className="mt-4 bg-red-50 text-red-600 text-[10px] font-bold py-1 px-2 rounded inline-block">
                  ⚠️ Médico com atraso de {dados.atraso} min.
                </div>
              )}
            </div>
          )}

          {/* DICA */}
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
            A atualização é automática. Não precisa recarregar.
          </div>

        </div>

        {/* FOOTER */}
        <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
           <a href={`https://wa.me/5581999999999`} className="text-[#5b8dfd] font-bold text-sm hover:underline">Precisa de ajuda? Fale conosco.</a>
        </div>

      </div>
    </div>
  );
}