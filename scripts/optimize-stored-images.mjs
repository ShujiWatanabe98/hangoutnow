import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const PROFILE_SPEC = { width: 512, height: 512, quality: 68, maxInputBytes: 1_100_000 };
const HANGOUT_SPEC = { width: 960, height: 540, quality: 70, maxInputBytes: 20_000_000 };
const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();
const optimizedCache = new Map();

function isInlineImage(value) {
  return typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(value);
}

async function optimize(value, spec) {
  const cacheKey = `${spec.width}x${spec.height}:${value}`;
  if (optimizedCache.has(cacheKey)) return optimizedCache.get(cacheKey);
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(value);
  if (!match) throw new Error('Unsupported stored image format');
  const input = Buffer.from(match[2], 'base64');
  if (!input.length || input.length > spec.maxInputBytes) throw new Error(`Stored image exceeds ${spec.maxInputBytes} bytes`);
  const output = await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
    .rotate()
    .resize(spec.width, spec.height, { fit: 'cover', position: 'attention' })
    .webp({ quality: spec.quality, effort: 4, smartSubsample: true })
    .toBuffer();
  const result = `data:image/webp;base64,${output.toString('base64')}`;
  optimizedCache.set(cacheKey, result);
  return result;
}

try {
  const [users, hangouts] = await Promise.all([
    prisma.user.findMany({ select: { id: true, profilePhoto: true, profilePhotos: true } }),
    prisma.hangout.findMany({ where: { imageUrl: { startsWith: 'data:image/' } }, select: { id: true, imageUrl: true } }),
  ]);
  const affectedUsers = users.filter((user) => isInlineImage(user.profilePhoto) || user.profilePhotos.some(isInlineImage));
  const affectedHangouts = hangouts.filter((hangout) => isInlineImage(hangout.imageUrl));
  const beforeBytes = [...affectedUsers.flatMap((user) => [user.profilePhoto, ...user.profilePhotos]), ...affectedHangouts.map((hangout) => hangout.imageUrl)]
    .filter(isInlineImage).reduce((sum, value) => sum + Buffer.byteLength(value), 0);

  const userUpdates = [];
  for (const user of affectedUsers) {
    const profilePhoto = isInlineImage(user.profilePhoto) ? await optimize(user.profilePhoto, PROFILE_SPEC) : user.profilePhoto;
    const profilePhotos = await Promise.all(user.profilePhotos.map((photo) => isInlineImage(photo) ? optimize(photo, PROFILE_SPEC) : photo));
    userUpdates.push({ id: user.id, profilePhoto, profilePhotos });
  }
  const hangoutUpdates = [];
  for (const hangout of affectedHangouts) {
    hangoutUpdates.push({ id: hangout.id, imageUrl: await optimize(hangout.imageUrl, HANGOUT_SPEC) });
  }
  const afterBytes = [...userUpdates.flatMap((user) => [user.profilePhoto, ...user.profilePhotos]), ...hangoutUpdates.map((hangout) => hangout.imageUrl)]
    .filter(isInlineImage).reduce((sum, value) => sum + Buffer.byteLength(value), 0);
  const summary = { mode: apply ? 'apply' : 'dry-run', users: userUpdates.length, hangouts: hangoutUpdates.length, beforeBytes, afterBytes, reductionPercent: beforeBytes ? Math.round((1 - afterBytes / beforeBytes) * 1000) / 10 : 0 };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log('No database rows were changed. Re-run with --apply after reviewing the counts.');
  } else {
    const backupDirectory = join(process.cwd(), 'tmp', 'image-optimization-backups');
    await mkdir(backupDirectory, { recursive: true });
    const backupPath = join(backupDirectory, `${new Date().toISOString().replaceAll(':', '-')}.json`);
    await writeFile(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), users: affectedUsers, hangouts: affectedHangouts }), { encoding: 'utf8', mode: 0o600 });
    await prisma.$transaction(async (transaction) => {
      for (const user of userUpdates) await transaction.user.update({ where: { id: user.id }, data: { profilePhoto: user.profilePhoto, profilePhotos: user.profilePhotos } });
      for (const hangout of hangoutUpdates) await transaction.hangout.update({ where: { id: hangout.id }, data: { imageUrl: hangout.imageUrl } });
    }, { timeout: 120_000 });
    console.log(JSON.stringify({ ...summary, backupPath }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
