/**
 * Teste da URL do Workflow do n8n
 * Verifica se o workflow está acessível
 */

const https = require('https');
const { URL } = require('url');

const WORKFLOW_URL = 'https://n8n-k-production.up.railway.app/workflow/v6AKPm3MdE1CJHR9';

const url = new URL(WORKFLOW_URL);
const options = {
  hostname: url.hostname,
  port: url.port || 443,
  path: url.pathname,
  method: 'GET',
  headers: {
    'User-Agent': 'ClickToCall-Test/1.0'
  }
};

console.log('═══════════════════════════════════════════════════');
console.log('🧪 Testando URL do Workflow n8n');
console.log('═══════════════════════════════════════════════════');
console.log(`URL: ${WORKFLOW_URL}`);
console.log(`Método: GET`);
console.log('\n⏳ Enviando requisição...\n');

const req = https.request(options, (res) => {
  let data = '';
  
  console.log(`📥 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers:`);
  console.log(JSON.stringify(res.headers, null, 2));
  console.log('');
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📄 Response Body:');
    
    if (data.trim() === '') {
      console.log('(resposta vazia)');
    } else if (data.length > 2000) {
      console.log(data.substring(0, 2000) + '\n...(truncado)');
      console.log(`\nTotal de bytes: ${data.length}`);
    } else {
      console.log(data);
    }
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 Análise:');
    console.log('═══════════════════════════════════════════════════');
    
    if (res.statusCode === 200) {
      console.log('✅ URL do workflow está acessível!');
      
      // Verificar se é HTML (página do n8n) ou JSON (API)
      const contentType = res.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        console.log('📄 Retornou HTML (página do workflow)');
        console.log('💡 Esta é uma URL de visualização do workflow no n8n');
      } else if (contentType.includes('application/json')) {
        console.log('📄 Retornou JSON (API do workflow)');
        try {
          const json = JSON.parse(data);
          console.log('Dados JSON:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('(Não é JSON válido)');
        }
      }
    } else if (res.statusCode === 404) {
      console.log('❌ Workflow não encontrado (404)');
      console.log('   - Verifique se o ID do workflow está correto');
      console.log('   - Verifique se você tem permissão para acessar');
    } else {
      console.log(`⚠️  Status: ${res.statusCode}`);
    }
    
    console.log('═══════════════════════════════════════════════════');
  });
});

req.on('error', (error) => {
  console.error('❌ Erro ao fazer requisição:', error.message);
  console.error('Stack:', error.stack);
});

req.end();
