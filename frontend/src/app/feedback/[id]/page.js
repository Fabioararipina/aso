'use client';

import { useState, use } from 'react';
import axios from 'axios';

export default function FeedbackPage({ params }) {
  // Desembrulha a promise params
  const { id } = use(params);
  
  const [nota, setNota] = useState(null);
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-agendamento.primeatende.com.br';

  const enviarFeedback = async () => {
    if (nota === null) return alert('Por favor, selecione uma nota.');
    
    try {
      await axios.post(`${API_URL}/api/agendamentos/${id}/feedback`, { nota, comentario });
      setEnviado(true);
    } catch (error) {
      alert('Erro ao enviar feedback. Tente novamente.');
    }
  };

  if (enviado) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
          <div className="text-6xl mb-4">💙</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Obrigado!</h1>
          <p className="text-gray-600">Sua opinião é fundamental para evoluirmos.</p>
          {nota >= 9 && (
            <div className="mt-6 bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">Gostou mesmo? Avalie-nos no Google:</p>
              <a href="#" className="text-blue-600 font-bold hover:underline">Google Reviews ↗</a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-lg w-full">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">Pesquisa de Satisfação</h1>
        <p className="text-center text-gray-500 mb-8">
          Em uma escala de 0 a 10, o quanto você indicaria a <span className="font-bold text-blue-600">Essencial Saúde</span> para um amigo?
        </p>

        <div className="grid grid-cols-11 gap-1 mb-8">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              onClick={() => setNota(n)}
              className={`
                aspect-square rounded-lg font-bold text-sm sm:text-base transition transform hover:scale-110
                ${nota === n 
                  ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                ${n <= 6 ? 'hover:bg-red-100' : n <= 8 ? 'hover:bg-yellow-100' : 'hover:bg-green-100'}
              `}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Algo que podemos melhorar? (Opcional)
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            rows="3"
            placeholder="Elogios, críticas ou sugestões..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
        </div>

        <button
          onClick={enviarFeedback}
          disabled={nota === null}
          className={`w-full py-4 rounded-xl font-bold text-lg transition shadow-md
            ${nota !== null 
              ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
          `}
        >
          ENVIAR AVALIAÇÃO
        </button>
      </div>
    </div>
  );
}
