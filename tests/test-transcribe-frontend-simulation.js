/**
 * Teste que simula exatamente o que o frontend faz
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:4201';

async function simularFrontend() {
  console.log('🔍 Simulando requisição do frontend...\n');
  
  const gravacao = {
    codigo: '20251105_101703_1003029_103_16981892476_1762348616',
    company_id: '100',
    calldate: new Date().toISOString().split('T')[0] + ' 12:00:00'
  };
  
  const codigo = gravacao.codigo;
  const companyCode = gravacao.company_id || '100';
  
  let audioUrl = '';
  if (codigo) {
    const hoje = new Date();
    const calldateStr = gravacao.calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
    const dataGravacao = new Date(calldateStr);
    const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const dataGravacaoSemHora = new Date(dataGravacao.getFullYear(), dataGravacao.getMonth(), dataGravacao.getDate());
    const ehGravacaoDeHoje = dataGravacaoSemHora.getTime() === hojeSemHora.getTime();
    
    audioUrl = ehGravacaoDeHoje 
      ? `https://delorean.krolik.com.br/records/${codigo}.wav`
      : `https://delorean.krolik.com.br/records/${codigo}.mp3`;
  }
  
  console.log('📋 Dados que serão enviados:');
  console.log(`   audioUrl: ${audioUrl}`);
  console.log(`   codigo: ${codigo}`);
  console.log(`   companyCode: ${companyCode}`);
  console.log(`   calldate: ${gravacao.calldate}`);
  
  try {
    const response = await axios.post(`${BASE_URL}/api/transcribe`, {
      audioUrl: audioUrl,
      codigo: codigo,
      companyCode: companyCode,
      calldate: gravacao.calldate || ''
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000,
      validateStatus: () => true
    });
    
    console.log(`\n📥 Resposta:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${response.data.success}`);
    console.log(`   Message: ${response.data.message}`);
    console.log(`   Error Code: ${response.data.errorCode}`);
    
    if (response.data.error) {
      console.log(`   Error: ${response.data.error}`);
    }
    
    if (response.status === 200 && response.data.success) {
      console.log(`\n✅ Transcrição bem-sucedida!`);
      console.log(`   Provider: ${response.data.provider}`);
      console.log(`   Modelo: ${response.data.model}`);
      console.log(`   Transcrição: ${response.data.transcription.substring(0, 100)}...`);
    } else {
      console.log(`\n❌ Erro na transcrição`);
      
      if (response.data.errorCode === 'INVALID_TOKEN' || response.data.message.includes('Token')) {
        console.log(`\n💡 DIAGNÓSTICO: Token inválido`);
        console.log(`   - Verifique o token no company_tokens.json`);
        console.log(`   - Token atual: ${companyCode}`);
      } else if (response.data.errorCode === 'FORMAT_NOT_SUPPORTED') {
        console.log(`\n💡 DIAGNÓSTICO: Formato não suportado`);
        console.log(`   - Mas o status HTTP é 401, então pode ser erro de token`);
        console.log(`   - Verifique os logs do servidor para o erro real`);
      }
    }
    
  } catch (error) {
    console.log(`\n❌ Erro na requisição: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data:`, JSON.stringify(error.response.data, null, 2));
    }
  }
}

simularFrontend();

