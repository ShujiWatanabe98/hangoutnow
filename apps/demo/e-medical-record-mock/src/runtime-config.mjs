const requiredProductionSettings = [
  'EMR_DATABASE_URL', 'EMR_OIDC_ISSUER', 'EMR_OIDC_AUDIENCE', 'EMR_OIDC_JWKS_URL',
  'EMR_OIDC_AUTHORIZATION_URL', 'EMR_OIDC_TOKEN_URL', 'EMR_OIDC_CLIENT_ID', 'EMR_OIDC_REQUIRED_ACR', 'EMR_OIDC_REQUIRED_AMR',
  'EMR_AUDIT_HMAC_SECRET', 'EMR_BACKUP_ENCRYPTION_KEY', 'EMR_SESSION_ENCRYPTION_KEY', 'EMR_PUBLIC_BASE_URL', 'EMR_KMS_KEY_ID', 'EMR_DATA_RESIDENCY_REGION', 'EMR_TENANT_ID'
];

export function loadRuntimeConfig(env = process.env) {
  const mode = env.EMR_RUNTIME_MODE === 'production' ? 'production' : 'demo';
  const deploymentStage = mode === 'production' ? String(env.EMR_DEPLOYMENT_STAGE || 'validation') : 'demo';
  const publicBaseUrl = env.EMR_PUBLIC_BASE_URL || 'http://127.0.0.1:4173';
  const missing = mode === 'production' ? requiredProductionSettings.filter((name) => !String(env[name] || '').trim()) : [];
  const invalid = [];
  if (!['demo', 'validation', 'public'].includes(deploymentStage)) invalid.push('EMR_DEPLOYMENT_STAGE must be validation or public in production');
  if (mode === 'production' && env.EMR_PUBLIC_BASE_URL && !env.EMR_PUBLIC_BASE_URL.startsWith('https://')) invalid.push('EMR_PUBLIC_BASE_URL must use https');
  if (mode === 'production' && env.EMR_OIDC_ISSUER && !env.EMR_OIDC_ISSUER.startsWith('https://')) invalid.push('EMR_OIDC_ISSUER must use https');
  if (mode === 'production' && env.EMR_OIDC_JWKS_URL && !env.EMR_OIDC_JWKS_URL.startsWith('https://')) invalid.push('EMR_OIDC_JWKS_URL must use https');
  if (mode === 'production' && env.EMR_OIDC_AUTHORIZATION_URL && !env.EMR_OIDC_AUTHORIZATION_URL.startsWith('https://')) invalid.push('EMR_OIDC_AUTHORIZATION_URL must use https');
  if (mode === 'production' && env.EMR_OIDC_TOKEN_URL && !env.EMR_OIDC_TOKEN_URL.startsWith('https://')) invalid.push('EMR_OIDC_TOKEN_URL must use https');
  if (mode === 'production' && env.EMR_OIDC_END_SESSION_URL && !env.EMR_OIDC_END_SESSION_URL.startsWith('https://')) invalid.push('EMR_OIDC_END_SESSION_URL must use https');
  if (mode === 'production' && env.EMR_OIDC_CLIENT_ID && !/^[A-Za-z0-9._:-]{3,128}$/.test(env.EMR_OIDC_CLIENT_ID)) invalid.push('EMR_OIDC_CLIENT_ID contains unsupported characters or length');
  if (mode === 'production' && String(env.EMR_AUDIT_HMAC_SECRET || '').length < 32) invalid.push('EMR_AUDIT_HMAC_SECRET must be at least 32 characters');
  if (mode === 'production' && Buffer.from(String(env.EMR_BACKUP_ENCRYPTION_KEY || ''), 'base64').length !== 32) invalid.push('EMR_BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes');
  if (mode === 'production' && Buffer.from(String(env.EMR_SESSION_ENCRYPTION_KEY || ''), 'base64').length !== 32) invalid.push('EMR_SESSION_ENCRYPTION_KEY must decode to exactly 32 bytes');
  if (mode === 'production' && env.EMR_KMS_KEY_ID && !/^[A-Za-z0-9._:/-]{1,200}$/.test(env.EMR_KMS_KEY_ID)) invalid.push('EMR_KMS_KEY_ID contains unsupported characters or length');
  if (mode === 'production' && env.EMR_DEMO_AUTH_ENABLED === 'true') invalid.push('EMR_DEMO_AUTH_ENABLED must not be true');
  const configuredOrigins = String(env.EMR_CORS_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
  const corsOrigins = configuredOrigins.length ? configuredOrigins : [new URL(publicBaseUrl).origin];
  if (mode === 'production' && corsOrigins.some((origin) => {
    try { return new URL(origin).origin !== origin || !origin.startsWith('https://'); } catch { return true; }
  })) invalid.push('EMR_CORS_ORIGINS must contain only comma-separated HTTPS origins');
  const rateLimitPerMinute = Number(env.EMR_RATE_LIMIT_PER_MINUTE || (mode === 'production' ? 120 : 1000));
  if (!Number.isInteger(rateLimitPerMinute) || rateLimitPerMinute < 10 || rateLimitPerMinute > 10_000) invalid.push('EMR_RATE_LIMIT_PER_MINUTE must be an integer from 10 to 10000');
  const shutdownDrainMs = Number(env.EMR_SHUTDOWN_DRAIN_MS ?? (mode === 'production' ? 5000 : 0));
  const shutdownTimeoutMs = Number(env.EMR_SHUTDOWN_TIMEOUT_MS ?? (mode === 'production' ? 30000 : 5000));
  if (!Number.isInteger(shutdownDrainMs) || shutdownDrainMs < 0 || shutdownDrainMs > 60_000) invalid.push('EMR_SHUTDOWN_DRAIN_MS must be an integer from 0 to 60000');
  if (!Number.isInteger(shutdownTimeoutMs) || shutdownTimeoutMs < 1000 || shutdownTimeoutMs > 120_000 || shutdownTimeoutMs <= shutdownDrainMs) invalid.push('EMR_SHUTDOWN_TIMEOUT_MS must be an integer from 1000 to 120000 and greater than EMR_SHUTDOWN_DRAIN_MS');
  const oidcMaxTokenAgeSeconds = Number(env.EMR_OIDC_MAX_TOKEN_AGE_SECONDS || 900);
  if (!Number.isInteger(oidcMaxTokenAgeSeconds) || oidcMaxTokenAgeSeconds < 60 || oidcMaxTokenAgeSeconds > 3600) invalid.push('EMR_OIDC_MAX_TOKEN_AGE_SECONDS must be an integer from 60 to 3600');
  const oidcJwksTimeoutMs = Number(env.EMR_OIDC_JWKS_TIMEOUT_MS || 3000);
  if (!Number.isInteger(oidcJwksTimeoutMs) || oidcJwksTimeoutMs < 250 || oidcJwksTimeoutMs > 10000) invalid.push('EMR_OIDC_JWKS_TIMEOUT_MS must be an integer from 250 to 10000');
  const oidcJwksMaxBytes = Number(env.EMR_OIDC_JWKS_MAX_BYTES || 262144);
  if (!Number.isInteger(oidcJwksMaxBytes) || oidcJwksMaxBytes < 4096 || oidcJwksMaxBytes > 1048576) invalid.push('EMR_OIDC_JWKS_MAX_BYTES must be an integer from 4096 to 1048576');
  const oidcJwksCacheMaxAgeSeconds = Number(env.EMR_OIDC_JWKS_CACHE_MAX_AGE_SECONDS || 300);
  if (!Number.isInteger(oidcJwksCacheMaxAgeSeconds) || oidcJwksCacheMaxAgeSeconds < 30 || oidcJwksCacheMaxAgeSeconds > 3600) invalid.push('EMR_OIDC_JWKS_CACHE_MAX_AGE_SECONDS must be an integer from 30 to 3600');
  const oidcJwksStaleIfErrorSeconds = Number(env.EMR_OIDC_JWKS_STALE_IF_ERROR_SECONDS || 60);
  if (!Number.isInteger(oidcJwksStaleIfErrorSeconds) || oidcJwksStaleIfErrorSeconds < 0 || oidcJwksStaleIfErrorSeconds > 300) invalid.push('EMR_OIDC_JWKS_STALE_IF_ERROR_SECONDS must be an integer from 0 to 300');
  const oidcTokenTimeoutMs = Number(env.EMR_OIDC_TOKEN_TIMEOUT_MS || 5000);
  if (!Number.isInteger(oidcTokenTimeoutMs) || oidcTokenTimeoutMs < 250 || oidcTokenTimeoutMs > 10000) invalid.push('EMR_OIDC_TOKEN_TIMEOUT_MS must be an integer from 250 to 10000');
  const oidcTokenMaxBytes = Number(env.EMR_OIDC_TOKEN_MAX_BYTES || 65536);
  if (!Number.isInteger(oidcTokenMaxBytes) || oidcTokenMaxBytes < 4096 || oidcTokenMaxBytes > 262144) invalid.push('EMR_OIDC_TOKEN_MAX_BYTES must be an integer from 4096 to 262144');
  const oidcAccessTokenTypes = String(env.EMR_OIDC_ACCESS_TOKEN_TYPES || 'at+jwt').split(',').map((item) => item.trim()).filter(Boolean);
  if (mode === 'production' && (!oidcAccessTokenTypes.length || oidcAccessTokenTypes.some((type) => !['at+jwt', 'JWT'].includes(type)))) invalid.push('EMR_OIDC_ACCESS_TOKEN_TYPES may contain only at+jwt or JWT');
  const oidcScopes = String(env.EMR_OIDC_SCOPES || 'openid profile user/*.read user/*.write').split(/\s+/).filter(Boolean);
  if (mode === 'production' && !oidcScopes.includes('openid')) invalid.push('EMR_OIDC_SCOPES must include openid');
  const oidcRedirectUri = env.EMR_OIDC_REDIRECT_URI || new URL('auth/callback', publicBaseUrl.endsWith('/') ? publicBaseUrl : `${publicBaseUrl}/`).href;
  let sessionPreviousKeys = {};
  if (mode === 'production' && env.EMR_SESSION_PREVIOUS_KEYS_JSON) {
    try {
      const parsed = JSON.parse(env.EMR_SESSION_PREVIOUS_KEYS_JSON);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length > 3) throw new Error('invalid key map');
      for (const [keyId, value] of Object.entries(parsed)) {
        if (!/^[A-Za-z0-9._:/-]{1,200}$/.test(keyId) || keyId === env.EMR_KMS_KEY_ID || Buffer.from(String(value || ''), 'base64').length !== 32) throw new Error('invalid key entry');
      }
      sessionPreviousKeys = parsed;
    } catch { invalid.push('EMR_SESSION_PREVIOUS_KEYS_JSON must be a JSON object of at most 3 key IDs mapped to 32-byte base64 keys'); }
  }
  if (mode === 'production') {
    try {
      if (new URL(oidcRedirectUri).origin !== new URL(publicBaseUrl).origin) invalid.push('EMR_OIDC_REDIRECT_URI must use the public application origin');
    } catch { invalid.push('EMR_OIDC_REDIRECT_URI must be an absolute URL'); }
  }
  if (missing.length || invalid.length) {
    const error = new Error(`Production startup blocked: ${[...missing.map((name) => `missing ${name}`), ...invalid].join('; ')}`);
    error.code = 'EMR-PROD-CONFIG';
    throw error;
  }
  return Object.freeze({
    mode,
    deploymentStage,
    demoAuthEnabled: mode === 'demo',
    publicBaseUrl,
    corsOrigins: Object.freeze(corsOrigins),
    rateLimitPerMinute,
    shutdownDrainMs,
    shutdownTimeoutMs,
    oidcIssuer: env.EMR_OIDC_ISSUER || null,
    oidcAudience: env.EMR_OIDC_AUDIENCE || null,
    oidcJwksUrl: env.EMR_OIDC_JWKS_URL || null,
    oidcAuthorizationUrl: env.EMR_OIDC_AUTHORIZATION_URL || null,
    oidcTokenUrl: env.EMR_OIDC_TOKEN_URL || null,
    oidcEndSessionUrl: env.EMR_OIDC_END_SESSION_URL || null,
    oidcClientId: env.EMR_OIDC_CLIENT_ID || null,
    oidcRedirectUri,
    oidcScopes: Object.freeze(oidcScopes),
    oidcRequiredAcr: env.EMR_OIDC_REQUIRED_ACR || null,
    oidcRequiredAmr: Object.freeze(String(env.EMR_OIDC_REQUIRED_AMR || '').split(',').map((item) => item.trim()).filter(Boolean)),
    oidcMaxTokenAgeSeconds,
    oidcJwksTimeoutMs,
    oidcJwksMaxBytes,
    oidcJwksCacheMaxAgeSeconds,
    oidcJwksStaleIfErrorSeconds,
    oidcTokenTimeoutMs,
    oidcTokenMaxBytes,
    oidcAccessTokenTypes: Object.freeze(oidcAccessTokenTypes),
    sessionEncryptionKey: env.EMR_SESSION_ENCRYPTION_KEY || null,
    sessionPreviousKeys: Object.freeze({ ...sessionPreviousKeys }),
    kmsKeyId: env.EMR_KMS_KEY_ID || null,
    dataResidencyRegion: env.EMR_DATA_RESIDENCY_REGION || null,
    databaseUrl: env.EMR_DATABASE_URL || null,
    databaseSsl: env.EMR_DATABASE_SSL === 'require',
    tenantId: env.EMR_TENANT_ID || 'TENANT-DEMO',
    persistence: mode === 'demo' ? 'in-memory' : 'postgres',
    productionReady: false
  });
}

export { requiredProductionSettings };
