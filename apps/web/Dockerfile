FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace", "@itlab/web", "--", "--host", "0.0.0.0"]
