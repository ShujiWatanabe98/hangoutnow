export function createRateLimiter({ max = 120, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return {
    check(key, now = Date.now()) {
      let bucket = buckets.get(key);
      if (!bucket || now >= bucket.resetAt) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      return { allowed: bucket.count <= max, limit: max, remaining: Math.max(0, max - bucket.count), resetAt: bucket.resetAt };
    }
  };
}

function isLoopbackOrigin(origin) {
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

export function isOriginAllowed(runtimeConfig, origin) {
  if (!origin) return true;
  if (runtimeConfig.mode === 'demo' && isLoopbackOrigin(origin)) return true;
  return (runtimeConfig.corsOrigins || []).includes(origin);
}

export function applyCors(req, res, runtimeConfig) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!isOriginAllowed(runtimeConfig, origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match, Idempotency-Key, X-CSRF-Token, X-Request-ID, X-Demo-Role, X-Break-Glass-Grant');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, Location, X-Request-ID, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}
