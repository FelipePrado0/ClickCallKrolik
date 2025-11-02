/**
 * Teste: simular webhook de gravação concluída do Delorean
 * Como executar:
 *   node tests/simulate-delorean-webhook.js [cenario]
 * 
 * Cenários disponíveis:
 *   - answer: Chamada atendida (padrão)
 *   - noanswer: Chamada não atendida
 *   - busy: Linha ocupada
 *   - cancel: Chamada cancelada
 *   - invalid: Dados inválidos (para testar validações)
 * 
 * Pré-requisitos:
 *   - Servidor `webhook-server.js` em execução (PORT=3000 por padrão)
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Gera payload de webhook para cada cenário
 */
function generateWebhookPayload(cenario) {
  const now = new Date();
  const calldate = now.toISOString().replace('T', ' ').substring(0, 19); // Y-m-d H:i:s
  
  const cenarios = {
    // Cenário 1: ANSWER - Chamada atendida com sucesso
    answer: {
      src: '1001099',
      dst: '16981317956',
      userfield: `20251029_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}_1001099_103_16981317956_${Date.now()}`,
      calldate: calldate,
      duration: '65',
      billsec: '60',
      disposition: 'ANSWER',
      callid: `test-callid-${Date.now()}`,
      price: '0.105',
      company_id: '100',
      accountcode: '5.00',
      uniqueid: `unique-${Date.now()}`
    },
    
    // Cenário 2: NO ANSWER - Chamada não atendida
    noanswer: {
      src: '1001099',
      dst: '16981317956',
      userfield: `20251029_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}_1001099_103_16981317956_${Date.now()}`,
      calldate: calldate,
      duration: '30', // Tempo de toque
      billsec: '0', // Sem conversação
      disposition: 'NO ANSWER',
      callid: `test-callid-${Date.now()}`,
      price: '0',
      company_id: '100',
      accountcode: '5.00'
    },
    
    // Cenário 3: BUSY - Linha ocupada
    busy: {
      src: '1001099',
      dst: '16981317956',
      userfield: `20251029_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}_1001099_103_16981317956_${Date.now()}`,
      calldate: calldate,
      duration: '5',
      billsec: '0',
      disposition: 'BUSY',
      callid: `test-callid-${Date.now()}`,
      price: '0',
      company_id: '100',
      accountcode: '5.00'
    },
    
    // Cenário 4: CANCEL - Chamada cancelada
    cancel: {
      src: '1001099',
      dst: '16981317956',
      userfield: `20251029_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}_1001099_103_16981317956_${Date.now()}`,
      calldate: calldate,
      duration: '10',
      billsec: '0',
      disposition: 'CANCEL',
      callid: `test-callid-${Date.now()}`,
      price: '0',
      company_id: '100',
      accountcode: '5.00'
    },
    
    // Cenário 5: Dados inválidos (para testar validações)
    invalid: {
      src: '', // Campo obrigatório vazio
      dst: '16981317956',
      userfield: '', // Campo obrigatório vazio
      calldate: calldate,
      duration: 'abc', // Tipo inválido
      billsec: 'xyz', // Tipo inválido
      disposition: 'INVALID_STATUS',
      price: 'not-a-number' // Tipo inválido
    }
  };
  
  return cenarios[cenario] || cenarios.answer;
}

/**
 * Envia webhook para o servidor
 */
function sendWebhook(cenario) {
  return new Promise((resolve, reject) => {
    const payload = generateWebhookPayload(cenario);
    const params = new URLSearchParams(payload);
    
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/webhook/delorean',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(params.toString())
      }
    };
    
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`📤 Enviando webhook: ${cenario.toUpperCase()}`);
    console.log(`═══════════════════════════════════════════════════`);
    console.log(`URL: ${BASE_URL}/webhook/delorean`);
    console.log(`Payload:`);
    console.log(params.toString().split('&').join('\n  '));
    console.log('');
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`📥 Resposta:`);
          console.log(JSON.stringify(response, null, 2));
          console.log(`\n💡 Verifique os logs do servidor para confirmar:`);
          console.log(`   - Webhook recebido e armazenado`);
          console.log(`   - Encaminhamento para n8n`);
          console.log(`   - Logs estruturados com request-id, callid e userfield`);
          console.log(`═══════════════════════════════════════════════════\n`);
          
          resolve({ status: res.statusCode, response });
        } catch (e) {
          console.error(`❌ Erro ao parsear resposta: ${e.message}`);
          console.log(`Resposta raw: ${data}`);
          resolve({ status: res.statusCode, response: data });
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`❌ Erro ao enviar webhook: ${err.message}`);
      reject(err);
    });
    
    req.write(params.toString());
    req.end();
  });
}

