import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const outputDir = path.join(projectRoot, "artifacts", "app-store", "screenshots");

const WIDTH = 1242;
const HEIGHT = 2688;
const FONT = "'Yu Gothic UI', 'Yu Gothic', Meiryo, sans-serif";

const xml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function backgroundSvg({ titleLines, subtitle, accent = "#15845f", extra = "" }) {
  const title = titleLines
    .map(
      (line, index) =>
        `<text x="621" y="${330 + index * 112}" text-anchor="middle" class="title">${xml(line)}</text>`,
    )
    .join("\n");

  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f7fbf5"/>
          <stop offset="0.48" stop-color="#ecf7f0"/>
          <stop offset="1" stop-color="#dcefe5"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#174739" flood-opacity="0.18"/>
        </filter>
      </defs>
      <rect width="1242" height="2688" fill="url(#bg)"/>
      <circle cx="1120" cy="175" r="250" fill="#ffffff" opacity="0.42"/>
      <circle cx="88" cy="2500" r="300" fill="#ffffff" opacity="0.30"/>
      <rect x="441" y="104" width="360" height="86" rx="43" fill="#ffffff" opacity="0.94"/>
      <circle cx="493" cy="147" r="25" fill="${accent}"/>
      <text x="535" y="164" class="brand">Hangout Now</text>
      ${title}
      <text x="621" y="594" text-anchor="middle" class="subtitle">${xml(subtitle)}</text>
      ${extra}
      <style>
        text { font-family: ${FONT}; fill: #12251e; }
        .brand { font-size: 38px; font-weight: 700; letter-spacing: 0.5px; }
        .title { font-size: 84px; font-weight: 800; letter-spacing: -2px; }
        .subtitle { font-size: 35px; font-weight: 500; fill: #476158; }
        .chip { font-size: 34px; font-weight: 700; }
        .stepNo { font-size: 28px; font-weight: 800; fill: #ffffff; }
        .stepTitle { font-size: 39px; font-weight: 800; }
        .stepBody { font-size: 29px; font-weight: 500; fill: #577067; }
      </style>
    </svg>
  `);
}

async function roundedScreenshot(inputPath, crop, width, height, radius = 46) {
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`,
  );

  return sharp(inputPath)
    .extract(crop)
    .resize(width, height, { fit: "fill" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function buildDiscover() {
  const inner = { x: 205, y: 748, width: 832, height: 1404 };
  const screenshot = await roundedScreenshot(
    path.join(outputDir, "raw-home.png"),
    { left: 536, top: 0, width: 428, height: 725 },
    inner.width,
    inner.height,
  );
  const extra = `
    <g filter="url(#shadow)"><rect x="167" y="710" width="908" height="1480" rx="78" fill="#ffffff"/></g>
    <rect x="535" y="726" width="172" height="20" rx="10" fill="#dbe5df"/>
    <rect x="205" y="2292" width="832" height="132" rx="66" fill="#ffffff" opacity="0.95"/>
    <circle cx="286" cy="2358" r="30" fill="#15845f"/>
    <path d="M273 2358l9 9 18-21" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="339" y="2373" class="chip">いまの気分から、すぐ探せる</text>
  `;
  const base = backgroundSvg({
    titleLines: ["今から、一緒に", "何する？"],
    subtitle: "活動からつながる、近くのHangout",
    extra,
  });

  await sharp(base)
    .composite([{ input: screenshot, left: inner.x, top: inner.y }])
    .flatten({ background: "#edf7f1" })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, "01-discover.png"));
}

async function buildDetail() {
  const inner = { x: 105, y: 778, width: 1032, height: 1082 };
  const screenshot = await roundedScreenshot(
    path.join(outputDir, "raw-detail.png"),
    { left: 402, top: 0, width: 692, height: 725 },
    inner.width,
    inner.height,
  );
  const extra = `
    <g filter="url(#shadow)"><rect x="70" y="742" width="1102" height="1154" rx="70" fill="#ffffff"/></g>
    <g>
      <rect x="105" y="2035" width="1032" height="135" rx="34" fill="#ffffff" opacity="0.96"/>
      <circle cx="177" cy="2102" r="34" fill="#15845f"/><text x="177" y="2113" text-anchor="middle" class="stepNo">1</text>
      <text x="237" y="2117" class="chip">写真と内容で、雰囲気がわかる</text>
      <rect x="105" y="2203" width="1032" height="135" rx="34" fill="#ffffff" opacity="0.96"/>
      <circle cx="177" cy="2270" r="34" fill="#15845f"/><text x="177" y="2281" text-anchor="middle" class="stepNo">2</text>
      <text x="237" y="2285" class="chip">時間・相性・主催者を確認</text>
      <rect x="105" y="2371" width="1032" height="135" rx="34" fill="#ffffff" opacity="0.96"/>
      <circle cx="177" cy="2438" r="34" fill="#15845f"/><text x="177" y="2449" text-anchor="middle" class="stepNo">3</text>
      <text x="237" y="2453" class="chip">正確な場所は承認後に共有</text>
    </g>
  `;
  const base = backgroundSvg({
    titleLines: ["参加前に、", "安心を確認"],
    subtitle: "写真・条件・相性をひと目でチェック",
    extra,
  });

  await sharp(base)
    .composite([{ input: screenshot, left: inner.x, top: inner.y }])
    .flatten({ background: "#edf7f1" })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, "02-detail.png"));
}

async function buildTalk() {
  const inner = { x: 80, y: 802, width: 1082, height: 518 };
  const screenshot = await roundedScreenshot(
    path.join(outputDir, "raw-talk.png"),
    { left: 0, top: 0, width: 1513, height: 725 },
    inner.width,
    inner.height,
    34,
  );
  const extra = `
    <g filter="url(#shadow)"><rect x="45" y="766" width="1152" height="590" rx="68" fill="#ffffff"/></g>
    <path d="M621 1398v84" stroke="#8eb6a7" stroke-width="9" stroke-linecap="round"/><path d="M594 1455l27 29 27-29" fill="none" stroke="#8eb6a7" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <g>
      <rect x="105" y="1516" width="1032" height="216" rx="46" fill="#ffffff" opacity="0.97"/>
      <circle cx="205" cy="1624" r="56" fill="#15845f"/><text x="205" y="1640" text-anchor="middle" class="stepNo">1</text>
      <text x="295" y="1608" class="stepTitle">参加をリクエスト</text>
      <text x="295" y="1664" class="stepBody">気になる活動を選んで申請</text>
      <rect x="105" y="1772" width="1032" height="216" rx="46" fill="#ffffff" opacity="0.97"/>
      <circle cx="205" cy="1880" r="56" fill="#15845f"/><text x="205" y="1896" text-anchor="middle" class="stepNo">2</text>
      <text x="295" y="1864" class="stepTitle">主催者が承認</text>
      <text x="295" y="1920" class="stepBody">参加メンバーと詳細を確認</text>
      <rect x="105" y="2028" width="1032" height="216" rx="46" fill="#15845f"/>
      <circle cx="205" cy="2136" r="56" fill="#ffffff" opacity="0.2"/><text x="205" y="2152" text-anchor="middle" class="stepNo">3</text>
      <text x="295" y="2120" class="stepTitle" style="fill:#ffffff">グループトークへ</text>
      <text x="295" y="2176" class="stepBody" style="fill:#e7f4ed">集合前の連絡もスムーズ</text>
    </g>
    <rect x="287" y="2386" width="668" height="126" rx="63" fill="#ffffff" opacity="0.96"/>
    <circle cx="361" cy="2449" r="29" fill="#15845f"/>
    <path d="M346 2449h30M361 2434v30" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
    <text x="415" y="2464" class="chip">承認された仲間だけで会話</text>
  `;
  const base = backgroundSvg({
    titleLines: ["承認後は、", "グループトークへ"],
    subtitle: "集合前の連絡も、みんなでスムーズに",
    extra,
  });

  await sharp(base)
    .composite([{ input: screenshot, left: inner.x, top: inner.y }])
    .flatten({ background: "#edf7f1" })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, "03-group-talk.png"));
}

await Promise.all([buildDiscover(), buildDetail(), buildTalk()]);
console.log(`Created App Store screenshots in ${outputDir}`);
