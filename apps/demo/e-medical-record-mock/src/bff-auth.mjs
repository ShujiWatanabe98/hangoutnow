import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const loginLifetimeMs = 10 * 60 * 1000;
const defaultTokenTimeoutMs = 5_000;
const defaultTokenMaxBytes = 64 * 1024;

function randomOpaque(bytes = 32) { return randomBytes(bytes).toString('base64url'); }
function sha256(value) { return createHash('sha256').update(value).digest('base64url'); }
function constantEqual(left, right) {
  const a = Buffer.from(String(left || '')); const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}
function safeReturnTo(value) {
  const text = String(value || '/#/dashboard');
  return /^\/#\/[A-Za-z0-9/_?&=.%:-]*$/.test(text) ? text : '/#/dashboard';
}

function responseHeader(response, name) {
  if (typeof response?.headers?.get === 'function') return response.headers.get(name);
  const entry = response?.headers && Object.entries(response.headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry ? String(entry[1]) : null;
}

async function readBoundedTokenResponse(response, maximumBytes) {
  const contentLength = Number(responseHeader(response, 'content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) throw new Error('OIDC token response is too large.');
  const contentType = responseHeader(response, 'content-type');
  if (contentType && !/^application\/json(?:\s*;|$)/i.test(contentType)) throw new Error('OIDC token response is not JSON.');
  if (response?.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader(); const chunks = []; let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maximumBytes) {
          await reader.cancel('OIDC token response size limit exceeded.').catch(() => {});
          throw new Error('OIDC token response is too large.');
        }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock?.(); }
    return JSON.parse(Buffer.concat(chunks, length).toString('utf8'));
  }
  if (typeof response?.text === 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maximumBytes) throw new Error('OIDC token response is too large.');
    return JSON.parse(text);
  }
  if (typeof response?.json === 'function') {
    const value = await response.json();
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > maximumBytes) throw new Error('OIDC token response is too large.');
    return value;
  }
  throw new Error('OIDC token response has no readable body.');
}

