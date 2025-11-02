/**
 * Teste do webhook do n8n
 * Testa se o webhook está configurado e ativo
 */

const http = require('https');
const { URL } = require('url');

const N8N_WEBHOOK_URL = 'https://n8n-k-production.up.railway.app/webhook/d7070f2c-fffd-4ba1-b567-a10a1c9661d9';

// Payload de teste
const payload = new URLSearchParams({
  src: '1001099',
  dst: '16981317956',
  userfield: `test_curl_${Date.now()}`,
  calldate: '2025-01-28 12:00:00',
  duration: '60',
  billsec: '55',
  disposition: 'ANSWER',
  callid: `test-callid-curl-${Date.now()}`,
  price: '0.105',
  company_id: '100',
  accountcode: '5.00'
});

const url = new URL(N8N_WEBHOOK_URL);
const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(payload.toString())
  }
};

console.log('═══════════════════════════════════════════════════');
console.log('🧪 Testando Webhook do n8n');
console.log('═══════════════════════════════════════════════════');
console.log(`URL: ${N8N_WEBHOOK_URL}`);
console.log(`Método: POST`);
console.log(`Payload:`);
console.log(payload.toString().split('&').join('\n  '));
console.log('');

const req = http.request(options, (res) => {
  let data = '';
  
  console.log(`📥 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers:`, JSON.stringify(res.headers, null, 2));
  console.log('');
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📄 Response Body:');
    try {
      const jsonResponse = JSON.parse(data);
      console.log(JSON.stringify(jsonResponse, null, 2));
      
      if (res.statusCode === 404) {
        console.log('\n❌ ERRO: Webhook não encontrado ou workflow não está ativo!');
        console.log('💡 Soluções:');
        console.log('   1. Verifique se o workflow está ativo no n8n');
        console.log('   2. Verifique se o webhook ID está correto');
        console.log('   3. Verifique se o webhook está configurado para aceitar POST');
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('\n✅ Webhook está ativo e funcionando!');
      } else {
        console.log(`\n⚠️  Status inesperado: ${res.statusCode}`);
      }
    } catch (e) {
      console.log(data);
      if (data.trim() === '') {
        console.log('(resposta vazia)');
      }
    }
    
    console.log('═══════════════════════════════════════════════════');
  });
});

req.on('error', (error) => {
  console.error('❌ Erro ao fazer requisição:', error.message);
  console.error('Stack:', error.stack);
});

req.write(payload.toString());
req.end();
