const { baixarAudio } = require('../backend/transcription-service');

const urlWavErro = 'https://delorean.krolik.com.br/records/20251105_110609_1003029_103_16981892476_1762351556.wav';
const urlMp3Ok = 'https://delorean.krolik.com.br/records/2025-11-03/100/20251103_113826_1003029_103_16981892476_1762180698.mp3';

console.log('🧪 Teste simples de baixarAudio\n');
console.log('─'.repeat(80));

async function testar() {
  console.log('1️⃣ Testando URL WAV (deve falhar com erro detectado)...\n');
  try {
    const buffer = await baixarAudio(urlWavErro);
    console.log('❌ ERRO: A função aceitou o WAV inválido!');
    console.log('Tamanho do buffer:', buffer.length);
  } catch (error) {
    console.log('✅ SUCESSO: Erro detectado corretamente!');
    console.log('Mensagem:', error.message);
  }
  
  console.log('\n' + '─'.repeat(80) + '\n');
  
  console.log('2️⃣ Testando URL MP3 (deve funcionar)...\n');
  try {
    const buffer = await baixarAudio(urlMp3Ok);
    console.log('✅ SUCESSO: MP3 baixado corretamente!');
    console.log('Tamanho do buffer:', buffer.length, 'bytes');
    console.log('Tamanho:', (buffer.length / 1024).toFixed(2), 'KB');
  } catch (error) {
    console.log('❌ ERRO: Falha ao baixar MP3 válido!');
    console.log('Mensagem:', error.message);
  }
}

testar().catch(console.error);

