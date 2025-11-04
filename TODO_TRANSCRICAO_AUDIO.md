# ��️ TODO - Implementação de Transcrição de Áudio

> **Baseado em:** `docs/TRANSCRICAO_AUDIO_IMPLEMENTACAO.md`  
> **Última atualização:** 2025-11-03

---

## 📊 Status Geral

### ✅ **JÁ IMPLEMENTADO:**
- ✅ Frontend servido corretamente na porta 4201
- ✅ Arquivo `Data/company_tokens.json` existe (com valores de exemplo)
- ✅ Estrutura básica do projeto está pronta

### ❌ **FALTA IMPLEMENTAR:**
- ❌ **Backend:** Todas as funções de transcrição (0% implementado)
- ❌ **Backend:** Endpoint `/api/transcribe`
- ❌ **Frontend:** Todas as funções de transcrição (0% implementado)
- ❌ **Frontend:** Interface de transcrição (botão, loading, exibição)
- ❌ **Testes:** Arquivo de testes automatizados
- ❌ **Dependências:** Pacotes npm necessários

---

## 🎯 Objetivo

Implementar sistema completo de transcrição de áudio que:
- 🎵 Funcione com ambos formatos (WAV e MP3)
- 📅 Detecte automaticamente o formato baseado na data
- 🏢 Suporte múltiplas empresas com tokens diferentes
- 🤖 Permita escolha entre OpenAI e Gemini
- 🔒 Seja seguro (tokens no backend)
- ⚡ Seja eficiente (sem limites de tamanho)
- 🛡️ Tenha tratamento de erros robusto
- ✅ Tenha testes completos

---

## 📝 TODO DETALHADO

### 🔧 BACKEND - Implementação

#### ✅ PASSO 1: Instalar Dependências

**Status:** ✅ **COMPLETO** (Todas as dependências já estão no package.json)

**Localização:** `package.json`

**Dependências encontradas:**
- ✅ `openai`: ^4.20.0 (já existe)
- ✅ `axios`: ^1.6.0 (já existe)
- ✅ `form-data`: ^4.0.0 (já existe)
- ✅ `@google/generative-ai`: ^0.2.1 (já existe)

**Ação:** ✅ Todas as dependências necessárias já estão instaladas no package.json

**Verificar instalação:**
```bash
npm install  # Executar para garantir que estão instaladas no node_modules
```

**Nota:** `form-data` é opcional (apenas para fallback se SDK OpenAI não aceitar Buffer diretamente).

---

#### ✅ PASSO 2: Adicionar Imports no Backend

**Status:** ❌ **NÃO INICIADO**

**Localização:** `backend/webhook-server.js` (topo do arquivo, após outros requires)

**Código a adicionar:**
```javascript
const fs = require('fs');
const https = require('https');
const urlModule = require('url');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
```

**Verificação:**
- [ ] Verificar se `fs`, `https` e `url` já estão importados (podem estar)
- [ ] Adicionar `OpenAI` e `GoogleGenerativeAI`

---

#### ✅ PASSO 3: Função detectarFormatoAudio

**Status:** ❌ **NÃO INICIADO**

**Localização:** `backend/webhook-server.js` (após configurações, antes das rotas)

**Funcionalidade:**
- Recebe `calldate` (opcional) e `codigo` (obrigatório)
- Compara data da gravação com data atual
- Retorna objeto com formato principal e lista de formatos para tentar
- Se não tiver `calldate`, retorna formato mais seguro (MP3)

**Código completo:**
```javascript
/**
 * Detecta formato de áudio baseado na data da gravação
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
```

**Checklist:**
- [ ] Função criada
- [ ] Testada com data de hoje (deve retornar WAV)
- [ ] Testada com data antiga (deve retornar MP3)
- [ ] Testada sem calldate (deve retornar MP3 como padrão)

---

#### ✅ PASSO 4: Função baixarAudio

**Status:** ❌ **NÃO INICIADO**

**Localização:** `backend/webhook-server.js` (após detectarFormatoAudio)

**Funcionalidade:**
- Baixa arquivo de áudio usando `https` nativo
- Timeout configurável (padrão: 30 segundos)
- Retorna Buffer do áudio
- Trata erros de timeout e conexão

**Código completo:**
```javascript
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
```

**Checklist:**
- [ ] Função criada
- [ ] Testada com URL válida
- [ ] Testada com URL inválida (deve retornar erro)
- [ ] Testada com timeout (deve retornar erro após 30s)

---

