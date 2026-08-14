# Infrastructure Decision — Initial 100 Users

**Date:** 2026-08-13  
**Status:** Accepted requirement and implemented in repository configuration

## Human requirement

- Initial release assumption: approximately 100 users
- Render Hobby Workspace
- Starter Web/API
- Smallest paid PostgreSQL
- Target infrastructure cost: approximately JPY 2,000–3,000/month
- S3-compatible profile image storage, never durable app-server storage
- No autoscaling or Render Pro at this stage
- Scale progressively to 1,000 and 10,000+ users

## Three-agent decision

### agent_marketing

100 initial users are a concentrated validation cohort, not a reason for broad acquisition. Campaign load must be shared before launch; Qualified Downloads, Activation and 3H Match remain the quality gates.

### agent_operation

One paid API and the smallest paid database minimize recurring cost. An unused Redis service is removed. Monthly cost and capacity are reviewed together; Customer Satisfaction and safety cannot be traded for lower cost.

### agent_development

The API remains a single stateless container except for in-process realtime/reminder coordination. Durable data goes to PostgreSQL and image bytes to S3-compatible object storage. Redis, workers, replicas and autoscaling are introduced only at measured thresholds.

## Repository changes

- `render.yaml`: API `starter`, DB `basic-256mb` with 1 GB disk; unused Key Value removed
- `docker-compose.yml`: unused Redis removed from the 100-user local topology
- `.env.example`: unused `REDIS_URL` removed
- `docs/ARCHITECTURE.md`: initial topology and object-storage boundary recorded
- `docs/DEPLOYMENT.md`: deployment and verification boundary updated
- `docs/INFRASTRUCTURE_SCALING.md`: 100 → 1,000 → 10,000+ thresholds
- Prisma schema: profile photo storage contract documented

## Cost caveat

The JPY target is not a fixed quote. Exchange rate, tax, S3-compatible storage, SMS, bandwidth and build overages are outside the core Render web+database estimate and must be monitored.
