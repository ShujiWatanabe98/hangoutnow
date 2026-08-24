import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coachGoRoot = resolve(process.env.COACHGO_SOURCE_DIR || repositoryRoot, process.env.COACHGO_SOURCE_DIR ? '.' : '../coachgo');
const sourceRoot = resolve(coachGoRoot, 'dist');
const publicRoot = resolve(repositoryRoot, 'apps/demo/public/coachgo-demo');
const destinationRoot = resolve(publicRoot, 'dist');

const runtimeFiles = [
  'mobile/demo.js',
  'mobile/hazardMap.js',
  'mobile/mapboxStyle.js',
];

const staleGeneratedPaths = [
  'dist/e2e',
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

const sourceHtml = await readFile(resolve(coachGoRoot, 'mobile-poc/index.html'), 'utf8');
const publicHtml = sourceHtml
  .replace('<meta name="theme-color" content="#f7f7f2">', '<meta name="theme-color" content="#f7f7f2">\n    <meta name="robots" content="noindex,nofollow,noarchive">\n    <link rel="canonical" href="https://method-more.com/coachgo-demo/">')
  .replace('href="/mobile-poc/manifest.webmanifest"', 'href="/coachgo-demo/manifest.webmanifest"')
  .replace('href="/vendor/mapbox-gl.css"', 'href="/coachgo-demo/vendor/mapbox-gl.css"')
  .replace('href="/mobile-poc/styles.css"', 'href="/coachgo-demo/styles.css?v=20260823-2"')
  .replace('src="/runtime-config.js"', 'src="/coachgo-demo/runtime-config.js"')
  .replace('src="/vendor/mapbox-gl.js"', 'src="/coachgo-demo/vendor/mapbox-gl.js"')
  .replace('src="/dist/mobile/demo.js"', 'src="/coachgo-demo/dist/mobile/demo.js"');

await mkdir(publicRoot, { recursive: true });
await writeFile(resolve(publicRoot, 'index.html'), publicHtml, 'utf8');
await copyFile(resolve(coachGoRoot, 'mobile-poc/styles.css'), resolve(publicRoot, 'styles.css'));

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
