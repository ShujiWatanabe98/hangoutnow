export const STORE_FEATURE_KEYS = [
  "appointments",
  "customers",
  "messages",
  "intake",
  "equipment",
  "physical",
  "clinical",
  "billing",
  "staff",
] as const;

export type StoreFeatureKey = (typeof STORE_FEATURE_KEYS)[number];
export type StoreFeatureFlags = Record<StoreFeatureKey, boolean>;

export const STORE_FEATURE_META: Record<StoreFeatureKey, { label: string; description: string }> = {
  appointments: { label: "予約", description: "施設・利用者の予約管理と空き枠" },
  customers: { label: "利用者", description: "利用者台帳・履歴・注意事項" },
  messages: { label: "メッセージ", description: "施設と利用者のメッセージ" },
  intake: { label: "問診", description: "初診問診と問診票改修" },
  equipment: { label: "機材管理", description: "HAL機器・トレッドミル・ベンチ" },
  physical: { label: "身体機能", description: "測定・動画撮影・自動解析" },
  clinical: { label: "施術記録", description: "本日・履歴・評価記録" },
  billing: { label: "会計", description: "請求・支払い確認・売上" },
  staff: { label: "スタッフ", description: "スタッフ台帳・出退勤" },
};

export const STORE_FEATURE_DEPENDENCIES: Record<StoreFeatureKey, StoreFeatureKey[]> = {
  appointments: ["customers", "equipment", "staff"],
  customers: [],
  messages: ["customers"],
  intake: ["customers"],
  equipment: [],
  physical: ["customers", "equipment", "staff"],
  clinical: ["appointments", "customers", "staff"],
  billing: ["clinical", "customers"],
  staff: [],
};

export const DEFAULT_STORE_FEATURE_FLAGS: StoreFeatureFlags = Object.fromEntries(
  STORE_FEATURE_KEYS.map((key) => [key, true]),
) as StoreFeatureFlags;

export type StoreFeatureAccess = {
  requested: StoreFeatureFlags;
  effective: StoreFeatureFlags;
  blockedBy: Record<StoreFeatureKey, StoreFeatureKey[]>;
};

export function normalizeStoreFeatureFlags(value: unknown): StoreFeatureFlags {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    STORE_FEATURE_KEYS.map((key) => [key, typeof source[key] === "boolean" ? source[key] : true]),
  ) as StoreFeatureFlags;
}

export function resolveStoreFeatureAccess(value: unknown): StoreFeatureAccess {
  const requested = normalizeStoreFeatureFlags(value);
  const effective = { ...requested };
  const blockedBy = {} as Record<StoreFeatureKey, StoreFeatureKey[]>;
  for (const key of STORE_FEATURE_KEYS) blockedBy[key] = [];

  // 依存が連鎖するため、安定するまで評価する。
  for (let pass = 0; pass < STORE_FEATURE_KEYS.length; pass += 1) {
    let changed = false;
    for (const key of STORE_FEATURE_KEYS) {
      const blocked = STORE_FEATURE_DEPENDENCIES[key].filter((dependency) => !effective[dependency]);
      blockedBy[key] = blocked;
      const next = requested[key] && blocked.length === 0;
      if (effective[key] !== next) {
        effective[key] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const key of STORE_FEATURE_KEYS) {
    blockedBy[key] = STORE_FEATURE_DEPENDENCIES[key].filter((dependency) => !effective[dependency]);
  }
  return { requested, effective, blockedBy };
}
