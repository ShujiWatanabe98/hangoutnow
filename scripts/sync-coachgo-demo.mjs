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
const monitorPoints = [
  ...underpassFeed.items.map((point) => ({
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
await writeFile(resolve(publicRoot, 'monitor-points.generated.json'), `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: underpassFeed.generatedAt,
  limitations: [
    '道路冠水想定箇所であり、現在の冠水状況ではありません。',
    '警察公開の交通安全重点地点であり、現在の取締り実施を示す情報ではありません。',
  ],
  points: monitorPoints,
})}\n`, 'utf8');

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
