'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const SALAS = [
  { id: 1, nome: 'Laboratório', slug: 'laboratorio' },
  { id: 2, nome: 'Médico', slug: 'medico' },
  { id: 3, nome: 'Audiometria', slug: 'audiometria' },
  { id: 4, nome: 'ECG', slug: 'ecg' },
  { id: 5, nome: 'Raio-X', slug: 'raio-x' },
  { id: 6, nome: 'Psicóloga', slug: 'psicologa' },
];

const TIPOS_ASO = [
  { value: 'ADMISSIONAL', label: 'Admissional' },
  { value: 'PERIODICO', label: 'Periódico' },
  { value: 'DEMISSIONAL', label: 'Demissional' },
  { value: 'RETORNO', label: 'Retorno' },
  { value: 'MUDANCA_FUNCAO', label: 'Mudança de Função' },
];

function maskWhatsapp(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCpf(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskCnpj(value) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export default function RecepcaoAsoPage() {
  const [step, setStep] = useState(1);
  const [salas, setSalas] = useState(SALAS);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Dados pessoais
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');

  // Step 2 — Dados profissionais
  const [empresa, setEmpresa] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [funcao, setFuncao] = useState('');
  const [tipoAso, setTipoAso] = useState('ADMISSIONAL');

  // Step 3 — Salas selecionadas
  const [salasSelecionadas, setSalasSelecionadas] = useState([]);

  // Load salas from API
  useEffect(() => {
    axios.get(`${API_URL}/api/salas`).then(r => {
      if (r.data && r.data.length > 0) setSalas(r.data);
    }).catch(() => {});
  }, []);

  function toggleSala(id) {
    setSalasSelecionadas(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  function validateStep1() {
    if (!nome.trim()) return 'Nome é obrigatório';
    const digitsWa = whatsapp.replace(/\D/g, '');
    if (digitsWa.length < 10 || digitsWa.length > 11) return 'WhatsApp deve ter 10 ou 11 dígitos';
    return null;
  }

  function validateStep2() {
    if (!empresa.trim()) return 'Empresa é obrigatória';
    if (!funcao.trim()) return 'Função é obrigatória';
    return null;
  }

  function validateStep3() {
    if (salasSelecionadas.length === 0) return 'Selecione pelo menos uma sala';
    return null;
  }

  function nextStep() {
    setError('');
    let err = null;
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (step === 3) err = validateStep3();
    if (err) { setError(err); return; }
    setStep(s => s + 1);
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      // 1. Create or find paciente
      const waDig = whatsapp.replace(/\D/g, '');

      // Check if patient exists
      let paciente = null;
      try {
        const check = await axios.get(`${API_URL}/api/pacientes/buscar?whatsapp=${waDig}`);
        paciente = check.data;
      } catch {}

      if (!paciente) {
        const resp = await axios.post(`${API_URL}/api/pacientes`, {
          nome: nome.trim(),
          whatsapp: waDig,
          cpf: cpf ? cpf.replace(/\D/g, '') : undefined,
          data_nascimento: dataNascimento || undefined,
        });
        paciente = resp.data;
      }

      // 2. Create atendimento with salas
      await axios.post(`${API_URL}/api/atendimentos`, {
        paciente_id: paciente.id,
        empresa: empresa.trim(),
        cnpj: cnpj ? cnpj.replace(/\D/g, '') : undefined,
        funcao: funcao.trim(),
        tipo_aso: tipoAso,
        salas_ids: salasSelecionadas,
      });

      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao realizar check-in. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setStep(1);
    setNome('');
    setWhatsapp('');
    setCpf('');
    setDataNascimento('');
    setEmpresa('');
    setCnpj('');
    setFuncao('');
    setTipoAso('ADMISSIONAL');
    setSalasSelecionadas([]);
    setError('');
    setSuccess(false);
  }

  const salaLabel = (id) => salas.find(s => s.id === id)?.nome || id;
  const tipoLabel = TIPOS_ASO.find(t => t.value === tipoAso)?.label || tipoAso;

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Check-in realizado!</h2>
          <p className="text-gray-500 mb-2">
            <strong>{nome}</strong> foi adicionado(a) à fila com sucesso.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Uma mensagem de confirmação foi enviada para o WhatsApp.
          </p>
          <button
            onClick={resetForm}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition"
          >
            Novo Check-in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <h1 className="text-2xl font-black text-gray-800">Check-in ASO</h1>
          <p className="text-gray-400 text-sm mt-1">Medicina Ocupacional</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-all ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-4 text-center">
          Etapa {step} de 4 —{' '}
          {step === 1 && 'Dados pessoais'}
          {step === 2 && 'Dados profissionais'}
          {step === 3 && 'Salas de atendimento'}
          {step === 4 && 'Confirmação'}
        </p>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Dados Pessoais</h2>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Nome do paciente"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={e => setWhatsapp(maskWhatsapp(e.target.value))}
                  placeholder="(87) 99999-9999"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  CPF <span className="text-gray-400 text-xs">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={e => setCpf(maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Data de nascimento <span className="text-gray-400 text-xs">(opcional)</span>
                </label>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={e => setDataNascimento(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Dados Profissionais</h2>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Empresa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={empresa}
                  onChange={e => setEmpresa(e.target.value)}
                  placeholder="Nome da empresa"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  CNPJ <span className="text-gray-400 text-xs">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={e => setCnpj(maskCnpj(e.target.value))}
                  placeholder="00.000.000/0001-00"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Função <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={funcao}
                  onChange={e => setFuncao(e.target.value)}
                  placeholder="Ex: Operador de Máquinas"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Tipo de ASO <span className="text-red-500">*</span>
                </label>
                <select
                  value={tipoAso}
                  onChange={e => setTipoAso(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                >
                  {TIPOS_ASO.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-bold text-gray-700 mb-4">Salas de Atendimento</h2>
              <p className="text-sm text-gray-400 mb-4">Selecione as salas que o paciente precisa passar:</p>
              <div className="grid grid-cols-2 gap-3">
                {salas.map(sala => {
                  const selected = salasSelecionadas.includes(sala.id);
                  return (
                    <button
                      key={sala.id}
                      type="button"
                      onClick={() => toggleSala(sala.id)}
                      className={`rounded-xl p-4 text-left border-2 transition-all ${
                        selected
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-sm">{sala.nome}</div>
                      {selected && (
                        <div className="text-xs text-blue-500 mt-1">Selecionado</div>
                      )}
                    </button>
                  );
                })}
              </div>
              {salasSelecionadas.length > 0 && (
                <div className="mt-4 text-sm text-gray-500">
                  {salasSelecionadas.length} sala(s) selecionada(s)
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — Confirmation */}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-bold text-gray-700 mb-4">Confirmar Check-in</h2>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Dados Pessoais</p>
                  <p className="font-bold text-gray-800">{nome}</p>
                  <p className="text-gray-600 text-sm">{whatsapp}</p>
                  {cpf && <p className="text-gray-500 text-sm">CPF: {cpf}</p>}
                  {dataNascimento && <p className="text-gray-500 text-sm">Nascimento: {dataNascimento}</p>}
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Dados Profissionais</p>
                  <p className="font-bold text-gray-800">{empresa}</p>
                  {cnpj && <p className="text-gray-500 text-sm">CNPJ: {cnpj}</p>}
                  <p className="text-gray-600 text-sm">{funcao}</p>
                  <span className="inline-block mt-1 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-semibold">
                    {tipoLabel}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Salas</p>
                  <div className="flex flex-wrap gap-2">
                    {salasSelecionadas.map(id => (
                      <span key={id} className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
                        {salaLabel(id)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button
                type="button"
                onClick={() => { setError(''); setStep(s => s - 1); }}
                className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition"
              >
                Voltar
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition"
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Registrando...' : 'Confirmar Check-in'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
