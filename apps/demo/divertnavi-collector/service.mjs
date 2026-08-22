import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { collectorDefinitions, HazardCollectorScheduler } from './hazard-collector-scheduler.mjs';
import { createPublicWeatherCollectors } from './hazard-public-connectors.mjs';

const dataDirectory = process.env.DIVERTNAVI_DATA_DIR?.trim() || resolve(tmpdir(), 'divertnavi-hazard-data');
const statePath = resolve(dataDirectory, 'collector-state.json');

const underpassSources = [
  ['01', '北海道', 'https://www.hkd.mlit.go.jp/ky/kn/dou_iji/splaat0000006cn3/kml/01_hokkaido_kansui_point.kml'],
  ['02', '青森県', 'https://www.thr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/02_aomori_kansui_point.kml'], ['03', '岩手県', 'https://www.thr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/03_iwate_kansui_point.kml'], ['04', '宮城県', 'https://www.thr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/04_miyagi_kansui_point.kml'], ['05', '秋田県', 'https://www.thr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/05_akita_kansui_point.kml'], ['06', '山形県', 'https://www.thr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/06_yamagata_kansui_point.kml'], ['07', '福島県', 'https://www.thr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/07_fukushima_kansui_point.kml'],
  ['08', '茨城県', 'https://www.ktr.mlit.go.jp/honkyoku/road/doro_bosaijoho_webmap/kml/08_ibaraki_kansui_point.kml'], ['09', '栃木県', 'https://www.ktr.mlit.go.jp/honkyoku/road/doro_bosaijoho_webmap/kml/09_tochigi_kansui_point.kml'], ['10', '群馬県', 'https://www.ktr.mlit.go.jp/honkyoku/road/doro_bosaijoho_webmap/kml/10_gunma_kansui_point.kml'], ['11', '埼玉県', 'https://www.ktr.mlit.go.jp/honkyoku/road/doro_bosaijoho_webmap/kml/11_saitama_kansui_point.kml'], ['12', '千葉県', 'https://www.ktr.mlit.go.jp/honkyoku/road/doro_bosaijoho_webmap/kml/12_chiba_kansui_point.kml'], ['13', '東京都', 'https://www.ktr.mlit.go.jp/honkyoku/road/doro_bosaijoho_webmap/kml/13_tokyo_kansui_point.kml'], ['14', '神奈川県', 'https://www.ktr.mlit.go.jp/honkyoku/road/doro_bosaijoho_webmap/kml/14_kanagawa_kansui_point.kml'],
  ['15', '新潟県', 'https://www.hrr.mlit.go.jp/road/doro_bousaijoho_webmap/kml/15_niigata_kansui_point.kml'], ['16', '富山県', 'https://www.hrr.mlit.go.jp/road/doro_bousaijoho_webmap/kml/16_toyama_kansui_point.kml'], ['17', '石川県', 'https://www.hrr.mlit.go.jp/road/doro_bousaijoho_webmap/kml/17_ishikawa_kansui_point.kml'],
  ['18', '福井県', 'https://www.kkr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/18_fukui_kansui_point.kml'], ['19', '山梨県', 'https://www.ktr.mlit.go.jp/honkyoku/road/doro_bosaijoho_webmap/kml/19_yamanashi_kansui_point.kml'], ['20', '長野県', 'https://www.ktr.mlit.go.jp/honkyoku/road/doro_bosaijoho_webmap/kml/20_nagano_kansui_point.kml'],
  ['21', '岐阜県', 'https://www.cbr.mlit.go.jp/road_map/doro_bosaijoho_webmap/kml/21_gifu_kansui_point.kml'], ['22', '静岡県', 'https://www.cbr.mlit.go.jp/road_map/doro_bosaijoho_webmap/kml/22_shizuoka_kansui_point.kml'], ['23', '愛知県', 'https://www.cbr.mlit.go.jp/road_map/doro_bosaijoho_webmap/kml/23_aichi_kansui_point.kml'], ['24', '三重県', 'https://www.cbr.mlit.go.jp/road_map/doro_bosaijoho_webmap/kml/24_mie_kansui_point.kml'],
  ['25', '滋賀県', 'https://www.kkr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/25_shiga_kansui_point.kml'], ['26', '京都府', 'https://www.kkr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/26_kyoto_kansui_point.kml'], ['27', '大阪府', 'https://www.kkr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/27_osaka_kansui_point.kml'], ['28', '兵庫県', 'https://www.kkr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/28_hyogo_kansui_point.kml'], ['29', '奈良県', 'https://www.kkr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/29_nara_kansui_point.kml'], ['30', '和歌山県', 'https://www.kkr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/30_wakayama_kansui_point.kml'],
  ['31', '鳥取県', 'https://www.cgr.mlit.go.jp/doro_bosaijoho_webmap/kml/31_tottori_kansui_point.kml'], ['32', '島根県', 'https://www.cgr.mlit.go.jp/doro_bosaijoho_webmap/kml/32_shimane_kansui_point.kml'], ['33', '岡山県', 'https://www.cgr.mlit.go.jp/doro_bosaijoho_webmap/kml/33_okayama_kansui_point.kml'], ['34', '広島県', 'https://www.cgr.mlit.go.jp/doro_bosaijoho_webmap/kml/34_hiroshima_kansui_point.kml'], ['35', '山口県', 'https://www.cgr.mlit.go.jp/doro_bosaijoho_webmap/kml/35_yamaguchi_kansui_point.kml'],
  ['36', '徳島県', 'https://www.skr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/36_tokushima_kansui_point.kml'], ['37', '香川県', 'https://www.skr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/37_kagawa_kansui_point.kml'], ['38', '愛媛県', 'https://www.skr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/38_ehime_kansui_point.kml'], ['39', '高知県', 'https://www.skr.mlit.go.jp/road/doro_bosaijoho_webmap/kml/39_kochi_kansui_point.kml'],
  ['40', '福岡県', 'https://www.qsr.mlit.go.jp/n-michi/doro_bosaijoho_webmap/kml/40_fukuoka_kansui_point.kml'], ['41', '佐賀県', 'https://www.qsr.mlit.go.jp/n-michi/doro_bosaijoho_webmap/kml/41_saga_kansui_point.kml'], ['42', '長崎県', 'https://www.qsr.mlit.go.jp/n-michi/doro_bosaijoho_webmap/kml/42_nagasaki_kansui_point.kml'], ['43', '熊本県', 'https://www.qsr.mlit.go.jp/n-michi/doro_bosaijoho_webmap/kml/43_kumamoto_kansui_point.kml'], ['44', '大分県', 'https://www.qsr.mlit.go.jp/n-michi/doro_bosaijoho_webmap/kml/44_oita_kansui_point.kml'], ['45', '宮崎県', 'https://www.qsr.mlit.go.jp/n-michi/doro_bosaijoho_webmap/kml/45_miyazaki_kansui_point.kml'], ['46', '鹿児島県', 'https://www.qsr.mlit.go.jp/n-michi/doro_bosaijoho_webmap/kml/46_kagoshima_kansui_point.kml'],
  ['47', '沖縄県', 'https://www.dc.ogb.go.jp/road/doro_bosaijoho_webmap/kml/47_okinawa_kansui_point.kml'],
];

