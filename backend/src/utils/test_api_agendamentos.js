const axios = require('axios');

async function testAgendamentos() {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    console.log(`Testando GET http://localhost:5000/api/agendamentos/recepcao/dia?data=${hoje} ...`);
    const res = await axios.get(`http://localhost:5000/api/agendamentos/recepcao/dia?data=${hoje}`);
    console.log('Status:', res.status);
    console.log('Dados:', res.data);
  } catch (error) {
    console.error('Erro na requisição:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
  }
}

testAgendamentos();
