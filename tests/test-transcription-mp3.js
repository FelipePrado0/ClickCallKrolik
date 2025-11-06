const { transcreverAudio } = require('../backend/transcription-service');

const audioUrl = 'https://delorean.krolik.com.br/records/2025-11-04/519/20251104_093925_5191007_5191010_1762259957.mp3';
const codigo = '20251104_093925_5191007_5191010_1762259957';
const companyCode = '100';
const calldate = '2025-11-04 09:39:25';

console.log('Testando transcricao de MP3...');
console.log('Parametros:');
console.log('  - URL:', audioUrl);
console.log('  - Codigo:', codigo);
console.log('  - Empresa:', companyCode);
console.log('  - Data:', calldate);
console.log('\nIniciando transcricao...\n');

const logCallback = (level, message, data = {}) => {
  const prefix = level === 'info' ? '[INFO]' : level === 'warn' ? '[WARN]' : '[ERROR]';
  console.log(`${prefix} ${message}`);
  if (Object.keys(data).length > 0) {
    console.log('   Dados:', JSON.stringify(data, null, 2));
  }
};

(async () => {
  try {
    const resultado = await transcreverAudio(audioUrl, codigo, companyCode, calldate, logCallback);
    
    console.log('\nTranscricao concluida com sucesso!\n');
    console.log('Resultado:');
    console.log('  - Provider:', resultado.provider);
    console.log('  - Modelo:', resultado.model);
    console.log('  - Duracao:', resultado.duration, 'segundos');
    console.log('  - Idioma:', resultado.language);
    console.log('\nTranscricao:');
    console.log('='.repeat(60));
    console.log(resultado.transcription);
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('\nErro na transcricao:');
    console.error('  - Mensagem:', error.message);
    console.error('  - Codigo:', error.code || 'N/A');
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
})();

