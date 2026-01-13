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
  const [form, setForm] = useState({ nome: '', whatsapp: '', email: '', observacoes: '', tipo_consulta: 'PRIMEIRA_VEZ' });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.20.19:5000';

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
              ${isSameDay(day, selectedDate) ? 'bg-[#5b8dfd] text-white shadow-lg transform scale-105 border-[#5b8dfd]' : 'hover:bg-blue-50'}
              ${isToday(day) ? 'font-bold border-[#5b8dfd]/50' : ''}
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
        horario: selectedHorario,
        // Envia valor zerado se for retorno, ou o valor do médico se for consulta
        valor: form.tipo_consulta === 'RETORNO' ? 0 : null 
      };

      const res = await axios.post(`${API_URL}/api/agendamentos`, payload);
      // Redireciona passando o ID do agendamento para mostrar o ticket
      router.push(`/agendamento/sucesso?id=${res.data.agendamento.id}`);
    } catch (error) {
      alert('Erro ao agendar: ' + error.message);
    }
  };

  // --- RENDERIZAÇÃO DA LANDING PAGE (Cabeçalho Rico) ---
  const renderHero = () => (
    <div className="w-full bg-gradient-to-br from-[#71ca4f]/10 to-[#5b8dfd]/10 pb-12 mb-10 border-b border-[#71ca4f]/20">
      <div className="max-w-5xl mx-auto px-4 text-center pt-8">
        <img src="/logo.png" alt="Essencial Saúde" className="h-28 mx-auto mb-6" />
        
        <h1 className="text-4xl md:text-5xl font-black text-gray-800 mb-4 leading-tight">
          Sua saúde merece <br/>
          <span className="text-[#5b8dfd]">atendimento inteligente.</span>
        </h1>
        
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          A única clínica da região com <strong>Rastreador de Fila em Tempo Real</strong>. 
          Agende online e saia de casa apenas quando chegar a sua vez.
        </p>
        
        {/* Vantagens com Cores da Marca */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-left max-w-5xl mx-auto">
          
          {/* Card Exclusivo: FILA EM TEMPO REAL */}
          <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-[#5b8dfd] flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-[#5b8dfd] text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">EXCLUSIVO</div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="bg-[#5b8dfd]/20 p-2 rounded-full text-[#5b8dfd]">🔴</div>
              <p className="font-bold text-gray-800 leading-tight">Fila ao Vivo</p>
            </div>
            <p className="text-xs text-gray-500">Veja sua posição pelo celular e evite sala de espera.</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
            <div className="bg-[#71ca4f]/20 p-2 rounded-full text-[#71ca4f]">📱</div>
            <div>
              <p className="font-bold text-gray-800">100% Online</p>
              <p className="text-xs text-gray-500">Agende em 1 minuto</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
            <div className="bg-[#71ca4f]/20 p-2 rounded-full text-[#71ca4f]">⚡</div>
            <div>
              <p className="font-bold text-gray-800">Confirmação</p>
              <p className="text-xs text-gray-500">Ticket no seu WhatsApp</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3">
            <div className="bg-[#5b8dfd]/20 p-2 rounded-full text-[#5b8dfd]">📅</div>
            <div>
              <p className="font-bold text-gray-800">Agenda Aberta</p>
              <p className="text-xs text-gray-500">Escolha seu horário</p>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <p className="text-sm font-bold text-[#71ca4f] uppercase tracking-widest mb-4">Escolha um especialista abaixo</p>
          <div className="animate-bounce text-[#71ca4f] text-2xl">⬇</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pb-12">
      
      {/* EXIBE HERO SOMENTE NO PASSO 1 */}
      {step === 1 ? renderHero() : (
        <div className="w-full bg-white shadow-sm py-4 mb-8 border-b border-[#71ca4f]/30">
           <div className="max-w-4xl mx-auto px-4 flex items-center">
             <img src="/logo.png" alt="Logo" className="h-10 mr-4" />
             <span className="font-bold text-[#5b8dfd]">Agendamento Online</span>
           </div>
        </div>
      )}

      {/* STEPS INDICATOR */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm ${step >= 1 ? 'bg-[#71ca4f] text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
        <div className={`w-12 h-1 rounded-full ${step >= 2 ? 'bg-[#71ca4f]' : 'bg-gray-200'}`}></div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm ${step >= 2 ? 'bg-[#71ca4f] text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
        <div className={`w-12 h-1 rounded-full ${step >= 3 ? 'bg-[#71ca4f]' : 'bg-gray-200'}`}></div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm ${step >= 3 ? 'bg-[#71ca4f] text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
      </div>

      <div className="w-full max-w-4xl px-4">
        
        {/* STEP 1: ESCOLHER MÉDICO */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
            {medicos.map(medico => (
              <div 
                key={medico.id}
                onClick={() => { setSelectedMedico(medico); setStep(2); }}
                className="bg-white p-6 rounded-2xl shadow hover:shadow-xl transition transform hover:-translate-y-1 cursor-pointer border border-transparent hover:border-[#5b8dfd] group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#71ca4f] to-[#5b8dfd]"></div>
                
                <div className="flex justify-center mb-4 mt-2">
                  {medico.foto_path ? (
                    <img 
                      src={`${API_URL}/uploads/medicos/${medico.foto_path}`} 
                      alt={medico.nome} 
                      className="w-24 h-24 rounded-full object-cover border-4 border-[#5b8dfd]/10 group-hover:border-[#5b8dfd] shadow-sm transition-colors"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-[#5b8dfd]/10 rounded-full flex items-center justify-center text-4xl text-[#5b8dfd]">
                      👨‍⚕️
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-xl text-gray-800 text-center">{medico.nome}</h3>
                <p className="text-[#5b8dfd] font-medium text-center">{medico.especialidade || 'Clínico Geral'}</p>
                <button className="w-full mt-4 bg-[#71ca4f]/10 text-[#71ca4f] font-bold py-2 rounded-lg group-hover:bg-[#71ca4f] group-hover:text-white transition">
                  Ver Agenda
                </button>
              </div>
            ))}
          </div>
        )}

        {/* STEP 2: ESCOLHER DATA E HORA */}
        {step === 2 && (
          <div className="grid md:grid-cols-2 gap-8 animate-fade-in-up">
            <div>
              <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                <button onClick={() => setStep(1)} className="mr-2 text-[#5b8dfd] hover:underline">← Voltar</button>
                Escolha a Data
              </h3>
              {renderCalendar()}
            </div>

            <div className="bg-white p-6 rounded-xl shadow border border-gray-100 h-fit">
              <h3 className="text-lg font-bold text-gray-700 mb-4">Horários Disponíveis</h3>
              
              {!selectedDate ? (
                <p className="text-gray-400 text-center py-10">Selecione um dia no calendário para ver os horários.</p>
              ) : loading ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5b8dfd]"></div></div>
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
                        ${selectedHorario === hora ? 'bg-[#5b8dfd] text-white shadow-md' : 'bg-blue-50 text-[#5b8dfd] hover:bg-blue-100'}
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
          <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-lg animate-fade-in-up border-t-4 border-[#71ca4f]">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Quase lá!</h3>
            <p className="text-gray-600 mb-6">Confirme seus dados para finalizar o agendamento.</p>

            <div className="bg-[#5b8dfd]/10 p-4 rounded-lg mb-6 flex items-center justify-between border border-[#5b8dfd]/20">
              <div>
                <p className="text-sm text-[#5b8dfd] font-bold uppercase">Resumo</p>
                <p className="font-bold text-gray-800">{selectedMedico?.nome}</p>
                <p className="text-gray-600">{selectedDate && format(selectedDate, 'dd/MM/yyyy')} às {selectedHorario}</p>
              </div>
              <button onClick={() => setStep(2)} className="text-sm text-[#5b8dfd] underline font-bold">Alterar</button>
            </div>

            <form onSubmit={handleFinalSubmit} className="space-y-4">
              
              {/* Seleção de Tipo */}
              <div className="flex gap-4 mb-4">
                <label className={`flex-1 border p-3 rounded-xl flex items-center gap-3 cursor-pointer transition ${form.tipo_consulta === 'PRIMEIRA_VEZ' ? 'border-[#5b8dfd] bg-blue-50 ring-1 ring-[#5b8dfd]' : 'border-gray-200'}`}>
                  <input 
                    type="radio" 
                    name="tipo" 
                    className="w-4 h-4 text-[#5b8dfd]"
                    checked={form.tipo_consulta === 'PRIMEIRA_VEZ'}
                    onChange={() => setForm({...form, tipo_consulta: 'PRIMEIRA_VEZ'})}
                  />
                  <div>
                    <span className="block font-bold text-gray-700 text-sm">Primeira Vez / Consulta</span>
                    <span className="text-xs text-gray-500">Gera cobrança</span>
                  </div>
                </label>

                <label className={`flex-1 border p-3 rounded-xl flex items-center gap-3 cursor-pointer transition ${form.tipo_consulta === 'RETORNO' ? 'border-[#71ca4f] bg-green-50 ring-1 ring-[#71ca4f]' : 'border-gray-200'}`}>
                  <input 
                    type="radio" 
                    name="tipo" 
                    className="w-4 h-4 text-[#71ca4f]"
                    checked={form.tipo_consulta === 'RETORNO'}
                    onChange={() => setForm({...form, tipo_consulta: 'RETORNO'})}
                  />
                  <div>
                    <span className="block font-bold text-gray-700 text-sm">Retorno</span>
                    <span className="text-xs text-gray-500">Gratuito (se no prazo)</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Seu Nome Completo</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-[#5b8dfd] outline-none"
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
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-[#5b8dfd] outline-none"
                  value={form.whatsapp}
                  onChange={e => setForm({...form, whatsapp: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Seu E-mail</label>
                <input 
                  type="email" 
                  placeholder="exemplo@email.com"
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-[#5b8dfd] outline-none"
                  value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Observações (Opcional)</label>
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-[#5b8dfd] outline-none"
                  rows="2"
                  value={form.observacoes}
                  onChange={e => setForm({...form, observacoes: e.target.value})}
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#71ca4f] hover:bg-[#65b546] text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:scale-105 mt-4"
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