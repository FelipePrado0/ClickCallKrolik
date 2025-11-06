const { baixarAudio } = require('../backend/transcription-service');

const urlWav = 'https://delorean.krolik.com.br/records/20251105_110609_1003029_103_16981892476_1762351556.wav';

console.log('Testando detecção de erro na função baixarAudio...');
console.log('URL:', urlWav);
console.log('');

baixarAudio(urlWav)
  .then(buffer => {
    console.log('❌ ERRO: A função não detectou o erro!');
    console.log('Tamanho:', buffer.length);
    console.log('Conteudo:', buffer.toString('utf8'));
  })
  .catch(error => {
    console.log('✅ SUCESSO: Erro detectado corretamente!');
    console.log('Mensagem:', error.message);
  });

