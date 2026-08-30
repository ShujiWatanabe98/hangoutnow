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
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    id: string;
    summary_text: string;
    delta_summary: Metrics;
  } | null>(null);
  const [videosSaved, setVideosSaved] = useState(false);
  const [ai, setAi] = useState<AiResult | null>(null);

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
  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
        throw new Error(body.error ?? "評価を保存できませんでした。");
      if (beforeFile)
        await uploadVideo(body.assessment.id, "before", beforeFile);
      if (afterFile) await uploadVideo(body.assessment.id, "after", afterFile);
      setVideosSaved(Boolean(beforeFile && afterFile));
      setResult(body.assessment);
      await onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "評価を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }
  async function runAi() {
    if (!result || !beforeFile || !afterFile) return;
    setAnalyzing(true);
    setError("");
    try {
      const comparison = await createComparisonVideo(beforeFile, afterFile);
      const uploaded = await uploadVideo(result.id, "analysis", comparison);
      const response = await fetch("/api/gait-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: result.id,
          analysisVideoId: uploaded.id,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "AI解析を完了できませんでした。");
      setAi(body.analysis);
      setNotes(body.analysis.generated_notes);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "AI解析を完了できませんでした。",
      );
    } finally {
      setAnalyzing(false);
    }
  }
  async function saveNotes() {
    if (!result) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/assessments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId: result.id, notes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "所見を保存できませんでした。",
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
        {result ? (
          <div className="mt-5">
            <div className="rounded-[20px] bg-[#e7f5f1] p-4 text-[#087f71]">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={28} />
                <div>
                  <h4 className="font-black">評価と動画を保存しました</h4>
                  <p className="mt-1 text-xs font-bold">
                    {result.summary_text}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={runAi}
              disabled={!videosSaved || analyzing || Boolean(ai)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5d49b6] py-4 font-black text-white disabled:bg-[#c7c2dc]"
            >
              <Sparkles size={19} />
              {analyzing
                ? "比較動画を作成してAI解析中…"
                : ai
                  ? "AI解析完了"
                  : videosSaved
                    ? "AI解析を実行"
                    : "使用前・使用後の動画保存後にAI解析できます"}
            </button>
            {ai && (
              <div className="mt-4 rounded-[22px] border border-[#dcd6f2] bg-[#faf9ff] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot size={20} className="text-[#5d49b6]" />
                    <h4 className="font-black">歩行AI比較</h4>
                  </div>
                  <span className="rounded-full bg-[#eeeafd] px-2.5 py-1 text-[10px] font-black text-[#5d49b6]">
                    {ai.confidence_label}
                  </span>
                </div>
                <video
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
              </div>
            )}
            <label className="mt-4 block text-xs font-bold text-[#687d84]">
              所見・申し送り
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-2 h-28 w-full resize-none rounded-xl border border-[#d7e4e1] p-3 text-sm"
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
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={saveNotes}
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#087f71] py-3.5 font-black text-white disabled:bg-[#aac6c1]"
              >
                <Save size={17} />
                所見を保存
              </button>
              <button
                onClick={onClose}
                className="rounded-2xl bg-[#173b42] py-3.5 font-black text-white"
              >
                閉じる
              </button>
            </div>
          </div>
        ) : (
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
                onFile={setBeforeFile}
              />
              <VideoRecorder
                phase="after"
                label="HAL使用後"
                onFile={setAfterFile}
              />
            </div>
            <button
              type="button"
              disabled
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c7c2dc] py-3.5 font-black text-white"
            >
              <Sparkles size={18} />
              AI解析（使用前・使用後の動画保存後に有効）
            </button>
            <label className="mt-4 block text-xs font-bold text-[#687d84]">
              所見・申し送り
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="歩容、介助量、疲労、疼痛、皮膚状態など"
                className="mt-2 h-20 w-full resize-none rounded-xl border border-[#d7e4e1] p-3 text-sm"
              />
            </label>
            {error && (
              <p className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]">
                {error}
              </p>
            )}
            <button
              disabled={saving}
              className="mt-4 w-full rounded-2xl bg-[#087f71] py-4 font-black text-white disabled:bg-[#aac6c1]"
            >
              {saving
                ? "評価と動画を保存しています…"
                : "評価を保存してサマリーを作成"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function GaitGuide() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 text-[10px] font-black text-white"
    >
      <div className="absolute left-1/2 top-[12%] h-[80%] border-l border-dashed border-white/55" />
      <div className="absolute inset-x-[12%] top-[38%] border-t-2 border-[#55e6b6]">
        <span className="absolute -top-4 left-0 rounded bg-[#087f71]/90 px-1.5 py-0.5">
          腰
        </span>
      </div>
      <div className="absolute inset-x-[12%] top-[63%] border-t-2 border-[#ffd45d]">
        <span className="absolute -top-4 left-0 rounded bg-[#9b7213]/90 px-1.5 py-0.5">
          膝
        </span>
      </div>
      <div className="absolute bottom-[5%] left-[18%] h-[12%] w-[22%] rounded-[50%] border-2 border-[#70cfff]">
        <span className="absolute -top-4 left-0 rounded bg-[#276b8a]/90 px-1.5 py-0.5">
          左足
        </span>
      </div>
      <div className="absolute bottom-[5%] right-[18%] h-[12%] w-[22%] rounded-[50%] border-2 border-[#70cfff]">
        <span className="absolute -top-4 right-0 rounded bg-[#276b8a]/90 px-1.5 py-0.5">
          右足
        </span>
      </div>
    </div>
  );
}

function VideoRecorder({
  phase,
  label,
  onFile,
}: {
  phase: "before" | "after";
  label: string;
  onFile: (file: File | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const previewRef = useRef<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
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
      <p className="mt-2 text-[10px] font-bold text-[#71858a]">
        全身を枠内に入れ、腰・両膝・両足を補助マークに合わせてください。
      </p>
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
        <GaitGuide />
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
        {!cameraReady && !preview && (
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
    </div>
  );
}

async function createComparisonVideo(beforeFile: File, afterFile: File) {
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
    const duration = Math.min(
      12,
      Math.max(
        1,
        Math.min(
          ...videos.map((video) =>
            Number.isFinite(video.duration) ? video.duration : 12,
          ),
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
        context.strokeStyle = "#55e6b6";
        context.lineWidth = 3;
        [0, 640].forEach((left) => {
          context.beginPath();
          context.moveTo(left + 75, 182);
          context.lineTo(left + 565, 182);
          context.stroke();
          context.strokeStyle = "#ffd45d";
          context.beginPath();
          context.moveTo(left + 75, 302);
          context.lineTo(left + 565, 302);
          context.stroke();
          context.strokeStyle = "#55e6b6";
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
