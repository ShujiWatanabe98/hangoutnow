# Hangout Now Development Rules

Hangout Now is a location-based activity matching social application.

Core concept: "Don't match people first. Match activities first."

Priorities: safety, simplicity, fast matching, privacy, performance, maintainability.

- Use TypeScript strict mode and avoid `any`.
- Validate every API input and test important business logic.
- Database changes require migrations.
- Never log passwords, tokens, exact GPS coordinates, private messages, or sensitive personal data.
- Never expose exact coordinates before a join request is accepted.
- Keep the main journey simple: Discover → Join → Match → Chat → Hangout.
- Run lint, typecheck, and tests before completing changes.
