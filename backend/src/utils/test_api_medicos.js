const axios = require('axios');

async function testApi() {
  try {
    console.log('Testando GET http://localhost:5000/api/medicos ...');
    const res = await axios.get('http://localhost:5000/api/medicos');
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

testApi();
