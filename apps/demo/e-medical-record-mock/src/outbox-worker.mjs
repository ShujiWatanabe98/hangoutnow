const wait = (milliseconds, signal) => new Promise((resolve) => {
  if (signal?.aborted) return resolve();
  const timer = setTimeout(resolve, milliseconds);
  timer.unref?.();
  signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});

function safeMonitorCode(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(value) ? value : 'database-unavailable';
}

export function boundedRetryAfter(value, { now = Date.now(), maximumMs = 3_600_000 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(String(value)) - now;
  if (!Number.isFinite(milliseconds)) return null;
  return Math.max(0, Math.min(maximumMs, Math.round(milliseconds)));
}

export function exponentialBackoff(attemptCount, { baseMs = 1000, maximumMs = 300_000, random = Math.random } = {}) {
  const exponent = Math.max(0, Math.min(20, Number(attemptCount) - 1));
  const cap = Math.min(maximumMs, baseMs * (2 ** exponent));
  return Math.max(0, Math.round(cap * (0.5 + Math.max(0, Math.min(1, random())) * 0.5)));
}

export function safeOutboundHeaders(headers = {}) {
  const allowed = new Set(['traceparent', 'tracestate', 'x-correlation-id']);
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalized = String(name).toLowerCase();
    if (allowed.has(normalized) && typeof value === 'string' && value.length <= 1000 && !/[\r\n]/.test(value)) result[normalized] = value;
  }
  return result;
}

export function classifyPublisherFailure(status) {
  if (!Number.isInteger(status)) return { retry: true, category: 'network' };
  if (status >= 500 || [408, 409, 425, 429].includes(status)) return { retry: true, category: 'transient' };
  if ([401, 403].includes(status)) return { retry: true, category: 'authentication', minimumDelayMs: 60_000 };
  if ([400, 404, 405, 410, 413, 415, 422].includes(status)) return { retry: false, category: 'request-rejected' };
  return { retry: false, category: 'non-retryable-http' };
}

export function validatedHttpsDestination(value, allowedHosts) {
  const hosts = allowedHosts instanceof Set ? allowedHosts : new Set(allowedHosts || []);
  const destination = new URL(value);
  if (destination.protocol !== 'https:' || destination.username || destination.password
      || !hosts.has(destination.hostname.toLowerCase())) {
    throw new Error('Outbox destination must be HTTPS and use an explicitly allowed host.');
  }
  return destination;
}

export function validateOutboxWorkerRuntimeConfig(environment) {
  const stage = String(environment.EMR_DEPLOYMENT_STAGE || 'demo').trim().toLowerCase();
  const productionLike = stage === 'public' || stage === 'production';
  const explicitTenantId = String(environment.EMR_TENANT_ID || '').trim();
  const ssl = environment.EMR_DATABASE_SSL === 'true';
  if (productionLike && !explicitTenantId) throw new Error('EMR_TENANT_ID is required for a public/production outbox worker.');
  if (productionLike && !ssl) throw new Error('EMR_DATABASE_SSL=true is required for a public/production outbox worker.');
  return { stage, tenantId: explicitTenantId || 'TENANT-DEMO', ssl };
}

export class OutboxWorker {
  constructor(repository, publisher, {
    workerId, batchSize = 1, leaseMs = 30_000, publishTimeoutMs = 20_000, pollMs = 1000, maxAttempts = 10,
    maximumRetryAfterMs = 3_600_000, random = Math.random, classifyFailure = classifyPublisherFailure,
    monitor = (event) => console.error(JSON.stringify(event))
  } = {}) {
    if (!repository || typeof repository.claimOutbox !== 'function') throw new Error('An outbox repository is required.');
    if (typeof publisher !== 'function') throw new Error('An injectable outbox publisher is required.');
    if (typeof workerId !== 'string' || !workerId.trim()) throw new Error('workerId is required.');
    if (batchSize !== 1) throw new Error('batchSize must be 1 until claims are processed concurrently with lease protection.');
    if (!Number.isInteger(leaseMs) || leaseMs < 6000 || leaseMs > 300_000) throw new Error('leaseMs must be from 6000 through 300000.');
    if (!Number.isInteger(publishTimeoutMs) || publishTimeoutMs < 1000 || publishTimeoutMs > leaseMs - 5000) throw new Error('publishTimeoutMs must leave at least 5000ms of lease safety margin.');
    if (typeof classifyFailure !== 'function') throw new Error('classifyFailure must be a function.');
    if (typeof monitor !== 'function') throw new Error('monitor must be a function.');
    this.repository = repository;
    this.publisher = publisher;
    this.options = { workerId, batchSize, leaseMs, publishTimeoutMs, pollMs, maxAttempts, maximumRetryAfterMs, random, classifyFailure, monitor };
    this.stopping = false;
  }

