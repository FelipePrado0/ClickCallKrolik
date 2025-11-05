/**
 * Teste para capturar o erro real do Gemini sem tratamento
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function capturarErroReal() {
  console.log('🔍 Capturando erro real do Gemini...\n');
  
  const tokenInvalido = 'AIzaSyCoJ7elSgk8gLYttTfgy5DvfYKhir5nljc';
  const genAI = new GoogleGenerativeAI(tokenInvalido);
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    const base64Audio = Buffer.from('teste').toString('base64');
    
    const result = await model.generateContent([
      'Transcreva este áudio',
      {
        inlineData: {
          data: base64Audio,
          mimeType: 'audio/wav'
        }
      }
    ]);
    
    console.log('✅ Funcionou (não deveria)');
    
  } catch (error) {
    console.log('\n❌ ERRO REAL CAPTURADO:');
    console.log('='.repeat(60));
    console.log('Tipo:', error.constructor.name);
    console.log('Mensagem:', error.message);
    console.log('\nErro completo:');
    console.log(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.log('\nStack:');
    console.log(error.stack);
    console.log('='.repeat(60));
    
    console.log('\n🔍 Análise do erro:');
    const errorString = JSON.stringify(error);
    const errorMsg = error.message || '';
    
    console.log(`   Contém "API key not valid": ${errorMsg.includes('API key not valid')}`);
    console.log(`   Contém "API_KEY_INVALID": ${errorMsg.includes('API_KEY_INVALID')}`);
    console.log(`   Contém "not supported": ${errorMsg.includes('not supported')}`);
    console.log(`   Contém "INVALID_ARGUMENT": ${errorMsg.includes('INVALID_ARGUMENT')}`);
    console.log(`\n   Error string contém "api_key_invalid": ${errorString.toLowerCase().includes('api_key_invalid')}`);
    console.log(`   Error string contém "not supported": ${errorString.toLowerCase().includes('not supported')}`);
  }
}

capturarErroReal();

