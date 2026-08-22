export const collectorDefinitions = [
  { category: 'UNDERPASS', label: '道路冠水注意地点', intervalSeconds: 86_400, configured: true, connectedSourceLabels: ['国土交通省KML'], gatedSourceLabels: ['道路情報提供システム'], unavailableSourceLabels: [] },
  { category: 'FLOOD', label: '冠水', intervalSeconds: 300, configured: true, connectedSourceLabels: ['気象庁防災情報XML'], gatedSourceLabels: ['河川情報数値配信', 'キキクルGRIB2', 'JARTIC'], unavailableSourceLabels: [] },
  { category: 'HEAVY_RAIN', label: '激しい雨・水たまり', intervalSeconds: 300, configured: true, connectedSourceLabels: ['気象庁防災情報XML', '気象庁アメダスCSV'], gatedSourceLabels: ['高解像度降水ナウキャスト', '降水短時間予報', 'Weather Data API'], unavailableSourceLabels: ['アメフリ'], },
  { category: 'HAIL', label: '雹', intervalSeconds: 600, configured: true, connectedSourceLabels: ['気象庁防災情報XML'], gatedSourceLabels: ['雷ナウキャスト', '高解像度降水ナウキャスト', '雹対応気象API'], unavailableSourceLabels: [] },
  { category: 'ACCIDENT', label: '事故・故障車', intervalSeconds: 300, configured: false, connectedSourceLabels: [], gatedSourceLabels: ['JARTIC', 'VICS'], unavailableSourceLabels: ['ドラぷらWeb転載'] },
  { category: 'OBJECT', label: '落下物・落石', intervalSeconds: 300, configured: false, connectedSourceLabels: [], gatedSourceLabels: ['JARTIC', '国交省道路情報', 'NEXCO許諾'], unavailableSourceLabels: ['ドラぷらWeb転載'] },
  { category: 'ROADWORK', label: '工事・車線規制', intervalSeconds: 300, configured: false, connectedSourceLabels: [], gatedSourceLabels: ['JARTIC', '国交省道路情報', 'NEXCO許諾'], unavailableSourceLabels: ['ドラぷらWeb転載'] },
  { category: 'POLICE', label: '交通安全重点地点', intervalSeconds: 86_400, configured: false, connectedSourceLabels: [], gatedSourceLabels: ['都道府県警察公開情報の個別アダプター'], unavailableSourceLabels: [] },
]

function iso(now) {
  return new Date(now()).toISOString()
}

