FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci

COPY . .

RUN npm run build --workspace @itlab/contracts \
    && DATABASE_URL=postgresql://build:build@postgres:5432/build npm run db:generate --workspace @itlab/api \
    && npm run build --workspace @itlab/api

EXPOSE 3000

CMD ["sh", "-c", "npm run build --workspace @itlab/contracts && npm run db:generate --workspace @itlab/api && npm run db:deploy --workspace @itlab/api && npm run dev --workspace @itlab/api"]
