"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BatteryCharging,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  MessageCircle,
  Menu,
  PackageSearch,
  Search,
  ShieldAlert,
  Stethoscope,
  Footprints,
  ClipboardList,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { EquipmentManager } from "./equipment-manager";
import { LoadingScreen } from "./loading";
import { ScheduleCalendar } from "./schedule-calendar";
import { CustomersManager } from "./customers-manager";
import { BillingManager } from "./billing-manager";
import { ClinicalManager } from "./clinical-manager";
import { StaffManager } from "./staff-manager";
import { IntakeManager } from "./intake-manager";
import { FacilityMessageCenter } from "./message-center";
import { PhysicalFunctionManager } from "./physical-function-manager";
import { resolveStoreFeatureAccess, type StoreFeatureAccess, type StoreFeatureFlags, type StoreFeatureKey } from "@/lib/store-features";

type Appointment = {
  id: string;
  customer_id: string;
  start_at: string;
  end_at: string;
  status: string;
  note: string;
  customer_name: string;
  primary_condition: string;
  product_name: string;
  therapist_name: string;
  hal_asset_code: string;
  model_type: string;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  safety_decision: "allow" | "review" | "stop" | null;
};

type Device = {
  id: string;
  asset_code: string;
  serial_number: string;
  product_class: string;
  model_type: string;
  model_number: string;
  size_label: string | null;
  body_part: "upper_limb" | "lower_limb" | "lumbar" | null;
  image_url: string | null;
  image_source_url: string | null;
  laterality: string;
  status: string;
  usage_count: number;
  last_inspected_at: string;
};

type Dashboard = {
  features?: StoreFeatureAccess;
  facility: {
    store: { name: string; address: string; phone: string };
    appointments: Appointment[];
    devices: Device[];
    equipmentModels: Array<{
      id: string;
      category: "hal" | "treadmill" | "bench";
      equipment_name: string;
      model_number: string;
      quantity: number;
      hal_capacity_per_unit: number;
      note: string | null;
      updated_at: string;
    }>;
    staff: Array<{
      id: string;
      name: string;
      role: string;
      qualification: string | null;
    }>;
    products: Array<{
      id: string;
      name: string;
      duration_minutes: number;
      price_yen: number;
      required_model_type: string;
    }>;
    safetyRule: { name: string; source_note: string };
    summary: {
      total: number;
      waiting: number;
      checkedIn: number;
      stopAlerts: number;
    };
  };
};

type Tab =
  | "today"
  | "schedule"
  | "customers"
  | "messages"
  | "devices"
  | "clinical"
  | "physical"
  | "billing"
  | "staff"
  | "intake";

const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard; feature?: StoreFeatureKey }> = [
  { id: "today", label: "ホーム", icon: LayoutDashboard },
  { id: "schedule", label: "予約", icon: CalendarDays, feature: "appointments" },
  { id: "customers", label: "利用者", icon: UsersRound, feature: "customers" },
  { id: "messages", label: "メッセージ", icon: MessageCircle, feature: "messages" },
  { id: "intake", label: "問診", icon: ClipboardList, feature: "intake" },
  { id: "devices", label: "機材管理", icon: PackageSearch, feature: "equipment" },
  { id: "physical", label: "身体機能", icon: Footprints, feature: "physical" },
  { id: "clinical", label: "施術記録", icon: Stethoscope, feature: "clinical" },
  { id: "billing", label: "会計", icon: CircleDollarSign, feature: "billing" },
  { id: "staff", label: "スタッフ", icon: UserCog, feature: "staff" },
];

const statusLabel: Record<string, string> = {
  reserved: "予約済み",
  confirmed: "来所待ち",
  checked_in: "受付済み",
  in_session: "実施中",
  completed: "完了",
  cancelled: "キャンセル",
};

const timeText = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));

