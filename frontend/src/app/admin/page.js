'use client';

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { getToken } from '../../lib/auth';

export default function AdminPage() {
  const [status, setStatus] = useState('desconectado');
  const [qrCode, setQrCode] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // Estados para o formulário de teste
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste.');
  const [isSending, setIsSending] = useState(false);
  const [testStatus, setTestStatus] = useState({ message: '', type: '' });


  // Em produção usa a mesma origem (proxy via nginx), em dev usa localhost:5000
  const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? window.location.origin // Em produção, usa a mesma origem
    : 'http://localhost:5000';



          useEffect(() => {



            const socket = io(API_URL, { auth: { token: getToken() } });



      



            socket.on('whatsapp-qr', (qr) => {



              setQrCode(qr);



              setStatus('aguardando_leitura');



              addLog('QR Code recebido. Aguardando leitura...');



            });



      



            socket.on('whatsapp-status', (data) => {



              setStatus(data.status);



              if (data.status === 'conectado' || data.status === 'open') {



                setQrCode(null);



                addLog('WhatsApp Conectado com Sucesso!');



              } else if (data.status === 'desconectado' || data.status === 'close') {



                addLog('WhatsApp Desconectado. Tentando reconectar...');



              } else if (data.status === 'erro') {



                addLog(`Erro no WhatsApp: ${data.mensagem}`);



              }



            });



      



            socket.on('evolution-webhook', (data) => {



              // Nada a fazer aqui por enquanto, apenas retransmitir.



            });



      



            return () => socket.disconnect();



          }, []);
  const addLog = (msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handleReconectar = async () => {
    try {
      setStatus('reconectando');
      setQrCode(null);
      addLog('Solicitando reconexão...');
      const response = await axios.post(`${API_URL}/api/whatsapp/reconnect`);
      if (response.data.success) {
        addLog('Reconexão iniciada. Aguarde o QR Code...');
      }
    } catch (error) {
      addLog(`Erro ao reconectar: ${error.message}`);
      setStatus('erro');
    }
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testNumber || !testMessage) {
      setTestStatus({ message: 'Por favor, preencha o número e a mensagem.', type: 'error' });
      return;
    }
    
    setIsSending(true);
    setTestStatus({ message: 'Enviando mensagem de teste...', type: 'info' });
    addLog(`Enviando mensagem de teste para ${testNumber}...`);

    try {
      const response = await axios.post(`${API_URL}/api/whatsapp/enviar`, {
        numero: testNumber,
        mensagem: testMessage
      });

      if (response.data.success) {
        setTestStatus({ message: 'Mensagem enviada com sucesso!', type: 'success' });
        addLog(`Mensagem para ${testNumber} enviada com sucesso.`);
      } else {
        throw new Error(response.data.message || 'Ocorreu um erro desconhecido.');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Falha ao conectar com a API.';
      setTestStatus({ message: `Erro ao enviar mensagem: ${errorMessage}`, type: 'error' });
      addLog(`Falha ao enviar para ${testNumber}: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Administração do Sistema</h1>
            <p className="text-gray-600">Gerencie a conexão do WhatsApp e configurações.</p>
          </div>
          <div className={`px-4 py-2 rounded-full font-bold text-white ${
            status === 'conectado' ? 'bg-green-500' : 
            status === 'aguardando_leitura' ? 'bg-yellow-500' : 'bg-red-500'
          }`}>
            Status: {status.toUpperCase().replace('_', ' ')}
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          
          {/* CARTÃO DE CONEXÃO WHATSAPP */}
          <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center justify-center min-h-[400px]">
            <h2 className="text-xl font-bold mb-6 text-gray-700">Conexão WhatsApp</h2>
            
            {status === 'conectado' || status === 'open' ? (
              <div className="text-center">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg text-green-600 font-bold">Sistema Operacional</p>
                <p className="text-gray-500 mt-2">O bot está pronto para enviar mensagens.</p>
              </div>
            ) : qrCode ? (
              <div className="text-center">
                <div className="bg-white p-4 border rounded-lg shadow-inner mb-4 inline-block">
                  <img
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    width={256}
                    height={256}
                  />
                </div>
                <p className="text-sm text-gray-500">Abra o WhatsApp {'>'} Aparelhos Conectados {'>'} Conectar Aparelho</p>
                <button
                  onClick={handleReconectar}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Gerar Novo QR Code
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Iniciando cliente WhatsApp...</p>
                <p className="text-xs text-gray-400 mt-2">Isso pode levar alguns segundos.</p>
                <button
                  onClick={handleReconectar}
                  className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  Conectar WhatsApp
                </button>
              </div>
            )}
          </div>

          {/* LOGS DO SISTEMA */}
          <div className="bg-white rounded-xl shadow-lg p-6 h-[400px] overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold mb-4 text-gray-700">Logs do Sistema</h2>
            <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 font-mono text-sm border border-gray-200">
              {logs.length === 0 ? (
                <p className="text-gray-400 italic">Nenhum evento registrado ainda.</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="mb-2 text-gray-700 border-b border-gray-100 pb-1 last:border-0">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* PAINEL DE TESTE DE ENVIO */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-bold mb-6 text-gray-700">Teste de Envio de Mensagem</h2>
            <form onSubmit={handleSendTestMessage}>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <label htmlFor="testNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Número do WhatsApp
                  </label>
                  <input
                    type="text"
                    id="testNumber"
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ex: 5587999999999"
                  />
                </div>
                <div className="md:col-span-2">
                   <label htmlFor="testMessage" className="block text-sm font-medium text-gray-700 mb-1">
                    Mensagem
                  </label>
                  <input
                    type="text"
                    id="testMessage"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Digite sua mensagem de teste"
                  />
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <button
                  type="submit"
                  disabled={isSending || status !== 'conectado'}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isSending ? 'Enviando...' : 'Enviar Mensagem de Teste'}
                </button>
                {testStatus.message && (
                  <p className={`text-sm font-medium ${
                    testStatus.type === 'success' ? 'text-green-600' :
                    testStatus.type === 'error' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {testStatus.message}
                  </p>
                )}
              </div>
               {status !== 'conectado' && (
                  <p className="text-xs text-red-500 mt-2">O WhatsApp precisa estar conectado para enviar mensagens.</p>
                )}
            </form>
        </div>

      </div>
    </div>
  );
}
