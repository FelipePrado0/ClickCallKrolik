## n8n – Configuração Completa dos Nós (começando do zero)

Workflow: "Gravações ClickToCall – Pós Gravação"

### 1) Webhook – Gravação Concluída
- Node: Webhook
- Name: `Webhook Gravação Concluída`
- HTTP Method: `POST`
- Path: `d7070f2c-fffd-4ba1-b567-a10a1c9661d9` (ou outro UUID)
- Response: `On Received` (rápido). Alternativa: `Last Node` se quiser resposta síncrona
- Response Code: `200`
- Response Data: `All entries`
- Options → Response Headers: `X-Flow = gravar-clicktocall`
- Error Handling (Node): `onError = continueRegularOutput`

Entrada esperada (x-www-form-urlencoded/JSON): `calldate, src, dst, duration, billsec, disposition, userfield, callid`
Campos adicionais frequentes: `uniqueid`, `company_id`, `accountcode`, `price`.

### 2) Set – Normalizar Campos
- Node: Set
- Name: `Normalizar Campos`
- Keep Only Set: `false`
- Add Fields → String (expressions):
  - `src = {{$json.body.src || $json.src}}`
  - `dst = {{$json.body.dst || $json.dst}}`
  - `userfield = {{$json.body.userfield || $json.userfield}}`
  - `calldate = {{$json.body.calldate || $json.calldate}}`
  - `duration = {{$json.body.duration || $json.duration}}`
  - `billsec = {{$json.body.billsec || $json.billsec}}`
  - `disposition = {{$json.body.disposition || $json.disposition}}`
  - `price = {{$json.body.price || $json.price}}` (opcional)
  - `company_id = {{$json.body.company_id || $json.company_id}}` (opcional)
  - `accountcode = {{$json.body.accountcode || $json.accountcode}}` (opcional)
  - `uniqueid = {{$json.body.uniqueid || $json.uniqueid}}` (opcional)

### 3) IF – Campos Obrigatórios
- Node: IF
- Name: `Campos Obrigatórios`
- Conditions → Boolean:
  - `{{$json.userfield !== undefined && $json.userfield !== ''}}`
  - `{{$json.src !== undefined && $json.src !== ''}}`
  - `{{$json.dst !== undefined && $json.dst !== ''}}`
- Error Handling (Node): `onError = continueErrorOutput`

### 4) Function – Montar URL Gravação
- Node: Function
- Name: `Montar URL Gravação`
- Code:
```
// Monta a URL do arquivo de gravação a partir do userfield
return items.map(item => {
  const data = item.json || {};
  const code = data.userfield || '';
  const url = code ? `https://delorean.krolik.com.br/services/record/${code}` : '';
  return { json: { ...data, url } };
});
```

### 5) Set – Pronto para Enviar
- Node: Set
- Name: `Pronto para Enviar`
- Keep Only Set: `false`
- Add Fields:
  - `status = ok`
  - (opcional) `urlStatus = {{$json.url ? 'ok' : 'missing'}}`

### 5.1) Set – Formatar Resposta JSON (OPCIONAL - se precisar retornar resposta formatada)
- Node: Set
- Name: `Formatar Resposta JSON`
- Keep Only Set: `true` (manter apenas os campos formatados)
- Add Fields → String (expressions):
  - `src = {{$json.src}}`
  - `dst = {{$json.dst}}`
  - `calldate = {{$json.calldate}}`
  - `disposition = {{$json.disposition}}`
  - `duration = {{String($json.duration)}}`
  - `billsec = {{String($json.billsec)}}`
  - `userfield = {{$json.userfield}}`
  - `callid = {{$json.callid}}`
  - `uniqueid = {{$json.uniqueid}}`
  - `company_id = {{$json.company_id}}`
  - `accountcode = {{$json.accountcode}}`
  - `price = {{Number($json.price) || 0}}`
- **Observação:** Este nó é necessário apenas se você quiser que o webhook retorne um JSON formatado específico. Se usar "Response: Last Node", adicione este nó antes do último nó do workflow.

### 6) HTTP Request – Entregar para API/DB
- Node: HTTP Request
- Name: `Entregar API/DB`
- Method: `POST`
- URL: `https://SUA_API/rota`
- Authentication: conforme sua API (Bearer/API Key/Basic)
- Headers: `Content-Type = application/json`
- Body Content Type: `JSON`
- JSON/Body:
  - Enviar objeto com: `callid, userfield, url, src, dst, calldate, duration, billsec, disposition, empresa, created_at(GMT-3), uniqueid, company_id, accountcode, price`
- Options:
  - Timeout: `10000–20000 ms` (ajuste)
  - Retry On Fail: habilitar se aplicável

### 7) Branch de Erro – Campos faltando
- Node: Set
- Name: `Erro: Campos faltando`
- Keep Only Set: `true`
- Add Fields:
  - `error = 'Campos obrigatórios ausentes (userfield/src/dst)'`

### 8) Conexões
- `Webhook Gravação Concluída` → `Normalizar Campos`
- `Normalizar Campos` → `Campos Obrigatórios`
- `Campos Obrigatórios (true)` → `Montar URL Gravação` → `Pronto para Enviar` → `Entregar API/DB`
- `Campos Obrigatórios (false)` → `Erro: Campos faltando`

**Com resposta formatada (se usar "Last Node"):**
- `Campos Obrigatórios (true)` → `Montar URL Gravação` → `Pronto para Enviar` → `Formatar Resposta JSON` → `Entregar API/DB`
- (O nó "Formatar Resposta JSON" deve ser o último antes do "Entregar API/DB" para retornar JSON formatado)

### 9) Alternativa: resposta síncrona ao chamador
- No Webhook, usar `Response → Last Node` e deixar `Formatar Resposta JSON` (ou `Entregar API/DB`) como último nó.
- O Webhook responderá com o payload do último nó no formato especificado:
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

### 10) Boas práticas
- Padronize timezone (GMT-3) ao gerar `created_at` (pode ser feito no Function ou Set).
- Logue `callid` e `userfield` em cada nó (usando campos adicionais ou Execute Once + log).
- Habilite um Error Workflow global no n8n para alertas.


