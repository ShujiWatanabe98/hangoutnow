import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { resolveStoreFeatureAccess, STORE_FEATURE_META, type StoreFeatureKey } from "@/lib/store-features";

export async function disabledStoreFeatureResponse(storeId: string, feature: StoreFeatureKey) {
  const result = await query<{ feature_flags: unknown }>(`SELECT feature_flags FROM stores WHERE id=$1`, [storeId]);
  const store = result.rows[0];
  if (!store) return NextResponse.json({ error: "施設が見つかりません。" }, { status: 404 });
  const access = resolveStoreFeatureAccess(store.feature_flags);
  if (access.effective[feature]) return null;
  const blocked = access.blockedBy[feature].map((key) => STORE_FEATURE_META[key].label);
  return NextResponse.json({
    error: blocked.length
      ? `${STORE_FEATURE_META[feature].label}機能は、${blocked.join("・")}機能がOFFのため利用できません。`
      : `${STORE_FEATURE_META[feature].label}機能は管理者設定でOFFになっています。`,
    code: "STORE_FEATURE_DISABLED",
    feature,
    blockedBy: access.blockedBy[feature],
  }, { status: 403 });
}
