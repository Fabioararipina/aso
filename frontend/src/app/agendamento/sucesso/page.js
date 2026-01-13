'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import io from 'socket.io-client';

export default function SucessoPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [agendamento, setAgendamento] = useState(null);
  const [pagamento, setPagamento] = useState(null); // Dados do pagamento (QR Code)
  const [loading, setLoading] = useState(true);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [gerandoLink, setGerandoLink] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.20.19:5000';

  useEffect(() => {
    if (id) {
      carregarDados();
      
      // Socket para ouvir aprovação em tempo real
      const socket = io(API_URL);
      socket.on('pagamento-aprovado', (data) => {
        // Se receber evento de aprovação (mesmo que seja de outro, verifica se é o nosso pelo ID se tiver, mas aqui é simples)
        // O ideal é verificar se o payment_id bate.
        // Vamos recarregar os dados para ter certeza.
        carregarDados();
      });

      return () => socket.disconnect();
    }
  }, [id]);

  const carregarDados = async () => {
    try {
      // 1. Busca dados básicos do agendamento
      const res = await axios.get(`${API_URL}/api/agendamentos/detalhes/${id}`);
      setAgendamento(res.data);

      // 2. Verifica se já tem pagamento associado
      if (res.data && res.data.payment_status) {
        setPagamento({
          status: res.data.payment_status,
          qr_code: res.data.qr_code,
          qr_code_base64: res.data.qr_code_base64,
          payment_link: res.data.payment_link
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const gerarPix = async () => {
    setGerandoPix(true);
    try {
      const res = await axios.post(`${API_URL}/api/pagamentos/${id}/pix`);
      // Recarrega dados completos para atualizar status
      carregarDados();
    } catch (error) {
      alert('Erro ao gerar PIX: ' + (error.response?.data?.erro || error.message));
    } finally {
      setGerandoPix(false);
    }
  };

  const pagarCartao = async () => {
    // Se já tiver link no banco, usa ele
    if (agendamento?.payment_link && !agendamento.payment_link.includes('pix')) {
      window.open(agendamento.payment_link, '_blank');
      return;
    }

    setGerandoLink(true);
    try {
      const res = await axios.post(`${API_URL}/api/pagamentos/${id}/link`);
      window.open(res.data.init_point, '_blank');
      carregarDados();
    } catch (error) {
      alert('Erro ao gerar link de pagamento: ' + (error.response?.data?.erro || error.message));
    } finally {
      setGerandoLink(false);
    }
  };

  const copiarCodigo = () => {
    if (pagamento?.qr_code) {
      navigator.clipboard.writeText(pagamento.qr_code);
      alert('Código PIX copiado!');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-[#5b8dfd]">Carregando ticket...</div>;
  if (!agendamento) return <div className="min-h-screen flex items-center justify-center bg-gray-100">Agendamento não encontrado.</div>;

  // Se for RETORNO, exibe tela de validação sem cobrança
  if (agendamento.tipo_consulta === 'RETORNO' || parseFloat(agendamento.valor) === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-0 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col border border-gray-200">
          
          <div className="p-6 text-center text-white bg-[#71ca4f]">
            <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-lg p-2">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold">Solicitação de Retorno</h1>
            <p className="text-green-100 text-sm mt-1">Aguardando validação da recepção.</p>
          </div>

          <div className="p-8 space-y-6 bg-white">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">PROTOCOLO</p>
              <p className="text-3xl font-mono font-bold text-gray-800">#{agendamento.id.toString().padStart(6, '0')}</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-blue-800 font-bold mb-2">Como funciona?</p>
              <p className="text-sm text-blue-600">
                Nossa equipe irá verificar se sua consulta anterior está dentro do prazo de retorno gratuito.
                <br/><br/>
                Você receberá a confirmação no <strong>WhatsApp</strong> assim que validarmos.
              </p>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Paciente</span>
                <span className="font-bold text-gray-800">{agendamento.paciente_nome}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">Data</span>
                <span className="font-bold text-gray-800">{new Date(agendamento.data_consulta).toLocaleDateString('pt-BR')} às {agendamento.horario.slice(0,5)}</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 border-t text-center">
            <a href="/" className="text-[#5b8dfd] font-bold text-sm hover:underline">Voltar ao Início</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-0 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col border border-gray-200">
        
        {/* HEADER TICKET */}
        <div className={`p-6 text-center text-white relative transition-colors duration-500 ${
          pagamento?.status === 'approved' ? 'bg-[#71ca4f]' : 'bg-[#5b8dfd]'
        }`}>
          <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-lg p-2">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          
          {pagamento?.status === 'approved' ? (
            <>
              <h1 className="text-2xl font-bold">Pagamento Confirmado!</h1>
              <p className="text-green-100 text-sm mt-1">Sua consulta está garantida.</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Solicitação Recebida!</h1>
              <p className="text-blue-100 text-sm mt-1">Realize o pagamento para confirmar.</p>
            </>
          )}
          
          {/* Recorte Ticket */}
          <div className="absolute bottom-0 left-0 w-full h-4 bg-gray-100" style={{ clipPath: 'polygon(0 50%, 5% 0, 10% 50%, 15% 0, 20% 50%, 25% 0, 30% 50%, 35% 0, 40% 50%, 45% 0, 50% 50%, 55% 0, 60% 50%, 65% 0, 70% 50%, 75% 0, 80% 50%, 85% 0, 90% 50%, 95% 0, 100% 50%, 100% 100%, 0 100%)' }}></div>
        </div>

        {/* BODY TICKET */}
        <div className="p-8 space-y-6 bg-white relative">
          
          {/* ÁREA DE PAGAMENTO (Se não pago) */}
          {pagamento?.status !== 'approved' && (
            <div className="bg-[#5b8dfd]/5 border border-[#5b8dfd]/20 rounded-xl p-6 text-center mb-4">
              <p className="font-bold text-gray-700 mb-4">Pague com PIX para liberar imediatamente</p>
              
              {!pagamento ? (
                <button 
                  onClick={gerarPix} 
                  disabled={gerandoPix}
                  className="w-full bg-[#5b8dfd] text-white font-bold py-3 rounded-lg shadow hover:bg-blue-600 transition flex items-center justify-center gap-2"
                >
                  {gerandoPix ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div> : '💠'}
                  GERAR QR CODE PIX
                </button>
              ) : (
                <div className="flex flex-col items-center">
                  {/* QR Code */}
                  <div className="bg-white p-2 border rounded mb-4">
                    <QRCodeSVG value={pagamento.qr_code} size={180} />
                  </div>
                  
                  {/* Copia e Cola */}
                  <button 
                    onClick={copiarCodigo}
                    className="text-[#5b8dfd] font-bold text-sm bg-blue-50 py-2 px-4 rounded-full hover:bg-blue-100 transition flex items-center gap-2 mb-4"
                  >
                    📑 Copiar Código PIX
                  </button>

                  <div className="w-full border-t border-gray-100 my-4 pt-4">
                    <p className="text-xs text-gray-400 mb-3">OU OUTRAS FORMAS</p>
                    <button 
                      onClick={pagarCartao}
                      disabled={gerandoLink}
                      className="w-full bg-white border-2 border-[#5b8dfd] text-[#5b8dfd] font-bold py-2 rounded-lg hover:bg-blue-50 transition flex items-center justify-center gap-2"
                    >
                      {gerandoLink ? <div className="animate-spin h-4 w-4 border-2 border-[#5b8dfd] border-t-transparent rounded-full"></div> : '💳'}
                      PAGAR COM CARTÃO / OUTROS
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-4 animate-pulse">Aguardando pagamento...</p>
                </div>
              )}
            </div>
          )}

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
              <span className="font-bold text-[#5b8dfd] bg-blue-50 px-2 rounded">{agendamento.horario.slice(0,5)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-500 font-bold">Valor</span>
              <span className="font-bold text-green-600">R$ {parseFloat(agendamento.valor || 150).toFixed(2).replace('.',',')}</span>
            </div>
          </div>

          {pagamento?.status !== 'approved' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 flex items-start gap-2">
              <span>⚠️</span>
              <p>Seu horário está reservado. O não pagamento pode liberar a vaga para outro paciente.</p>
            </div>
          )}
        </div>

        {/* FOOTER - INDICAÇÃO VIRAL */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
          <p className="text-xs text-center text-gray-400 mt-2">
            Dúvidas? <a href="#" className="text-[#5b8dfd] underline">Fale no WhatsApp</a>
          </p>
        </div>
      </div>
    </div>
  );
}