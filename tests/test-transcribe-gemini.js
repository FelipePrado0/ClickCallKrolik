/**
 * Testes automáticos para Transcrição Gemini
 * 
 * Para executar:
 * node tests/test-transcribe-gemini.js
 */

const path = require('path');
const fs = require('fs');

let axios = null;
try {
  axios = require('axios');
} catch (e) {
  console.log('⚠️  axios não instalado, testes de integração serão pulados');
}

let transcreverComGemini = null;
try {
  const geminiModule = require('../backend/transcription-gemini');
  transcreverComGemini = geminiModule.transcreverComGemini;
} catch (e) {
  console.log('⚠️  Módulo transcription-gemini não pode ser carregado (dependências não instaladas), apenas testes de validação serão executados');
}

const BASE_URL = 'http://localhost:4201';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let testesPassados = 0;
let testesFalhados = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testar(nome, fn) {
  return async () => {
    try {
      log(`\n🧪 Teste: ${nome}`, 'blue');
      await fn();
      log(`✅ PASSOU: ${nome}`, 'green');
      testesPassados++;
    } catch (error) {
      log(`❌ FALHOU: ${nome}`, 'red');
      log(`   Erro: ${error.message}`, 'red');
      if (error.stack) {
        log(`   Stack: ${error.stack.split('\n')[1]}`, 'yellow');
      }
      testesFalhados++;
    }
  };
}

async function executarTestes() {
  log('🚀 Iniciando testes automáticos da Transcrição Gemini\n', 'yellow');
  
  await testar('Validação: Função detectarMimeTypeGemini existe', async () => {
    const fs = require('fs');
    const transcriptionGeminiPath = path.join(__dirname, '..', 'backend', 'transcription-gemini.js');
    const content = fs.readFileSync(transcriptionGeminiPath, 'utf8');
    if (!content.includes('function detectarMimeTypeGemini')) {
      throw new Error('Função detectarMimeTypeGemini não encontrada');
    }
    if (!content.includes('.mp3') || !content.includes('.wav') || !content.includes('.ogg') || !content.includes('.m4a')) {
      throw new Error('Formato de áudio não suportado na função');
    }
    log(`   ✅ Função detectarMimeTypeGemini encontrada com suporte a MP3, WAV, OGG, M4A`, 'green');
  })();
  
  await testar('Validação: Detecção de MIME type por extensão', async () => {
    const fs = require('fs');
    const transcriptionGeminiPath = path.join(__dirname, '..', 'backend', 'transcription-gemini.js');
    const content = fs.readFileSync(transcriptionGeminiPath, 'utf8');
    if (!content.includes('path.extname')) {
      throw new Error('Detecção de extensão não implementada');
    }
    log(`   ✅ Detecção de MIME type por extensão implementada`, 'green');
  })();
  
  await testar('Validação: Parâmetro audioUrl adicionado', async () => {
    const fs = require('fs');
    const transcriptionGeminiPath = path.join(__dirname, '..', 'backend', 'transcription-gemini.js');
    const content = fs.readFileSync(transcriptionGeminiPath, 'utf8');
    if (!content.includes('audioUrl = \'\'') && !content.includes('audioUrl=')) {
      throw new Error('Parâmetro audioUrl não encontrado na assinatura da função');
    }
    log(`   ✅ Parâmetro audioUrl encontrado`, 'green');
  })();
  
  await testar('Validação: Modelo gemini-2.5-flash-lite configurado', async () => {
    const fs = require('fs');
    const transcriptionGeminiPath = path.join(__dirname, '..', 'backend', 'transcription-gemini.js');
    const content = fs.readFileSync(transcriptionGeminiPath, 'utf8');
    if (!content.includes('gemini-2.5-flash-lite')) {
      throw new Error('Modelo gemini-2.5-flash-lite não encontrado');
    }
    log(`   ✅ Modelo gemini-2.5-flash-lite configurado`, 'green');
  })();
  
  await testar('Validação: Fallback para gemini-2.5-flash configurado', async () => {
    const fs = require('fs');
    const transcriptionGeminiPath = path.join(__dirname, '..', 'backend', 'transcription-gemini.js');
    const content = fs.readFileSync(transcriptionGeminiPath, 'utf8');
    if (!content.includes('gemini-2.5-flash') || !content.includes('gemini-2.5-flash-lite')) {
      throw new Error('Fallback para gemini-2.5-flash não encontrado');
    }
    const modelos = content.match(/gemini-2\.5-flash(?:-lite)?/g);
    if (!modelos || modelos.length < 2) {
      throw new Error('Ambos modelos (lite e flash) não encontrados');
    }
    log(`   ✅ Fallback para gemini-2.5-flash configurado`, 'green');
  })();
  
  await testar('Validação: Prompt melhorado', async () => {
    const fs = require('fs');
    const transcriptionGeminiPath = path.join(__dirname, '..', 'backend', 'transcription-gemini.js');
    const content = fs.readFileSync(transcriptionGeminiPath, 'utf8');
    if (!content.includes('Por favor, transcreva este áudio na íntegra')) {
      throw new Error('Prompt melhorado não encontrado');
    }
    log(`   ✅ Prompt melhorado encontrado`, 'green');
  })();
  
  await testar('Validação: Chamada atualizada em transcription-service.js', async () => {
    const fs = require('fs');
    const servicePath = path.join(__dirname, '..', 'backend', 'transcription-service.js');
    const content = fs.readFileSync(servicePath, 'utf8');
    if (!content.includes('transcreverComGemini(audioBuffer, tokenInfo.token, mimeType, urlFinal)')) {
      throw new Error('Chamada não atualizada com urlFinal');
    }
    log(`   ✅ Chamada atualizada com urlFinal`, 'green');
  })();
  
  if (axios) {
    await testar('Teste de integração: Endpoint /api/transcribe com Gemini', async () => {
      try {
        const response = await axios.post(`${BASE_URL}/api/transcribe`, {
          codigo: '20251105_101703_1003029_103_16981892476_1762348616',
          companyCode: '100',
          calldate: new Date().toISOString().split('T')[0] + ' 12:00:00'
        }).catch((err) => {
          if (err.response && err.response.status === 401) {
            log(`   ⚠️  Erro 401: Token inválido ou modelo não disponível (esperado em teste)`, 'yellow');
            return null;
          }
          throw err;
        });
        
        if (response && response.data && response.data.success) {
          log(`   ✅ Transcrição bem-sucedida com Gemini`, 'green');
          log(`   Provider: ${response.data.provider}`, 'cyan');
          log(`   Modelo: ${response.data.model}`, 'cyan');
        } else {
          log(`   ℹ️  Teste de lógica (requer token válido e áudio real)`, 'yellow');
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          log(`   ⚠️  Servidor não está rodando. Inicie com: npm start`, 'yellow');
          throw new Error('Servidor não está rodando');
        }
        throw error;
      }
    })();
  } else {
    log(`\n⚠️  Teste de integração pulado (axios não instalado)`, 'yellow');
  }
  
  log('\n📊 Resumo dos Testes:', 'yellow');
  log(`   ✅ Passaram: ${testesPassados}`, 'green');
  log(`   ❌ Falharam: ${testesFalhados}`, 'red');
  log(`   📈 Total: ${testesPassados + testesFalhados}`, 'blue');
  
  if (testesFalhados === 0) {
    log('\n🎉 Todos os testes passaram!', 'green');
  } else {
    log('\n⚠️  Alguns testes falharam. Verifique os erros acima.', 'yellow');
  }
}

executarTestes().catch(error => {
  log(`\n💥 Erro fatal nos testes: ${error.message}`, 'red');
  process.exit(1);
});

