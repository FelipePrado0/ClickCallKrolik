/**
 * Webhook Server - Backend para receber webhooks do Delorean
 * e repassar para o frontend e n8n com retry, validações e observabilidade
 * 
 * Para executar:
 * npm install express cors dotenv
 * node webhook-server.js
 * 
 * O servidor ficará rodando em http://localhost:3000 (ou porta do .env)
 * Configure o webhook do Delorean para: http://seu-servidor:PORTA/webhook/delorean
 */

require('dotenv').config(); // Carrega variáveis do .env

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4201;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n-production-44e4.up.railway.app/webhook/6183dae4-72ae-4054-a430-451cae84d355';

// Configurações de segurança e validação
const WHITELIST_IPS = (process.env.WHITELIST_IPS || '').split(',').filter(ip => ip.trim());
const MAX_BODY_SIZE = parseInt(process.env.MAX_BODY_SIZE || '100000', 10); // 100KB padrão
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10); // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10); // 100 req/min
const MAX_AUDIT_EVENTS = parseInt(process.env.MAX_AUDIT_EVENTS || '100', 10); // Últimos 100 eventos
const N8N_RETRY_MAX_ATTEMPTS = parseInt(process.env.N8N_RETRY_MAX_ATTEMPTS || '3', 10);
const N8N_RETRY_BACKOFF_BASE = parseInt(process.env.N8N_RETRY_BACKOFF_BASE || '1000', 10); // 1 segundo base

// Rate limiting: armazena requisições por IP
const rateLimitStore = new Map();

// Fila de retry para n8n (in-memory)
const retryQueue = [];

// Auditoria: últimos N eventos
const auditLog = [];

