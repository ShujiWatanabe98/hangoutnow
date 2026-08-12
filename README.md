# Hangout Now

「今から、誰かと。」を実現する、近距離・短時間の行動マッチングアプリです。

## Workspace

- `apps/mobile`: Expo / React Native client
- `apps/api`: NestJS API
- `apps/admin`: Next.js operations console
- `packages/shared`: shared domain types
- `packages/config`: shared configuration

## Start

1. Copy `.env.example` to `.env`.
2. Run `docker compose up -d` for PostGIS and Redis.
3. Run `npm install`.
4. Run `npm run dev:api`.
5. Open `http://localhost:3000/health`.

## Validation

Run `npm run lint`, `npm run typecheck`, and `npm test`.

## Interactive demo

Run `npm start -w @hangout-now/demo`, then open `http://127.0.0.1:4173`.
