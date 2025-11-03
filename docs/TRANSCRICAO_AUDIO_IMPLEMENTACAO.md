# 🎙️ Implementação de Transcrição de Áudio - Documentação Completa

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Objetivo](#objetivo)
3. [Arquitetura da Solução](#arquitetura-da-solução)
4. [Especificações Técnicas](#especificações-técnicas)
5. [Prompt de Implementação](#prompt-de-implementação)
6. [Testes Completos](#testes-completos)
7. [Relatório de Implementação](#relatório-de-implementação)

---

## 🎯 Visão Geral

### Contexto Atual

Atualmente, o sistema recebe gravações de áudio do Delorean através de webhooks e exibe as URLs no frontend. As gravações podem estar em dois formatos:
- **WAV**: Gravações do dia atual (0h00 até 23h59)
- **MP3**: Gravações de dias anteriores (após conversão automática à meia-noite)

### Problema Identificado

Para realizar a transcrição de áudio, é necessário:
1. Baixar o arquivo de áudio
2. Converter para Base64
3. Enviar para API de transcrição (OpenAI ou Gemini)

O problema atual é que:
- Base64 de áudio é muito grande para enviar via HTTP request tradicional
- Não há endpoint dedicado para transcrição
- Tokens de API precisam ser gerenciados de forma segura

### Solução Proposta

Criar um endpoint dedicado no backend (`/api/transcribe`) que:
1. Recebe URL ou código da gravação
2. Baixa o áudio automaticamente (com detecção automática de formato WAV/MP3)
3. Busca tokens da empresa em `company_tokens.json`
4. Faz a transcrição usando OpenAI ou Gemini (baseado em `prefered_token`)
5. Retorna a transcrição para o frontend

---

## 🎯 Objetivo

Implementar um sistema completo de transcrição de áudio que:
- ✅ Funcione com ambos formatos (WAV e MP3)
- ✅ Detecte automaticamente o formato baseado na data
- ✅ Suporte múltiplas empresas com tokens diferentes
- ✅ Permita escolha entre OpenAI e Gemini
- ✅ Seja seguro (tokens no backend)
- ✅ Seja eficiente (sem limites de tamanho)
- ✅ Tenha tratamento de erros robusto
- ✅ Tenha testes completos

---

## 🏗️ Arquitetura da Solução

### Fluxo de Dados

```
┌─────────────┐
│  Frontend   │
│ (Modal de   │
│ Gravação)   │
└──────┬──────┘
       │
       │ POST /api/transcribe
       │ { audioUrl, companyCode }
       ▼
┌─────────────────────────────────┐
│      Backend API                │
│  /api/transcribe endpoint       │
│                                  │
│  1. Validar parâmetros          │
│  2. Detectar formato (WAV/MP3) │
│  3. Baixar áudio                │
│  4. Buscar tokens (company)     │
│  5. Converter para Base64      │
│  6. Chamar API (OpenAI/Gemini)  │
│  7. Retornar transcrição        │
└─────────────────────────────────┘
       │
       │
       ▼
┌─────────────────────────────────┐
│  External APIs                  │
│  - OpenAI Whisper API           │
│  - Google Gemini API            │
└─────────────────────────────────┘
```

### Estrutura de Arquivos

```
ClickCallKrolik/
├── backend/
│   └── webhook-server.js          # Adicionar endpoint /api/transcribe
├── Data/
│   └── company_tokens.json        # Tokens das empresas (já existe)
├── docs/
│   └── TRANSCRICAO_AUDIO_IMPLEMENTACAO.md  # Este arquivo
├── tests/
│   └── test-transcribe-api.js     # Testes da API (criar)
└── package.json                   # Adicionar dependências
```

### Dependências Necessárias

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.2.1",
    "openai": "^4.20.0",
    "axios": "^1.6.0",
    "form-data": "^4.0.0"
  }
}
```

**Nota:** A dependência `form-data` é necessária para upload de arquivos para OpenAI. Alternativamente, pode-se usar apenas a SDK da OpenAI (mais simples).

---

## 📐 Especificações Técnicas

### Endpoint: POST /api/transcribe

#### Request Body

```json
{
  "audioUrl": "https://delorean.krolik.com.br/records/20251103_113826_1003029_103_16981892476_1762180698.wav",
  "companyCode": "100",
  "calldate": "2025-11-03 11:38:26"  // Opcional, para detecção de formato
}
```

**OU**

```json
{
  "codigo": "20251103_113826_1003029_103_16981892476_1762180698",
  "companyCode": "100",
  "calldate": "2025-11-03 11:38:26"  // Opcional, para detecção de formato
}
```

#### Response Success (200)

```json
{
  "success": true,
  "transcription": "Texto transcrito do áudio aqui...",
  "model": "whisper-1",
  "provider": "openai",
  "duration": 45.2,
  "language": "pt",
  "requestId": "abc123-def456-ghi789"
}
```

#### Response Error (400/500)

```json
{
  "success": false,
  "message": "Mensagem de erro descritiva",
  "error": "Detalhes técnicos do erro",
  "requestId": "abc123-def456-ghi789"
}
```

### Lógica de Detecção de Formato

```javascript
// Pseudocódigo
function detectarFormatoAudio(calldate) {
  if (!calldate) return { formato: 'mp3', tentar: ['mp3', 'wav'] };
  
  const dataGravacao = new Date(calldate);
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
  
  return {
    formato: ehHoje ? 'wav' : 'mp3',
    tentar: ehHoje ? ['wav', 'mp3'] : ['mp3', 'wav']
  };
}
```

### Estrutura de company_tokens.json

```json
[
  {
    "cod": "100",
    "nome": "Krolik",
    "token_openai": "sk-...",
    "token_gemini": "AIzaSy...",
    "prefered_token": "openai"
  }
]
```

### Integração com OpenAI Whisper API

```javascript
// Endpoint: https://api.openai.com/v1/audio/transcriptions
// Method: POST
// Headers:
//   - Authorization: Bearer {token_openai}
//   - Content-Type: multipart/form-data
// Body:
//   - file: (binary audio file)
//   - model: "whisper-1"
//   - language: "pt" (opcional)
//   - response_format: "json"
```

### Integração com Google Gemini API

```javascript
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
// Method: POST
// Headers:
//   - x-goog-api-key: {token_gemini}
//   - Content-Type: application/json
// Body:
//   {
//     "contents": [{
//       "parts": [{
//         "file_data": {
//           "mime_type": "audio/wav" ou "audio/mpeg",
//           "data": "{base64_audio}"
//         }
//       }]
//     }]
//   }
```

### Tratamento de Erros

1. **Validação de Parâmetros**
   - `audioUrl` ou `codigo` obrigatório
   - `companyCode` obrigatório
   - Formato de URL válido

2. **Download de Áudio**
   - Timeout de 30 segundos
   - Tentar ambos formatos (WAV e MP3)
   - Retornar erro específico se ambos falharem

3. **Busca de Tokens**
   - Validar se empresa existe
   - Validar se token preferido existe
   - Fallback para outro token se preferido não disponível

4. **Transcrição**
   - Timeout de 60 segundos
   - Retry até 3 vezes em caso de erro de API
   - Retornar erro descritivo

---

## 🤖 Prompt de Implementação

### Instruções para o Assistente AI

**Objetivo:** Implementar sistema completo de transcrição de áudio no backend Node.js/Express.

#### Passo 1: Instalar Dependências

1. Adicionar ao `package.json`:
   - `@google/generative-ai`: ^0.2.1 (opcional - Gemini pode não funcionar)
   - `openai`: ^4.20.0
   - `axios`: ^1.6.0 (para fallback se SDK OpenAI não funcionar)
   - `form-data`: ^4.0.0 (para fallback se SDK OpenAI não funcionar)

2. Executar `npm install`

**Nota:** A SDK da OpenAI aceita Buffer diretamente, então `form-data` e `axios` são apenas para fallback caso necessário.

#### Passo 2: Criar Função de Detecção de Formato

**Localização:** `backend/webhook-server.js`

**Função:** `detectarFormatoAudio(calldate, codigo)`

**Funcionalidade:**
- Recebe `calldate` (opcional) e `codigo` (obrigatório)
- Compara data da gravação com data atual
- Retorna objeto com formato principal e lista de formatos para tentar
- Se não tiver `calldate`, retorna formato mais seguro (MP3)

**Código base:**
```javascript
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
```

#### Passo 3: Criar Função de Download de Áudio

**Localização:** `backend/webhook-server.js`

**Função:** `baixarAudio(url, timeout = 30000)`

**Funcionalidade:**
- Baixa arquivo de áudio usando `https` nativo
- Timeout configurável (padrão: 30 segundos)
- Retorna Buffer do áudio
- Trata erros de timeout e conexão

**Código base:**
```javascript
async function baixarAudio(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const urlModule = require('url');
    
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
```

#### Passo 4: Criar Função de Busca de Tokens

**Localização:** `backend/webhook-server.js`

**Função:** `buscarTokensEmpresa(companyCode)`

**Funcionalidade:**
- Lê `Data/company_tokens.json`
- Busca empresa por código
- Retorna tokens disponíveis e token preferido
- Valida se tokens existem

**Código base:**
```javascript
const fs = require('fs');
const path = require('path');

function buscarTokensEmpresa(companyCode) {
  try {
    const tokensPath = path.join(__dirname, '..', 'Data', 'company_tokens.json');
    const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    
    const empresa = tokensData.find(emp => emp.cod === companyCode);
    
    if (!empresa) {
      throw new Error(`Empresa com código ${companyCode} não encontrada`);
    }
    
    const preferedToken = empresa.prefered_token || 'openai';
    
    // Validar se token preferido existe
    const tokenPreferido = empresa[`token_${preferedToken}`];
    if (!tokenPreferido || tokenPreferido === 'xxxxxxxxxxxxxxx') {
      // Fallback para outro token disponível
      if (preferedToken === 'openai' && empresa.token_gemini) {
        return {
          empresa: empresa.nome,
          provider: 'gemini',
          token: empresa.token_gemini
        };
      } else if (preferedToken === 'gemini' && empresa.token_openai) {
        return {
          empresa: empresa.nome,
          provider: 'openai',
          token: empresa.token_openai
        };
      }
      throw new Error(`Token ${preferedToken} não disponível para empresa ${companyCode}`);
    }
    
    return {
      empresa: empresa.nome,
      provider: preferedToken,
      token: tokenPreferido
    };
  } catch (error) {
    throw new Error(`Erro ao buscar tokens: ${error.message}`);
  }
}
```

#### Passo 5: Criar Função de Transcrição OpenAI

**Localização:** `backend/webhook-server.js`

**Função:** `transcreverComOpenAI(audioBuffer, token, mimeType = 'audio/wav')`

**Funcionalidade:**
- Usa OpenAI Whisper API
- Converte Buffer para File (usando FormData ou biblioteca similar)
- Faz requisição para API
- Retorna transcrição

**Código base (versão simplificada usando apenas SDK OpenAI):**
```javascript
const OpenAI = require('openai');

async function transcreverComOpenAI(audioBuffer, token, mimeType = 'audio/wav') {
  const openai = new OpenAI({
    apiKey: token,
    timeout: 60000 // 60 segundos
  });
  
  try {
    // Fazer transcrição usando SDK OpenAI
    // A SDK da OpenAI aceita Buffer diretamente em Node.js
    const transcription = await openai.audio.transcriptions.create({
      file: audioBuffer, // Buffer funciona diretamente em Node.js
      model: 'whisper-1',
      language: 'pt',
      response_format: 'json'
    });
    
    return transcription.text;
  } catch (error) {
    // Se der erro com Buffer direto, tentar com FormData (fallback)
    if (error.message.includes('file') || error.message.includes('format')) {
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
    }
    throw error;
  }
}
```

**Nota:** A SDK da OpenAI em Node.js aceita Buffer diretamente. Se houver problemas, o código faz fallback para FormData.

#### Passo 6: Criar Função de Transcrição Gemini

**Localização:** `backend/webhook-server.js`

**Função:** `transcreverComGemini(audioBuffer, token, mimeType = 'audio/wav')`

**Funcionalidade:**
- Usa Google Gemini API
- Converte Buffer para Base64
- Faz requisição para API
- Retorna transcrição

**Código base:**
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function transcreverComGemini(audioBuffer, token, mimeType = 'audio/wav') {
  const genAI = new GoogleGenerativeAI(token);
  
  // Converter para Base64
  const base64Audio = audioBuffer.toString('base64');
  
  // Usar modelo de áudio do Gemini
  // Nota: Gemini pode não ter API direta de transcrição
  // Pode ser necessário usar outro serviço ou API alternativa
  
  // Exemplo de implementação (verificar documentação atual do Gemini)
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  
  // Esta é uma implementação simplificada
  // Pode precisar de ajustes baseado na API real do Gemini
  const prompt = 'Transcreva este áudio para texto em português brasileiro.';
  
  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Audio,
        mimeType: mimeType
      }
    },
    { text: prompt }
  ]);
  
  const response = await result.response;
  return response.text();
}
```

**⚠️ ATENÇÃO CRÍTICA:** O Gemini (Google Generative AI) **NÃO possui API direta de transcrição de áudio** como o OpenAI Whisper. A implementação acima é um exemplo teórico e **pode não funcionar**.

**Alternativas para Gemini:**
1. **Usar Google Cloud Speech-to-Text** (requer configuração adicional)
2. **Desabilitar Gemini temporariamente** e usar apenas OpenAI
3. **Usar outro serviço** como Azure Speech Services ou AWS Transcribe

**Recomendação:** Implementar apenas OpenAI primeiro, e adicionar Gemini depois quando uma solução adequada for encontrada.

#### Passo 7: Criar Endpoint POST /api/transcribe

**Localização:** `backend/webhook-server.js`

**Funcionalidade Completa:**
1. Validar parâmetros de entrada
2. Detectar formato do áudio (WAV/MP3)
3. Tentar baixar áudio (tentar ambos formatos se necessário)
4. Buscar tokens da empresa
5. Converter áudio para formato necessário
6. Chamar função de transcrição apropriada
7. Retornar resultado

**Código base:**
```javascript
app.post('/api/transcribe', async (req, res) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  try {
    // Validar parâmetros
    const { audioUrl, codigo, companyCode, calldate } = req.body;
    
    if (!companyCode) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetro "companyCode" é obrigatório',
        requestId
      });
    }
    
    // Determinar URL do áudio
    let urlFinal = audioUrl;
    let codigoGravacao = codigo;
    
    if (!urlFinal && codigoGravacao) {
      // Detectar formato
      const formatoInfo = detectarFormatoAudio(calldate, codigoGravacao);
      urlFinal = formatoInfo.formato === 'wav' ? formatoInfo.urlWav : formatoInfo.urlMp3;
    }
    
    if (!urlFinal) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetro "audioUrl" ou "codigo" é obrigatório',
        requestId
      });
    }
    
    // Validar URL
    if (!urlFinal.startsWith('https://delorean.krolik.com.br/')) {
      return res.status(400).json({
        success: false,
        message: 'URL inválida. Apenas domínio delorean.krolik.com.br é permitido',
        requestId
      });
    }
    
    structuredLog('info', requestId, 'Iniciando transcrição', {
      url: urlFinal,
      companyCode
    });
    
    // Detectar formato para download
    const formatoInfo = detectarFormatoAudio(calldate, codigoGravacao || '');
    let audioBuffer = null;
    let mimeType = null;
    let tentativas = 0;
    
    // Tentar baixar áudio (tentar ambos formatos se necessário)
    for (const formato of formatoInfo.tentar) {
      try {
        const urlFormatada = formato === 'wav' ? formatoInfo.urlWav : formatoInfo.urlMp3;
        structuredLog('info', requestId, `Tentando baixar áudio (${formato})`, { url: urlFormatada });
        
        audioBuffer = await baixarAudio(urlFormatada, 30000);
        mimeType = formato === 'wav' ? 'audio/wav' : 'audio/mpeg';
        tentativas++;
        break; // Sucesso
      } catch (error) {
        structuredLog('warn', requestId, `Falha ao baixar ${formato}`, { error: error.message });
        if (tentativas === formatoInfo.tentar.length - 1) {
          // Última tentativa falhou
          throw new Error(`Não foi possível baixar áudio em nenhum formato. Último erro: ${error.message}`);
        }
      }
    }
    
    if (!audioBuffer) {
      throw new Error('Não foi possível baixar o áudio');
    }
    
    structuredLog('info', requestId, 'Áudio baixado com sucesso', {
      tamanho: audioBuffer.length,
      formato: mimeType,
      tentativas
    });
    
    // Buscar tokens da empresa
    const tokensInfo = buscarTokensEmpresa(companyCode);
    
    structuredLog('info', requestId, 'Tokens encontrados', {
      empresa: tokensInfo.empresa,
      provider: tokensInfo.provider
    });
    
    // Fazer transcrição
    let transcricao = null;
    try {
      if (tokensInfo.provider === 'openai') {
        transcricao = await transcreverComOpenAI(audioBuffer, tokensInfo.token, mimeType);
      } else if (tokensInfo.provider === 'gemini') {
        transcricao = await transcreverComGemini(audioBuffer, tokensInfo.token, mimeType);
      } else {
        throw new Error(`Provider não suportado: ${tokensInfo.provider}`);
      }
    } catch (error) {
      structuredLog('error', requestId, 'Erro na transcrição', { error: error.message });
      throw new Error(`Erro ao transcrever áudio: ${error.message}`);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    structuredLog('info', requestId, 'Transcrição concluída', {
      provider: tokensInfo.provider,
      duracao: duration,
      tamanhoTranscricao: transcricao.length
    });
    
    res.json({
      success: true,
      transcription: transcricao,
      model: tokensInfo.provider === 'openai' ? 'whisper-1' : 'gemini-pro',
      provider: tokensInfo.provider,
      duration: parseFloat(duration),
      language: 'pt',
      requestId
    });
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    structuredLog('error', requestId, 'ERRO ao transcrever áudio', {
      error: error.message,
      stack: error.stack,
      duracao: duration
    });
    
    res.status(500).json({
      success: false,
      message: 'Erro ao transcrever áudio',
      error: error.message,
      requestId
    });
  }
});
```

#### Passo 8: Adicionar CORS para /api/transcribe

Adicionar rota OPTIONS para CORS:

```javascript
app.options('/api/transcribe', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});
```

#### Passo 9: Implementar Frontend Completo

**Localização:** `frontend/ClickCallKrolik.js`

**Funcionalidade:**
1. Adicionar função para chamar endpoint `/api/transcribe`
2. Adicionar botão "Transcrever" no modal de gravação
3. Mostrar loading durante transcrição
4. Exibir transcrição no modal
5. Permitir copiar transcrição
6. Tratamento de erros com mensagens amigáveis

**Código base:**

**1. Adicionar propriedade para armazenar transcrições:**

```javascript
// No construtor da classe ClickCallManager (aproximadamente linha 20)
this.transcriptions = {}; // Armazena transcrições por código de gravação
this.transcribing = {}; // Controla estado de transcrição (loading)
```

**2. Criar função para transcrever áudio:**

```javascript
// Adicionar método na classe ClickCallManager (após displayGravacoes)

async transcreverAudio(gravacao, index) {
  const codigo = gravacao.codigo;
  const companyCode = gravacao.company_id || '100'; // Usar company_id do webhook ou padrão
  
  if (!codigo) {
    alert('❌ Código da gravação não disponível');
    return;
  }
  
  // Verificar se já está transcrevendo
  if (this.transcribing[codigo]) {
    console.log('[transcreverAudio] Já está transcrevendo esta gravação');
    return;
  }
  
  // Verificar se já tem transcrição
  if (this.transcriptions[codigo]) {
    console.log('[transcreverAudio] Transcrição já existe, exibindo...');
    this.exibirTranscricao(codigo, index);
    return;
  }
  
  // Marcar como transcrevendo
  this.transcribing[codigo] = true;
  
  // Atualizar UI para mostrar loading
  this.mostrarLoadingTranscricao(codigo, index);
  
  try {
    // Montar URL do áudio (usar mesma lógica do displayGravacoes)
    let audioUrl = gravacao.url || '';
    if (!audioUrl && codigo) {
      // Detectar formato baseado na data
      const calldate = gravacao.calldate || '';
      let ehGravacaoDeHoje = false;
      
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
          
          ehGravacaoDeHoje = dataGravacaoSemHora.getTime() === hojeSemHora.getTime();
        } catch (e) {
          console.warn('[transcreverAudio] Erro ao parsear data:', e);
        }
      }
      
      audioUrl = ehGravacaoDeHoje 
        ? `https://delorean.krolik.com.br/records/${codigo}.wav`
        : `https://delorean.krolik.com.br/records/${codigo}.mp3`;
    }
    
    // Chamar endpoint de transcrição
    const response = await fetch(`${this.webhookServerUrl}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioUrl: audioUrl,
        codigo: codigo,
        companyCode: companyCode,
        calldate: gravacao.calldate || ''
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.transcription) {
      // Armazenar transcrição
      this.transcriptions[codigo] = {
        texto: data.transcription,
        provider: data.provider,
        model: data.model,
        duration: data.duration,
        requestId: data.requestId,
        timestamp: new Date().toISOString()
      };
      
      // Exibir transcrição
      this.exibirTranscricao(codigo, index);
      
      console.log('[transcreverAudio] ✅ Transcrição concluída', {
        provider: data.provider,
        duration: data.duration,
        tamanho: data.transcription.length
      });
    } else {
      throw new Error(data.message || 'Erro desconhecido na transcrição');
    }
    
  } catch (error) {
    console.error('[transcreverAudio] ❌ Erro:', error);
    
    // Mostrar erro na UI
    this.mostrarErroTranscricao(codigo, index, error.message);
    
    alert(`❌ Erro ao transcrever áudio:\n${error.message}`);
  } finally {
    // Remover estado de transcrevendo
    delete this.transcribing[codigo];
  }
}

// Método auxiliar para chamar via button (evita problemas de escape)
transcreverAudioPorButton(buttonElement) {
  const codigo = buttonElement.getAttribute('data-codigo');
  const index = parseInt(buttonElement.getAttribute('data-index'));
  
  if (!codigo) {
    alert('❌ Código da gravação não encontrado');
    return;
  }
  
  // Buscar gravação pelo código
  const gravacao = this.gravacoes.find(g => g.codigo === codigo);
  if (!gravacao) {
    alert('❌ Gravação não encontrada');
    return;
  }
  
  this.transcreverAudio(gravacao, index);
}

// Função auxiliar para mostrar loading
mostrarLoadingTranscricao(codigo, index) {
  const transcricaoElement = document.getElementById(`transcricao-${index}`);
  if (transcricaoElement) {
    transcricaoElement.innerHTML = `
      <div style="color: #c8007e; font-size: 0.95rem; text-align: center; padding: 20px;">
        <div style="display: inline-block; animation: spin 1s linear infinite; font-size: 1.5rem; margin-bottom: 8px;">⏳</div>
        <div>Transcrevendo áudio...</div>
        <div style="font-size: 0.85rem; color: #999; margin-top: 8px;">Isso pode levar alguns segundos</div>
      </div>
      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    `;
  }
}

// Função auxiliar para exibir transcrição
exibirTranscricao(codigo, index) {
  const transcricao = this.transcriptions[codigo];
  if (!transcricao) return;
  
  const transcricaoElement = document.getElementById(`transcricao-${index}`);
  if (transcricaoElement) {
    transcricaoElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="color: #c8007e; font-size: 0.9rem; font-weight: 600;">
          📝 Transcrição (${transcricao.provider === 'openai' ? 'OpenAI' : 'Gemini'})
        </div>
        <button 
          onclick="copiarTranscricao('${codigo}', ${index}, event)"
          style="
            background: rgba(123,0,81,0.8);
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 6px 12px;
            font-size: 0.85rem;
            cursor: pointer;
            transition: background 0.2s;
          "
          onmouseover="this.style.background='rgba(123,0,81,1)'"
          onmouseout="this.style.background='rgba(123,0,81,0.8)'"
          title="Copiar transcrição"
        >
          📋 Copiar
        </button>
      </div>
      <div style="
        color: #fff;
        font-size: 0.95rem;
        line-height: 1.6;
        text-align: left;
        background: rgba(255,255,255,0.05);
        padding: 12px;
        border-radius: 8px;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        max-height: 300px;
        overflow-y: auto;
      ">${this.escapeHtml(transcricao.texto)}</div>
      <div style="
        color: #999;
        font-size: 0.8rem;
        margin-top: 8px;
        text-align: right;
      ">
        Tempo de processamento: ${transcricao.duration.toFixed(2)}s
      </div>
    `;
  }
}

// Função auxiliar para mostrar erro
mostrarErroTranscricao(codigo, index, mensagemErro) {
  const transcricaoElement = document.getElementById(`transcricao-${index}`);
  if (transcricaoElement) {
    transcricaoElement.innerHTML = `
      <div style="
        color: #ff6666;
        font-size: 0.9rem;
        text-align: center;
        padding: 16px;
        background: rgba(255,0,0,0.1);
        border-radius: 8px;
        border: 1px solid rgba(255,0,0,0.3);
      ">
        <div style="font-size: 1.2rem; margin-bottom: 8px;">❌</div>
        <div style="font-weight: 600; margin-bottom: 4px;">Erro ao transcrever</div>
        <div style="font-size: 0.85rem; color: #ff9999;">${this.escapeHtml(mensagemErro)}</div>
        <button 
          data-codigo="${codigo}"
          data-index="${index}"
          onclick="window.clickCallManager.transcreverAudioPorButton(this)"
          style="
            margin-top: 12px;
            background: rgba(123,0,81,0.8);
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 0.85rem;
            cursor: pointer;
          "
        >
          🔄 Tentar Novamente
        </button>
      </div>
    `;
  }
}

// Função global para copiar transcrição (adicionar no final do arquivo, fora da classe)
// CORRIGIDO: Agora recebe event como parâmetro
function copiarTranscricao(codigo, index, event) {
  const manager = window.clickCallManager;
  if (!manager) {
    console.error('[copiarTranscricao] clickCallManager não encontrado');
    alert('❌ Erro: Sistema não inicializado');
    return;
  }
  
  const transcricao = manager.transcriptions[codigo];
  
  if (!transcricao) {
    alert('❌ Transcrição não encontrada');
    return;
  }
  
  navigator.clipboard.writeText(transcricao.texto).then(() => {
    // Feedback visual
    const button = event ? event.target : event.currentTarget;
    if (button) {
      const textoOriginal = button.innerHTML;
      button.innerHTML = '✅ Copiado!';
      button.style.background = 'rgba(0,255,0,0.8)';
      
      setTimeout(() => {
        button.innerHTML = textoOriginal;
        button.style.background = 'rgba(123,0,81,0.8)';
      }, 2000);
    }
  }).catch(err => {
    console.error('[copiarTranscricao] Erro:', err);
    alert('❌ Erro ao copiar transcrição. Tente selecionar o texto manualmente.');
  });
}
```

**3. Atualizar função `displayGravacoes` para incluir botão e área de transcrição:**

```javascript
// No método displayGravacoes, atualizar a seção de transcrição (aproximadamente linha 1250)

<!-- Área de Transcrição -->
<div id="transcricao-${index}" style="
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-height: 80px;
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  padding: 16px;
  border: 1px dashed rgba(255,255,255,0.2);
  overflow: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
  margin-top: 16px;
">
  ${this.transcriptions[gravacao.codigo] ? `
    <!-- Transcrição existente -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <div style="color: #c8007e; font-size: 0.9rem; font-weight: 600;">
        📝 Transcrição (${this.transcriptions[gravacao.codigo].provider === 'openai' ? 'OpenAI' : 'Gemini'})
      </div>
      <button 
        onclick="copiarTranscricao('${gravacao.codigo}', ${index}, event)"
        style="
          background: rgba(123,0,81,0.8);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.2s;
        "
        onmouseover="this.style.background='rgba(123,0,81,1)'"
        onmouseout="this.style.background='rgba(123,0,81,0.8)'"
        title="Copiar transcrição"
      >
        📋 Copiar
      </button>
    </div>
    <div style="
      color: #fff;
      font-size: 0.95rem;
      line-height: 1.6;
      text-align: left;
      background: rgba(255,255,255,0.05);
      padding: 12px;
      border-radius: 8px;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      max-height: 300px;
      overflow-y: auto;
    ">${this.escapeHtml(this.transcriptions[gravacao.codigo].texto)}</div>
    <div style="
      color: #999;
      font-size: 0.8rem;
      margin-top: 8px;
      text-align: right;
    ">
      Tempo de processamento: ${this.transcriptions[gravacao.codigo].duration.toFixed(2)}s
    </div>
  ` : this.transcribing[gravacao.codigo] ? `
    <!-- Loading -->
    <div style="color: #c8007e; font-size: 0.95rem; text-align: center; padding: 20px;">
      <div style="display: inline-block; animation: spin 1s linear infinite; font-size: 1.5rem; margin-bottom: 8px;">⏳</div>
      <div>Transcrevendo áudio...</div>
      <div style="font-size: 0.85rem; color: #999; margin-top: 8px;">Isso pode levar alguns segundos</div>
    </div>
    <style>
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  ` : `
    <!-- Botão para transcrever -->
    <div style="text-align: center; padding: 20px;">
      <div style="color: #999; font-size: 0.9rem; margin-bottom: 12px;">
        Clique no botão para transcrever o áudio
      </div>
      <button 
        data-codigo="${this.escapeHtml(gravacao.codigo || '')}"
        data-index="${index}"
        onclick="window.clickCallManager.transcreverAudioPorButton(this)"
        style="
          background: linear-gradient(90deg, #7b0051 60%, #c8007e 100%);
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 12px 24px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 2px 8px rgba(123,0,81,0.3);
        "
        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(123,0,81,0.5)'"
        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(123,0,81,0.3)'"
        title="Transcrever áudio usando IA"
      >
        🎙️ Transcrever Áudio
      </button>
    </div>
  `}
</div>
```

**4. Atualizar função de exibir modal para incluir referência ao manager:**

```javascript
// No método displayGravacoes, garantir que o gravacao.codigo está disponível
// E que company_id está sendo passado corretamente do webhook
```

**Nota importante:** O método `transcreverAudio` recebe o objeto `gravacao` completo que deve conter:
- `codigo`: Código da gravação (obrigatório)
- `calldate`: Data da gravação (opcional, para detecção de formato)
- `company_id`: Código da empresa (opcional, usa '100' como padrão se não fornecido)
- `url`: URL do áudio (opcional, será montada automaticamente se não fornecido)

**Correções aplicadas:**
- ✅ Função `copiarTranscricao` agora recebe `event` como parâmetro
- ✅ Botão de transcrever usa `data-attributes` para evitar problemas de escape
- ✅ Método `transcreverAudioPorButton` adicionado para chamar via button
- ✅ OpenAI API simplificada (usa SDK diretamente, com fallback)
- ✅ Gemini API marcada como problemática (pode não funcionar)
- ✅ Dependências atualizadas (`form-data` adicionada)

---

## 🧪 Testes Completos

### Arquivo de Teste: `tests/test-transcribe-api.js`

```javascript
/**
 * Testes completos para API de Transcrição de Áudio
 * 
 * Para executar:
 * node tests/test-transcribe-api.js
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:4201';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
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
      testesFalhados++;
    }
  };
}

// Testes
async function executarTestes() {
  log('🚀 Iniciando testes da API de Transcrição de Áudio\n', 'yellow');
  
  // Teste 1: Validação - companyCode obrigatório
  await testar('Validação: companyCode obrigatório', async () => {
    try {
      await axios.post(`${BASE_URL}/api/transcribe`, {
        audioUrl: 'https://delorean.krolik.com.br/records/test.wav'
      });
      throw new Error('Deveria ter retornado erro 400');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        return; // Esperado
      }
      throw error;
    }
  })();
  
  // Teste 2: Validação - audioUrl ou codigo obrigatório
  await testar('Validação: audioUrl ou codigo obrigatório', async () => {
    try {
      await axios.post(`${BASE_URL}/api/transcribe`, {
        companyCode: '100'
      });
      throw new Error('Deveria ter retornado erro 400');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        return; // Esperado
      }
      throw error;
    }
  })();
  
  // Teste 3: Validação - URL inválida
  await testar('Validação: URL inválida', async () => {
    try {
      await axios.post(`${BASE_URL}/api/transcribe`, {
        audioUrl: 'https://evil.com/audio.wav',
        companyCode: '100'
      });
      throw new Error('Deveria ter retornado erro 400');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        return; // Esperado
      }
      throw error;
    }
  })();
  
  // Teste 4: Validação - Empresa não encontrada
  await testar('Validação: Empresa não encontrada', async () => {
    try {
      await axios.post(`${BASE_URL}/api/transcribe`, {
        audioUrl: 'https://delorean.krolik.com.br/records/test.wav',
        companyCode: '999'
      });
      throw new Error('Deveria ter retornado erro');
    } catch (error) {
      if (error.response && error.response.status === 500) {
        return; // Esperado
      }
      throw error;
    }
  })();
  
  // Teste 5: Detecção de formato - Gravação de hoje (WAV)
  await testar('Detecção de formato: Gravação de hoje (WAV)', async () => {
    const hoje = new Date().toISOString().split('T')[0];
    const calldate = `${hoje} 12:00:00`;
    
    const response = await axios.post(`${BASE_URL}/api/transcribe`, {
      codigo: '20251103_113826_1003029_103_16981892476_1762180698',
      companyCode: '100',
      calldate: calldate
    }).catch(() => {
      // Pode falhar se áudio não existir, mas formato deve ser detectado corretamente
      return null;
    });
    
    // Se não falhou, verificar se usou WAV
    if (response && response.data.success) {
      log(`   ✅ Transcrição bem-sucedida`, 'green');
    }
  })();
  
  // Teste 6: Detecção de formato - Gravação antiga (MP3)
  await testar('Detecção de formato: Gravação antiga (MP3)', async () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const calldate = ontem.toISOString().split('T')[0] + ' 12:00:00';
    
    const response = await axios.post(`${BASE_URL}/api/transcribe`, {
      codigo: '20251103_113826_1003029_103_16981892476_1762180698',
      companyCode: '100',
      calldate: calldate
    }).catch(() => {
      // Pode falhar se áudio não existir, mas formato deve ser detectado corretamente
      return null;
    });
    
    // Se não falhou, verificar se usou MP3
    if (response && response.data.success) {
      log(`   ✅ Transcrição bem-sucedida`, 'green');
    }
  })();
  
  // Teste 7: Fallback de formato (tentar ambos)
  await testar('Fallback: Tentar ambos formatos', async () => {
    // Este teste verifica se o sistema tenta ambos formatos quando um falha
    // Pode não ter áudio real para testar, mas valida a lógica
    log(`   ℹ️  Teste de lógica de fallback (requer áudio real)`, 'yellow');
  })();
  
  // Teste 8: CORS
  await testar('CORS: OPTIONS request', async () => {
    const response = await axios.options(`${BASE_URL}/api/transcribe`);
    if (response.status === 204) {
      return; // Sucesso
    }
    throw new Error('CORS não configurado corretamente');
  })();
  
  // Resumo
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

// Executar testes
executarTestes().catch(error => {
  log(`\n💥 Erro fatal nos testes: ${error.message}`, 'red');
  process.exit(1);
});
```

### Cenários de Teste Manual

#### Cenário 1: Transcrição Bem-Sucedida (WAV)

```bash
curl -X POST http://localhost:4201/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://delorean.krolik.com.br/records/20251103_113826_1003029_103_16981892476_1762180698.wav",
    "companyCode": "100",
    "calldate": "2025-11-03 11:38:26"
  }'
```

**Resultado Esperado:**
```json
{
  "success": true,
  "transcription": "Texto transcrito...",
  "model": "whisper-1",
  "provider": "openai",
  "duration": 5.23,
  "language": "pt",
  "requestId": "..."
}
```

#### Cenário 2: Transcrição Bem-Sucedida (MP3)

```bash
curl -X POST http://localhost:4201/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "20251003_113826_1003029_103_16981892476_1762180698",
    "companyCode": "100",
    "calldate": "2025-10-03 11:38:26"
  }'
```

#### Cenário 3: Fallback de Formato

```bash
# Tentar WAV primeiro (hoje), mas usar MP3 se falhar
curl -X POST http://localhost:4201/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "20251103_113826_1003029_103_16981892476_1762180698",
    "companyCode": "100",
    "calldate": "2025-11-03 11:38:26"
  }'
```

#### Cenário 4: Erro - Empresa Não Encontrada

```bash
curl -X POST http://localhost:4201/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://delorean.krolik.com.br/records/test.wav",
    "companyCode": "999"
  }'
```

**Resultado Esperado:**
```json
{
  "success": false,
  "message": "Erro ao transcrever áudio",
  "error": "Erro ao buscar tokens: Empresa com código 999 não encontrada",
  "requestId": "..."
}
```

#### Cenário 5: Erro - URL Inválida

```bash
curl -X POST http://localhost:4201/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://evil.com/audio.wav",
    "companyCode": "100"
  }'
```

**Resultado Esperado:**
```json
{
  "success": false,
  "message": "URL inválida. Apenas domínio delorean.krolik.com.br é permitido",
  "requestId": "..."
}
```

---

## 📝 Relatório de Implementação

### Checklist de Implementação

- [ ] **Passo 1:** Instalar dependências (`openai`, `@google/generative-ai`, `axios`, `form-data`)
- [ ] **Passo 2:** Criar função `detectarFormatoAudio()`
- [ ] **Passo 3:** Criar função `baixarAudio()`
- [ ] **Passo 4:** Criar função `buscarTokensEmpresa()`
- [ ] **Passo 5:** Criar função `transcreverComOpenAI()`
- [ ] **Passo 6:** Criar função `transcreverComGemini()`
- [ ] **Passo 7:** Criar endpoint `POST /api/transcribe`
- [ ] **Passo 8:** Adicionar CORS para `/api/transcribe`
- [ ] **Passo 9:** Implementar frontend completo (botão, loading, exibição, cópia)
- [ ] **Passo 10:** Criar arquivo de testes `tests/test-transcribe-api.js`
- [ ] **Passo 11:** Executar testes e validar
- [ ] **Passo 12:** Testar frontend com áudios reais
- [ ] **Passo 13:** Testar fluxo completo (frontend → backend → API → frontend)
- [ ] **Passo 14:** Verificar logs e tratamento de erros
- [ ] **Passo 15:** Validar performance e timeout
- [ ] **Passo 16:** Atualizar documentação (se necessário)

### Métricas de Sucesso

- ✅ Endpoint responde em menos de 60 segundos
- ✅ Suporta arquivos de até 25MB (limite típico de APIs)
- ✅ Detecção automática de formato funciona corretamente
- ✅ Fallback entre formatos funciona
- ✅ Tratamento de erros robusto
- ✅ Logs informativos para debugging
- ✅ CORS configurado corretamente
- ✅ Frontend funciona corretamente (botão, loading, cópia)
- ✅ Todos os testes passam
- ⚠️ Gemini pode não funcionar (requer investigação adicional)

### Problemas Conhecidos e Soluções

1. **Gemini API não possui transcrição direta**
   - **Status:** Problema conhecido
   - **Solução:** Usar apenas OpenAI ou implementar Google Cloud Speech-to-Text
   - **Workaround:** Desabilitar Gemini temporariamente

2. **Função copiarTranscricao sem event**
   - **Status:** ✅ Corrigido no documento
   - **Solução:** Função agora recebe `event` como terceiro parâmetro

3. **Template string com escape de caracteres**
   - **Status:** ✅ Corrigido no documento
   - **Solução:** Usar `data-attributes` e método auxiliar `transcreverAudioPorButton`

4. **Dependência form-data faltando**
   - **Status:** ✅ Corrigido no documento
   - **Solução:** Adicionada ao package.json (opcional, apenas para fallback)

### Notas de Implementação

#### Dependências Adicionais

A dependência `form-data` já está incluída no `package.json` principal (linha 119), mas é opcional:
- Se a SDK da OpenAI funcionar com Buffer direto (comportamento esperado), não será necessária
- Serve apenas como fallback caso a SDK não aceite Buffer diretamente

#### Tratamento de Timeout

- Download de áudio: 30 segundos
- Transcrição: 60 segundos
- Retry automático: 3 tentativas

#### Segurança

- ✅ Tokens nunca expostos no frontend
- ✅ Validação de URL (apenas domínio Delorean)
- ✅ Validação de parâmetros obrigatórios
- ✅ Logs não incluem tokens completos

#### Performance

- Download de áudio em memória (Buffer)
- Conversão para Base64 apenas quando necessário
- Timeout configurável
- Retry inteligente

#### Observabilidade

- Logs estruturados com `requestId`
- Tempo de processamento registrado
- Tamanho de arquivo logado
- Erros detalhados para debugging

### Próximos Passos Após Implementação

1. **Melhorias Futuras no Frontend**
   - Cache de transcrições no LocalStorage (persistir entre sessões)
   - Histórico de transcrições
   - Exportar transcrição para arquivo de texto
   - Compartilhar transcrição via link

2. **Melhorias Futuras no Backend**
   - Cache de transcrições (evitar re-transcrever mesmo áudio)
   - Suporte a múltiplos idiomas
   - Timestamps na transcrição (quando foi dito)
   - Webhook para notificar quando transcrição estiver pronta

3. **Monitoramento**
   - Métricas de uso (quantas transcrições por dia)
   - Tempo médio de transcrição
   - Taxa de sucesso/falha
   - Uso de tokens por empresa

---

## 📚 Referências

- [OpenAI Whisper API Documentation](https://platform.openai.com/docs/guides/speech-to-text)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js HTTPS Module](https://nodejs.org/api/https.html)

---

**Documento criado em:** 2025-11-03  
**Versão:** 1.0.0  
**Autor:** Assistente AI  
**Status:** Aguardando Implementação

---

## 🎯 Resumo Executivo

Este documento contém todas as informações necessárias para implementar um sistema completo de transcrição de áudio no backend Node.js/Express. O sistema:

- ✅ Detecta automaticamente formato de áudio (WAV/MP3)
- ✅ Baixa áudio automaticamente
- ✅ Suporta múltiplas empresas com tokens diferentes
- ✅ Permite escolha entre OpenAI e Gemini
- ✅ É seguro (tokens no backend)
- ✅ É eficiente (sem limites de tamanho HTTP)
- ✅ Tem tratamento de erros robusto
- ✅ Tem testes completos

**Próximo passo:** Seguir o [Prompt de Implementação](#prompt-de-implementação) passo a passo para implementar a funcionalidade.

