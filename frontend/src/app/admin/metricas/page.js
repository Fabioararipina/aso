'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Calendar, Users, Activity, TrendingUp, Clock, AlertCircle } from 'lucide-react';

export default function MetricasPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Datas padrão: Primeiro e último dia do mês atual
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [periodo, setPeriodo] = useState({ inicio: firstDay, fim: lastDay });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-agendamento.primeatende.com.br';

  useEffect(() => {
    fetchMetricas();
  }, [periodo]);

  const fetchMetricas = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/metricas`, {
        params: periodo
      });
      setData(res.data);
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 font-bold">Calculando indicadores...</span>
      </div>
    );
  }

  // Prepara dados para gráfico de Pizza (Status)
  const pieData = [
    { name: 'Concluídos', value: parseInt(data.kpis.concluidos) },
    { name: 'Cancelados', value: parseInt(data.kpis.cancelados) },
    { name: 'Pendentes', value: parseInt(data.kpis.pendentes) },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & FILTROS */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Activity className="text-blue-600" />
              Painel de Performance
            </h1>
            <p className="text-gray-500 mt-1">Visão estratégica da clínica.</p>
          </div>
          
          <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border mt-4 md:mt-0">
            <div className="flex items-center gap-2">
              <Calendar className="text-gray-400 w-5 h-5" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-gray-700 font-bold text-sm"
                value={periodo.inicio}
                onChange={e => setPeriodo({...periodo, inicio: e.target.value})}
              />
            </div>
            <span className="text-gray-400">até</span>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-gray-700 font-bold text-sm"
                value={periodo.fim}
                onChange={e => setPeriodo({...periodo, fim: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KpiCard 
            title="Total Agendamentos" 
            value={data.kpis.total} 
            icon={<Users className="text-blue-500" />} 
            color="border-l-blue-500"
          />
          <KpiCard 
            title="Atendimentos Concluídos" 
            value={data.kpis.concluidos} 
            icon={<Activity className="text-green-500" />} 
            color="border-l-green-500"
          />
          <KpiCard 
            title="NPS Médio" 
            value={data.kpis.nps_medio || '-'} 
            sub="Escala 0-10"
            icon={<TrendingUp className="text-purple-500" />} 
            color="border-l-purple-500"
          />
          <KpiCard 
            title="Taxa de Cancelamento" 
            value={`${data.kpis.total > 0 ? ((data.kpis.cancelados / data.kpis.total) * 100).toFixed(1) : 0}%`} 
            icon={<AlertCircle className="text-red-500" />} 
            color="border-l-red-500"
          />
        </div>

        {/* GRÁFICOS LINHA 1 (Evolução e Status) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* Evolução Diária */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-700 mb-4">Volume Diário (Qtd)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.evolucao_diaria}>
                  <defs>
                    <linearGradient id="colorQtd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="dia" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="qtd" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorQtd)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribuição de Status */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-700 mb-4">Status Geral</h3>
            <div className="h-64 flex justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom"/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* GRÁFICOS LINHA 2 (Tipos e Especialidades) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          
          {/* Novos vs Retorno */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-700 mb-4">Tipo de Paciente</h3>
            <div className="h-64 flex justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.tipos_consulta.map(t => ({ name: t.tipo_consulta?.replace('_', ' ') || 'Não inf.', value: parseInt(t.qtd) }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#8B5CF6" /> {/* Roxo */}
                    <Cell fill="#F59E0B" /> {/* Laranja */}
                    <Cell fill="#EC4899" /> {/* Rosa */}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Especialidades */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <h3 className="text-lg font-bold text-gray-700 mb-4">Top Especialidades</h3>
             <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.especialidades} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="especialidade" type="category" width={90} tick={{fontSize: 10}} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="volume" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
             </div>
          </div>

        </div>

        {/* TABELA DE PERFORMANCE E PICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Tabela Médicos */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-700 mb-4">Performance da Equipe</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Profissional</th>
                    <th className="pb-3 font-semibold text-center">Atendimentos</th>
                    <th className="pb-3 font-semibold text-center">NPS</th>
                    <th className="pb-3 font-semibold text-center">Esp. Média</th>
                    <th className="pb-3 font-semibold text-center">Dur. Média</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600 text-sm">
                  {data.performance_medicos.map((m, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50">
                      <td className="py-3 font-bold text-gray-800">{m.nome}</td>
                      <td className="py-3 text-center">
                        <span className="bg-blue-100 text-blue-700 py-1 px-2 rounded-full font-bold text-xs">
                          {m.atendidos} / {m.total_agendamentos}
                        </span>
                      </td>
                      <td className="py-3 text-center font-bold text-purple-600">{m.nota_media || '-'}</td>
                      <td className="py-3 text-center text-gray-500">{m.espera_media ? `${m.espera_media} min` : '-'}</td>
                      <td className="py-3 text-center text-gray-500">{m.duracao_media ? `${m.duracao_media} min` : '-'}</td>
                    </tr>
                  ))}
                  {data.performance_medicos.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-4 text-center text-gray-400 italic">Sem dados neste período.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Horários de Pico */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-700 mb-4">Horários de Pico</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.horarios_pico} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="hora" type="category" width={40} tickFormatter={(tick) => `${tick}h`} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="volume" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Volume de agendamentos por faixa horária.</p>
          </div>

        </div>

      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, color, sub }) {
  return (
    <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 ${color} flex items-center justify-between`}>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{title}</p>
        <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      <div className="bg-gray-50 p-3 rounded-full">
        {icon}
      </div>
    </div>
  );
}