/**
 * Testa endpoint de auditoria
 */
function testAudit() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/audit?limit=10',
      method: 'GET'
    };
    
    console.log(`\n📊 Testando endpoint de auditoria...`);
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`📥 Eventos de auditoria:`);
          console.log(`   Total: ${response.total}`);
          console.log(`   Retornados: ${response.returned}`);
          console.log(JSON.stringify(response.events.slice(-3), null, 2)); // Últimos 3 eventos
          resolve(response);
        } catch (e) {
          console.error(`❌ Erro ao parsear resposta: ${e.message}`);
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

/**
 * Testa endpoint de estatísticas
 */
function testStats() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/stats',
      method: 'GET'
    };
    
    console.log(`\n📈 Testando endpoint de estatísticas...`);
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`📥 Estatísticas:`);
          console.log(JSON.stringify(response.stats, null, 2));
          resolve(response);
        } catch (e) {
          console.error(`❌ Erro ao parsear resposta: ${e.message}`);
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

/**
 * Testa endpoint de health check
 */
function testHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/health',
      method: 'GET'
    };
    
    console.log(`\n❤️  Testando health check...`);
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`📥 Health:`, JSON.stringify(response, null, 2));
          resolve(response);
        } catch (e) {
          console.error(`❌ Erro ao parsear resposta: ${e.message}`);
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

/**
 * Executa todos os testes sequencialmente
 */
async function runAllTests() {
  console.log('\n🎯 Executando todos os testes...\n');
  
  try {
    // Health check primeiro
    await testHealth();
    
    // Testes de cenários funcionais
    console.log('\n📋 TESTES DE CENÁRIOS FUNCIONAIS:');
    await sendWebhook('answer');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1s entre testes
    
    await sendWebhook('noanswer');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await sendWebhook('busy');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await sendWebhook('cancel');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Teste de dados inválidos
    console.log('\n⚠️  TESTE DE VALIDAÇÃO (dados inválidos):');
    await sendWebhook('invalid');
    
    // Testes de endpoints auxiliares
    await testAudit();
    await testStats();
    
    console.log('\n✅ Todos os testes concluídos!');
    console.log('\n📝 Próximos passos:');
    console.log('   1. Verifique os logs do servidor para confirmar processamento');
    console.log('   2. Verifique o n8n para confirmar recebimento dos webhooks');
    console.log('   3. Verifique o frontend para confirmar que os webhooks foram processados');
    
  } catch (error) {
    console.error('\n❌ Erro durante os testes:', error);
    process.exit(1);
  }
}

/**
 * Main
 */
const cenario = process.argv[2] || 'all';

if (cenario === 'all') {
  runAllTests();
} else if (['answer', 'noanswer', 'busy', 'cancel', 'invalid'].includes(cenario)) {
  sendWebhook(cenario)
    .then(() => {
      console.log('\n✅ Teste concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro no teste:', error);
      process.exit(1);
    });
} else {
  console.log('Uso: node tests/simulate-delorean-webhook.js [cenario]');
  console.log('\nCenários disponíveis:');
  console.log('  all       - Executa todos os testes (padrão)');
  console.log('  answer    - Chamada atendida');
  console.log('  noanswer  - Chamada não atendida');
  console.log('  busy      - Linha ocupada');
  console.log('  cancel    - Chamada cancelada');
  console.log('  invalid   - Dados inválidos (validação)');
  process.exit(1);
}