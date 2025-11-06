const OpenAI = require('openai');

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

module.exports = {
  transcreverComOpenAI
};



