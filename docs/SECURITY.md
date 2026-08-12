# Security Baseline

- Do not expose precise coordinates before a match.
- Do not log tokens, passwords, private messages, or precise coordinates.
- Validate input on the API boundary.
- Use short-lived access tokens and rotating refresh tokens when authentication is added.
- Limit registration and login to five attempts per minute per client; the default API limit is 60 requests per minute.
- Blocking and reporting are launch requirements, not optional enhancements.
