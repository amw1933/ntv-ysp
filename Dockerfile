FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY web ./web

ENV NODE_ENV=production
ENV PORT=8768
EXPOSE 8768

CMD ["node", "src/server.js"]
