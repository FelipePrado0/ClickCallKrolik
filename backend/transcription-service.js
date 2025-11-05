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
const { transcreverComOpenAI } = require('./transcription-openai');
const { transcreverComGemini } = require('./transcription-gemini');

/**
 * Detecta o formato de áudio baseado na data da gravação
 * @param {string} calldate - Data da gravação (opcional)
 * @param {string} codigo - Código da gravação
 * @returns {Object} Objeto com formato principal, lista de formatos e URLs
 */
function detectarFormatoAudio(calldate, codigo) {
  let formatoPrincipal = 'wav';
  let formatosParaTentar = ['wav', 'mp3'];

  if (calldate) {
    try {
      const calldateStr = calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
      const dataGravacao = new Date(calldateStr);
      const hoje = new Date();

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
        formatosParaTentar = ['wav'];
      } else {
        formatoPrincipal = 'wav';
        formatosParaTentar = ['wav', 'mp3'];
      }
    } catch (e) {
      console.warn('[detectarFormatoAudio] Erro ao parsear data:', e);
      formatoPrincipal = 'wav';
      formatosParaTentar = ['wav', 'mp3'];
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
  let urlAudioReal = null;
  let tentativas = 0;

  for (const formato of formatoInfo.tentar) {
    try {
      const urlFormatada = formato === 'wav' ? formatoInfo.urlWav : formatoInfo.urlMp3;
      log('info', `Tentando baixar áudio (${formato})`, { url: urlFormatada });

      audioBuffer = await baixarAudio(urlFormatada, 30000);
      mimeType = formato === 'wav' ? 'audio/wav' : 'audio/mpeg';
      urlAudioReal = urlFormatada;
      tentativas++;
      
      console.log(`[transcription-service] ✅ Áudio baixado como ${formato.toUpperCase()}:`, {
        url: urlFormatada,
        tamanho: audioBuffer.length,
        tamanhoKB: (audioBuffer.length / 1024).toFixed(2),
        mimeType: mimeType
      });
      
      break;
    } catch (error) {
      log('warn', `Falha ao baixar ${formato}`, { error: error.message });
      console.warn(`[transcription-service] ⚠️ Falha ao baixar ${formato.toUpperCase()}:`, error.message);
      if (tentativas === formatoInfo.tentar.length - 1) {
        throw new Error(`Não foi possível baixar áudio em nenhum formato. Último erro: ${error.message}`);
      }
    }
  }

  if (!audioBuffer) {
    throw new Error('Não foi possível baixar o áudio');
  }

  if (!urlAudioReal) {
    urlAudioReal = urlFinal || (formatoInfo.tentar.length > 0 ? (formatoInfo.tentar[0] === 'wav' ? formatoInfo.urlWav : formatoInfo.urlMp3) : '');
  }

  log('info', 'Áudio baixado com sucesso', {
    tamanho: audioBuffer.length,
    tamanhoKB: (audioBuffer.length / 1024).toFixed(2),
    formato: mimeType,
    tentativas,
    urlUsada: urlAudioReal
  });
  
  if (audioBuffer.length < 1000) {
    log('warn', 'Áudio muito pequeno, pode estar corrompido ou vazio', {
      tamanho: audioBuffer.length
    });
  }

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

      let transcricaoTexto = null;
      let modeloUsado = null;
      
      if (tokenInfo.provider === 'openai') {
        transcricaoTexto = await transcreverComOpenAI(audioBuffer, tokenInfo.token, mimeType);
        modeloUsado = 'whisper-1';
      } else if (tokenInfo.provider === 'gemini') {
        log('info', `Enviando áudio para Gemini`, {
          url: urlAudioReal,
          mimeType: mimeType,
          tamanhoKB: audioBuffer ? (audioBuffer.length / 1024).toFixed(2) : 'N/A',
          tamanhoMB: audioBuffer ? (audioBuffer.length / (1024 * 1024)).toFixed(2) : 'N/A'
        });
        const resultadoGemini = await transcreverComGemini(audioBuffer, tokenInfo.token, mimeType, urlAudioReal);
        transcricaoTexto = resultadoGemini.texto;
        modeloUsado = resultadoGemini.modelo || 'gemini-2.5-flash-lite';
        
        console.log(`[transcription-service] 📥 Resultado do Gemini recebido:`, {
          tamanhoTexto: transcricaoTexto ? transcricaoTexto.length : 0,
          textoPreview: transcricaoTexto ? transcricaoTexto.substring(0, 200) : 'N/A',
          textoCompleto: transcricaoTexto || 'VAZIO',
          modelo: modeloUsado
        });
        
        log('info', `Transcrição Gemini recebida`, {
          tamanhoTexto: transcricaoTexto ? transcricaoTexto.length : 0,
          modelo: modeloUsado,
          textoPreview: transcricaoTexto ? transcricaoTexto.substring(0, 100) : 'N/A'
        });
        
        if (!transcricaoTexto || transcricaoTexto.length === 0) {
          throw new Error('Transcrição do Gemini está vazia');
        }
      } else {
        throw new Error(`Provider não suportado: ${tokenInfo.provider}`);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      log('info', 'Transcrição concluída', {
        provider: tokenInfo.provider,
        modelo: modeloUsado,
        duracao: duration,
        tamanhoTranscricao: transcricaoTexto.length
      });

      console.log(`[transcription-service] 📤 Retornando resposta para API:`, {
        tamanhoTranscricao: transcricaoTexto ? transcricaoTexto.length : 0,
        textoPreview: transcricaoTexto ? transcricaoTexto.substring(0, 200) : 'N/A',
        provider: tokenInfo.provider,
        model: modeloUsado
      });
      
      return {
        success: true,
        transcription: transcricaoTexto,
        model: modeloUsado,
        provider: tokenInfo.provider,
        duration: parseFloat(duration),
        language: 'pt'
      };
    } catch (error) {
      ultimoErro = error;
      log('warn', `Falha na transcrição com ${tokenInfo.provider}`, {
        error: error.message,
        errorCode: error.code || 'N/A',
        errorString: JSON.stringify(error).substring(0, 200),
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
    const erroString = JSON.stringify(ultimoErro) || '';
    const erroCode = ultimoErro.code || '';
    const fullErrorText = (erroMsg + ' ' + erroString).toLowerCase();
    
    if (erroCode === 'INVALID_TOKEN' || erroCode === 'NO_TOKEN' || erroCode === 'COMPANY_NOT_FOUND') {
      mensagemErro = erroMsg.includes('Token') ? erroMsg : 'Token da API inválido ou expirado. Verifique os tokens configurados em company_tokens.json';
      codigoErro = erroCode;
    } else if (erroMsg.includes('Token da API') || 
        erroMsg.includes('Invalid API key') || 
        erroMsg.includes('401') || 
        erroMsg.includes('API_KEY_INVALID') ||
        erroMsg.includes('API key not valid') ||
        erroMsg.includes('Please pass a valid API key') ||
        fullErrorText.includes('api_key_invalid') ||
        fullErrorText.includes('api key not valid') ||
        fullErrorText.includes('token inválido') ||
        fullErrorText.includes('token expirado')) {
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
    } else if (erroCode === 'FORMAT_NOT_SUPPORTED' || (erroMsg.includes('não suportado') && !erroMsg.includes('Token')) || (erroMsg.includes('not supported') && !erroMsg.includes('token'))) {
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
  buscarTokensEmpresa
};
