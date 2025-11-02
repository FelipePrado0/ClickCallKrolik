# 📖 Guia de Execução - Sistema ClickToCall

Este guia te ensina como executar o sistema completo passo a passo! 🚀

---

## 📋 Pré-requisitos

Antes de começar, verifique se você tem:

1. **Node.js instalado** (versão 18 ou superior)
   - Verificar: `node --version`
   - Instalar: https://nodejs.org/

2. **npm instalado**
   - Verificar: `npm --version`
   - Geralmente vem com o Node.js

3. **Terminal/PowerShell aberto**
   - Windows: PowerShell ou CMD
   - Mac/Linux: Terminal

---

## 🔧 Passo 1: Configuração Inicial

### 1.1. Instalar Dependências

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

Isso instalará todas as dependências necessárias (express, cors, dotenv, etc.)

### 1.2. Configurar Variáveis de Ambiente

1. **Copie o arquivo `.env.example` para `.env`:**
   ```bash
   # No Windows PowerShell:
   Copy-Item .env.example .env
   
   # No Windows CMD:
   copy .env.example .env
   
   # No Mac/Linux:
   cp .env.example .env
   ```

2. **Edite o arquivo `.env`** com suas configurações:
   - Abra o `.env` em um editor de texto
   - Ajuste as variáveis conforme necessário:
     - `PORT`: Porta do servidor (padrão: 3000)
     - `FRONTEND_URL`: URL do frontend (padrão: http://localhost:5500)
     - `N8N_WEBHOOK_URL`: URL do webhook do n8n (já está configurada)
     - `WHITELIST_IPS`: IPs permitidos (deixe vazio para permitir todos)
     - Outras configurações opcionais conforme sua necessidade

---

## 🚀 Passo 2: Executar o Servidor Backend

### 2.1. Iniciar o Servidor

No terminal, execute:

```bash
node webhook-server.js
```

**OU** usando npm:

```bash
npm start
```

### 2.2. Verificar se Está Rodando

Você deve ver algo assim:

```
═══════════════════════════════════════════════════
🚀 WEBHOOK SERVER INICIADO (v2.0.0)
═══════════════════════════════════════════════════
📡 Servidor rodando em: http://localhost:3000
...
```

### 2.3. Testar o Servidor

Abra outro terminal e teste:

```bash
# Teste o health check
curl http://localhost:3000/health

# OU no PowerShell:
Invoke-WebRequest -Uri http://localhost:3000/health
```

Se retornar `{"status":"ok"}`, o servidor está funcionando! ✅

---

## 🧪 Passo 3: Executar os Testes

### 3.1. Manter o Servidor Rodando

**IMPORTANTE:** Deixe o servidor rodando em um terminal!

Abra um **segundo terminal** para executar os testes.

### 3.2. Teste Básico - Simular Webhook

```bash
# Execute todos os cenários
node tests/simulate-delorean-webhook.js all

# OU teste um cenário específico:
node tests/simulate-delorean-webhook.js answer
node tests/simulate-delorean-webhook.js noanswer
node tests/simulate-delorean-webhook.js busy
node tests/simulate-delorean-webhook.js cancel
node tests/simulate-delorean-webhook.js invalid
```

### 3.3. Teste de Validações

```bash
node tests/test-validation-scenarios.js
```

Este teste verifica:
- Rate limiting
- Validação de tamanho do body
- Campos obrigatórios
- Endpoints de auditoria e estatísticas

### 3.4. Teste do Webhook n8n

```bash
node tests/test-n8n-webhook.js
```

Este teste verifica se o webhook do n8n está configurado e ativo.

---

## 📊 Passo 4: Verificar Endpoints de Monitoramento

Enquanto o servidor está rodando, você pode verificar:

### 4.1. Health Check

```bash
# Via curl (Mac/Linux):
curl http://localhost:3000/health

# Via PowerShell (Windows):
Invoke-WebRequest -Uri http://localhost:3000/health
```

### 4.2. Informações do Servidor

```bash
curl http://localhost:3000/info
```

### 4.3. Auditoria (Ver eventos recentes)

```bash
curl http://localhost:3000/api/audit?limit=10
```

### 4.4. Estatísticas

```bash
curl http://localhost:3000/api/stats
```

---

## 🌐 Passo 5: Configurar o Frontend

### 5.1. Abrir o Frontend

Abra o arquivo `index.html` no navegador:

- **Método 1:** Duplo clique no arquivo `index.html`
- **Método 2:** Use um servidor local (ex: Live Server no VS Code)
- **Método 3:** Via Python (se instalado):
  ```bash
  # Python 3
  python -m http.server 5500
  
  # Ou use qualquer servidor HTTP na porta 5500
  ```

### 5.2. Verificar Conexão

O frontend fará polling automático do backend em `http://localhost:3000/api/get-latest-webhook` a cada 5 segundos.

Verifique o console do navegador (F12) para ver os logs de conexão.

---

## 🔗 Passo 6: Configurar o Delorean

### 6.1. Obter o IP Público do Seu Servidor

Se o servidor estiver em sua máquina local, você precisará:

1. **Opção A - Servidor Local com ngrok/tunnel:**
   - Instalar ngrok: https://ngrok.com/
   - Executar: `ngrok http 3000`
   - Usar a URL fornecida pelo ngrok

2. **Opção B - Servidor em Rede Local:**
   - Descobrir seu IP local: `ipconfig` (Windows) ou `ifconfig` (Mac/Linux)
   - Usar: `http://SEU_IP_LOCAL:3000/webhook/delorean`

3. **Opção C - Servidor em Produção:**
   - Use o domínio/IP público do servidor

### 6.2. Configurar Webhook no Delorean

No sistema Delorean, configure o webhook:

- **URL:** `http://SEU_SERVIDOR:3000/webhook/delorean`
- **Método:** `POST`
- **Content-Type:** `application/x-www-form-urlencoded`

---

## 📱 Passo 7: Testar o Fluxo Completo

### 7.1. Fluxo de Teste Manual

1. **Inicie o servidor backend** (terminal 1)
2. **Abra o frontend** no navegador
3. **Faça uma chamada** clicando em "Ligar" para um contato
4. **Aguarde o término da chamada**
5. **Verifique:**
   - O webhook foi recebido no backend (logs no terminal)
   - O webhook foi encaminhado para o n8n (logs no terminal)
   - O frontend recebeu o webhook (polling automático)
   - A gravação apareceu no contato (ícone 🎧)

### 7.2. Verificar Logs

No terminal do servidor, você verá:

- ✅ Webhooks recebidos
- ✅ Logs estruturados com request-id, callid, userfield
- ✅ Tentativas de encaminhamento para n8n
- ✅ Status de entrega

---

## 🛠️ Passo 8: Configurar n8n (Opcional)

### 8.1. Acessar o n8n

1. Acesse seu n8n (ex: https://n8n-k-production.up.railway.app)

### 8.2. Criar o Workflow

Siga as instruções em `docs/n8n-nos-config.md` para criar o workflow:

- Webhook → Set (Normalizar) → IF (Obrigatórios) → Function (Montar URL) → Set (Pronto) → HTTP Request (API/DB)

### 8.3. Ativar o Workflow

**IMPORTANTE:** Ative o workflow usando o toggle no canto superior direito do editor!

### 8.4. Verificar Webhook ID

Após criar o workflow, copie o webhook ID e atualize no `.env`:

```env
N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/SEU-WEBHOOK-ID
```

---

## 🐛 Solução de Problemas

### Erro: "Port 3000 already in use"

**Solução:** Mude a porta no `.env`:
```env
PORT=3001
```

### Erro: "Cannot find module"

**Solução:** Instale as dependências:
```bash
npm install
```

### Frontend não recebe webhooks

**Solução:** 
1. Verifique se o servidor está rodando
2. Verifique o console do navegador (F12)
3. Verifique a URL do backend no código (`webhookServerUrl`)

### n8n retorna 404

**Solução:**
1. Verifique se o workflow está **ATIVO** no n8n
2. Verifique se o webhook ID está correto no `.env`
3. Teste o webhook manualmente: `node tests/test-n8n-webhook.js`

---

## 📝 Checklist de Execução

- [ ] Node.js e npm instalados
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env` configurado
- [ ] Servidor backend rodando (`node webhook-server.js`)
- [ ] Testes executados e passando
- [ ] Frontend aberto no navegador
- [ ] Webhook do Delorean configurado
- [ ] n8n configurado (opcional, mas recomendado)
- [ ] Fluxo completo testado

---

## 🎯 Próximos Passos

Depois que tudo estiver rodando:

1. **Monitorar logs** do servidor para verificar se tudo está funcionando
2. **Verificar auditoria** periodicamente: `curl http://localhost:3000/api/audit`
3. **Verificar estatísticas**: `curl http://localhost:3000/api/stats`
4. **Configurar alertas** no n8n para falhas (opcional)

---

## 💡 Dicas

- **Mantenha o servidor rodando** em um terminal dedicado
- **Use logs estruturados** para debug (JSON nos logs)
- **Verifique a auditoria** regularmente para monitorar o sistema
- **Teste em ambiente de desenvolvimento** antes de colocar em produção

---

Boa sorte, Felipe-chan! 🍀✨

Se tiver dúvidas, consulte os arquivos de documentação:
- `docs/implementacao-testes.md` - Detalhes técnicos
- `docs/n8n-nos-config.md` - Configuração do n8n
- `tests/README.md` - Guia dos testes

