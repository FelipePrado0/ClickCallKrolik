/**
 * Teste de tratamento de erros na transcrição
 * Simula erros comuns e verifica se estão sendo tratados corretamente
 */

const { transcreverComGemini } = require('../backend/transcription-gemini');
const { buscarTokensEmpresa } = require('../backend/transcription-service');

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

async function testarErroToken() {
  log('\n🧪 Testando tratamento de erro de token inválido...', 'blue');
  
  try {
    const bufferTeste = Buffer.from('teste');
    const tokenInvalido = 'token-invalido-12345';
    
    await transcreverComGemini(bufferTeste, tokenInvalido, 'audio/wav', 'https://example.com/test.wav');
    log('❌ Deveria ter lançado erro', 'red');
  } catch (error) {
    log(`✅ Erro capturado: ${error.message}`, 'green');
    log(`   Código: ${error.code || 'N/A'}`, 'cyan');
    
    if (error.message.includes('Token') || error.message.includes('401') || error.code === 'INVALID_TOKEN') {
      log('   ✅ Erro de token tratado corretamente', 'green');
    } else if (error.message.includes('Formato') || error.code === 'FORMAT_NOT_SUPPORTED') {
      log('   ⚠️  Erro sendo tratado como formato (pode ser incorreto)', 'yellow');
      log('   💡 Verifique se o erro não é de token', 'yellow');
    } else {
      log('   ⚠️  Tipo de erro não identificado corretamente', 'yellow');
    }
  }
}

async function testarTokenValido() {
  log('\n🧪 Testando com token válido...', 'blue');
  
  try {
    const tokensInfo = buscarTokensEmpresa('100');
    if (tokensInfo.tokens.length === 0) {
      log('   ⚠️  Nenhum token disponível', 'yellow');
      return;
    }
    
    const tokenGemini = tokensInfo.tokens.find(t => t.provider === 'gemini');
    if (!tokenGemini || !tokenGemini.token) {
      log('   ⚠️  Token Gemini não encontrado ou vazio', 'yellow');
      return;
    }
    
    log(`   ✅ Token encontrado: ${tokenGemini.token.substring(0, 15)}...`, 'green');
    
    const { baixarAudio } = require('../backend/transcription-service');
    const urlExemplo = 'https://delorean.krolik.com.br/records/20251105_101703_1003029_103_16981892476_1762348616.wav';
    const audioBuffer = await baixarAudio(urlExemplo, 10000);
    
    log(`   ✅ Áudio baixado: ${(audioBuffer.length / 1024).toFixed(2)} KB`, 'green');
    
    const resultado = await transcreverComGemini(audioBuffer, tokenGemini.token, 'audio/wav', urlExemplo);
    
    log(`   ✅ Transcrição bem-sucedida!`, 'green');
    log(`   📝 Modelo usado: ${resultado.modelo}`, 'cyan');
    log(`   📝 Texto: ${resultado.texto.substring(0, 50)}...`, 'cyan');
    
  } catch (error) {
    log(`   ❌ Erro: ${error.message}`, 'red');
    log(`   Código: ${error.code || 'N/A'}`, 'red');
    
    if (error.code === 'INVALID_TOKEN' || error.message.includes('Token')) {
      log('   💡 O token pode estar inválido ou expirado', 'yellow');
      log('   💡 Verifique o token no company_tokens.json', 'yellow');
    }
    throw error;
  }
}

async function executarTestes() {
  log('🚀 Iniciando testes de tratamento de erros\n', 'yellow');
  
  await testarTokenValido();
  await testarErroToken();
  
  log('\n📊 Resumo:', 'yellow');
  log('   ✅ Testes de erro concluídos', 'green');
}

executarTestes().catch(error => {
  log(`\n💥 Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});

