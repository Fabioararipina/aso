'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { format, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AgendamentoWizard() {
  const router = useRouter();
  
  // Estados do Wizard
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Dados
  const [medicos, setMedicos] = useState([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);

  // Seleções
  const [selectedMedico, setSelectedMedico] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedHorario, setSelectedHorario] = useState(null);
  
  // Formulário Final
  const [form, setForm] = useState({ nome: '', whatsapp: '', email: '', observacoes: '' });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // Carregar Médicos no Início
  useEffect(() => {
    axios.get(`${API_URL}/api/medicos`)
      .then(res => setMedicos(res.data))
      .catch(err => console.error(err));
  }, []);

  // Buscar Horários quando seleciona data
  useEffect(() => {
    if (selectedMedico && selectedDate) {
      setLoading(true);
      const dataStr = format(selectedDate, 'yyyy-MM-dd');
      axios.get(`${API_URL}/api/medicos/${selectedMedico.id}/disponiveis?data=${dataStr}`)
        .then(res => {
          setHorariosDisponiveis(res.data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [selectedDate, selectedMedico]);

  // --- LÓGICA DO CALENDÁRIO ---
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const days = [];
    let day = startDate;
    let formattedDate = "";

    const rows = [];
    let daysInWeek = [];

    // Header Dias da Semana
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = new Date(day); // CLONE CORRETO para não sofrer mutação do loop
        const isDisabled = isBefore(day, startOfDay(new Date())); // Bloqueia passado

        daysInWeek.push(
          <div
            key={day.toString()}
            className={`
              p-2 md:p-4 text-center cursor-pointer border rounded-lg transition-all duration-200
              ${!isSameMonth(day, monthStart) ? 'text-gray-300 bg-gray-50' : 'text-gray-800'}
              ${isSameDay(day, selectedDate) ? 'bg-blue-600 text-white shadow-lg transform scale-105 border-blue-600' : 'hover:bg-blue-50'}
              ${isToday(day) ? 'font-bold border-blue-300' : ''}
              ${isDisabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}
            `}
            onClick={() => {
              if (!isDisabled) {
                setSelectedDate(cloneDay);
                setSelectedHorario(null); // Reseta horário ao trocar dia
              }
            }}
          >
            <span className="block text-sm md:text-lg">{formattedDate}</span>
          </div>
        );
        day = new Date(day.setDate(day.getDate() + 1)); // Avança dia
      }
      rows.push(<div className="grid grid-cols-7 gap-1 md:gap-2 mb-2" key={day}>{daysInWeek}</div>);
      daysInWeek = [];
    }

    return (
      <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
        {/* Header Mês */}
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">◀</button>
          <span className="font-bold text-lg text-gray-800 capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">▶</button>
        </div>
        
        {/* Header Dias */}
        <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{d}</div>
          ))}
        </div>
        
        {/* Dias */}
        {rows}
      </div>
    );
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMedico || !selectedDate || !selectedHorario) return;

    try {
      const payload = {
        ...form,
        medico_id: selectedMedico.id,
        data_consulta: format(selectedDate, 'yyyy-MM-dd'),
        horario: selectedHorario
      };

      const res = await axios.post(`${API_URL}/api/agendamentos`, payload);
      // Redireciona passando o ID do agendamento para mostrar o ticket
      router.push(`/agendamento/sucesso?id=${res.data.agendamento.id}`);
    } catch (error) {
      alert('Erro ao agendar: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      
      {/* HEADER DA PÁGINA */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-blue-900">Agende sua Consulta</h1>
        <p className="text-gray-500">Siga os passos abaixo para marcar seu horário</p>
      </div>

      {/* STEPS INDICATOR */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
        <div className={`w-12 h-1 bg-gray-200 ${step >= 2 ? 'bg-blue-600' : ''}`}></div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
        <div className={`w-12 h-1 bg-gray-200 ${step >= 3 ? 'bg-blue-600' : ''}`}></div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
      </div>

      <div className="w-full max-w-4xl">
        
        {/* STEP 1: ESCOLHER MÉDICO */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
            {medicos.map(medico => (
              <div 
                key={medico.id}
                onClick={() => { setSelectedMedico(medico); setStep(2); }}
                className="bg-white p-6 rounded-2xl shadow hover:shadow-xl transition transform hover:-translate-y-1 cursor-pointer border border-transparent hover:border-blue-400 group"
              >
                <div className="flex justify-center mb-4">
                  {medico.foto_path ? (
                    <img 
                      src={`${API_URL}/uploads/medicos/${medico.foto_path}`} 
                      alt={medico.nome} 
                      className="w-24 h-24 rounded-full object-cover border-4 border-blue-50 group-hover:border-blue-200 shadow-sm"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-4xl text-blue-500">
                      👨‍⚕️
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-xl text-gray-800 text-center">{medico.nome}</h3>
                <p className="text-blue-500 font-medium text-center">{medico.especialidade || 'Clínico Geral'}</p>
                <p className="text-gray-400 text-sm mt-4 text-center">Toque para ver agenda</p>
              </div>
            ))}
          </div>
        )}

        {/* STEP 2: ESCOLHER DATA E HORA */}
        {step === 2 && (
          <div className="grid md:grid-cols-2 gap-8 animate-fade-in-up">
            <div>
              <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                <button onClick={() => setStep(1)} className="mr-2 text-blue-500 hover:underline">← Voltar</button>
                Escolha a Data
              </h3>
              {renderCalendar()}
            </div>

            <div className="bg-white p-6 rounded-xl shadow border border-gray-100 h-fit">
              <h3 className="text-lg font-bold text-gray-700 mb-4">Horários Disponíveis</h3>
              
              {!selectedDate ? (
                <p className="text-gray-400 text-center py-10">Selecione um dia no calendário para ver os horários.</p>
              ) : loading ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
              ) : horariosDisponiveis.length === 0 ? (
                <div className="text-center py-10 bg-yellow-50 rounded-lg">
                  <p className="text-yellow-700 font-bold">Sem vagas neste dia.</p>
                  <p className="text-sm text-yellow-600">Tente outra data no calendário.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {horariosDisponiveis.map(hora => (
                    <button
                      key={hora}
                      onClick={() => { setSelectedHorario(hora); setStep(3); }}
                      className={`
                        py-2 px-4 rounded-lg font-bold text-sm transition
                        ${selectedHorario === hora ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}
                      `}
                    >
                      {hora}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: DADOS FINAIS */}
        {step === 3 && (
          <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-lg animate-fade-in-up">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Quase lá!</h3>
            <p className="text-gray-600 mb-6">Confirme seus dados para finalizar o agendamento.</p>

            <div className="bg-blue-50 p-4 rounded-lg mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-800 font-bold uppercase">Resumo</p>
                <p className="font-bold text-gray-800">{selectedMedico?.nome}</p>
                <p className="text-gray-600">{selectedDate && format(selectedDate, 'dd/MM/yyyy')} às {selectedHorario}</p>
              </div>
              <button onClick={() => setStep(2)} className="text-sm text-blue-600 underline font-bold">Alterar</button>
            </div>

            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Seu Nome Completo</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.nome}
                  onChange={e => setForm({...form, nome: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Seu WhatsApp</label>
                <input 
                  type="text" 
                  placeholder="(00) 00000-0000"
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.whatsapp}
                  onChange={e => setForm({...form, whatsapp: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Observações (Opcional)</label>
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  rows="2"
                  value={form.observacoes}
                  onChange={e => setForm({...form, observacoes: e.target.value})}
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:scale-105 mt-4"
              >
                CONFIRMAR AGENDAMENTO
              </button>
            </form>
          </div>
        )}

      </div>

      <style jsx global>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}