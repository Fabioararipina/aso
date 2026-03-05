'use client';

import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

export default function TvPage() {
  const [lista, setLista] = useState([]);
  const [chamadaAtual, setChamadaAtual] = useState(null);
  const [avisoEncaixe, setAvisoEncaixe] = useState(null); // { medico_nome, tempoMedio }

  const [midias, setMidias] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [weather, setWeather] = useState(null);
  const [news, setNews] = useState(null);

  const [currentTime, setCurrentTime] = useState('--:--');
  const [currentDate, setCurrentDate] = useState('');

  // Ref para manter o AudioContext vivo entre renders
  const audioCtxRef = useRef(null);
  const audioUnlocked = useRef(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-agendamento.primeatende.com.br';

  const fetchDados = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/agendamentos/tv/dados`);
      setLista(res.data);
    } catch (error) {
      console.error('Erro ao buscar dados TV:', error);
    }
  };

  const fetchMidias = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tv-midias`);
      if (res.data.length > 0) setMidias(res.data);
    } catch (e) { console.error('Erro midias', e); }
  };

  const fetchWeather = async (cidade) => {
    try {
      const cidadeLimpa = cidade.split(' - ')[0].trim();
      const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${cidadeLimpa}&count=1&language=pt&format=json`);
      if (!geoRes.data.results) { setWeather({ cidade, temp: '--', code: 0, humidade: '--' }); return; }
      const { latitude, longitude, name, admin1 } = geoRes.data.results[0];
      const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=America/Sao_Paulo`);
      setWeather({
        cidade: `${name} - ${admin1 || ''}`,
        temp: weatherRes.data.current.temperature_2m,
        code: weatherRes.data.current.weather_code,
        humidade: weatherRes.data.current.relative_humidity_2m,
        vento: weatherRes.data.current.wind_speed_10m,
        max: weatherRes.data.daily.temperature_2m_max[0],
        min: weatherRes.data.daily.temperature_2m_min[0]
      });
    } catch (e) { setWeather({ cidade, temp: 'Erro', code: 0, humidade: 'Erro' }); }
  };

  const fetchNews = async (rssUrl) => {
    try {
      const res = await axios.get(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl.trim())}`);
      if (res.data.items && res.data.items.length > 0) {
        const item = res.data.items[Math.floor(Math.random() * Math.min(5, res.data.items.length))];
        setNews({ titulo: item.title, imagem: item.enclosure?.link || item.thumbnail || null, fonte: res.data.feed.title });
      }
    } catch (e) { console.error('Erro news', e); }
  };

  const getWeatherInfo = (code) => {
    if (code === 0) return { icon: '☀️', text: 'Céu Limpo' };
    if (code <= 3) return { icon: '⛅', text: 'Parcialmente Nublado' };
    if (code <= 48) return { icon: '🌫️', text: 'Neblina' };
    if (code <= 67) return { icon: '🌧️', text: 'Chuva' };
    if (code <= 77) return { icon: '❄️', text: 'Granizo' };
    if (code <= 82) return { icon: '⛈️', text: 'Chuva Forte' };
    if (code <= 99) return { icon: '⚡', text: 'Tempestade' };
    return { icon: '🌡️', text: 'Clima Variável' };
  };

  const getAudioCtx = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const playAlertSound = () => {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.value = 0.5;
      osc.start();
      setTimeout(() => { osc.frequency.value = 554.37; }, 400);
      setTimeout(() => { osc.stop(); }, 1200);
    } catch (e) { console.error('Erro som', e); }
  };

  // Fallback via Google Translate TTS — funciona em qualquer browser com áudio (inclusive FireTV)
  const speakFallback = (text) => {
    try {
      const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=pt-BR&client=gtx`;
      const audio = new Audio(url);
      audio.play().catch(e => console.error('Erro TTS fallback', e));
    } catch (e) { console.error('Erro TTS fallback', e); }
  };

  const speakText = (text) => {
    // FireTV/Silk: speechSynthesis existe mas não emite som — vai direto pro Google TTS
    const isSilk = /Silk|AFTM|AFTB|AFTS|AFTT|AFTRS|AFTEK/i.test(navigator.userAgent);
    if (isSilk || !('speechSynthesis' in window)) {
      speakFallback(text);
      return;
    }

    // Chrome/outros: usa Web Speech API nativa
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.85;
      utterance.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.startsWith('pt')) || voices[0];
      if (ptVoice) utterance.voice = ptVoice;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      speakFallback(text);
    }
  };

  useEffect(() => {
    // Força viewport correto no Silk/FireTV — evita zoom indesejado
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no');

    // Fullscreen automático — resolve a barra do browser no FireTV
    const enterFullscreen = () => {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    };
    enterFullscreen();
    document.addEventListener('click', enterFullscreen, { once: true });

    // Unlock de áudio e vozes no primeiro toque/clique — essencial para FireTV
    const unlockAudio = () => {
      if (audioUnlocked.current) return;
      audioUnlocked.current = true;
      const ctx = getAudioCtx();
      if (ctx) ctx.resume();
      // Pré-carrega as vozes de síntese
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        // Chrome/Silk às vezes precisa de uma utterance vazia para desbloquear
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        u.lang = 'pt-BR';
        window.speechSynthesis.speak(u);
      }
    };
    // Tenta desbloquear logo na montagem (funciona no Chrome)
    // e também no primeiro clique/toque (necessário no FireTV)
    setTimeout(unlockAudio, 300);
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    fetchDados();
    fetchMidias();

    const socket = io(API_URL);
    socket.on('agendamento-atualizado', () => fetchDados());
    socket.on('agendamento-confirmado', () => fetchDados());
    socket.on('novo-agendamento', () => fetchDados());
    socket.on('encaixe-adicionado', ({ agendamento, tempoMedio }) => {
      fetchDados();
      setAvisoEncaixe({ medico_nome: agendamento.medico_nome, tempoMedio });
      playAlertSound();
      speakText(`Atenção! Um atendimento prioritário foi encaixado na agenda do Doutor ${agendamento.medico_nome}. O tempo de espera pode aumentar aproximadamente ${tempoMedio} minutos.`);
      setTimeout(() => setAvisoEncaixe(null), 12000);
    });

    socket.on('chamar-paciente', (agendamento) => {
      setChamadaAtual(agendamento);
      playAlertSound();
      speakText(`Paciente ${agendamento.paciente_nome}, comparecer ao consultório do Doutor ${agendamento.medico_nome}`);
      setTimeout(() => { setChamadaAtual(null); }, 15000);
    });

    const interval = setInterval(fetchDados, 60000);

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
    };
  }, []);

  useEffect(() => {
    if (midias.length === 0) return;
    const currentSlide = midias[currentSlideIndex];
    if (currentSlide.tipo === 'TEMPO' && !weather) fetchWeather(currentSlide.conteudo);
    else if (currentSlide.tipo === 'NOTICIA' && !news) fetchNews(currentSlide.conteudo);
    const timer = setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % midias.length);
      setWeather(null);
      setNews(null);
    }, currentSlide.duracao * 1000);
    return () => clearTimeout(timer);
  }, [currentSlideIndex, midias]);

  // Padding de safe area — ajustável via ?safe=N (padrão: 3)
  const safeArea = (() => {
    if (typeof window === 'undefined') return '3vh 4vw';
    const params = new URLSearchParams(window.location.search);
    const s = parseFloat(params.get('safe')) || 3;
    return `${s}vh ${s * 1.33}vw`;
  })();

  // Tamanhos de fonte em vw — escalam proporcionalmente com a largura da tela
  const fs = {
    xs:   { fontSize: '1vw' },
    sm:   { fontSize: '1.2vw' },
    base: { fontSize: '1.4vw' },
    lg:   { fontSize: '1.7vw' },
    xl:   { fontSize: '2vw' },
    xl2:  { fontSize: '2.5vw' },
    xl3:  { fontSize: '3vw' },
    xl4:  { fontSize: '4vw' },
    xl5:  { fontSize: '5vw' },
  };

  const statusStyle = (status) => {
    if (status === 'EM_ATENDIMENTO') return { background: '#2563eb', color: '#fff' };
    if (status === 'PRESENTE') return { background: '#dcfce7', color: '#15803d' };
    return { background: '#f3f4f6', color: '#6b7280' };
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: '#111827',
      color: '#fff',
      fontFamily: 'sans-serif',
      boxSizing: 'border-box',
      padding: safeArea,
    }}>

      {/* ── HEADER ── */}
      <header style={{
        background: '#1e3a8a',
        padding: '1vh 2vw 1vh 2vw',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        borderBottom: '1px solid #1e40af',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5vw' }}>
          <img
            src="/logo.png"
            alt="Essencial Saúde"
            style={{ height: '8vh', background: '#fff', borderRadius: 8, padding: 6, objectFit: 'contain' }}
          />
          <p style={{ ...fs.base, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            Painel de Atendimento
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...fs.xl4, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}>{currentTime}</div>
          <div style={{ ...fs.sm, color: '#93c5fd', marginTop: 4 }}>{currentDate}</div>
        </div>
      </header>

      {/* ── CONTEÚDO ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        gap: '1vw',
        padding: '1vh 2vw 1vh 1vw',
        overflow: 'hidden',
        minHeight: 0,
      }}>

        {/* COLUNA ESQUERDA: MÍDIA */}
        <div style={{ width: '22vw', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            flex: 1,
            background: '#1f2937',
            borderRadius: 16,
            border: '1px solid #374151',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {midias.length === 0 ? (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                padding: '2vw', background: 'linear-gradient(135deg,#1f2937,#111827)',
              }}>
                <span style={{ fontSize: '5vw', marginBottom: '1vh' }}>🌳</span>
                <h2 style={{ ...fs.xl, fontWeight: 700, color: '#4ade80', marginBottom: '1vh' }}>Cartão Essencial</h2>
                <p style={{ ...fs.sm, color: '#d1d5db' }}>Descontos exclusivos em exames e consultas.</p>
                <div style={{ marginTop: '2vh', background: '#fff', padding: 12, borderRadius: 12 }}>
                  <div style={{ width: '10vw', height: '10vw', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, ...fs.sm }}>
                    QR CODE
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>

                {midias[currentSlideIndex].tipo === 'IMAGEM' && (
                  <img
                    src={`${API_URL}/uploads/tv/${midias[currentSlideIndex].conteudo}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}

                {midias[currentSlideIndex].tipo === 'VIDEO' && (
                  <video
                    src={`${API_URL}/uploads/tv/${midias[currentSlideIndex].conteudo}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    autoPlay
                    onEnded={() => {
                      setCurrentSlideIndex((prev) => (prev + 1) % midias.length);
                      setWeather(null);
                      setNews(null);
                    }}
                  />
                )}

                {midias[currentSlideIndex].tipo === 'TEMPO' && (
                  <div style={{
                    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(to bottom, #3b82f6, #1e40af)',
                    padding: '2vw', textAlign: 'center', boxSizing: 'border-box',
                  }}>
                    {weather ? (
                      <>
                        <h2 style={{ ...fs.base, fontWeight: 700, marginBottom: '1vh' }}>{weather.cidade}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1vw', marginBottom: '1.5vh' }}>
                          <span style={{ fontSize: '4vw' }}>{getWeatherInfo(weather.code).icon}</span>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ ...fs.xl3, fontWeight: 900, lineHeight: 1 }}>{Math.round(weather.temp)}°</div>
                            <div style={{ ...fs.sm, opacity: 0.9 }}>{getWeatherInfo(weather.code).text}</div>
                          </div>
                        </div>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                          gap: '0.5vw', width: '100%',
                          background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '1vh 0.5vw',
                        }}>
                          {[['Umidade', `${weather.humidade}%`], ['Vento', `${weather.vento} km/h`], ['Min/Max', `${Math.round(weather.min)}°/${Math.round(weather.max)}°`]].map(([label, val]) => (
                            <div key={label}>
                              <p style={{ ...fs.xs, textTransform: 'uppercase', opacity: 0.7 }}>{label}</p>
                              <p style={{ ...fs.sm, fontWeight: 700 }}>{val}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <span style={fs.base}>Carregando...</span>}
                  </div>
                )}

                {midias[currentSlideIndex].tipo === 'NOTICIA' && (
                  <div style={{
                    width: '100%', height: '100%', display: 'flex',
                    flexDirection: 'column', justifyContent: 'flex-end',
                    background: '#000', position: 'relative', overflow: 'hidden',
                  }}>
                    {news ? (
                      <>
                        {news.imagem && (
                          <div style={{ position: 'absolute', inset: 0, opacity: 0.6 }}>
                            <img src={news.imagem} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #000 40%, transparent)' }}></div>
                        <div style={{ position: 'relative', zIndex: 10, padding: '1.5vw', textAlign: 'left' }}>
                          <span style={{ background: '#dc2626', color: '#fff', ...fs.xs, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', marginBottom: 8, display: 'inline-block' }}>
                            {news.fonte || 'Notícia'}
                          </span>
                          <h2 style={{ ...fs.sm, fontWeight: 700, lineHeight: 1.3 }}>{news.titulo}</h2>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <span style={fs.xl}>↻</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PROGRESS BAR */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, height: 4, background: '#22c55e', width: '100%', opacity: 0.6 }}></div>
          </div>
        </div>

        {/* COLUNA DIREITA: LISTA DE ESPERA */}
        <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 20, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>

          {/* Cabeçalho */}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: '#f3f4f6', borderBottom: '1px solid #e5e7eb',
            padding: '1.2vh 1.5vw', flexShrink: 0,
          }}>
            <span style={{ ...fs.sm, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', width: '10%' }}>Horário</span>
            <span style={{ ...fs.sm, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', width: '28%' }}>Paciente</span>
            <span style={{ ...fs.sm, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', width: '27%', paddingLeft: '1vw' }}>Médico</span>
            <span style={{ ...fs.sm, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', width: '20%', textAlign: 'center' }}>Status</span>
            <span style={{ ...fs.sm, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', width: '15%', textAlign: 'right' }}>Previsão</span>
          </div>

          {/* Linhas */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {lista.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', ...fs.lg }}>
                Agenda vazia por enquanto.
              </div>
            ) : (
              lista.map((item) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center',
                  padding: '1.5vh 1.5vw',
                  borderBottom: '1px solid #f3f4f6',
                  background: item.status === 'EM_ATENDIMENTO' ? '#eff6ff' : '#fff',
                }}>
                  {/* Horário */}
                  <span style={{ ...fs.xl, color: '#6b7280', fontFamily: 'monospace', fontWeight: 700, width: '10%' }}>
                    {item.horario.slice(0, 5)}
                  </span>
                  {/* Paciente */}
                  <span style={{ ...fs.xs, color: '#111827', fontWeight: 900, textTransform: 'uppercase', width: '28%', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '0.5vw' }}>
                    {item.tipo_consulta === 'ENCAIXE' && (
                      <span style={{ fontSize: '1.2vw', background: '#dc2626', color: '#fff', borderRadius: 4, padding: '2px 6px', fontWeight: 900, flexShrink: 0 }}>🚨 URGENTE</span>
                    )}
                    {item.paciente_nome}
                  </span>
                  {/* Médico */}
                  <div style={{ width: '27%', display: 'flex', alignItems: 'center', gap: '0.8vw', paddingLeft: '1vw' }}>
                    {item.foto_path ? (
                      <img
                        src={`${API_URL}/uploads/medicos/${item.foto_path}`}
                        style={{ width: '4vw', height: '4vw', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: '4vw', height: '4vw', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', ...fs.sm, flexShrink: 0 }}>Dr</div>
                    )}
                    <span style={{ ...fs.base, fontWeight: 700, color: '#374151', lineHeight: 1.3 }}>{item.medico_nome}</span>
                  </div>
                  {/* Status */}
                  <div style={{ width: '20%', textAlign: 'center' }}>
                    <span style={{
                      ...fs.xs, fontWeight: 900, textTransform: 'uppercase',
                      borderRadius: 999, padding: '0.5vh 1vw', display: 'inline-block',
                      ...statusStyle(item.status),
                    }}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                  {/* Previsão */}
                  <span style={{ ...fs.xl, fontFamily: 'monospace', fontWeight: 900, color: '#2563eb', width: '15%', textAlign: 'right' }}>
                    {item.previsao}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* ── OVERLAY DE ENCAIXE ── */}
      {avisoEncaixe && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(185,28,28,0.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: 'pulse 1.5s infinite',
        }}>
          <div style={{ fontSize: '5vw', marginBottom: '2vh' }}>🚨</div>
          <h1 style={{ ...fs.xl3, fontWeight: 900, color: '#fff', marginBottom: '1vh', textAlign: 'center' }}>
            ENCAIXE DE URGÊNCIA
          </h1>
          <p style={{ ...fs.xl, color: '#fecaca', marginBottom: '2vh', textAlign: 'center' }}>
            Dr(a). {avisoEncaixe.medico_nome}
          </p>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '1.5vh 3vw', textAlign: 'center' }}>
            <p style={{ ...fs.lg, color: '#fff' }}>
              ⏱️ Tempo de espera pode aumentar ~<strong>{avisoEncaixe.tempoMedio} min</strong>
            </p>
            <p style={{ ...fs.base, color: '#fca5a5', marginTop: '0.5vh' }}>
              Pedimos desculpas pelo transtorno.
            </p>
          </div>
        </div>
      )}

      {/* ── OVERLAY DE CHAMADA ── */}
      {chamadaAtual && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, background: '#1d4ed8',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: 'pulse 1.5s infinite',
        }}>
          <h1 style={{ ...fs.xl2, fontWeight: 700, color: '#fff', marginBottom: '2vh', textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.9 }}>
            Por favor, dirija-se ao consultório
          </h1>
          <div style={{ background: '#fff', color: '#1e3a8a', padding: '3vh 5vw', borderRadius: '2vw', marginBottom: '2vh', border: '8px solid #93c5fd' }}>
            <h2 style={{ ...fs.xl5, fontWeight: 900, textAlign: 'center', lineHeight: 1.1 }}>{chamadaAtual.paciente_nome}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2vw', background: '#1e40af', padding: '2vh 3vw', borderRadius: '1.5vw' }}>
            {chamadaAtual.foto_path && (
              <img src={`${API_URL}/uploads/medicos/${chamadaAtual.foto_path}`} style={{ width: '10vw', height: '10vw', borderRadius: '50%', border: '4px solid #fff', objectFit: 'cover' }} />
            )}
            <div>
              <p style={{ ...fs.sm, color: '#93c5fd', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.15em' }}>Médico(a)</p>
              <h2 style={{ ...fs.xl3, fontWeight: 700, color: '#fff' }}>{chamadaAtual.medico_nome}</h2>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100vw; height: 100vh; overflow: hidden; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.85; } }
      `}</style>
    </div>
  );
}