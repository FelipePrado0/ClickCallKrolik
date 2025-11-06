const { transcreverAudio } = require('../backend/transcription-service');

const urlMp3 = 'https://delorean.krolik.com.br/records/2025-11-04/519/20251104_093925_5191007_5191010_1762259957.mp3';
const urlWav = 'https://delorean.krolik.com.br/records/20251105_110609_1003029_103_16981892476_1762351556.wav';

const codigoMp3 = '20251103_113826_1003029_103_16981892476_1762180698';
const codigoWav = '20251105_110609_1003029_103_16981892476_1762351556';

const companyCode = '100';
const calldateMp3 = '2025-11-03 11:38:26';
const calldateWav = '2025-11-05 11:06:09';

console.log('🧪 Teste de Transcrição com OpenAI\n');
console.log('='.repeat(80));

const logCallback = (level, message, data = {}) => {
  const prefix = level === 'info' ? '📘' : level === 'warn' ? '⚠️' : '❌';
  console.log(`${prefix} ${message}`);
  
  if (message.includes('Provider') || message.includes('Tokens') || message.includes('Tentando transcrição')) {
    if (Object.keys(data).length > 0) {
      console.log('   ', JSON.stringify(data, null, 2));
    }
  }
  
  if (message.includes('Áudio baixado') || message.includes('Transcrição concluída')) {
    if (data.tamanho || data.tamanhoKB || data.provider || data.modelo || data.duracao) {
      const dadosRelevantes = {};
      if (data.tamanho) dadosRelevantes.tamanho = data.tamanho;
      if (data.tamanhoKB) dadosRelevantes.tamanhoKB = data.tamanhoKB;
      if (data.provider) dadosRelevantes.provider = data.provider;
      if (data.modelo) dadosRelevantes.modelo = data.modelo;
      if (data.duracao) dadosRelevantes.duracao = data.duracao;
      if (data.urlUsada) dadosRelevantes.urlUsada = data.urlUsada;
      console.log('   ', JSON.stringify(dadosRelevantes, null, 2));
    }
  }
};

(async () => {
  try {
    console.log('\n📋 TESTE 1: Transcrevendo MP3 com OpenAI\n');
    console.log('URL MP3:', urlMp3);
    console.log('Código:', codigoMp3);
    console.log('Empresa:', companyCode);
    console.log('Data:', calldateMp3);
    console.log('\n⏳ Iniciando transcrição...\n');
    
    const resultado1 = await transcreverAudio(urlMp3, codigoMp3, companyCode, calldateMp3, logCallback);
    
    console.log('\n✅ Teste 1 concluído!');
    console.log('Provider:', resultado1.provider);
    console.log('Modelo:', resultado1.model);
    console.log('Duração:', resultado1.duration, 'segundos');
    console.log('\n📄 Transcrição completa:');
    console.log('─'.repeat(80));
    console.log(resultado1.transcription);
    console.log('─'.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Teste 1 falhou:');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code || 'N/A');
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 TESTE 2: Transcrevendo WAV com fallback para MP3 (OpenAI)\n');
  console.log('URL WAV:', urlWav);
  console.log('Código:', codigoWav);
  console.log('Empresa:', companyCode);
  console.log('Data:', calldateWav);
  console.log('\n⏳ Iniciando transcrição (deve fazer fallback para MP3)...\n');
  
  try {
    const resultado2 = await transcreverAudio(urlWav, codigoWav, companyCode, calldateWav, logCallback);
    
    console.log('\n✅ Teste 2 concluído!');
    console.log('Provider:', resultado2.provider);
    console.log('Modelo:', resultado2.model);
    console.log('Duração:', resultado2.duration, 'segundos');
    console.log('\n📄 Transcrição completa:');
    console.log('─'.repeat(80));
    console.log(resultado2.transcription);
    console.log('─'.repeat(80));
    
    console.log('\n\n✨ Todos os testes concluídos com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Teste 2 falhou:');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code || 'N/A');
  }
  
  process.exit(0);
})();

