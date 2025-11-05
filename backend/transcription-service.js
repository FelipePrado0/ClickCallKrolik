/**
 * Serviço de Transcrição de Áudio
 * 
 * Gerencia transcrições usando múltiplos providers (OpenAI, Gemini, etc.)
 * com suporte a fallback automático e extensibilidade para novos providers.
 */

const fs = require('fs');
const https = require('https');
const urlModule = require('url');
const path = require('path');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Detecta o formato de áudio baseado na data da gravação
 * @param {string} calldate - Data da gravação (opcional)
 * @param {string} codigo - Código da gravação
 * @returns {Object} Objeto com formato principal, lista de formatos e URLs
 */
function detectarFormatoAudio(calldate, codigo) {
  let formatoPrincipal = 'mp3'; // Mais seguro (padrão)
  let formatosParaTentar = ['mp3', 'wav'];

  if (calldate) {
    try {
      // Parse da data
      const calldateStr = calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
      const dataGravacao = new Date(calldateStr);
      const hoje = new Date();

      // Comparar apenas data (sem hora)
      const dataGravacaoSemHora = new Date(
        dataGravacao.getFullYear(),
        dataGravacao.getMonth(),
        dataGravacao.getDate()
      );
      const hojeSemHora = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate()
      );

      const ehHoje = dataGravacaoSemHora.getTime() === hojeSemHora.getTime();

      if (ehHoje) {
        formatoPrincipal = 'wav';
        formatosParaTentar = ['wav', 'mp3'];
      }
    } catch (e) {
      console.warn('[detectarFormatoAudio] Erro ao parsear data:', e);
      // Mantém padrão (MP3)
    }
  }

  return {
    formato: formatoPrincipal,
    tentar: formatosParaTentar,
    urlWav: `https://delorean.krolik.com.br/records/${codigo}.wav`,
    urlMp3: `https://delorean.krolik.com.br/records/${codigo}.mp3`
  };
}

/**
 * Baixa arquivo de áudio de uma URL
 * @param {string} url - URL do áudio
 * @param {number} timeout - Timeout em milissegundos (padrão: 30000)
 * @returns {Promise<Buffer>} Buffer do áudio baixado
 */
async function baixarAudio(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new urlModule.URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: timeout
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout ao baixar áudio'));
    });

    req.end();
  });
}

/**
 * Busca tokens de API de uma empresa
 * @param {string} companyCode - Código da empresa
 * @returns {Object} Objeto com empresa, provider e token (ou array de providers disponíveis)
 */
function buscarTokensEmpresa(companyCode) {
  try {
    const tokensPath = path.join(__dirname, '..', 'Data', 'company_tokens.json');
    const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

    const empresa = tokensData.find(emp => emp.cod === companyCode);

    if (!empresa) {
      throw new Error(`Empresa com código ${companyCode} não encontrada`);
    }

    const preferedToken = empresa.prefered_token || 'openai';

    // Coletar todos os tokens disponíveis
    const tokensDisponiveis = [];
    
    // Verificar OpenAI
    if (empresa.token_openai && 
        empresa.token_openai !== 'xxxxxxxxxxxxxxx' && 
        empresa.token_openai !== 'seu-token-openai-aqui') {
      tokensDisponiveis.push({
        provider: 'openai',
        token: empresa.token_openai,
        preferido: preferedToken === 'openai'
      });
    }

    // Verificar Gemini
    if (empresa.token_gemini && 
        empresa.token_gemini !== 'xxxxxxxxxxxxxxx' && 
        empresa.token_gemini !== 'seu-token-gemini-aqui') {
      tokensDisponiveis.push({
        provider: 'gemini',
        token: empresa.token_gemini,
        preferido: preferedToken === 'gemini'
      });
    }

    if (tokensDisponiveis.length === 0) {
      throw new Error(`Nenhum token disponível para empresa ${companyCode}`);
    }

    // Ordenar: preferido primeiro
    tokensDisponiveis.sort((a, b) => {
      if (a.preferido && !b.preferido) return -1;
      if (!a.preferido && b.preferido) return 1;
      return 0;
    });

    return {
      empresa: empresa.nome,
      tokens: tokensDisponiveis
    };
  } catch (error) {
    throw new Error(`Erro ao buscar tokens: ${error.message}`);
  }
}

/**
 * Transcreve áudio usando OpenAI Whisper API
 * @param {Buffer} audioBuffer - Buffer do áudio
 * @param {string} token - Token da OpenAI
 * @param {string} mimeType - Tipo MIME do áudio (padrão: 'audio/wav')
 * @returns {Promise<string>} Texto transcrito
 */
