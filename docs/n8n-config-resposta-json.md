# 📋 Configuração do n8n - Resposta JSON no Formato Correto

## ✅ Headers Estão Corretos!

O header **X-Flow: gravar-clicktocall** está configurado corretamente! ✅

## 🎯 Formato da Resposta JSON Esperado

A resposta do webhook do n8n deve retornar um JSON simples neste formato:

```json
{
  "src": "1099",
  "dst": "16981317956",
  "calldate": "2025-10-30 15:04:25",
  "disposition": "ANSWER",
  "duration": "13",
  "billsec": "11",
  "userfield": "20251030_150437_1001099_103_16981317956_1761847468",
  "callid": "abc123",
  "uniqueid": "1761847465.1537220",
  "company_id": "100",
  "accountcode": "5.00",
  "price": 0.105
}
```

---

## 🔧 Como Configurar no n8n

### Opção 1: Usar "Last Node" como Resposta

**Passos:**

1. **Configure o último nó do workflow para formatar a resposta:**
   - Adicione um nó **"Set"** ou **"Function"** ANTES do último nó
   - Nome: `Formatar Resposta JSON`
   
2. **Configure os campos no nó "Formatar Resposta JSON":**
   ```
   src = {{$json.src}}
   dst = {{$json.dst}}
   calldate = {{$json.calldate}}
   disposition = {{$json.disposition}}
   duration = {{$json.duration}}
   billsec = {{$json.billsec}}
   userfield = {{$json.userfield}}
   callid = {{$json.callid}}
   uniqueid = {{$json.uniqueid}}
   company_id = {{$json.company_id}}
   accountcode = {{$json.accountcode}}
   price = {{Number($json.price) || 0}}
   ```

3. **Configure o nó Webhook:**
   - Abra o nó **"Webhook Gravação Concluída"**
   - Vá em **Options** → **Response**
   - Selecione: **"Last Node"**
   - Configure **Response Code**: `200`
   - Configure **Response Data**: `All entries` (ou `First Entry` se só quiser uma resposta)

4. **Conecte o nó "Formatar Resposta JSON" como último nó antes da resposta:**
   ```
   ... → Formatar Resposta JSON → (último nó antes da resposta do webhook)
   ```

### Opção 2: Usar Function Node para Formatar

**Passos:**

1. **Adicione um nó Function antes do último nó:**
   - Nome: `Formatar Resposta JSON`
   
2. **Código da Function:**
```javascript
// Formata a resposta JSON no formato esperado
return items.map(item => {
  const data = item.json || {};
  
  return {
    json: {
      src: data.src || '',
      dst: data.dst || '',
      calldate: data.calldate || '',
      disposition: data.disposition || '',
      duration: String(data.duration || '0'),
      billsec: String(data.billsec || '0'),
      userfield: data.userfield || '',
      callid: data.callid || '',
      uniqueid: data.uniqueid || '',
      company_id: data.company_id || '',
      accountcode: data.accountcode || '',
      price: parseFloat(data.price) || 0
    }
  };
});
```

3. **Configure o webhook para usar "Last Node":**
   - Response: **"Last Node"**
   - Response Code: `200`

---

## 📝 Estrutura Completa do Workflow

```
Webhook Gravação Concluída
    ↓
Normalizar Campos
    ↓
Campos Obrigatórios (IF)
    ↓ (true)
Montar URL Gravação
    ↓
Pronto para Enviar
    ↓
Formatar Resposta JSON  ← NOVO NÓ (adicione aqui)
    ↓
Entregar API/DB (ou outro nó final)
```

**IMPORTANTE:** Se você usar "Last Node" como resposta, o nó **"Formatar Resposta JSON"** deve ser o último nó conectado ao webhook, OU o último nó do workflow deve ter os campos formatados corretamente.

---

## ⚠️ Observações Importantes

### Se estiver usando "On Received":

- O webhook responde **imediatamente** com "success"
- A resposta NÃO incluirá os dados processados
- Os dados serão processados assincronamente

### Se estiver usando "Last Node":

- O webhook **aguarda** o processamento completo
- A resposta será o JSON do último nó
- Útil se precisar da resposta formatada

---

## 🧪 Teste

Após configurar, teste novamente:

```bash
node tests/test-n8n-webhook-test.js
```

A resposta deve ser um JSON simples com apenas os campos especificados, sem `headers`, `params`, `body`, etc.

---

## ✅ Checklist

- [ ] Header **X-Flow: gravar-clicktocall** configurado ✅
- [ ] Nó "Formatar Resposta JSON" adicionado ao workflow
- [ ] Campos configurados corretamente (src, dst, calldate, etc.)
- [ ] Webhook configurado com Response: **"Last Node"**
- [ ] Nó de formatação é o último nó OU último nó tem dados formatados
- [ ] Teste realizado e resposta está no formato correto

