import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const publicWeatherSourceUrls = {
  jmaXml: 'https://www.data.jma.go.jp/developer/xml/feed/extra.xml',
  amedasHourlyRain: 'https://www.data.jma.go.jp/stats/data/mdrr/pre_rct/alltable/pre1h00_rct.csv',
}

const prefectureNamesByCode = {
  '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県', '06': '山形県', '07': '福島県',
  '08': '茨城県', '09': '栃木県', '10': '群馬県', '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県',
  '15': '新潟県', '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
  '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県', '26': '京都府', '27': '大阪府',
  '28': '兵庫県', '29': '奈良県', '30': '和歌山県', '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県',
  '35': '山口県', '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県', '41': '佐賀県',
  '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県', '46': '鹿児島県', '47': '沖縄県',
}

const categoryKeywords = {
  FLOOD: ['洪水', '氾濫', '河川', '浸水'],
  HEAVY_RAIN: ['大雨', '強い雨', '記録的短時間', '浸水', '降水'],
  HAIL: ['降ひょう', 'ひょう', '雹', '雷', '竜巻', '突風'],
}

function decodeXml(value = '') {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function xmlValue(block, tag) {
  return decodeXml(block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? '')
}

export function parseJmaAtomFeed(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => {
    const block = match[1]
    const id = xmlValue(block, 'id')
    return {
      id,
      title: xmlValue(block, 'title'),
      updatedAt: xmlValue(block, 'updated'),
      author: xmlValue(block, 'name'),
      summary: xmlValue(block, 'content'),
      sourceUrl: block.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? id,
    }
  }).filter((entry) => entry.id && entry.updatedAt)
}

export function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      values.push(value)
      value = ''
    } else {
      value += character
    }
  }
  values.push(value)
  return values
}

export function parseAmedasHourlyRainCsv(csv) {
  const [headerLine, ...lines] = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  if (!headerLine) return []
  const headers = parseCsvLine(headerLine)
  const indexOf = (prefix) => headers.findIndex((header) => header.startsWith(prefix))
  const indexes = {
    stationId: indexOf('観測所番号'), prefecture: indexOf('都道府県'), station: indexOf('地点'),
    year: indexOf('現在時刻(年)'), month: indexOf('現在時刻(月)'), day: indexOf('現在時刻(日)'),
    hour: indexOf('現在時刻(時)'), minute: indexOf('現在時刻(分)'), rain: indexOf('現在値(mm)'), quality: indexOf('現在値の品質情報'),
  }
  if (Object.values(indexes).some((index) => index < 0)) throw new Error('気象庁アメダスCSVの必須列が見つかりません')

  return lines.map((line) => {
    const fields = parseCsvLine(line)
    const rainMm = Number(fields[indexes.rain])
    if (!Number.isFinite(rainMm)) return null
    const observedAt = `${fields[indexes.year]}-${fields[indexes.month]}-${fields[indexes.day]}T${fields[indexes.hour]}:${fields[indexes.minute]}:00+09:00`
    return {
      id: `amedas-${fields[indexes.stationId]}-${observedAt}`,
      source: 'JMA_AMEDAS_HOURLY_RAIN',
      stationId: fields[indexes.stationId],
      prefecture: fields[indexes.prefecture].split(/\s/)[0],
      area: fields[indexes.prefecture],
      station: fields[indexes.station],
      observedAt,
      rainMm,
      qualityCode: fields[indexes.quality],
      isHeavyRain: rainMm >= 30,
      sourceUrl: publicWeatherSourceUrls.amedasHourlyRain,
    }
  }).filter(Boolean)
}

function filterJmaEntries(entries, category, targetPrefectureNames) {
  const keywords = categoryKeywords[category] ?? []
  return entries.filter((entry) => {
    const text = `${entry.title} ${entry.summary} ${entry.author}`
    return keywords.some((keyword) => text.includes(keyword)) && targetPrefectureNames.some((name) => text.includes(name))
  }).map((entry) => ({
    ...entry,
    source: 'JMA_DISASTER_XML',
    category,
    activeHint: !/解除|可能性は低くなりました/.test(entry.summary),
  }))
}

async function responseText(response, label) {
  if (!response.ok) throw new Error(`${label}の取得に失敗しました (HTTP ${response.status})`)
  return await response.text()
}