async function transcreverComOpenAI(audioBuffer, token, mimeType = 'audio/wav') {
  const openai = new OpenAI({
    apiKey: token,
    timeout: 60000 // 60 segundos
  });

  let lastError = null;

  // Tentar até 3 vezes
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Fazer transcrição usando SDK OpenAI
      const transcription = await openai.audio.transcriptions.create({
        file: audioBuffer,
        model: 'whisper-1',
        language: 'pt',
        response_format: 'json'
      });

      return transcription.text;
    } catch (error) {
      lastError = error;

      // Se der erro com Buffer direto, tentar com FormData (fallback)
      if (attempt === 1 && (error.message.includes('file') || error.message.includes('format'))) {
        try {
          const FormData = require('form-data');
          const axios = require('axios');

          const form = new FormData();
          form.append('file', audioBuffer, {
            filename: 'audio.wav',
            contentType: mimeType
          });
          form.append('model', 'whisper-1');
          form.append('language', 'pt');
          form.append('response_format', 'json');

          const response = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            form,
            {
              headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
              },
              timeout: 60000
            }
          );

          return response.data.text;
        } catch (fallbackError) {
          lastError = fallbackError;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        }
      } else {
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
    }
  }

  throw lastError;
}

/**
 * Transcreve áudio usando Google Gemini API
 * @param {Buffer} audioBuffer - Buffer do áudio
 * @param {string} token - Token da Gemini
 * @param {string} mimeType - Tipo MIME do áudio (padrão: 'audio/wav')
 * @returns {Promise<string>} Texto transcrito
 */
async function transcreverComGemini(audioBuffer, token, mimeType = 'audio/wav') {
  try {
    const genAI = new GoogleGenerativeAI(token);
    
    // Converter buffer para base64
    const base64Audio = audioBuffer.toString('base64');
    
    // Mapear MIME types
    const geminiMimeType = mimeType === 'audio/mpeg' ? 'audio/mpeg' : 'audio/wav';
    
    // Usar o modelo Gemini para transcrição de áudio
    // Tentar gemini-1.5-flash primeiro (mais rápido e suporta áudio)
    // Se não funcionar, tentar gemini-pro
    let model;
    try {
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } catch (e) {
      model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    }
    
    const prompt = "Transcreva este áudio para português. Retorne APENAS o texto transcrito, sem comentários ou explicações adicionais.";
    
    // Preparar o áudio no formato que o Gemini espera
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Audio,
          mimeType: geminiMimeType
        }
      }
    ]);
    
    const response = await result.response;
    const texto = response.text();
    
    return texto.trim();
  } catch (error) {
    // Melhorar mensagens de erro do Gemini
    let mensagemErro = error.message || 'Erro desconhecido';
    
    if (error.message && error.message.includes('API_KEY_INVALID') || error.message.includes('401')) {
      mensagemErro = 'Token da API Gemini inválido ou expirado. Configure um token válido no company_tokens.json';
    } else if (error.message && error.message.includes('403')) {
      mensagemErro = 'Acesso negado à API Gemini. Verifique as permissões do token.';
    } else if (error.message && error.message.includes('429')) {
      mensagemErro = 'Limite de requisições da API Gemini atingido. Aguarde alguns minutos.';
    } else if (error.message && (error.message.includes('INVALID_ARGUMENT') || error.message.includes('not supported'))) {
      mensagemErro = 'Formato de áudio não suportado pela API Gemini. Tente usar OpenAI.';
    }
    
    throw new Error(`Erro na transcrição com Gemini: ${mensagemErro}`);
  }
}

/**
 * Função principal de transcrição com fallback automático
 * @param {string} audioUrl - URL do áudio (opcional se codigo fornecido)
 * @param {string} codigo - Código da gravação (opcional se audioUrl fornecido)
 * @param {string} companyCode - Código da empresa
 * @param {string} calldate - Data da gravação (opcional)
 * @param {Function} logCallback - Função de callback para logs (opcional)
 * @returns {Promise<Object>} Objeto com transcrição, provider usado, modelo e duração
 */
