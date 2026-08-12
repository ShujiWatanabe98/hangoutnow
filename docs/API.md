# API

## Health

`GET /health`

Response:

```json
{ "status": "ok", "service": "hangout-now-api" }
```

## Authentication

- `POST /auth/register` — email, password, display name, birth date; users must be 18 or older.
- `POST /auth/login` — returns a 15-minute access token and a rotating 30-day refresh token.
- `POST /auth/refresh` — invalidates the supplied refresh token and returns a new pair.
- `POST /auth/logout` — revokes the supplied refresh token.

## Profile

- `GET /users/me` — requires `Authorization: Bearer <accessToken>`.
- `PATCH /users/me` — updates display name, bio, home area, and interests.

Passwords and refresh tokens are never persisted as plaintext.

## Hangouts

Location-aware listing is available with `GET /hangouts?latitude=...&longitude=...&radiusKm=1..50`. Results are ordered by great-circle distance and include `distanceKm`. Before acceptance, only rounded public coordinates and `locationPrecision: APPROXIMATE` are returned; hosts and accepted participants also receive exact coordinates.

- `POST /hangouts` — creates a Hangout starting in 30, 60, or 180 minutes.
- `GET /hangouts?time=30|60|180` — lists open Hangouts with optional time filtering.
- `GET /hangouts/:id` — returns details. Exact coordinates are omitted before acceptance.
- `PATCH /hangouts/:id` — host-only update.
- `DELETE /hangouts/:id` — host-only cancellation.
- `POST /hangouts/:id/join` — creates one join request per user.
- `GET /hangouts/:id/requests` — host-only request list.
- `POST /join-requests/:id/accept` and `/reject` — host decision and capacity management.

## Chat

- Accepting the first participant creates one chat room for the Hangout.
- `GET /chat-rooms` — rooms available to the host or accepted participants.
- `GET /chat-rooms/:id/messages` — accepted members only.
- `POST /chat-rooms/:id/messages` — stores a validated text message.
- Pending, rejected, unrelated, and unauthenticated users cannot read or send messages.

## Safety

- `POST /safety/blocks/:userId`, `DELETE /safety/blocks/:userId`, `GET /safety/blocks`
- `POST /safety/reports` — reason, optional Hangout/details, and optional immediate block.
- Blocked users are mutually hidden and cannot join or chat.
- Duplicate reports for the same reporter, user, and Hangout return conflict.
- `GET /admin/reports` requires the separate `x-admin-token` secret.

## Profile verification

- `PATCH /users/me` accepts a JPEG, PNG, or WebP data URL in `profilePhoto` (the demo resizes it to at most 512 px).
- `POST /users/me/phone/request` starts a 10-minute, five-attempt verification challenge. Local development returns `demoCode`; production does not.
- Requests have a 60-second resend delay plus daily limits per account, phone number, and source IP.
- When all `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` values are configured, the server uses Twilio Verify SMS and never returns a demo code.
- `POST /users/me/phone/confirm` verifies the six-digit code and marks the user `PHONE_VERIFIED`.
- Creating a Hangout requires both a profile photo and a verified phone number.

## Notifications and realtime

- `GET /notifications`, `POST /notifications/:id/read`, and `POST /notifications/read-all` provide an in-app notification inbox and unread count.
- `PATCH /notifications/settings` enables or disables notification creation per user.
- Authenticated Socket.IO clients receive `notification` and `notifications:changed` events.
- Join requests, decisions, chat messages, and idempotent 15-minute reminders create notifications.
