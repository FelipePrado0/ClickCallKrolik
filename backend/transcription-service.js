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
 * @param {string} companyCode - Código da empresa (opcional, necessário para MP3)
 * @returns {Object} Objeto com formato principal, lista de formatos e URLs
 */
function detectarFormatoAudio(calldate, codigo, companyCode = '') {
  let formatoPrincipal = 'wav';
  let formatosParaTentar = ['wav', 'mp3'];
  let ehHoje = false;

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

      ehHoje = dataGravacaoSemHora.getTime() === hojeSemHora.getTime();

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

  const urlWav = `https://delorean.krolik.com.br/records/${codigo}.wav`;
  
  let urlMp3 = `https://delorean.krolik.com.br/records/${codigo}.mp3`;
  
  if (!ehHoje && calldate && companyCode) {
    try {
      const calldateStr = calldate.replace(/\+/g, ' ').replace(/%3A/g, ':');
      const dataGravacao = new Date(calldateStr);
      const ano = dataGravacao.getFullYear();
      const mes = String(dataGravacao.getMonth() + 1).padStart(2, '0');
      const dia = String(dataGravacao.getDate()).padStart(2, '0');
      const dataFormatada = `${ano}-${mes}-${dia}`;
      urlMp3 = `https://delorean.krolik.com.br/records/${dataFormatada}/${companyCode}/${codigo}.mp3`;
    } catch (e) {
      console.warn('[detectarFormatoAudio] Erro ao formatar data para URL MP3:', e);
    }
  }

  return {
    formato: formatoPrincipal,
    tentar: formatosParaTentar,
    urlWav: urlWav,
    urlMp3: urlMp3
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

      const contentType = res.headers['content-type'] || '';
      const isHtmlError = contentType.includes('text/html') && !contentType.includes('audio');

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        if (isHtmlError || buffer.length < 1000) {
          const tamanhoVerificacao = Math.min(500, buffer.length);
          const errorText = buffer.toString('utf8', 0, tamanhoVerificacao);
          const errorTextLower = errorText.toLowerCase();
          
          if (errorTextLower.includes('error in exception handler')) {
            return reject(new Error(`Servidor retornou página de erro: Error in exception handler`));
          }
          
          if (isHtmlError && (errorTextLower.includes('error') || errorText.includes('404') || errorText.includes('Not Found'))) {
            return reject(new Error(`Servidor retornou página de erro HTML: ${errorText.trim().substring(0, 100)}`));
          }
          
          if (buffer.length < 1000 && (errorTextLower.includes('error') || errorText.includes('404') || errorText.includes('Not Found'))) {
            return reject(new Error(`Servidor retornou resposta inválida: ${errorText.trim().substring(0, 100)}`));
          }
        }
        
        resolve(buffer);
      });
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
    const formatoInfo = detectarFormatoAudio(calldate, codigoGravacao, companyCode);
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

  let audioBuffer = null;
  let mimeType = null;
  let urlAudioReal = null;
  let tentativas = 0;

  // Se a URL fornecida contém .mp3 ou .wav, usar diretamente sem tentar detectar formato
  const urlFornecida = audioUrl || '';
  const temMp3 = urlFornecida.includes('.mp3');
  const temWav = urlFornecida.includes('.wav');
  
  log('info', 'Verificando URL fornecida', { urlFornecida, temMp3, temWav, audioUrl });
  
  if (urlFornecida && (temMp3 || temWav)) {
    urlFinal = urlFornecida;
    
    if (urlFornecida.includes('.mp3')) {
      log('info', 'URL MP3 fornecida diretamente, usando URL fornecida', { url: urlFinal });
      try {
        audioBuffer = await baixarAudio(urlFinal, 30000);
        mimeType = 'audio/mpeg';
        urlAudioReal = urlFinal;
        tentativas = 1;
      } catch (error) {
        log('warn', `Falha ao baixar MP3 da URL fornecida`, { error: error.message });
        throw new Error(`Não foi possível baixar áudio da URL fornecida: ${error.message}`);
      }
    } else if (urlFornecida.includes('.wav')) {
      log('info', 'URL WAV fornecida diretamente, tentando baixar', { url: urlFinal });
      try {
        audioBuffer = await baixarAudio(urlFinal, 30000);
        
        const audioText = audioBuffer.toString('utf8', 0, Math.min(100, audioBuffer.length));
        const isErrorPage = audioText.includes('Error in exception handler') || 
                           audioText.includes('error') || 
                           audioText.includes('Error') ||
                           audioText.includes('404') ||
                           audioText.includes('Not Found');
        
        if (audioBuffer.length < 1000 || isErrorPage) {
          const motivo = isErrorPage ? 'página de erro do servidor' : `muito pequeno (${audioBuffer.length} bytes)`;
          log('warn', `WAV inválido: ${motivo}. Tentando MP3 como fallback...`);
          audioBuffer = null;
          throw new Error(`WAV inválido: ${motivo}`);
        }
        
        mimeType = 'audio/wav';
        urlAudioReal = urlFinal;
        tentativas = 1;
      } catch (error) {
        log('warn', `Falha ao baixar WAV da URL fornecida`, { error: error.message });
        
        if (codigoGravacao && calldate && companyCode) {
          log('info', 'Tentando construir e baixar URL MP3 como fallback');
          try {
            const formatoInfo = detectarFormatoAudio(calldate, codigoGravacao, companyCode);
            const urlMp3Fallback = formatoInfo.urlMp3;
            log('info', `Tentando baixar MP3 como fallback`, { url: urlMp3Fallback });
            
            audioBuffer = await baixarAudio(urlMp3Fallback, 30000);
            
            const audioTextMp3 = audioBuffer.toString('utf8', 0, Math.min(100, audioBuffer.length));
            const isErrorPageMp3 = audioTextMp3.includes('Error in exception handler') || 
                                  audioTextMp3.includes('error') || 
                                  audioTextMp3.includes('Error') ||
                                  audioTextMp3.includes('404') ||
                                  audioTextMp3.includes('Not Found');
            
            if (audioBuffer.length < 1000 || isErrorPageMp3) {
              throw new Error('MP3 também inválido ou erro do servidor');
            }
            
            mimeType = 'audio/mpeg';
            urlAudioReal = urlMp3Fallback;
            tentativas = 2;
            log('info', 'MP3 baixado com sucesso como fallback do WAV');
          } catch (mp3Error) {
            log('warn', `Falha ao baixar MP3 como fallback`, { error: mp3Error.message });
            throw new Error(`Não foi possível baixar áudio em nenhum formato. WAV: ${error.message}, MP3: ${mp3Error.message}`);
          }
        } else {
          throw new Error(`Não foi possível baixar áudio da URL fornecida: ${error.message}`);
        }
      }
    }
  } else {
    const formatoInfo = detectarFormatoAudio(calldate, codigoGravacao || '', companyCode);
    let tentativas = 0;

    for (const formato of formatoInfo.tentar) {
      try {
        const urlFormatada = formato === 'wav' ? formatoInfo.urlWav : formatoInfo.urlMp3;
        log('info', `Tentando baixar áudio (${formato})`, { url: urlFormatada });

        audioBuffer = await baixarAudio(urlFormatada, 30000);
        
        if (formato === 'wav') {
          const audioText = audioBuffer.toString('utf8', 0, Math.min(100, audioBuffer.length));
          const isErrorPage = audioText.includes('Error in exception handler') || 
                             audioText.includes('error') || 
                             audioText.includes('Error') ||
                             audioText.includes('404') ||
                             audioText.includes('Not Found');
          
          if (audioBuffer.length < 1000 || isErrorPage) {
            const motivo = isErrorPage ? 'página de erro do servidor' : `muito pequeno (${audioBuffer.length} bytes)`;
            log('warn', `WAV inválido: ${motivo}. Tentando próximo formato...`);
            audioBuffer = null;
            throw new Error(`WAV inválido: ${motivo}`);
          }
        }
        
        mimeType = formato === 'wav' ? 'audio/wav' : 'audio/mpeg';
        urlAudioReal = urlFormatada;
        tentativas++;
        
        break;
      } catch (error) {
        log('warn', `Falha ao baixar ${formato}`, { error: error.message });
        if (tentativas === formatoInfo.tentar.length - 1) {
          throw new Error(`Não foi possível baixar áudio em nenhum formato. Último erro: ${error.message}`);
        }
      }
    }
  }

  if (!audioBuffer) {
    throw new Error('Não foi possível baixar o áudio');
  }

  if (!urlAudioReal) {
    urlAudioReal = urlFinal;
  }

  log('info', 'Áudio baixado com sucesso', {
    tamanho: audioBuffer.length,
    tamanhoKB: (audioBuffer.length / 1024).toFixed(2),
    formato: mimeType,
    tentativas,
    urlUsada: urlAudioReal
  });
  
  const audioText = audioBuffer.toString('utf8', 0, Math.min(100, audioBuffer.length));
  const isErrorPage = audioText.includes('Error in exception handler') || 
                     audioText.includes('error') || 
                     audioText.includes('Error') ||
                     audioText.includes('404') ||
                     audioText.includes('Not Found');
  
  if (audioBuffer.length < 1000 || isErrorPage) {
    const motivo = isErrorPage ? 'página de erro do servidor' : `muito pequeno (${audioBuffer.length} bytes)`;
    log('warn', `Áudio inválido: ${motivo}`, {
      tamanho: audioBuffer.length,
      preview: audioText.substring(0, 50)
    });
    
    if (mimeType === 'audio/wav' && codigoGravacao && calldate && companyCode && !urlFornecida.includes('.mp3')) {
      log('info', 'WAV inválido detectado após download. Tentando MP3 como fallback...');
      try {
        const formatoInfo = detectarFormatoAudio(calldate, codigoGravacao, companyCode);
        const urlMp3Fallback = formatoInfo.urlMp3;
        log('info', `Tentando baixar MP3 como fallback`, { url: urlMp3Fallback });
        
        const audioBufferMp3 = await baixarAudio(urlMp3Fallback, 30000);
        const audioTextMp3 = audioBufferMp3.toString('utf8', 0, Math.min(100, audioBufferMp3.length));
        const isErrorPageMp3 = audioTextMp3.includes('Error in exception handler') || 
                              audioTextMp3.includes('error') || 
                              audioTextMp3.includes('Error') ||
                              audioTextMp3.includes('404') ||
                              audioTextMp3.includes('Not Found');
        
        if (audioBufferMp3.length >= 1000 && !isErrorPageMp3) {
          audioBuffer = audioBufferMp3;
          mimeType = 'audio/mpeg';
          urlAudioReal = urlMp3Fallback;
          log('info', 'MP3 baixado com sucesso como fallback do WAV inválido');
        } else {
          log('warn', 'MP3 também inválido, mantendo WAV original');
        }
      } catch (mp3Error) {
        log('warn', `Falha ao baixar MP3 como fallback`, { error: mp3Error.message });
        log('warn', 'Continuando com WAV inválido (pode não funcionar corretamente)');
      }
    }
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
        
        log('info', `Transcrição Gemini recebida`, {
          tamanhoTexto: transcricaoTexto ? transcricaoTexto.length : 0,
          modelo: modeloUsado
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
