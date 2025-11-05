/**
 * Teste Simples de Transcrição de Áudio
 * 
 * Este script testa a transcrição de áudio de forma prática e direta.
 * 
 * Para executar:
 * 1. Certifique-se de que o servidor está rodando: npm start
 * 2. node tests/test-transcribe-simple.js
 * 
 * IMPORTANTE: Você precisa ter um código de gravação válido e tokens configurados
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

async function testarTranscricao() {
  log('\n🎙️  TESTE SIMPLES DE TRANSCRIÇÃO DE ÁUDIO\n', 'cyan');
  
  // Configurações - ALTERE AQUI COM SEUS DADOS REAIS
  const codigoGravacao = process.argv[2] || '20251103_113826_1003029_103_16981892476_1762180698';
  const companyCode = process.argv[3] || '100';
  const calldate = process.argv[4] || new Date().toISOString().split('T')[0] + ' 12:00:00';
  
  log(`📋 Configurações:`, 'blue');
  log(`   Código: ${codigoGravacao}`, 'blue');
  log(`   Empresa: ${companyCode}`, 'blue');
  log(`   Data: ${calldate}`, 'blue');
  log(`   Para usar outros valores: node tests/test-transcribe-simple.js <codigo> <empresa> <calldate>\n`, 'yellow');
  
  try {
    log('🔍 Verificando se o servidor está rodando...', 'yellow');
    
    const healthCheck = await axios.get(`${BASE_URL}/health`, { timeout: 5000 }).catch(() => null);
    
    if (!healthCheck) {
      log('❌ Servidor não está respondendo!', 'red');
      log('   Certifique-se de que o servidor está rodando:', 'yellow');
      log('   npm start', 'yellow');
      process.exit(1);
    }
    
    log('✅ Servidor está rodando!\n', 'green');
    
    log('📤 Enviando requisição de transcrição...', 'yellow');
    log(`   URL: ${BASE_URL}/api/transcribe`, 'blue');
    log(`   Método: POST`, 'blue');
    
    const startTime = Date.now();
    
    const response = await axios.post(
      `${BASE_URL}/api/transcribe`,
      {
        codigo: codigoGravacao,
        companyCode: companyCode,
        calldate: calldate
      },
      {
        timeout: 120000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (response.data.success) {
      log('\n✅ TRANSCRIÇÃO CONCLUÍDA COM SUCESSO!\n', 'green');
      
      log('📊 Resultados:', 'cyan');
      log(`   Provider: ${response.data.provider}`, 'blue');
      log(`   Modelo: ${response.data.model}`, 'blue');
      log(`   Idioma: ${response.data.language}`, 'blue');
      log(`   Tempo de processamento: ${response.data.duration}s`, 'blue');
      log(`   Tempo total (incluindo download): ${duration}s`, 'blue');
      log(`   Request ID: ${response.data.requestId}`, 'blue');
      
      log('\n📝 Transcrição:', 'cyan');
      log('─'.repeat(60), 'blue');
      log(response.data.transcription, 'reset');
      log('─'.repeat(60), 'blue');
      
      log(`\n📏 Tamanho da transcrição: ${response.data.transcription.length} caracteres`, 'green');
      
      return true;
    } else {
      log('\n❌ TRANSCRIÇÃO FALHOU', 'red');
      log(`   Mensagem: ${response.data.message || 'Erro desconhecido'}`, 'red');
      return false;
    }
    
  } catch (error) {
    log('\n❌ ERRO AO TESTAR TRANSCRIÇÃO', 'red');
    
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Mensagem: ${error.response.data?.message || error.message}`, 'red');
      
      if (error.response.data?.error) {
        log(`   Detalhes: ${error.response.data.error}`, 'yellow');
      }
      
      if (error.response.status === 400) {
        log('\n💡 Dicas:', 'yellow');
        log('   - Verifique se o código da gravação está correto', 'yellow');
        log('   - Verifique se a data (calldate) está no formato correto', 'yellow');
        log('   - Verifique se o companyCode existe', 'yellow');
      } else if (error.response.status === 401) {
        log('\n💡 Dicas:', 'yellow');
        log('   - Verifique se os tokens estão configurados corretamente', 'yellow');
        log('   - Verifique o arquivo Data/company_tokens.json', 'yellow');
      } else if (error.response.status === 500) {
        log('\n💡 Dicas:', 'yellow');
        log('   - Verifique os logs do servidor para mais detalhes', 'yellow');
        log('   - Pode ser que o áudio não exista no servidor', 'yellow');
        log('   - Pode ser que o token da API esteja inválido', 'yellow');
      }
    } else if (error.code === 'ECONNREFUSED') {
      log('   Erro: Não foi possível conectar ao servidor', 'red');
      log('\n💡 Certifique-se de que o servidor está rodando:', 'yellow');
      log('   npm start', 'yellow');
    } else if (error.code === 'ETIMEDOUT') {
      log('   Erro: Timeout ao aguardar resposta', 'red');
      log('   O áudio pode ser muito grande ou a API está demorando', 'yellow');
    } else {
      log(`   Erro: ${error.message}`, 'red');
    }
    
    return false;
  }
}

async function main() {
  const sucesso = await testarTranscricao();
  
  log('\n' + '='.repeat(60), 'cyan');
  if (sucesso) {
    log('✅ TESTE CONCLUÍDO COM SUCESSO', 'green');
    process.exit(0);
  } else {
    log('❌ TESTE FALHOU', 'red');
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n💥 Erro fatal: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