#### ✅ PASSO 5: Função buscarTokensEmpresa

**Status:** ❌ **NÃO INICIADO**

**Localização:** `backend/webhook-server.js` (após baixarAudio)

**Funcionalidade:**
- Lê `Data/company_tokens.json`
- Busca empresa por código
- Retorna tokens disponíveis e token preferido
- Valida se tokens existem e faz fallback se necessário

**Código completo:**
```javascript
/**
 * Busca tokens de API de uma empresa
 * @param {string} companyCode - Código da empresa
 * @returns {Object} Objeto com empresa, provider e token
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
    
    // Validar se token preferido existe
    const tokenPreferido = empresa[`token_${preferedToken}`];
    if (!tokenPreferido || tokenPreferido === 'xxxxxxxxxxxxxxx' || tokenPreferido === 'seu-token-openai-aqui' || tokenPreferido === 'seu-token-gemini-aqui') {
      // Fallback para outro token disponível
      if (preferedToken === 'openai' && empresa.token_gemini && empresa.token_gemini !== 'xxxxxxxxxxxxxxx' && empresa.token_gemini !== 'seu-token-gemini-aqui') {
        return {
          empresa: empresa.nome,
          provider: 'gemini',
          token: empresa.token_gemini
        };
      } else if (preferedToken === 'gemini' && empresa.token_openai && empresa.token_openai !== 'xxxxxxxxxxxxxxx' && empresa.token_openai !== 'seu-token-openai-aqui') {
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

**Checklist:**
- [ ] Função criada
- [ ] Testada com empresa existente
- [ ] Testada com empresa inexistente (deve retornar erro)
- [ ] Testada com token inválido (deve fazer fallback)
- [ ] Testada sem tokens válidos (deve retornar erro)

---

#### ✅ PASSO 6: Função transcreverComOpenAI

**Status:** ❌ **NÃO INICIADO**

**Localização:** `backend/webhook-server.js` (após buscarTokensEmpresa)

**Funcionalidade:**
- Usa OpenAI Whisper API
- Aceita Buffer diretamente (SDK OpenAI)
- Faz retry até 3 vezes em caso de erro
- Fallback para FormData se necessário

**Código completo:**
```javascript
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
      // A SDK da OpenAI aceita Buffer diretamente em Node.js
      const transcription = await openai.audio.transcriptions.create({
        file: audioBuffer, // Buffer funciona diretamente em Node.js
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
            // Aguardar antes de tentar novamente
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        }
      } else {
        if (attempt < 3) {
          // Aguardar antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
    }
  }
  
  throw lastError;
}
```

**Checklist:**
- [ ] Função criada
- [ ] Testada com áudio WAV válido
- [ ] Testada com áudio MP3 válido
- [ ] Testada com token inválido (deve retornar erro)
- [ ] Testado retry logic (simular erro temporário)

---

#### ✅ PASSO 7: Função transcreverComGemini

**Status:** ❌ **NÃO INICIADO**

**Localização:** `backend/webhook-server.js` (após transcreverComOpenAI)

**⚠️ ATENÇÃO:** Gemini pode não ter suporte direto para transcrição de áudio. Esta implementação é tentativa.

**Funcionalidade:**
- Usa Google Gemini API
- Converte Buffer para Base64
- Faz requisição para API
- Retorna transcrição

**Código completo:**
```javascript
/**
 * Transcreve áudio usando Google Gemini API
 * @param {Buffer} audioBuffer - Buffer do áudio
 * @param {string} token - Token do Gemini
 * @param {string} mimeType - Tipo MIME do áudio (padrão: 'audio/wav')
 * @returns {Promise<string>} Texto transcrito
 * 
 * NOTA: O Gemini pode não ter API direta de transcrição de áudio.
 * Esta é uma implementação tentativa que pode não funcionar.
 */
