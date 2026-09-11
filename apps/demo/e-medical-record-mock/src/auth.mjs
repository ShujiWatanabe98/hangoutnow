import { createHmac, createPublicKey, randomBytes, timingSafeEqual, verify as verifySignature } from 'node:crypto';

const DEFAULT_JWKS_TIMEOUT_MS = 3_000;
const DEFAULT_JWKS_MAX_BYTES = 256 * 1024;
const DEFAULT_JWKS_CACHE_MAX_AGE_SECONDS = 300;
const DEFAULT_JWKS_STALE_IF_ERROR_SECONDS = 60;
const UNKNOWN_KID_COOLDOWN_MS = 10_000;
const MAX_JWT_BYTES = 16 * 1024;
const MAX_JWKS_KEYS = 100;

function encode(value) { return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url'); }

function decode(value, maximumBytes = MAX_JWT_BYTES) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > maximumBytes * 2) throw new Error('Invalid JWT encoding.');
  const decoded = Buffer.from(value, 'base64url');
  if (!decoded.length || decoded.length > maximumBytes) throw new Error('JWT segment is too large.');
  return JSON.parse(decoded.toString('utf8'));
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function responseHeader(response, name) {
  if (typeof response?.headers?.get === 'function') return response.headers.get(name);
  const headers = response?.headers;
  if (!headers || typeof headers !== 'object') return null;
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry ? String(entry[1]) : null;
}

function cacheDirectives(value) {
  const result = new Map();
  for (const raw of String(value || '').split(',')) {
    const [rawName, ...rawValue] = raw.trim().split('=');
    const name = rawName.toLowerCase();
    if (!name) continue;
    result.set(name, rawValue.length ? rawValue.join('=').trim().replace(/^"|"$/g, '') : true);
  }
  return result;
}

function boundedDirectiveSeconds(directives, name, fallback, maximum) {
  if (!directives.has(name)) return Math.min(fallback, maximum);
  const value = Number(directives.get(name));
  return Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), maximum) : 0;
}

async function readBoundedJson(response, maximumBytes) {
  const contentLength = Number(responseHeader(response, 'content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) throw new Error('OIDC JWKS response is too large.');
  const contentType = responseHeader(response, 'content-type');
  if (contentType && !/(?:application\/json|application\/jwk-set\+json)(?:\s*;|$)/i.test(contentType)) throw new Error('OIDC JWKS response is not JSON.');

  if (response?.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maximumBytes) {
          await reader.cancel('JWKS response size limit exceeded.').catch(() => {});
          throw new Error('OIDC JWKS response is too large.');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock?.();
    }
    return JSON.parse(Buffer.concat(chunks, length).toString('utf8'));
  }

  if (typeof response?.text === 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maximumBytes) throw new Error('OIDC JWKS response is too large.');
    return JSON.parse(text);
  }

  // Minimal fetch doubles used by unit tests may expose only json(). Re-encode
  // the result so the same upper bound still applies.
  if (typeof response?.json === 'function') {
    const document = await response.json();
    if (Buffer.byteLength(JSON.stringify(document), 'utf8') > maximumBytes) throw new Error('OIDC JWKS response is too large.');
    return document;
  }
  throw new Error('OIDC JWKS response has no readable body.');
}

function validateJwksDocument(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document) || !Array.isArray(document.keys)) throw new Error('OIDC JWKS does not contain keys.');
  if (!document.keys.length || document.keys.length > MAX_JWKS_KEYS) throw new Error('OIDC JWKS key count is outside the permitted range.');
  for (const key of document.keys) {
    if (!key || typeof key !== 'object' || Array.isArray(key)) throw new Error('OIDC JWKS contains an invalid key.');
  }
  return document.keys;
}

function selectVerificationKey(keys, header) {
  const matches = keys.filter((item) => item.kid === header.kid
    && item.kty === 'RSA'
    && item.use === 'sig'
    && item.alg === 'RS256'
    && (!item.key_ops || (Array.isArray(item.key_ops) && item.key_ops.includes('verify'))));
  if (matches.length !== 1) return null;
  try {
    const key = createPublicKey({ key: matches[0], format: 'jwk' });
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) return null;
    return key;
  } catch {
    return null;
  }
}

