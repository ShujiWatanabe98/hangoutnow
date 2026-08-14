# Infrastructure Scaling Plan

## Decision

Hangout Now starts with approximately 100 registered users and prioritizes a low-cost, stable MVP. Infrastructure is increased from measurements, not from speculative future scale.

## Stage 1 — Approximately 100 users

### Topology

- Render Hobby Workspace
- One Docker Web/API service: `starter` (512 MB RAM, 0.5 CPU)
- Render PostgreSQL: `basic-256mb`, 1 GB disk
- Demo web service: free while it is needed for development/demo use
- S3-compatible object storage for profile images
- One API process for REST, Socket.IO and lightweight reminder scheduling
- No autoscaling, read replica, background worker, paid Redis/Key Value, or Render Pro workspace

### Expected infrastructure cost

Render stated in July 2026 that an always-on Starter web service plus Basic-256mb PostgreSQL on Hobby typically costs about USD 13/month before bandwidth and storage growth. Exchange rates, taxes, object storage, SMS, bandwidth and build overages are separate. Therefore JPY 2,000–3,000 is a target and budget guardrail, not a guaranteed invoice.

Sources checked 2026-08-13:

- https://render.com/docs/new-workspace-plans
- https://render.com/docs/compute-plans
- https://render.com/docs/blueprint-spec
- https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses

### Operating limits

- All durable relational data stays in PostgreSQL.
- Production image uploads fail closed if S3-compatible storage is not configured.
- The API filesystem is disposable and contains no required customer data.
- Database migrations remain the only schema-change mechanism.
- Only one API instance is used, so in-process Socket.IO delivery and reminder scheduling are acceptable temporarily.
- Reminder creation must remain idempotent because process restarts can repeat a scan.

### Monthly checks

- API memory, CPU, restart count, p95 latency and 5xx rate
- PostgreSQL CPU, memory, connections, storage and slow queries
- S3 storage, request count and failed uploads
- outbound bandwidth and build-minute overages
- registered users, DAU, peak concurrent users and active Socket.IO connections
- backup/PITR availability and a documented restore check

## Stage 2 — Approximately 1,000 users

Do not enter this stage solely because registered users reach 1,000. Review the architecture when one or more thresholds persist during representative peak periods:

- API p95 latency above 500 ms for core reads
- sustained API memory above 75% or repeated out-of-memory restarts
- sustained CPU above 70%
- database connection use above 70% of the configured limit
- slow geospatial queries or application-memory distance filtering becomes material
- reminder or notification work delays user requests
- supportable load requires more than one API instance

Candidate changes, applied independently according to the bottleneck:

1. Replace application-memory distance filtering with indexed PostGIS queries.
2. Add connection pooling and measure pool saturation.
3. Move reminders and notification fan-out to a background worker.
4. Add paid Redis-compatible coordination only when multiple processes or a durable queue require it.
5. Upgrade API or database one size at a time.
6. Add CDN/private object access strategy if profile-image traffic warrants it.

## Stage 3 — 10,000 or more users

Entry requires production evidence and a capacity test. Likely capabilities include:

- Multiple stateless API instances
- Redis-compatible Socket.IO adapter and durable job queue
- Separate background workers
- PostGIS indexes and query-plan monitoring
- PostgreSQL connection pooling, larger compute and evaluated high availability
- Object storage CDN, lifecycle and deletion processes
- Autoscaling only after safe minimum/maximum instances and cost alerts are defined
- Dedicated staging environment and controlled migration rollout
- Stronger observability, on-call and tested backup restoration

These are planned options, not currently implemented or approved spend.

## Upgrade decision record

Every infrastructure change must state:

- measured bottleneck and time window
- customer or safety impact
- alternatives considered
- one-time and monthly cost change
- success metric and rollback condition
- approval owner

## Cost guardrail

`agent_operation` reviews monthly cost per Activated User and per completed Hangout. `agent_development` supplies capacity evidence. `agent_marketing` supplies expected campaign load before a planned acquisition event. The three agents agree on the smallest safe change before requesting human approval.
