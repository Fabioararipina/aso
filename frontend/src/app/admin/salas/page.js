'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AdminSalasPage() {
  const [salas, setSalas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // sala id being saved
  const [tempos, setTempos] = useState({}); // { [id]: value }
  const [feedback, setFeedback] = useState({}); // { [id]: 'ok' | 'error' }
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSalas();
  }, []);

  async function fetchSalas() {
    try {
      const res = await axios.get(`${API_URL}/api/salas`);
      setSalas(res.data);
      const t = {};
      res.data.forEach(s => { t[s.id] = s.tempo_medio_min; });
      setTempos(t);
    } catch (err) {
      setError('Erro ao carregar salas');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(sala_id) {
    setSaving(sala_id);
    setFeedback(prev => ({ ...prev, [sala_id]: null }));
    try {
      const tempo = parseInt(tempos[sala_id]);
      if (!tempo || tempo < 1 || tempo > 120) {
        setFeedback(prev => ({ ...prev, [sala_id]: 'error' }));
        return;
      }
      await axios.patch(`${API_URL}/api/salas/${sala_id}/tempo`, { tempo_medio_min: tempo });
      setSalas(prev => prev.map(s => s.id === sala_id ? { ...s, tempo_medio_min: tempo } : s));
      setFeedback(prev => ({ ...prev, [sala_id]: 'ok' }));
      setTimeout(() => setFeedback(prev => ({ ...prev, [sala_id]: null })), 2000);
    } catch (err) {
      setFeedback(prev => ({ ...prev, [sala_id]: 'error' }));
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Carregando salas...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-800">Configurar Salas</h1>
          <p className="text-gray-400 text-sm mt-1">
            Ajuste o tempo médio de atendimento por sala. Isso afeta as previsões enviadas aos pacientes.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {salas.map(sala => {
            const isSaving = saving === sala.id;
            const fb = feedback[sala.id];
            const changed = parseInt(tempos[sala.id]) !== sala.tempo_medio_min;

            return (
              <div
                key={sala.id}
                className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4"
              >
                {/* Room info */}
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-lg">{sala.nome}</h3>
                  <p className="text-xs text-gray-400">Slug: {sala.slug}</p>
                </div>

                {/* Time input */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={tempos[sala.id] ?? sala.tempo_medio_min}
                    onChange={e => setTempos(prev => ({ ...prev, [sala.id]: e.target.value }))}
                    className="w-20 border-2 border-gray-200 rounded-xl px-3 py-2 text-center text-gray-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <span className="text-sm text-gray-400 font-medium">min</span>
                </div>

                {/* Save button */}
                <button
                  onClick={() => handleSave(sala.id)}
                  disabled={isSaving || !changed}
                  className={`px-5 py-2 rounded-xl font-bold text-sm transition ${
                    fb === 'ok'
                      ? 'bg-green-100 text-green-700'
                      : fb === 'error'
                      ? 'bg-red-100 text-red-700'
                      : !changed
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isSaving ? '...' : fb === 'ok' ? 'Salvo!' : fb === 'error' ? 'Erro' : 'Salvar'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-sm text-blue-700">
            <strong>Como funciona:</strong> O tempo médio é usado para calcular a previsão de espera
            de cada paciente nas demais salas. Valores mais precisos melhoram a experiência do paciente.
          </p>
        </div>
      </div>
    </div>
  );
}
