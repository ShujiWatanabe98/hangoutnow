import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coachGoRoot = resolve(process.env.COACHGO_SOURCE_DIR || repositoryRoot, process.env.COACHGO_SOURCE_DIR ? '.' : '../coachgo');
const sourceRoot = resolve(coachGoRoot, 'dist');
const publicRoot = resolve(repositoryRoot, 'apps/demo/public/coachgo-demo');
const destinationRoot = resolve(publicRoot, 'dist');

const runtimeFiles = [
  'mobile/demo.js',
  'mobile/continuousDemoDrive.js',
  'mobile/divertNaviUnderpasses.js',
  'mobile/hazardMap.js',
  'mobile/kanagawaPolicePoints.js',
  'mobile/mapboxStyle.js',
  'mobile/naturalSpeech.js',
  'mobile/smoothUserLocation.js',
  'mobile/voiceApproach.js',
  'mobile/voiceHazardReport.js',
];

const staleGeneratedPaths = [
  'dist/e2e',
  'dist/ingestion',
  'dist/prediction',
  'dist/mobile/mobilityEstimator.js',
  'dist/mobile/mobilityEstimator.js.map',
  'dist/mobile/notificationPolicy.js',
  'dist/mobile/notificationPolicy.js.map',
  'dist/mobile/demo.js.map',
  'dist/mobile/hazardMap.js.map',
  'dist/mobile/mapboxStyle.js.map',
];

for (const relativePath of staleGeneratedPaths) {
  await rm(resolve(publicRoot, relativePath), { force: true, recursive: true });
}

