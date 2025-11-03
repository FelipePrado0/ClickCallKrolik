# Usar imagem Node.js LTS
FROM node:18-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências (usa npm install se não tiver package-lock.json)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --production; fi

# Copiar código da aplicação
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY .env.example ./.env.example

# Criar pasta Data se não existir
RUN mkdir -p Data

# Expor porta
EXPOSE 4201

# Variável de ambiente para porta
ENV PORT=4201

# Comando para iniciar o servidor
CMD ["node", "backend/webhook-server.js"]

