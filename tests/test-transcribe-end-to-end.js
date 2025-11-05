/**
 * Teste End-to-End completo do fluxo de transcrição
 * Simula o fluxo real: n8n → Frontend → Backend → API → Frontend
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:4201';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testarFluxoCompleto() {
  log('\n' + '='.repeat(70), 'cyan');
  log('🚀 Teste End-to-End: Fluxo completo de transcrição', 'yellow');
  log('='.repeat(70), 'cyan');
  
  const codigo = '20251105_101703_1003029_103_16981892476_1762348616';
  const companyCode = '100';
  const hoje = new Date();
  const calldate = hoje.toISOString().split('T')[0] + ' ' + hoje.toTimeString().split(' ')[0];
  
  log(`\n📋 Dados de teste:`, 'cyan');
  log(`   Código: ${codigo}`, 'cyan');
  log(`   Company Code: ${companyCode}`, 'cyan');
  log(`   Calldate: ${calldate}`, 'cyan');
  
  try {
    log(`\n📡 ETAPA 1: Fazendo requisição POST para /api/transcribe`, 'blue');
    const startTime = Date.now();
    
    const response = await axios.post(`${BASE_URL}/api/transcribe`, {
      codigo: codigo,
      companyCode: companyCode,
      calldate: calldate
    }, {
      timeout: 60000
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log(`\n✅ ETAPA 2: Resposta recebida (${duration}s)`, 'green');
    log(`   Status: ${response.status}`, 'cyan');
    log(`   Success: ${response.data.success}`, 'cyan');
    
    if (response.data.success) {
      log(`\n📝 ETAPA 3: Dados da transcrição:`, 'green');
      log(`   Provider: ${response.data.provider}`, 'cyan');
      log(`   Modelo: ${response.data.model}`, 'cyan');
      log(`   Duração: ${response.data.duration}s`, 'cyan');
      log(`   Idioma: ${response.data.language}`, 'cyan');
      log(`   Request ID: ${response.data.requestId}`, 'cyan');
      log(`   Tamanho da transcrição: ${response.data.transcription.length} caracteres`, 'cyan');
      log(`\n📄 Transcrição:`, 'magenta');
      log(`   "${response.data.transcription.substring(0, 200)}${response.data.transcription.length > 200 ? '...' : ''}"`, 'cyan');
      
      log(`\n✅ Fluxo completo bem-sucedido!`, 'green');
      return true;
    } else {
      log(`\n❌ Resposta não foi bem-sucedida`, 'red');
      log(`   Mensagem: ${response.data.message}`, 'red');
      return false;
    }
    
  } catch (error) {
    log(`\n❌ Erro no fluxo:`, 'red');
    
    if (error.response) {
      log(`   Status HTTP: ${error.response.status}`, 'red');
      log(`   Dados: ${JSON.stringify(error.response.data, null, 2)}`, 'yellow');
      
      if (error.response.status === 401) {
        log(`\n💡 Diagnóstico: Erro 401 (Unauthorized)`, 'yellow');
        log(`   - Token da API pode estar inválido ou expirado`, 'yellow');
        log(`   - Verifique o token no company_tokens.json`, 'yellow');
        log(`   - Verifique se o token tem permissões para usar a API Gemini`, 'yellow');
      } else if (error.response.status === 400) {
        log(`\n💡 Diagnóstico: Erro 400 (Bad Request)`, 'yellow');
        log(`   - Parâmetros inválidos ou faltando`, 'yellow');
        log(`   - Verifique se companyCode e codigo/audioUrl estão sendo enviados`, 'yellow');
      } else if (error.response.status === 500) {
        log(`\n💡 Diagnóstico: Erro 500 (Internal Server Error)`, 'yellow');
        log(`   - Erro no servidor`, 'yellow');
        log(`   - Verifique os logs do servidor`, 'yellow');
        if (error.response.data && error.response.data.error) {
          log(`   - Erro detalhado: ${error.response.data.error}`, 'yellow');
        }
      }
    } else if (error.code === 'ECONNREFUSED') {
      log(`\n💡 Diagnóstico: Servidor não está rodando`, 'yellow');
      log(`   - Execute: npm start`, 'yellow');
      log(`   - Verifique se o servidor está na porta 4201`, 'yellow');
    } else {
      log(`   Erro: ${error.message}`, 'red');
    }
    
    return false;
  }
}

async function verificarServidor() {
  log(`\n🔍 Verificando se o servidor está rodando...`, 'blue');
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    log(`   ✅ Servidor está rodando`, 'green');
    log(`   Status: ${response.data.status}`, 'cyan');
    return true;
  } catch (error) {
    log(`   ❌ Servidor não está rodando`, 'red');
    log(`   💡 Execute: npm start`, 'yellow');
    return false;
  }
}

async function executarTestes() {
  const servidorOk = await verificarServidor();
  
  if (!servidorOk) {
    log(`\n⚠️  Teste end-to-end pulado (servidor não está rodando)`, 'yellow');
    return;
  }
  
  const sucesso = await testarFluxoCompleto();
  
  log(`\n${'='.repeat(70)}`, 'cyan');
  if (sucesso) {
    log('🎉 Teste End-to-End: PASSOU!', 'green');
  } else {
    log('❌ Teste End-to-End: FALHOU!', 'red');
    log('   Verifique os detalhes acima', 'yellow');
  }
  log('='.repeat(70), 'cyan');
}

executarTestes().catch(error => {
  log(`\n💥 Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});