export function FacilityApp() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messageUnread, setMessageUnread] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "読み込みに失敗しました。");
    setData(body);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "読み込みに失敗しました。");
        if (active) setData(body);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const messagesEnabled = data?.features?.effective.messages ?? false;
    if (!messagesEnabled) return;
    let active = true;
    const loadUnread = async () => {
      const response = await fetch("/api/messages?role=facility", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json();
      const count = (body.conversations ?? []).reduce((sum: number, item: { unread_count?: number }) => sum + Number(item.unread_count ?? 0), 0);
      if (active) setMessageUnread(count);
    };
    void loadUnread();
    const timer = window.setInterval(() => { void loadUnread(); }, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [data?.features?.effective.messages]);

  if (!data && !error)
    return <LoadingScreen label="施設ダッシュボードを準備しています" />;
  if (!data) return <ErrorPanel message={error} />;

  const facility = data.facility;
  const featureAccess = data.features ?? resolveStoreFeatureAccess(undefined);
  const availableTabs = tabs.filter((item) => !item.feature || featureAccess.effective[item.feature]);
  const effectiveTab = availableTabs.some((item) => item.id === tab) ? tab : "today";
  const activeTab = tabs.find((item) => item.id === effectiveTab)!;
  const displayedMessageUnread = featureAccess.effective.messages ? messageUnread : 0;

  function switchTab(next: Tab) {
    setTab(next);
    setDrawerOpen(false);
    if (next === "today" || next === "customers") {
      void load().catch((reason: Error) => setError(reason.message));
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f8f7] md:grid md:grid-cols-[80px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[80px] flex-col items-center border-r border-[#dce8e5] bg-white py-3 md:flex">
        <Link href="/" aria-label="入口へ戻る">
          <Brand compact />
        </Link>
        <nav className="mt-3 flex w-full flex-1 flex-col items-center gap-0.5 px-1.5">
          {availableTabs.map((item) => {
            const Icon = item.icon;
            const active = item.id === effectiveTab;
            return (
              <button
                key={item.id}
                onClick={() => switchTab(item.id)}
                className={`relative flex w-full flex-col items-center gap-1 rounded-xl py-2 text-[9px] font-bold transition ${active ? "bg-[#e7f5f1] text-[#087f71]" : "text-[#829397] hover:bg-[#f1f5f4]"}`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                {item.label}
                {item.id === "messages" && displayedMessageUnread > 0 && <span aria-label={`メッセージ未読 ${displayedMessageUnread}件`} className="absolute right-1 top-0.5 grid min-w-5 place-items-center rounded-full bg-[#dc5d51] px-1 py-0.5 text-[9px] font-black leading-none text-white">{displayedMessageUnread > 99 ? "99+" : displayedMessageUnread}</span>}
              </button>
            );
          })}
        </nav>
        <div className="grid size-10 place-items-center rounded-full bg-[#173b42] text-xs font-black text-white">
          高橋
        </div>
      </aside>

      <div className="md:col-start-2">
        <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-[#dce8e5] bg-white/90 px-3 backdrop-blur md:px-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="grid size-10 place-items-center rounded-xl bg-[#edf4f2] md:hidden"
              aria-label="メニュー"
            >
              <Menu size={21} />
            </button>
            <div>
              <p className="text-[11px] font-bold text-[#7c9094]">
                {facility.store.name}
              </p>
              <h1 className="text-lg font-black tracking-[-0.03em]">
                {activeTab.label}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {featureAccess.effective.staff && <button
              onClick={() => switchTab("staff")}
              className="hidden items-center gap-1 rounded-xl bg-[#edf5f3] px-3 py-2 text-xs font-black text-[#087f71] sm:flex"
            >
              <UserCog size={15} />
              スタッフ管理
            </button>}
            <div className="hidden items-center gap-2 rounded-xl bg-[#fff7df] px-3 py-2 text-xs font-bold text-[#9b690f] sm:flex">
              <AlertTriangle size={15} /> デモ環境
            </div>
            <button className="grid size-10 place-items-center rounded-xl border border-[#dce8e5] bg-white">
              <Search size={19} />
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-black">高橋 花</p>
              <p className="text-[10px] text-[#87999d]">受付スタッフ</p>
            </div>
          </div>
        </header>

        <main className="p-3 md:p-4">
          {effectiveTab === "today" && (
            <TodayView facility={facility} features={featureAccess.effective} onCheckin={setSelected} />
          )}
          {effectiveTab === "schedule" && <ScheduleCalendar />}
          {effectiveTab === "customers" && (
            <CustomersManager todayAppointments={facility.appointments} />
          )}
          {effectiveTab === "messages" && <FacilityMessageCenter onUnreadChange={setMessageUnread} />}
          {effectiveTab === "intake" && <IntakeManager />}
          {effectiveTab === "devices" && (
            <EquipmentManager
              models={facility.equipmentModels}
              devices={facility.devices}
              onChanged={load}
            />
          )}
          {effectiveTab === "physical" && (
            <PhysicalFunctionManager appointments={facility.appointments} />
          )}
          {effectiveTab === "clinical" && <ClinicalManager />}
          {effectiveTab === "billing" && <BillingManager />}
          {effectiveTab === "staff" && <StaffManager onDataChanged={load} />}
        </main>
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0b262c]/40 md:hidden"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setDrawerOpen(false)
          }
        >
          <div className="h-full w-[280px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setDrawerOpen(false)}
                className="grid size-10 place-items-center rounded-xl bg-[#edf4f2]"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="mt-8 space-y-2">
              {availableTabs.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => switchTab(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold ${item.id === effectiveTab ? "bg-[#e7f5f1] text-[#087f71]" : "text-[#687d84]"}`}
                  >
                    <Icon size={20} />
                    {item.label}
                    {item.id === "messages" && displayedMessageUnread > 0 && <span className="ml-auto rounded-full bg-[#dc5d51] px-2 py-1 text-[10px] font-black text-white">未読 {displayedMessageUnread}件</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {selected && (
        <CheckinModal
          appointment={selected}
          rule={facility.safetyRule}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            await load();
          }}
        />
      )}
    </div>
  );
}

function TodayView({
  facility,
  features,
  onCheckin,
}: {
  facility: Dashboard["facility"];
  features: StoreFeatureFlags;
  onCheckin: (value: Appointment) => void;
}) {
  const cards = [
    ...(features.appointments ? [{
      label: "本日の予約",
      value: facility.summary.total,
      suffix: "件",
      icon: CalendarDays,
      tone: "bg-[#e7f5f1] text-[#087f71]",
    }, {
      label: "来所待ち",
      value: facility.summary.waiting,
      suffix: "名",
      icon: Clock3,
      tone: "bg-[#eaf3f8] text-[#2d7490]",
    }, {
      label: "受付済み",
      value: facility.summary.checkedIn,
      suffix: "名",
      icon: ClipboardCheck,
      tone: "bg-[#eef1fb] text-[#5769a7]",
    }] : []),
    ...(features.clinical ? [{
      label: "ストップ",
      value: facility.summary.stopAlerts,
      suffix: "件",
      icon: ShieldAlert,
      tone: "bg-[#fff0ed] text-[#cf5b4a]",
    }] : []),
  ];
  const attentionDevices = facility.devices.filter(
    (item) => item.status === "inspection",
  );
  const operatingAppointments = facility.appointments.filter(
    (item) => item.status !== "completed",
  );
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-[#087f71]">TODAY</p>
          <h2 className="text-2xl font-black tracking-[-0.04em]">
            おはようございます、高橋さん
          </h2>
          <p className="mt-1 text-xs text-[#71858a]">
            本日の安全な運営に必要な情報をまとめています。
          </p>
        </div>
        <div className="rounded-xl border border-[#dce8e5] bg-white px-3 py-2 text-xs font-bold">
          {new Intl.DateTimeFormat("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          }).format(new Date())}
        </div>
      </div>
      {cards.length > 0 && <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {cards.map(({ label, value, suffix, icon: Icon, tone }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-2xl border border-[#dce8e5] bg-white p-3"
          >
            <div
              className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone}`}
            >
              <Icon size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#71858a]">{label}</p>
              <p className="text-2xl font-black tracking-[-0.05em]">
                {value}
                <span className="ml-1 text-xs font-bold text-[#84969a]">
                  {suffix}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>}

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.55fr_.75fr]">
        {features.appointments && <section className="rounded-[24px] border border-[#dce8e5] bg-white p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black">対応中のスケジュール</h3>
              <p className="text-xs text-[#7c9094]">
                終了済み施術は会計画面へ自動連携
              </p>
            </div>
            <span className="rounded-full bg-[#edf5f3] px-3 py-1 text-xs font-black text-[#087f71]">
              {operatingAppointments.length} sessions
            </span>
          </div>
          <div className="mt-5 space-y-2.5">
            {operatingAppointments.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                onCheckin={onCheckin}
              />
            ))}
            {operatingAppointments.length === 0 && (
              <EmptyState label="対応中の予約はありません" />
            )}
          </div>
        </section>}

        <div className="space-y-5">
          {features.clinical && <section className="rounded-[24px] bg-[#173b42] p-5 text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-black">安全確認</h3>
              <ShieldAlert size={21} className="text-[#83ddcd]" />
            </div>
            <p className="mt-4 text-3xl font-black">
              {facility.summary.stopAlerts}
              <span className="ml-1 text-sm text-white/55">ストップ</span>
            </p>
            <p className="mt-2 text-xs leading-5 text-white/60">
              判定結果がストップの場合、施術開始には責任者の確認が必要です。
            </p>
            <div className="mt-4 rounded-xl bg-white/8 p-3 text-[11px] leading-5 text-white/70">
              <b className="text-[#9ce7da]">{facility.safetyRule.name}</b>
              <br />
              {facility.safetyRule.source_note}
            </div>
          </section>}
          {features.equipment && <section className="rounded-[24px] border border-[#dce8e5] bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-black">機器アラート</h3>
              <span className="text-xs font-black text-[#c36a1a]">
                {attentionDevices.length}件
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {attentionDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center gap-3 rounded-xl bg-[#fff8e8] p-3"
                >
                  <BatteryCharging size={19} className="text-[#b8750c]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">{device.asset_code}</p>
                    <p className="truncate text-[11px] text-[#8c7a59]">
                      点検待ち・累計使用 {device.usage_count}回
                    </p>
                  </div>
                  <ChevronRight size={17} />
                </div>
              ))}
            </div>
          </section>}
        </div>
      </div>
    </div>
  );
}