// Middleware
// Permitir CORS para desenvolvimento (permite localhost em qualquer porta)
app.use(cors({
  origin: function(origin, callback) {
    // Permitir requisições sem origem (ex: Postman, Mobile apps) ou de localhost em qualquer porta
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin === FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Middleware para limitar tamanho do body
app.use(express.text({ 
  type: '*/*',
  limit: MAX_BODY_SIZE 
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: MAX_BODY_SIZE 
}));
app.use(express.json({ 
  limit: MAX_BODY_SIZE 
}));

// Servir arquivos estáticos do frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Rota para servir o index.html na raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

/**
 * Rate Limiting - Limita requisições por IP
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }
  
  const requests = rateLimitStore.get(ip);
  // Remove requisições fora da janela
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit excedido
  }
  
  recentRequests.push(now);
  rateLimitStore.set(ip, recentRequests);
  
  // Limpeza periódica (remove IPs sem atividade há mais de 5 minutos)
  if (Math.random() < 0.01) { // ~1% das requisições fazem limpeza
    for (const [key, timestamps] of rateLimitStore.entries()) {
      const oldest = Math.min(...timestamps);
      if (now - oldest > 300000) { // 5 minutos
        rateLimitStore.delete(key);
      }
    }
  }
  
  return true; // OK
}

/**
 * Validação de IP Whitelist
 */
function isIPAllowed(ip) {
  if (WHITELIST_IPS.length === 0) {
    return true; // Se não houver whitelist configurada, permite todos
  }
  
  // Remove porta se houver (ex: "192.168.1.1:12345" -> "192.168.1.1")
  const cleanIP = ip.split(':')[0];
  return WHITELIST_IPS.includes(cleanIP);
}

/**
 * Gera request ID único para rastreamento
 */
function generateRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Log estruturado com request-id, callid e userfield
 */
function structuredLog(level, requestId, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    requestId,
    message,
    ...data
  };
  
  // Extrair callid e userfield se disponíveis
  if (data.callid) logEntry.callid = data.callid;
  if (data.userfield) logEntry.userfield = data.userfield;
  
  console.log(JSON.stringify(logEntry));
}

/**
 * Adiciona evento à auditoria
 */
function addAuditEvent(event) {
  auditLog.push(event);
  // Manter apenas os últimos N eventos
  if (auditLog.length > MAX_AUDIT_EVENTS) {
    auditLog.shift();
  }
}

/**
 * Retry assíncrono com backoff exponencial para n8n
 */
async function retryN8nForward(webhookString, requestId, attempt = 1) {
  const delay = N8N_RETRY_BACKOFF_BASE * Math.pow(2, attempt - 1); // Backoff exponencial
  
  structuredLog('info', requestId, `Tentativa ${attempt}/${N8N_RETRY_MAX_ATTEMPTS} de encaminhar para n8n`, {
    attempt,
    delay
  });
  
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Request-Id': requestId
      },
      body: webhookString,
      signal: AbortSignal.timeout(10000) // 10 segundos timeout
    });
    
    structuredLog('info', requestId, `n8n respondeu com status ${response.status}`, {
      status: response.status,
      attempt
    });
    
    const text = await response.text().catch(() => '');
    if (text) {
      structuredLog('debug', requestId, `n8n resposta (primeiros 200 chars)`, {
        response: text.slice(0, 200)
      });
    }
    
    addAuditEvent({
      timestamp: new Date().toISOString(),
      requestId,
      type: 'n8n_forward_success',
      attempt,
      status: response.status
    });
    
    return { success: true, status: response.status };
  } catch (error) {
    structuredLog('error', requestId, `Erro ao encaminhar para n8n (tentativa ${attempt})`, {
      error: error.message,
      attempt
    });
    
    if (attempt < N8N_RETRY_MAX_ATTEMPTS) {
      // Adiciona à fila de retry
      retryQueue.push({
        webhookString,
        requestId,
        attempt: attempt + 1,
        nextRetryAt: Date.now() + delay
      });
      
      addAuditEvent({
        timestamp: new Date().toISOString(),
        requestId,
        type: 'n8n_forward_retry_queued',
        attempt,
        nextRetryAt: new Date(Date.now() + delay).toISOString()
      });
    } else {
      // Max tentativas atingido
      addAuditEvent({
        timestamp: new Date().toISOString(),
        requestId,
        type: 'n8n_forward_failed',
        attempt,
        error: error.message
      });
      
      structuredLog('error', requestId, `Falha ao encaminhar para n8n após ${N8N_RETRY_MAX_ATTEMPTS} tentativas`, {
        error: error.message
      });
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Processa fila de retry periodicamente
 */
function processRetryQueue() {
  const now = Date.now();
  const readyToRetry = retryQueue.filter(item => item.nextRetryAt <= now);
  
  for (const item of readyToRetry) {
    const index = retryQueue.indexOf(item);
    retryQueue.splice(index, 1);
    
    // Reexecuta retry
    retryN8nForward(item.webhookString, item.requestId, item.attempt);
  }
}

// Processa fila de retry a cada 5 segundos
setInterval(processRetryQueue, 5000);

/**
 * Armazenamento temporário do último webhook (para polling do frontend)
 */
let latestWebhook = null;
let webhookTimestamp = null;

// Armazenamento dos dados processados pelo n8n (com URL já montada)
let latestProcessedData = null;
let processedDataTimestamp = null;

/**
 * Função helper para converter body para string URL-encoded
 */
function convertBodyToString(body) {
  if (typeof body === 'string') {
    return body;
  }
  if (typeof body === 'object' && !Array.isArray(body)) {
    const params = new URLSearchParams();
    Object.keys(body).forEach(key => {
      params.append(key, body[key]);
    });
    return params.toString();
  }
  return String(body || '');
}

/**
 * Valida tamanho do body
 */
function validateBodySize(bodyString) {
  const size = Buffer.byteLength(bodyString, 'utf8');
  if (size > MAX_BODY_SIZE) {
    return {
      valid: false,
      error: `Body muito grande: ${size} bytes (máximo: ${MAX_BODY_SIZE} bytes)`
    };
  }
  return { valid: true };
}

/**
 * Endpoint para receber webhook do Delorean
 * O Delorean envia dados como URL-encoded (application/x-www-form-urlencoded)
 */
app.post('/webhook/delorean', (req, res) => {
  const requestId = generateRequestId();
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  
  structuredLog('info', requestId, 'Webhook recebido do Delorean', {
    method: req.method,
    path: req.path,
    clientIP,
    contentType: req.headers['content-type']
  });
  
  // Validação de IP Whitelist
  if (!isIPAllowed(clientIP)) {
    structuredLog('warn', requestId, 'IP não autorizado', { clientIP });
    addAuditEvent({
      timestamp: new Date().toISOString(),
      requestId,
      type: 'ip_not_allowed',
      clientIP
    });
    return res.status(403).json({
      success: false,
      message: 'IP não autorizado',
      requestId
    });
  }
  
  // Rate Limiting
  if (!checkRateLimit(clientIP)) {
    structuredLog('warn', requestId, 'Rate limit excedido', { clientIP });
    addAuditEvent({
      timestamp: new Date().toISOString(),
      requestId,
      type: 'rate_limit_exceeded',
      clientIP
    });
    return res.status(429).json({
      success: false,
      message: 'Rate limit excedido. Tente novamente mais tarde.',
      requestId
    });
  }
  
  try {
    // Converter body para string URL-encoded para armazenamento
    const webhookString = convertBodyToString(req.body);
    
    // Validar tamanho do body
    const sizeValidation = validateBodySize(webhookString);
    if (!sizeValidation.valid) {
      structuredLog('error', requestId, sizeValidation.error);
      addAuditEvent({
        timestamp: new Date().toISOString(),
        requestId,
        type: 'body_size_exceeded',
        size: Buffer.byteLength(webhookString, 'utf8')
      });
      return res.status(413).json({
        success: false,
        message: sizeValidation.error,
        requestId
      });
    }
    
    // Validar se tem dados essenciais
    if (!webhookString || webhookString.trim() === '') {
      structuredLog('error', requestId, 'Webhook sem dados');
      addAuditEvent({
        timestamp: new Date().toISOString(),
        requestId,
        type: 'empty_body'
      });
      return res.status(400).json({
        success: false,
        message: 'Webhook sem dados',
        requestId
      });
    }
    
    // Extrair campos importantes para log e resposta
    const params = new URLSearchParams(webhookString);
    const src = params.get('src');
    const dst = params.get('dst');
    const userfield = params.get('userfield');
    const callid = params.get('callid');
    const calldate = params.get('calldate');
    const disposition = params.get('disposition');
    
    structuredLog('info', requestId, 'Campos extraídos do webhook', {
      src,
      dst,
      userfield,
      callid,
      calldate,
      disposition
    });
    
    // Armazenar webhook ANTES de processar
    latestWebhook = webhookString;
    webhookTimestamp = new Date().toISOString();
    
    structuredLog('info', requestId, 'Webhook armazenado para consumo do frontend', {
      timestamp: webhookTimestamp
    });
    
    // Responder imediatamente ao Delorean (200 OK)
    // Importante: responder rápido para não dar timeout
    res.status(200).json({
      success: true,
      message: 'Webhook recebido com sucesso',
      requestId,
      received: {
        src,
        dst,
        userfield,
        callid
      }
    });
    
    // Adicionar evento de auditoria
    addAuditEvent({
      timestamp: new Date().toISOString(),
      requestId,
      type: 'webhook_received',
      clientIP,
      src,
      dst,
      userfield,
      callid,
      disposition
    });
    
    structuredLog('info', requestId, 'Webhook recebido e processado. Dados prontos para repassar ao frontend.');
    
    // Encaminhar para n8n de forma assíncrona (não bloquear a resposta ao Delorean)
    // Usar node-fetch se disponível, senão usar fetch global (Node 18+)
    const fetchFn = typeof fetch === 'function' ? fetch : null;
    if (fetchFn) {
      // Primeira tentativa imediata
      retryN8nForward(webhookString, requestId, 1).catch(err => {
        structuredLog('error', requestId, 'Erro inesperado ao tentar encaminhar para n8n', {
          error: err.message
        });
      });
    } else {
      structuredLog('warn', requestId, 'fetch indisponível. Configure Node 18+ ou instale node-fetch.');
    }
    
  } catch (error) {
    structuredLog('error', requestId, 'ERRO ao processar webhook', {
      error: error.message,
      stack: error.stack
    });
    
    addAuditEvent({
      timestamp: new Date().toISOString(),
      requestId,
      type: 'webhook_processing_error',
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      message: 'Erro ao processar webhook',
      error: error.message,
      requestId
    });
  }
});

/**
 * Endpoint para o frontend buscar o último webhook recebido (polling)
 * Retorna os dados processados pelo n8n (com URL montada) se disponível,
 * senão retorna os dados brutos do Delorean
 */
app.get('/api/get-latest-webhook', (req, res) => {
  // Priorizar dados processados pelo n8n (se disponível)
  if (latestProcessedData) {
    return res.json({
      success: true,
      timestamp: processedDataTimestamp,
      data: latestProcessedData,
      source: 'n8n_processed'
    });
  }
  
  // Fallback: dados brutos do Delorean
  if (!latestWebhook) {
    return res.json({
      success: false,
      message: 'Nenhum webhook recebido ainda',
      data: null
    });
  }
  
  res.json({
    success: true,
    timestamp: webhookTimestamp,
    data: latestWebhook,
    source: 'delorean_raw'
  });
});

/**
 * Endpoint para receber dados processados do n8n
 * O n8n faz POST aqui com os dados já processados (incluindo URL montada)
 */
app.post('/api/n8n-processed', (req, res) => {
  const requestId = generateRequestId();
  
  try {
    // Receber dados processados do n8n
    const processedData = req.body;
    
    structuredLog('info', requestId, 'Dados processados recebidos do n8n', {
      hasUrl: !!processedData.url,
      hasUserfield: !!processedData.userfield,
      src: processedData.src,
      dst: processedData.dst
    });
    
    // Armazenar dados processados
    latestProcessedData = processedData;
    processedDataTimestamp = new Date().toISOString();
    
    // Adicionar evento de auditoria
    addAuditEvent({
      timestamp: new Date().toISOString(),
      requestId,
      type: 'n8n_processed_received',
      src: processedData.src,
      dst: processedData.dst,
      userfield: processedData.userfield,
      hasUrl: !!processedData.url
    });
    
    // Responder ao n8n
    res.status(200).json({
      success: true,
      message: 'Dados processados recebidos com sucesso',
      requestId
    });
    
    structuredLog('info', requestId, 'Dados processados armazenados para consumo do frontend');
    
  } catch (error) {
    structuredLog('error', requestId, 'ERRO ao processar dados do n8n', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Erro ao processar dados do n8n',
      error: error.message,
      requestId
    });
  }
});

/**
 * Endpoint alternativo: Frontend pode fazer POST aqui para receber dados
 * Útil para testes manuais
 */
app.post('/api/forward-webhook', (req, res) => {
  const requestId = generateRequestId();
  const { webhookData } = req.body;
  
  if (!webhookData) {
    structuredLog('error', requestId, 'webhookData não fornecido');
    return res.status(400).json({
      success: false,
      message: 'webhookData é obrigatório',
      requestId
    });
  }
  
  // Armazenar último webhook
  latestWebhook = webhookData;
  webhookTimestamp = new Date().toISOString();
  
  structuredLog('info', requestId, 'Webhook armazenado manualmente', {
    timestamp: webhookTimestamp
  });
  
  res.json({
    success: true,
    message: 'Webhook armazenado e pronto para consumo',
    timestamp: webhookTimestamp,
    requestId
  });
});

/**
 * Endpoint de auditoria - Retorna últimos eventos
 */
app.get('/api/audit', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const filteredEvents = auditLog.slice(-limit);
  
  res.json({
    success: true,
    total: auditLog.length,
    returned: filteredEvents.length,
    events: filteredEvents
  });
});

