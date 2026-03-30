'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('aso_token');
}

function authHeaders() {
  return { headers: { Authorization: `Bearer ${getToken()}` } };
}

function TypeBadge({ tipo }) {
  const isVideo = tipo === 'VIDEO';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      background: isVideo ? '#1e3a5f' : '#1a3a28',
      color: isVideo ? '#60a5fa' : '#4ade80',
      border: `1px solid ${isVideo ? '#3b82f6' : '#3d7a52'}`,
    }}>
      {isVideo ? '🎬 Vídeo' : '🖼 Imagem'}
    </span>
  );
}

function MediaThumb({ item }) {
  const src = `${API_URL}${item.arquivo}`;
  if (item.tipo === 'VIDEO') {
    return (
      <div style={{
        width: 80, height: 56, borderRadius: 6, overflow: 'hidden',
        background: '#0a1628', border: '1px solid #1e3a5f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#60a5fa', fontSize: 20, flexShrink: 0,
      }}>
        ▶
      </div>
    );
  }
  return (
    <div style={{ width: 80, height: 56, borderRadius: 6, overflow: 'hidden', border: '1px solid #1e3a5f', flexShrink: 0 }}>
      <img
        src={src}
        alt={item.nome}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={e => { e.target.style.display = 'none'; }}
      />
    </div>
  );
}

