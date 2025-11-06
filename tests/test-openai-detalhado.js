const { transcreverAudio } = require('../backend/transcription-service');

const urlMp3 = 'https://delorean.krolik.com.br/records/2025-11-03/100/20251103_113826_1003029_103_16981892476_1762180698.mp3';
const codigoMp3 = '20251103_113826_1003029_103_16981892476_1762180698';
const companyCode = '100';
const calldateMp3 = '2025-11-03 11:38:26';

console.log('🧪 Teste Detalhado de Transcrição com OpenAI\n');
console.log('='.repeat(80));

const logCallback = (level, message, data = {}) => {
  const prefix = level === 'info' ? '📘' : level === 'warn' ? '⚠️' : '❌';
  console.log(`${prefix} ${message}`);
  
  if (level === 'warn' && message.includes('Falha')) {
    console.log('   Dados completos do erro:', JSON.stringify(data, null, 2));
  }
  
  if (message.includes('Tokens encontrados')) {
    console.log('   ', JSON.stringify(data, null, 2));
  }
  
  if (message.includes('Tentando transcrição')) {
    console.log('   ', JSON.stringify(data, null, 2));
  }
};

(async () => {
  try {
    console.log('\n📋 Transcrevendo MP3 com OpenAI\n');
    console.log('URL MP3:', urlMp3);
    console.log('Código:', codigoMp3);
    console.log('Empresa:', companyCode);
    console.log('Data:', calldateMp3);
    console.log('\n⏳ Iniciando transcrição...\n');
    
    const resultado = await transcreverAudio(urlMp3, codigoMp3, companyCode, calldateMp3, logCallback);
    
    console.log('\n✅ Transcrição concluída!');
    console.log('Provider:', resultado.provider);
    console.log('Modelo:', resultado.model);
    console.log('Duração:', resultado.duration, 'segundos');
    console.log('\n📄 Transcrição completa:');
    console.log('─'.repeat(80));
    console.log(resultado.transcription);
    console.log('─'.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Erro na transcrição:');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code || 'N/A');
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
})();

