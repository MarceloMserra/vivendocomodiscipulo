# Usa uma imagem leve do Node 20
FROM node:20-alpine

# Cria a pasta do app
WORKDIR /app

# Copia os arquivos de configuração
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o resto do código
COPY . .

# Cria as pastas de upload necessárias
RUN mkdir -p public/uploads/profiles && mkdir -p uploads_temp

# Expõe a porta 3000 (Padrão do Easypanel)
EXPOSE 3000

# Comando para iniciar
CMD ["node", "app.js"]