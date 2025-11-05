/**
 * Teste de debug para capturar o erro real do Gemini
 */

const { transcreverComGemini } = require('../backend/transcription-gemini');
const { baixarAudio } = require('../backend/transcription-service');
const { buscarTokensEmpresa } = require('../backend/transcription-service');

async function debugError() {
  console.log('🔍 Debugando erro de transcrição...\n');
  
  try {
    const tokensInfo = buscarTokensEmpresa('100');
    const tokenGemini = tokensInfo.tokens.find(t => t.provider === 'gemini');
    
    if (!tokenGemini || !tokenGemini.token) {
      console.log('❌ Token Gemini não encontrado');
      return;
    }
    
    console.log(`✅ Token encontrado: ${tokenGemini.token.substring(0, 15)}...`);
    
    const urlExemplo = 'https://delorean.krolik.com.br/records/20251105_101703_1003029_103_16981892476_1762348616.wav';
    console.log(`📥 Baixando áudio...`);
    const audioBuffer = await baixarAudio(urlExemplo, 10000);
    console.log(`✅ Áudio baixado: ${(audioBuffer.length / 1024).toFixed(2)} KB\n`);
    
    console.log(`🎙️ Tentando transcrever com Gemini...`);
    const resultado = await transcreverComGemini(audioBuffer, tokenGemini.token, 'audio/wav', urlExemplo);
    console.log(`✅ Transcrição bem-sucedida!`);
    console.log(`   Modelo: ${resultado.modelo}`);
    console.log(`   Texto: ${resultado.texto.substring(0, 100)}...`);
    
  } catch (error) {
    console.log('\n❌ ERRO CAPTURADO:');
    console.log('='.repeat(60));
    console.log('Mensagem:', error.message);
    console.log('Código:', error.code || 'N/A');
    console.log('Tipo:', error.constructor.name);
    console.log('\nStack completo:');
    console.log(error.stack);
    console.log('\nErro completo (JSON):');
    try {
      console.log(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
      console.log('Não foi possível serializar o erro');
    }
    console.log('='.repeat(60));
  }
}

debugError();

