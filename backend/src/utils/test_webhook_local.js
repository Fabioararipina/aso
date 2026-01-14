const axios = require('axios');

// Configurações
const API_URL = 'http://localhost:5000';
const PAYMENT_ID = '123456789'; // ID fictício para teste de log

async function testWebhook() {
  console.log('--- TESTANDO WEBHOOK LOCAL ---');
  
  const payload = {
    action: 'payment.created',
    api_version: 'v1',
    data: {
      id: PAYMENT_ID
    },
    date_created: new Date().toISOString(),
    id: 105844243543,
    live_mode: true,
    type: 'payment',
    user_id: '12345678'
  };

  try {
    const response = await axios.post(`${API_URL}/api/pagamentos/webhook`, payload);
    console.log('Status da Resposta:', response.status);
    console.log('Dados da Resposta:', response.data);
    console.log('\nVerifique o console do backend para ver os logs de recebimento.');
  } catch (error) {
    console.error('Erro ao chamar webhook:', error.message);
    if (error.response) {
      console.error('Detalhes:', error.response.data);
    }
  }
}

testWebhook();