for (const relativePath of runtimeFiles) {
  const source = resolve(sourceRoot, relativePath);
  const destination = resolve(destinationRoot, relativePath);
  await access(source);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

const demoRuntimePath = resolve(destinationRoot, 'mobile/demo.js');
const demoRuntime = await readFile(demoRuntimePath, 'utf8');
await writeFile(
  demoRuntimePath,
  demoRuntime
    .replace('./continuousDemoDrive.js', './continuousDemoDrive.js?v=20260824-5')
    .replace('./divertNaviUnderpasses.js', './divertNaviUnderpasses.js?v=20260824-1')
    .replace('./hazardMap.js', './hazardMap.js?v=20260824-5')
    .replace('./kanagawaPolicePoints.js', './kanagawaPolicePoints.js?v=20260824-1')
    .replace('./mapboxStyle.js', './mapboxStyle.js?v=20260824-2')
    .replace('./naturalSpeech.js', './naturalSpeech.js?v=20260825-1')
    .replace('./smoothUserLocation.js', './smoothUserLocation.js?v=20260825-1')
    .replace('./voiceApproach.js', './voiceApproach.js?v=20260824-6')
    .replace('./voiceHazardReport.js', './voiceHazardReport.js?v=20260824-1'),
  'utf8',
);

const sourceHtml = await readFile(resolve(coachGoRoot, 'mobile-poc/index.html'), 'utf8');
const publicHtml = sourceHtml
  .replace('<meta name="theme-color" content="#f7f7f2">', '<meta name="theme-color" content="#f7f7f2">\n    <meta name="robots" content="noindex,nofollow,noarchive">\n    <link rel="canonical" href="https://method-more.com/coachgo-demo/">')
  .replace('href="/mobile-poc/manifest.webmanifest"', 'href="/coachgo-demo/manifest.webmanifest"')
  .replace('href="/vendor/mapbox-gl.css"', 'href="/coachgo-demo/vendor/mapbox-gl.css"')
  .replace('href="/mobile-poc/styles.css"', 'href="/coachgo-demo/styles.css?v=20260825-1"')
  .replace('src="/runtime-config.js"', 'src="/coachgo-demo/runtime-config.js"')
  .replace('src="/vendor/mapbox-gl.js"', 'src="/coachgo-demo/vendor/mapbox-gl.js"')
  .replace('src="/mobile-poc/bootstrap.js"', 'src="/coachgo-demo/bootstrap.js?v=20260825-1"');

await mkdir(publicRoot, { recursive: true });
await writeFile(resolve(publicRoot, 'index.html'), publicHtml, 'utf8');
await copyFile(resolve(coachGoRoot, 'mobile-poc/styles.css'), resolve(publicRoot, 'styles.css'));

const underpassFeed = JSON.parse(await readFile(
  resolve(repositoryRoot, 'apps/demo/public/divertnavi-app/data/underpasses.generated.json'),
  'utf8',
));
const policeModule = await import(`${pathToFileURL(resolve(sourceRoot, 'mobile/kanagawaPolicePoints.js')).href}?sync=${Date.now()}`);
const licensedUnderpassSources = new Map([
  ['国土交通省 北海道開発局', 'https://www.hkd.mlit.go.jp/ky/ki/kouhou/ud49g7000000omnw.html'],
  ['国土交通省 東北地方整備局', 'https://www.thr.mlit.go.jp/policy.pdf'],
  ['国土交通省 関東地方整備局', 'https://www.ktr.mlit.go.jp/guide/copyright.html'],
  ['国土交通省 北陸地方整備局', 'https://www.hrr.mlit.go.jp/help.html'],
  ['国土交通省 中部地方整備局', 'https://www.cbr.mlit.go.jp/policy.htm'],
  ['国土交通省 近畿地方整備局', 'https://www.kkr.mlit.go.jp/link.html'],
  ['国土交通省 中国地方整備局', 'https://www.cgr.mlit.go.jp/about_manual/index.html'],
  ['国土交通省 九州地方整備局', 'https://www.qsr.mlit.go.jp/pp/index.html'],
]);
const licensedUnderpasses = underpassFeed.items.filter((point) => licensedUnderpassSources.has(point.sourceOrganization));
const excludedUnderpasses = underpassFeed.items.filter((point) => !licensedUnderpassSources.has(point.sourceOrganization));
const licensedUnderpassKmlUrls = new Set(licensedUnderpasses.map((point) => point.sourceKmlUrl));
const licensedUnderpassFeedSources = underpassFeed.sources.filter((source) => licensedUnderpassKmlUrls.has(source.kmlUrl));
const underpassAttribution = [...licensedUnderpassSources].map(([organization, termsUrl]) => ({
  organization,
  termsUrl,
  sourceUrls: [...new Set(
    licensedUnderpasses
      .filter((point) => point.sourceOrganization === organization)
      .map((point) => point.sourceKmlUrl),
  )].sort(),
  processingNotice: `${organization}が公開する道路冠水想定箇所KMLをmethodmoreが抽出・正規化して作成`,
}));
const policeAttribution = {
  organization: '神奈川県警察',
  termsUrl: 'https://www.police.pref.kanagawa.jp/guidance.html',
  sourceUrls: [...policeModule.KANAGAWA_POLICE_SOURCE_URLS],
  processingNotice: '神奈川県警察が公開する速度取締り指針をmethodmoreが抽出し、Mapbox Permanent Geocodingで代表点へ加工して作成',
};
const excludedByOrganization = new Map();
for (const point of excludedUnderpasses) {
  excludedByOrganization.set(
    point.sourceOrganization,
    (excludedByOrganization.get(point.sourceOrganization) ?? 0) + 1,
  );
}
const monitorPoints = [
  ...licensedUnderpasses.map((point) => ({
    id: point.id,
    monitorCategory: 'ROAD_FLOODING',
    name: point.name,
    longitude: point.coordinate[1],
    latitude: point.coordinate[0],
    kind: 'UNDERPASS',
    alertDistanceMeters: point.warningLeadDistanceMeters,
  })),
  ...policeModule.KANAGAWA_POLICE_PRIORITY_POINTS.map((point) => ({
    id: point.id,
    monitorCategory: point.monitorCategory,
    name: point.name,
    longitude: point.longitude,
    latitude: point.latitude,
    kind: point.kind,
    alertDistanceMeters: 800,
  })),
];
await writeFile(resolve(publicRoot, 'underpasses.generated.json'), `${JSON.stringify({
  ...underpassFeed,
  coverage: {
    ...underpassFeed.coverage,
    requestedPrefectures: licensedUnderpassFeedSources.length,
    importedPrefectures: licensedUnderpassFeedSources.filter((source) => source.status === 'ok').length,
    failedPrefectures: [],
    itemCount: licensedUnderpasses.length,
    note: `${underpassFeed.coverage.note} CoachGoでは利用条件を一次資料で確認済みの配布元に限定。`,
  },
  sources: licensedUnderpassFeedSources,
  items: licensedUnderpasses,
})}\n`, 'utf8');
await writeFile(resolve(publicRoot, 'monitor-points.generated.json'), `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: underpassFeed.generatedAt,
  attribution: [...underpassAttribution, policeAttribution],
  excluded: [...excludedByOrganization]
    .map(([organization, count]) => ({ organization, count, reason: '商用利用・加工・再配布条件の一次資料確認が未完了' })),
  limitations: [
    '道路冠水想定箇所であり、現在の冠水状況ではありません。',
    '警察公開の交通安全重点地点であり、現在の取締り実施を示す情報ではありません。',
    '配布元の更新日が記録されていない地点を含みます。現地標識、通行規制、公的警報を優先してください。',
  ],
  points: monitorPoints,
})}\n`, 'utf8');

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const attributionHtml = [...underpassAttribution, policeAttribution].map((source) => `
      <article>
        <h3>${escapeHtml(source.organization)}</h3>
        <p>${escapeHtml(source.processingNotice)}</p>
        <p><a href="${escapeHtml(source.termsUrl)}" rel="noreferrer">利用条件</a></p>
        <details><summary>配布元データ ${source.sourceUrls.length}件</summary><ul>${source.sourceUrls.map((url) => `<li><a href="${escapeHtml(url)}" rel="noreferrer">${escapeHtml(url)}</a></li>`).join('')}</ul></details>
      </article>`).join('');
await writeFile(resolve(repositoryRoot, 'apps/demo/public/coachgo-data-sources.html'), `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="CoachGoが表示・監視に使用する道路冠水想定箇所と交通安全重点地点の出典、加工内容、利用条件を掲載します。">
  <link rel="canonical" href="https://method-more.com/coachgo-data-sources.html">
  <title>データ出典 | CoachGo</title>
  <link rel="stylesheet" href="/legal.css?v=20260823-1">
</head>
<body>
  <header><div class="inner"><a class="brand" href="/coachgo-demo/">Coach<i>Go</i></a></div></header>
  <main>
    <h1>CoachGo データ出典</h1>
    <p class="updated">最終確認日：2026年8月25日</p>
    <p class="lead">CoachGoは、確認済みの利用条件に従い、公開された道路冠水想定箇所と交通安全重点地点を加工して表示・接近判定に使用します。</p>
    <p class="warning">現在の冠水・取締り実施・通行可否を示すリアルタイム情報ではありません。現地標識、警察・道路管理者の通行規制、公的警報を優先してください。</p>
    <h2>利用中のデータ</h2>${attributionHtml}
    <h2>除外したデータ</h2>
    <p>利用条件を一次資料で確定できていない${excludedUnderpasses.length}地点（${escapeHtml([...new Set(excludedUnderpasses.map((point) => point.sourceOrganization))].join('、'))}）は、App Store候補の監視データから除外しています。</p>
    <h2>地図・座標処理</h2>
    <p>地図表示および一部代表点の恒久ジオコーディングにMapboxを使用しています。地図上にはMapboxの帰属表示を表示します。</p>
    <nav class="links"><a href="/coachgo-demo/">CoachGo</a><a href="/coachgo-privacy.html">プライバシー</a><a href="/coachgo-support.html">サポート</a></nav>
  </main>
  <footer>運営者：methodmore · <a href="mailto:info@method-more.com">info@method-more.com</a><br>© 2026 methodmore</footer>
</body>
</html>\n`, 'utf8');

const sourceBootstrap = await readFile(resolve(coachGoRoot, 'mobile-poc/bootstrap.js'), 'utf8');
await writeFile(
  resolve(publicRoot, 'bootstrap.js'),
  sourceBootstrap.replace('/dist/mobile/demo.js', '/coachgo-demo/dist/mobile/demo.js?v=20260825-1'),
  'utf8',
);

const manifest = JSON.parse(await readFile(resolve(coachGoRoot, 'mobile-poc/manifest.webmanifest'), 'utf8'));
manifest.name = 'CoachGo 危険監視モバイルPoC';
manifest.start_url = '/coachgo-demo/';
manifest.scope = '/coachgo-demo/';
await writeFile(resolve(publicRoot, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const vendorRoot = resolve(publicRoot, 'vendor');
await mkdir(vendorRoot, { recursive: true });
await copyFile(resolve(coachGoRoot, 'node_modules/mapbox-gl/dist/mapbox-gl.css'), resolve(vendorRoot, 'mapbox-gl.css'));
await copyFile(resolve(coachGoRoot, 'node_modules/mapbox-gl/dist/mapbox-gl.js'), resolve(vendorRoot, 'mapbox-gl.js'));

console.log(`Synced CoachGo mobile page, manifest, Mapbox vendor files, and ${runtimeFiles.length} runtime files.`);
