'use client';

import { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Página de TV para navegadores extremamente antigos (ES5 / Legacy)
// Removemos: arrow functions, async/await, axios, flexbox/grid complexo.
export default function TvLegacyPage() {
  const [lista, setLista] = useState([]);
  const [midias, setMidias] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [chamadaAtual, setChamadaAtual] = useState(null);

  // URL Hardcoded para evitar falhas de variáveis de ambiente em navegadores velhos
  const API_URL = 'https://api-agendamento.primeatende.com.br';

  // Busca de Dados usando XMLHttpRequest (mais compatível que fetch em TVs muito velhas)
  function fetchDados() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_URL + '/api/agendamentos/tv/dados', true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          setLista(data);
        } catch (e) { console.error(e); }
      }
    };
    xhr.send();
  }

  function fetchMidias() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_URL + '/api/tv-midias', true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          if (data && data.length > 0) setMidias(data);
        } catch (e) { console.error(e); }
      }
    };
    xhr.send();
  }

  useEffect(function() {
    fetchDados();
    fetchMidias();

    // Socket.io com transporte via Websocket apenas (mais estável para TVs)
    var socket = io(API_URL, { transports: ['websocket'] });

    socket.on('agendamento-atualizado', function() { fetchDados(); });
    socket.on('agendamento-confirmado', function() { fetchDados(); });
    socket.on('novo-agendamento', function() { fetchDados(); });
    
    socket.on('chamar-paciente', function(agendamento) {
      setChamadaAtual(agendamento);
      setTimeout(function() {
        setChamadaAtual(null);
      }, 15000);
    });

    var interval = setInterval(fetchDados, 30000);

    return function() {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  useEffect(function() {
    if (midias.length === 0) return;
    
    var slide = midias[currentSlideIndex];
    var time = (slide.duracao || 10) * 1000;

    var timer = setTimeout(function() {
      setCurrentSlideIndex(function(prev) {
        return (prev + 1) % midias.length;
      });
    }, time);

    return function() {
      clearTimeout(timer);
    };
  }, [currentSlideIndex, midias]);

  // Estilos em Objeto para garantir que não dependemos de CSS externo moderno
  var styles = {
    container: {
      backgroundColor: '#f0f2f5',
      height: '100vh',
      width: '100vw',
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden',
      margin: 0,
      padding: 0
    },
    header: {
      height: '100px',
      backgroundColor: '#1565c0',
      color: 'white',
      padding: '0 20px'
    },
    bodyTable: {
      width: '100%',
      height: 'calc(100vh - 100px)',
      borderCollapse: 'collapse',
      tableLayout: 'fixed'
    }
  };

  return (
    <div style={styles.container}>
      {/* HEADER CLÁSSICO */}
      <div style={styles.header}>
        <table style={{ width: '100%', height: '100%' }}>
          <tbody>
            <tr>
              <td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                <img src="/logo.png" style={{ height: '70px', backgroundColor: '#fff', padding: '5px', borderRadius: '5px', verticalAlign: 'middle' }} />
                <span style={{ fontSize: '30px', fontWeight: 'bold', marginLeft: '15px' }}>PAINEL DE ATENDIMENTO</span>
              </td>
              <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                <span style={{ fontSize: '60px', fontWeight: 'bold' }}>
                   {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* LAYOUT PRINCIPAL USANDO TABELA PARA DIVISÃO DE COLUNAS */}
      <table style={styles.bodyTable}>
        <tbody>
          <tr>
            {/* COLUNA MÍDIA (30%) */}
            <td style={{ width: '30%', backgroundColor: '#000', verticalAlign: 'top', textAlign: 'center' }}>
               {midias.length > 0 && midias[currentSlideIndex] ? (
                  <div style={{ padding: '10px' }}>
                     {midias[currentSlideIndex].tipo === 'IMAGEM' && (
                       <img src={API_URL + '/uploads/tv/' + midias[currentSlideIndex].conteudo} style={{ maxWidth: '100%', height: 'auto' }} />
                     )}
                     {midias[currentSlideIndex].tipo === 'VIDEO' && (
                       <video src={API_URL + '/uploads/tv/' + midias[currentSlideIndex].conteudo} style={{ width: '100%' }} autoPlay muted loop />
                     )}
                  </div>
               ) : (
                 <div style={{ color: '#fff', paddingTop: '100px' }}>
                   <h2 style={{ fontSize: '40px' }}>ESSENCIAL SAÚDE</h2>
                   <p style={{ fontSize: '20px' }}>Sua saúde em primeiro lugar.</p>
                 </div>
               )}
            </td>

            {/* COLUNA LISTA (70%) */}
            <td style={{ width: '70%', backgroundColor: '#fff', verticalAlign: 'top' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                 <thead>
                   <tr style={{ backgroundColor: '#eeeeee', color: '#666', fontSize: '22px' }}>
                     <th style={{ padding: '15px', borderBottom: '2px solid #ccc', width: '15%' }}>HORA</th>
                     <th style={{ padding: '15px', borderBottom: '2px solid #ccc', textAlign: 'left' }}>PACIENTE</th>
                     <th style={{ padding: '15px', borderBottom: '2px solid #ccc', textAlign: 'left' }}>MÉDICO</th>
                     <th style={{ padding: '15px', borderBottom: '2px solid #ccc', width: '20%' }}>STATUS</th>
                   </tr>
                 </thead>
                 <tbody>
                   {lista.length === 0 ? (
                     <tr><td colSpan="4" style={{ textAlign: 'center', padding: '100px', fontSize: '30px', color: '#999' }}>Aguardando atendimentos...</td></tr>
                   ) : (
                     lista.map(function(item, index) {
                       var isChamando = item.status === 'EM_ATENDIMENTO';
                       return (
                         <tr key={item.id} style={{ 
                           backgroundColor: isChamando ? '#fff9c4' : (index % 2 === 0 ? '#ffffff' : '#f9f9f9'), 
                           borderBottom: '1px solid #eee' 
                         }}>
                           <td style={{ padding: '20px', fontSize: '32px', fontWeight: 'bold', textAlign: 'center' }}>
                             {item.horario.slice(0, 5)}
                           </td>
                           <td style={{ padding: '20px', fontSize: '38px', fontWeight: 'bold', textTransform: 'uppercase', color: isChamando ? '#d32f2f' : '#333' }}>
                             {item.paciente_nome}
                           </td>
                           <td style={{ padding: '20px', fontSize: '24px', color: '#666' }}>
                             {item.medico_nome}
                           </td>
                           <td style={{ padding: '20px', textAlign: 'center' }}>
                              <div style={{ 
                                backgroundColor: isChamando ? '#d32f2f' : '#e0e0e0', 
                                color: isChamando ? '#fff' : '#777',
                                padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px'
                              }}>
                                {isChamando ? 'CHAMANDO' : item.status}
                              </div>
                           </td>
                         </tr>
                       );
                     })
                   )}
                 </tbody>
               </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* OVERLAY DE CHAMADA (FULL SCREEN) */}
      {chamadaAtual && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          backgroundColor: '#c62828', color: '#fff', zIndex: 1000, 
          textAlign: 'center', paddingTop: '150px' 
        }}>
           <h2 style={{ fontSize: '50px', fontWeight: 'normal', margin: 0 }}>POR FAVOR, COMPARECER:</h2>
           <h1 style={{ fontSize: '110px', margin: '50px 0', fontWeight: 'bold' }}>{chamadaAtual.paciente_nome}</h1>
           <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '30px', display: 'inline-block', borderRadius: '20px' }}>
              <h3 style={{ fontSize: '50px', margin: 0 }}>CONSULTÓRIO: {chamadaAtual.medico_nome}</h3>
           </div>
        </div>
      )}

    </div>
  );
}