/**
 * Endpoint de estatísticas
 */
app.get('/api/stats', (req, res) => {
  const now = Date.now();
  const oneHourAgo = now - 3600000; // 1 hora
  
  const recentEvents = auditLog.filter(event => {
    const eventTime = new Date(event.timestamp).getTime();
    return eventTime > oneHourAgo;
  });
  
  const stats = {
    totalAuditEvents: auditLog.length,
    recentEventsCount: recentEvents.length,
    retryQueueSize: retryQueue.length,
    rateLimitStoreSize: rateLimitStore.size,
    webhooksReceived: recentEvents.filter(e => e.type === 'webhook_received').length,
    n8nForwardsSuccess: recentEvents.filter(e => e.type === 'n8n_forward_success').length,
    n8nForwardsFailed: recentEvents.filter(e => e.type === 'n8n_forward_failed').length,
    n8nForwardsRetry: recentEvents.filter(e => e.type === 'n8n_forward_retry_queued').length
  };
  
  res.json({
    success: true,
    stats
  });
});

/**
 * Endpoint de saúde (health check)
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0'
  });
});

/**
 * Proxy para servir arquivos de áudio do Delorean com CORS adequado
 * Isso resolve o problema de CORS quando o servidor não envia headers Access-Control-Allow-Origin
 */
