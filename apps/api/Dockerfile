FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/demo/package.json apps/demo/package.json
COPY apps/roboreha/package.json apps/roboreha/package.json
COPY apps/salonrecord/package.json apps/salonrecord/package.json
COPY apps/aiocr/package.json apps/aiocr/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci --include=optional
RUN npm install --no-save --os=linux --libc=musl --cpu=x64 @img/sharp-linuxmusl-x64@0.35.3 @img/sharp-libvips-linuxmusl-x64@1.3.2
COPY apps/api apps/api
COPY apps/admin apps/admin
COPY apps/demo apps/demo
COPY apps/roboreha apps/roboreha
COPY apps/salonrecord apps/salonrecord
COPY apps/aiocr apps/aiocr
ENV NEXT_PUBLIC_ROBOREHA_BASE_PATH=/roboreha-app
RUN npm run prisma:generate -w @hangout-now/api \
    && npm run build -w @hangout-now/api \
    && npm run build -w @hangout-now/admin \
    && npm run build -w @method-more/roboreha
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && exec node apps/api/scripts/start-render-combined.mjs"]
