'use client';

import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

// Página otimizada para TVs antigas (LG WebOS, Samsung Tizen antigos)
// Evita uso de Flex-Gap, Grid complexo e efeitos de blur/sombra pesados.
export default function TvLegacyPage() {
  const [lista, setLista] = useState([]);
  const [chamadaAtual, setChamadaAtual] = useState(null);
  
  // Estados de Mídia
  const [midias, setMidias] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [weather, setWeather] = useState(null);
  const [news, setNews] = useState(null);

  // URL da API
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.20.19:5000';

  // Refs para controle de áudio
  const audioContextRef = useRef(null);

  // --- FUNÇÕES DE BUSCA ---
  const fetchDados = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/agendamentos/tv/dados`);
      setLista(res.data);
    } catch (error) { console.error('Erro dados:', error); }
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
      if (!geoRes.data.results) { setWeather(null); return; }
      const { latitude, longitude } = geoRes.data.results[0];
      const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m&timezone=America/Sao_Paulo`);
      
      setWeather({
        cidade: cidade,
        temp: weatherRes.data.current.temperature_2m,
        code: weatherRes.data.current.weather_code,
        humidade: weatherRes.data.current.relative_humidity_2m
      });
    } catch (e) { setWeather(null); }
  };

  const fetchNews = async (rssUrl) => {
    try {
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl.trim())}`;
      const res = await axios.get(apiUrl);
      if (res.data.items && res.data.items.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(5, res.data.items.length));
        const item = res.data.items[randomIndex];
        setNews({ titulo: item.title, imagem: item.thumbnail || null, fonte: res.data.feed.title });
      }
    } catch (e) { console.error('Erro news', e); }
  };

  // --- ÁUDIO COMPATÍVEL ---
  const playAlertSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
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
    } catch (e) { console.error('Erro audio:', e); }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- EFEITOS ---
  useEffect(() => {
    fetchDados();
    fetchMidias();

    const socket = io(API_URL);
    socket.on('connect', () => console.log('Socket TV Legacy conectado'));
    
    // Atualizações
    const eventos = ['agendamento-atualizado', 'agendamento-confirmado', 'novo-agendamento'];
    eventos.forEach(ev => socket.on(ev, () => fetchDados()));

    // Chamada
    socket.on('chamar-paciente', (agendamento) => {
      setChamadaAtual(agendamento);
      playAlertSound();
      speakText(`Paciente ${agendamento.paciente_nome}, comparecer ao consultório.`);
      setTimeout(() => setChamadaAtual(null), 15000);
    });

    const interval = setInterval(fetchDados, 30000);
    return () => { socket.disconnect(); clearInterval(interval); };
  }, []);

  // Timer do Carrossel
  useEffect(() => {
    if (midias.length === 0) return;
    const slide = midias[currentSlideIndex];

    if (slide.tipo === 'TEMPO' && !weather) fetchWeather(slide.conteudo);
    if (slide.tipo === 'NOTICIA' && !news) fetchNews(slide.conteudo);

    const time = (slide.duracao || 10) * 1000;
    const timer = setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % midias.length);
      setWeather(null);
      setNews(null);
    }, time);

    return () => clearTimeout(timer);
  }, [currentSlideIndex, midias]);

  // --- RENDERIZAÇÃO ESTILO CLÁSSICO (TABLES & FLOATS) ---
  return (
    <div style={styles.container}>
      
      {/* HEADER */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="Logo" style={styles.logo} />
          <div style={{ marginLeft: '20px' }}>
            <h1 style={styles.title}>PAINEL DE ATENDIMENTO</h1>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={styles.clock}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={styles.body}>
        
        {/* ESQUERDA: MÍDIA (25%) */}
        <div style={styles.leftColumn}>
          {midias.length === 0 ? (
            <div style={styles.placeholderMedia}>
              <h2>Bem-vindo</h2>
              <p>Essencial Saúde</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' }}>
              {midias[currentSlideIndex].tipo === 'IMAGEM' && (
                <img src={`${API_URL}/uploads/tv/${midias[currentSlideIndex].conteudo}`} style={styles.mediaImage} />
              )}
              {midias[currentSlideIndex].tipo === 'VIDEO' && (
                <video src={`${API_URL}/uploads/tv/${midias[currentSlideIndex].conteudo}`} style={styles.mediaImage} autoPlay muted loop />
              )}
              {midias[currentSlideIndex].tipo === 'TEMPO' && (
                <div style={styles.weatherBox}>
                  <h1>{weather ? Math.round(weather.temp) + '°C' : '--'}</h1>
                  <h3>{weather?.cidade || 'Carregando...'}</h3>
                </div>
              )}
              {midias[currentSlideIndex].tipo === 'NOTICIA' && (
                <div style={styles.newsBox}>
                  {news?.imagem && <img src={news.imagem} style={styles.newsImage} />}
                  <div style={styles.newsText}>
                    <h3>{news?.titulo || 'Carregando notícias...'}</h3>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DIREITA: TABELA (75%) */}
        <div style={styles.rightColumn}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={{ width: '15%', padding: '15px' }}>HORÁRIO</th>
                <th style={{ width: '40%', padding: '15px' }}>PACIENTE</th>
                <th style={{ width: '25%', padding: '15px' }}>MÉDICO</th>
                <th style={{ width: '20%', padding: '15px' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '50px', fontSize: '24px', color: '#666' }}>Sem atendimentos no momento.</td></tr>
              ) : (
                lista.map((item, idx) => (
                  <tr key={item.id} style={{ 
                    backgroundColor: item.status === 'EM_ATENDIMENTO' ? '#e3f2fd' : (idx % 2 === 0 ? '#fff' : '#f9fafb'),
                    color: item.status === 'EM_ATENDIMENTO' ? '#1565c0' : '#333',
                    borderBottom: '1px solid #ddd'
                  }}>
                    <td style={{ padding: '20px', fontSize: '28px', fontWeight: 'bold', textAlign: 'center' }}>
                      {item.horario.slice(0, 5)}
                    </td>
                    <td style={{ padding: '20px', fontSize: '32px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {item.paciente_nome}
                    </td>
                    <td style={{ padding: '20px', fontSize: '24px' }}>
                      Dr(a). {item.medico_nome.split(' ')[0]}
                    </td>
                    <td style={{ padding: '20px', textAlign: 'center' }}>
                      <span style={{
                        padding: '10px 20px',
                        borderRadius: '50px',
                        backgroundColor: item.status === 'EM_ATENDIMENTO' ? '#2196f3' : '#e0e0e0',
                        color: item.status === 'EM_ATENDIMENTO' ? '#fff' : '#757575',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}>
                        {item.status === 'EM_ATENDIMENTO' ? 'CHAMANDO' : item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OVERLAY DE CHAMADA */}
      {chamadaAtual && (
        <div style={styles.overlay}>
          <div style={styles.overlayBox}>
            <h2 style={{ fontSize: '40px', color: '#ffeb3b', marginBottom: '20px', textTransform: 'uppercase' }}>Atenção Paciente</h2>
            <h1 style={{ fontSize: '90px', margin: '20px 0', lineHeight: '1.1' }}>{chamadaAtual.paciente_nome}</h1>
            <h3 style={{ fontSize: '50px', marginTop: '40px', color: '#90caf9' }}>
              Consultório: Dr(a). {chamadaAtual.medico_nome}
            </h3>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos em Objeto JS (Inline Styles) para garantir compatibilidade máxima
const styles = {
  container: {
    backgroundColor: '#f0f2f5',
    height: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden'
  },
  header: {
    height: '120px',
    backgroundColor: '#1565c0',
    color: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 40px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
    zIndex: 10
  },
  logo: {
    height: '80px',
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '5px'
  },
  title: {
    fontSize: '32px',
    margin: 0,
    letterSpacing: '2px'
  },
  clock: {
    fontSize: '60px',
    fontWeight: 'bold',
    fontFamily: 'monospace'
  },
  body: {
    flex: 1,
    display: 'flex',
    padding: '20px',
    height: 'calc(100vh - 120px)',
    boxSizing: 'border-box'
  },
  leftColumn: {
    width: '30%',
    marginRight: '20px',
    backgroundColor: '#000',
    borderRadius: '15px',
    overflow: 'hidden',
    position: 'relative'
  },
  rightColumn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: '15px',
    overflow: 'hidden',
    boxShadow: '0 0 20px rgba(0,0,0,0.1)'
  },
  placeholderMedia: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#fff',
    textAlign: 'center'
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain' // Se não suportar, vai esticar, mas ok
  },
  weatherBox: {
    height: '100%',
    backgroundColor: '#1976d2',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center'
  },
  newsBox: {
    height: '100%',
    position: 'relative',
    backgroundColor: '#000'
  },
  newsImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.6
  },
  newsText: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    padding: '20px',
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    boxSizing: 'border-box'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed'
  },
  tableHeader: {
    backgroundColor: '#eeeeee',
    color: '#666',
    textAlign: 'left',
    fontSize: '20px',
    borderBottom: '2px solid #ddd'
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(13, 71, 161, 0.95)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center'
  },
  overlayBox: {
    padding: '50px',
    border: '10px solid #fff',
    borderRadius: '30px',
    color: '#fff',
    maxWidth: '90%'
  }
};
