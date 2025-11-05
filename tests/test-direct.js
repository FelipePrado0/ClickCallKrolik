const axios = require('axios');

async function test() {
  try {
    console.log('Testando POST direto...');
    const response = await axios.post('http://localhost:4201/api/transcribe', {
      codigo: '20251103_113826_1003029_103_16981892476_1762180698',
      companyCode: '100',
      calldate: '2025-11-04 12:00:00'
    }, {
      timeout: 120000,
      validateStatus: () => true
    });
    
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('Erro:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

test();

