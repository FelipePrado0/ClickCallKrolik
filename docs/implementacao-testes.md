## Plano de Implementação e Testes – Fluxo de Gravações (delorean + n8n)

Objetivo: receber o webhook de término da chamada do delorean, normalizar/validar dados, montar URL da gravação `https://delorean.krolik.com.br/services/record/{userfield}`, e entregar para a API/DB do projeto com confiabilidade, segurança e observabilidade.

### Escopo
- Backend local (`webhook-server.js`)
- Workflow n8n “Gravações ClickToCall – Pós Gravação”
- Entrega para API/DB (HTTP Request) com `empresa` e timestamps GMT-3
- Testes ponta-a-ponta e cenários de erro

---

### Implementação (Passo a passo)
1) Backend – recebimento e encaminhamento
   - Garantir endpoint `POST /webhook/delorean` (x-www-form-urlencoded, JSON) respondendo 200 imediatamente.
   - Persistir último evento para o frontend em `GET /api/get-latest-webhook`.
   - Encaminhar assíncrono o payload original para o Webhook do n8n (variável `N8N_WEBHOOK_URL`).
   - Adicionar validações: whitelist de IP/assinatura (se disponível), tamanho de body, rate limit.
   - Implementar retry assíncrono com backoff em caso de falha no n8n (fila simples in-memory ou job). 

2) n8n – workflow (nós principais)
   - Webhook (POST) → Set (Normalizar) → IF (Obrigatórios) → Function (Montar URL) → Set (Pronto) → HTTP Request (API/DB)
   - onError do Webhook: `continueRegularOutput` para nunca travar a resposta ao provedor.
   - IF: requer `userfield`, `src`, `dst` preenchidos; branch false retorna payload de erro para auditoria.
   - Function: `url = https://delorean.krolik.com.br/services/record/{userfield}`.
   - HTTP Request: enviar payload final para a API/DB com `empresa` e `created_at` (GMT-3).
   - Campos adicionais suportados do payload real: `callid`, `uniqueid`, `company_id`, `accountcode`, `price`.

3) API/DB – contrato de saída
   - Campos mínimos: `callid`, `userfield`, `url`, `src`, `dst`, `calldate`, `duration`, `billsec`, `disposition`, `empresa`, `created_at` (GMT-3).
   - Campos recomendados (se disponíveis): `uniqueid`, `company_id`, `accountcode`, `price` (number).
   - Responder 2xx; em erro, retornar JSON com `message` e `code`.

4) Observabilidade e segurança
   - Logs estruturados (request-id, callid, userfield) no backend e no n8n (via Add to log/Set markers).
   - Alertas para falha ao entregar na API/DB (n8n: Error workflow ou notificação).
   - Auditoria: gravar últimos N eventos e status de entrega.

---

### Testes (Ponta-a-ponta e unitários)
1) Teste local de webhook (simulado)
   - `node tests/simulate-delorean-webhook.js`
   - Verificar: 200 do backend; n8n recebendo; HTTP Request final disparado; resposta da API/DB.

2) Cenários funcionais
   - ANSWER com `duration>0` → URL válida (200 na API/DB)
   - NO ANSWER → `billsec=0`, `duration>=ringtime` → ainda entrega registro (sem áudio útil)
   - BUSY → `disposition=BUSY` → entrega registro
   - CANCEL → `disposition=CANCEL` → entrega registro

3) Cenários de dados inválidos
   - `userfield` vazio → branch de erro no IF
   - `src`/`dst` ausentes → branch de erro
   - `userfield` com formato inesperado → URL montada mas marcar `urlStatus="suspect"`
   - Tipagens: `price` não-numérico, `duration/billsec` não-inteiros → rejeitar/logar

4) Resiliência
   - Indisponibilidade temporária da API/DB → retry/backoff (validar no backend e/ou n8n)
   - Timeout do n8n → backend registra e reencaminha depois (fila)

5) Timezone e formatação
   - Converter `created_at` e exibição no frontend para GMT-3.
   - Validar `calldate` no padrão `Y-m-d H:i:s`.
   - `disposition` considerar valores exatos: `ANSWER`, `NO ANSWER`, `BUSY`, `CANCEL`.

6) Segurança
   - Validar origem (IP/assinatura) no backend antes de aceitar o webhook.
   - Sanitizar campos e impor tamanho máximo.

7) Critérios de aceite
   - 100% dos cenários funcionais entregam na API/DB.
   - Logs contêm `callid` e `userfield` correlacionáveis entre backend e n8n.
   - URL construída usa domínio `delorean.krolik.com.br` e baixa o arquivo real quando existente.

---

### Rollout
- Homologação: ativar workflow n8n em ambiente de teste; validar 4 disposições.
- Produção: configurar `.env`, domínios/HTTPS e alertas; ativar workflow e monitorar 24–48h.


