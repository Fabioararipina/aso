'use client';

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import QRCode from 'react-qr-code';
import axios from 'axios';

export default function AdminPage() {
  const [status, setStatus] = useState('desconectado');
  const [qrCode, setQrCode] = useState(null);
  const [logs, setLogs] = useState([]);

  // Use environment variable or default to localhost:5000
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.20.19:5000';

  useEffect(() => {
    const socket = io(API_URL);

    // Solicita status atual ao conectar
    // Como o socket conecta depois, talvez o servidor já tenha emitido o evento ready
    // Idealmente teríamos um endpoint GET /api/whatsapp/status, mas vamos confiar nos eventos por hora
    
    socket.on('whatsapp-qr', (qr) => {
      setQrCode(qr);
      setStatus('aguardando_leitura');
      addLog('QR Code recebido. Aguardando leitura...');
    });

    socket.on('whatsapp-status', (data) => {
      setStatus(data.status);
      if (data.status === 'conectado') {
        setQrCode(null);
        addLog('WhatsApp Conectado com Sucesso! ✅');
      } else if (data.status === 'desconectado') {
        addLog('WhatsApp Desconectado. Tentando reconectar...');
      } else if (data.status === 'erro') {
        addLog(`Erro no WhatsApp: ${data.mensagem}`);
      }
    });

    return () => socket.disconnect();
  }, []);

  const addLog = (msg) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
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
            
            {status === 'conectado' ? (
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
                  <QRCode value={qrCode} size={256} />
                </div>
                <p className="text-sm text-gray-500">Abra o WhatsApp {'>'} Aparelhos Conectados {'>'} Conectar Aparelho</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Iniciando cliente WhatsApp...</p>
                <p className="text-xs text-gray-400 mt-2">Isso pode levar alguns segundos.</p>
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
      </div>
    </div>
  );
}