function createEncryptedCodec({ currentKeyBase64, currentKeyId, tenantId, previousKeys = {} }) {
  const decodeKey = (value) => {
    const key = Buffer.from(String(value || ''), 'base64');
    if (key.length !== 32) throw new Error('BFF session encryption key must decode to 32 bytes.');
    return key;
  };
  const keys = new Map([...Object.entries(previousKeys).map(([keyId, value]) => [keyId, decodeKey(value)]), [currentKeyId, decodeKey(currentKeyBase64)]]);
  const aadFor = (keyId) => Buffer.from(JSON.stringify({ purpose: 'bff-auth-v1', tenantId, kmsKeyId: keyId }), 'utf8');
  return {
    encode(value) {
      const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', keys.get(currentKeyId), iv);
      cipher.setAAD(aadFor(currentKeyId));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      return `${Buffer.from(currentKeyId, 'utf8').toString('base64url')}.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
    },
    decode(value) {
      const [encodedKeyId, iv, tag, ciphertext] = String(value || '').split('.');
      if (!encodedKeyId || !iv || !tag || !ciphertext) throw new Error('Invalid encrypted BFF state.');
      const keyId = Buffer.from(encodedKeyId, 'base64url').toString('utf8'); const key = keys.get(keyId);
      if (!key) throw new Error('Unknown BFF encryption key.');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      decipher.setAAD(aadFor(keyId));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8'));
    }
  };
}

export function createMemoryBffStore({ now = () => Date.now() } = {}) {
  const records = new Map();
  return {
    durable: false,
    async put(kind, id, ciphertext, expiresAt) { records.set(`${kind}:${sha256(id)}`, { ciphertext, expiresAt }); },
    async get(kind, id) {
      const key = `${kind}:${sha256(id)}`; const record = records.get(key);
      if (!record || record.expiresAt <= now()) { records.delete(key); return null; }
      return record.ciphertext;
    },
    async take(kind, id) { const value = await this.get(kind, id); records.delete(`${kind}:${sha256(id)}`); return value; },
    async delete(kind, id) { records.delete(`${kind}:${sha256(id)}`); }
  };
}

export function createRepositoryBffStore(repository) {
  if (!repository || ['putAuthState', 'getAuthState', 'takeAuthState', 'deleteAuthState'].some((name) => typeof repository[name] !== 'function')) return null;
  return {
    durable: true,
    put: (kind, id, ciphertext, expiresAt) => repository.putAuthState(kind, id, ciphertext, expiresAt),
    get: (kind, id) => repository.getAuthState(kind, id),
    take: (kind, id) => repository.takeAuthState(kind, id),
    delete: (kind, id) => repository.deleteAuthState(kind, id)
  };
}

export function createBffAuthService(config, { authService, repository, fetchImpl = fetch, now = () => Date.now(), stateStore } = {}) {
  if (config.mode !== 'production') return null;
  const codec = createEncryptedCodec({
    currentKeyBase64: config.sessionEncryptionKey,
    currentKeyId: config.kmsKeyId || 'KMS-UNSET',
    tenantId: config.tenantId || 'TENANT-UNSET',
    previousKeys: config.sessionPreviousKeys || {}
  });
  const store = stateStore || createRepositoryBffStore(repository) || createMemoryBffStore({ now });
  const tokenTimeoutMs = Number.isInteger(config.oidcTokenTimeoutMs) ? config.oidcTokenTimeoutMs : defaultTokenTimeoutMs;
  const tokenMaxBytes = Number.isInteger(config.oidcTokenMaxBytes) ? config.oidcTokenMaxBytes : defaultTokenMaxBytes;

  async function put(kind, id, payload, expiresAt) { await store.put(kind, id, codec.encode(payload), expiresAt); }
  async function get(kind, id, take = false) {
    if (!id) return null;
    const encrypted = await (take ? store.take(kind, id) : store.get(kind, id));
    if (!encrypted) return null;
    try {
      const value = codec.decode(encrypted);
      if (!Number.isFinite(value.expiresAt) || value.expiresAt <= now()) { await store.delete(kind, id); return null; }
      return value;
    } catch { await store.delete(kind, id); return null; }
  }

  async function beginLogin(returnTo) {
    const transactionId = randomOpaque(); const state = randomOpaque(); const nonce = randomOpaque(); const verifier = randomOpaque();
    const challenge = sha256(verifier); const expiresAt = now() + loginLifetimeMs;
    await put('login', transactionId, { state, nonce, verifier, returnTo: safeReturnTo(returnTo), expiresAt }, expiresAt);
    const url = new URL(config.oidcAuthorizationUrl);
    Object.entries({
      response_type: 'code', response_mode: 'query', client_id: config.oidcClientId,
      redirect_uri: config.oidcRedirectUri, scope: config.oidcScopes.join(' '), state, nonce,
      code_challenge: challenge, code_challenge_method: 'S256', acr_values: config.oidcRequiredAcr || undefined
    }).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
    return { transactionId, authorizationUrl: url.href };
  }

  async function completeLogin({ transactionId, state, code }) {
    const transaction = await get('login', transactionId, true);
    if (!transaction || !code || !constantEqual(transaction.state, state)) throw Object.assign(new Error('OIDC login transaction is invalid or expired.'), { status: 401 });
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, client_id: config.oidcClientId, redirect_uri: config.oidcRedirectUri, code_verifier: transaction.verifier });
    const controller = new AbortController(); let timeoutId;
    const operation = fetchImpl(config.oidcTokenUrl, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body, redirect: 'error', signal: controller.signal });
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => { controller.abort(); reject(new Error('OIDC token request timed out.')); }, tokenTimeoutMs);
    });
    let response;
    try { response = await Promise.race([operation, timeout]); }
    finally { clearTimeout(timeoutId); }
    let tokens = null; try { tokens = await readBoundedTokenResponse(response, tokenMaxBytes); } catch {}
    if (!response.ok || !tokens?.access_token || !tokens?.id_token || String(tokens.token_type || '').toLowerCase() !== 'bearer') throw Object.assign(new Error('OIDC token exchange failed.'), { status: 401 });
    const [principal, idClaims] = await Promise.all([
      authService.verify(tokens.access_token),
      authService.verifyIdToken(tokens.id_token, { nonce: transaction.nonce, audience: config.oidcClientId })
    ]);
    if (!principal || !idClaims || principal.sub !== idClaims.sub) throw Object.assign(new Error('OIDC token validation failed.'), { status: 401 });
    const currentSeconds = Math.floor(now() / 1000);
    const responseExpiry = currentSeconds + Number(tokens.expires_in || 0);
    const expiresAt = Math.min(Number(principal.exp || 0), Number(idClaims.exp || 0), responseExpiry) * 1000;
    if (!Number.isFinite(expiresAt) || expiresAt <= now()) throw Object.assign(new Error('OIDC session expiry is invalid.'), { status: 401 });
    const sessionId = randomOpaque(); const csrfToken = randomOpaque();
    await put('session', sessionId, { principal, idClaims, accessToken: tokens.access_token, idToken: tokens.id_token, csrfToken, expiresAt }, expiresAt);
    return { sessionId, csrfToken, principal, idClaims, expiresAt, returnTo: transaction.returnTo };
  }

  async function getSession(sessionId) { return get('session', sessionId); }
  async function logout(sessionId) { const session = await getSession(sessionId); if (sessionId) await store.delete('session', sessionId); return session; }
  function verifyCsrf(session, supplied) { return Boolean(session?.csrfToken && supplied && constantEqual(session.csrfToken, supplied)); }

  return { beginLogin, completeLogin, getSession, logout, verifyCsrf, durable: store.durable };
}

export { safeReturnTo };
