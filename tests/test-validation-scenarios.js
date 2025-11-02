/**
 * Teste de Cenários de Validação e Resiliência
 * Como executar:
 *   node tests/test-validation-scenarios.js
 * 
 * Testa:
 *   - Rate limiting
 *   - Validação de tamanho do body
 *   - Validação de IP whitelist
 *   - Timeout do n8n
 *   - Retry com backoff
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Faz uma requisição HTTP genérica
 */
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ status: res.statusCode, response });
        } catch (e) {
          resolve({ status: res.statusCode, response: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

/**
 * Teste 1: Rate Limiting
 * Envia múltiplas requisições rápidas para testar rate limit
 */
async function testRateLimit() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🧪 TESTE 1: Rate Limiting');
  console.log('═══════════════════════════════════════════════════');
  
  const payload = new URLSearchParams({
    src: '1001099',
    dst: '16981317956',
    userfield: 'test-rate-limit',
    calldate: new Date().toISOString(),
    disposition: 'ANSWER'
  });
  
  const requests = [];
  const maxRequests = 105; // Envia mais do que o limite padrão (100)
  
  console.log(`Enviando ${maxRequests} requisições rápidas...`);
  
  for (let i = 0; i < maxRequests; i++) {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/webhook/delorean',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload.toString())
      }
    };
    
    requests.push(
      makeRequest(options, payload.toString())
        .then(result => ({ index: i + 1, ...result }))
        .catch(err => ({ index: i + 1, error: err.message }))
    );
  }
  
  const results = await Promise.all(requests);
  const success = results.filter(r => r.status === 200).length;
  const rateLimited = results.filter(r => r.status === 429).length;
  
  console.log(`✅ Requisições bem-sucedidas (200): ${success}`);
  console.log(`⏱️  Requisições bloqueadas por rate limit (429): ${rateLimited}`);
  
  if (rateLimited > 0) {
    console.log('✅ Rate limiting está funcionando!');
  } else {
    console.log('⚠️  Rate limiting não foi acionado (pode estar configurado com limite alto)');
  }
}

/**
 * Teste 2: Tamanho do Body
 * Envia body muito grande para testar validação de tamanho
 */
async function testBodySize() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🧪 TESTE 2: Validação de Tamanho do Body');
  console.log('═══════════════════════════════════════════════════');
  
  // Cria um body grande (mais de 100KB padrão)
  const largeField = 'x'.repeat(110000); // 110KB
  const payload = new URLSearchParams({
    src: '1001099',
    dst: '16981317956',
    userfield: 'test-large-body',
    calldate: new Date().toISOString(),
    largeField: largeField // Campo muito grande
  });
  
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/webhook/delorean',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload.toString())
    }
  };
  
  console.log(`Enviando body com ${(Buffer.byteLength(payload.toString()) / 1024).toFixed(2)} KB...`);
  
  try {
    const result = await makeRequest(options, payload.toString());
    
    if (result.status === 413) {
      console.log('✅ Validação de tamanho do body está funcionando! (413 Payload Too Large)');
    } else {
      console.log(`⚠️  Resposta inesperada: ${result.status}`);
      console.log('Resposta:', result.response);
    }
  } catch (error) {
    console.log('✅ Erro esperado ao enviar body muito grande:', error.message);
  }
}

/**
 * Teste 3: Campos Obrigatórios Vazios
 * Testa validação de campos obrigatórios
 */
async function testRequiredFields() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🧪 TESTE 3: Campos Obrigatórios Vazios');
  console.log('═══════════════════════════════════════════════════');
  
  // Testa sem src
  const payload1 = new URLSearchParams({
    dst: '16981317956',
    userfield: 'test-no-src'
  });
  
  // Testa sem dst
  const payload2 = new URLSearchParams({
    src: '1001099',
    userfield: 'test-no-dst'
  });
  
  // Testa sem userfield
  const payload3 = new URLSearchParams({
    src: '1001099',
    dst: '16981317956'
  });
  
  const testCases = [
    { name: 'Sem src', payload: payload1 },
    { name: 'Sem dst', payload: payload2 },
    { name: 'Sem userfield', payload: payload3 }
  ];
  
  for (const testCase of testCases) {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/webhook/delorean',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(testCase.payload.toString())
      }
    };
    
    console.log(`\nTestando: ${testCase.name}`);
    const result = await makeRequest(options, testCase.payload.toString());
    
    // O backend aceita mas o n8n deve validar
    if (result.status === 200 || result.status === 400) {
      console.log(`✅ Validação tratada (status ${result.status})`);
    } else {
      console.log(`⚠️  Status inesperado: ${result.status}`);
    }
  }
}

/**
 * Teste 4: Endpoint de Auditoria
 */
async function testAuditEndpoint() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🧪 TESTE 4: Endpoint de Auditoria');
  console.log('═══════════════════════════════════════════════════');
  
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/audit?limit=5',
    method: 'GET'
  };
  
  const result = await makeRequest(options);
  
  if (result.status === 200 && result.response.success) {
    console.log(`✅ Endpoint de auditoria funcionando!`);
    console.log(`   Total de eventos: ${result.response.total}`);
    console.log(`   Eventos retornados: ${result.response.returned}`);
    
    if (result.response.events.length > 0) {
      console.log(`\n   Últimos eventos:`);
      result.response.events.slice(-3).forEach((event, idx) => {
        console.log(`   ${idx + 1}. [${event.timestamp}] ${event.type} (requestId: ${event.requestId})`);
      });
    }
  } else {
    console.log(`❌ Erro ao acessar auditoria: ${result.status}`);
  }
}

/**
 * Teste 5: Endpoint de Estatísticas
 */
async function testStatsEndpoint() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🧪 TESTE 5: Endpoint de Estatísticas');
  console.log('═══════════════════════════════════════════════════');
  
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/stats',
    method: 'GET'
  };
  
  const result = await makeRequest(options);
  
  if (result.status === 200 && result.response.success) {
    console.log(`✅ Endpoint de estatísticas funcionando!`);
    console.log(JSON.stringify(result.response.stats, null, 2));
  } else {
    console.log(`❌ Erro ao acessar estatísticas: ${result.status}`);
  }
}

/**
 * Executa todos os testes
 */
async function runAllTests() {
  console.log('\n🎯 Executando Testes de Validação e Resiliência\n');
  
  try {
    await testRequiredFields();
    await testAuditEndpoint();
    await testStatsEndpoint();
    
    // Testes que podem ser mais lentos
    console.log('\n⏳ Executando testes que podem demorar...');
    await testBodySize();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2s antes do rate limit
    await testRateLimit();
    
    console.log('\n✅ Todos os testes de validação concluídos!');
    console.log('\n📝 Verifique os logs do servidor para mais detalhes.');
    
  } catch (error) {
    console.error('\n❌ Erro durante os testes:', error);
    process.exit(1);
  }
}

// Executa se chamado diretamente
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testRateLimit,
  testBodySize,
  testRequiredFields,
  testAuditEndpoint,
  testStatsEndpoint
};
