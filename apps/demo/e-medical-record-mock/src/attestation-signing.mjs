import { createPrivateKey, sign } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildReleaseAttestationPayload, canonicalizeForSignature } from './readiness.mjs';

const maximumValidityMs = 7 * 24 * 60 * 60 * 1000;

export async function createSignedReleaseAttestation({
  root,
  manifestPath = path.join(root, 'production-readiness.json'),
  privateKeyPath,
  outputPath,
  approverId,
  issuedAt = new Date().toISOString(),
  notBefore = issuedAt,
  expiresAt
}) {
  if (!root || !privateKeyPath || !outputPath || !expiresAt) throw new TypeError('root, privateKeyPath, outputPath and expiresAt are required');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const incomplete = (manifest.gates || []).filter((gate) => gate.required && (gate.status !== 'verified'
    || !Array.isArray(gate.evidence) || !gate.evidence.length
    || !gate.verification?.verifiedAt || !gate.verification?.verifiedBy || !gate.verification?.method));
  if (incomplete.length) throw new Error(`Refusing to sign: required gates are not independently verified: ${incomplete.map((gate) => gate.id).join(', ')}`);
  const validityMs = Date.parse(expiresAt) - Date.parse(issuedAt);
  if (!Number.isFinite(validityMs) || validityMs <= 0 || validityMs > maximumValidityMs || Date.parse(notBefore) > Date.parse(issuedAt)) {
    throw new Error('Attestation validity must be positive, at most 7 days, and notBefore must not follow issuedAt.');
  }
  const privateKey = createPrivateKey(await readFile(privateKeyPath));
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Attestation private key must be Ed25519.');
  const payload = await buildReleaseAttestationPayload({ root, manifestPath, approverId, issuedAt, notBefore, expiresAt });
  const attestation = {
    schemaVersion: 1,
    payload,
    signature: { algorithm: 'Ed25519', value: sign(null, Buffer.from(canonicalizeForSignature(payload)), privateKey).toString('base64url') }
  };
  await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(attestation, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return attestation;
}