export class HazardCollectorScheduler {
  constructor({ definitions, collectors, onChange = () => {}, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
    this.definitions = definitions
    this.collectors = collectors
    this.onChange = onChange
    this.now = now
    this.setTimer = setTimer
    this.clearTimer = clearTimer
    this.timers = new Map()
    this.generation = 0
    this.activitySequence = 0
    this.state = {
      running: false,
      startedAt: null,
      stoppedAt: null,
      prefectureCodes: ['13'],
      activity: [],
      categories: Object.fromEntries(definitions.map((definition) => [definition.category, {
        category: definition.category,
        label: definition.label,
        intervalSeconds: definition.intervalSeconds,
        configured: definition.configured,
        connectedSourceLabels: definition.connectedSourceLabels ?? [],
        gatedSourceLabels: definition.gatedSourceLabels ?? [],
        unavailableSourceLabels: definition.unavailableSourceLabels ?? [],
        sourceResults: [],
        state: 'IDLE',
        pollCount: 0,
        lastPolledAt: null,
        nextPollAt: null,
        lastItemCount: null,
        message: definition.configured ? '収集開始待ち' : '収集元未接続',
      }])),
    }
  }

  snapshot() {
    return structuredClone(this.state)
  }

  restore(savedState) {
    if (!savedState || typeof savedState !== 'object' || this.state.running) return this.snapshot()
    if (Array.isArray(savedState.prefectureCodes) && savedState.prefectureCodes.length) this.state.prefectureCodes = [...savedState.prefectureCodes]
    this.state.startedAt = typeof savedState.startedAt === 'string' ? savedState.startedAt : null
    this.state.stoppedAt = typeof savedState.stoppedAt === 'string' ? savedState.stoppedAt : null
    this.state.activity = Array.isArray(savedState.activity)
      ? savedState.activity.filter((activity) => activity && typeof activity.id === 'string' && typeof activity.title === 'string').slice(-80)
      : []
    this.activitySequence = this.state.activity.length
    for (const category of Object.values(this.state.categories)) {
      const savedCategory = savedState.categories?.[category.category]
      if (!savedCategory) continue
      category.pollCount = Number.isFinite(savedCategory.pollCount) ? savedCategory.pollCount : 0
      category.lastPolledAt = typeof savedCategory.lastPolledAt === 'string' ? savedCategory.lastPolledAt : null
      category.lastItemCount = Number.isFinite(savedCategory.lastItemCount) ? savedCategory.lastItemCount : null
      category.sourceResults = Array.isArray(savedCategory.sourceResults) ? savedCategory.sourceResults : []
      category.nextPollAt = null
      category.state = 'STOPPED'
      category.message = savedState.running ? '収集サービス再起動後の再開待ち' : '収集を停止しました'
    }
    return this.snapshot()
  }

  async start(prefectureCodes) {
    if (this.state.running) return this.snapshot()
    this.generation += 1
    const generation = this.generation
    this.state.running = true
    this.state.startedAt = iso(this.now)
    this.state.stoppedAt = null
    this.state.prefectureCodes = [...prefectureCodes]
    const configuredCount = this.definitions.filter((definition) => definition.configured).length
    this.#recordActivity({
      type: 'COLLECTION_STARTED',
      tone: 'running',
      title: '全カテゴリの初回一斉収集を開始しました',
      detail: `${prefectureCodes.length}都道府県、${this.definitions.length}カテゴリを周期に関係なく確認します。実データ接続は${configuredCount}カテゴリです。`,
    })
    this.#notify()
    const collectionCycleId = `initial-${generation}`
    await Promise.all(this.definitions.map((definition) => this.#pollAndSchedule(definition, generation, { initialSweep: true, collectionCycleId })))
    if (this.state.running && generation === this.generation) {
      this.#recordActivity({
        type: 'INITIAL_SWEEP_COMPLETED',
        tone: 'success',
        title: '初回一斉収集が完了しました',
        detail: '2周目から、各危険カテゴリに設定された周期で収集します。',
      })
      this.#notify()
    }
    return this.snapshot()
  }

  stop() {
    this.generation += 1
    for (const timer of this.timers.values()) this.clearTimer(timer)
    this.timers.clear()
    this.state.running = false
    this.state.stoppedAt = iso(this.now)
    for (const category of Object.values(this.state.categories)) {
      category.nextPollAt = null
      category.state = 'STOPPED'
      category.message = '収集を停止しました'
    }
    this.#recordActivity({
      type: 'COLLECTION_STOPPED',
      tone: 'stopped',
      title: '継続収集を停止しました',
      detail: '予約済みの次回ポーリングをすべて解除しました。',
    })
    this.#notify()
    return this.snapshot()
  }

  async #pollAndSchedule(definition, generation, { initialSweep = false, collectionCycleId = null } = {}) {
    if (!this.state.running || generation !== this.generation) return
    const category = this.state.categories[definition.category]
    category.state = 'RUNNING'
    category.nextPollAt = null
    this.#recordActivity({
      type: 'POLL_STARTED',
      category: definition.category,
      tone: 'running',
      title: `${definition.label}の確認を開始`,
      detail: definition.configured
        ? (initialSweep ? '初回一斉収集として、キャッシュを使わず接続済みの全情報源を取得しています。' : '設定周期に従い、接続済みの外部情報源から実データを取得しています。')
        : '外部情報源の接続状態を確認しています。実データ取得は行いません。',
    })
    this.#notify()

    try {
      const collect = this.collectors[definition.category]
      const result = collect
        ? await collect({ prefectureCodes: this.state.prefectureCodes, initialSweep, collectionCycleId })
        : { state: 'WAITING_SOURCE', itemCount: null, message: '収集元が未接続のため、この周期は確認のみ行いました' }
      category.state = result.state ?? 'SUCCESS'
      category.lastItemCount = result.itemCount ?? null
      category.message = result.message ?? '収集が完了しました'
      category.sourceResults = Array.isArray(result.sourceResults) ? result.sourceResults : []
    } catch (error) {
      category.state = 'ERROR'
      category.message = error instanceof Error ? error.message : String(error)
      category.sourceResults = []
    }

    if (!this.state.running || generation !== this.generation) {
      category.state = 'STOPPED'
      category.nextPollAt = null
      category.message = '収集を停止しました'
      this.#notify()
      return
    }

    category.pollCount += 1
    category.lastPolledAt = iso(this.now)
    if (!this.state.running || generation !== this.generation) {
      category.nextPollAt = null
      this.#notify()
      return
    }

    category.nextPollAt = new Date(this.now() + definition.intervalSeconds * 1_000).toISOString()
    if (category.state === 'SUCCESS') {
      this.#recordActivity({
        type: 'POLL_SUCCEEDED',
        category: definition.category,
        tone: 'success',
        title: `${definition.label}の収集が完了`,
        detail: `${category.lastItemCount ?? 0}件を取得し、次回ポーリングを予約しました。`,
      })
    } else if (category.state === 'WAITING_SOURCE') {
      this.#recordActivity({
        type: 'POLL_SKIPPED',
        category: definition.category,
        tone: 'waiting',
        title: `${definition.label}は外部収集なし`,
        detail: '外部収集元が未接続のため確認だけを行いました。ユーザー投稿は標準収集元として常時受付します。',
      })
    } else if (category.state === 'ERROR') {
      this.#recordActivity({
        type: 'POLL_FAILED',
        category: definition.category,
        tone: 'error',
        title: `${definition.label}の収集に失敗`,
        detail: category.message,
      })
    }
    const timer = this.setTimer(() => {
      this.timers.delete(definition.category)
      return this.#pollAndSchedule(definition, generation)
    }, definition.intervalSeconds * 1_000)
    this.timers.set(definition.category, timer)
    this.#notify()
  }

  #notify() {
    this.onChange(this.snapshot())
  }

  #recordActivity({ type, category = null, tone, title, detail }) {
    this.activitySequence += 1
    this.state.activity.push({
      id: `${this.now()}-${this.activitySequence}`,
      at: iso(this.now),
      type,
      category,
      tone,
      title,
      detail,
    })
    if (this.state.activity.length > 80) this.state.activity.splice(0, this.state.activity.length - 80)
  }
}
