'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const SALA_COLORS = {
  PENDENTE: { bg: '#fbbf24', border: '#d97706' },
  EM_ATENDIMENTO: { bg: '#3b82f6', border: '#1d4ed8' },
  CONCLUIDO_SALA: { bg: '#22c55e', border: '#15803d' },
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

// ── Weather helpers ────────────────────────────────────────────────────
function getWeatherInfo(code) {
  if (code === 0) return { icon: '☀️', text: 'Céu Limpo' };
  if (code <= 3)  return { icon: '⛅', text: 'Parcialmente Nublado' };
  if (code <= 48) return { icon: '🌫️', text: 'Neblina' };
  if (code <= 67) return { icon: '🌧️', text: 'Chuva' };
  if (code <= 77) return { icon: '❄️', text: 'Granizo' };
  if (code <= 82) return { icon: '⛈️', text: 'Chuva Forte' };
  if (code <= 99) return { icon: '⚡', text: 'Tempestade' };
  return { icon: '🌡️', text: 'Clima Variável' };
}

async function fetchWeatherData(cidade) {
  const cidadeLimpa = cidade.split(' - ')[0].trim();
  const geo = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidadeLimpa)}&count=1&language=pt&format=json`);
  if (!geo.data.results?.length) return null;
  const { latitude, longitude, name, admin1 } = geo.data.results[0];
  const w = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=America/Sao_Paulo`);
  return {
    cidade: `${name}${admin1 ? ` — ${admin1}` : ''}`,
    temp: w.data.current.temperature_2m,
    code: w.data.current.weather_code,
    humidade: w.data.current.relative_humidity_2m,
    vento: w.data.current.wind_speed_10m,
    max: w.data.daily.temperature_2m_max[0],
    min: w.data.daily.temperature_2m_min[0],
  };
}

