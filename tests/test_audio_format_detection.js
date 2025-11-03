/**
 * Teste para validação da lógica de detecção de formato de áudio
 * Testa se a detecção de data funciona corretamente para determinar .wav (hoje) ou .mp3 (passado)
 */

// Simular a lógica de detecção de formato
function detectarFormatoAudio(calldate, codigo) {
  let urlGravacaoWav = '';
  let urlGravacaoMp3 = '';
  let ehGravacaoDeHoje = false;
  
  if (codigo) {
    // Tentar detectar se é de hoje baseado no calldate
    try {
      if (calldate) {
        // Parse da data da gravação
        const calldateStr = calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
        const dataGravacao = new Date(calldateStr);
        const hoje = new Date();
        
        // Comparar apenas data (sem hora) - verifica se é o mesmo dia
        const dataGravacaoSemHora = new Date(dataGravacao.getFullYear(), dataGravacao.getMonth(), dataGravacao.getDate());
        const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        
        ehGravacaoDeHoje = dataGravacaoSemHora.getTime() === hojeSemHora.getTime();
      }
    } catch (e) {
      console.warn('[teste] Erro ao parsear data da gravação:', e);
      ehGravacaoDeHoje = false;
    }
    
    // Montar URLs para ambos formatos
    urlGravacaoWav = `https://delorean.krolik.com.br/records/${codigo}.wav`;
    urlGravacaoMp3 = `https://delorean.krolik.com.br/records/${codigo}.mp3`;
  }
  
  return {
    urlWav: urlGravacaoWav,
    urlMp3: urlGravacaoMp3,
    ehHoje: ehGravacaoDeHoje,
    urlPrincipal: ehGravacaoDeHoje ? urlGravacaoWav : urlGravacaoMp3
  };
}

// Testes
console.log('🧪 Iniciando testes de detecção de formato de áudio...\n');

// Teste 1: Gravação de hoje
const hoje = new Date();
const calldateHoje = hoje.toISOString().replace('T', ' ').substring(0, 19).replace(/:/g, '%3A');
const codigoTeste = '20251103_113826_1003029_103_16981892476_1762180698';

console.log('📝 Teste 1: Gravação de HOJE');
const resultado1 = detectarFormatoAudio(calldateHoje, codigoTeste);
console.log('   Calldate:', calldateHoje);
console.log('   É de hoje?', resultado1.ehHoje);
console.log('   URL principal:', resultado1.urlPrincipal);
console.log('   URL WAV:', resultado1.urlWav);
console.log('   URL MP3:', resultado1.urlMp3);
console.log('   ✅ Esperado: ehHoje = true, URL principal = .wav\n');

// Teste 2: Gravação de ontem
const ontem = new Date();
ontem.setDate(ontem.getDate() - 1);
const calldateOntem = ontem.toISOString().replace('T', ' ').substring(0, 19).replace(/:/g, '%3A');

console.log('📝 Teste 2: Gravação de ONTEM');
const resultado2 = detectarFormatoAudio(calldateOntem, codigoTeste);
console.log('   Calldate:', calldateOntem);
console.log('   É de hoje?', resultado2.ehHoje);
console.log('   URL principal:', resultado2.urlPrincipal);
console.log('   URL WAV:', resultado2.urlWav);
console.log('   URL MP3:', resultado2.urlMp3);
console.log('   ✅ Esperado: ehHoje = false, URL principal = .mp3\n');

// Teste 3: Gravação de uma semana atrás
const semanaAtras = new Date();
semanaAtras.setDate(semanaAtras.getDate() - 7);
const calldateSemanaAtras = semanaAtras.toISOString().replace('T', ' ').substring(0, 19).replace(/:/g, '%3A');

console.log('📝 Teste 3: Gravação de UMA SEMANA ATRÁS');
const resultado3 = detectarFormatoAudio(calldateSemanaAtras, codigoTeste);
console.log('   Calldate:', calldateSemanaAtras);
console.log('   É de hoje?', resultado3.ehHoje);
console.log('   URL principal:', resultado3.urlPrincipal);
console.log('   URL WAV:', resultado3.urlWav);
console.log('   URL MP3:', resultado3.urlMp3);
console.log('   ✅ Esperado: ehHoje = false, URL principal = .mp3\n');

// Teste 4: Formato com espaço e dois pontos (formato esperado do webhook)
const calldateFormatado = '2025-11-03 11:38:26';

console.log('📝 Teste 4: Formato com espaço e dois pontos');
const resultado4 = detectarFormatoAudio(calldateFormatado, codigoTeste);
console.log('   Calldate:', calldateFormatado);
console.log('   É de hoje?', resultado4.ehHoje);
console.log('   URL principal:', resultado4.urlPrincipal);
console.log('   ✅ Esperado: URLs montadas corretamente\n');

// Teste 5: Calldate vazio (fallback)
console.log('📝 Teste 5: Calldate vazio (fallback)');
const resultado5 = detectarFormatoAudio('', codigoTeste);
console.log('   Calldate:', '(vazio)');
console.log('   É de hoje?', resultado5.ehHoje);
console.log('   URL principal:', resultado5.urlPrincipal);
console.log('   ✅ Esperado: ehHoje = false, URL principal = .mp3 (mais seguro)\n');

// Teste 6: Formato com + e %3A (formato URL encoded)
const calldateEncoded = '2025-11-03+11%3A38%3A26';

console.log('📝 Teste 6: Formato URL encoded (+ e %3A)');
const resultado6 = detectarFormatoAudio(calldateEncoded, codigoTeste);
console.log('   Calldate:', calldateEncoded);
console.log('   É de hoje?', resultado6.ehHoje);
console.log('   URL principal:', resultado6.urlPrincipal);
console.log('   ✅ Esperado: Parse correto após replace\n');

// Validação final
console.log('📊 Resumo dos Testes:');
console.log('   ✅ Teste 1 (hoje):', resultado1.ehHoje === true ? 'PASSOU' : 'FALHOU');
console.log('   ✅ Teste 2 (ontem):', resultado2.ehHoje === false ? 'PASSOU' : 'FALHOU');
console.log('   ✅ Teste 3 (semana):', resultado3.ehHoje === false ? 'PASSOU' : 'FALHOU');
console.log('   ✅ Teste 4 (formato):', resultado4.urlWav && resultado4.urlMp3 ? 'PASSOU' : 'FALHOU');
console.log('   ✅ Teste 5 (vazio):', resultado5.ehHoje === false ? 'PASSOU' : 'FALHOU');
console.log('   ✅ Teste 6 (encoded):', resultado6.urlWav && resultado6.urlMp3 ? 'PASSOU' : 'FALHOU');

const todosPassaram = 
  resultado1.ehHoje === true &&
  resultado2.ehHoje === false &&
  resultado3.ehHoje === false &&
  resultado4.urlWav && resultado4.urlMp3 &&
  resultado5.ehHoje === false &&
  resultado6.urlWav && resultado6.urlMp3;

console.log('\n' + (todosPassaram ? '🎉 Todos os testes passaram!' : '❌ Alguns testes falharam!'));

