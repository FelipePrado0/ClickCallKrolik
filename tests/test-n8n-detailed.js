/**
 * Teste Detalhado do Webhook do n8n
 * Testa se os dados estão chegando corretamente no workflow
 */

const https = require('https');
const { URL } = require('url');

const N8N_WEBHOOK_URL = 'https://n8n-k-production.up.railway.app/webhook/d7070f2c-fffd-4ba1-b567-a10a1c9661d9';

// Payload de teste completo (simulando exatamente o que o Delorean envia)
const payload = new URLSearchParams({
  src: '1001099',
  dst: '16981317956',
  userfield: `20251029_${Date.now().toString().slice(-8)}_1001099_103_16981317956_${Date.now()}`,
  calldate: '2025-10-30 23:50:00',
  duration: '65',
  billsec: '60',
  disposition: 'ANSWER',
  callid: `test-callid-detailed-${Date.now()}`,
  price: '0.105',
  company_id: '100',
  accountcode: '5.00',
  uniqueid: `unique-${Date.now()}`
});

const url = new URL(N8N_WEBHOOK_URL);
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
console.log('🧪 Teste Detalhado do Webhook n8n');
console.log('═══════════════════════════════════════════════════');
console.log(`URL: ${N8N_WEBHOOK_URL}`);
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
      console.log(data);
    }
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 Análise:');
    console.log('═══════════════════════════════════════════════════');
    
    if (res.statusCode === 200) {
      console.log('✅ Webhook respondeu com status 200 OK');
      console.log('\n💡 IMPORTANTE:');
      console.log('   O n8n pode responder "success" mesmo que o workflow ainda não tenha processado.');
      console.log('   Verifique no n8n:');
      console.log('   1. Abra o workflow "Gravações ClickToCall – Pós Gravação"');
      console.log('   2. Clique em "Executions" (ou "Execuções")');
      console.log('   3. Procure pela execução mais recente');
      console.log('   4. Verifique se os dados chegaram corretamente');
      console.log('\n📝 Possíveis problemas:');
      console.log('   - Workflow pode estar em modo TESTE, não PRODUÇÃO');
      console.log('   - Nó "Normalizar Campos" pode não estar pegando os dados do $json.body');
      console.log('   - Nó IF "Campos Obrigatórios" pode estar rejeitando');
      console.log('   - Verifique se os campos estão sendo acessados corretamente');
    } else if (res.statusCode === 404) {
      console.log('❌ Webhook não encontrado (404)');
      console.log('   - Verifique se o workflow está ATIVO');
      console.log('   - Verifique se o webhook ID está correto');
    } else {
      console.log(`⚠️  Status inesperado: ${res.statusCode}`);
    }
    
    console.log('\n🔍 Para verificar no n8n:');
    console.log('   1. Acesse o n8n: https://n8n-k-production.up.railway.app');
    console.log('   2. Abra o workflow');
    console.log('   3. Verifique a aba "Executions"');
    console.log('   4. Procure pela execução mais recente com o callid:', payload.get('callid'));
    console.log('═══════════════════════════════════════════════════');
  });
});

req.on('error', (error) => {
  console.error('❌ Erro ao fazer requisição:', error.message);
  console.error('Stack:', error.stack);
});

req.write(payload.toString());
req.end();