async function collectUnderpasses({ prefectureCodes }) {
  const sources = underpassSources.filter(([code]) => prefectureCodes.includes(code));
  const results = await Promise.all(sources.map(async ([code, prefecture, sourceUrl]) => {
    const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'DivertNavi hazard data agent' }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`${prefecture}の国土交通省KMLを取得できません (HTTP ${response.status})`);
    const xml = await response.text();
    const itemCount = [...xml.matchAll(/<Placemark\b[^>]*>[\s\S]*?<\/Placemark>/g)].filter((match) => /<coordinates>\s*[\d.+-]+,\s*[\d.+-]+/.test(match[0])).length;
    if (!itemCount) throw new Error(`${prefecture}の国土交通省KMLに地点がありません`);
    return { code, prefecture, sourceUrl, itemCount };
  }));
  const itemCount = results.reduce((sum, result) => sum + result.itemCount, 0);
  const fetchedAt = new Date().toISOString();
  await writeSnapshot({ schemaVersion: 1, category: 'UNDERPASS', collectedAt: fetchedAt, prefectureCodes, sourceResults: results, itemCount });
  return {
    state: 'SUCCESS', itemCount,
    message: `${results.length}/${sources.length}都道府県、${itemCount.toLocaleString('ja-JP')}件を収集`,
    sourceResults: [{ id: 'MLIT_UNDERPASS_KML', label: '国土交通省KML', status: 'SUCCESS', itemCount, fetchedAt, sourceUrl: 'https://www.mlit.go.jp/road/bosai/doro_bosaijoho_webmap/' }],
  };
}

async function writeSnapshot(snapshot) {
  const directory = resolve(dataDirectory, 'feeds', snapshot.category);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'latest.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

async function persistState(state) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function readSavedState() {
  try { return JSON.parse(await readFile(statePath, 'utf8')); }
  catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null;
    throw error;
  }
}

let persistQueue = Promise.resolve();
const publicWeatherCollectors = createPublicWeatherCollectors({ writeSnapshot });
const scheduler = new HazardCollectorScheduler({
  definitions: collectorDefinitions,
  collectors: { UNDERPASS: collectUnderpasses, ...publicWeatherCollectors },
  onChange: (state) => { persistQueue = persistQueue.then(() => persistState(state)).catch(() => {}); },
});

export const ready = (async () => {
  const savedState = await readSavedState();
  scheduler.restore(savedState);
  if (savedState?.running && Array.isArray(savedState.prefectureCodes) && savedState.prefectureCodes.length) await scheduler.start(savedState.prefectureCodes);
})();

export function getCollectorStatus() { return scheduler.snapshot(); }
export function startCollector(prefectureCodes) { return scheduler.start(prefectureCodes); }
export function stopCollector() { return scheduler.stop(); }