export function createAuthService(config, { fetchImpl = fetch, now = () => Date.now() } = {}) {
  const demoSecret = process.env.EMR_MOCK_JWT_SECRET?.trim() || randomBytes(32).toString('hex');
  const jwksTimeoutMs = positiveInteger(config.oidcJwksTimeoutMs, DEFAULT_JWKS_TIMEOUT_MS);
  const jwksMaxBytes = positiveInteger(config.oidcJwksMaxBytes, DEFAULT_JWKS_MAX_BYTES);
  const jwksCacheMaximumSeconds = positiveInteger(config.oidcJwksCacheMaxAgeSeconds, DEFAULT_JWKS_CACHE_MAX_AGE_SECONDS);
  const jwksStaleMaximumSeconds = positiveInteger(config.oidcJwksStaleIfErrorSeconds, DEFAULT_JWKS_STALE_IF_ERROR_SECONDS);
  const acceptedTokenTypes = new Set((Array.isArray(config.oidcAccessTokenTypes) && config.oidcAccessTokenTypes.length
    ? config.oidcAccessTokenTypes : ['at+jwt']).map((value) => String(value).toLowerCase()));
  let jwksCache = null;
  let jwksGeneration = 0;
  let jwksRequest = null;
  const unknownKids = new Map();

  function issueDemoToken({ sub = 'demo-client', practitionerId = 'PRACT-001', scope = 'system/*.read system/*.write' } = {}) {
    if (!config.demoAuthEnabled) throw Object.assign(new Error('Demo token issuance is disabled.'), { status: 404 });
    const issuedAt = Math.floor(now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT', kid: 'mock-dev-key' });
    const payload = encode({ iss: 'https://mock.example.jp/oauth', sub, aud: 'https://mock.example.jp/api', iat: issuedAt, exp: issuedAt + 300, scope, practitioner_id: practitionerId, tenant_id: 'TENANT-DEMO' });
    const signature = createHmac('sha256', demoSecret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
  }

  async function requestJwks() {
    const controller = new AbortController();
    let timeoutId;
    const operation = (async () => {
      const response = await fetchImpl(config.oidcJwksUrl, {
        headers: { Accept: 'application/jwk-set+json, application/json' },
        redirect: 'error',
        signal: controller.signal
      });
      if (!response?.ok) throw new Error(`OIDC JWKS request failed: ${response?.status ?? 'unknown'}`);
      const document = await readBoundedJson(response, jwksMaxBytes);
      const keys = validateJwksDocument(document);
      const directives = cacheDirectives(responseHeader(response, 'cache-control'));
      const noStore = directives.has('no-store');
      const mustRevalidate = directives.has('no-cache') || directives.has('must-revalidate');
      const age = Math.max(0, Number(responseHeader(response, 'age')) || 0);
      const maxAge = noStore ? 0 : boundedDirectiveSeconds(directives, 'max-age', DEFAULT_JWKS_CACHE_MAX_AGE_SECONDS, jwksCacheMaximumSeconds);
      const declaredStale = directives.has('stale-if-error')
        ? boundedDirectiveSeconds(directives, 'stale-if-error', 0, jwksStaleMaximumSeconds) : 0;
      const staleIfError = noStore || (mustRevalidate && !directives.has('stale-if-error')) ? 0 : declaredStale;
      const fetchedAt = now();
      return {
        keys,
        freshUntil: fetchedAt + Math.max(0, maxAge - age) * 1000,
        staleUntil: fetchedAt + Math.max(0, maxAge + staleIfError - age) * 1000
      };
    })();
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort(new Error('OIDC JWKS request timed out.'));
        reject(new Error('OIDC JWKS request timed out.'));
      }, jwksTimeoutMs);
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function refreshJwks() {
    if (jwksRequest) return jwksRequest;
    const request = (async () => {
      const next = await requestJwks();
      jwksGeneration += 1;
      jwksCache = { ...next, generation: jwksGeneration };
      unknownKids.clear();
      return jwksCache;
    })();
    jwksRequest = request;
    try {
      return await request;
    } finally {
      if (jwksRequest === request) jwksRequest = null;
    }
  }

  async function loadJwks() {
    const current = now();
    if (jwksCache && jwksCache.freshUntil > current) return { cache: jwksCache, source: 'cache' };
    try {
      return { cache: await refreshJwks(), source: 'network' };
    } catch (error) {
      // Stale keys are used only when the IdP explicitly advertised
      // stale-if-error, only for keys already cached, and only within the
      // configured upper bound. Unknown keys never use this fallback.
      if (jwksCache && jwksCache.staleUntil > now()) return { cache: jwksCache, source: 'stale', error };
      throw error;
    }
  }

  async function keyForHeader(header) {
    let loaded = await loadJwks();
    let key = selectVerificationKey(loaded.cache.keys, header);
    if (key) return key;

    const negative = unknownKids.get(header.kid);
    if (negative?.generation === loaded.cache.generation && negative.until > now()) return null;

    // If this verification already fetched the IdP (or fell back to stale
    // after a failed fetch), another request would add no trustworthy data.
    // Otherwise an unknown kid gets exactly one forced, single-flight refresh
    // to support safe signing-key rotation.
    if (loaded.source === 'cache') {
      try {
        loaded = { cache: await refreshJwks(), source: 'network' };
        key = selectVerificationKey(loaded.cache.keys, header);
        if (key) return key;
      } catch {
        return null;
      }
    }
    unknownKids.set(header.kid, { generation: loaded.cache.generation, until: now() + UNKNOWN_KID_COOLDOWN_MS });
    if (unknownKids.size > MAX_JWKS_KEYS) unknownKids.delete(unknownKids.keys().next().value);
    return null;
  }

  async function verify(token) {
    if (typeof token !== 'string' || Buffer.byteLength(token, 'utf8') > MAX_JWT_BYTES) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[2] || !/^[A-Za-z0-9_-]+$/.test(parts[2])) return null;
    try {
      const header = decode(parts[0], 4096); const payload = decode(parts[1]); const current = Math.floor(now() / 1000);
      if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      if (config.mode === 'demo') {
        if (header.alg !== 'HS256') return null;
        const expected = Buffer.from(createHmac('sha256', demoSecret).update(`${parts[0]}.${parts[1]}`).digest('base64url'));
        const actual = Buffer.from(parts[2]);
        if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
        if (payload.exp <= current || payload.aud !== 'https://mock.example.jp/api') return null;
        return payload;
      }
      if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.kid.length > 128) return null;
      if (typeof header.typ !== 'string' || !acceptedTokenTypes.has(header.typ.toLowerCase())) return null;
      if (header.crit !== undefined || header.jwk !== undefined || header.jku !== undefined || header.x5u !== undefined) return null;
      const key = await keyForHeader(header);
      if (!key) return null;
      const validSignature = verifySignature('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
      const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      const clockSkew = 60; const maxTokenAge = config.oidcMaxTokenAgeSeconds || 900;
      const amr = Array.isArray(payload.amr) ? payload.amr : [];
      const requiredAmr = Array.isArray(config.oidcRequiredAmr) ? config.oidcRequiredAmr : [];
      if (!validSignature || payload.iss !== config.oidcIssuer || !audience.includes(config.oidcAudience)) return null;
      if (typeof payload.client_id !== 'string' || payload.client_id !== config.oidcClientId) return null;
      if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 256 || typeof payload.jti !== 'string' || !payload.jti || payload.jti.length > 256) return null;
      if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
      if (payload.exp <= current - clockSkew || payload.iat > current + clockSkew || current - payload.iat > maxTokenAge || payload.exp - payload.iat > maxTokenAge) return null;
      if (payload.nbf !== undefined && (!Number.isInteger(payload.nbf) || payload.nbf > current + clockSkew)) return null;
      if (config.oidcRequiredAcr && payload.acr !== config.oidcRequiredAcr) return null;
      if (requiredAmr.some((method) => !amr.includes(method))) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async function verifyIdToken(token, { nonce, audience = config.oidcClientId } = {}) {
    if (typeof token !== 'string' || Buffer.byteLength(token, 'utf8') > MAX_JWT_BYTES || config.mode !== 'production') return null;
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[2] || !/^[A-Za-z0-9_-]+$/.test(parts[2])) return null;
    try {
      const header = decode(parts[0], 4096); const payload = decode(parts[1]); const current = Math.floor(now() / 1000);
      if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      if (header.alg !== 'RS256' || header.typ !== 'JWT' || typeof header.kid !== 'string' || !header.kid || header.kid.length > 128) return null;
      if (header.crit !== undefined || header.jwk !== undefined || header.jku !== undefined || header.x5u !== undefined) return null;
      const key = await keyForHeader(header); if (!key) return null;
      const validSignature = verifySignature('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]; const clockSkew = 60;
      if (!validSignature || payload.iss !== config.oidcIssuer || !audiences.includes(audience)) return null;
      if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 256 || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
      if (payload.exp <= current - clockSkew || payload.iat > current + clockSkew || current - payload.iat > (config.oidcMaxTokenAgeSeconds || 900)) return null;
      if (typeof nonce !== 'string' || typeof payload.nonce !== 'string' || !timingSafeTextEqual(payload.nonce, nonce)) return null;
      if ((audiences.length > 1 && typeof payload.azp !== 'string') || (payload.azp !== undefined && payload.azp !== audience)) return null;
      return payload;
    } catch { return null; }
  }

  return { issueDemoToken, verify, verifyIdToken };
}

function timingSafeTextEqual(left, right) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
