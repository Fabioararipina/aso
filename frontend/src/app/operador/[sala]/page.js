'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_COLORS = {
  PENDENTE: { bg: '#fef9c3', border: '#f59e0b', text: '#854d0e', label: 'Aguardando' },
  EM_ATENDIMENTO: { bg: '#e8f5ee', border: '#3d7a52', text: '#2d5c3e', label: 'Em Atendimento' },
  CONCLUIDO_SALA: { bg: '#f3f4f6', border: '#6b7280', text: '#374151', label: 'Concluído' },
};

function SalaSquare({ status, nome }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.PENDENTE;
  return (
    <span
      title={nome}
      style={{
        display: 'inline-block',
        width: 28,
        height: 28,
        borderRadius: 6,
        border: `2px solid ${style.border}`,
        background: style.bg,
        flexShrink: 0,
        cursor: 'default',
      }}
    />
  );
}

export default function OperadorPage() {
  const params = useParams();
  const sala = params.sala;

  const [info, setInfo] = useState(null); // { sala, fila }
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  const fetchFila = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/fila/${sala}`);
      setInfo(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar fila');
    } finally {
      setLoading(false);
    }
  }, [sala]);

  useEffect(() => {
    fetchFila();

    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('fila:atualizada', () => fetchFila());
    socket.on('tv:atualizar', () => fetchFila());

    return () => socket.disconnect();
  }, [fetchFila]);

  async function handleChamar(fila_id) {
    setActionLoading(`chamar-${fila_id}`);
    try {
      await axios.post(`${API_URL}/api/fila/${sala}/chamar`, { fila_id });
      await fetchFila();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao chamar paciente');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConcluir(id) {
    setActionLoading(`concluir-${id}`);
    try {
      await axios.post(`${API_URL}/api/fila/${id}/concluir`);
      await fetchFila();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao concluir');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Carregando fila...</div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  const salaInfo = info?.sala;
  const fila = info?.fila || [];
  const emAtendimento = fila.filter(f => f.status === 'EM_ATENDIMENTO');
  const pendentes = fila.filter(f => f.status === 'PENDENTE');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">{salaInfo?.nome || sala}</h1>
          <p className="text-gray-400 text-sm">
            Operador — {fila.length} paciente(s) na fila
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-green-500 w-2 h-2 rounded-full inline-block"></span>
          <span className="text-sm text-gray-300">Ao vivo</span>
        </div>
      </header>

      <main className="p-6 max-w-3xl mx-auto">
        {/* Em Atendimento */}
        {emAtendimento.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold uppercase text-[#3d7a52] tracking-wider mb-3">
              Em Atendimento
            </h2>
            <div className="space-y-3">
              {emAtendimento.map(item => (
                <PatientCard
                  key={item.id}
                  item={item}
                  onConcluir={() => handleConcluir(item.id)}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          </div>
        )}

        {/* Fila de espera */}
        <div>
          <h2 className="text-sm font-bold uppercase text-yellow-400 tracking-wider mb-3">
            Fila de Espera ({pendentes.length})
          </h2>
          {pendentes.length === 0 ? (
            <div className="bg-gray-800 rounded-2xl p-8 text-center text-gray-400">
              Nenhum paciente aguardando.
            </div>
          ) : (
            <div className="space-y-3">
              {pendentes.map((item, index) => (
                <PatientCard
                  key={item.id}
                  item={item}
                  position={index + 1}
                  onChamar={() => handleChamar(item.id)}
                  actionLoading={actionLoading}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PatientCard({ item, position, onChamar, onConcluir, actionLoading }) {
  const isCalling = actionLoading === `chamar-${item.id}`;
  const isConcluding = actionLoading === `concluir-${item.id}`;
  const isPendente = item.status === 'PENDENTE';
  const isEmAtendimento = item.status === 'EM_ATENDIMENTO';

  const todasSalas = item.todas_salas || [];

  return (
    <div
      style={{
        background: isEmAtendimento ? '#0d2b1a' : '#1f2937',
        border: `1px solid ${isEmAtendimento ? '#3d7a52' : '#374151'}`,
        borderRadius: 16,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {/* Position */}
      {position && (
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 18, flexShrink: 0,
        }}>
          {position}
        </div>
      )}
      {isEmAtendimento && (
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#3d7a52', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>
          ▶
        </div>
      )}

      {/* Name and rooms */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 900, fontSize: 18, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.paciente_nome}
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {todasSalas.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <SalaSquare status={s.status} nome={s.sala_nome} />
              <span style={{ fontSize: 9, color: '#9ca3af', maxWidth: 40, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.sala_nome}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action button */}
      <div style={{ flexShrink: 0 }}>
        {isPendente && (
          <button
            onClick={onChamar}
            disabled={isCalling}
            style={{
              background: isCalling ? '#374151' : '#3d7a52',
              color: '#fff', fontWeight: 700, fontSize: 14,
              padding: '10px 20px', borderRadius: 12, border: 'none',
              cursor: isCalling ? 'not-allowed' : 'pointer',
              minWidth: 100,
            }}
          >
            {isCalling ? '...' : 'Chamar'}
          </button>
        )}
        {isEmAtendimento && (
          <button
            onClick={onConcluir}
            disabled={isConcluding}
            style={{
              background: isConcluding ? '#374151' : '#16a34a',
              color: '#fff', fontWeight: 700, fontSize: 14,
              padding: '10px 20px', borderRadius: 12, border: 'none',
              cursor: isConcluding ? 'not-allowed' : 'pointer',
              minWidth: 100,
            }}
          >
            {isConcluding ? '...' : 'Concluído'}
          </button>
        )}
      </div>
    </div>
  );
}
