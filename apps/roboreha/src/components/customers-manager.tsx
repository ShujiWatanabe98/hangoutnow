"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Bot,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardPlus,
  CreditCard,
  FileVideo,
  Footprints,
  History,
  ListFilter,
  Play,
  Save,
  Search,
  Sparkles,
  Square,
  TicketCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  analyzeVideoFile,
  calculatePoseMaximumMetrics,
  POSE_CONNECTIONS,
  type PoseFrame,
  type PoseMaximumMetrics,
  type VideoPoseAnalysis,
} from "@/lib/pose-analysis";
import { RotatingTextSuggestions } from "./rotating-text-suggestions";

type TodayAppointment = {
  id: string;
  customer_id: string;
  customer_name: string;
  primary_condition: string;
  start_at: string;
  status: string;
  product_name: string;
  therapist_name: string;
  hal_asset_code: string;
  safety_decision: string | null;
  cautions?: CustomerCaution[];
};
type CustomerCaution = {
  id: string;
  severity: "caution" | "high";
  category: string;
  title: string;
  detail: string;
  responseNote: string | null;
};
type CustomerListItem = {
  id: string;
  customer_code: string;
  name: string;
  name_kana: string;
  birth_date: string;
  phone: string;
  primary_condition: string;
  goal: string;
  preferred_payment_method: PaymentMethod | null;
  completed_visits: number;
  last_visit: string | null;
  next_visit: string | null;
  total_paid_yen: number;
  ticket_remaining: number;
};
type Metrics = {
  walk10mSeconds: number;
  gaitSpeed: number;
  tugSeconds: number;
  bbs: number;
  chairStand30s: number;
};
type Assessment = {
  id: string;
  appointment_id: string;
  pre_metrics: Metrics;
  post_metrics: Metrics;
  delta_summary: Metrics;
  summary_text: string;
  notes: string;
  assessed_at: string;
  evaluator_name: string;
  videos: Array<{
    id: string;
    phase: "before" | "after" | "analysis";
    url: string;
    mimeType: string;
  }>;
  ai_analysis?: {
    improvementPoints: string[];
    confidenceLabel: string;
    disclaimer: string;
    videoUrl: string;
  } | null;
};
type PhysicalFunctionSession = {
  id: string;
  appointment_id: string;
  status: string;
  capture_condition: "without_hal" | "with_hal_lower_limb" | "with_hal_lumbar";
  hal_size: "S" | "L" | null;
  assistance_level: string;
  assistive_device: string;
  walking_distance_m: number | string;
  camera_view: string;
  notes: string;
  clinician_summary: string;
  recorded_at: string;
  evaluator_name: string;
  hal_asset_code: string | null;
  measurements: Array<{ code: string; side: string; value: number | string; unit: string; source: string; confidence: number | string | null }>;
  videos: Array<{ id: string; phase: string; testCode: string; url: string }>;
  analysis: null | {
    status: string;
    patientTrackId: string;
    helperTrackIds: string[];
    qualityFlags: string[];
    walkingTimeSeconds: number | string | null;
    walkingSpeedMps: number | string | null;
    stepCount: number | null;
    cadenceSpm: number | string | null;
    leftStepLengthM: number | string | null;
    rightStepLengthM: number | string | null;
    symmetryPercent: number | string | null;
    trunkLeanDegrees: number | string | null;
    helperOverlapPercent: number | string | null;
    confidence: number | string;
  };
  report: null | { summary: string; improvementPoints: string[]; commentCandidates: string[]; disclaimer: string };
};
type CustomerHistory = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  note: string;
  product_name: string;
  therapist_name: string;
  hal_asset_code: string;
  rehab_space_name: string | null;
};
type PaymentMethod = "cash" | "credit_card" | "qr" | "ticket";
type Payment = {
  id: string;
  amount_yen: number;
  payment_method: PaymentMethod | null;
  status: string;
  paid_at: string | null;
  product_name: string;
  start_at: string;
};
type TicketPurchase = {
  id: string;
  ticket_type: 5 | 10;
  purchased_uses: number;
  amount_yen: number;
  payment_method: PaymentMethod;
  purchased_at: string;
  expires_on: string;
  status: string;
  product_name: string;
};
type Wallet = {
  id: string;
  product_id: string;
  remaining_uses: number;
  expires_on: string;
  product_name: string;
};
type Product = { id: string; name: string; price_yen: number };
type CustomerDetail = {
  customer: CustomerListItem & {
    email: string;
    emergency_contact: Record<string, string>;
  };
  history: CustomerHistory[];
  assessments: Assessment[];
  physicalFunctionSessions: PhysicalFunctionSession[];
  payments: Payment[];
  ticketPurchases: TicketPurchase[];
  wallets: Wallet[];
  products: Product[];
  cautions: CustomerCaution[];
  paymentSummary: { totalPaidYen: number; paidCount: number };
};

const metricDefs: Array<{
  key: keyof Metrics;
  label: string;
  unit: string;
  lowerBetter: boolean;
  step: string;
}> = [
  {
    key: "walk10mSeconds",
    label: "10m歩行時間",
    unit: "秒",
    lowerBetter: true,
    step: "0.1",
  },
  {
    key: "gaitSpeed",
    label: "歩行速度",
    unit: "m/s",
    lowerBetter: false,
    step: "0.01",
  },
  {
    key: "tugSeconds",
    label: "TUG",
    unit: "秒",
    lowerBetter: true,
    step: "0.1",
  },
  { key: "bbs", label: "BBS", unit: "点", lowerBetter: false, step: "1" },
  {
    key: "chairStand30s",
    label: "30秒立ち上がり",
    unit: "回",
    lowerBetter: false,
    step: "1",
  },
];
const dateText = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
const timeText = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const yenText = (value: number) =>
  `${new Intl.NumberFormat("ja-JP").format(Number(value))}円`;
const paymentLabels: Record<PaymentMethod, string> = {
  cash: "現金",
  credit_card: "クレジットカード",
  qr: "QR決済",
  ticket: "回数券",
};

