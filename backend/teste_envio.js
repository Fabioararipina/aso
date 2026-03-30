const axios = require('axios');

// --- CONFIGURAÇÕES ---
// Substitua pelo número de telefone para o qual você quer enviar a mensagem.
// Formato: Apenas números, com código do país e DDD. 
// Exemplo para um número de São Paulo (11): '5511912345678'
// Exemplo para um número de Pernambuco (87): '5587912345678'
const numeroDestino = '5587999478492'; // <-- COLOQUE O NÚMERO DE TESTE AQUI

// Substitua pela mensagem que você quer enviar.
const mensagem = 'Esta é uma mensagem de teste enviada pelo script Node.js!'; // <-- COLOQUE A MENSAGEM AQUI
// --------------------


const API_URL = 'http://localhost:5000/api/whatsapp/enviar';

async function testarEnvio() {
  if (!numeroDestino || !mensagem) {
    console.error('Por favor, defina as variáveis "numeroDestino" e "mensagem" no início do script.');
    return;
  }

  console.log(`Tentando enviar a seguinte mensagem para ${numeroDestino}:`);
  console.log(`"${mensagem}"`);
  console.log('---');

  try {
    const response = await axios.post(API_URL, {
      numero: numeroDestino,
      mensagem: mensagem,
    });

    console.log('✅ Sucesso! Resposta do servidor:');
    console.log(response.data);
  } catch (error) {
    console.error('❌ Falha na requisição!');
    if (error.response) {
      // O servidor respondeu com um status de erro
      console.error('Status do erro:', error.response.status);
      console.error('Dados do erro:', error.response.data);
    } else if (error.request) {
      // A requisição foi feita, mas não houve resposta
      console.error('Não foi possível conectar ao servidor. O backend está rodando na porta 5000?');
      console.error(error.request);
    } else {
      // Algo deu errado ao configurar a requisição
      console.error('Erro ao configurar a requisição:', error.message);
    }
  }
}

testarEnvio();
