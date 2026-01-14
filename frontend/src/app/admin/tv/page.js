'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminTvPage() {
  const [midias, setMidias] = useState([]);
  const [editando, setEditando] = useState(null); // ID do slide sendo editado
  const [tipo, setTipo] = useState('IMAGEM');
  const [titulo, setTitulo] = useState('');
  const [duracao, setDuracao] = useState(10);
  const [arquivo, setArquivo] = useState(null);
  const [conteudo, setConteudo] = useState(''); // Para cidade ou texto

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-agendamento.primeatende.com.br';

  useEffect(() => {
    fetchMidias();
  }, []);

  const fetchMidias = () => {
    axios.get(`${API_URL}/api/tv-midias`).then(res => setMidias(res.data));
  };

  const RSS_OPCOES = [
    { nome: 'G1 Saúde', url: 'https://g1.globo.com/rss/g1/saude/' },
    { nome: 'Araripina/Região (G1)', url: 'https://g1.globo.com/dynamo/pe/petrolina-regiao/rss2.xml' },
    { nome: 'Blog Roberto Araripina', url: 'https://www.blogdorobertoararipina.com.br/feed/' },
    { nome: 'CNN Brasil', url: 'https://www.cnnbrasil.com.br/feed/' },
    { nome: 'Jovem Pan Notícias', url: 'https://jovempan.com.br/noticias/feed' },
    { nome: 'TecMundo (Tecnologia)', url: 'https://rss.tecmundo.com.br/feed' }
  ];

  const handleAdd = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('tipo', tipo);
    formData.append('titulo', titulo);
    formData.append('duracao', duracao);
    
    if (editando) {
      formData.append('ordem', midias.find(m => m.id === editando).ordem);
      if (tipo === 'IMAGEM' || tipo === 'VIDEO') {
        if (arquivo) formData.append('arquivo', arquivo);
        else formData.append('conteudoExistente', conteudo);
      } else {
        formData.append('conteudoExistente', conteudo.trim());
      }
    } else {
      formData.append('ordem', midias.length > 0 ? Math.max(...midias.map(m => m.ordem)) + 1 : 1);
      if ((tipo === 'IMAGEM' || tipo === 'VIDEO') && arquivo) {
        formData.append('arquivo', arquivo);
      } else {
        formData.append('conteudo', conteudo.trim());
      }
    }

    try {
      if (editando) {
        await axios.put(`${API_URL}/api/tv-midias/${editando}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Slide atualizado!');
      } else {
        await axios.post(`${API_URL}/api/tv-midias`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Slide adicionado!');
      }
      resetForm();
      fetchMidias();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert(`Erro ao salvar slide: ${error.response?.data?.erro || error.message}`);
    }
  };

  const resetForm = () => {
    setEditando(null);
    setTitulo('');
    setArquivo(null);
    setConteudo('');
    setTipo('IMAGEM');
    setDuracao(10);
  };

  const handleEdit = (m) => {
    setEditando(m.id);
    setTipo(m.tipo);
    setTitulo(m.titulo);
    setDuracao(m.duracao);
    setConteudo(m.conteudo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if(!confirm('Excluir slide?')) return;
    await axios.delete(`${API_URL}/api/tv-midias/${id}`);
    fetchMidias();
  };

  const moverOrdem = async (id, novaOrdem) => {
    await axios.put(`${API_URL}/api/tv-midias/${id}/ordem`, { ordem: novaOrdem });
    fetchMidias();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Configurar TV (Mídia Indoor)</h1>

        <div className="grid md:grid-cols-2 gap-8">
          
          {/* FORMULÁRIO */}
          <div className="bg-white p-6 rounded-xl shadow h-fit">
            <h2 className="text-xl font-bold mb-4 text-gray-700">{editando ? 'Editar Slide' : 'Novo Slide'}</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600">Tipo de Slide</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {['IMAGEM', 'VIDEO', 'TEMPO', 'NOTICIA'].map(t => (
                    <button 
                      type="button"
                      key={t}
                      onClick={() => setTipo(t)}
                      className={`flex-1 py-2 px-2 rounded font-bold text-xs ${tipo === t ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600">Título (Identificação)</label>
                <input required className="w-full p-2 border rounded text-gray-900" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Notícias G1 Saúde" />
              </div>

              {(tipo === 'IMAGEM' || tipo === 'VIDEO') && (
                <div>
                  <label className="block text-sm font-bold text-gray-600">Arquivo ({tipo}) {editando && '(Opcional se não quiser trocar)'}</label>
                  <input type="file" accept={tipo === 'VIDEO' ? "video/mp4,video/webm,video/ogg" : "image/*"} className="w-full text-gray-500" onChange={e => setArquivo(e.target.files[0])} />
                </div>
              )}

              {tipo === 'TEMPO' && (
                <div>
                  <label className="block text-sm font-bold text-gray-600">Nome da Cidade</label>
                  <input className="w-full p-2 border rounded text-gray-900" value={conteudo} onChange={e => setConteudo(e.target.value)} placeholder="Ex: São Paulo" />
                </div>
              )}

              {tipo === 'NOTICIA' && (
                <div>
                  <label className="block text-sm font-bold text-gray-600">URL do Feed RSS</label>
                  <input className="w-full p-2 border rounded text-gray-900 mb-2" value={conteudo} onChange={e => setConteudo(e.target.value)} placeholder="Ex: https://g1.globo.com/rss/g1/saude/" />
                  
                  <div className="space-y-1">
                     <p className="text-xs font-bold text-gray-500">Ou escolha um da lista:</p>
                     <div className="flex flex-wrap gap-2">
                        {RSS_OPCOES.map(opt => (
                          <button 
                            key={opt.nome} 
                            type="button" 
                            onClick={() => setConteudo(opt.url)}
                            className="text-xs bg-gray-100 hover:bg-gray-200 border px-2 py-1 rounded text-gray-700"
                          >
                            {opt.nome}
                          </button>
                        ))}
                     </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-600">Duração (segundos)</label>
                <input type="number" className="w-full p-2 border rounded text-gray-900" value={duracao} onChange={e => setDuracao(e.target.value)} />
              </div>

              <div className="flex gap-2">
                <button type="submit" className={`flex-1 ${editando ? 'bg-blue-600' : 'bg-green-600'} text-white py-3 rounded font-bold hover:opacity-90`}>
                  {editando ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR SLIDE'}
                </button>
                {editando && (
                  <button type="button" onClick={resetForm} className="bg-gray-400 text-white px-4 rounded font-bold">CANCELAR</button>
                )}
              </div>
            </form>
          </div>

          {/* LISTA */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-700">Playlist Atual</h2>
            {midias.length === 0 ? (
              <p className="text-gray-500">Nenhum slide rodando. (Padrão: Cartão Essencial)</p>
            ) : (
              <ul className="space-y-3">
                {midias.sort((a,b) => a.ordem - b.ordem).map((m, index) => (
                  <li key={m.id} className="bg-gray-50 p-3 rounded border">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {m.tipo === 'IMAGEM' ? '🖼️' : 
                           m.tipo === 'VIDEO' ? '🎥' :
                           m.tipo === 'TEMPO' ? '🌦️' : '📰'}
                        </span>
                        <div>
                          <p className="font-bold text-gray-800">{m.titulo}</p>
                          <p className="text-xs text-gray-500">{m.duracao}s • {m.tipo} • Ordem: {m.ordem}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(m)} className="text-blue-500 font-bold text-xs hover:underline">Editar</button>
                        <button onClick={() => handleDelete(m.id)} className="text-red-500 font-bold text-xs hover:underline">Excluir</button>
                      </div>
                    </div>
                    
                    {/* CONTROLES DE ORDEM */}
                    <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                      <button 
                        disabled={index === 0}
                        onClick={() => moverOrdem(m.id, m.ordem - 1)}
                        className="text-gray-600 bg-white border rounded px-2 py-1 text-xs font-bold disabled:opacity-30"
                      >
                        ↑ Subir
                      </button>
                      <button 
                        disabled={index === midias.length - 1}
                        onClick={() => moverOrdem(m.id, m.ordem + 1)}
                        className="text-gray-600 bg-white border rounded px-2 py-1 text-xs font-bold disabled:opacity-30"
                      >
                        ↓ Baixar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
