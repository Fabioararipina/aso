'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminTvPage() {
  const [midias, setMidias] = useState([]);
  const [tipo, setTipo] = useState('IMAGEM');
  const [titulo, setTitulo] = useState('');
  const [duracao, setDuracao] = useState(10);
  const [arquivo, setArquivo] = useState(null);
  const [conteudo, setConteudo] = useState(''); // Para cidade ou texto

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchMidias();
  }, []);

  const fetchMidias = () => {
    axios.get(`${API_URL}/api/tv-midias`).then(res => setMidias(res.data));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('tipo', tipo);
    formData.append('titulo', titulo);
    formData.append('duracao', duracao);
    formData.append('ordem', midias.length + 1);
    
    if (tipo === 'IMAGEM' && arquivo) {
      formData.append('arquivo', arquivo);
    } else {
      formData.append('conteudo', conteudo.trim()); // Para Tempo ou Notícia
    }

    try {
      await axios.post(`${API_URL}/api/tv-midias`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchMidias();
      setTitulo('');
      setArquivo(null);
      setConteudo('');
      alert('Slide adicionado!');
    } catch (error) {
      alert('Erro ao adicionar slide');
    }
  };

  const handleDelete = async (id) => {
    if(!confirm('Excluir slide?')) return;
    await axios.delete(`${API_URL}/api/tv-midias/${id}`);
    fetchMidias();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Configurar TV (Mídia Indoor)</h1>

        <div className="grid md:grid-cols-2 gap-8">
          
          {/* FORMULÁRIO */}
          <div className="bg-white p-6 rounded-xl shadow h-fit">
            <h2 className="text-xl font-bold mb-4 text-gray-700">Novo Slide</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600">Tipo de Slide</label>
                <div className="flex gap-2 mt-1">
                  {['IMAGEM', 'TEMPO', 'NOTICIA'].map(t => (
                    <button 
                      type="button"
                      key={t}
                      onClick={() => setTipo(t)}
                      className={`flex-1 py-2 rounded font-bold text-sm ${tipo === t ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
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

              {tipo === 'IMAGEM' && (
                <div>
                  <label className="block text-sm font-bold text-gray-600">Arquivo de Imagem</label>
                  <input type="file" accept="image/*" className="w-full text-gray-500" onChange={e => setArquivo(e.target.files[0])} />
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
                  <input className="w-full p-2 border rounded text-gray-900" value={conteudo} onChange={e => setConteudo(e.target.value)} placeholder="Ex: https://g1.globo.com/rss/g1/saude/" />
                  <p className="text-xs text-gray-500 mt-1">Recomendado: RSS do G1, CNN ou Ministério da Saúde.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-600">Duração (segundos)</label>
                <input type="number" className="w-full p-2 border rounded text-gray-900" value={duracao} onChange={e => setDuracao(e.target.value)} />
              </div>

              <button className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700">ADICIONAR SLIDE</button>
            </form>
          </div>

          {/* LISTA */}
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-700">Playlist Atual</h2>
            {midias.length === 0 ? (
              <p className="text-gray-500">Nenhum slide rodando. (Padrão: Cartão Essencial)</p>
            ) : (
              <ul className="space-y-3">
                {midias.map(m => (
                  <li key={m.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{m.tipo === 'IMAGEM' ? '🖼️' : '🌦️'}</span>
                      <div>
                        <p className="font-bold text-gray-800">{m.titulo}</p>
                        <p className="text-xs text-gray-500">{m.duracao}s • {m.tipo}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(m.id)} className="text-red-500 font-bold hover:underline">Excluir</button>
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
