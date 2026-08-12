# Development MVP Gap Assessment

## Outcome

MarketingとOperationの要求を理解した結果、次の開発成果を最優先にします。

> 2人の成人テスターがモバイルアプリで、登録、発見、参加申請、承認、正確な集合場所の解禁、チャット、開催完了、相互フィードバックまで安全に完走できる。

## Current implementation assessment

| Journey / capability | API | Demo | Mobile | Tests | Decision |
|---|---|---|---|---|---|
| Registration and adult check | Implemented | Implemented | Missing | Partial | Mobile implementation required |
| Profile and phone verification | Implemented | Implemented | Missing | Partial | Mobile implementation required |
| Discover / manual area | Implemented in basic form | Implemented | Missing | Missing | P0 |
| Create Hangout | Implemented | Implemented | Missing | Missing | P0 |
| Join / approve / reject | Implemented | Implemented | Missing | Missing | P0 plus concurrency fix |
| Exact location after approval | API logic exists | Display exists | Missing | Missing | P0 security tests |
| Chat | Implemented | Implemented | Missing | Missing | P0 |
| Notifications | Implemented | Implemented | Missing | Missing | P1 for Alpha |
| Block / report | Implemented | Implemented | Missing | Missing | P0 before external test |
| Attendance / mutual feedback | Missing | Cosmetic rating only | Missing | Missing | P0 to complete product journey |
| Admin report workflow | Read-only, shared token | Minimal page unknown capability | N/A | Missing | P0 before public launch |
| Analytics / attribution | Missing | Missing | Missing | Missing | P0 before acquisition |
| Share page / deep link | Missing | Missing | Missing | Missing | P1 before pre-launch |

## Confirmed technical risks

### P0: Capacity race

`HangoutService.decide` counts accepted users before the transaction and then updates inside a transaction. Concurrent approvals can observe the same count and exceed capacity. The fix requires an atomic database-side guard or serializable/locking strategy plus a concurrent test.

### P0: Insufficient business E2E coverage

Only health and authentication E2E files exist. Hangout authorization, capacity, coordinate visibility, chat membership, block/report, and notifications are not protected by automated regression tests.

### P0: Mobile journey missing

`apps/mobile/src/App.tsx` currently renders only the brand and title. The working browser demo does not establish iOS/Android readiness.

### P0 before public release: Admin authentication

`GET /admin/reports` uses a shared `x-admin-token`. This is not a sufficient final operations model because it lacks named operators, least privilege, session controls, and audit history.

### P0: Completion and feedback missing

The product document includes meet and mutual feedback, but there are no attendance or feedback models/endpoints. Marketing cannot measure satisfaction or use validated quality signals without them.

### P1: Geospatial implementation mismatch

The architecture says PostGIS, but the current Prisma schema stores coordinates as `Float` and the API loads rows then calculates/filter distances in application memory. This may be acceptable for a very small alpha but is not ready for scale or the documented architecture.

### P1: Participant-to-participant blocking review

Chat access checks a member against the host’s block relationship. In a group Hangout, blocking between two accepted non-host participants needs explicit expected behavior and tests.

### P1: Notification privacy

Chat message bodies are copied into Notification records. Before push notification work, define whether private message text may appear on lock screens; default to a generic notification unless the user explicitly opts in.

## Prioritized implementation slices

### DEV-001 — Business safety regression suite

- Add E2E coverage for create, discover, join, authorization, coordinate precision, block/report, chat access and notification settings.
- Acceptance: API direct calls cannot bypass the stated boundaries.

### DEV-002 — Atomic capacity and state transitions

- Make approval atomic under concurrent requests.
- Add a test that attempts simultaneous final-slot approvals and proves capacity is not exceeded.

### DEV-003 — Mobile vertical slice

- Implement register/login, manual area, discover, detail, join, host approval, approved location and chat.
- Include loading, empty, error, retry and location-denied states.

### DEV-004 — Attendance and mutual feedback

- Add migrations, validated API, authorization, idempotency and mobile UI.
- Do not expose individual private feedback publicly until moderation and aggregation rules are approved.

### DEV-005 — Safety operations

- Implement mobile block/report and an authenticated, auditable admin workflow.
- Publish support contact and response-state handling before external acquisition.

### DEV-006 — Privacy-preserving growth measurement

- Define and implement anonymous funnel events using coarse area buckets, not exact coordinates.
- Measure source to Activation, 3H Match, Attendance and D7.

### DEV-007 — Share and deep-link journey

- Public page shows activity, time, approximate area and availability without exact coordinates.
- After install/login, return the user to the intended Hangout.

## Development response to other agents

### Response to agent_marketing

- **Feasibility:** The activity-first proposition is compatible with the API and demo.
- **Constraint:** No acquisition should start until the mobile vertical slice, safety controls and measurement exist.
- **Alternative:** Conduct message and interview research without collecting app installs.

### Response to agent_operation

- **Feasibility:** A 20-person closed alpha can use a small manual host roster.
- **Automation priority:** Host reminders, request decision reminders, structured support categories and attendance prompts reduce recurring work.
- **Constraint:** Admin shared-token access must not become the public operations model.