async function transcreverComGemini(audioBuffer, token, mimeType = 'audio/wav') {
  try {
    const genAI = new GoogleGenerativeAI(token);
    
    // Converter para Base64
    const base64Audio = audioBuffer.toString('base64');
    
    // Tentar usar modelo do Gemini
    // NOTA: Esta implementação pode não funcionar, pois o Gemini pode não ter
    // suporte direto para transcrição de áudio. Pode ser necessário usar
    // Google Cloud Speech-to-Text como alternativa.
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
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
  } catch (error) {
    throw new Error(`Erro ao transcrever com Gemini: ${error.message}. Nota: Gemini pode não suportar transcrição de áudio diretamente.`);
  }
}
```

**Checklist:**
- [ ] Função criada
- [ ] Testada (pode não funcionar)
- [ ] Documentado que pode não funcionar
- [ ] Considerar usar Google Cloud Speech-to-Text como alternativa

---

#### ✅ PASSO 8: Endpoint POST /api/transcribe

**Status:** ❌ **NÃO INICIADO**

**Localização:** `backend/webhook-server.js` (antes do `app.listen`)

**Funcionalidade Completa:**
1. Validar parâmetros de entrada
2. Detectar formato do áudio (WAV/MP3)
3. Tentar baixar áudio (tentar ambos formatos se necessário)
4. Buscar tokens da empresa
5. Chamar função de transcrição apropriada
6. Retornar resultado

**Request Body:**
```json
{
  "audioUrl": "https://delorean.krolik.com.br/records/...",
  "codigo": "...",
  "companyCode": "100",
  "calldate": "2025-11-03 11:38:26"
}
```

**Response Success:**
```json
{
  "success": true,
  "transcription": "Texto transcrito...",
  "model": "whisper-1",
  "provider": "openai",
  "duration": 45.2,
  "language": "pt",
  "requestId": "abc123"
}
```

**Código completo:** (Ver documento completo em `docs/TRANSCRICAO_AUDIO_IMPLEMENTACAO.md` - muito extenso)

**Checklist:**
- [ ] Endpoint criado
- [ ] Validação de parâmetros implementada
- [ ] Detecção de formato implementada
- [ ] Download de áudio com fallback implementado
- [ ] Busca de tokens implementada
- [ ] Chamada de transcrição implementada
- [ ] Retorno de sucesso implementado
- [ ] Tratamento de erros implementado
- [ ] Logs estruturados implementados

---

#### ✅ PASSO 9: CORS para /api/transcribe

**Status:** ❌ **NÃO INICIADO**

**Localização:** `backend/webhook-server.js` (após endpoint POST)

**Código:**
```javascript
// OPTIONS para CORS preflight do endpoint de transcrição
app.options('/api/transcribe', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});
```

**Checklist:**
- [ ] Rota OPTIONS criada
- [ ] Headers CORS configurados corretamente

---

### 🎨 FRONTEND - Implementação

#### ✅ PASSO 10: Propriedades no Construtor

**Status:** ❌ **NÃO INICIADO**

**Localização:** `frontend/ClickCallKrolik.js` (dentro do construtor da classe ClickCallManager)

**Código a adicionar:**
```javascript
// Transcrições de áudio
this.transcriptions = {}; // Armazena transcrições por código de gravação
this.transcribing = {}; // Controla estado de transcrição (loading)
```

**Checklist:**
- [ ] Propriedades adicionadas ao construtor

---

#### ✅ PASSO 11: Função transcreverAudio

**Status:** ❌ **NÃO INICIADO**

**Localização:** `frontend/ClickCallKrolik.js` (após displayGravacoes)

**Funcionalidade:**
- Chama endpoint `/api/transcribe`
- Gerencia estado de loading
- Armazena transcrição
- Exibe resultado ou erro

**Código completo:** (Ver documento completo em `docs/TRANSCRICAO_AUDIO_IMPLEMENTACAO.md`)

**Checklist:**
- [ ] Função criada
- [ ] Chamada ao endpoint implementada
- [ ] Gerenciamento de estado implementado
- [ ] Tratamento de erros implementado

---

#### ✅ PASSO 12: Função transcreverAudioPorButton

**Status:** ❌ **NÃO INICIADO**

**Localização:** `frontend/ClickCallKrolik.js` (após transcreverAudio)

**Funcionalidade:**
- Auxiliar para chamar via botão
- Evita problemas de escape de caracteres
- Extrai dados de `data-attributes`

**Código:**
```javascript
/**
 * Método auxiliar para chamar via button (evita problemas de escape)
 * @param {HTMLElement} buttonElement - Elemento do botão
 */