  stop() { this.stopping = true; }

  async runBatch() {
    const events = await this.repository.claimOutbox({
      workerId: this.options.workerId, limit: this.options.batchSize, leaseMs: this.options.leaseMs, maxAttempts: this.options.maxAttempts
    });
    const results = [];
    for (const event of events) {
      if (this.stopping) break;
      let publisherError = null;
      let published = null;
      let heartbeatError = null;
      const publishAbort = new AbortController();
      const heartbeat = setInterval(() => {
        this.repository.extendOutboxLease({ eventId: event.event_id, workerId: this.options.workerId, leaseMs: this.options.leaseMs })
          .catch((error) => { heartbeatError = error; publishAbort.abort(error); });
      }, Math.max(1000, Math.floor(this.options.leaseMs / 3)));
      heartbeat.unref?.();
      const timeout = setTimeout(() => publishAbort.abort(new Error('publisher-timeout')), this.options.publishTimeoutMs);
      timeout.unref?.();
      try {
        published = await this.publisher(event, { signal: publishAbort.signal });
        if (published?.ok === false) {
          const failure = new Error(`Publisher rejected event with status ${published.status || 'unknown'}.`);
          failure.code = Number.isInteger(published.status) ? `publisher-http-${published.status}` : 'publisher-rejected';
          failure.retryAfter = published.retryAfter;
          throw failure;
        }
      } catch (error) { publisherError = error; }
      finally { clearInterval(heartbeat); clearTimeout(timeout); }
      if (heartbeatError) {
        results.push({ eventId: event.event_id, state: 'repository-error', code: heartbeatError.code || 'database-unavailable' });
        continue;
      }
      if (!publisherError) {
        try {
          await this.repository.acknowledgeOutbox({ eventId: event.event_id, workerId: this.options.workerId });
          results.push({ eventId: event.event_id, state: 'published' });
        } catch (error) {
          results.push({ eventId: event.event_id, state: 'repository-error', code: error.code || 'database-unavailable' });
        }
      } else {
        const statusMatch = /^publisher-http-(\d{3})$/.exec(String(publisherError.code || ''));
        const classification = this.options.classifyFailure(statusMatch ? Number(statusMatch[1]) : null, publisherError, event);
        const retryAfter = boundedRetryAfter(publisherError.retryAfter, { maximumMs: this.options.maximumRetryAfterMs });
        const retryDelayMs = Math.max(classification.minimumDelayMs || 0,
          retryAfter ?? exponentialBackoff(event.attemptCount, { random: this.options.random }));
        try {
          const failed = await this.repository.failOutbox({
            eventId: event.event_id, workerId: this.options.workerId, error: publisherError, retryDelayMs,
            maxAttempts: this.options.maxAttempts, terminal: !classification.retry
          });
          results.push({ eventId: event.event_id, state: failed.state, retryDelayMs });
        } catch (error) {
          results.push({ eventId: event.event_id, state: 'repository-error', code: error.code || 'database-unavailable' });
        }
      }
    }
    return results;
  }

  async run({ signal } = {}) {
    while (!this.stopping && !signal?.aborted) {
      try {
        const results = await this.runBatch();
        for (const result of results.filter(({ state }) => state === 'dead' || state === 'repository-error')) {
          try {
            await this.options.monitor({ event: 'outbox.delivery-alert', state: result.state, eventId: result.eventId, code: result.code ? safeMonitorCode(result.code) : null });
          } catch {
            console.error(JSON.stringify({ event: 'outbox.monitor-error', code: 'monitor-callback-failed' }));
          }
        }
        if (!results.length) await wait(this.options.pollMs, signal);
      } catch (error) {
        console.error(JSON.stringify({ event: 'outbox.repository-error', code: safeMonitorCode(error.code) }));
        await wait(Math.max(this.options.pollMs, 1000), signal);
      }
    }
  }
}
