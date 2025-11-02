# Testes do Sistema ClickToCall

Este diretório contém testes para validar o sistema de webhooks e gravações.

## Arquivos de Teste

### 1. `simulate-delorean-webhook.js`
Simula webhooks do Delorean para diferentes cenários.

**Uso:**
```bash
# Executa todos os testes
node tests/simulate-delorean-webhook.js all

# Teste específico
node tests/simulate-delorean-webhook.js answer
node tests/simulate-delorean-webhook.js noanswer
node tests/simulate-delorean-webhook.js busy
node tests/simulate-delorean-webhook.js cancel
node tests/simulate-delorean-webhook.js invalid
```

**Cenários testados:**
- `answer`: Chamada atendida com sucesso (disposition: ANSWER)
- `noanswer`: Chamada não atendida (disposition: NO ANSWER)
- `busy`: Linha ocupada (disposition: BUSY)
- `cancel`: Chamada cancelada (disposition: CANCEL)
- `invalid`: Dados inválidos para testar validações

### 2. `test-validation-scenarios.js`
Testa validações, rate limiting e resiliência do sistema.

**Uso:**
```bash
node tests/test-validation-scenarios.js
```

**Testes incluídos:**
- Rate limiting (múltiplas requisições rápidas)
- Validação de tamanho do body
- Campos obrigatórios vazios
- Endpoint de auditoria
- Endpoint de estatísticas

## Pré-requisitos

1. **Servidor backend rodando:**
   ```bash
   node webhook-server.js
   ```
   O servidor deve estar rodando na porta 3000 (ou conforme configurado no `.env`)

2. **Variáveis de ambiente configuradas:**
   - Copie `.env.example` para `.env`
   - Configure as variáveis conforme necessário

## Como Executar Todos os Testes

```bash
# Terminal 1: Inicie o servidor
node webhook-server.js

# Terminal 2: Execute os testes
node tests/simulate-delorean-webhook.js all
node tests/test-validation-scenarios.js
```

## Validação dos Testes

Após executar os testes, verifique:

1. **Logs do servidor:**
   - Webhooks recebidos e armazenados
   - Encaminhamentos para n8n
   - Logs estruturados com request-id, callid e userfield

2. **Endpoints de monitoramento:**
   - `GET http://localhost:3000/api/audit` - Ver eventos de auditoria
   - `GET http://localhost:3000/api/stats` - Ver estatísticas
   - `GET http://localhost:3000/health` - Health check

3. **n8n (se configurado):**
   - Webhooks recebidos no n8n
   - Workflow executado corretamente
   - Dados entregues na API/DB final

## Observações

- Os testes não bloqueiam se o n8n não estiver configurado
- O rate limiting pode precisar de ajustes no `.env` dependendo da frequência de testes
- Alguns testes podem demorar mais (ex: rate limiting envia 105 requisições)
