const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

/**
 * Detecta o MIME type do áudio baseado na URL ou extensão
 * @param {string} audioUrl - URL do áudio (opcional)
 * @param {string} mimeType - MIME type atual (fallback)
 * @returns {string} MIME type detectado
 */
function detectarMimeTypeGemini(audioUrl = '', mimeType = 'audio/wav') {
  if (audioUrl) {
    const ext = path.extname(audioUrl).toLowerCase();
    
    if (ext === '.mp3') return 'audio/mp3';
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.ogg') return 'audio/ogg';
    if (ext === '.m4a') return 'audio/m4a';
  }
  
  if (mimeType === 'audio/mpeg') return 'audio/mp3';
  if (mimeType === 'audio/wav') return 'audio/wav';
  if (mimeType === 'audio/ogg') return 'audio/ogg';
  if (mimeType === 'audio/m4a') return 'audio/m4a';
  
  return mimeType || 'audio/wav';
}

/**
 * Transcreve áudio usando Google Gemini API
 * Envia a URL do áudio diretamente ao Gemini em vez de Base64 (mais eficiente para arquivos grandes)
 * @param {Buffer} audioBuffer - Buffer do áudio (mantido para compatibilidade, mas não usado)
 * @param {string} token - Token da Gemini
 * @param {string} mimeType - Tipo MIME do áudio (padrão: 'audio/wav')
 * @param {string} audioUrl - URL do áudio (OBRIGATÓRIA - deve ser acessível publicamente)
 * @returns {Promise<Object>} Objeto com {texto: string, modelo: string}
 */
async function transcreverComGemini(audioBuffer, token, mimeType = 'audio/wav', audioUrl = '') {
  const genAI = new GoogleGenerativeAI(token);
  
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Buffer de áudio vazio ou inválido');
  }
  
  const audioSizeKB = (audioBuffer.length / 1024).toFixed(2);
  const audioSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`[transcreverComGemini] Áudio recebido: ${audioSizeKB} KB (${audioSizeMB} MB), MIME type original: ${mimeType}`);
  
  if (audioBuffer.length > 20 * 1024 * 1024) {
    console.warn(`[transcreverComGemini] AVISO: Áudio muito grande (${audioSizeMB} MB), pode causar problemas na transcrição`);
  }
  
  const base64Audio = audioBuffer.toString('base64');
  const base64SizeKB = (base64Audio.length / 1024).toFixed(2);
  console.log(`[transcreverComGemini] Base64 criado: ${base64SizeKB} KB`);
  
  const geminiMimeType = detectarMimeTypeGemini(audioUrl, mimeType);
  console.log(`[transcreverComGemini] Enviando para Gemini - MIME type: ${geminiMimeType}, URL: ${audioUrl || 'não fornecida'}`);
  
  const prompt = "Transcreva este áudio de ligação telefônica palavra por palavra, exatamente como foi falado. Mantenha a transcrição fiel ao conteúdo original, incluindo pausas, hesitações e todas as palavras pronunciadas. Não adicione informações que não estão no áudio. Retorne apenas o texto transcrito.";
  
  let ultimoErro = null;
  const modelos = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  let modeloUsado = null;
  
  for (const modeloNome of modelos) {
    try {
      const model = genAI.getGenerativeModel({ model: modeloNome });
      
      console.log(`[transcreverComGemini] Tentando modelo: ${modeloNome}`);
      
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
      modeloUsado = modeloNome;
      
      return {
        texto: texto.trim(),
        modelo: modeloUsado
      };
    } catch (error) {
      ultimoErro = error;
      
      const errorMsg = error.message || '';
      const errorString = JSON.stringify(error) || '';
      const fullErrorText = (errorMsg + ' ' + errorString).toLowerCase();
      
      if (errorMsg.includes('404') || errorMsg.includes('not found') || fullErrorText.includes('not found')) {
        if (modeloNome === modelos[modelos.length - 1]) {
          throw new Error(`Modelos gemini-2.5-flash-lite e gemini-2.5-flash não disponíveis para sua chave ou região`);
        }
        continue;
      }
      
      const errorMsgLower = errorMsg.toLowerCase();
      const errorStringLower = errorString.toLowerCase();
      const fullErrorTextLower = fullErrorText.toLowerCase();
      
      if (errorMsgLower.includes('api key not valid') || 
          errorMsgLower.includes('api_key_invalid') || 
          errorMsgLower.includes('invalid api key') ||
          errorMsgLower.includes('please pass a valid api key') ||
          fullErrorTextLower.includes('api_key_invalid') ||
          fullErrorTextLower.includes('api key not valid') ||
          errorStringLower.includes('api_key_invalid') ||
          errorStringLower.includes('"reason":"api_key_invalid"')) {
        const tokenError = new Error('Token da API Gemini inválido ou expirado. Configure um token válido no company_tokens.json');
        tokenError.code = 'INVALID_TOKEN';
        throw tokenError;
      }
      
      throw error;
    }
  }
  
  let mensagemErro = ultimoErro ? ultimoErro.message : 'Erro desconhecido';
  let codigoErro = 'TRANSCRIBE_ERROR';
  
  if (!ultimoErro) {
    throw new Error('Erro desconhecido na transcrição com Gemini');
  }
  
  const errorMsg = ultimoErro.message || '';
  const errorString = JSON.stringify(ultimoErro) || '';
  const errorStack = ultimoErro.stack || '';
  
  const fullErrorText = (errorMsg + ' ' + errorString + ' ' + errorStack).toLowerCase();
  
  if (errorMsg.includes('API_KEY_INVALID') || 
      errorMsg.includes('401') || 
      errorString.includes('401') || 
      errorMsg.includes('Invalid API key') ||
      errorMsg.includes('API key not valid') ||
      errorMsg.includes('Please pass a valid API key') ||
      fullErrorText.includes('api_key_invalid') ||
      fullErrorText.includes('api key not valid')) {
    mensagemErro = 'Token da API Gemini inválido ou expirado. Configure um token válido no company_tokens.json';
    codigoErro = 'INVALID_TOKEN';
  } else if (errorMsg.includes('403') || errorString.includes('403')) {
    mensagemErro = 'Acesso negado à API Gemini. Verifique as permissões do token.';
    codigoErro = 'ACCESS_DENIED';
  } else if (errorMsg.includes('429') || errorString.includes('429')) {
    mensagemErro = 'Limite de requisições da API Gemini atingido. Aguarde alguns minutos.';
    codigoErro = 'RATE_LIMIT';
  } else if (errorMsg.includes('INVALID_ARGUMENT') && (errorMsg.includes('audio') || errorMsg.includes('mime') || errorMsg.includes('format'))) {
    mensagemErro = 'Formato de áudio não suportado pela API Gemini. Tente usar OpenAI.';
    codigoErro = 'FORMAT_NOT_SUPPORTED';
  } else if (errorMsg.includes('not supported') && (errorMsg.includes('audio') || errorMsg.includes('mime') || errorMsg.includes('format'))) {
    mensagemErro = 'Formato de áudio não suportado pela API Gemini. Tente usar OpenAI.';
    codigoErro = 'FORMAT_NOT_SUPPORTED';
  } else {
    mensagemErro = `Erro na transcrição com Gemini: ${errorMsg}`;
  }
  
  const erroFinal = new Error(mensagemErro);
  erroFinal.code = codigoErro;
  throw erroFinal;
}

module.exports = {
  transcreverComGemini
};