function AppointmentRow({
  appointment,
  onCheckin,
}: {
  appointment: Appointment;
  onCheckin: (value: Appointment) => void;
}) {
  const safetyTone =
    appointment.safety_decision === "stop"
      ? "bg-[#fff0ed] text-[#c84f3e]"
      : appointment.safety_decision === "allow"
        ? "bg-[#e7f5f1] text-[#087f71]"
        : "bg-[#eef3f2] text-[#687d84]";
  return (
    <div className="grid items-center gap-3 rounded-2xl border border-[#e2ebe9] p-3.5 sm:grid-cols-[76px_1fr_auto]">
      <div>
        <p className="text-xl font-black tracking-[-0.03em]">
          {timeText(appointment.start_at)}
        </p>
        <p className="text-[10px] text-[#8a9b9f]">
          {timeText(appointment.end_at)}まで
        </p>
      </div>
      <div className="min-w-0 border-l border-[#dce8e5] pl-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black">{appointment.customer_name}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${safetyTone}`}
          >
            {appointment.safety_decision === "stop"
              ? "STOP"
              : appointment.safety_decision === "allow"
                ? "実施可"
                : statusLabel[appointment.status]}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-[#71858a]">
          {appointment.product_name} ・ {appointment.therapist_name} ・{" "}
          {appointment.hal_asset_code}
        </p>
      </div>
      <button
        onClick={() => onCheckin(appointment)}
        className="rounded-xl bg-[#edf5f3] px-4 py-2.5 text-xs font-black text-[#087f71]"
      >
        {appointment.safety_decision ? "安全確認を表示" : "受付・安全確認"}
      </button>
    </div>
  );
}

function CheckinModal({
  appointment,
  rule,
  onClose,
  onSaved,
}: {
  appointment: Appointment;
  rule: Dashboard["facility"]["safetyRule"];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    systolic: "124",
    diastolic: "76",
    pulse: "72",
    temperature: "36.5",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    decision: string;
    triggered_rules: string[];
  } | null>(
    appointment.safety_decision
      ? { decision: appointment.safety_decision, triggered_rules: [] }
      : null,
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointment.id, ...form }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "保存できませんでした。");
      setResult(body.vitalCheck);
      await onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "保存できませんでした。",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#09262c]/55 p-3 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
        className="my-4 w-full max-w-2xl rounded-[28px] bg-white p-5 shadow-2xl md:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black tracking-wider text-[#087f71]">
              CHECK-IN & SAFETY
            </p>
            <h2 id="checkin-title" className="mt-1 text-2xl font-black">
              {appointment.customer_name}さん
            </h2>
            <p className="mt-1 text-xs text-[#71858a]">
              {timeText(appointment.start_at)} ・ {appointment.product_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-[#eef4f2]"
          >
            <X size={20} />
          </button>
        </div>
        {result ? (
          <div
            className={`mt-6 rounded-[22px] p-6 text-center ${result.decision === "stop" ? "bg-[#fff0ed] text-[#b94637]" : "bg-[#e7f5f1] text-[#087f71]"}`}
          >
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-white/70">
              {result.decision === "stop" ? (
                <ShieldAlert size={29} />
              ) : (
                <CheckCircle2 size={29} />
              )}
            </div>
            <h3 className="mt-4 text-2xl font-black">
              {result.decision === "stop" ? "ストップ判定" : "実施可能"}
            </h3>
            <p className="mt-2 text-sm font-bold">
              {result.decision === "stop"
                ? "施術を開始せず、責任者へ確認してください"
                : "バイタル基準内です"}
            </p>
            {result.triggered_rules.length > 0 && (
              <ul className="mt-4 text-left text-sm">
                {result.triggered_rules.map((item) => (
                  <li key={item}>・{item}</li>
                ))}
              </ul>
            )}
            <button
              onClick={onClose}
              className="mt-5 rounded-xl bg-[#173b42] px-6 py-3 font-black text-white"
            >
              閉じる
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { key: "systolic", label: "最高血圧", unit: "mmHg" },
                { key: "diastolic", label: "最低血圧", unit: "mmHg" },
                { key: "pulse", label: "脈拍", unit: "bpm" },
                { key: "temperature", label: "体温", unit: "℃" },
              ].map((field) => (
                <label key={field.key} className="rounded-2xl bg-[#f2f7f6] p-3">
                  <span className="text-xs font-bold text-[#71858a]">
                    {field.label}
                  </span>
                  <div className="mt-2 flex items-baseline gap-1">
                    <input
                      required
                      inputMode="decimal"
                      value={form[field.key as keyof typeof form]}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                      className="min-w-0 flex-1 bg-transparent text-2xl font-black outline-none"
                    />
                    <span className="text-[10px] text-[#829397]">
                      {field.unit}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            <label className="mt-4 block text-xs font-bold text-[#687d84]">
              申し送り
              <textarea
                value={form.note}
                onChange={(event) =>
                  setForm({ ...form, note: event.target.value })
                }
                placeholder="皮膚状態、体調変化など"
                className="mt-2 h-20 w-full resize-none rounded-xl border border-[#dce8e5] p-3 text-sm outline-none"
              />
            </label>
            <div className="mt-4 flex gap-3 rounded-xl bg-[#fff8e7] p-3 text-[11px] leading-5 text-[#806a3f]">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>
                <b>{rule.name}</b>
                <br />
                {rule.source_note}
              </p>
            </div>
            {error && (
              <p className="mt-3 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]">
                {error}
              </p>
            )}
            <button
              disabled={submitting}
              className="mt-5 w-full rounded-2xl bg-[#087f71] py-4 font-black text-white disabled:bg-[#a9c3be]"
            >
              {submitting ? "判定しています…" : "受付して安全判定する"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#cfdeda] p-10 text-center text-sm text-[#829397]">
      {label}
    </div>
  );
}
function ErrorPanel({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <AlertTriangle className="mx-auto text-[#dc6b58]" />
        <p className="mt-4 font-bold text-[#dc6b58]">{message}</p>
        <button
          onClick={() => location.reload()}
          className="mt-5 rounded-xl bg-[#087f71] px-5 py-3 font-bold text-white"
        >
          再読み込み
        </button>
      </div>
    </main>
  );
}
