# 📍 Onde Colocar o Nó CODE no Workflow do n8n

## 🎯 Posição Correta do Nó CODE

Com base no seu workflow atual, o nó CODE (ou "Formatar Resposta JSON") deve ser colocado **APÓS o nó "HTTP Request"** no caminho de sucesso.

---

## 📊 Estrutura do Workflow com o Nó CODE

```
Webhook Gravação Concluída
    ↓
Normalizar Campos
    ↓
Campos Obrigatórios (IF)
    ↓
    ├─ (true) ─→ Montar URL Gravação
    │               ↓
    │           Pronto para Enviar
    │               ↓
    │           HTTP Request (POST para Delorean)
    │               ↓
    │           [NÓ CODE AQUI] ← 🎯 FORMATA RESPOSTA JSON
    │
    └─ (false) ─→ Erro: Campos faltando
```

---

## 🔧 Passo a Passo para Adicionar o Nó CODE

### 1. Adicionar o Nó CODE Após "HTTP Request"

1. **Abra o workflow no n8n**
2. **Clique no nó "HTTP Request"** (último nó do caminho de sucesso)
3. **Clique no botão "+"** que aparece à direita do nó
4. **Selecione "Code"** ou **"Set"** (você pode usar qualquer um)

### 2. Configurar o Nó CODE

**Nome:** `Formatar Resposta JSON`

**Se usar nó CODE (Function):**
```javascript
// Formata a resposta JSON no formato esperado
return items.map(item => {
  const data = item.json || {};
  
  // Retorna apenas os campos formatados conforme especificado
  return {
    json: {
      src: String(data.src || ''),
      dst: String(data.dst || ''),
      calldate: String(data.calldate || ''),
      disposition: String(data.disposition || ''),
      duration: String(data.duration || '0'),
      billsec: String(data.billsec || '0'),
      userfield: String(data.userfield || ''),
      callid: String(data.callid || ''),
      uniqueid: String(data.uniqueid || ''),
      company_id: String(data.company_id || ''),
      accountcode: String(data.accountcode || ''),
      price: parseFloat(data.price) || 0
    }
  };
});
```

**OU se usar nó SET (mais simples):**
- **Keep Only Set:** `true` (mantém apenas os campos formatados)
- **Add Fields:**
  ```
  src = {{String($json.src)}}
  dst = {{String($json.dst)}}
  calldate = {{String($json.calldate)}}
  disposition = {{String($json.disposition)}}
  duration = {{String($json.duration)}}
  billsec = {{String($json.billsec)}}
  userfield = {{String($json.userfield)}}
  callid = {{String($json.callid)}}
  uniqueid = {{String($json.uniqueid)}}
  company_id = {{String($json.company_id)}}
  accountcode = {{String($json.accountcode)}}
  price = {{Number($json.price) || 0}}
  ```

### 3. Configurar o Webhook para Usar "Last Node"

1. **Abra o nó "Webhook Gravação Concluída"**
2. **Vá em Options → Response**
3. **Mude de "On Received" para "Last Node"**
4. **Salve o workflow**

---

## ✅ Resultado Final

Após configurar, o fluxo ficará assim:

```
Caminho de Sucesso:
Webhook → Normalizar Campos → IF (true) → 
Montar URL Gravação → Pronto para Enviar → 
HTTP Request → [Formatar Resposta JSON] ← ÚLTIMO NÓ

Caminho de Erro:
Webhook → Normalizar Campos → IF (false) → 
Erro: Campos faltando
```

Quando o webhook for chamado:
- **No caminho de sucesso:** O webhook retornará o JSON formatado do nó "Formatar Resposta JSON"
- **No caminho de erro:** O webhook retornará a mensagem de erro

---

## 🎯 Posição Visual no Canvas

```
                    ┌─────────────────────┐
                    │  Montar URL Gravação│
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │  Pronto para Enviar │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │    HTTP Request     │
                    └──────────┬──────────┘
                               ↓
              ┌─────────────────────────────────┐
              │   🎯 FORMATAR RESPOSTA JSON    │ ← AQUI!
              │      (Nó CODE ou SET)           │
              └─────────────────────────────────┘
                               ↓
                        (ÚLTIMO NÓ)
                  (Webhook retorna este JSON)
```

---

## ⚠️ IMPORTANTE

- O nó "Formatar Resposta JSON" **DEVE SER O ÚLTIMO NÓ** do caminho de sucesso
- Não conecte mais nenhum nó após ele no caminho de sucesso
- O webhook está configurado com **"Response: Last Node"** para retornar o JSON formatado
- Se quiser continuar processando após retornar a resposta, você pode usar dois caminhos paralelos (mas isso é mais complexo)

---

## 📝 Checklist

- [ ] Nó CODE/SET "Formatar Resposta JSON" adicionado após "HTTP Request"
- [ ] Nó configurado com os campos corretos (src, dst, calldate, etc.)
- [ ] Webhook configurado com "Response: Last Node"
- [ ] Nó "Formatar Resposta JSON" é o último nó do caminho de sucesso
- [ ] Workflow salvo e ativado
- [ ] Teste realizado e resposta está no formato correto

