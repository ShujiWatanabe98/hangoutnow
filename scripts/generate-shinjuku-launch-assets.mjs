import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const assets = join(root, 'apps', 'demo', 'public', 'assets');
const photo = join(assets, 'hangout-demo-food-2026.webp');
const trackedUrl = 'https://method-more.com/shinjuku-first-members.html?utm_source=founder&utm_medium=qr&utm_campaign=shinjuku-launch-202609&utm_content=first-five&utm_id=shinjuku-launch-202609';

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const qr = new QRCode(-1, QRErrorCorrectLevel.M);
qr.addData(trackedUrl);
qr.make();
const qrCount = qr.getModuleCount();
const qrQuiet = 4;
const qrCell = 10;
const qrSize = (qrCount + qrQuiet * 2) * qrCell;
const qrRects = qr.modules.flatMap((row, y) => row.map((active, x) => active ? `<rect x="${(x + qrQuiet) * qrCell}" y="${(y + qrQuiet) * qrCell}" width="${qrCell}" height="${qrCell}"/>` : '')).join('');
const qrSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${qrSize}" height="${qrSize}" viewBox="0 0 ${qrSize} ${qrSize}"><rect width="100%" height="100%" fill="#fff"/><g fill="#17221d">${qrRects}</g></svg>`;
await writeFile(join(assets, 'shinjuku-first-five-qr.svg'), qrSvg, 'utf8');
await sharp(Buffer.from(qrSvg)).png().toFile(join(assets, 'shinjuku-first-five-qr.png'));

const layouts = [
  { name: 'shinjuku-launch-x-20260820.png', width: 1200, height: 675, photoX: 700, photoY: 0, photoWidth: 500, photoHeight: 675, titleSize: 60, titleY: 195 },
  { name: 'shinjuku-launch-instagram-20260820.png', width: 1080, height: 1350, photoX: 0, photoY: 730, photoWidth: 1080, photoHeight: 620, titleSize: 70, titleY: 240 },
  { name: 'shinjuku-launch-story-20260820.png', width: 1080, height: 1920, photoX: 0, photoY: 970, photoWidth: 1080, photoHeight: 950, titleSize: 76, titleY: 310 },
];

for (const layout of layouts) {
  const photoBuffer = await sharp(photo).resize(layout.photoWidth, layout.photoHeight, { fit: 'cover' }).modulate({ saturation: 0.88, brightness: 0.86 }).toBuffer();
  const bodyWidth = layout.photoX ? 660 : layout.width - 120;
  const subtitleY = layout.titleY + layout.titleSize * 2.55;
  const safetyY = layout.photoY ? layout.photoY - 100 : layout.height - 75;
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}">
    <style>.brand{font:900 31px Arial,sans-serif}.small{font:800 22px 'Meiryo','Noto Sans JP',sans-serif;letter-spacing:2px}.title{font:900 ${layout.titleSize}px 'Meiryo','Noto Sans JP',sans-serif}.body{font:700 27px 'Meiryo','Noto Sans JP',sans-serif}.safe{font:700 20px 'Meiryo','Noto Sans JP',sans-serif}.note{font:700 15px 'Meiryo','Noto Sans JP',sans-serif}</style>
    <rect x="${layout.photoX}" y="${layout.photoY}" width="${layout.photoWidth}" height="${layout.photoHeight}" fill="#0d2d23" opacity=".24"/>
    <circle cx="${layout.photoX ? 560 : layout.width - 100}" cy="85" r="150" fill="#d9ff68" opacity=".08"/>
    <text x="60" y="70" fill="#fff" class="brand">Hangout <tspan fill="#d9ff68">Now</tspan></text>
    <rect x="60" y="105" rx="22" width="330" height="44" fill="#d9ff68"/>
    <text x="80" y="135" fill="#17221d" class="small">新宿 · 先行メンバー</text>
    <text x="60" y="${layout.titleY}" fill="#fff" class="title"><tspan x="60">人より先に、</tspan><tspan x="60" dy="1.25em">活動を選ぶ。</tspan></text>
    <text x="60" y="${subtitleY}" fill="#d7e7df" class="body"><tspan x="60">食事・カフェ・散歩から始める</tspan><tspan x="60" dy="1.55em">5名の小さな先行検証</tspan></text>
    <text x="60" y="${safetyY}" fill="#d7e7df" class="safe">18歳以上  ·  一人参加  ·  集合場所は承認後</text>
    <text x="${layout.width - 24}" y="${layout.height - 24}" text-anchor="end" fill="#fff" class="note">※画像はイメージです</text>
  </svg>`;
  await sharp({ create: { width: layout.width, height: layout.height, channels: 4, background: '#163f31' } })
    .composite([
      { input: photoBuffer, left: layout.photoX, top: layout.photoY },
      { input: Buffer.from(overlay), left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(join(assets, layout.name));
}

await sharp(join(assets, 'shinjuku-launch-instagram-20260820.png'))
  .webp({ quality: 82, effort: 5 })
  .toFile(join(assets, 'shinjuku-launch-card-20260820.webp'));

console.log(JSON.stringify({ trackedUrl, files: [...layouts.map(({ name }) => name), 'shinjuku-launch-card-20260820.webp', 'shinjuku-first-five-qr.svg', 'shinjuku-first-five-qr.png'] }, null, 2));
