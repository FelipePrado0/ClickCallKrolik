const OpenAI = require('openai');

/**
 * Transcreve áudio usando OpenAI Whisper API
 * @param {Buffer} audioBuffer - Buffer do áudio
 * @param {string} token - Token da OpenAI
 * @param {string} mimeType - Tipo MIME do áudio (padrão: 'audio/wav')
 * @returns {Promise<string>} Texto transcrito
 */
async function transcreverComOpenAI(audioBuffer, token, mimeType = 'audio/wav') {
  const isMp3 = mimeType.includes('mp3') || mimeType.includes('mpeg');
  
  if (isMp3) {
    const FormData = require('form-data');
    const axios = require('axios');

    const form = new FormData();
    form.append('file', audioBuffer, {
      filename: 'audio.mp3',
      contentType: mimeType
    });
    form.append('model', 'whisper-1');
    form.append('language', 'pt');
    form.append('response_format', 'json');

    try {
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
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  const openai = new OpenAI({
    apiKey: token,
    timeout: 60000
  });

  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: audioBuffer,
        model: 'whisper-1',
        language: 'pt',
        response_format: 'json'
      });

      return transcription.text;
    } catch (error) {
      lastError = error;

      if (attempt === 1 && (error.message.includes('file') || error.message.includes('format') || error.message.includes('multipart'))) {
        try {
          const FormData = require('form-data');
          const axios = require('axios');

          const form = new FormData();
          const extensao = mimeType.includes('mp3') || mimeType.includes('mpeg') ? 'mp3' : 'wav';
          const filename = `audio.${extensao}`;
          
          form.append('file', audioBuffer, {
            filename: filename,
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

module.exports = {
  transcreverComOpenAI
};



