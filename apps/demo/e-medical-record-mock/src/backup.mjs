import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { validateStoreShape } from './postgres-store.mjs';
import { verifyAuditChain } from './store.mjs';

function keyBuffer(key) {
  const value = Buffer.isBuffer(key) ? key : Buffer.from(String(key || ''), 'base64');
  if (value.length !== 32) throw new Error('Backup encryption key must be exactly 32 bytes (base64 when passed as text).');
  return value;
}

export function encryptBackup(store, key, { createdAt = new Date().toISOString(), tenantId = 'TENANT-DEMO' } = {}) {
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(tenantId)) throw new Error('Invalid backup tenant ID.');
  validateStoreShape(store);
  const auditIntegrity = verifyAuditChain(store);
  if (!auditIntegrity.valid) throw new Error(`Audit chain is invalid at ${auditIntegrity.eventId}.`);
  const plaintext = Buffer.from(JSON.stringify(store)); const checksum = createHash('sha256').update(plaintext).digest('hex');
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', keyBuffer(key), iv);
  cipher.setAAD(Buffer.from(`EMR-BACKUP-2:${tenantId}`));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]); const tag = cipher.getAuthTag();
  return Buffer.from(JSON.stringify({
    format: 'EMR-BACKUP-2', tenantId, createdAt, algorithm: 'AES-256-GCM', checksum,
    auditHeadHash: auditIntegrity.headHash, iv: iv.toString('base64'), tag: tag.toString('base64'), ciphertext: ciphertext.toString('base64')
  }));
}

export function decryptBackup(archive, key, { expectedTenantId } = {}) {
  const envelope = JSON.parse(Buffer.from(archive).toString('utf8'));
  if (envelope.format !== 'EMR-BACKUP-2' || envelope.algorithm !== 'AES-256-GCM') throw new Error('Unsupported EMR backup format.');
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(envelope.tenantId)) throw new Error('Invalid backup tenant ID.');
  if (expectedTenantId && envelope.tenantId !== expectedTenantId) throw new Error('Backup tenant mismatch.');
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer(key), Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  decipher.setAAD(Buffer.from(`EMR-BACKUP-2:${envelope.tenantId}`));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
  const checksum = createHash('sha256').update(plaintext).digest('hex');
  if (checksum !== envelope.checksum) throw new Error('Backup checksum mismatch.');
  const store = validateStoreShape(JSON.parse(plaintext.toString('utf8'))); const auditIntegrity = verifyAuditChain(store);
  if (!auditIntegrity.valid || auditIntegrity.headHash !== envelope.auditHeadHash) throw new Error('Backup audit chain verification failed.');
  return { store, metadata: { format: envelope.format, tenantId: envelope.tenantId, createdAt: envelope.createdAt, checksum, auditHeadHash: envelope.auditHeadHash } };
}
