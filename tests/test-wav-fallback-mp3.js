const { transcreverAudio } = require('../backend/transcription-service');

const urlWav = 'https://delorean.krolik.com.br/records/20251105_110609_1003029_103_16981892476_1762351556.wav';
const urlMp3 = 'https://delorean.krolik.com.br/records/2025-11-03/100/20251103_113826_1003029_103_16981892476_1762180698.mp3';

const codigoWav = '20251105_110609_1003029_103_16981892476_1762351556';
const codigoMp3 = '20251103_113826_1003029_103_16981892476_1762180698';

const companyCode = '100';
const calldateWav = '2025-11-05 11:06:09';
const calldateMp3 = '2025-11-03 11:38:26';

console.log('🧪 Teste de Fallback WAV → MP3\n');
console.log('='.repeat(60));
console.log('TESTE 1: URL WAV que não funciona (deve tentar MP3 automaticamente)');
console.log('='.repeat(60));
console.log('URL WAV:', urlWav);
console.log('Código:', codigoWav);
console.log('Empresa:', companyCode);
console.log('Data:', calldateWav);
console.log('\n⏳ Iniciando transcrição com URL WAV...\n');

const logCallback = (level, message, data = {}) => {
  const prefix = level === 'info' ? '[INFO]' : level === 'warn' ? '[WARN]' : '[ERROR]';
  console.log(`${prefix} ${message}`);
  
  if (message.includes('Verificando') || message.includes('WAV') || message.includes('MP3') || message.includes('fallback') || message.includes('Tentando baixar')) {
    console.log('   Dados completos:', JSON.stringify(data, null, 2));
  } else if (Object.keys(data).length > 0 && (data.url || data.tamanho || data.error || data.tamanhoKB)) {
    const dadosRelevantes = {};
    if (data.url) dadosRelevantes.url = data.url;
    if (data.tamanho) dadosRelevantes.tamanho = data.tamanho;
    if (data.tamanhoKB) dadosRelevantes.tamanhoKB = data.tamanhoKB;
    if (data.error) dadosRelevantes.error = data.error;
    if (data.formato) dadosRelevantes.formato = data.formato;
    if (data.urlUsada) dadosRelevantes.urlUsada = data.urlUsada;
    if (Object.keys(dadosRelevantes).length > 0) {
      console.log('   Dados:', JSON.stringify(dadosRelevantes, null, 2));
    }
  }
};

(async () => {
  try {
    console.log('📋 Teste 1: Transcrevendo com URL WAV (deve fazer fallback para MP3)\n');
    
    const resultado1 = await transcreverAudio(urlWav, codigoWav, companyCode, calldateWav, logCallback);
    
    console.log('\n✅ Teste 1 concluído!');
    console.log('Provider:', resultado1.provider);
    console.log('Modelo:', resultado1.modelo);
    console.log('Duração:', resultado1.duration, 'segundos');
    console.log('\n📄 Transcrição (primeiros 200 caracteres):');
    console.log(resultado1.transcription.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('\n❌ Teste 1 falhou:');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code || 'N/A');
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('TESTE 2: URL MP3 diretamente (deve funcionar sem fallback)');
  console.log('='.repeat(60));
  console.log('URL MP3:', urlMp3);
  console.log('Código:', codigoMp3);
  console.log('Empresa:', companyCode);
  console.log('Data:', calldateMp3);
  console.log('\n⏳ Iniciando transcrição com URL MP3...\n');
  
  try {
    console.log('📋 Teste 2: Transcrevendo com URL MP3 diretamente\n');
    
    const resultado2 = await transcreverAudio(urlMp3, codigoMp3, companyCode, calldateMp3, logCallback);
    
    console.log('\n✅ Teste 2 concluído!');
    console.log('Provider:', resultado2.provider);
    console.log('Modelo:', resultado2.modelo);
    console.log('Duração:', resultado2.duration, 'segundos');
    console.log('\n📄 Transcrição (primeiros 200 caracteres):');
    console.log(resultado2.transcription.substring(0, 200) + '...');
    
    console.log('\n\n✨ Todos os testes concluídos com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Teste 2 falhou:');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code || 'N/A');
  }
  
  process.exit(0);
})();

