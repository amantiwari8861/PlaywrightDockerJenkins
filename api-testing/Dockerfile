FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

COPY api-testing/package*.json ./
RUN npm ci

COPY api-testing/ .

WORKDIR /api-backend
COPY api-backend/package*.json ./
RUN npm ci --omit=dev
COPY api-backend/src ./src

WORKDIR /app

CMD ["npm", "test"]
