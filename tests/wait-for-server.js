/**
 * Script que aguarda o servidor reiniciar e então testa o endpoint
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

async function verificarEndpoint() {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/transcribe`,
      { companyCode: '100' },
      { validateStatus: () => true, timeout: 5000 }
    );
    
    // Se retornar 400 (erro de validação), significa que o endpoint existe
    return response.status === 400;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return false;
    }
    return false;
  }
}

async function aguardarServidor() {
  log('\n⏳ Aguardando servidor reiniciar...\n', 'cyan');
  log('⚠️  IMPORTANTE: Reinicie o servidor agora!', 'yellow');
  log('   1. Pare o servidor (Ctrl+C)', 'yellow');
  log('   2. Execute: npm start', 'yellow');
  log('   3. Aguarde este script detectar o reinício...\n', 'yellow');
  
  let tentativas = 0;
  const maxTentativas = 60;
  
  while (tentativas < maxTentativas) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const health = await axios.get(`${BASE_URL}/health`, { timeout: 2000 });
      const uptime = health.data.uptime;
      
      // Se o uptime for menor que 10 segundos, provavelmente reiniciou
      if (uptime < 10) {
        log(`\n✅ Servidor reiniciado detectado! (uptime: ${uptime.toFixed(1)}s)`, 'green');
        
        // Aguardar mais um pouco para garantir que tudo carregou
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verificar se o endpoint está funcionando
        if (await verificarEndpoint()) {
          log('✅ Endpoint /api/transcribe está funcionando!\n', 'green');
          return true;
        } else {
          log('⚠️  Servidor reiniciado mas endpoint ainda não está disponível', 'yellow');
          log('   Verificando novamente em 3 segundos...\n', 'yellow');
        }
      }
    } catch (error) {
      // Servidor não está respondendo
    }
    
    tentativas++;
    if (tentativas % 10 === 0) {
      process.stdout.write('.');
    }
  }
  
  log('\n❌ Timeout aguardando servidor reiniciar', 'red');
  return false;
}

aguardarServidor().then(() => {
  log('\n✅ Pronto para testar! Execute:', 'green');
  log('   node tests/test-transcribe-simple.js\n', 'cyan');
});