transcreverAudioPorButton(buttonElement) {
  const codigo = buttonElement.getAttribute('data-codigo');
  const index = parseInt(buttonElement.getAttribute('data-index'));
  const companyId = buttonElement.getAttribute('data-company-id') || '100';
  const calldate = buttonElement.getAttribute('data-calldate') || '';
  
  if (!codigo) {
    alert('❌ Código da gravação não encontrado');
    return;
  }
  
  // Criar objeto gravacao
  const gravacao = {
    codigo: codigo,
    company_id: companyId,
    calldate: calldate,
    url: '' // Será montada automaticamente
  };
  
  this.transcreverAudio(gravacao, index);
}
```

**Checklist:**
- [ ] Função criada
- [ ] Extração de data-attributes implementada

---

#### ✅ PASSO 13: Função mostrarLoadingTranscricao

**Status:** ❌ **NÃO INICIADO**

**Localização:** `frontend/ClickCallKrolik.js` (após transcreverAudioPorButton)

**Funcionalidade:**
- Mostra loading na área de transcrição
- Animação de spinner
- Mensagem informativa

**Código:** (Ver documento completo)

**Checklist:**
- [ ] Função criada
- [ ] UI de loading implementada
- [ ] Animação funcionando

---

#### ✅ PASSO 14: Função exibirTranscricao

**Status:** ❌ **NÃO INICIADO**

**Localização:** `frontend/ClickCallKrolik.js` (após mostrarLoadingTranscricao)

**Funcionalidade:**
- Exibe transcrição formatada
- Mostra provider usado
- Botão para copiar
- Tempo de processamento

**Código:** (Ver documento completo)

**Checklist:**
- [ ] Função criada
- [ ] Formatação implementada
- [ ] Botão de copiar implementado

---

#### ✅ PASSO 15: Função mostrarErroTranscricao

**Status:** ❌ **NÃO INICIADO**

**Localização:** `frontend/ClickCallKrolik.js` (após exibirTranscricao)

**Funcionalidade:**
- Exibe erro formatado
- Botão "Tentar Novamente"
- Mensagem amigável

**Código:** (Ver documento completo)

**Checklist:**
- [ ] Função criada
- [ ] UI de erro implementada
- [ ] Botão de retry implementado

---

#### ✅ PASSO 16: Função global copiarTranscricao

**Status:** ❌ **NÃO INICIADO**

**Localização:** `frontend/ClickCallKrolik.js` (FORA da classe, no final do arquivo)

**Funcionalidade:**
- Copia transcrição para clipboard
- Feedback visual

**Código:** (Ver documento completo)

**Checklist:**
- [ ] Função criada (global)
- [ ] Clipboard API implementada
- [ ] Feedback visual implementado

---

#### ✅ PASSO 17: Atualizar displayGravacoes

**Status:** ❌ **NÃO INICIADO**

**Localização:** `frontend/ClickCallKrolik.js` (dentro do método displayGravacoes)

**Funcionalidade:**
- Adicionar área de transcrição no HTML
- Botão "Transcrever Áudio"
- Condicionais para mostrar loading/transcrição/erro

**Código:** (Ver documento completo - muito extenso)

**Checklist:**
- [ ] HTML da área de transcrição adicionado
- [ ] Botão de transcrever implementado
- [ ] Condicionais para estados implementadas
- [ ] data-attributes corretos nos botões

---

### ✅ TESTES E CONFIGURAÇÃO

#### ✅ PASSO 18: Criar arquivo de testes

**Status:** ❌ **NÃO INICIADO**

**Localização:** `tests/test-transcribe-api.js`

**Funcionalidade:**
- Testes automatizados para endpoint `/api/transcribe`
- Validações de parâmetros
- Testes de detecção de formato
- Testes de CORS

**Código completo:** (Ver documento completo em `docs/TRANSCRICAO_AUDIO_IMPLEMENTACAO.md`)

**Checklist:**
- [ ] Arquivo criado
- [ ] Testes de validação implementados
- [ ] Testes de formato implementados
- [ ] Teste de CORS implementado

---

#### ✅ PASSO 19: Configurar tokens reais

**Status:** ⚠️ **PARCIAL** (arquivo existe com valores de exemplo)

**Localização:** `Data/company_tokens.json`

**Ação:** Substituir valores de exemplo por tokens reais

**Estrutura esperada:**
```json
[
  {
    "cod": "100",
    "nome": "Krolik",
    "token_openai": "sk-real-token-here",
    "token_gemini": "AIzaSy-real-token-here",
    "prefered_token": "openai"
  }
]
```

**Checklist:**
- [ ] Tokens reais da OpenAI adicionados
- [ ] Tokens reais do Gemini adicionados (opcional)
- [ ] prefered_token configurado

---

#### ✅ PASSO 20: Testes manuais

**Status:** ❌ **NÃO INICIADO**

**Checklist:**
- [ ] Servidor rodando em http://localhost:4201
- [ ] Frontend acessível
- [ ] Testar botão "Transcrever Áudio"
- [ ] Verificar loading
- [ ] Verificar transcrição exibida
- [ ] Testar botão "Copiar"
- [ ] Testar "Tentar Novamente" em erro
- [ ] Testar com gravação WAV (hoje)
- [ ] Testar com gravação MP3 (ontem)
- [ ] Verificar logs no backend

---

#### ✅ PASSO 21: Executar testes automatizados

**Status:** ❌ **NÃO INICIADO**

**Comando:**
```bash
node tests/test-transcribe-api.js
```

**Checklist:**
- [ ] Todos os testes passam
- [ ] Erros corrigidos se houver

---

## 📋 Resumo de Status

### Backend (9 passos)
- ✅ PASSO 1: Instalar dependências (COMPLETO)
- ❌ PASSO 2: Adicionar imports
- ❌ PASSO 3: detectarFormatoAudio
- ❌ PASSO 4: baixarAudio
- ❌ PASSO 5: buscarTokensEmpresa
- ❌ PASSO 6: transcreverComOpenAI
- ❌ PASSO 7: transcreverComGemini
- ❌ PASSO 8: Endpoint POST /api/transcribe
- ❌ PASSO 9: CORS

### Frontend (8 passos)
- ❌ PASSO 10: Propriedades no construtor
- ❌ PASSO 11: transcreverAudio
- ❌ PASSO 12: transcreverAudioPorButton
- ❌ PASSO 13: mostrarLoadingTranscricao
- ❌ PASSO 14: exibirTranscricao
- ❌ PASSO 15: mostrarErroTranscricao
- ❌ PASSO 16: copiarTranscricao (global)
- ❌ PASSO 17: Atualizar displayGravacoes

### Testes e Configuração (4 passos)
- ❌ PASSO 18: Criar arquivo de testes
- ⚠️ PASSO 19: Configurar tokens (arquivo existe, precisa de tokens reais)
- ❌ PASSO 20: Testes manuais
- ❌ PASSO 21: Executar testes automatizados

**Total:** 1 de 21 passos completos (~5%)  
**Progresso:** 🟩🟥🟥🟥🟥 ~5%

---

## 🚀 Ordem Recomendada de Implementação

### Fase 1: Backend (Fundação)
1. ✅ PASSO 1: Instalar dependências
2. ✅ PASSO 2: Adicionar imports
3. ✅ PASSO 3: detectarFormatoAudio
4. ✅ PASSO 4: baixarAudio
5. ✅ PASSO 5: buscarTokensEmpresa
6. ✅ PASSO 6: transcreverComOpenAI
7. ✅ PASSO 7: transcreverComGemini (ou pular se não funcionar)
8. ✅ PASSO 8: Endpoint POST /api/transcribe
9. ✅ PASSO 9: CORS

### Fase 2: Frontend (Interface)
10. ✅ PASSO 10: Propriedades no construtor
11. ✅ PASSO 11: transcreverAudio
12. ✅ PASSO 12: transcreverAudioPorButton
13. ✅ PASSO 13: mostrarLoadingTranscricao
14. ✅ PASSO 14: exibirTranscricao
15. ✅ PASSO 15: mostrarErroTranscricao
16. ✅ PASSO 16: copiarTranscricao (global)
17. ✅ PASSO 17: Atualizar displayGravacoes

### Fase 3: Testes e Validação
18. ✅ PASSO 18: Criar arquivo de testes
19. ✅ PASSO 19: Configurar tokens reais
20. ✅ PASSO 20: Testes manuais
21. ✅ PASSO 21: Executar testes automatizados

---

## ⚠️ Observações Importantes

1. **Gemini pode não funcionar:** O Gemini (Google Generative AI) pode não ter suporte direto para transcrição de áudio. Se não funcionar, focar apenas em OpenAI.

2. **Tokens reais necessários:** O `company_tokens.json` precisa ter tokens reais da OpenAI/Gemini para funcionar.

3. **Dependências:** Certifique-se de instalar todas as dependências antes de começar.

4. **Docker:** Após implementar, pode ser necessário reconstruir o container Docker.

5. **Testes:** Os testes automatizados requerem servidor rodando.

---

## 📚 Referências

- **Documento completo:** `docs/TRANSCRICAO_AUDIO_IMPLEMENTACAO.md`
- **Arquivo de tokens:** `Data/company_tokens.json`
- **Backend:** `backend/webhook-server.js`
- **Frontend:** `frontend/ClickCallKrolik.js`

---

**Última atualização:** 2025-11-03  
**Próximo passo:** Começar pela Fase 1 (Backend) - PASSO 1
