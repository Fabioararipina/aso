'use client';

import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

// Página TV otimizada para FireTV / browsers antigos
// Técnica: design fixo em 1920x1080, auto-escala via transform para caber na tela
export default function TvFireTvPage() {
  const [lista, setLista] = useState([]);
  const [chamadaAtual, setChamadaAtual] = useState(null);
  const [midias, setMidias] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [weather, setWeather] = useState(null);
  const [news, setNews] = useState(null);
  const [currentTime, setCurrentTime] = useState('--:--');
  const [currentDate, setCurrentDate] = useState('');
  const [scale, setScale] = useState(1);
  const wrapperRef = useRef(null);

  const API_URL = 'https://api-agendamento.primeatende.com.br';
  const BASE_W = 1920;
  const BASE_H = 1080;

  // Auto-escala: calcula o fator para caber exatamente na tela
  useEffect(() => {
    // Força viewport correto no Silk/FireTV — evita zoom indesejado após reload
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no');

    function calcScale() {
      const params = new URLSearchParams(window.location.search);
      const forceScale = params.get('scale');
      if (forceScale) {
        setScale(parseFloat(forceScale));
        return;
      }
      const sx = window.innerWidth / BASE_W;
      const sy = window.innerHeight / BASE_H;
      // Limita scale a 1.0 para evitar zoom se o browser reportar viewport maior que 1920x1080
      setScale(Math.min(sx, sy, 1));
    }
    calcScale();
    window.addEventListener('resize', calcScale);
    return () => window.removeEventListener('resize', calcScale);
  }, []);

  const fetchDados = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/agendamentos/tv/dados`);
      setLista(res.data);
    } catch (e) { console.error('Erro dados', e); }
  };

  const fetchMidias = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tv-midias`);
      if (res.data.length > 0) setMidias(res.data);
    } catch (e) { console.error('Erro midias', e); }
  };

  const fetchWeather = async (cidade) => {
    try {
      const c = cidade.split(' - ')[0].trim();
      const geo = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${c}&count=1&language=pt&format=json`);
      if (!geo.data.results) return;
      const { latitude, longitude, name, admin1 } = geo.data.results[0];
      const w = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=America/Sao_Paulo`);
      setWeather({
        cidade: `${name} - ${admin1 || ''}`,
        temp: w.data.current.temperature_2m,
        code: w.data.current.weather_code,
        humidade: w.data.current.relative_humidity_2m,
        vento: w.data.current.wind_speed_10m,
        max: w.data.daily.temperature_2m_max[0],
        min: w.data.daily.temperature_2m_min[0],
      });
    } catch (e) { console.error('Erro weather', e); }
  };

  const fetchNews = async (rssUrl) => {
    try {
      const res = await axios.get(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl.trim())}`);
      if (res.data.items?.length > 0) {
        const item = res.data.items[Math.floor(Math.random() * Math.min(5, res.data.items.length))];
        setNews({ titulo: item.title, imagem: item.enclosure?.link || item.thumbnail || null, fonte: res.data.feed.title });
      }
    } catch (e) { console.error('Erro news', e); }
  };

  const getWeatherInfo = (code) => {
    if (code === 0) return { icon: '☀️', text: 'Céu Limpo' };
    if (code <= 3)  return { icon: '⛅', text: 'Parcialmente Nublado' };
    if (code <= 48) return { icon: '🌫️', text: 'Neblina' };
    if (code <= 67) return { icon: '🌧️', text: 'Chuva' };
    if (code <= 77) return { icon: '❄️', text: 'Granizo' };
    if (code <= 82) return { icon: '⛈️', text: 'Chuva Forte' };
    if (code <= 99) return { icon: '⚡', text: 'Tempestade' };
    return { icon: '🌡️', text: 'Clima Variável' };
  };

  const playAlert = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = 440; gain.gain.value = 0.5;
      osc.start();
      setTimeout(() => { osc.frequency.value = 554; }, 400);
      setTimeout(() => { osc.stop(); }, 1200);
    } catch (e) {}
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR'; u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  };

  useEffect(() => {
    fetchDados(); fetchMidias();
    const socket = io(API_URL);
    socket.on('agendamento-atualizado', fetchDados);
    socket.on('agendamento-confirmado', fetchDados);
    socket.on('novo-agendamento', fetchDados);
    socket.on('chamar-paciente', (ag) => {
      setChamadaAtual(ag);
      playAlert();
      speak(`Paciente ${ag.paciente_nome}, comparecer ao consultório do Doutor ${ag.medico_nome}`);
      setTimeout(() => setChamadaAtual(null), 15000);
    });
    const iv = setInterval(fetchDados, 60000);
    const clockIv = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
    }, 1000);
    return () => { socket.disconnect(); clearInterval(iv); clearInterval(clockIv); };
  }, []);

  useEffect(() => {
    if (midias.length === 0) return;
    const slide = midias[currentSlideIndex];
    if (slide.tipo === 'TEMPO' && !weather) fetchWeather(slide.conteudo);
    if (slide.tipo === 'NOTICIA' && !news) fetchNews(slide.conteudo);
    const t = setTimeout(() => {
      setCurrentSlideIndex((p) => (p + 1) % midias.length);
      setWeather(null); setNews(null);
    }, slide.duracao * 1000);
    return () => clearTimeout(t);
  }, [currentSlideIndex, midias]);

  // Estilos inline (sem Tailwind) para máxima compatibilidade com browsers antigos
  const styles = {
    outer: {
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: '#111', overflow: 'hidden',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
    },
    wrapper: {
      width: BASE_W + 'px',
      height: BASE_H + 'px',
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      background: '#1a1a2e',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      color: '#fff',
    },
    header: {
      background: '#1e3a8a',
      padding: '20px 48px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '2px solid #3b5fc0',
      flexShrink: 0,
      height: '120px',
    },
    logoArea: { display: 'flex', alignItems: 'center', gap: '24px' },
    logo: { height: '80px', objectFit: 'contain', background: '#fff', borderRadius: '10px', padding: '6px' },
    subtitle: { color: '#93c5fd', fontSize: '22px', fontWeight: '600', letterSpacing: '4px', textTransform: 'uppercase' },
    clockArea: { textAlign: 'right' },
    clock: { fontSize: '72px', fontWeight: '900', fontFamily: 'monospace', lineHeight: 1 },
    clockDate: { color: '#93c5fd', fontSize: '20px', marginTop: '4px' },
    main: {
      flex: 1,
      display: 'flex',
      padding: '24px',
      gap: '24px',
      overflow: 'hidden',
    },
    leftCol: {
      width: '380px',
      flexShrink: 0,
      background: '#0f172a',
      borderRadius: '16px',
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid #334155',
    },
    rightCol: {
      flex: 1,
      background: '#fff',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
    tableHeader: {
      background: '#f1f5f9',
      padding: '18px 24px',
      display: 'flex',
      borderBottom: '2px solid #e2e8f0',
      color: '#64748b',
      fontWeight: '800',
      fontSize: '18px',
      textTransform: 'uppercase',
      letterSpacing: '1px',
    },
    tableBody: { flex: 1, overflowY: 'auto' },
    emptyMsg: {
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#94a3b8', fontSize: '28px',
    },
    row: (status) => ({
      display: 'flex',
      alignItems: 'center',
      padding: '16px 24px',
      borderBottom: '1px solid #f1f5f9',
      background: status === 'EM_ATENDIMENTO' ? '#eff6ff' : '#fff',
    }),
    colHorario: { width: '110px', flexShrink: 0, fontSize: '28px', fontWeight: '900', fontFamily: 'monospace', color: '#475569' },
    colPaciente: { flex: 1, fontSize: '34px', fontWeight: '900', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '-0.5px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
    colMedico: { width: '300px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px' },
    medicoFoto: { width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', flexShrink: 0 },
    medicoFotoPlaceholder: { width: '60px', height: '60px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '18px', fontWeight: '700', flexShrink: 0 },
    medicoNome: { fontSize: '20px', fontWeight: '700', color: '#374151', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
    colStatus: { width: '200px', flexShrink: 0, textAlign: 'center' },
    colPrevisao: { width: '100px', flexShrink: 0, textAlign: 'right', fontSize: '36px', fontWeight: '900', fontFamily: 'monospace', color: '#2563eb' },
    badge: (status) => ({
      display: 'inline-block',
      padding: '6px 14px',
      borderRadius: '999px',
      fontSize: '15px',
      fontWeight: '900',
      textTransform: 'uppercase',
      ...(status === 'EM_ATENDIMENTO' ? { background: '#2563eb', color: '#fff' } :
          status === 'PRESENTE'       ? { background: '#dcfce7', color: '#16a34a' } :
                                        { background: '#f1f5f9', color: '#64748b' }),
    }),
    overlay: {
      position: 'absolute', inset: 0, zIndex: 50,
      background: '#1d4ed8',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    },
    overlayTitle: { fontSize: '52px', fontWeight: '700', color: '#fff', marginBottom: '48px', textAlign: 'center', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.9 },
    overlayNome: { background: '#fff', color: '#1e3a8a', padding: '40px 96px', borderRadius: '48px', marginBottom: '48px', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' },
    overlayNomeText: { fontSize: '100px', fontWeight: '900', textAlign: 'center', lineHeight: 1.1 },
    overlayMedico: { background: '#1e40af', padding: '32px 64px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '32px' },
    overlayMedicoFoto: { width: '140px', height: '140px', borderRadius: '50%', border: '6px solid #fff' },
    overlayMedicoLabel: { color: '#93c5fd', fontSize: '24px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '8px' },
    overlayMedicoNome: { color: '#fff', fontSize: '60px', fontWeight: '700' },
  };

  const currentSlide = midias[currentSlideIndex];

  return (
    <div style={styles.outer}>
      <div ref={wrapperRef} style={styles.wrapper}>

        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.logoArea}>
            <img src="/logo.png" alt="Logo" style={styles.logo} />
            <div>
              <div style={styles.subtitle}>Painel de Atendimento</div>
            </div>
          </div>
          <div style={styles.clockArea}>
            <div style={styles.clock}>{currentTime}</div>
            <div style={styles.clockDate}>{currentDate}</div>
          </div>
        </div>

        {/* MAIN */}
        <div style={styles.main}>

          {/* COLUNA ESQUERDA: MÍDIA */}
          <div style={styles.leftCol}>
            {midias.length === 0 ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
                <div style={{ fontSize: '80px', marginBottom: '24px' }}>🌳</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#4ade80', marginBottom: '12px' }}>Cartão Essencial</div>
                <div style={{ fontSize: '20px', color: '#94a3b8' }}>Descontos exclusivos em exames e consultas</div>
              </div>
            ) : currentSlide ? (
              <div style={{ position: 'absolute', inset: 0 }}>
                {currentSlide.tipo === 'IMAGEM' && (
                  <img src={`${API_URL}/uploads/tv/${currentSlide.conteudo}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {currentSlide.tipo === 'VIDEO' && (
                  <video src={`${API_URL}/uploads/tv/${currentSlide.conteudo}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay muted loop />
                )}
                {currentSlide.tipo === 'TEMPO' && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)', padding: '32px', textAlign: 'center' }}>
                    {weather ? (
                      <>
                        <div style={{ fontSize: '26px', fontWeight: '700', marginBottom: '16px' }}>{weather.cidade}</div>
                        <div style={{ fontSize: '72px', marginBottom: '8px' }}>{getWeatherInfo(weather.code).icon}</div>
                        <div style={{ fontSize: '80px', fontWeight: '900', lineHeight: 1 }}>{Math.round(weather.temp)}°</div>
                        <div style={{ fontSize: '20px', opacity: 0.85, marginBottom: '24px' }}>{getWeatherInfo(weather.code).text}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
                          <div><div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase' }}>Umidade</div><div style={{ fontSize: '24px', fontWeight: '700' }}>{weather.humidade}%</div></div>
                          <div><div style={{ fontSize: '12px', opacity: 0.7, textTransform: 'uppercase' }}>Vento</div><div style={{ fontSize: '24px', fontWeight: '700' }}>{weather.vento} km/h</div></div>
                        </div>
                      </>
                    ) : <div style={{ fontSize: '28px' }}>Carregando...</div>}
                  </div>
                )}
                {currentSlide.tipo === 'NOTICIA' && (
                  <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    {news ? (
                      <>
                        {news.imagem && <img src={news.imagem} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #000 0%, transparent 60%)' }} />
                        <div style={{ position: 'relative', zIndex: 1, padding: '24px' }}>
                          <div style={{ background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: '700', padding: '4px 10px', borderRadius: '4px', display: 'inline-block', marginBottom: '10px', textTransform: 'uppercase' }}>{news.fonte}</div>
                          <div style={{ fontSize: '22px', fontWeight: '700', lineHeight: 1.3 }}>{news.titulo}</div>
                        </div>
                      </>
                    ) : <div style={{ padding: '24px', fontSize: '24px' }}>Carregando...</div>}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* COLUNA DIREITA: LISTA DE ESPERA */}
          <div style={styles.rightCol}>
            <div style={styles.tableHeader}>
              <span style={{ width: '110px' }}>Horário</span>
              <span style={{ flex: 1, paddingLeft: '8px' }}>Paciente</span>
              <span style={{ width: '300px' }}>Médico</span>
              <span style={{ width: '200px', textAlign: 'center' }}>Status</span>
              <span style={{ width: '100px', textAlign: 'right' }}>Prev.</span>
            </div>
            <div style={styles.tableBody}>
              {lista.length === 0 ? (
                <div style={styles.emptyMsg}>Agenda vazia por enquanto.</div>
              ) : lista.map((item) => (
                <div key={item.id} style={styles.row(item.status)}>
                  <div style={styles.colHorario}>{item.horario.slice(0, 5)}</div>
                  <div style={styles.colPaciente}>{item.paciente_nome}</div>
                  <div style={styles.colMedico}>
                    {item.foto_path
                      ? <img src={`${API_URL}/uploads/medicos/${item.foto_path}`} style={styles.medicoFoto} />
                      : <div style={styles.medicoFotoPlaceholder}>Dr</div>
                    }
                    <div style={styles.medicoNome}>{item.medico_nome}</div>
                  </div>
                  <div style={styles.colStatus}>
                    <span style={styles.badge(item.status)}>{item.status.replace('_', ' ')}</span>
                  </div>
                  <div style={styles.colPrevisao}>{item.previsao}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* OVERLAY CHAMADA */}
        {chamadaAtual && (
          <div style={styles.overlay}>
            <div style={styles.overlayTitle}>Por favor, dirija-se ao consultório</div>
            <div style={styles.overlayNome}>
              <div style={styles.overlayNomeText}>{chamadaAtual.paciente_nome}</div>
            </div>
            <div style={styles.overlayMedico}>
              {chamadaAtual.foto_path && (
                <img src={`${API_URL}/uploads/medicos/${chamadaAtual.foto_path}`} style={styles.overlayMedicoFoto} />
              )}
              <div>
                <div style={styles.overlayMedicoLabel}>Médico(a)</div>
                <div style={styles.overlayMedicoNome}>{chamadaAtual.medico_nome}</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