async function transcreverAudio(audioUrl, codigo, companyCode, calldate, logCallback = null) {
  const log = logCallback || (() => {});

  // Validar parâmetros
  if (!companyCode) {
    throw new Error('Parâmetro "companyCode" é obrigatório');
  }

  // Determinar URL do áudio
  let urlFinal = audioUrl;
  let codigoGravacao = codigo;

  if (!urlFinal && codigoGravacao) {
    const formatoInfo = detectarFormatoAudio(calldate, codigoGravacao);
    urlFinal = formatoInfo.formato === 'wav' ? formatoInfo.urlWav : formatoInfo.urlMp3;
  }

  if (!urlFinal) {
    throw new Error('Parâmetro "audioUrl" ou "codigo" é obrigatório');
  }

  // Validar URL
  if (!urlFinal.startsWith('https://delorean.krolik.com.br/')) {
    throw new Error('URL inválida. Apenas domínio delorean.krolik.com.br é permitido');
  }

  log('info', 'Iniciando transcrição', { url: urlFinal, companyCode });

  // Detectar formato e baixar áudio
  const formatoInfo = detectarFormatoAudio(calldate, codigoGravacao || '');
  let audioBuffer = null;
  let mimeType = null;
  let tentativas = 0;

  for (const formato of formatoInfo.tentar) {
    try {
      const urlFormatada = formato === 'wav' ? formatoInfo.urlWav : formatoInfo.urlMp3;
      log('info', `Tentando baixar áudio (${formato})`, { url: urlFormatada });

      audioBuffer = await baixarAudio(urlFormatada, 30000);
      mimeType = formato === 'wav' ? 'audio/wav' : 'audio/mpeg';
      tentativas++;
      break;
    } catch (error) {
      log('warn', `Falha ao baixar ${formato}`, { error: error.message });
      if (tentativas === formatoInfo.tentar.length - 1) {
        throw new Error(`Não foi possível baixar áudio em nenhum formato. Último erro: ${error.message}`);
      }
    }
  }

  if (!audioBuffer) {
    throw new Error('Não foi possível baixar o áudio');
  }

  log('info', 'Áudio baixado com sucesso', {
    tamanho: audioBuffer.length,
    formato: mimeType,
    tentativas
  });

  // Buscar tokens da empresa
  const tokensInfo = buscarTokensEmpresa(companyCode);
  log('info', 'Tokens encontrados', {
    empresa: tokensInfo.empresa,
    tokensDisponiveis: tokensInfo.tokens.map(t => t.provider)
  });

  // Tentar transcrição com fallback automático
  let ultimoErro = null;
  const startTime = Date.now();

  for (const tokenInfo of tokensInfo.tokens) {
    try {
      log('info', `Tentando transcrição com ${tokenInfo.provider}`, {
        preferido: tokenInfo.preferido
      });

      let transcricao = null;

      if (tokenInfo.provider === 'openai') {
        transcricao = await transcreverComOpenAI(audioBuffer, tokenInfo.token, mimeType);
      } else if (tokenInfo.provider === 'gemini') {
        transcricao = await transcreverComGemini(audioBuffer, tokenInfo.token, mimeType);
      } else {
        throw new Error(`Provider não suportado: ${tokenInfo.provider}`);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      log('info', 'Transcrição concluída', {
        provider: tokenInfo.provider,
        duracao: duration,
        tamanhoTranscricao: transcricao.length
      });

      return {
        success: true,
        transcription: transcricao,
        model: tokenInfo.provider === 'openai' ? 'whisper-1' : 'gemini-1.5-pro',
        provider: tokenInfo.provider,
        duration: parseFloat(duration),
        language: 'pt'
      };
    } catch (error) {
      ultimoErro = error;
      log('warn', `Falha na transcrição com ${tokenInfo.provider}`, {
        error: error.message,
        tentandoProximo: tokensInfo.tokens.indexOf(tokenInfo) < tokensInfo.tokens.length - 1
      });

      // Se não é o último provider, continua para o próximo
      if (tokensInfo.tokens.indexOf(tokenInfo) < tokensInfo.tokens.length - 1) {
        continue;
      }
    }
  }

  // Se chegou aqui, todos os providers falharam
  let mensagemErro = 'Erro ao transcrever áudio';
  let codigoErro = 'TRANSCRIBE_ERROR';
  
  if (ultimoErro) {
    const erroMsg = ultimoErro.message || '';
    
    if (erroMsg.includes('Invalid API key') || erroMsg.includes('401') || erroMsg.includes('API_KEY_INVALID')) {
      mensagemErro = 'Token da API inválido ou expirado. Verifique os tokens configurados em company_tokens.json';
      codigoErro = 'INVALID_TOKEN';
    } else if (erroMsg.includes('timeout') || erroMsg.includes('Timeout')) {
      mensagemErro = 'Tempo limite excedido. O áudio pode ser muito longo ou a conexão está lenta.';
      codigoErro = 'TIMEOUT';
    } else if (erroMsg.includes('rate limit') || erroMsg.includes('429')) {
      mensagemErro = 'Limite de requisições atingido. Aguarde alguns minutos antes de tentar novamente.';
      codigoErro = 'RATE_LIMIT';
    } else if (erroMsg.includes('Nenhum token disponível')) {
      mensagemErro = 'Nenhum token de API configurado. Configure pelo menos um token válido (OpenAI ou Gemini) em company_tokens.json';
      codigoErro = 'NO_TOKEN';
    } else if (erroMsg.includes('Empresa com código')) {
      mensagemErro = `Empresa não encontrada. Verifique se o código da empresa está correto e se existe em company_tokens.json`;
      codigoErro = 'COMPANY_NOT_FOUND';
    } else if (erroMsg.includes('não suportado') || erroMsg.includes('not supported')) {
      mensagemErro = 'Formato de áudio não suportado pela API. Tente outro provider.';
      codigoErro = 'FORMAT_NOT_SUPPORTED';
    } else {
      mensagemErro = `Erro na transcrição: ${erroMsg}`;
    }
  }

  const erroFinal = new Error(mensagemErro);
  erroFinal.code = codigoErro;
  throw erroFinal;
}

module.exports = {
  transcreverAudio,
  detectarFormatoAudio,
  baixarAudio,
  buscarTokensEmpresa,
  transcreverComOpenAI,
  transcreverComGemini
};