export default function AdminTvPage() {
  const [midias, setMidias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Upload form state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadNome, setUploadNome] = useState('');
  const [uploadDuracao, setUploadDuracao] = useState(10);
  const [uploadOrdem, setUploadOrdem] = useState(0);
  const fileInputRef = useRef(null);

  const fetchAll = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tv/midias/all`, authHeaders());
      setMidias(res.data);
    } catch (err) {
      setError('Erro ao carregar mídias: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return showError('Selecione um arquivo.');
    setUploading(true);
    const formData = new FormData();
    formData.append('arquivo', uploadFile);
    formData.append('nome', uploadNome || uploadFile.name);
    formData.append('duracao_seg', uploadDuracao);
    formData.append('ordem', uploadOrdem);
    try {
      await axios.post(`${API_URL}/api/tv/midias`, formData, {
        headers: {
          ...authHeaders().headers,
          'Content-Type': 'multipart/form-data',
        },
      });
      showSuccess('Mídia enviada com sucesso!');
      setUploadFile(null);
      setUploadNome('');
      setUploadDuracao(10);
      setUploadOrdem(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchAll();
    } catch (err) {
      showError('Erro no upload: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ nome: item.nome, duracao_seg: item.duracao_seg, ordem: item.ordem, ativo: item.ativo });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id) => {
    try {
      await axios.put(`${API_URL}/api/tv/midias/${id}`, editForm, authHeaders());
      showSuccess('Mídia atualizada!');
      setEditingId(null);
      fetchAll();
    } catch (err) {
      showError('Erro ao atualizar: ' + (err.response?.data?.error || err.message));
    }
  };

  const toggleAtivo = async (item) => {
    try {
      await axios.put(
        `${API_URL}/api/tv/midias/${item.id}`,
        { nome: item.nome, duracao_seg: item.duracao_seg, ordem: item.ordem, ativo: !item.ativo },
        authHeaders()
      );
      fetchAll();
    } catch (err) {
      showError('Erro ao atualizar status.');
    }
  };

  const confirmDelete = (id) => setDeleteConfirm(id);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/tv/midias/${id}`, authHeaders());
      showSuccess('Mídia removida.');
      setDeleteConfirm(null);
      fetchAll();
    } catch (err) {
      showError('Erro ao remover: ' + (err.response?.data?.error || err.message));
    }
  };

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #d1fae5',
    outline: 'none',
    fontSize: 14,
    background: '#f0fdf4',
    color: '#1a2e22',
    width: '100%',
  };

  const btnPrimary = {
    background: '#3d7a52',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  };

  const btnDanger = {
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '6px 14px',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  };

  const btnSecondary = {
    background: '#e5e7eb',
    color: '#374151',
    border: 'none',
    borderRadius: 8,
    padding: '6px 14px',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 8px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1a2e22' }}>
          📺 TV — Configuração de Mídia
        </h1>
        <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
          Gerencie imagens e vídeos exibidos no painel da TV.
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 14 }}>
          {success}
        </div>
      )}

      {/* Upload Form */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #d1fae5',
        padding: '24px 28px',
        marginBottom: 28,
        boxShadow: '0 1px 4px rgba(61,122,82,0.07)',
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a2e22', marginBottom: 18 }}>
          Adicionar nova mídia
        </h2>
        <form onSubmit={handleUpload} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Arquivo *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,video/mp4,video/webm,video/quicktime"
              onChange={e => setUploadFile(e.target.files[0] || null)}
              style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }}
              required
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Nome</label>
            <input
              type="text"
              placeholder="Nome da mídia"
              value={uploadNome}
              onChange={e => setUploadNome(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Duração (seg)</label>
            <input
              type="number"
              min={3}
              max={300}
              value={uploadDuracao}
              onChange={e => setUploadDuracao(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Ordem</label>
            <input
              type="number"
              min={0}
              value={uploadOrdem}
              onChange={e => setUploadOrdem(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <button type="submit" disabled={uploading} style={{ ...btnPrimary, height: 38, whiteSpace: 'nowrap' }}>
            {uploading ? 'Enviando...' : '⬆ Enviar'}
          </button>
        </form>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
          Formatos aceitos: JPG, PNG, GIF, MP4, WebM, MOV — máximo 50 MB
        </p>
      </div>

      {/* Media List */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #d1fae5',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(61,122,82,0.07)',
      }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a2e22' }}>
            Mídias cadastradas
          </h2>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {midias.length} {midias.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
        ) : midias.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>📺</p>
            <p style={{ fontSize: 14 }}>Nenhuma mídia cadastrada ainda.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fffe' }}>
                {['Prévia', 'Nome', 'Tipo', 'Duração', 'Ordem', 'Ativo', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid #f0fdf4' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {midias.map((item, idx) => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f9fafb', background: idx % 2 === 0 ? '#fff' : '#fafffe' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <MediaThumb item={item} />
                    </td>
                    <td style={{ padding: '12px 16px', minWidth: 160 }}>
                      {isEditing ? (
                        <input
                          value={editForm.nome}
                          onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
                          style={{ ...inputStyle, fontSize: 13 }}
                        />
                      ) : (
                        <span style={{ fontWeight: 600, color: '#1a2e22', fontSize: 14 }}>{item.nome}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <TypeBadge tipo={item.tipo} />
                    </td>
                    <td style={{ padding: '12px 16px', minWidth: 100 }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min={3}
                          max={300}
                          value={editForm.duracao_seg}
                          onChange={e => setEditForm(f => ({ ...f, duracao_seg: Number(e.target.value) }))}
                          style={{ ...inputStyle, fontSize: 13, width: 80 }}
                        />
                      ) : (
                        <span style={{ color: '#374151', fontSize: 14 }}>{item.duracao_seg}s</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', minWidth: 80 }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          value={editForm.ordem}
                          onChange={e => setEditForm(f => ({ ...f, ordem: Number(e.target.value) }))}
                          style={{ ...inputStyle, fontSize: 13, width: 60 }}
                        />
                      ) : (
                        <span style={{ color: '#374151', fontSize: 14 }}>{item.ordem}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => toggleAtivo(item)}
                        style={{
                          background: item.ativo ? '#f0fdf4' : '#f9fafb',
                          border: `1px solid ${item.ativo ? '#86efac' : '#d1d5db'}`,
                          borderRadius: 8,
                          padding: '4px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          color: item.ativo ? '#166534' : '#9ca3af',
                          cursor: 'pointer',
                        }}
                      >
                        {item.ativo ? '✓ Ativo' : '✗ Inativo'}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(item.id)} style={btnPrimary}>Salvar</button>
                            <button onClick={cancelEdit} style={btnSecondary}>Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(item)} style={btnSecondary}>Editar</button>
                            {deleteConfirm === item.id ? (
                              <>
                                <button onClick={() => handleDelete(item.id)} style={btnDanger}>Confirmar</button>
                                <button onClick={() => setDeleteConfirm(null)} style={btnSecondary}>Não</button>
                              </>
                            ) : (
                              <button onClick={() => confirmDelete(item.id)} style={{ ...btnSecondary, color: '#dc2626' }}>Excluir</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
