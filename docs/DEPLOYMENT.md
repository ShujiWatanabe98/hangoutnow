# Deployment

`render.yaml` creates the API, demo, PostgreSQL, and Key Value services. Before the first Blueprint deploy, provide all `S3_*` secret values. Production intentionally rejects new profile-photo uploads when object storage is not configured.

The S3-compatible bucket must allow public reads through `S3_PUBLIC_BASE_URL`; credentials must allow only object writes to the `profiles/` prefix. Configure Twilio values only when real SMS verification is required.

After deploy, verify `/health`, register a fictional user, upload a non-personal demo image, verify the phone flow, create a Hangout, join from a second fictional user, approve it, and confirm notification/chat delivery. Never seed local databases or real profile data into the public environment.
