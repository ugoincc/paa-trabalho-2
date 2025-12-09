# Usa uma imagem leve do Node.js
FROM node:18-alpine

# Cria diretório de trabalho no container
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências (Express, Axios, Pngjs, etc)
RUN npm install

# Copia todo o restante do código fonte
COPY . .

# Comando padrão (será sobrescrito no docker-compose)
CMD ["node", "src/distributed/httpWorker.js"]