function extractImageFromHtml(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

async function fetchNewsData(rssUrl) {
  const res = await axios.get(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl.trim())}`);
  if (!res.data.items?.length) return null;
  const item = res.data.items[Math.floor(Math.random() * Math.min(5, res.data.items.length))];
  const imagem =
    item.thumbnail ||
    item.enclosure?.link ||
    extractImageFromHtml(item.content) ||
    extractImageFromHtml(item.description) ||
    res.data.feed.image ||
    null;
  return {
    titulo: item.title,
    imagem,
    fonte: res.data.feed.title,
  };
}

// ── Weather widget ──────────────────────────────────────────────────────
function WeatherWidget({ conteudo }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchWeatherData(conteudo).then(setData).catch(() => {});
  }, [conteudo]);
  if (!data) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, #3b82f6, #1e40af)' }}>
      <span style={{ color: '#fff', fontSize: '4vw' }}>⏳</span>
    </div>
  );
  const wi = getWeatherInfo(data.code);
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #1e3a8a 0%, #1d4ed8 50%, #3b82f6 100%)', padding: '4vh 2vw', boxSizing: 'border-box', textAlign: 'center', color: '#fff', gap: '2vh' }}>
      <p style={{ fontSize: '1.6vw', fontWeight: 700, opacity: 0.9, letterSpacing: '0.05em' }}>{data.cidade}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5vw' }}>
        <span style={{ fontSize: '7vw' }}>{wi.icon}</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '6vw', fontWeight: 900, lineHeight: 1, fontFamily: 'monospace' }}>{Math.round(data.temp)}°</div>
          <div style={{ fontSize: '1.2vw', opacity: 0.85, marginTop: '0.5vh' }}>{wi.text}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1vw', width: '90%', background: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: '2vh 1vw' }}>
        {[['💧 Umidade', `${data.humidade}%`], ['💨 Vento', `${Math.round(data.vento)} km/h`], ['↕ Min/Max', `${Math.round(data.min)}° / ${Math.round(data.max)}°`]].map(([label, val]) => (
          <div key={label}>
            <p style={{ fontSize: '0.85vw', opacity: 0.7, marginBottom: '0.3vh' }}>{label}</p>
            <p style={{ fontSize: '1.1vw', fontWeight: 700 }}>{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── News widget ─────────────────────────────────────────────────────────
function NewsWidget({ conteudo }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchNewsData(conteudo).then(setData).catch(() => {});
  }, [conteudo]);
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {data?.imagem && (
        <div style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
          <img src={data.imagem} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #000 45%, transparent)' }} />
      {data ? (
        <div style={{ position: 'relative', zIndex: 2, padding: '3vh 2vw' }}>
          <span style={{ display: 'inline-block', background: '#dc2626', color: '#fff', fontSize: '0.9vw', fontWeight: 700, padding: '3px 10px', borderRadius: 4, textTransform: 'uppercase', marginBottom: '1.5vh' }}>
            📰 {data.fonte || 'Notícias'}
          </span>
          <p style={{ fontSize: '1.4vw', fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>{data.titulo}</p>
        </div>
      ) : (
        <div style={{ position: 'relative', zIndex: 2, padding: '3vh 2vw', color: '#fff', opacity: 0.5, fontSize: '1.2vw' }}>Carregando notícias...</div>
      )}
    </div>
  );
}

// ── Media Carousel ──────────────────────────────────────────────────────
function MediaCarousel({ apiUrl }) {
  const [midias, setMidias] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [somAtivo, setSomAtivo] = useState(false);
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  function ativarSom() {
    setSomAtivo(true);
    const v = videoRef.current;
    if (v) { v.muted = false; v.play().catch(() => {}); }
  }

  const fetchMidias = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/tv/midias`);
      setMidias(res.data);
    } catch (err) {
      console.error('[TV-Media] Erro ao buscar mídias:', err.message);
    }
  }, [apiUrl]);

  const advanceSlide = useCallback(() => {
    setCurrentIndex(prev => (midias.length > 0 ? (prev + 1) % midias.length : 0));
  }, [midias.length]);

  const scheduleNext = useCallback((duracao) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(advanceSlide, duracao * 1000);
  }, [advanceSlide]);

  useEffect(() => {
    fetchMidias();
    const interval = setInterval(fetchMidias, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchMidias]);

  useEffect(() => { setCurrentIndex(0); }, [midias.length]);

  useEffect(() => {
    if (midias.length === 0) return;
    const item = midias[currentIndex];
    if (!item) return;
    // VIDEO avança via onEnded; os demais usam timer
    if (item.tipo !== 'VIDEO') {
      scheduleNext(item.duracao_seg || 10);
    }
  }, [currentIndex, midias, scheduleNext]);

  // Fix React muted bug + restart video when cycling back
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = true;
    v.play()
      .then(() => { v.muted = false; })
      .catch(() => {
        const unlock = () => { v.muted = false; v.play().catch(() => {}); };
        document.addEventListener('click', unlock, { once: true });
      });
  }, [currentIndex]);

  const handleVideoEnded = useCallback(() => {
    if (midias.length <= 1) {
      const v = videoRef.current;
      if (v) { v.currentTime = 0; v.play().catch(() => {}); }
    } else {
      advanceSlide();
    }
  }, [midias.length, advanceSlide]);

  if (midias.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a1628', gap: '2vh' }}>
        <img src="/logo-aso.png" alt="ASO Saúde" style={{ maxWidth: '60%', maxHeight: '40%', objectFit: 'contain', opacity: 0.5 }} onError={e => { e.target.style.display = 'none'; }} />
        <p style={{ color: '#334155', fontSize: '1.2vw', fontWeight: 600 }}>ASO Saúde</p>
      </div>
    );
  }

  const item = midias[currentIndex];
  if (!item) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* 9:16 portrait container */}
      <div style={{ position: 'relative', height: '100%', aspectRatio: '9 / 16', maxWidth: '100%', overflow: 'hidden', background: '#000' }}>
        {item.tipo === 'IMAGEM' && (
          <img key={item.id} src={`${apiUrl}${item.arquivo}`} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        {item.tipo === 'VIDEO' && (
          <video key={item.id} ref={videoRef} src={`${apiUrl}${item.arquivo}`} autoPlay muted playsInline loop={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onEnded={handleVideoEnded} onError={advanceSlide}
          />
        )}
        {item.tipo === 'TEMPO' && <WeatherWidget key={item.id} conteudo={item.conteudo} />}
        {item.tipo === 'NOTICIA' && <NewsWidget key={item.id} conteudo={item.conteudo} />}
      </div>

      {/* Botão ativar som */}
      {!somAtivo && (
        <div onClick={ativarSom} style={{ position: 'absolute', top: '1.5vh', right: '1vw', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, padding: '0.8vh 1.2vw', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4vw', zIndex: 10 }}>
          <span style={{ fontSize: '1.2vw' }}>🔇</span>
          <span style={{ fontSize: '0.85vw', color: '#fff', fontWeight: 600 }}>Ativar som</span>
        </div>
      )}

      {/* Slide indicator dots */}
      {midias.length > 1 && (
        <div style={{ position: 'absolute', bottom: '1.5vh', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '0.5vw' }}>
          {midias.map((_, i) => (
            <div key={i} style={{ width: i === currentIndex ? '1.4vw' : '0.6vw', height: '0.6vw', borderRadius: 999, background: i === currentIndex ? '#3d7a52' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s ease' }} />
          ))}
        </div>
      )}
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
      {/* Header — full width */}
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

      {/* Legenda — full width */}
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

      {/* Main content — dois containers lado a lado */}
      <div style={{ flex: 1, display: 'flex', gap: '1.5vw', padding: '1.5vh 2vw', overflow: 'hidden' }}>

        {/* CONTAINER ESQUERDO — Lista de pacientes */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#0d1b35',
          border: '1px solid #1e3a5f',
          borderRadius: '1.2vw',
          overflow: 'hidden',
        }}>
          {/* Header da tabela */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '35% 40% 25%',
            padding: '0.8vh 2vw',
            borderBottom: '1px solid #1e3a5f',
            background: '#0a1628',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '1vw', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Paciente</span>
            <span style={{ fontSize: '1vw', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Salas</span>
            <span style={{ fontSize: '1vw', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>Entrada / Previsão</span>
          </div>

          {/* Lista */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '1vh 2vw' }}>
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

                // Calcula previsão: máx entre salas PENDENTE e EM_ATENDIMENTO
                const minutosRestantes = salas
                  .filter(s => s.status !== 'CONCLUIDO_SALA' && s.tempo_medio_min)
                  .reduce((max, s) => {
                    const mins = s.status === 'EM_ATENDIMENTO'
                      ? s.tempo_medio_min                          // sala atual: usa tempo completo como estimativa
                      : (s.posicao - 1) * s.tempo_medio_min;      // pendente: espera pela fila
                    return Math.max(max, mins);
                  }, 0);
                const previsaoDate = new Date(Date.now() + minutosRestantes * 60000);
                const horaEntrada = paciente.criado_em
                  ? new Date(paciente.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : '--:--';
                const horaPrevisao = minutosRestantes > 0
                  ? previsaoDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : '--:--';

              return (
                  <div
                    key={paciente.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '35% 40% 25%',
                      padding: '0.6vh 1.2vw',
                      marginBottom: '0.3vh',
                      borderRadius: '0.8vw',
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
                        fontSize: '1.5vw',
                        fontWeight: 700,
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

                    {/* Entrada / Previsão */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4vh' }}>
                        <div>
                          <span style={{ fontSize: '0.75vw', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Entrada</span>
                          <span style={{ fontSize: '1.4vw', fontWeight: 700, fontFamily: 'monospace', color: '#94a3b8' }}>{horaEntrada}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75vw', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Previsão</span>
                          <span style={{ fontSize: '1.4vw', fontWeight: 900, fontFamily: 'monospace', color: isEmAtendimento ? '#4ade80' : '#fbbf24' }}>{horaPrevisao}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </main>
        </div>

        {/* CONTAINER DIREITO — Mídia 9:16 */}
        <div style={{
          aspectRatio: '9/16',
          height: '100%',
          background: '#060e1c',
          border: '1px solid #1e3a5f',
          borderRadius: '1.2vw',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <MediaCarousel apiUrl={API_URL} />
        </div>

      </div>

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
