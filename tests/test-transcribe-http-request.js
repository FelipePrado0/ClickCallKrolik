/**
 * Teste de requisição HTTP completa
 * Simula exatamente o que o frontend faz
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:4201';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testarRequisicaoHTTP() {
  log('\n🔍 Testando requisição HTTP completa...\n', 'blue');
  
  const codigo = '20251105_101703_1003029_103_16981892476_1762348616';
  const companyCode = '100';
  const hoje = new Date();
  const calldate = hoje.toISOString().split('T')[0] + ' ' + hoje.toTimeString().split(' ')[0];
  
  log(`📋 Parâmetros:`, 'cyan');
  log(`   Código: ${codigo}`, 'cyan');
  log(`   Company Code: ${companyCode}`, 'cyan');
  log(`   Calldate: ${calldate}`, 'cyan');
  
  try {
    log(`\n📡 Fazendo POST para ${BASE_URL}/api/transcribe`, 'blue');
    
    const response = await axios.post(`${BASE_URL}/api/transcribe`, {
      codigo: codigo,
      companyCode: companyCode,
      calldate: calldate
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      validateStatus: function (status) {
        return status < 500;
      }
    });
    
    log(`\n📥 Resposta recebida:`, 'cyan');
    log(`   Status: ${response.status}`, response.status === 200 ? 'green' : 'red');
    log(`   Headers:`, 'cyan');
    Object.keys(response.headers).forEach(key => {
      log(`      ${key}: ${response.headers[key]}`, 'cyan');
    });
    
    log(`\n📄 Body:`, 'cyan');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.success) {
      log(`\n✅ Transcrição bem-sucedida!`, 'green');
      log(`   Provider: ${response.data.provider}`, 'cyan');
      log(`   Modelo: ${response.data.model}`, 'cyan');
      log(`   Duração: ${response.data.duration}s`, 'cyan');
      log(`   Transcrição: ${response.data.transcription.substring(0, 100)}...`, 'cyan');
    } else {
      log(`\n❌ Erro na resposta:`, 'red');
      log(`   Success: ${response.data.success}`, 'red');
      log(`   Message: ${response.data.message}`, 'red');
      log(`   Error: ${response.data.error}`, 'red');
      log(`   Error Code: ${response.data.errorCode}`, 'red');
      
      if (response.status === 401) {
        log(`\n💡 Diagnóstico:`, 'yellow');
        if (response.data.errorCode === 'INVALID_TOKEN' || response.data.message.includes('Token')) {
          log(`   ✅ Erro identificado corretamente como token inválido`, 'green');
        } else {
          log(`   ⚠️  Erro 401 mas mensagem não indica token inválido`, 'yellow');
          log(`   💡 Mensagem atual: "${response.data.message}"`, 'yellow');
          log(`   💡 Deveria ser: "Token da API inválido ou expirado..."`, 'yellow');
        }
      }
    }
    
  } catch (error) {
    log(`\n❌ Erro na requisição:`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data:`, 'red');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      log(`   Erro: ${error.message}`, 'red');
    }
  }
}

testarRequisicaoHTTP();

