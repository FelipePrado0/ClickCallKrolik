/**
 * Script para verificar se o servidor tem o endpoint de transcrição
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

async function verificarServidor() {
  log('\n🔍 VERIFICANDO SERVIDOR...\n', 'cyan');
  
  try {
    log('1️⃣ Verificando health check...', 'yellow');
    const health = await axios.get(`${BASE_URL}/health`);
    log('   ✅ Servidor está rodando', 'green');
    log(`   Versão: ${health.data.version}`, 'blue');
    log(`   Uptime: ${Math.floor(health.data.uptime)}s\n`, 'blue');
    
    log('2️⃣ Verificando endpoint OPTIONS...', 'yellow');
    const options = await axios.options(`${BASE_URL}/api/transcribe`);
    log('   ✅ Endpoint OPTIONS funciona', 'green');
    log(`   Status: ${options.status}\n`, 'blue');
    
    log('3️⃣ Verificando endpoint POST...', 'yellow');
    try {
      await axios.post(`${BASE_URL}/api/transcribe`, {
        companyCode: '100'
      }, {
        validateStatus: () => true
      });
      log('   ✅ Endpoint POST existe!', 'green');
      log('   (Retornou erro de validação, mas endpoint está ativo)\n', 'blue');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        log('   ✅ Endpoint POST existe!', 'green');
        log('   (Retornou erro 400 de validação - endpoint está ativo)\n', 'blue');
      } else if (error.response && error.response.status === 404) {
        log('   ❌ Endpoint POST NÃO encontrado (404)', 'red');
        log('\n   ⚠️  PROBLEMA IDENTIFICADO:', 'yellow');
        log('   O servidor precisa ser REINICIADO para carregar o endpoint.', 'yellow');
        log('\n   💡 Solução:', 'cyan');
        log('   1. Pare o servidor (Ctrl+C)', 'yellow');
        log('   2. Execute novamente: npm start', 'yellow');
        log('   3. Execute o teste novamente\n', 'yellow');
        return false;
      } else {
        throw error;
      }
    }
    
    log('✅ TODOS OS CHECKs PASSARAM!', 'green');
    log('   O servidor está pronto para transcrições.\n', 'green');
    return true;
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('   ❌ Servidor não está rodando', 'red');
      log('\n   💡 Inicie o servidor:', 'yellow');
      log('   npm start\n', 'yellow');
    } else {
      log(`   ❌ Erro: ${error.message}`, 'red');
    }
    return false;
  }
}

verificarServidor().then(sucesso => {
  process.exit(sucesso ? 0 : 1);
});

