'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Activity, Users, CheckCircle, XCircle, Clock, FlaskConical } from 'lucide-react';
import { authHeaders } from '../../../lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const TIPO_ASO_LABEL = {
  ADMISSIONAL:    'Admissional',
  PERIODICO:      'Periódico',
  DEMISSIONAL:    'Demissional',
  RETORNO:        'Retorno',
  MUDANCA_FUNCAO: 'Mud. Função',
};

const COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export default function MetricasPage() {
  const hoje = new Date();
  const firstDay = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const lastDay  = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const [periodo, setPeriodo] = useState({ inicio: firstDay, fim: lastDay });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [examesModal, setExamesModal] = useState(null); // { sala_id, sala_nome, rows }
  const [loadingExames, setLoadingExames] = useState(false);

  useEffect(() => { fetchMetricas(); }, [periodo]);

  async function abrirExamesSala(sala_id, sala_nome) {
    setLoadingExames(true);
    setExamesModal({ sala_id, sala_nome, rows: [] });
    try {
      const res = await axios.get(`${API_URL}/api/metricas/exames-sala`, {
        params: { sala_id, ...periodo },
        headers: authHeaders(),
      });
      setExamesModal({ sala_id, sala_nome, rows: res.data });
    } catch {}
    finally { setLoadingExames(false); }
  }

  async function fetchMetricas() {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/metricas`, {
        params: periodo,
        headers: authHeaders(),
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3d7a52]" />
          Calculando indicadores...
        </div>
      </div>
    );
  }

  const { kpis, evolucao_diaria, tipos_aso, top_empresas, performance_salas, horarios_pico } = data;

  const pieStatusData = [
    { name: 'Concluídos',   value: parseInt(kpis.concluidos)   || 0 },
    { name: 'Em andamento', value: parseInt(kpis.em_andamento) || 0 },
    { name: 'Cancelados',   value: parseInt(kpis.cancelados)   || 0 },
  ].filter(d => d.value > 0);

  const pieTipoData = tipos_aso.map(t => ({
    name:  TIPO_ASO_LABEL[t.tipo] || t.tipo,
    value: parseInt(t.qtd),
  }));

  const taxaCancelamento = kpis.total > 0
    ? ((kpis.cancelados / kpis.total) * 100).toFixed(1)
    : '0.0';

  return (
    <>
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <Activity className="text-[#3d7a52]" size={24} />
              Painel de Performance — ASO Saúde
            </h1>
            <p className="text-gray-400 text-sm mt-1">Visão estratégica da clínica.</p>
          </div>
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm">
            <input
              type="date"
              className="bg-transparent border-none outline-none text-gray-700 font-semibold"
              value={periodo.inicio}
              onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))}
            />
            <span className="text-gray-400">até</span>
            <input
              type="date"
              className="bg-transparent border-none outline-none text-gray-700 font-semibold"
              value={periodo.fim}
              onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))}
            />
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <KpiCard title="Total de Pacientes" value={kpis.total}
            icon={<Users size={20} className="text-blue-500" />}
            color="border-l-blue-500" />
          <KpiCard title="Atendimentos Concluídos" value={kpis.concluidos}
            icon={<CheckCircle size={20} className="text-green-500" />}
            color="border-l-green-500" />
          <KpiCard title="Exames Realizados" value={`${kpis.exames_concluidos || 0} / ${kpis.total_exames || 0}`}
            sub="concluídos / solicitados"
            icon={<FlaskConical size={20} className="text-purple-500" />}
            color="border-l-purple-500" />
          <KpiCard title="Tempo Médio Total" value={kpis.tempo_medio_min ? `${kpis.tempo_medio_min} min` : '—'}
            sub="do check-in à conclusão"
            icon={<Clock size={20} className="text-amber-500" />}
            color="border-l-amber-500" />
          <KpiCard title="Taxa de Cancelamento" value={`${taxaCancelamento}%`}
            icon={<XCircle size={20} className="text-red-500" />}
            color="border-l-red-500" />
        </div>

        {/* ── Volume diário + Status Geral ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-bold text-gray-700 mb-4">Volume Diário (Qtd)</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucao_diaria}>
                  <defs>
                    <linearGradient id="colorQtd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3d7a52" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#3d7a52" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="dia" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="qtd" name="Pacientes" stroke="#3d7a52" strokeWidth={2.5} fillOpacity={1} fill="url(#colorQtd)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-bold text-gray-700 mb-4">Status Geral</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieStatusData} cx="50%" cy="45%" innerRadius={48} outerRadius={70} paddingAngle={4} dataKey="value">
                    {pieStatusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend verticalAlign="bottom" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Tipo de ASO + Top Empresas ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-bold text-gray-700 mb-4">Tipo de ASO</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieTipoData} cx="50%" cy="45%" outerRadius={70} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieTipoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-bold text-gray-700 mb-4">Top Empresas</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top_empresas.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="empresa" type="category" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="total" name="Pacientes" fill="#3d7a52" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Performance por Sala + Horários de Pico ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-bold text-gray-700 mb-4">Performance por Sala</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Sala</th>
                    <th className="pb-3 font-semibold text-center">Pacientes</th>
                    <th className="pb-3 font-semibold text-center">Concluídos</th>
                    <th className="pb-3 font-semibold text-center">Exames</th>
                    <th className="pb-3 font-semibold text-center">Espera Média</th>
                    <th className="pb-3 font-semibold text-center">Duração Média</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-600">
                  {performance_salas.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-3 font-bold text-gray-800">{s.sala}</td>
                      <td className="py-3 text-center">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold text-xs">
                          {s.total_pacientes}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold text-xs">
                          {s.concluidos}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        {parseInt(s.total_exames) > 0
                          ? <button onClick={() => abrirExamesSala(s.sala_id, s.sala)}
                              className="text-xs text-purple-700 font-semibold underline decoration-dotted hover:text-purple-900 cursor-pointer">
                              {s.exames_concluidos}/{s.total_exames}
                            </button>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 text-center text-gray-500">
                        {s.espera_media_min != null ? `${s.espera_media_min} min` : '—'}
                      </td>
                      <td className="py-3 text-center text-gray-500">
                        {s.duracao_media_min != null ? `${s.duracao_media_min} min` : '—'}
                      </td>
                    </tr>
                  ))}
                  {performance_salas.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-400 italic text-sm">
                        Sem dados neste período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-bold text-gray-700 mb-4">Horários de Pico</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={horarios_pico} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="hora" type="category" width={36} tickFormatter={h => `${h}h`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={v => [v, 'Check-ins']} labelFormatter={h => `${h}h`} />
                  <Bar dataKey="volume" name="Check-ins" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Volume de check-ins por faixa horária.</p>
          </div>
        </div>

      </div>
    </div>

    <ExamesModal modal={examesModal} loading={loadingExames} onClose={() => setExamesModal(null)} />
    </>
  );
}

function ExamesModal({ modal, loading, onClose }) {
  if (!modal) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-black text-gray-800">Exames — {modal.sala_nome}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : modal.rows.length === 0 ? (
          <div className="text-center py-8 text-gray-400 italic">Nenhum exame registrado neste período.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wider text-left">
                <th className="pb-2 font-semibold">Tipo</th>
                <th className="pb-2 font-semibold">Exame</th>
                <th className="pb-2 font-semibold text-center">Solicitados</th>
                <th className="pb-2 font-semibold text-center">Concluídos</th>
              </tr>
            </thead>
            <tbody>
              {modal.rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-gray-500 text-xs">{r.tipo}</td>
                  <td className="py-2 font-semibold text-gray-800">{r.subtipo}</td>
                  <td className="py-2 text-center text-gray-500">{r.total}</td>
                  <td className="py-2 text-center">
                    <span className={`font-bold ${parseInt(r.concluidos) === parseInt(r.total) ? 'text-green-600' : 'text-purple-600'}`}>
                      {r.concluidos}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, color, sub }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${color} p-5 flex items-center justify-between`}>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{title}</p>
        <p className="text-3xl font-black text-gray-800 mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      <div className="bg-gray-50 p-3 rounded-full">{icon}</div>
    </div>
  );
}
