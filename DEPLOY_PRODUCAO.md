# Deploy para Produção - Substituições de URL

## URL de Produção
`https://clicktocall-ipbx.krolik.com.br/`

---

## Arquivos que DEVEM ser alterados

### 1. `frontend/ClickCallKrolik.js`
**Linha 23**

**Substituir:**
```javascript
this.webhookServerUrl = 'http://localhost:4201';
```

**Por:**
```javascript
this.webhookServerUrl = 'https://clicktocall-ipbx.krolik.com.br';
```

---

### 2. `.env`
**Criar/Editar arquivo `.env` na raiz do projeto**

**Adicionar/Alterar:**
```env
FRONTEND_URL=https://clicktocall-ipbx.krolik.com.br
```

---

### 3. `docker-compose.yml` (se usar Docker)
**Linha 11**

**Substituir:**
```yaml
- FRONTEND_URL=http://localhost:4201
```

**Por:**
```yaml
- FRONTEND_URL=https://clicktocall-ipbx.krolik.com.br
```

---

## Resumo

- **`frontend/ClickCallKrolik.js`** linha 23: `http://localhost:4201` → `https://clicktocall-ipbx.krolik.com.br`
- **`.env`**: Adicionar `FRONTEND_URL=https://clicktocall-ipbx.krolik.com.br`
- **`docker-compose.yml`** linha 11 (se usar Docker): `http://localhost:4201` → `https://clicktocall-ipbx.krolik.com.br`

