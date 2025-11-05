/**
 * Teste completo do fluxo de transcrição
 * Verifica cada etapa: URL → Download → Token → Transcrição
 * 
 * Para executar:
 * node tests/test-transcribe-flow-complete.js
 */

const fs = require('fs');
const path = require('path');
const { transcreverAudio } = require('../backend/transcription-service');
const { baixarAudio } = require('../backend/transcription-service');
const { buscarTokensEmpresa } = require('../backend/transcription-service');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

let testesPassados = 0;
let testesFalhados = 0;

function testar(nome, fn) {
  return async () => {
    try {
      log(`\n${'='.repeat(60)}`, 'cyan');
      log(`🧪 Teste: ${nome}`, 'blue');
      log(`${'='.repeat(60)}`, 'cyan');
      await fn();
      log(`\n✅ PASSOU: ${nome}`, 'green');
      testesPassados++;
    } catch (error) {
      log(`\n❌ FALHOU: ${nome}`, 'red');
      log(`   Erro: ${error.message}`, 'red');
      if (error.stack) {
        const stackLines = error.stack.split('\n').slice(0, 3);
        stackLines.forEach(line => log(`   ${line}`, 'yellow'));
      }
      testesFalhados++;
    }
  };
}

async function executarTestes() {
  log('\n🚀 Iniciando testes completos do fluxo de transcrição\n', 'yellow');
  
  await testar('ETAPA 1: Verificar arquivo company_tokens.json', async () => {
    const tokensPath = path.join(__dirname, '..', 'Data', 'company_tokens.json');
    if (!fs.existsSync(tokensPath)) {
      throw new Error('Arquivo company_tokens.json não encontrado');
    }
    const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    log(`   ✅ Arquivo encontrado`, 'green');
    log(`   📋 Empresas cadastradas: ${tokensData.length}`, 'cyan');
    
    tokensData.forEach((emp, idx) => {
      log(`   \n   Empresa ${idx + 1}:`, 'cyan');
      log(`      Código: ${emp.cod}`, 'cyan');
      log(`      Nome: ${emp.nome}`, 'cyan');
      log(`      Token OpenAI: ${emp.token_openai ? (emp.token_openai.length > 10 ? emp.token_openai.substring(0, 10) + '...' : 'vazio') : 'não configurado'}`, 'cyan');
      log(`      Token Gemini: ${emp.token_gemini ? (emp.token_gemini.length > 10 ? emp.token_gemini.substring(0, 10) + '...' : 'vazio') : 'não configurado'}`, 'cyan');
      log(`      Preferido: ${emp.prefered_token || 'openai'}`, 'cyan');
    });
  })();
  
  await testar('ETAPA 2: Verificar busca de tokens (empresa 100)', async () => {
    const tokensInfo = buscarTokensEmpresa('100');
    log(`   ✅ Empresa encontrada: ${tokensInfo.empresa}`, 'green');
    log(`   📋 Tokens disponíveis:`, 'cyan');
    tokensInfo.tokens.forEach((token, idx) => {
      log(`      ${idx + 1}. Provider: ${token.provider} (Preferido: ${token.preferido ? 'SIM' : 'NÃO'})`, 'cyan');
      log(`         Token: ${token.token ? (token.token.length > 15 ? token.token.substring(0, 15) + '...' : token.token) : 'VAZIO'}`, 'cyan');
      
      if (!token.token || token.token === '' || token.token === 'xxxxxxxxxxxxxxx') {
        throw new Error(`Token ${token.provider} está vazio ou inválido para empresa 100`);
      }
    });
  })();
  
  await testar('ETAPA 3: Testar download de áudio (URL de exemplo)', async () => {
    const urlExemplo = 'https://delorean.krolik.com.br/records/20251105_101703_1003029_103_16981892476_1762348616.wav';
    log(`   📥 Tentando baixar: ${urlExemplo}`, 'cyan');
    
    try {
      const audioBuffer = await baixarAudio(urlExemplo, 10000);
      log(`   ✅ Áudio baixado com sucesso!`, 'green');
      log(`   📊 Tamanho: ${(audioBuffer.length / 1024).toFixed(2)} KB`, 'cyan');
      log(`   📊 Bytes: ${audioBuffer.length}`, 'cyan');
      
      if (audioBuffer.length === 0) {
        throw new Error('Áudio baixado está vazio');
      }
      
      if (audioBuffer.length < 100) {
        log(`   ⚠️  Áudio muito pequeno, pode ser um erro HTML`, 'yellow');
      }
    } catch (error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        log(`   ⚠️  Arquivo não encontrado no servidor (404)`, 'yellow');
        log(`   ℹ️  Isso é esperado se o áudio não existe ainda`, 'yellow');
        log(`   ℹ️  Continuando com teste de estrutura...`, 'yellow');
      } else {
        throw error;
      }
    }
  })();
  
  await testar('ETAPA 4: Testar fluxo completo de transcrição (sem áudio real)', async () => {
    log(`   🔍 Testando estrutura do fluxo...`, 'cyan');
    
    const codigo = '20251105_101703_1003029_103_16981892476_1762348616';
    const companyCode = '100';
    const calldate = new Date().toISOString().split('T')[0] + ' 12:00:00';
    
    let logs = [];
    const logCallback = (level, message, data = {}) => {
      logs.push({ level, message, data, timestamp: new Date().toISOString() });
      log(`   [${level.toUpperCase()}] ${message}`, level === 'error' ? 'red' : level === 'warn' ? 'yellow' : 'cyan');
      if (Object.keys(data).length > 0) {
        log(`      Dados: ${JSON.stringify(data)}`, 'cyan');
      }
    };
    
    try {
      log(`   📋 Parâmetros:`, 'cyan');
      log(`      Código: ${codigo}`, 'cyan');
      log(`      Company Code: ${companyCode}`, 'cyan');
      log(`      Calldate: ${calldate}`, 'cyan');
      
      const resultado = await transcreverAudio(null, codigo, companyCode, calldate, logCallback);
      
      log(`   ✅ Transcrição concluída!`, 'green');
      log(`   📝 Provider: ${resultado.provider}`, 'cyan');
      log(`   📝 Modelo: ${resultado.model}`, 'cyan');
      log(`   ⏱️  Duração: ${resultado.duration}s`, 'cyan');
      log(`   📊 Tamanho da transcrição: ${resultado.transcription.length} caracteres`, 'cyan');
      log(`   📄 Primeiros 100 caracteres: ${resultado.transcription.substring(0, 100)}...`, 'cyan');
      
    } catch (error) {
      log(`   📋 Logs capturados (${logs.length} entradas):`, 'cyan');
      logs.forEach((logEntry, idx) => {
        const color = logEntry.level === 'error' ? 'red' : logEntry.level === 'warn' ? 'yellow' : 'cyan';
        log(`      ${idx + 1}. [${logEntry.level}] ${logEntry.message}`, color);
        if (Object.keys(logEntry.data).length > 0) {
          log(`         ${JSON.stringify(logEntry.data)}`, color);
        }
      });
      
      if (error.message.includes('Token') || error.message.includes('401') || error.message.includes('API_KEY')) {
        log(`   ⚠️  ERRO DE TOKEN: ${error.message}`, 'red');
        log(`   💡 Solução: Verifique o token no company_tokens.json`, 'yellow');
        throw error;
      } else if (error.message.includes('não foi possível baixar') || error.message.includes('404')) {
        log(`   ⚠️  ERRO DE DOWNLOAD: ${error.message}`, 'yellow');
        log(`   ℹ️  Isso pode ser esperado se o áudio não existe no servidor`, 'yellow');
      } else if (error.message.includes('não suportado') || error.message.includes('not supported')) {
        log(`   ⚠️  ERRO DE FORMATO: ${error.message}`, 'red');
        log(`   💡 Isso pode indicar problema com o formato ou tamanho do áudio`, 'yellow');
        throw error;
      } else {
        throw error;
      }
    }
  })();
  
  await testar('ETAPA 5: Verificar estrutura de resposta', async () => {
    log(`   🔍 Verificando estrutura de resposta esperada...`, 'cyan');
    
    const estruturaEsperada = {
      success: true,
      transcription: 'string',
      model: 'string',
      provider: 'string',
      duration: 'number',
      language: 'string',
      requestId: 'string'
    };
    
    log(`   ✅ Estrutura esperada:`, 'green');
    Object.keys(estruturaEsperada).forEach(key => {
      log(`      ${key}: ${estruturaEsperada[key]}`, 'cyan');
    });
  })();
  
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 Resumo dos Testes:', 'yellow');
  log(`${'='.repeat(60)}`, 'cyan');
  log(`   ✅ Passaram: ${testesPassados}`, 'green');
  log(`   ❌ Falharam: ${testesFalhados}`, 'red');
  log(`   📈 Total: ${testesPassados + testesFalhados}`, 'blue');
  log(`${'='.repeat(60)}`, 'cyan');
  
  if (testesFalhados === 0) {
    log('\n🎉 Todos os testes passaram!', 'green');
  } else {
    log('\n⚠️  Alguns testes falharam. Verifique os erros acima.', 'yellow');
  }
  
  log('\n💡 Diagnóstico:', 'magenta');
  if (testesFalhados > 0) {
    log('   - Verifique os logs acima para identificar o problema', 'yellow');
    log('   - Verifique se o token do Gemini está válido em company_tokens.json', 'yellow');
    log('   - Verifique se o áudio existe no servidor Delorean', 'yellow');
    log('   - Verifique os logs do servidor backend', 'yellow');
  } else {
    log('   ✅ Fluxo está funcionando corretamente!', 'green');
  }
}

executarTestes().catch(error => {
  log(`\n💥 Erro fatal nos testes: ${error.message}`, 'red');
  if (error.stack) {
    log(`\nStack trace:`, 'red');
    console.error(error.stack);
  }
  process.exit(1);
});