app.get('/api/audio-proxy', async (req, res) => {
  const requestId = generateRequestId();
  const audioUrl = decodeURIComponent(req.query.url || '');
  
  if (!audioUrl) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetro "url" é obrigatório',
      requestId
    });
  }
  
  try {
    structuredLog('info', requestId, 'Proxy de áudio solicitado', { audioUrl });
    
    // Validar URL (apenas domínio delorean.krolik.com.br)
    if (!audioUrl.startsWith('https://delorean.krolik.com.br/')) {
      return res.status(400).json({
        success: false,
        message: 'URL inválida. Apenas domínio delorean.krolik.com.br é permitido',
        requestId
      });
    }
    
    // Buscar o arquivo de áudio usando https nativo
    const https = require('https');
    const url = require('url');
    const parsedUrl = new url.URL(audioUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    };
    
    const audioReq = https.request(options, (audioRes) => {
      const statusCode = audioRes.statusCode;
      
      if (statusCode !== 200) {
        res.status(statusCode).json({
          success: false,
          message: `Erro ao buscar áudio: ${statusCode}`,
          requestId
        });
        return;
      }
      
      // Obter content-type do arquivo
      const contentType = audioRes.headers['content-type'] || 'audio/wav';
      const contentLength = audioRes.headers['content-length'];
      
      // Configurar headers CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Content-Type', contentType);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      
      // Stream do áudio
      audioRes.pipe(res);
      
      structuredLog('info', requestId, 'Áudio servido via proxy', { contentType, contentLength });
    });
    
    audioReq.on('error', (error) => {
      structuredLog('error', requestId, 'ERRO ao buscar áudio via proxy', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar áudio',
        error: error.message,
        requestId
      });
    });
    
    audioReq.end();
    
  } catch (error) {
    structuredLog('error', requestId, 'ERRO ao processar proxy de áudio', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Erro ao processar proxy de áudio',
      error: error.message,
      requestId
    });
  }
});