async function defaultSnapshotWriter(snapshot) {
  const directory = resolve('.hazard-data/feeds', snapshot.category)
  await mkdir(directory, { recursive: true })
  await writeFile(resolve(directory, 'latest.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
}

export function createPublicWeatherCollectors({
  fetchImpl = fetch,
  now = Date.now,
  cacheMilliseconds = 45_000,
  writeSnapshot = defaultSnapshotWriter,
  decodeAmedasBuffer = (buffer) => new TextDecoder('shift_jis').decode(buffer),
} = {}) {
  let cachedUntil = 0
  let sharedRequest = null
  let sharedRequestKey = null

  async function loadSharedSources({ forceRefresh = false, requestKey = null } = {}) {
    if (sharedRequest && requestKey && sharedRequestKey === requestKey) return sharedRequest
    if (!forceRefresh && sharedRequest && now() < cachedUntil) return sharedRequest
    cachedUntil = now() + cacheMilliseconds
    sharedRequestKey = requestKey
    sharedRequest = Promise.allSettled([
      fetchImpl(publicWeatherSourceUrls.jmaXml, { headers: { 'User-Agent': 'DivertNavi hazard data agent' }, signal: AbortSignal.timeout(20_000) })
        .then((response) => responseText(response, '気象庁防災情報XML')),
      fetchImpl(publicWeatherSourceUrls.amedasHourlyRain, { headers: { 'User-Agent': 'DivertNavi hazard data agent' }, signal: AbortSignal.timeout(20_000) })
        .then(async (response) => {
          if (!response.ok) throw new Error(`気象庁アメダスCSVの取得に失敗しました (HTTP ${response.status})`)
          return decodeAmedasBuffer(await response.arrayBuffer())
        }),
    ]).then(([jmaResult, amedasResult]) => ({
      jmaEntries: jmaResult.status === 'fulfilled' ? parseJmaAtomFeed(jmaResult.value) : [],
      jmaError: jmaResult.status === 'rejected' ? (jmaResult.reason instanceof Error ? jmaResult.reason.message : String(jmaResult.reason)) : null,
      amedasObservations: amedasResult.status === 'fulfilled' ? parseAmedasHourlyRainCsv(amedasResult.value) : [],
      amedasError: amedasResult.status === 'rejected' ? (amedasResult.reason instanceof Error ? amedasResult.reason.message : String(amedasResult.reason)) : null,
      fetchedAt: new Date(now()).toISOString(),
    })).catch((error) => {
      sharedRequest = null
      sharedRequestKey = null
      cachedUntil = 0
      throw error
    })
    return sharedRequest
  }

  function collectorFor(category) {
    return async ({ prefectureCodes, initialSweep = false, collectionCycleId = null }) => {
      const targetPrefectureNames = prefectureCodes.map((code) => prefectureNamesByCode[code]).filter(Boolean)
      const shared = await loadSharedSources({ forceRefresh: initialSweep, requestKey: collectionCycleId })
      if (category !== 'HEAVY_RAIN' && shared.jmaError) throw new Error(shared.jmaError)
      if (category === 'HEAVY_RAIN' && shared.jmaError && shared.amedasError) throw new Error(`気象庁公開配信を取得できません: ${shared.jmaError} / ${shared.amedasError}`)
      const jmaItems = filterJmaEntries(shared.jmaEntries, category, targetPrefectureNames)
      const amedasItems = category === 'HEAVY_RAIN'
        ? shared.amedasObservations.filter((item) => targetPrefectureNames.includes(item.prefecture))
        : []
      const items = [...jmaItems, ...amedasItems]
      const sourceResults = [
        { id: 'JMA_DISASTER_XML', label: '気象庁防災情報XML', status: shared.jmaError ? 'ERROR' : 'SUCCESS', itemCount: jmaItems.length, fetchedAt: shared.fetchedAt, sourceUrl: publicWeatherSourceUrls.jmaXml, ...(shared.jmaError ? { error: shared.jmaError } : {}) },
        ...(category === 'HEAVY_RAIN' ? [{ id: 'JMA_AMEDAS_HOURLY_RAIN', label: '気象庁最新アメダス1時間降水量', status: shared.amedasError ? 'ERROR' : 'SUCCESS', itemCount: amedasItems.length, fetchedAt: shared.fetchedAt, sourceUrl: publicWeatherSourceUrls.amedasHourlyRain, ...(shared.amedasError ? { error: shared.amedasError } : {}) }] : []),
      ]
      const snapshot = {
        schemaVersion: 1,
        category,
        collectedAt: shared.fetchedAt,
        prefectureCodes,
        prefectureNames: targetPrefectureNames,
        sourceResults,
        items,
      }
      await writeSnapshot(snapshot)
      const heavyRainCount = amedasItems.filter((item) => item.isHeavyRain).length
      const message = category === 'HEAVY_RAIN'
        ? `気象庁XML ${jmaItems.length}件、アメダス ${amedasItems.length}地点（1時間30mm以上 ${heavyRainCount}地点）`
        : category === 'HAIL'
          ? `気象庁XML ${jmaItems.length}件を取得（雷・降ひょう等の公式文。雹の直接観測ではありません）`
          : `気象庁XML ${jmaItems.length}件を取得（道路冠水は交通規制・投稿との照合待ち）`
      return { state: 'SUCCESS', itemCount: items.length, message, sourceResults }
    }
  }

  return {
    FLOOD: collectorFor('FLOOD'),
    HEAVY_RAIN: collectorFor('HEAVY_RAIN'),
    HAIL: collectorFor('HAIL'),
  }
}
