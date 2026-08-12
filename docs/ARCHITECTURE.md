# Architecture

The repository uses npm workspaces. Expo provides the mobile app, NestJS provides the REST API, and Next.js provides the admin UI. PostgreSQL/PostGIS stores durable and geospatial data; Redis supports cache and realtime coordination.

All timestamps use UTC internally and ISO 8601 at API boundaries. Public APIs return approximate locations until a host accepts a join request.
