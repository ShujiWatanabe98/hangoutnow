FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/demo/package.json apps/demo/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci
COPY apps/api apps/api
RUN npm run prisma:generate -w @hangout-now/api && npm run build -w @hangout-now/api
EXPOSE 3000
CMD ["node", "apps/api/dist/src/main.js"]
