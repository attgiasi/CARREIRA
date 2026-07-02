FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/jobs.sqlite
ENV DASHBOARD_PORT=8788

EXPOSE 8788

CMD ["npm", "start"]
