'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const SALA_COLORS = {
  PENDENTE: { bg: '#fef9c3', border: '#f59e0b' },
  EM_ATENDIMENTO: { bg: '#e8f5ee', border: '#3d7a52' },
  CONCLUIDO_SALA: { bg: '#f3f4f6', border: '#6b7280' },
};

// After CONCLUIDO, keep visible for 2 minutes then remove
const CONCLUIDO_TIMEOUT_MS = 2 * 60 * 1000;

function SalaSquare({ status, nome }) {
  const c = SALA_COLORS[status] || SALA_COLORS.PENDENTE;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4vh' }}>
      <div style={{
        width: '3vw', height: '3vw',
        maxWidth: 40, maxHeight: 40,
        minWidth: 20, minHeight: 20,
        borderRadius: '0.5vw',
        background: c.bg,
        border: `2px solid ${c.border}`,
      }} />
      <span style={{ fontSize: '0.7vw', color: '#94a3b8', maxWidth: '4vw', textAlign: 'center', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {nome}
      </span>
    </div>
  );
}

export default function TvAsoPage() {
  const [pacientes, setPacientes] = useState([]);
  const [chamadaAtual, setChamadaAtual] = useState(null);
  const [currentTime, setCurrentTime] = useState('--:--');
  const [currentDate, setCurrentDate] = useState('');
  // Track when CONCLUIDO pacientes should be removed
  const concluidoTimers = useRef({});
  const audioCtxRef = useRef(null);
  const audioUnlocked = useRef(false);

  const fetchDados = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tv/dados`);
      setPacientes(prev => {
        const newData = res.data;
        // Keep CONCLUIDO items that have a timer running
        const concluidoIds = Object.keys(concluidoTimers.current).map(Number);
        const existingConcluidos = prev.filter(p =>
          p.status === 'CONCLUIDO' && concluidoIds.includes(p.id)
        );
        const merged = [...newData];
        existingConcluidos.forEach(c => {
          if (!merged.find(m => m.id === c.id)) merged.push(c);
        });
        return merged;
      });
    } catch (err) {
      console.error('[TV-ASO] Erro ao buscar dados:', err.message);
    }
  };

  const getAudioCtx = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const playAlert = () => {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.value = 0.4;
      osc.start();
      setTimeout(() => { osc.frequency.value = 554; }, 400);
      setTimeout(() => { osc.stop(); }, 1000);
    } catch (e) {}
  };

  const speakText = (text) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR';
        u.rate = 0.85;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {}
  };

  useEffect(() => {
    // Fullscreen
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

    // Unlock audio
    const unlockAudio = () => {
      if (audioUnlocked.current) return;
      audioUnlocked.current = true;
      const ctx = getAudioCtx();
      if (ctx) ctx.resume();
    };
    setTimeout(unlockAudio, 300);
    document.addEventListener('click', unlockAudio, { once: true });

    fetchDados();
    const interval = setInterval(fetchDados, 30000);

    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('tv:atualizar', () => fetchDados());
    socket.on('paciente:chamado', ({ paciente_nome, sala_nome }) => {
      setChamadaAtual({ paciente_nome, sala_nome });
      playAlert();
      speakText(`Paciente ${paciente_nome}, dirija-se à sala ${sala_nome}`);
      setTimeout(() => setChamadaAtual(null), 12000);
    });
    socket.on('paciente:concluido', ({ atendimento_id }) => {
      // Start 2-min timer to remove from display
      if (concluidoTimers.current[atendimento_id]) clearTimeout(concluidoTimers.current[atendimento_id]);
      concluidoTimers.current[atendimento_id] = setTimeout(() => {
        delete concluidoTimers.current[atendimento_id];
        setPacientes(prev => prev.filter(p => p.id !== atendimento_id));
      }, CONCLUIDO_TIMEOUT_MS);
      fetchDados();
    });

    // Clock
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
      clearInterval(clockInterval);
      document.removeEventListener('click', unlockAudio);
      Object.values(concluidoTimers.current).forEach(t => clearTimeout(t));
    };
  }, []);

  const getOverallStatus = (paciente) => {
    const salas = paciente.salas || [];
    if (salas.every(s => s.status === 'CONCLUIDO_SALA')) return 'CONCLUIDO';
    if (salas.some(s => s.status === 'EM_ATENDIMENTO')) return 'EM_ATENDIMENTO';
    return 'AGUARDANDO';
  };

  const visiblePacientes = pacientes.filter(p => {
    const status = getOverallStatus(p);
    return status !== 'CONCLUIDO' || concluidoTimers.current[p.id];
  });

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      background: '#0a1628', color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        background: '#0f2040',
        borderBottom: '1px solid #1e3a5f',
        padding: '1vh 3vw',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: '2.5vw', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
            ASO Saúde
          </h1>
          <p style={{ fontSize: '1vw', color: '#64748b', marginTop: '0.3vh' }}>
            Medicina Ocupacional — Painel de Chamada
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '4vw', fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}>
            {currentTime}
          </div>
          <div style={{ fontSize: '1vw', color: '#64748b', marginTop: '0.3vh' }}>
            {currentDate}
          </div>
        </div>
      </header>

      {/* Legenda */}
      <div style={{
        background: '#0d1b35',
        borderBottom: '1px solid #1e3a5f',
        padding: '0.8vh 3vw',
        display: 'flex',
        gap: '2vw',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.9vw', color: '#64748b', fontWeight: 600, marginRight: '0.5vw' }}>Legenda:</span>
        {[
          { status: 'PENDENTE', label: 'Aguardando' },
          { status: 'EM_ATENDIMENTO', label: 'Em Atendimento' },
          { status: 'CONCLUIDO_SALA', label: 'Concluído' },
        ].map(({ status, label }) => {
          const c = SALA_COLORS[status];
          return (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.4vw' }}>
              <div style={{ width: '1.2vw', height: '1.2vw', borderRadius: 4, background: c.bg, border: `2px solid ${c.border}` }} />
              <span style={{ fontSize: '0.9vw', color: '#94a3b8' }}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40% 60%',
        padding: '0.8vh 3vw',
        background: '#0d1b35',
        borderBottom: '1px solid #1e3a5f',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '1vw', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Paciente</span>
        <span style={{ fontSize: '1vw', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Salas</span>
      </div>

      {/* Patient list */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '1vh 3vw' }}>
        {visiblePacientes.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#334155', fontSize: '2vw', fontWeight: 700,
          }}>
            Nenhum paciente em espera
          </div>
        ) : (
          visiblePacientes.map(paciente => {
            const overallStatus = getOverallStatus(paciente);
            const isEmAtendimento = overallStatus === 'EM_ATENDIMENTO';
            const isConcluido = overallStatus === 'CONCLUIDO';
            const salas = paciente.salas || [];

            return (
              <div
                key={paciente.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40% 60%',
                  padding: '1.5vh 1.5vw',
                  marginBottom: '0.6vh',
                  borderRadius: '1vw',
                  background: isConcluido ? '#0f2b1f' : isEmAtendimento ? '#0d2b1a' : '#111f38',
                  border: `1px solid ${isConcluido ? '#166534' : isEmAtendimento ? '#3d7a52' : '#1e3a5f'}`,
                  alignItems: 'center',
                  transition: 'all 0.3s ease',
                  opacity: isConcluido ? 0.6 : 1,
                }}
              >
                {/* Patient name */}
                <div>
                  <p style={{
                    fontSize: '2.2vw',
                    fontWeight: 900,
                    color: isConcluido ? '#4ade80' : isEmAtendimento ? '#a7f3d0' : '#f1f5f9',
                    textTransform: 'uppercase',
                    lineHeight: 1.1,
                    letterSpacing: '0.03em',
                  }}>
                    {paciente.paciente_nome}
                  </p>
                  {isEmAtendimento && (
                    <span style={{
                      display: 'inline-block', marginTop: '0.5vh',
                      background: '#3d7a52', color: '#fff',
                      fontSize: '0.8vw', fontWeight: 700,
                      padding: '0.2vh 0.8vw', borderRadius: 999,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>
                      Em Atendimento
                    </span>
                  )}
                  {isConcluido && (
                    <span style={{
                      display: 'inline-block', marginTop: '0.5vh',
                      background: '#166534', color: '#4ade80',
                      fontSize: '0.8vw', fontWeight: 700,
                      padding: '0.2vh 0.8vw', borderRadius: 999,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>
                      Concluído
                    </span>
                  )}
                </div>

                {/* Room squares */}
                <div style={{ display: 'flex', gap: '1.5vw', flexWrap: 'wrap' }}>
                  {salas.filter(s => s.sala_nome).map((s, i) => (
                    <SalaSquare key={i} status={s.status} nome={s.sala_nome} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Call overlay */}
      {chamadaAtual && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(45, 92, 62, 0.95)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          animation: 'pulse 1s infinite',
        }}>
          <p style={{ fontSize: '2vw', color: '#a7f3d0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '2vh' }}>
            Por favor, dirija-se à sala
          </p>
          <div style={{
            background: '#fff', color: '#2d5c3e',
            padding: '3vh 5vw', borderRadius: '2vw',
            border: '8px solid #a7f3d0', marginBottom: '2vh',
          }}>
            <h2 style={{ fontSize: '6vw', fontWeight: 900, textAlign: 'center', lineHeight: 1 }}>
              {chamadaAtual.paciente_nome}
            </h2>
          </div>
          <div style={{
            background: '#3d7a52', padding: '2vh 3vw', borderRadius: '1.5vw',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '1.2vw', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>Sala</p>
            <h3 style={{ fontSize: '3vw', fontWeight: 900, color: '#fff' }}>{chamadaAtual.sala_nome}</h3>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100vw; height: 100vh; overflow: hidden; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.9; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
      `}</style>
    </div>
  );
}
