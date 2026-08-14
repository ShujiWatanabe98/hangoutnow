# Architecture

The repository uses npm workspaces. Expo provides the mobile app, NestJS provides the REST API, and Next.js provides the admin UI. PostgreSQL/PostGIS stores durable and geospatial data.

The initial production target is approximately 100 registered users on one Render Starter API instance and the smallest paid Render PostgreSQL instance. Realtime delivery runs in the single API process at this stage. Redis-compatible coordination, background workers, replicas, and autoscaling are deliberately deferred until measured load or multiple API instances require them.

Profile image bytes are stored in S3-compatible object storage in production. PostgreSQL stores only the resulting object URL; the API container filesystem is never a durable media store.

All timestamps use UTC internally and ISO 8601 at API boundaries. Public APIs return approximate locations until a host accepts a join request.
