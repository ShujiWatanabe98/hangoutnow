# Deployment

`render.yaml` creates one Starter API service, one free demo service, and one `basic-256mb` PostgreSQL database with 1 GB storage. It is the approved approximately-100-user topology. The Render workspace remains Hobby, autoscaling is not enabled, and no paid Key Value/Redis service is provisioned.

Before the first Blueprint deploy, provide all `S3_*` secret values. Production intentionally rejects new profile-photo uploads when object storage is not configured. The API container filesystem must not be used for durable uploads.

The S3-compatible bucket must allow public reads through `S3_PUBLIC_BASE_URL`; credentials must allow only object writes to the `profiles/` prefix.

After deploy, verify `/health`, register a fictional user, upload a non-personal demo image, create a Hangout, join from a second fictional user, approve it, and confirm notification/chat delivery. Never seed local databases or real profile data into the public environment.

Do not describe a Blueprint sync or Git push as deployment proof. Confirm the public health endpoint, release identity, database migration, object upload, and the representative user journey separately.

Review cost and capacity monthly. Upgrade only when the thresholds in `docs/INFRASTRUCTURE_SCALING.md` are met; an expected future user count alone is not an upgrade trigger.
