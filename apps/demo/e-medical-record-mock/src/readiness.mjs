import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowedStatuses = new Set(['blocked', 'external-evidence-required', 'verified']);
const approverIdPattern = /^[A-Za-z0-9._:-]{3,128}$/;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalizeForSignature(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeForSignature).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeForSignature(value[key])}`).join(',')}}`;
  }
  throw new TypeError('Attestation payload contains an unsupported value.');
}

function canonicalEvidencePath(value) {
  return path.posix.normalize(String(value).replaceAll('\\', '/'));
}

async function collectLocalEvidence({ root, manifest }) {
  const resolvedRoot = path.resolve(root);
  const rootRealPath = await realpath(resolvedRoot);
  const localEvidence = [...new Set((manifest.gates || []).flatMap((gate) => gate.evidence || [])
    .filter((evidence) => !/^https:\/\//.test(evidence)).map(canonicalEvidencePath))].sort();
  const missingEvidence = [];
  const evidenceDigests = [];
  for (const evidence of localEvidence) {
    const evidencePath = path.resolve(resolvedRoot, evidence);
    const relativeEvidencePath = path.relative(resolvedRoot, evidencePath);
    if (!relativeEvidencePath || relativeEvidencePath.startsWith('..') || path.isAbsolute(relativeEvidencePath)) {
      missingEvidence.push({ evidence, error: 'outside-repository path is not allowed' }); continue;
    }
    try {
      const resolved = await realpath(evidencePath);
      const relativeRealPath = path.relative(rootRealPath, resolved);
      if (!relativeRealPath || relativeRealPath.startsWith('..') || path.isAbsolute(relativeRealPath)) {
        missingEvidence.push({ evidence, error: 'symlink target outside repository is not allowed' }); continue;
      }
      if (!(await stat(resolved)).isFile()) {
        missingEvidence.push({ evidence, error: 'evidence must be a file' }); continue;
      }
      evidenceDigests.push({ path: evidence, sha256: sha256(await readFile(resolved)) });
    } catch {
      missingEvidence.push({ evidence, error: 'file not found' });
    }
  }
  return { evidenceDigests, missingEvidence };
}

function addGateIds(missingEvidence, manifest) {
  return missingEvidence.map((item) => ({
    gate: (manifest.gates || []).find((gate) => (gate.evidence || []).map(canonicalEvidencePath).includes(item.evidence))?.id,
    ...item
  }));
}

function trustedKeysFrom(value) {
  if (!value) return {};
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('trusted approver keys must be a JSON object');
  return parsed;
}

function validInstant(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export async function buildReleaseAttestationPayload({
  root = defaultRoot,
  manifestPath = path.join(root, 'production-readiness.json'),
  approverId,
  issuedAt,
  notBefore,
  expiresAt
} = {}) {
  if (!approverIdPattern.test(String(approverId || ''))) throw new TypeError('approverId is invalid');
  if (![issuedAt, notBefore, expiresAt].every(validInstant)) throw new TypeError('issuedAt, notBefore and expiresAt must be ISO-8601 instants');
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const { evidenceDigests, missingEvidence } = await collectLocalEvidence({ root, manifest });
  if (missingEvidence.length) throw new Error(`Cannot attest missing evidence: ${missingEvidence.map((item) => item.evidence).join(', ')}`);
  return {
    attestationVersion: 1,
    product: manifest.product,
    release: manifest.release,
    manifestSha256: sha256(manifestBytes),
    evidenceDigests,
    issuedAt,
    notBefore,
    expiresAt,
    approverId
  };
}

async function verifyReleaseAttestation({
  root,
  manifest,
  manifestBytes,
  evidenceDigests,
  attestationPath,
  trustedApproverKeys,
  now
}) {
  const result = { required: true, valid: false, approverId: null, expiresAt: null, errors: [] };
  if (!attestationPath) {
    result.errors.push('missing-attestation-path'); return result;
  }
  let allowlist;
  try { allowlist = trustedKeysFrom(trustedApproverKeys); }
  catch { result.errors.push('invalid-trusted-approver-keys'); return result; }
  if (!Object.keys(allowlist).length) {
    result.errors.push('missing-trusted-approver-keys'); return result;
  }
  let attestation;
  try {
    const resolvedPath = path.isAbsolute(attestationPath) ? attestationPath : path.resolve(root, attestationPath);
    attestation = JSON.parse(await readFile(resolvedPath, 'utf8'));
  } catch {
    result.errors.push('attestation-read-error'); return result;
  }
  const payload = attestation?.payload;
  const signature = attestation?.signature;
  if (attestation?.schemaVersion !== 1 || !payload || signature?.algorithm !== 'Ed25519' || typeof signature?.value !== 'string') {
    result.errors.push('invalid-attestation-schema'); return result;
  }
  result.approverId = typeof payload.approverId === 'string' ? payload.approverId : null;
  result.expiresAt = typeof payload.expiresAt === 'string' ? payload.expiresAt : null;
  if (!approverIdPattern.test(String(payload.approverId || '')) || !Object.hasOwn(allowlist, payload.approverId)) {
    result.errors.push('unknown-approver'); return result;
  }
  let publicKey;
  try {
    publicKey = createPublicKey(allowlist[payload.approverId]);
    if (publicKey.asymmetricKeyType !== 'ed25519') throw new TypeError('key is not Ed25519');
  } catch {
    result.errors.push('invalid-approver-key'); return result;
  }
  let signatureValid = false;
  try {
    signatureValid = verifySignature(null, Buffer.from(canonicalizeForSignature(payload)), publicKey, Buffer.from(signature.value, 'base64url'));
  } catch {}
  if (!signatureValid) result.errors.push('invalid-signature');
  if (payload.attestationVersion !== 1) result.errors.push('unsupported-attestation-version');
  if (payload.product !== manifest.product) result.errors.push('product-mismatch');
  if (payload.release !== manifest.release) result.errors.push('release-mismatch');
  if (payload.manifestSha256 !== sha256(manifestBytes)) result.errors.push('manifest-digest-mismatch');
  if (!Array.isArray(payload.evidenceDigests)) {
    result.errors.push('invalid-evidence-digests');
  } else if (canonicalizeForSignature(payload.evidenceDigests) !== canonicalizeForSignature(evidenceDigests)) {
    result.errors.push('evidence-digest-mismatch');
  }
  if (![payload.issuedAt, payload.notBefore, payload.expiresAt].every(validInstant)) {
    result.errors.push('invalid-validity-period');
  } else {
    const issuedAt = Date.parse(payload.issuedAt); const notBefore = Date.parse(payload.notBefore); const expiresAt = Date.parse(payload.expiresAt);
    const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
    if (!Number.isFinite(current)) result.errors.push('invalid-current-time');
    if (notBefore > issuedAt || issuedAt >= expiresAt) result.errors.push('invalid-validity-period');
    if (current < notBefore) result.errors.push('attestation-not-yet-valid');
    if (current >= expiresAt) result.errors.push('attestation-expired');
  }
  result.valid = result.errors.length === 0;
  return result;
}

export async function assessProductionReadiness({
  root = defaultRoot,
  manifestPath = path.join(root, 'production-readiness.json'),
  attestationPath = process.env.EMR_RELEASE_ATTESTATION_PATH,
  trustedApproverKeys = process.env.EMR_RELEASE_ATTESTATION_TRUSTED_KEYS_JSON,
  now = new Date()
} = {}) {
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const definitionErrors = [];
  if (manifest.schemaVersion !== 1) definitionErrors.push('schemaVersion must be 1');
  if (!Array.isArray(manifest.gates) || !manifest.gates.length) definitionErrors.push('gates must be a non-empty array');
  const seenIds = new Set();
  for (const gate of manifest.gates || []) {
    if (!gate.id || seenIds.has(gate.id)) definitionErrors.push(`gate id is missing or duplicated: ${gate.id || '(missing)'}`);
    seenIds.add(gate.id);
    if (!allowedStatuses.has(gate.status)) definitionErrors.push(`${gate.id}: unsupported status ${gate.status}`);
    if (!gate.owner || !gate.reason || !Array.isArray(gate.evidence)) definitionErrors.push(`${gate.id}: owner, reason and evidence are required`);
    if (gate.status === 'verified') {
      if (!gate.evidence.length) definitionErrors.push(`${gate.id}: verified gate requires evidence`);
      if (!gate.verification?.verifiedAt || !gate.verification?.verifiedBy || !gate.verification?.method) definitionErrors.push(`${gate.id}: verified gate requires verification.verifiedAt, verifiedBy and method`);
    }
  }
  const evidence = await collectLocalEvidence({ root, manifest });
  const missingEvidence = addGateIds(evidence.missingEvidence, manifest);
  const required = (manifest.gates || []).filter((gate) => gate.required);
  const unverified = required.filter((gate) => gate.status !== 'verified' || !gate.evidence.length);
  const attestation = await verifyReleaseAttestation({
    root, manifest, manifestBytes, evidenceDigests: evidence.evidenceDigests,
    attestationPath, trustedApproverKeys, now
  });
  const deploymentAllowed = !definitionErrors.length && !missingEvidence.length && !unverified.length && attestation.valid;
  return {
    manifest,
    report: {
      assessedAt: new Date().toISOString(), product: manifest.product, release: manifest.release,
      requiredGates: required.length, verifiedGates: required.length - unverified.length,
      definitionErrors, missingEvidence, unverified: unverified.map(({ id, status, reason }) => ({ id, status, reason })),
      attestation, deploymentAllowed
    }
  };
}

export function applyPublicDeploymentGate(runtimeConfig, assessment) {
  if (runtimeConfig.mode !== 'production' || runtimeConfig.deploymentStage !== 'public') return runtimeConfig;
  if (!assessment?.report?.deploymentAllowed) {
    const attestationReason = assessment?.report?.attestation?.errors?.length ? ` Attestation: ${assessment.report.attestation.errors.join(', ')}.` : '';
    const error = new Error(`Public startup blocked: ${assessment?.report?.verifiedGates || 0}/${assessment?.report?.requiredGates || 0} production gates verified.${attestationReason}`);
    error.code = 'EMR-DEPLOYMENT-BLOCKED'; throw error;
  }
  return Object.freeze({ ...runtimeConfig, productionReady: true });
}
