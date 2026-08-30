export const DEMO_STORE_ID = "10000000-0000-0000-0000-000000000001";
export const DEMO_CUSTOMER_ID = "30000000-0000-0000-0000-000000000001";
export const DEMO_RECEPTION_ID = "20000000-0000-0000-0000-000000000003";
export const DEMO_MANAGER_ID = "20000000-0000-0000-0000-000000000004";

export const STATUS_LABELS: Record<string, string> = {
  reserved: "予約済み",
  confirmed: "確定",
  checked_in: "受付済み",
  in_session: "実施中",
  completed: "完了",
  cancelled: "キャンセル",
  no_show: "来所なし",
};

export const MODEL_LABELS: Record<string, string> = {
  lower_limb: "下肢タイプ",
  single_joint: "単関節タイプ",
  lumbar: "腰タイプ",
};