export function CustomersManager({
  todayAppointments,
}: {
  todayAppointments: TodayAppointment[];
}) {
  const [mode, setMode] = useState<"today" | "list">("today");
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<
    "kana" | "visits" | "last" | "next" | "paid"
  >("kana");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assessmentAppointment, setAssessmentAppointment] =
    useState<TodayAppointment | null>(null);

  async function loadCustomers() {
    const response = await fetch("/api/customers", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error ?? "利用者一覧を取得できませんでした。");
    setCustomers(body.customers);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/customers", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setCustomers(body.customers);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const filtered = useMemo(
    () =>
      customers
        .filter((customer) =>
          `${customer.name}${customer.name_kana}${customer.customer_code}${customer.primary_condition}${customer.preferred_payment_method ? paymentLabels[customer.preferred_payment_method] : ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .sort((a, b) => {
          if (sort === "visits")
            return Number(b.completed_visits) - Number(a.completed_visits);
          if (sort === "paid")
            return Number(b.total_paid_yen) - Number(a.total_paid_yen);
          if (sort === "last")
            return (
              (b.last_visit ? new Date(b.last_visit).getTime() : 0) -
              (a.last_visit ? new Date(a.last_visit).getTime() : 0)
            );
          if (sort === "next")
            return (
              (a.next_visit
                ? new Date(a.next_visit).getTime()
                : Number.MAX_SAFE_INTEGER) -
              (b.next_visit
                ? new Date(b.next_visit).getTime()
                : Number.MAX_SAFE_INTEGER)
            );
          return a.name_kana.localeCompare(b.name_kana, "ja");
        }),
    [customers, search, sort],
  );
  const todaysCautions = useMemo(() => {
    const unique = new Map<
      string,
      CustomerCaution & { customerName: string; customerId: string }
    >();
    todayAppointments.forEach((appointment) =>
      (appointment.cautions ?? []).forEach((caution) =>
        unique.set(caution.id, {
          ...caution,
          customerName: appointment.customer_name,
          customerId: appointment.customer_id,
        }),
      ),
    );
    return [...unique.values()];
  }, [todayAppointments]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/customers?id=${id}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDetail(body);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "詳細を取得できませんでした。",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black tracking-[0.15em] text-[#087f71]">
            CUSTOMER & CLINICAL
          </p>
          <h2 className="text-2xl font-black tracking-[-0.04em]">利用者管理</h2>
          <p className="mt-1 text-xs text-[#71858a]">
            本日の記録と利用者ごとの履歴・評価を管理
          </p>
        </div>
        <div className="flex rounded-xl border border-[#d7e4e1] bg-white p-1">
          <button
            onClick={() => setMode("today")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black ${mode === "today" ? "bg-[#173b42] text-white" : "text-[#71858a]"}`}
          >
            <CalendarDays size={16} />
            本日の利用者
          </button>
          <button
            onClick={() => setMode("list")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black ${mode === "list" ? "bg-[#173b42] text-white" : "text-[#71858a]"}`}
          >
            <UsersRound size={16} />
            利用者リスト
          </button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]"
        >
          {error}
        </div>
      )}
      {mode === "list" && (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs font-bold text-[#71858a]">
            検索結果 {filtered.length}名
          </span>
          <label className="flex items-center gap-2 rounded-xl border border-[#d7e4e1] bg-white px-3">
            <ArrowUpDown size={16} className="text-[#829397]" />
            <select
              aria-label="利用者の並び順"
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="bg-transparent py-2.5 text-sm font-bold outline-none"
            >
              <option value="kana">氏名順</option>
              <option value="visits">利用回数が多い順</option>
              <option value="last">最終利用が新しい順</option>
              <option value="next">次回予約が近い順</option>
              <option value="paid">支払合計が多い順</option>
            </select>
          </label>
        </div>
      )}
      {mode === "today" ? (
        <section className="rounded-[24px] border border-[#dce8e5] bg-white p-4 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-black">本日の利用者</h3>
              <p className="mt-1 text-xs text-[#71858a]">
                評価結果とHAL使用前後の動画を記録できます。
              </p>
            </div>
            <span className="rounded-full bg-[#e7f5f1] px-3 py-1 text-xs font-black text-[#087f71]">
              {todayAppointments.length}名
            </span>
          </div>
          <div className="space-y-3">
            {todayAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="grid items-center gap-3 rounded-2xl border border-[#dce8e5] p-4 md:grid-cols-[74px_1fr_auto]"
              >
                <div>
                  <p className="text-xl font-black">
                    {timeText(appointment.start_at)}
                  </p>
                  <p className="text-[10px] text-[#829397]">本日</p>
                </div>
                <div className="border-l border-[#dce8e5] pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{appointment.customer_name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${appointment.safety_decision === "stop" ? "bg-[#fff0ed] text-[#bd4f3f]" : appointment.safety_decision === "allow" ? "bg-[#e7f5f1] text-[#087f71]" : "bg-[#eef3f2] text-[#687d84]"}`}
                    >
                      {appointment.safety_decision === "stop"
                        ? "STOP"
                        : appointment.safety_decision === "allow"
                          ? "実施可"
                          : "未受付"}
                    </span>
                    {(appointment.cautions?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-[#fff3d5] px-2 py-0.5 text-[10px] font-black text-[#9a6810]">
                        <AlertTriangle size={11} /> 注意事項あり
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#71858a]">
                    {appointment.primary_condition} ・{" "}
                    {appointment.product_name}
                  </p>
                  <p className="mt-1 text-[11px] text-[#91a0a3]">
                    {appointment.therapist_name} / {appointment.hal_asset_code}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openDetail(appointment.customer_id)}
                    className="rounded-xl border border-[#d7e4e1] px-3 py-2.5 text-xs font-black"
                  >
                    詳細
                  </button>
                  <button
                    onClick={() => setAssessmentAppointment(appointment)}
                    className="flex items-center gap-2 rounded-xl bg-[#087f71] px-4 py-2.5 text-xs font-black text-white"
                  >
                    <ClipboardPlus size={16} />
                    記録
                  </button>
                </div>
              </div>
            ))}
          </div>
          {todaysCautions.length > 0 && (
            <section
              aria-label="本日の注意事項"
              className="mt-5 rounded-2xl border border-[#efcf85] bg-[#fff9e9] p-4"
            >
              <div className="flex items-center gap-2 text-[#8b5b08]">
                <AlertTriangle size={19} />
                <h4 className="font-black">注意事項</h4>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black">
                  {todaysCautions.length}件
                </span>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {todaysCautions.map((caution) => (
                  <button
                    key={caution.id}
                    onClick={() => openDetail(caution.customerId)}
                    className={`rounded-xl border bg-white p-3 text-left ${caution.severity === "high" ? "border-[#df7467]" : "border-[#ead9ae]"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black">{caution.customerName}</span>
                      {caution.severity === "high" && (
                        <span className="rounded-full bg-[#fff0ed] px-2 py-0.5 text-[10px] font-black text-[#bd4f3f]">
                          重要
                        </span>
                      )}
                      <span className="text-xs font-black text-[#8b5b08]">
                        {caution.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#5f6f73]">
                      {caution.detail}
                    </p>
                    {caution.responseNote && (
                      <p className="mt-1 text-[11px] font-bold text-[#7c6332]">
                        対応：{caution.responseNote}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      ) : (
        <section className="rounded-[24px] border border-[#dce8e5] bg-white p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black">利用者リスト</h3>
              <p className="mt-1 text-xs text-[#71858a]">
                登録利用者 {customers.length}名
              </p>
            </div>
            <label className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-[#d7e4e1] bg-[#f9fbfa] px-3">
              <Search size={17} className="text-[#829397]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="氏名・利用者番号・疾患で検索"
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#dce8e5] text-[11px] text-[#71858a]">
                  <th className="px-3 py-3">利用者</th>
                  <th className="px-3 py-3">主な状態</th>
                  <th className="px-3 py-3">利用回数</th>
                  <th className="px-3 py-3">最終利用</th>
                  <th className="px-3 py-3">次回予約</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-[#e7eeec] hover:bg-[#f8fbfa]"
                  >
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 place-items-center rounded-full bg-[#e7f5f1] text-[#087f71]">
                          <UserRound size={19} />
                        </div>
                        <div>
                          <p className="font-black">{customer.name}</p>
                          <p className="text-[10px] text-[#829397]">
                            {customer.customer_code}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm">
                      {customer.primary_condition}
                    </td>
                    <td className="px-3 py-4 text-sm font-black">
                      {customer.completed_visits}回
                    </td>
                    <td className="px-3 py-4 text-xs">
                      {customer.last_visit
                        ? dateText(customer.last_visit)
                        : "—"}
                    </td>
                    <td className="px-3 py-4 text-xs">
                      {customer.next_visit
                        ? dateText(customer.next_visit)
                        : "—"}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <button
                        onClick={() => openDetail(customer.id)}
                        className="rounded-xl bg-[#edf5f3] px-4 py-2.5 text-xs font-black text-[#087f71]"
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {detailLoading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#09262c]/30">
          <div className="rounded-full bg-white px-5 py-3 text-sm font-bold shadow-xl">
            履歴を読み込んでいます…
          </div>
        </div>
      )}
      {detail && (
        <CustomerDetailModal
          detail={detail}
          onClose={() => setDetail(null)}
          onRefresh={() => openDetail(detail.customer.id)}
        />
      )}
      {assessmentAppointment && (
        <AssessmentModal
          appointment={assessmentAppointment}
          onClose={() => setAssessmentAppointment(null)}
          onSaved={async () => {
            await loadCustomers();
          }}
        />
      )}
    </div>
  );
}

function CustomerDetailModal({
  detail,
  onClose,
  onRefresh,
}: {
  detail: CustomerDetail;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [section, setSection] = useState<
    "history" | "assessments" | "physical" | "payments"
  >("history");
  const [selectedHistory, setSelectedHistory] =
    useState<CustomerHistory | null>(null);
  const selectedAssessment = selectedHistory
    ? (detail.assessments.find(
        (item) => item.appointment_id === selectedHistory.id,
      ) ?? null)
    : null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#09262c]/50 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-detail-title"
        className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl md:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black tracking-wider text-[#087f71]">
              CUSTOMER DETAIL
            </p>
            <h3 id="customer-detail-title" className="mt-1 text-2xl font-black">
              {detail.customer.name}さん
            </h3>
            <p className="mt-1 text-xs text-[#71858a]">
              {detail.customer.customer_code} ・{" "}
              {detail.customer.primary_condition}
            </p>
          </div>
          <button
            aria-label="閉じる"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-[#edf4f2]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Info label="目標" value={detail.customer.goal} />
          <Info label="電話" value={detail.customer.phone} />
        </div>
        {detail.cautions.length > 0 && (
          <section
            aria-label="利用者の注意事項"
            className="mt-4 rounded-2xl border border-[#efcf85] bg-[#fff9e9] p-4"
          >
            <div className="flex items-center gap-2 text-[#8b5b08]">
              <AlertTriangle size={18} />
              <h4 className="font-black">注意事項</h4>
            </div>
            <div className="mt-3 space-y-2">
              {detail.cautions.map((caution) => (
                <div key={caution.id} className="rounded-xl bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black">{caution.title}</p>
                    {caution.severity === "high" && (
                      <span className="rounded-full bg-[#fff0ed] px-2 py-0.5 text-[10px] font-black text-[#bd4f3f]">
                        重要
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#5f6f73]">
                    {caution.detail}
                  </p>
                  {caution.responseNote && (
                    <p className="mt-2 rounded-lg bg-[#fff7df] p-2 text-xs font-bold text-[#795d22]">
                      対応：{caution.responseNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="mt-6 flex border-b border-[#dce8e5]">
          <button
            onClick={() => setSection("history")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-black ${section === "history" ? "border-[#087f71] text-[#087f71]" : "border-transparent text-[#71858a]"}`}
          >
            <History size={17} />
            利用履歴
          </button>
          <button
            onClick={() => setSection("assessments")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-black ${section === "assessments" ? "border-[#087f71] text-[#087f71]" : "border-transparent text-[#71858a]"}`}
          >
            <Activity size={17} />
            評価・比較
          </button>
          <button
            onClick={() => setSection("physical")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-black ${section === "physical" ? "border-[#087f71] text-[#087f71]" : "border-transparent text-[#71858a]"}`}
          >
            <Footprints size={17} />
            身体機能
          </button>
          <button
            onClick={() => setSection("payments")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-black ${section === "payments" ? "border-[#087f71] text-[#087f71]" : "border-transparent text-[#71858a]"}`}
          >
            <CreditCard size={17} />
            支払い・回数券
          </button>
        </div>
        {section === "history" ? (
          <div className="mt-4 space-y-3">
            {detail.history.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#dce8e5] p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-black">
                      {dateText(item.start_at)} {timeText(item.start_at)}
                    </p>
                    <p className="mt-1 text-sm text-[#58716f]">
                      {item.product_name}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#edf4f2] px-2.5 py-1 text-[10px] font-bold">
                    {item.status === "completed"
                      ? "完了"
                      : item.status === "cancelled"
                        ? "キャンセル"
                        : "予約"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-[#71858a]">
                  担当 {item.therapist_name} ・ {item.hal_asset_code} ・{" "}
                  {item.rehab_space_name || "スペース記録なし"}
                </p>
                {item.note && (
                  <p className="mt-2 rounded-lg bg-[#f5f8f7] p-2 text-xs text-[#71858a]">
                    {item.note}
                  </p>
                )}
                <button
                  onClick={() => setSelectedHistory(item)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#087f71] py-2.5 text-xs font-black text-white"
                >
                  <FileVideo size={16} />
                  詳細
                </button>
              </div>
            ))}
          </div>
        ) : section === "assessments" ? (
          <div className="mt-4 space-y-5">
            {detail.assessments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfdeda] p-10 text-center text-sm text-[#829397]">
                評価記録はまだありません
              </div>
            ) : (
              detail.assessments.map((assessment) => (
                <AssessmentSummary
                  key={assessment.id}
                  assessment={assessment}
                />
              ))
            )}
          </div>
        ) : section === "physical" ? (
          <div className="mt-4 space-y-4">
            {detail.physicalFunctionSessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfdeda] p-10 text-center text-sm text-[#829397]">
                身体機能記録はまだありません
              </div>
            ) : (
              detail.physicalFunctionSessions.map((session) => (
                <PhysicalFunctionSummary key={session.id} session={session} />
              ))
            )}
          </div>
        ) : (
          <PaymentManagement detail={detail} onRefresh={onRefresh} />
        )}
        {selectedHistory && (
          <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[#09262c]/60 p-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="history-detail-title"
              className="my-4 w-full max-w-2xl rounded-[26px] bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-black text-[#087f71]">
                    利用履歴 詳細
                  </p>
                  <h4
                    id="history-detail-title"
                    className="mt-1 text-xl font-black"
                  >
                    {dateText(selectedHistory.start_at)}{" "}
                    {selectedHistory.product_name}
                  </h4>
                </div>
                <button
                  aria-label="履歴詳細を閉じる"
                  onClick={() => setSelectedHistory(null)}
                  className="grid size-10 place-items-center rounded-full bg-[#edf4f2]"
                >
                  <X />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Info label="療法士" value={selectedHistory.therapist_name} />
                <Info label="HAL機器" value={selectedHistory.hal_asset_code} />
                <Info
                  label="リハスペース"
                  value={selectedHistory.rehab_space_name || "記録なし"}
                />
                <Info label="施術メモ" value={selectedHistory.note || "なし"} />
              </div>
              {selectedAssessment ? (
                <div className="mt-5">
                  <AssessmentSummary assessment={selectedAssessment} />
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-[#cfdeda] p-8 text-center text-sm font-bold text-[#829397]">
                  この利用日の動画・申し送り・評価サマリはまだ登録されていません
                </div>
              )}
              <button
                onClick={() => setSelectedHistory(null)}
                className="mt-5 w-full rounded-xl bg-[#173b42] py-3 font-black text-white"
              >
                閉じる
              </button>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function PhysicalFunctionSummary({ session }: { session: PhysicalFunctionSession }) {
  const conditionLabels = { without_hal: "HALなし", with_hal_lower_limb: "下肢HAL装着", with_hal_lumbar: "腰HAL装着" };
  const assistanceLabels: Record<string, string> = { independent: "自立", supervision: "見守り", light: "軽介助", moderate: "中等度介助", maximum: "最大介助" };
  const value = (item: number | string | null | undefined, digits = 2) => item == null ? "—" : Number(item).toFixed(digits).replace(/\.00$/, "");
  const video = session.videos.find((item) => item.phase !== "analysis");
  return <article className="rounded-[22px] border border-[#dce8e5] p-4">
    <div className="flex items-start justify-between"><div><p className="font-black">{dateText(session.recorded_at)}の身体機能</p><p className="mt-1 text-xs text-[#71858a]">評価者 {session.evaluator_name}・{conditionLabels[session.capture_condition]}・{assistanceLabels[session.assistance_level] ?? session.assistance_level}</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${session.status === "finalized" ? "bg-[#e7f5f1] text-[#087f71]" : "bg-[#fff3d5] text-[#94630d]"}`}>{session.status === "finalized" ? "療法士確認済み" : "確認待ち"}</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{video ? <video src={video.url} controls playsInline className="aspect-video w-full rounded-xl bg-black object-contain" /> : <div className="grid aspect-video place-items-center rounded-xl bg-[#edf3f2] text-xs text-[#829397]">動画なし</div>}<div className="grid grid-cols-2 gap-2"><Info label="歩行時間" value={`${value(session.analysis?.walkingTimeSeconds)}秒`} /><Info label="歩行速度" value={`${value(session.analysis?.walkingSpeedMps)}m/s`} /><Info label="歩数" value={`${session.analysis?.stepCount ?? "—"}歩`} /><Info label="歩調" value={`${value(session.analysis?.cadenceSpm, 1)}歩/分`} /><Info label="左右対称性" value={`${value(session.analysis?.symmetryPercent, 1)}%`} /><Info label="解析信頼度" value={`${session.analysis ? Math.round(Number(session.analysis.confidence) * 100) : "—"}%`} /></div></div>
    {session.analysis && <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black"><span className="rounded-lg bg-[#e7f5f1] px-2 py-1 text-[#087f71]">patient: {session.analysis.patientTrackId}</span><span className="rounded-lg bg-[#fff3df] px-2 py-1 text-[#9a6810]">helperトラック: {session.analysis.helperTrackIds?.length ?? 0}本</span><span className="rounded-lg bg-[#eef1fb] px-2 py-1 text-[#5769a7]">距離: {session.walking_distance_m}m</span></div>}
    {session.analysis?.qualityFlags?.length ? <div className="mt-3 rounded-xl bg-[#fff9e9] p-3 text-xs text-[#765f31]">{session.analysis.qualityFlags.map((flag) => <p key={flag}>・{flag}</p>)}</div> : null}
    {session.report && <div className="mt-3 rounded-xl bg-[#faf9ff] p-3"><p className="text-xs font-black text-[#5d49b6]">解析サマリー</p><p className="mt-2 text-sm leading-6">{session.report.summary}</p><p className="mt-2 text-[9px] leading-4 text-[#776f91]">{session.report.disclaimer}</p></div>}
    <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="whitespace-pre-line rounded-xl bg-[#fff8e8] p-3 text-xs leading-5 text-[#6f5b2a]"><b className="block">療法士所見</b><span>{session.clinician_summary || "療法士確認待ち"}</span></div><div className="whitespace-pre-line rounded-xl bg-[#eef6ff] p-3 text-xs leading-5 text-[#426078]"><b className="block">申し送り</b><span>{session.notes || "申し送りなし"}</span></div></div>
  </article>;
}

function PaymentManagement({
  detail,
  onRefresh,
}: {
  detail: CustomerDetail;
  onRefresh: () => Promise<void>;
}) {
  const [preferred, setPreferred] = useState<PaymentMethod>(
    detail.customer.preferred_payment_method || "cash",
  );
  const [productId, setProductId] = useState(detail.products[0]?.id || "");
  const [ticketType, setTicketType] = useState<5 | 10>(5);
  const [amountYen, setAmountYen] = useState("94000");
  const [purchaseMethod, setPurchaseMethod] = useState<
    "cash" | "credit_card" | "qr"
  >("credit_card");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function savePreferred() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: detail.customer.id,
          preferredPaymentMethod: preferred,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage("支払い方法を保存しました。");
      await onRefresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function registerPurchase() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: detail.customer.id,
          productId,
          ticketType,
          amountYen: Number(amountYen),
          paymentMethod: purchaseMethod,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPreferred("ticket");
      setMessage(`${ticketType}回券の購入を登録しました。`);
      await onRefresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "回数券を登録できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Info
          label="支払済み合計"
          value={yenText(detail.paymentSummary.totalPaidYen)}
        />
        <Info label="支払件数" value={`${detail.paymentSummary.paidCount}件`} />
        <Info
          label="回数券残数"
          value={`${detail.wallets.reduce((sum, item) => sum + Number(item.remaining_uses), 0)}回`}
        />
      </div>
      <section className="rounded-2xl border border-[#dce8e5] p-4">
        <h4 className="flex items-center gap-2 font-black">
          <CreditCard size={18} className="text-[#087f71]" />
          支払い方法
        </h4>
        <div className="mt-3 flex gap-2">
          <select
            aria-label="支払い方法"
            value={preferred}
            onChange={(event) =>
              setPreferred(event.target.value as PaymentMethod)
            }
            className="min-w-0 flex-1 rounded-xl border border-[#d7e4e1] px-3 py-3 text-sm font-bold"
          >
            {Object.entries(paymentLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={savePreferred}
            disabled={saving}
            className="rounded-xl bg-[#173b42] px-5 text-sm font-black text-white disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </section>
      <section className="rounded-2xl border border-[#d8d1f1] bg-[#faf9ff] p-4">
        <h4 className="flex items-center gap-2 font-black">
          <TicketCheck size={18} className="text-[#5d49b6]" />
          回数券の購入登録
        </h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            aria-label="回数券のコース"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="rounded-xl border border-[#d8d1f1] bg-white px-3 py-3 text-sm font-bold"
          >
            {detail.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <select
            aria-label="回数券の回数"
            value={ticketType}
            onChange={(event) => {
              const uses = Number(event.target.value) as 5 | 10;
              setTicketType(uses);
              setAmountYen(uses === 5 ? "94000" : "178000");
            }}
            className="rounded-xl border border-[#d8d1f1] bg-white px-3 py-3 text-sm font-bold"
          >
            <option value={5}>5回券</option>
            <option value={10}>10回券</option>
          </select>
          <label className="rounded-xl border border-[#d8d1f1] bg-white px-3 py-2 text-[10px] font-bold text-[#71858a]">
            支払金額
            <input
              aria-label="回数券の支払金額"
              type="number"
              min="0"
              value={amountYen}
              onChange={(event) => setAmountYen(event.target.value)}
              className="block w-full text-base font-black text-[#173b42] outline-none"
            />
          </label>
          <select
            aria-label="回数券の支払い方法"
            value={purchaseMethod}
            onChange={(event) =>
              setPurchaseMethod(event.target.value as typeof purchaseMethod)
            }
            className="rounded-xl border border-[#d8d1f1] bg-white px-3 py-3 text-sm font-bold"
          >
            <option value="cash">現金</option>
            <option value="credit_card">クレジットカード</option>
            <option value="qr">QR決済</option>
          </select>
        </div>
        <button
          onClick={registerPurchase}
          disabled={saving || !productId || Number(amountYen) < 0}
          className="mt-3 w-full rounded-xl bg-[#5d49b6] py-3 text-sm font-black text-white disabled:opacity-50"
        >
          購入履歴と残数を登録
        </button>
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl bg-[#e7f5f1] p-3 text-sm font-bold text-[#087f71]"
        >
          {message}
        </p>
      )}
      <section>
        <h4 className="font-black">回数券購入履歴</h4>
        <div className="mt-2 space-y-2">
          {detail.ticketPurchases.length ? (
            detail.ticketPurchases.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-[#f4f7f6] p-3"
              >
                <div>
                  <p className="text-sm font-black">
                    {item.ticket_type}回券 ・ {item.product_name}
                  </p>
                  <p className="mt-1 text-[10px] text-[#71858a]">
                    {dateText(item.purchased_at)} /{" "}
                    {paymentLabels[item.payment_method]}
                  </p>
                </div>
                <p className="font-black">{yenText(item.amount_yen)}</p>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed p-5 text-center text-sm text-[#829397]">
              購入履歴はありません
            </p>
          )}
        </div>
      </section>
      <section>
        <h4 className="font-black">施術の支払い履歴</h4>
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {detail.payments.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-[#e2eae8] p-3"
            >
              <div>
                <p className="text-sm font-black">{item.product_name}</p>
                <p className="mt-1 text-[10px] text-[#71858a]">
                  {dateText(item.start_at)} /{" "}
                  {item.payment_method
                    ? paymentLabels[item.payment_method]
                    : "未確認"}
                </p>
              </div>
              <p className="font-black">{yenText(item.amount_yen)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AssessmentSummary({ assessment }: { assessment: Assessment }) {
  return (
    <article className="rounded-[22px] border border-[#dce8e5] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-black">{dateText(assessment.assessed_at)}の評価</p>
          <p className="mt-1 text-xs text-[#71858a]">
            評価者 {assessment.evaluator_name}
          </p>
        </div>
        <CheckCircle2 size={20} className="text-[#087f71]" />
      </div>
      <p className="mt-4 rounded-xl bg-[#e7f5f1] p-3 text-sm font-bold leading-6 text-[#176b63]">
        {assessment.summary_text}
      </p>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {metricDefs.map((metric) => {
          const delta = assessment.delta_summary[metric.key];
          const improved = metric.lowerBetter ? delta < 0 : delta > 0;
          return (
            <div
              key={metric.key}
              className="rounded-xl bg-[#f4f7f6] p-2 text-center"
            >
              <p className="truncate text-[9px] text-[#71858a]">
                {metric.label}
              </p>
              <p
                className={`mt-1 text-sm font-black ${improved ? "text-[#087f71]" : "text-[#687d84]"}`}
              >
                {delta > 0 ? "+" : ""}
                {delta}
                <span className="text-[8px]">{metric.unit}</span>
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-black text-[#58716f]">
          <FileVideo size={15} />
          記録動画
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["before", "after"] as const).map((phase) => {
            const video = assessment.videos.find(
              (item) => item.phase === phase,
            );
            return (
              <div key={phase}>
                <p className="mb-1 text-[10px] font-black text-[#71858a]">
                  HAL使用{phase === "before" ? "前" : "後"}
                </p>
                {video ? (
                  <video
                    src={video.url}
                    controls
                    playsInline
                    className="aspect-video w-full rounded-xl bg-black object-cover"
                  />
                ) : (
                  <div className="grid aspect-video place-items-center rounded-xl bg-[#edf3f2] text-xs text-[#829397]">
                    動画なし
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {assessment.ai_analysis && (
        <div className="mt-4 rounded-xl border border-[#dcd6f2] bg-[#faf9ff] p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-[#5d49b6]">AI比較動画</p>
            <span className="text-[9px] font-black text-[#776f91]">
              {assessment.ai_analysis.confidenceLabel}
            </span>
          </div>
          <video
            src={assessment.ai_analysis.videoUrl}
            controls
            playsInline
            className="mt-2 aspect-[8/3] w-full rounded-lg bg-black object-contain"
          />
          <p className="mt-2 text-[9px] leading-4 text-[#776f91]">
            {assessment.ai_analysis.disclaimer}
          </p>
        </div>
      )}
      <p className="mt-3 whitespace-pre-line rounded-xl bg-[#fff8e8] p-3 text-xs leading-5 text-[#6f5b2a]">
        所見・申し送り：{assessment.notes || "登録なし"}
      </p>
    </article>
  );
}

type MetricInput = Record<keyof Metrics, string>;
type AiResult = {
  gait_metrics: {
    speed: { before: number; after: number; change: number; unit: string };
    stride: { before: number; after: number; change: number; unit: string };
    positions: { hip: number; knee: number; foot: number };
  };
  improvement_points: string[];
  generated_notes: string;
  comment_candidates: string[];
  confidence_label: string;
  disclaimer: string;
  videoUrl: string;
};

type PoseComparisonResult = {
  summary: string;
  findings: string;
  handoff: string;
};

const poseMaximumDefinitions: Array<{
  key: keyof Omit<PoseMaximumMetrics, "confidence">;
  shortLabel: string;
  comparisonLabel: string;
  unit: string;
  digits: number;
}> = [
  {
    key: "waistAngleDegrees",
    shortLabel: "腰角度 最大",
    comparisonLabel: "腰（体幹傾斜）",
    unit: "°",
    digits: 1,
  },
  {
    key: "kneeAngleDegrees",
    shortLabel: "膝角度 最大",
    comparisonLabel: "膝屈曲角度",
    unit: "°",
    digits: 1,
  },
  {
    key: "heelAngleDegrees",
    shortLabel: "かかと角度 最大",
    comparisonLabel: "かかと―足先角度",
    unit: "°",
    digits: 1,
  },
  {
    key: "accelerationMps2",
    shortLabel: "加速度 最大",
    comparisonLabel: "腰中心加速度",
    unit: "m/s²",
    digits: 2,
  },
  {
    key: "strideLengthM",
    shortLabel: "歩幅 最大",
    comparisonLabel: "推定歩幅",
    unit: "m",
    digits: 2,
  },
];

function metricText(value: number | null, digits: number) {
  return value == null || !Number.isFinite(value) ? "―" : value.toFixed(digits);
}

function buildPoseComparison(
  before: PoseMaximumMetrics,
  after: PoseMaximumMetrics,
  pre: MetricInput,
  post: MetricInput,
): PoseComparisonResult {
  const changes = poseMaximumDefinitions.map((definition) => {
    const beforeValue = before[definition.key];
    const afterValue = after[definition.key];
    if (beforeValue == null || afterValue == null)
      return `${definition.comparisonLabel}は比較に必要な検出値が不足`;
    const difference = afterValue - beforeValue;
    return `${definition.comparisonLabel}は${Math.abs(difference).toFixed(definition.digits)}${definition.unit}${difference > 0 ? "増加" : difference < 0 ? "減少" : "で変化なし"}`;
  });
  const beforeSpeed = Number(pre.gaitSpeed);
  const afterSpeed = Number(post.gaitSpeed);
  const speedSentence =
    Number.isFinite(beforeSpeed) && Number.isFinite(afterSpeed)
      ? `入力評価の歩行速度は${beforeSpeed.toFixed(2)}m/sから${afterSpeed.toFixed(2)}m/sへ${afterSpeed >= beforeSpeed ? "向上" : "変化"}しました`
      : "入力評価の歩行速度は確認が必要です";
  const waistChange =
    before.waistAngleDegrees != null && after.waistAngleDegrees != null
      ? after.waistAngleDegrees - before.waistAngleDegrees
      : null;
  const strideChange =
    before.strideLengthM != null && after.strideLengthM != null
      ? after.strideLengthM - before.strideLengthM
      : null;
  const positivePoints = [
    waistChange != null && waistChange < -0.5
      ? `最大体幹傾斜が${Math.abs(waistChange).toFixed(1)}°小さくなりました`
      : "",
    strideChange != null && strideChange > 0.01
      ? `推定最大歩幅が${strideChange.toFixed(2)}m広がりました`
      : "",
    Number.isFinite(beforeSpeed) && Number.isFinite(afterSpeed) && afterSpeed > beforeSpeed
      ? `歩行速度が${(afterSpeed - beforeSpeed).toFixed(2)}m/s向上しました`
      : "",
  ].filter(Boolean);
  return {
    summary: `HAL使用前後の動画解析では、${changes.join("、")}。${speedSentence}。`,
    findings: positivePoints.length
      ? `${positivePoints.join("。")}。膝・かかと・加速度の最大値は動作の一場面を示すため、原動画と疼痛・疲労の訴えを合わせて療法士が評価してください。`
      : "使用前後で明確な改善方向を断定できる差は検出されませんでした。最大値だけで判断せず、原動画、介助量、疼痛、疲労を合わせて評価してください。",
    handoff:
      "次回も同じ撮影方向・距離・端末位置で撮影し、体幹傾斜、膝の振り出し、かかと接地、歩幅を継続確認してください。推定値は診断や安全判定には使用しません。",
  };
}

function poseComparisonRecordText(comparison: PoseComparisonResult) {
  return `【AI所見】\n${comparison.findings}\n【申し送り】\n${comparison.handoff}\n【AIサマリー】\n${comparison.summary}`;
}

function AssessmentModal({
  appointment,
  onClose,
  onSaved,
}: {
  appointment: TodayAppointment;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const blank: MetricInput = {
    walk10mSeconds: "",
    gaitSpeed: "",
    tugSeconds: "",
    bbs: "",
    chairStand30s: "",
  };
  const [pre, setPre] = useState<MetricInput>(blank);
  const [post, setPost] = useState<MetricInput>(blank);
  const [notes, setNotes] = useState("");
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [prediction, setPrediction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    id: string;
    summary_text: string;
    delta_summary: Metrics;
  } | null>(null);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [uploadedVideoIds, setUploadedVideoIds] = useState<
    Partial<Record<"before" | "after" | "analysis", string>>
  >({});
  const [poseAnalyses, setPoseAnalyses] = useState<{
    before: VideoPoseAnalysis | null;
    after: VideoPoseAnalysis | null;
  }>({ before: null, after: null });
  const [poseAnalyzingPhase, setPoseAnalyzingPhase] = useState<
    "before" | "after" | null
  >(null);
  const [poseProgress, setPoseProgress] = useState(0);
  const beforePoseMetrics = useMemo(
    () =>
      poseAnalyses.before
        ? calculatePoseMaximumMetrics(poseAnalyses.before)
        : null,
    [poseAnalyses.before],
  );
  const afterPoseMetrics = useMemo(
    () =>
      poseAnalyses.after
        ? calculatePoseMaximumMetrics(poseAnalyses.after)
        : null,
    [poseAnalyses.after],
  );
  const poseComparison = useMemo(
    () =>
      beforePoseMetrics && afterPoseMetrics
        ? buildPoseComparison(beforePoseMetrics, afterPoseMetrics, pre, post)
        : null,
    [afterPoseMetrics, beforePoseMetrics, post, pre],
  );

  useEffect(() => {
    let active = true;
    fetch(`/api/assessments?customerId=${appointment.customer_id}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) {
          setPre(
            Object.fromEntries(
              Object.entries(body.pre).map(([key, value]) => [
                key,
                String(value),
              ]),
            ) as MetricInput,
          );
          setPost(
            Object.fromEntries(
              Object.entries(body.post).map(([key, value]) => [
                key,
                String(value),
              ]),
            ) as MetricInput,
          );
          setPrediction(`${body.source} ${body.sampleCount}件から予測`);
        }
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [appointment.customer_id]);

  async function uploadVideo(
    assessmentId: string,
    phase: "before" | "after" | "analysis",
    file: File,
  ) {
    const form = new FormData();
    form.append("assessmentId", assessmentId);
    form.append("phase", phase);
    form.append("file", file);
    const response = await fetch("/api/videos", { method: "POST", body: form });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error ?? "動画を保存できませんでした。");
    return body.video as { id: string };
  }
  async function uploadVideoOnce(
    assessmentId: string,
    phase: "before" | "after" | "analysis",
    file: File,
  ) {
    const existingId = uploadedVideoIds[phase];
    if (existingId) return { id: existingId };
    const uploaded = await uploadVideo(assessmentId, phase, file);
    setUploadedVideoIds((current) => ({ ...current, [phase]: uploaded.id }));
    return uploaded;
  }
  function selectVideo(phase: "before" | "after", file: File | null) {
    if (phase === "before") setBeforeFile(file);
    else setAfterFile(file);
    setPoseAnalyses((current) => ({ ...current, [phase]: null }));
    setUploadedVideoIds((current) => {
      const next = { ...current };
      delete next[phase];
      return next;
    });
    setPoseProgress(0);
  }
  async function analyzeLoadedVideos(
    force: boolean,
    targetPhase?: "before" | "after",
  ) {
    const sources: Array<["before" | "after", File]> = [];
    if (beforeFile && (!targetPhase || targetPhase === "before"))
      sources.push(["before", beforeFile]);
    if (afterFile && (!targetPhase || targetPhase === "after"))
      sources.push(["after", afterFile]);
    if (!sources.length) throw new Error("HAL使用前または使用後の動画を選択してください。");
    const next = { ...poseAnalyses };
    let completed = 0;
    for (const [phase, file] of sources) {
      if (force || !next[phase]) {
        next[phase] = await analyzeVideoFile(file, (percent) => {
          setPoseProgress(
            Math.round(((completed + percent / 100) / sources.length) * 100),
          );
        });
        if (!next[phase]?.tracks.length)
          throw new Error(
            `${phase === "before" ? "HAL使用前" : "HAL使用後"}動画から人物を検出できませんでした。全身が映る動画を選択してください。`,
          );
      }
      completed += 1;
      setPoseProgress(Math.round((completed / sources.length) * 100));
    }
    setPoseAnalyses(next);
    return next;
  }
  async function runPoseAi(phase: "before" | "after") {
    setPoseAnalyzingPhase(phase);
    setError("");
    setPoseProgress(0);
    try {
      await analyzeLoadedVideos(true, phase);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "動画の姿勢推定を完了できませんでした。",
      );
    } finally {
      setPoseAnalyzingPhase(null);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!beforeFile || !afterFile)
        throw new Error(
          "HAL使用前動画とHAL使用後動画の両方を選択してください。",
        );
      let finalNotes = notes.trim();
      const overlays = await analyzeLoadedVideos(false);
      if (!overlays.before || !overlays.after)
        throw new Error("使用前・使用後のAI解析結果を作成できませんでした。");
      const comparisonFile = await createComparisonVideo(
        beforeFile,
        afterFile,
        overlays,
      );
      const poseMaximums = {
        before: calculatePoseMaximumMetrics(overlays.before),
        after: calculatePoseMaximumMetrics(overlays.after),
      };
      const generatedComparison = buildPoseComparison(
        poseMaximums.before,
        poseMaximums.after,
        pre,
        post,
      );
      const generatedText = poseComparisonRecordText(generatedComparison);
      if (!finalNotes.includes("【AI所見】"))
        finalNotes = finalNotes
          ? `${finalNotes}\n${generatedText}`
          : generatedText;
      setNotes(finalNotes);
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          pre,
          post,
          notes: finalNotes,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "評価を保存できませんでした。");
      setResult(body.assessment);
      await uploadVideoOnce(body.assessment.id, "before", beforeFile);
      await uploadVideoOnce(body.assessment.id, "after", afterFile);
      const uploaded = await uploadVideoOnce(
        body.assessment.id,
        "analysis",
        comparisonFile,
      );
      const analysisResponse = await fetch("/api/gait-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: body.assessment.id,
          analysisVideoId: uploaded.id,
          poseMaximums,
        }),
      });
      const analysisBody = await analysisResponse.json();
      if (!analysisResponse.ok)
        throw new Error(
          analysisBody.error ?? "AI解析結果を保存できませんでした。",
        );
      setAi(analysisBody.analysis);
      await onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "HAL前後動画を作成できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveAllAndClose() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          pre,
          post,
          notes,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "評価記録を保存できませんでした。");
      setResult(body.assessment);
      if (beforeFile)
        await uploadVideoOnce(body.assessment.id, "before", beforeFile);
      if (afterFile)
        await uploadVideoOnce(body.assessment.id, "after", afterFile);
      await onSaved();
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "評価記録を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }
  function appendCandidate(candidate: string) {
    setNotes((current) =>
      current.trim() ? `${current.trim()}\n${candidate}` : candidate,
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#09262c]/55 p-3 backdrop-blur-[2px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-title"
        className="mx-auto my-3 w-full max-w-5xl rounded-[28px] bg-white p-5 shadow-2xl md:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black tracking-wider text-[#087f71]">
              EVALUATION RECORD
            </p>
            <h3 id="assessment-title" className="mt-1 text-2xl font-black">
              {appointment.customer_name}さんの評価記録
            </h3>
            <p className="mt-1 text-xs text-[#71858a]">
              {appointment.product_name} ・ {appointment.hal_asset_code}
            </p>
          </div>
          <button
            aria-label="閉じる"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-[#edf4f2]"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#fff8e8] px-4 py-2.5 text-xs">
              <span className="font-black text-[#8b651d]">
                HAL使用前・使用後は過去データから予測入力済み
              </span>
              <span className="text-[#9b8254]">
                {prediction || "予測値を取得中"}
              </span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[1.3fr_1fr_1fr_90px] items-center gap-3 border-b border-[#dce8e5] px-2 py-2 text-xs font-black text-[#71858a]">
                  <span>評価項目</span>
                  <span>HAL使用前（予測）</span>
                  <span>HAL使用後（予測）</span>
                  <span>差の方向</span>
                </div>
                {metricDefs.map((metric) => (
                  <div
                    key={metric.key}
                    className="grid grid-cols-[1.3fr_1fr_1fr_90px] items-center gap-3 border-b border-[#e7eeec] px-2 py-2"
                  >
                    <div>
                      <p className="font-black">{metric.label}</p>
                      <p className="text-[10px] text-[#829397]">
                        単位：{metric.unit}
                      </p>
                    </div>
                    <input
                      required
                      type="number"
                      min="0"
                      step={metric.step}
                      value={pre[metric.key]}
                      onChange={(event) =>
                        setPre({ ...pre, [metric.key]: event.target.value })
                      }
                      aria-label={`${metric.label} HAL使用前`}
                      className="rounded-xl border border-[#d7e4e1] px-3 py-2.5 font-black"
                    />
                    <input
                      required
                      type="number"
                      min="0"
                      step={metric.step}
                      value={post[metric.key]}
                      onChange={(event) =>
                        setPost({ ...post, [metric.key]: event.target.value })
                      }
                      aria-label={`${metric.label} HAL使用後`}
                      className="rounded-xl border border-[#d7e4e1] px-3 py-2.5 font-black"
                    />
                    <span className="text-center text-[10px] font-bold text-[#71858a]">
                      {metric.lowerBetter ? "短縮で改善" : "増加で改善"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <VideoRecorder
                phase="before"
                label="HAL使用前"
                onFile={(file) => selectVideo("before", file)}
                file={beforeFile}
                analysis={poseAnalyses.before}
                maximumMetrics={beforePoseMetrics}
                analysisControl={{
                  onAnalyze: () => runPoseAi("before"),
                  disabled: saving || Boolean(poseAnalyzingPhase) || !beforeFile,
                  label: poseAnalyzingPhase === "before"
                    ? `AI解析中… ${poseProgress}%`
                    : poseAnalyses.before
                      ? "AI解析を再実行"
                      : beforeFile
                        ? "AI解析（歩行姿勢を推定）"
                        : "動画を読み込むとAI解析できます",
                }}
              />
              <VideoRecorder
                phase="after"
                label="HAL使用後"
                onFile={(file) => selectVideo("after", file)}
                file={afterFile}
                analysis={poseAnalyses.after}
                maximumMetrics={afterPoseMetrics}
                analysisControl={{
                  onAnalyze: () => runPoseAi("after"),
                  disabled: saving || Boolean(poseAnalyzingPhase) || !afterFile,
                  label: poseAnalyzingPhase === "after"
                    ? `AI解析中… ${poseProgress}%`
                    : poseAnalyses.after
                      ? "AI解析を再実行"
                      : afterFile
                        ? "AI解析（歩行姿勢を推定）"
                        : "動画を読み込むとAI解析できます",
                }}
              />
            </div>
            <button
              disabled={
                saving ||
                Boolean(poseAnalyzingPhase) ||
                Boolean(ai) ||
                !beforeFile ||
                !afterFile
              }
              className="mt-4 w-full rounded-2xl bg-[#087f71] py-4 font-black text-white disabled:bg-[#aac6c1]"
            >
              {saving
                ? "HAL前後動画を作成・MP4保存しています…"
                : ai
                  ? "HAL前後動画を作成しました"
                  : "HAL前後動画作成"}
            </button>
            {result && ai && (
              <section
                aria-live="polite"
                data-testid="hal-comparison-video-result"
                className="mt-4 rounded-[22px] border border-[#b9ddd5] bg-[#f4fbf9] p-4"
              >
                <div className="rounded-[18px] bg-[#e7f5f1] p-4 text-[#087f71]">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={28} />
                    <div>
                      <h4 className="font-black">
                        HAL使用前後のマージ動画を作成・保存しました
                      </h4>
                      <p className="mt-1 text-xs font-bold">
                        {result.summary_text}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot size={20} className="text-[#5d49b6]" />
                    <h4 className="font-black">作成したHAL前後比較動画</h4>
                  </div>
                  <span className="rounded-full bg-[#eeeafd] px-2.5 py-1 text-[10px] font-black text-[#5d49b6]">
                    {ai.confidence_label}
                  </span>
                </div>
                <video
                  data-testid="hal-comparison-video-player"
                  src={ai.videoUrl}
                  controls
                  playsInline
                  className="mt-3 aspect-[8/3] w-full rounded-xl bg-black object-contain"
                />
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                  {ai.improvement_points.map((point) => (
                    <div
                      key={point}
                      className="rounded-xl bg-white p-2 text-center text-[11px] font-bold text-[#4f4770]"
                    >
                      {point}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-5 text-[#776f91]">
                  {ai.disclaimer}
                </p>
              </section>
            )}
            {(!beforeFile || !afterFile) && (
              <p className="mt-2 text-center text-[10px] font-bold text-[#71858a]">
                HAL使用前動画とHAL使用後動画を選択すると作成できます
              </p>
            )}
            {poseComparison && beforePoseMetrics && afterPoseMetrics && (
              <section className="mt-4 rounded-[22px] border border-[#dcd6f2] bg-[#faf9ff] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black tracking-[.14em] text-[#776f91]">
                      BEFORE / AFTER
                    </p>
                    <h4 className="text-lg font-black text-[#5d49b6]">AI比較</h4>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#5d49b6]">
                    両動画の解析完了
                  </span>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <div className="min-w-[680px]">
                    <div className="grid grid-cols-[1.35fr_1fr_1fr_1fr] gap-2 border-b border-[#ded8f1] px-2 py-2 text-[10px] font-black text-[#776f91]">
                      <span>解析指標（最大値）</span>
                      <span>HAL使用前</span>
                      <span>HAL使用後</span>
                      <span>変化</span>
                    </div>
                    {poseMaximumDefinitions.map((definition) => {
                      const beforeValue = beforePoseMetrics[definition.key];
                      const afterValue = afterPoseMetrics[definition.key];
                      const difference =
                        beforeValue != null && afterValue != null
                          ? afterValue - beforeValue
                          : null;
                      const favorable =
                        difference != null &&
                        ((definition.key === "waistAngleDegrees" && difference < 0) ||
                          (definition.key === "strideLengthM" && difference > 0));
                      return (
                        <div
                          key={definition.key}
                          className="grid grid-cols-[1.35fr_1fr_1fr_1fr] gap-2 border-b border-[#ebe8f7] px-2 py-2 text-xs"
                        >
                          <b>{definition.comparisonLabel}</b>
                          <span>{metricText(beforeValue, definition.digits)}{definition.unit}</span>
                          <span>{metricText(afterValue, definition.digits)}{definition.unit}</span>
                          <span className={favorable ? "font-black text-[#087f71]" : "font-bold text-[#5f6170]"}>
                            {difference == null
                              ? "―"
                              : `${difference > 0 ? "+" : ""}${difference.toFixed(definition.digits)}${definition.unit}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black text-[#5d49b6]">サマリー</p>
                    <p className="mt-1 text-xs leading-5">{poseComparison.summary}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black text-[#5d49b6]">所見</p>
                    <p className="mt-1 text-xs leading-5">{poseComparison.findings}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black text-[#5d49b6]">申し送り</p>
                    <p className="mt-1 text-xs leading-5">{poseComparison.handoff}</p>
                  </div>
                </div>
                <p className="mt-2 text-[9px] leading-4 text-[#776f91]">
                  単眼動画からの推定最大値です。撮影距離や角度の影響を受けるため、診断・安全判定には使用せず療法士が原動画と実測値を確認してください。
                </p>
              </section>
            )}
            <label className="mt-4 block text-xs font-bold text-[#687d84]">
              所見・申し送り
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="歩容、介助量、疲労、疼痛、皮膚状態など"
                className="mt-2 h-20 w-full resize-none rounded-xl border border-[#d7e4e1] p-3 text-sm"
              />
            </label>
            {ai && (
              <div className="mt-3">
                <RotatingTextSuggestions
                  title="療法士が追加しそうなコメント候補"
                  suggestions={ai.comment_candidates}
                  onSelect={appendCandidate}
                />
              </div>
            )}
            {error && (
              <p className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]">
                {error}
              </p>
            )}
            <div className="sticky bottom-0 z-20 -mx-5 mt-5 border-t border-[#dce8e5] bg-white/95 px-5 py-4 backdrop-blur md:-mx-7 md:px-7">
              <button
                type="button"
                onClick={saveAllAndClose}
                disabled={saving}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#087f71] py-3.5 font-black text-white disabled:bg-[#aac6c1]"
              >
                <Save size={17} />
                {saving ? "すべて保存しています…" : "保存して閉じる"}
              </button>
            </div>
          </form>
      </section>
    </div>
  );
}

const overlayJointIndexes = [
  ...new Set(POSE_CONNECTIONS.flatMap(([start, end]) => [start, end])),
];

function nearestPoseFrame(
  analysis: VideoPoseAnalysis,
  timeSeconds: number,
): PoseFrame | null {
  if (!analysis.frames.length) return null;
  let low = 0;
  let high = analysis.frames.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (analysis.frames[middle].timeSeconds < timeSeconds) low = middle + 1;
    else high = middle;
  }
  const current = analysis.frames[low];
  const previous = analysis.frames[Math.max(0, low - 1)];
  return Math.abs(previous.timeSeconds - timeSeconds) <=
    Math.abs(current.timeSeconds - timeSeconds)
    ? previous
    : current;
}

function drawPoseFrame(
  context: CanvasRenderingContext2D,
  frame: PoseFrame | null,
  primaryTrackId: string,
  rect: { left: number; top: number; width: number; height: number },
) {
  if (!frame) return;
  frame.poses.forEach((pose) => {
    const primary = pose.trackId === primaryTrackId;
    const color = primary ? "#25e0a4" : "#ffad55";
    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = Math.max(2.5, rect.width / 210);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = "rgba(4,26,31,.75)";
    context.shadowBlur = Math.max(2, rect.width / 280);
    POSE_CONNECTIONS.forEach(([start, end]) => {
      const a = pose.landmarks[start];
      const b = pose.landmarks[end];
      if (!a || !b || a.visibility < 0.25 || b.visibility < 0.25) return;
      context.beginPath();
      context.moveTo(rect.left + a.x * rect.width, rect.top + a.y * rect.height);
      context.lineTo(rect.left + b.x * rect.width, rect.top + b.y * rect.height);
      context.stroke();
    });
    overlayJointIndexes.forEach((index) => {
      const point = pose.landmarks[index];
      if (!point || point.visibility < 0.25) return;
      context.beginPath();
      context.arc(
        rect.left + point.x * rect.width,
        rect.top + point.y * rect.height,
        Math.max(3, rect.width / 165),
        0,
        Math.PI * 2,
      );
      context.fill();
    });
    const label = primary ? "利用者候補" : "別人物候補";
    const labelX = rect.left + pose.bounds.left * rect.width;
    const labelY = Math.max(rect.top + 22, rect.top + pose.bounds.top * rect.height - 8);
    context.shadowBlur = 0;
    context.font = `bold ${Math.max(11, rect.width / 38)}px sans-serif`;
    const labelWidth = context.measureText(label).width + 16;
    context.fillStyle = "rgba(8,35,43,.86)";
    context.fillRect(labelX, labelY - 19, labelWidth, 23);
    context.fillStyle = color;
    context.fillText(label, labelX + 8, labelY - 2);
    context.restore();
  });
}

function PoseOverlayVideo({
  label,
  file,
  analysis,
}: {
  label: string;
  file: File;
  analysis: VideoPoseAnalysis;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.load();
    return () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let animationFrame = 0;
    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const cssWidth = Math.max(1, bounds.width);
      const cssHeight = Math.max(1, bounds.height);
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      const targetWidth = Math.round(cssWidth * pixelRatio);
      const targetHeight = Math.round(cssHeight * pixelRatio);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);
      const sourceWidth = video.videoWidth || analysis.width || 16;
      const sourceHeight = video.videoHeight || analysis.height || 9;
      const scale = Math.min(cssWidth / sourceWidth, cssHeight / sourceHeight);
      const width = sourceWidth * scale;
      const height = sourceHeight * scale;
      const rect = {
        left: (cssWidth - width) / 2,
        top: (cssHeight - height) / 2,
        width,
        height,
      };
      drawPoseFrame(
        context,
        nearestPoseFrame(analysis, video.currentTime),
        analysis.tracks[0]?.trackId ?? "",
        rect,
      );
    };
    const tick = () => {
      draw();
      if (!video.paused && !video.ended)
        animationFrame = window.requestAnimationFrame(tick);
    };
    const start = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(tick);
    };
    const stopAndDraw = () => {
      window.cancelAnimationFrame(animationFrame);
      draw();
    };
    video.addEventListener("play", start);
    video.addEventListener("loadeddata", stopAndDraw);
    video.addEventListener("seeked", stopAndDraw);
    video.addEventListener("pause", stopAndDraw);
    window.addEventListener("resize", stopAndDraw);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      video.removeEventListener("play", start);
      video.removeEventListener("loadeddata", stopAndDraw);
      video.removeEventListener("seeked", stopAndDraw);
      video.removeEventListener("pause", stopAndDraw);
      window.removeEventListener("resize", stopAndDraw);
    };
  }, [analysis, file]);
  const primary = analysis.tracks[0];
  return (
    <article className="rounded-2xl bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black">{label}</p>
        <p className="text-[9px] font-bold text-[#71858a]">
          検出 {analysis.tracks.length}人・信頼度{" "}
          {Math.round((primary?.averageConfidence ?? 0) * 100)}%
        </p>
      </div>
      <div className="relative mt-2 aspect-video overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          controls
          playsInline
          className="size-full object-contain"
        />
        <canvas
          ref={canvasRef}
          aria-label={`${label}の姿勢推定オーバーレイ`}
          className="pointer-events-none absolute inset-0 size-full"
        />
        <span className="pointer-events-none absolute left-2 top-2 rounded-lg bg-[#08232b]/80 px-2 py-1 text-[9px] font-black text-white">
          姿勢推定オーバーレイ
        </span>
      </div>
    </article>
  );
}

function VideoRecorder({
  phase,
  label,
  onFile,
  file,
  analysis,
  maximumMetrics,
  analysisControl,
}: {
  phase: "before" | "after";
  label: string;
  onFile: (file: File | null) => void;
  file: File | null;
  analysis: VideoPoseAnalysis | null;
  maximumMetrics: PoseMaximumMetrics | null;
  analysisControl?: {
    onAnalyze: () => void;
    disabled: boolean;
    label: string;
  };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const previewRef = useRef<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cameraReady || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      setError("カメラ映像を再生できません。端末設定を確認してください。");
    });
  }, [cameraReady, preview]);
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
      setPreview("");
      onFile(null);
      setCameraReady(true);
    } catch {
      setError(
        "カメラを開始できません。権限または端末設定を確認してください。",
      );
    }
  }
  async function startRecording() {
    let stream = streamRef.current;
    if (!stream) {
      await startCamera();
      stream = streamRef.current;
    }
    if (!stream) return;
    const chunks: BlobPart[] = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "";
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || "video/webm";
      const blob = new Blob(chunks, { type });
      const file = new File([blob], `${phase}-${Date.now()}.webm`, { type });
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      const url = URL.createObjectURL(blob);
      previewRef.current = url;
      setPreview(url);
      onFile(file);
      setRecording(false);
    };
    recorder.start(500);
    setRecording(true);
  }
  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }
  function chooseFile(file: File | null) {
    if (!file) return;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreview(url);
    onFile(file);
  }
  return (
    <div className="rounded-[20px] border border-[#dce8e5] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileVideo size={18} className="text-[#087f71]" />
          <h4 className="font-black">{label}動画</h4>
        </div>
        {preview && (
          <span className="rounded-full bg-[#e7f5f1] px-2 py-1 text-[10px] font-black text-[#087f71]">
            保存待ち
          </span>
        )}
      </div>
      <div className="relative mt-2 overflow-hidden rounded-xl bg-[#102a30]">
        {preview ? (
          <video
            src={preview}
            controls
            playsInline
            className="aspect-video w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className={`aspect-video w-full object-cover ${cameraReady ? "block" : "hidden"}`}
          />
        )}
        {!preview && !cameraReady && (
          <div className="grid aspect-video place-items-center text-center text-xs text-white/55">
            <div>
              <Camera className="mx-auto mb-2" />
              <p>撮影開始時にカメラ権限を確認します</p>
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs font-bold text-[#bd4f3f]">{error}</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {!cameraReady && (
          <button
            type="button"
            onClick={startCamera}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#173b42] py-2.5 text-xs font-black text-white"
          >
            <Camera size={15} />
            カメラを開始
          </button>
        )}
        {cameraReady && !recording && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#dc6b58] py-2.5 text-xs font-black text-white"
          >
            <Play size={14} fill="currentColor" />
            撮影
          </button>
        )}
        {recording && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#dc6b58] py-2.5 text-xs font-black text-white"
          >
            <Square size={13} fill="currentColor" />
            停止
          </button>
        )}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#d7e4e1] py-2.5 text-xs font-black">
          <ListFilter size={14} />
          動画を選択
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
            capture="environment"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      </div>
      {analysisControl && (
        <button
          type="button"
          onClick={analysisControl.onAnalyze}
          disabled={analysisControl.disabled}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5d49b6] px-3 text-xs font-black text-white disabled:bg-[#c7c2dc]"
        >
          <Sparkles size={16} />
          {analysisControl.label}
        </button>
      )}
      {file && analysis && maximumMetrics && (
        <section className="mt-3 rounded-2xl border border-[#dcd6f2] bg-[#faf9ff] p-2.5">
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <p className="text-xs font-black text-[#5d49b6]">AI解析結果</p>
            <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-[#776f91]">
              端末内解析
            </span>
          </div>
          <PoseOverlayVideo
            key={`${phase}-${file.name}-${file.size}-${file.lastModified}`}
            label={`${label}オーバーレイ`}
            file={file}
            analysis={analysis}
          />
          <div className="mt-2 grid grid-cols-5 gap-1">
            {poseMaximumDefinitions.map((definition) => (
              <div
                key={definition.key}
                className="rounded-lg bg-white px-1 py-2 text-center"
              >
                <p className="min-h-7 text-[8px] font-bold leading-3 text-[#71858a]">
                  {definition.shortLabel}
                </p>
                <p className="mt-1 whitespace-nowrap text-xs font-black text-[#173b42]">
                  {metricText(
                    maximumMetrics[definition.key],
                    definition.digits,
                  )}
                  <span className="ml-0.5 text-[7px] text-[#71858a]">
                    {definition.unit}
                  </span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[8px] leading-3.5 text-[#776f91]">
            緑は利用者候補、橙は別人物候補です。角度・加速度・歩幅は単眼動画からの推定最大値であり、療法士が原動画を確認してください。
          </p>
        </section>
      )}
    </div>
  );
}

async function createComparisonVideo(
  beforeFile: File,
  afterFile: File,
  analyses: {
    before: VideoPoseAnalysis | null;
    after: VideoPoseAnalysis | null;
  },
) {
  const urls = [
    URL.createObjectURL(beforeFile),
    URL.createObjectURL(afterFile),
  ];
  try {
    const videos = urls.map((src) => {
      const video = document.createElement("video");
      video.src = src;
      video.muted = true;
      video.playsInline = true;
      return video;
    });
    await Promise.all(
      videos.map(
        (video) =>
          new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () =>
              reject(new Error("比較動画を読み込めませんでした。"));
            video.load();
          }),
      ),
    );
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    if (
      !context ||
      !canvas.captureStream ||
      typeof MediaRecorder === "undefined"
    )
      throw new Error("この端末は比較動画の作成に対応していません。");
    const stream = canvas.captureStream(20);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const duration = Math.max(
      1,
      Math.min(
        ...videos.map((video) =>
          Number.isFinite(video.duration) ? video.duration : 1,
        ),
      ),
    );
    videos.forEach((video) => {
      video.currentTime = 0;
      void video.play();
    });
    recorder.start(500);
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const draw = (now: number) => {
        context.fillStyle = "#102a30";
        context.fillRect(0, 0, 1280, 480);
        videos.forEach((video, index) => {
          context.drawImage(video, index * 640, 0, 640, 480);
          context.fillStyle = "rgba(8,38,44,.78)";
          context.fillRect(index * 640 + 18, 16, 148, 36);
          context.fillStyle = "white";
          context.font = "bold 20px sans-serif";
          context.fillText(
            index === 0 ? "HAL 使用前" : "HAL 使用後",
            index * 640 + 32,
            41,
          );
        });
        videos.forEach((video, index) => {
          const analysis = index === 0 ? analyses.before : analyses.after;
          if (!analysis) return;
          drawPoseFrame(
            context,
            nearestPoseFrame(analysis, video.currentTime),
            analysis.tracks[0]?.trackId ?? "",
            { left: index * 640, top: 0, width: 640, height: 480 },
          );
        });
        if ((now - started) / 1000 >= duration) {
          resolve();
          return;
        }
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    });
    videos.forEach((video) => video.pause());
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType });
    return new File([blob], `gait-comparison-${Date.now()}.webm`, {
      type: recorder.mimeType,
    });
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f3f7f6] p-3">
      <p className="text-[10px] font-bold text-[#829397]">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}
