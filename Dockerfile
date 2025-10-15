# syntax=docker/dockerfile:1
FROM node:20-alpine AS runtime

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=3000

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
