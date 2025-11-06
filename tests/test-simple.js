const { transcreverAudio } = require('../backend/transcription-service');

console.log('Teste simples iniciado');
console.log('Node version:', process.version);

const audioUrl = 'https://delorean.krolik.com.br/records/2025-11-03/100/20251103_113826_1003029_103_16981892476_1762180698.mp3';
const codigo = '20251103_113826_1003029_103_16981892476_1762180698';
const companyCode = '100';
const calldate = '2025-11-03 11:38:26';

console.log('Parametros configurados');
console.log('URL:', audioUrl);
console.log('Codigo:', codigo);
console.log('CompanyCode:', companyCode);
console.log('Calldate:', calldate);

console.log('\nIniciando transcricao...');

const logCallback = (level, message, data = {}) => {
  console.log(`[${level.toUpperCase()}] ${message}`);
  if (Object.keys(data).length > 0) {
    console.log('Dados:', JSON.stringify(data));
  }
};

(async () => {
  try {
    console.log('Chamando transcreverAudio...');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: transcricao demorou mais de 5 minutos')), 300000);
    });
    
    const resultado = await Promise.race([
      transcreverAudio(audioUrl, codigo, companyCode, calldate, logCallback),
      timeoutPromise
    ]);
    
    console.log('\n=== SUCESSO ===');
    console.log('Provider:', resultado.provider);
    console.log('Modelo:', resultado.model);
    console.log('Duracao:', resultado.duration, 'segundos');
    console.log('\n=== TRANSCRICAO ===');
    console.log(resultado.transcription);
    console.log('==================');
    
  } catch (error) {
    console.error('\n=== ERRO ===');
    console.error('Mensagem:', error.message);
    console.error('Codigo:', error.code || 'N/A');
    if (error.stack) {
      console.error('\nStack:', error.stack.substring(0, 500));
    }
  }
  
  console.log('\nTeste finalizado');
  setTimeout(() => process.exit(0), 1000);
})();