// OPTIONS para CORS preflight do proxy
app.options('/api/audio-proxy', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(204).end();
});

/**
 * Endpoint de informações do servidor
 */
app.get('/info', (req, res) => {
  res.json({
    name: 'Webhook Server - Delorean Integration',
    version: '2.0.0',
    features: {
      rateLimiting: true,
      ipWhitelist: WHITELIST_IPS.length > 0,
      retryWithBackoff: true,
      auditLog: true,
      structuredLogs: true
    },
    configuration: {
      maxBodySize: MAX_BODY_SIZE,
      rateLimitWindow: RATE_LIMIT_WINDOW,
      rateLimitMaxRequests: RATE_LIMIT_MAX_REQUESTS,
      n8nRetryMaxAttempts: N8N_RETRY_MAX_ATTEMPTS,
      n8nRetryBackoffBase: N8N_RETRY_BACKOFF_BASE,
      maxAuditEvents: MAX_AUDIT_EVENTS
    },
    endpoints: {
      receive: 'POST /webhook/delorean',
      getLatest: 'GET /api/get-latest-webhook',
      forward: 'POST /api/forward-webhook',
      audit: 'GET /api/audit',
      stats: 'GET /api/stats',
      health: 'GET /health'
    },
    instructions: {
      step1: 'Configure o webhook do Delorean para apontar para: http://SEU_SERVIDOR:PORT/webhook/delorean',
      step2: 'No frontend, faça polling em GET /api/get-latest-webhook ou use Server-Sent Events',
      step3: 'Quando receber o webhook, chame window.receberWebhook(dados) no frontend'
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('🚀 WEBHOOK SERVER INICIADO (v2.0.0)');
  console.log('═══════════════════════════════════════════════════');
  console.log(`📡 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`🌐 Frontend permitido: ${FRONTEND_URL}`);
  console.log(`📥 Endpoint para receber webhook: http://localhost:${PORT}/webhook/delorean`);
  console.log(`📤 Endpoint para frontend buscar: http://localhost:${PORT}/api/get-latest-webhook`);
  console.log(`📊 Endpoint de auditoria: http://localhost:${PORT}/api/audit`);
  console.log(`📈 Endpoint de estatísticas: http://localhost:${PORT}/api/stats`);
  console.log(`🔊 Proxy de áudio: http://localhost:${PORT}/api/audio-proxy?url=...`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`ℹ️  Informações: http://localhost:${PORT}/info`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('⚙️  CONFIGURAÇÃO DO DELOREAN:');
  console.log(`   Configure o webhook URL para: https://n8n-production-44e4.up.railway.app/webhook/6183dae4-72ae-4054-a430-451cae84d355`);
  console.log('   Método: POST');
  console.log('   Content-Type: application/x-www-form-urlencoded');
  console.log('');
  console.log('🔒 RECURSOS DE SEGURANÇA:');
  console.log(`   Rate Limiting: ${RATE_LIMIT_MAX_REQUESTS} req/${RATE_LIMIT_WINDOW / 1000}s por IP`);
  console.log(`   IP Whitelist: ${WHITELIST_IPS.length > 0 ? 'ATIVADO (' + WHITELIST_IPS.length + ' IPs)' : 'DESATIVADO (permite todos)'}`);
  console.log(`   Tamanho máximo do body: ${MAX_BODY_SIZE} bytes`);
  console.log(`   Retry n8n: até ${N8N_RETRY_MAX_ATTEMPTS} tentativas com backoff`);
  console.log(`   Auditoria: últimos ${MAX_AUDIT_EVENTS} eventos`);
  console.log('');
  console.log('📝 Variáveis de ambiente carregadas do .env');
  console.log('🔍 Logs estruturados habilitados (JSON)');
  console.log('═══════════════════════════════════════════════════');
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
  console.error('❌ ERRO NÃO CAPTURADO:', error);
  structuredLog('error', 'system', 'Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ PROMISE REJEITADA:', reason);
  structuredLog('error', 'system', 'Unhandled Rejection', {
    reason: String(reason)
  });
});