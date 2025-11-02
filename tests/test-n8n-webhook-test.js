/**
 * Teste do webhook de TESTE do n8n
 * URL de teste (não produção)
 */

const https = require('https');
const { URL } = require('url');

const N8N_WEBHOOK_TEST_URL = 'https://n8n-k-production.up.railway.app/webhook-test/d7070f2c-fffd-4ba1-b567-a10a1c9661d9';

// Payload de teste completo
const payload = new URLSearchParams({
  src: '1001099',
  dst: '16981317956',
  userfield: `20251029_${Date.now().toString().slice(-8)}_1001099_103_16981317956_${Date.now()}`,
  calldate: '2025-10-30 23:55:00',
  duration: '65',
  billsec: '60',
  disposition: 'ANSWER',
  callid: `test-callid-webhook-test-${Date.now()}`,
  price: '0.105',
  company_id: '100',
  accountcode: '5.00',
  uniqueid: `unique-${Date.now()}`
});

const url = new URL(N8N_WEBHOOK_TEST_URL);
const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(payload.toString()),
    'User-Agent': 'ClickToCall-Test/1.0'
  }
};

console.log('═══════════════════════════════════════════════════');
console.log('🧪 Testando Webhook de TESTE do n8n');
console.log('═══════════════════════════════════════════════════');
console.log(`URL: ${N8N_WEBHOOK_TEST_URL}`);
console.log(`Método: POST`);
console.log(`Content-Type: application/x-www-form-urlencoded`);
console.log('\n📦 Payload enviado:');
console.log(payload.toString().split('&').join('\n  '));
console.log('\n⏳ Enviando requisição...\n');

const req = https.request(options, (res) => {
  let data = '';
  
  console.log(`📥 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers de Resposta:`);
  console.log(JSON.stringify(res.headers, null, 2));
  console.log('');
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📄 Response Body:');
    if (data.trim() === '') {
      console.log('(resposta vazia)');
    } else {
      try {
        const jsonResponse = JSON.parse(data);
        console.log(JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log(data);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 Análise:');
    console.log('═══════════════════════════════════════════════════');
    
    if (res.statusCode === 200) {
      console.log('✅ Webhook de TESTE respondeu com status 200 OK');
      console.log('\n💡 IMPORTANTE:');
      console.log('   Este é o webhook de TESTE do n8n.');
      console.log('   Os dados devem aparecer no canvas do workflow em tempo real!');
      console.log('\n📝 Verificar no n8n:');
      console.log('   1. Abra o workflow "Gravações ClickToCall – Pós Gravação"');
      console.log('   2. Veja o canvas do workflow');
      console.log('   3. Os dados devem aparecer nos nós conectados ao webhook');
      console.log('   4. Execute manualmente o workflow para ver os dados');
    } else if (res.statusCode === 404) {
      console.log('❌ Webhook de TESTE não encontrado (404)');
      console.log('   - Verifique se o workflow está aberto no editor');
      console.log('   - Verifique se o webhook ID está correto');
    } else {
      console.log(`⚠️  Status inesperado: ${res.statusCode}`);
    }
    
    console.log('\n🔍 CallID para rastrear:');
    console.log(`   ${payload.get('callid')}`);
    console.log('═══════════════════════════════════════════════════');
  });
});

req.on('error', (error) => {
  console.error('❌ Erro ao fazer requisição:', error.message);
  console.error('Stack:', error.stack);
});

req.write(payload.toString());
req.end();
