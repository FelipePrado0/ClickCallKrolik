# 🔍 Diagnóstico: Dados não Chegam no n8n

## ✅ Status Atual

- **Webhook responde:** ✅ Status 200 OK
- **Response:** "success"
- **Header X-Flow:** "gravar-clicktocall" ✅

**MAS:** Dados não aparecem no workflow do n8n.

---

## 🔍 Possíveis Causas e Soluções

### 1. Workflow Responde Antes de Processar

**Problema:** O webhook está configurado com `Response: On Received`, que responde imediatamente **antes** de processar os dados.

**Solução no n8n:**

1. Abra o nó **"Webhook Gravação Concluída"**
2. Vá em **Options** → **Response**
3. Mude de **"On Received"** para **"Last Node"**
4. Certifique-se de que o último nó do fluxo (ex: "Entregar API/DB" ou "Pronto para Enviar") está conectado corretamente
5. **Salve e reative o workflow**

### 2. Dados no Formato Errado ($json.body vs $json)

**Problema:** O nó "Normalizar Campos" pode não estar acessando os dados corretamente.

**Verificar no nó "Normalizar Campos":**

Os campos devem usar as expressões que checam AMBOS `$json.body` e `$json`:

```javascript
{{$json.body.src || $json.src}}
{{$json.body.dst || $json.dst}}
{{$json.body.userfield || $json.userfield}}
```

**Se estiver usando só `$json.src`**, os dados podem não chegar porque o n8n pode colocar dados em `$json.body` para URL-encoded.

**Solução:**

1. Abra o nó **"Normalizar Campos"**
2. Verifique se todas as expressões usam `{{$json.body.CAMPO || $json.CAMPO}}`
3. Se não, ajuste para essa forma
4. **Teste novamente**

### 3. Campos Obrigatórios Sendo Rejeitados

**Problema:** O nó IF "Campos Obrigatórios" pode estar rejeitando os dados se os campos não estiverem normalizados.

**Verificar:**

1. Abra o nó **"Normalizar Campos"**
2. Adicione um nó **"Execute Once"** ou **"Set"** logo após para fazer DEBUG:
   - Adicione um campo temporário: `debug = {{JSON.stringify($json)}}`
   - Isso mostra exatamente o que está chegando
3. Execute um teste e veja o que aparece em `debug`

**Solução no nó IF "Campos Obrigatórios":**

Verifique se as condições estão corretas:

```
{{$json.userfield !== undefined && $json.userfield !== ''}}
{{$json.src !== undefined && $json.src !== ''}}
{{$json.dst !== undefined && $json.dst !== ''}}
```

### 4. Workflow em Modo TESTE vs PRODUÇÃO

**Problema:** O workflow pode estar processando apenas chamadas de TESTE.

**Solução:**

1. **Certifique-se que o workflow está ATIVO** (toggle no canto superior direito)
2. **Use a URL de PRODUÇÃO** (não a URL de teste):
   - ✅ Produção: `https://n8n-k-production.up.railway.app/webhook/d7070f2c-fffd-4ba1-b567-a10a1c9661d9`
   - ❌ Teste: `https://n8n-k-production.up.railway.app/webhook-test/...`

### 5. Verificar Execuções no n8n

**Como verificar:**

1. Acesse o n8n: `https://n8n-k-production.up.railway.app`
2. Abra o workflow **"Gravações ClickToCall – Pós Gravação"**
3. Clique na aba **"Executions"** (ou **"Execuções"**)
4. Procure pela execução mais recente
5. Clique na execução para ver os dados

**Se não aparecer execuções:**

- O workflow pode não estar processando
- Verifique se está ATIVO
- Verifique se há erros na aba "Error Workflow"

**Se aparecer execuções mas sem dados:**

- Veja qual nó está falhando (vermelho)
- Clique no nó para ver o erro
- Verifique os dados de entrada do nó

---

## 🛠️ Solução Rápida Recomendada

### Passo 1: Verificar Response do Webhook

No nó **"Webhook Gravação Concluída"**:

1. Abra o nó
2. Vá em **Options** → **Response**
3. **Mude para "Last Node"** (se quiser resposta síncrona)
   - OU mantenha "On Received" mas verifique se há tratamento de erro
4. **Salve**

### Passo 2: Adicionar Nó de Debug Temporário

1. Após o nó **"Normalizar Campos"**, adicione um nó **"Set"** temporário
2. Nome: `Debug - Ver Dados`
3. Adicione um campo:
   ```
   debug_data = {{JSON.stringify($json, null, 2)}}
   ```
4. Execute um teste
5. Veja o que aparece em `debug_data`

### Passo 3: Verificar Formato dos Dados

O webhook recebe dados em `application/x-www-form-urlencoded`, então:

- **Dados podem estar em:** `$json.body.src`
- **OU em:** `$json.src`
- **OU em:** `$json.body.data.src`

**Teste todas as possibilidades no nó "Normalizar Campos":**

```javascript
// Tente primeiro:
src = {{$json.body.src || $json.src || $json.body.data?.src || ''}}
```

### Passo 4: Verificar Logs de Execução

No n8n:

1. Vá em **Executions**
2. Clique na execução mais recente
3. Veja qual nó está falhando
4. Clique no nó vermelho para ver o erro
5. Corrija conforme necessário

---

## 📋 Checklist de Verificação

- [ ] Workflow está ATIVO (toggle no canto superior direito)?
- [ ] Nó "Webhook" está com Response configurado corretamente?
- [ ] Nó "Normalizar Campos" está acessando `$json.body.CAMPO || $json.CAMPO`?
- [ ] Nó IF "Campos Obrigatórios" está validando corretamente?
- [ ] Há execuções aparecendo na aba "Executions"?
- [ ] Se há execuções, elas estão falhando em algum nó?
- [ ] Os dados estão chegando no formato correto?

---

## 🧪 Teste Manual no n8n

Para testar diretamente no n8n:

1. Abra o workflow
2. Clique no nó **"Webhook Gravação Concluída"**
3. Clique em **"Test URL"** ou use o botão **"Listen for test event"**
4. Execute o teste: `node tests/test-n8n-detailed.js`
5. Veja se os dados aparecem no nó webhook
6. Execute manualmente o workflow (botão "Execute Workflow")
7. Veja em qual nó está falhando

---

## 💡 Informação Adicional

**Payload que está sendo enviado:**

```
src=1001099
dst=16981317956
userfield=20251029_68185315_1001099_103_16981317956_1761868185315
calldate=2025-10-30 23:50:00
duration=65
billsec=60
disposition=ANSWER
callid=test-callid-detailed-1761868185315
price=0.105
company_id=100
accountcode=5.00
uniqueid=unique-1761868185315
```

**callid para procurar:** `test-callid-detailed-1761868185315`

---

Se após verificar tudo isso ainda não funcionar, pode ser necessário verificar os logs do servidor n8n ou contatar o administrador do n8n.

