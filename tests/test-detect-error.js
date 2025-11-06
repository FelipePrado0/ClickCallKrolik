const https = require('https');
const urlModule = require('url');

const urlWavErro = 'https://delorean.krolik.com.br/records/20251105_110609_1003029_103_16981892476_1762351556.wav';

console.log('🔍 Testando detecção de erro na página HTML...\n');
console.log('URL WAV (com erro):', urlWavErro);
console.log('─'.repeat(80));

function baixarAudioTeste(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new urlModule.URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      console.log('\n📥 Headers recebidos:');
      console.log('Status Code:', res.statusCode);
      console.log('Content-Type:', res.headers['content-type'] || 'N/A');
      console.log('Content-Length:', res.headers['content-length'] || 'N/A');
      console.log('─'.repeat(80));

      const contentType = res.headers['content-type'] || '';
      const isHtmlError = contentType.includes('text/html') && !contentType.includes('audio');

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        console.log('\n📦 Buffer recebido:');
        console.log('Tamanho:', buffer.length, 'bytes');
        console.log('─'.repeat(80));
        
        const textoCompleto = buffer.toString('utf8');
        console.log('\n📄 Conteúdo completo (primeiros 500 caracteres):');
        console.log(textoCompleto.substring(0, 500));
        console.log('─'.repeat(80));
        
        const textoLower = textoCompleto.toLowerCase();
        const temErrorHandler = textoLower.includes('error in exception handler');
        const temError = textoLower.includes('error');
        const tem404 = textoCompleto.includes('404');
        const temNotFound = textoCompleto.includes('Not Found');
        
        console.log('\n🔎 Verificações:');
        console.log('Tem "error in exception handler":', temErrorHandler);
        console.log('Tem "error":', temError);
        console.log('Tem "404":', tem404);
        console.log('Tem "Not Found":', temNotFound);
        console.log('Content-Type é HTML:', isHtmlError);
        console.log('Buffer < 1000 bytes:', buffer.length < 1000);
        console.log('─'.repeat(80));
        
        let motivoRejeicao = null;
        
        if (buffer.length < 1000) {
          if (temErrorHandler) {
            motivoRejeicao = 'Pequeno + "Error in exception handler"';
          } else if (temError) {
            motivoRejeicao = 'Pequeno + "error"';
          } else if (tem404) {
            motivoRejeicao = 'Pequeno + "404"';
          } else if (temNotFound) {
            motivoRejeicao = 'Pequeno + "Not Found"';
          } else if (isHtmlError) {
            motivoRejeicao = 'Pequeno + Content-Type HTML';
          }
        } else {
          if (temErrorHandler) {
            motivoRejeicao = 'Grande + "Error in exception handler"';
          } else if (isHtmlError && temError) {
            motivoRejeicao = 'Grande + HTML + "error"';
          }
        }
        
        if (motivoRejeicao) {
          console.log('\n❌ ERRO DETECTADO:', motivoRejeicao);
          console.log('─'.repeat(80));
          reject(new Error(`Servidor retornou página de erro: ${textoCompleto.trim().substring(0, 100)}`));
        } else {
          console.log('\n✅ Nenhum erro detectado - Buffer aceito');
          console.log('─'.repeat(80));
          resolve(buffer);
        }
      });
    });

    req.on('error', (error) => {
      console.log('\n❌ Erro na requisição:', error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.log('\n⏱️ Timeout na requisição');
      req.destroy();
      reject(new Error('Timeout ao baixar áudio'));
    });

    req.end();
  });
}

async function testar() {
  try {
    console.log('🚀 Iniciando teste...\n');
    await baixarAudioTeste(urlWavErro);
    console.log('\n✅ Teste passou (não deveria passar!)');
  } catch (error) {
    console.log('\n❌ Teste falhou (esperado!):', error.message);
    console.log('\n✅ A função detectou o erro corretamente!');
  }
}

testar();

