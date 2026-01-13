'use client';

export default function CartaoPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      
      {/* Hero Section */}
      <header className="bg-gradient-to-br from-green-600 to-green-800 text-white pb-20 pt-8 px-4 rounded-b-[3rem] shadow-2xl relative overflow-hidden">
        <div className="max-w-md mx-auto relative z-10 text-center">
          <img src="/logo.png" alt="Essencial Saúde" className="h-20 mx-auto mb-6 bg-white p-2 rounded-xl shadow-lg" />
          <span className="bg-green-500 bg-opacity-30 text-green-100 px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-4 inline-block backdrop-blur-sm border border-green-400">
            LANÇAMENTO
          </span>
          <h1 className="text-4xl font-black mb-4 leading-tight">
            Sua saúde merece <br/>
            <span className="text-green-200">ser prioridade.</span>
          </h1>
        </div>
      </header>

      {/* COMPARAÇÃO */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 items-stretch">
          
          {/* COLUNA NEGATIVA */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-t-8 border-red-500 transform hover:scale-[1.02] transition duration-300">
            <div className="bg-red-50 p-8 text-center">
              <h3 className="text-2xl font-bold text-red-600">Plano Funerário</h3>
              <p className="text-red-400">Foco no Pós-Vida</p>
            </div>
            <ul className="p-8 space-y-4">
              {[
                "Foco no pós-vida",
                "Benefícios em vida são limitados",
                "Uso eventual ou quase nenhum",
                "Acesso pode ser burocrático",
                "Pagamento mensal contínuo",
                "Contrato e fidelidade obrigatória",
                "Pouco retorno no dia a dia"
              ].map((item, i) => (
                <li key={i} className="flex items-start text-gray-600">
                  <span className="text-red-500 mr-3 text-xl">❌</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* COLUNA POSITIVA (DESTACADA) */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-t-8 border-green-500 transform scale-105 z-10 relative">
            <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg uppercase">
              Melhor Escolha
            </div>
            <div className="bg-green-50 p-8 text-center">
              <h3 className="text-3xl font-bold text-green-600">Cartão Essencial Saúde</h3>
              <p className="text-green-500">Cuidando de você AGORA</p>
            </div>
            <ul className="p-8 space-y-4">
              {[
                "Foco na saúde durante a vida",
                "Consultas, exames, odonto e psicologia",
                "Benefícios reais e constantes",
                "Acesso imediato e facilitado",
                "Sem contrato, sem carência",
                "Você usa quando precisa",
                "Economia com liberdade"
              ].map((item, i) => (
                <li key={i} className="flex items-start text-gray-700 font-medium">
                  <span className="text-green-500 mr-3 text-xl">✅</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="p-8 bg-green-50 text-center">
              <a href="https://wa.me/5587999999999?text=Quero%20o%20Cartao%20Essencial" className="inline-block w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition transform hover:-translate-y-1">
                QUERO MEU CARTÃO
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* BENEFÍCIOS EXTRAS */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-12">Por que somos diferentes?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6">
              <div className="text-5xl mb-4">🏥</div>
              <h3 className="text-xl font-bold mb-2">Rede Credenciada</h3>
              <p className="text-gray-500">Os melhores médicos e clínicas da região.</p>
            </div>
            <div className="p-6">
              <div className="text-5xl mb-4">💰</div>
              <h3 className="text-xl font-bold mb-2">Descontos Reais</h3>
              <p className="text-gray-500">Economize até 70% em consultas e exames.</p>
            </div>
            <div className="p-6">
              <div className="text-5xl mb-4">🚀</div>
              <h3 className="text-xl font-bold mb-2">Sem Burocracia</h3>
              <p className="text-gray-500">Faça o cartão e use no mesmo dia.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 bg-blue-900 text-white text-center px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Invista em quem você ama.</h2>
        <p className="text-xl text-blue-200 mb-8 max-w-2xl mx-auto">
          Não espere o pior acontecer. Garanta acesso à saúde de qualidade por um preço que cabe no bolso.
        </p>
        <a href="https://wa.me/5587999999999?text=Quero%20o%20Cartao%20Essencial" className="bg-white text-blue-900 font-bold py-4 px-10 rounded-full text-lg hover:bg-blue-50 transition shadow-xl">
          FALAR COM ATENDENTE
        </a>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>© 2026 Essencial Saúde. Todos os direitos reservados.</p>
        <div className="mt-4">
          <a href="#" className="hover:text-white mx-2">Avalie no Google</a> | 
          <a href="/" className="hover:text-white mx-2">Voltar ao Início</a>
        </div>
      </footer>

    </div>
  );
}