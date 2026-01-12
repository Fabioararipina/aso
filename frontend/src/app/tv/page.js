'use client';

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

export default function TvPage() {
  const [lista, setLista] = useState([]);
  const [chamadaAtual, setChamadaAtual] = useState(null);
  
  // Estados do Carrossel de Mídia
  const [midias, setMidias] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [weather, setWeather] = useState(null); 
  const [news, setNews] = useState(null); // Estado para notícias

  // Use environment variable or default to localhost:5000
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchDados(); 
    fetchMidias(); 

    const socket = io(API_URL);
    // ... (socket listeners) ...
    socket.on('agendamento-atualizado', () => fetchDados());
    socket.on('agendamento-confirmado', () => fetchDados());
    socket.on('novo-agendamento', () => fetchDados());
    socket.on('chamar-paciente', (agendamento) => {
      setChamadaAtual(agendamento);
      playAlertSound();
      speakText(`Paciente ${agendamento.paciente_nome}, comparecer ao consultório do Doutor ${agendamento.medico_nome}`);
      setTimeout(() => { setChamadaAtual(null); }, 15000);
    });

    const interval = setInterval(fetchDados, 60000);
    return () => { socket.disconnect(); clearInterval(interval); };
  }, []);

  const fetchMidias = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tv-midias`);
      if (res.data.length > 0) {
        setMidias(res.data);
      }
    } catch (e) { console.error('Erro midias', e); }
  };

  useEffect(() => {
    if (midias.length === 0) return;

    const currentSlide = midias[currentSlideIndex];
    
    // Fetch condicional baseado no tipo
    if (currentSlide.tipo === 'TEMPO' && !weather) {
      fetchWeather(currentSlide.conteudo);
    } else if (currentSlide.tipo === 'NOTICIA' && !news) {
      fetchNews(currentSlide.conteudo); // conteudo = url rss
    }

    const timer = setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % midias.length);
      setWeather(null); 
      setNews(null); // Reseta news
    }, currentSlide.duracao * 1000);

    return () => clearTimeout(timer);
  }, [currentSlideIndex, midias]);

  const fetchWeather = async (cidade) => {
    // ... (código weather igual) ...
    try {
      const cidadeLimpa = cidade.split(' - ')[0].trim();
      const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${cidadeLimpa}&count=1&language=pt&format=json`);
      if (!geoRes.data.results) { setWeather({ cidade: cidade, temp: '--', code: 0, humidade: '--' }); return; }
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
    } catch (e) { setWeather({ cidade: cidade, temp: 'Erro', code: 0, humidade: 'Erro' }); }
  };

  const fetchNews = async (rssUrl) => {
    try {
      const urlLimpa = rssUrl.trim();
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(urlLimpa)}`;
      const res = await axios.get(apiUrl);
      if (res.data.items && res.data.items.length > 0) {
        // Pega uma notícia aleatória das 5 primeiras para variar
        const randomIndex = Math.floor(Math.random() * Math.min(5, res.data.items.length));
        const item = res.data.items[randomIndex];
        setNews({
          titulo: item.title,
          imagem: item.enclosure?.link || item.thumbnail || null, // Tenta achar imagem
          fonte: res.data.feed.title
        });
      }
    } catch (e) { console.error('Erro news', e); }
  };

  // Helper para ícone e texto (igual)
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

  const fetchDados = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/agendamentos/tv/dados`);
      setLista(res.data);
    } catch (error) {
      console.error('Erro ao buscar dados TV:', error);
    }
  };

  const playAlertSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 440; 
        gain.gain.value = 0.1;
        osc.start();
        setTimeout(() => { osc.frequency.value = 554.37; }, 400); 
        setTimeout(() => { osc.stop(); }, 1200);
      }
    } catch (e) { console.error('Erro som', e); }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden font-sans">
      
      {/* HEADER */}
      <header className="bg-blue-900 p-8 shadow-lg flex justify-between items-center z-10 border-b border-blue-800">
        <div className="flex items-center gap-6">
          <div className="text-6xl">🏥</div>
          <div>
            <h1 className="text-5xl font-bold tracking-wider">ESSENCIAL SAÚDE</h1>
            <p className="text-blue-300 text-xl uppercase tracking-widest mt-1">Painel de Atendimento</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-6xl font-bold font-mono">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-blue-300 text-xl mt-1">
            {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="flex-1 p-6 overflow-hidden flex gap-6">
        
        {/* COLUNA ESQUERDA: MÍDIA / DESTAQUES */}
        <div className="w-1/4 flex flex-col gap-6">
          <div className="flex-1 bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden relative">
            
            {midias.length === 0 ? (
              // DEFAULT SE NÃO TIVER MÍDIA
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-gray-800 to-gray-900">
                <span className="text-8xl mb-6">🌳</span>
                <h2 className="text-4xl font-bold text-green-400 mb-4">Cartão Essencial</h2>
                <p className="text-2xl text-gray-300">Descontos exclusivos em exames e consultas.</p>
                <div className="mt-12 bg-white p-4 rounded-xl inline-block shadow-2xl">
                  {/* Placeholder QR Code */}
                  <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-black font-bold text-lg">QR CODE</div>
                </div>
                <p className="mt-4 text-lg text-gray-500">Escaneie para saber mais</p>
              </div>
            ) : (
              // SLIDES
              <div className="absolute inset-0 w-full h-full">
                {midias[currentSlideIndex].tipo === 'IMAGEM' && (
                  <img 
                    src={`${API_URL}/uploads/tv/${midias[currentSlideIndex].conteudo}`} 
                    className="w-full h-full object-cover animate-fade-in"
                  />
                )}
                {midias[currentSlideIndex].tipo === 'TEMPO' && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-blue-500 to-blue-800 animate-fade-in text-white p-6 text-center shadow-inner">
                    {weather ? (
                      <>
                        <h2 className="text-3xl font-bold mb-2 drop-shadow-md">{weather.cidade}</h2>
                        
                        <div className="flex items-center gap-4 mb-4">
                          <div className="text-8xl drop-shadow-lg filter">{getWeatherInfo(weather.code).icon}</div>
                          <div className="text-left">
                            <div className="text-7xl font-bold leading-none">{Math.round(weather.temp)}°</div>
                            <div className="text-xl font-medium opacity-90">{getWeatherInfo(weather.code).text}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 w-full bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                          <div>
                            <p className="text-xs uppercase opacity-70">Umidade</p>
                            <p className="font-bold text-xl">{weather.humidade}%</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase opacity-70">Vento</p>
                            <p className="font-bold text-xl">{weather.vento} km/h</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase opacity-70">Min / Max</p>
                            <p className="font-bold text-xl">{Math.round(weather.min)}° / {Math.round(weather.max)}°</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="animate-spin text-4xl">↻ Carregando...</div>
                    )}
                  </div>
                )}

                {midias[currentSlideIndex].tipo === 'NOTICIA' && (
                  <div className="w-full h-full flex flex-col items-center justify-end bg-black animate-fade-in text-white relative">
                    {news ? (
                      <>
                        {news.imagem && (
                          <div className="absolute inset-0 opacity-60">
                            <img src={news.imagem} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                        
                        <div className="relative z-10 p-8 text-left w-full">
                          <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 uppercase rounded mb-2 inline-block">
                            {news.fonte || 'Notícia'}
                          </span>
                          <h2 className="text-2xl font-bold leading-tight drop-shadow-lg line-clamp-4">
                            {news.titulo}
                          </h2>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full w-full">
                        <span className="animate-spin text-4xl">↻</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PROGRESS BAR DO SLIDE */}
            <div className="absolute bottom-0 left-0 h-2 bg-green-500 transition-all duration-[1000ms] ease-linear w-full opacity-50"></div>
          </div>
        </div>

        {/* COLUNA DIREITA: LISTA DE ESPERA */}
        <div className="w-3/4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-gray-100 p-6 border-b flex justify-between text-gray-500 font-bold text-xl uppercase tracking-wider">
            <span className="w-28">Horário</span>
            <span className="flex-1 ml-4">Paciente</span>
            <span className="w-80">Médico</span>
            <span className="w-56 text-center">Status</span>
            <span className="w-32 text-right">Previsão</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {lista.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-3xl">
                Agenda vazia por enquanto.
              </div>
            ) : (
              <table className="w-full">
                <tbody>
                  {lista.map((item) => (
                    <tr key={item.id} className={`border-b border-gray-100 last:border-0 transition-colors ${item.status === 'EM_ATENDIMENTO' ? 'bg-blue-50' : ''}`}>
                      <td className="p-6 text-gray-500 font-mono font-bold text-3xl w-28">
                        {item.horario.slice(0,5)}
                      </td>
                      <td className="p-6 ml-4">
                        <span className="block text-4xl font-black text-gray-800 uppercase tracking-tight">{item.paciente_nome}</span>
                      </td>
                      <td className="p-6 w-80">
                        <div className="flex items-center gap-4">
                          {item.foto_path ? (
                            <img src={`${API_URL}/uploads/medicos/${item.foto_path}`} className="w-20 h-20 rounded-full object-cover border-2 shadow-sm" />
                          ) : (
                            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-2xl">Dr</div>
                          )}
                          <span className="text-2xl font-bold text-gray-700 truncate w-56">{item.medico_nome}</span>
                        </div>
                      </td>
                      <td className="p-6 w-56 text-center">
                        <span className={`
                          px-4 py-2 rounded-full text-lg font-black uppercase shadow-sm block w-full
                          ${item.status === 'EM_ATENDIMENTO' ? 'bg-blue-600 text-white animate-pulse' : ''}
                          ${item.status === 'PRESENTE' ? 'bg-green-100 text-green-700' : ''}
                          ${item.status === 'CONFIRMADO' ? 'bg-gray-100 text-gray-500' : ''}
                        `}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-6 w-32 text-right font-mono font-black text-4xl text-blue-600">
                        {item.previsao}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </main>

      {/* OVERLAY DE CHAMADA (TELA CHEIA) */}
      {chamadaAtual && (
        <div className="fixed inset-0 z-50 bg-blue-700 flex flex-col items-center justify-center animate-pulse-fast">
          <h1 className="text-6xl font-bold text-white mb-12 uppercase tracking-[0.2em] opacity-90">Por favor, dirija-se ao consultório</h1>
          <div className="bg-white text-blue-900 px-24 py-16 rounded-[4rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] mb-16 transform scale-110 border-[12px] border-blue-300">
            <h2 className="text-9xl font-black text-center leading-tight">{chamadaAtual.paciente_nome}</h2>
          </div>
          <div className="flex items-center gap-10 bg-blue-800 px-16 py-10 rounded-3xl shadow-2xl">
            {chamadaAtual.foto_path && (
               <img src={`${API_URL}/uploads/medicos/${chamadaAtual.foto_path}`} className="w-48 h-48 rounded-full border-8 border-white shadow-lg" />
            )}
            <div className="text-left">
              <p className="text-blue-300 text-3xl uppercase font-bold mb-2 tracking-widest">Médico(a)</p>
              <h2 className="text-7xl font-bold text-white leading-none">{chamadaAtual.medico_nome}</h2>
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .animate-pulse-fast { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
    </div>
  );
}