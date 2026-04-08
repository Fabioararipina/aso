'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { authHeaders } from '../../lib/auth';

import { API_URL } from '@/lib/api';

export default function OperadorIndexPage() {
  const [salas, setSalas] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    axios.get(`${API_URL}/api/salas`, { headers: authHeaders() })
      .then(r => setSalas(r.data.filter(s => s.ativo)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-800">Painel do Operador</h1>
        <p className="text-sm text-gray-400 mt-1">Selecione a sala que você vai operar</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Carregando salas...</div>
      ) : salas.length === 0 ? (
        <div className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-dashed border-gray-200">
          Nenhuma sala ativa cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {salas.map(sala => (
            <button
              key={sala.id}
              onClick={() => router.push(`/operador/${sala.slug}`)}
              className="bg-white border-2 border-gray-200 hover:border-[#3d7a52] hover:bg-[#e8f5ee] rounded-2xl p-6 text-left transition-all group"
            >
              <div className="w-10 h-10 bg-[#e8f5ee] group-hover:bg-[#3d7a52] rounded-xl flex items-center justify-center mb-3 transition-colors">
                <span className="text-[#3d7a52] group-hover:text-white font-black text-lg transition-colors">
                  {sala.nome.charAt(0)}
                </span>
              </div>
              <p className="font-black text-gray-800 text-base">{sala.nome}</p>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">{sala.slug}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
