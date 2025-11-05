/**
 * Teste de transcrição usando URL específica
 * Baixa o áudio e transcreve usando Base64
 */

const { transcreverComGemini } = require('../backend/transcription-gemini');
const { buscarTokensEmpresa, baixarAudio } = require('../backend/transcription-service');

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

async function testarTranscricaoURL() {
  log('\n' + '='.repeat(70), 'cyan');
  log('🧪 Teste de Transcrição com URL Específica', 'yellow');
  log('='.repeat(70), 'cyan');
  
  const audioUrl = 'https://delorean.krolik.com.br/records/20251105_113926_1003029_103_16981892476_1762353553.wav';
  const companyCode = '100';
  
  log(`\n📋 Informações do teste:`, 'cyan');
  log(`   URL: ${audioUrl}`, 'cyan');
  log(`   Company Code: ${companyCode}`, 'cyan');
  
  try {
    log(`\n🔍 Buscando tokens da empresa...`, 'blue');
    const tokensInfo = buscarTokensEmpresa(companyCode);
    
    if (tokensInfo.tokens.length === 0) {
      log(`\n❌ Nenhum token disponível para empresa ${companyCode}`, 'red');
      return;
    }
    
    const tokenGemini = tokensInfo.tokens.find(t => t.provider === 'gemini');
    if (!tokenGemini || !tokenGemini.token) {
      log(`\n❌ Token Gemini não encontrado`, 'red');
      return;
    }
    
    log(`   ✅ Empresa encontrada: ${tokensInfo.empresa}`, 'green');
    log(`   ✅ Token Gemini encontrado: ${tokenGemini.token.substring(0, 15)}...`, 'green');
    
    log(`\n📥 Baixando áudio da URL...`, 'blue');
    const startDownload = Date.now();
    const audioBuffer = await baixarAudio(audioUrl, 30000);
    const downloadTime = ((Date.now() - startDownload) / 1000).toFixed(2);
    
    const audioSizeKB = (audioBuffer.length / 1024).toFixed(2);
    const audioSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
    const base64SizeKB = ((audioBuffer.length * 1.33) / 1024).toFixed(2);
    
    log(`   ✅ Áudio baixado em ${downloadTime}s`, 'green');
    log(`   📊 Tamanho original: ${audioSizeKB} KB (${audioSizeMB} MB)`, 'cyan');
    log(`   📊 Tamanho Base64 estimado: ~${base64SizeKB} KB`, 'cyan');
    
    if (audioBuffer.length > 20 * 1024 * 1024) {
      log(`   ⚠️  AVISO: Áudio muito grande, pode causar problemas`, 'yellow');
    }
    
    log(`\n🎙️ Transcrevendo com Gemini...`, 'blue');
    log(`   URL: ${audioUrl}`, 'cyan');
    log(`   MIME Type: audio/wav`, 'cyan');
    
    const startTranscribe = Date.now();
    
    const resultado = await transcreverComGemini(
      audioBuffer,
      tokenGemini.token,
      'audio/wav',
      audioUrl
    );
    
    const transcribeTime = ((Date.now() - startTranscribe) / 1000).toFixed(2);
    const totalTime = ((Date.now() - startDownload) / 1000).toFixed(2);
    
    log(`\n✅ Transcrição concluída!`, 'green');
    log(`${'='.repeat(70)}`, 'cyan');
    log(`\n📝 Resultado:`, 'magenta');
    log(`   Modelo usado: ${resultado.modelo}`, 'cyan');
    log(`   Tempo de download: ${downloadTime}s`, 'cyan');
    log(`   Tempo de transcrição: ${transcribeTime}s`, 'cyan');
    log(`   Tempo total: ${totalTime}s`, 'cyan');
    log(`   Tamanho da transcrição: ${resultado.texto.length} caracteres`, 'cyan');
    log(`   Tamanho do áudio: ${audioSizeKB} KB`, 'cyan');
    
    log(`\n📄 Transcrição:`, 'magenta');
    log(`${'─'.repeat(70)}`, 'cyan');
    log(resultado.texto, 'reset');
    log(`${'─'.repeat(70)}`, 'cyan');
    
    log(`\n✅ Teste concluído com sucesso!`, 'green');
    
  } catch (error) {
    log(`\n❌ Erro no teste:`, 'red');
    log(`${'='.repeat(70)}`, 'red');
    log(`   Mensagem: ${error.message}`, 'red');
    log(`   Código: ${error.code || 'N/A'}`, 'red');
    
    if (error.stack) {
      log(`\n   Stack trace:`, 'yellow');
      const stackLines = error.stack.split('\n').slice(0, 5);
      stackLines.forEach(line => log(`   ${line}`, 'yellow'));
    }
    
    if (error.message.includes('Token') || error.code === 'INVALID_TOKEN') {
      log(`\n💡 Diagnóstico:`, 'yellow');
      log(`   - Verifique o token no company_tokens.json`, 'yellow');
      log(`   - Token pode estar inválido ou expirado`, 'yellow');
    } else if (error.message.includes('não foi possível baixar') || error.message.includes('404')) {
      log(`\n💡 Diagnóstico:`, 'yellow');
      log(`   - URL pode não estar acessível`, 'yellow');
      log(`   - Arquivo pode não existir no servidor`, 'yellow');
    } else if (error.message.includes('muito grande') || error.message.includes('size')) {
      log(`\n💡 Diagnóstico:`, 'yellow');
      log(`   - Áudio muito grande para processar`, 'yellow');
      log(`   - Considere usar um áudio menor ou comprimir`, 'yellow');
    }
    
    log(`${'='.repeat(70)}`, 'red');
    process.exit(1);
  }
}

testarTranscricaoURL();
