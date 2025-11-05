/**
 * Teste para verificar se o token está sendo usado corretamente
 */

const { buscarTokensEmpresa } = require('../backend/transcription-service');
const { transcreverComGemini } = require('../backend/transcription-gemini');
const { baixarAudio } = require('../backend/transcription-service');

async function verificarToken() {
  console.log('🔍 Verificando token...\n');
  
  const tokensInfo = buscarTokensEmpresa('100');
  const tokenGemini = tokensInfo.tokens.find(t => t.provider === 'gemini');
  
  if (!tokenGemini || !tokenGemini.token) {
    console.log('❌ Token Gemini não encontrado');
    return;
  }
  
  console.log(`✅ Token encontrado: ${tokenGemini.token.substring(0, 20)}...`);
  console.log(`   Token completo: ${tokenGemini.token}`);
  
  const urlExemplo = 'https://delorean.krolik.com.br/records/20251105_101703_1003029_103_16981892476_1762348616.wav';
  console.log(`\n📥 Baixando áudio...`);
  const audioBuffer = await baixarAudio(urlExemplo, 10000);
  console.log(`✅ Áudio baixado: ${(audioBuffer.length / 1024).toFixed(2)} KB\n`);
  
  console.log(`🎙️ Tentando transcrever com o token do company_tokens.json...`);
  try {
    const resultado = await transcreverComGemini(audioBuffer, tokenGemini.token, 'audio/wav', urlExemplo);
    console.log(`✅ Transcrição bem-sucedida!`);
    console.log(`   Modelo: ${resultado.modelo}`);
    console.log(`   Texto: ${resultado.texto.substring(0, 100)}...`);
  } catch (error) {
    console.log(`❌ Erro na transcrição:`);
    console.log(`   Mensagem: ${error.message}`);
    console.log(`   Código: ${error.code || 'N/A'}`);
    console.log(`   Tipo: ${error.constructor.name}`);
    
    if (error.message.includes('Token') || error.code === 'INVALID_TOKEN') {
      console.log(`\n💡 O token no company_tokens.json está inválido ou expirado`);
      console.log(`   Token atual: ${tokenGemini.token.substring(0, 20)}...`);
      console.log(`   💡 Verifique se o token está correto e válido`);
    }
  }
}

verificarToken();

