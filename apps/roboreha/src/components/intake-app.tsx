"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { Brand } from "./brand";
import {
  appendSuggestion,
  RotatingTextSuggestions,
} from "./rotating-text-suggestions";

type Customer = {
  customer_id: string;
  customer_code: string;
  name: string;
  diagnosis_name: string | null;
  birth_date: string;
  primary_condition: string | null;
  goal: string | null;
  first_visit: boolean;
  id: string | null;
  status: string | null;
};

type SuggestionSet = {
  chief: string[];
  history: string[];
  medications: string[];
};
type TemplateItem = {
  id: string;
  item_key: string;
  label: string;
  help_text: string | null;
  field_type:
    | "short_text"
    | "long_text"
    | "number"
    | "single_choice"
    | "multiple_choice"
    | "boolean"
    | "video";
  required: boolean;
  unit: string | null;
  min_value: string | null;
  max_value: string | null;
  options: string[];
  system_field: string | null;
};
type QuestionnaireTemplate = {
  title: string;
  introduction_text: string;
  consent_text: string;
  items: TemplateItem[];
};
type CustomResponse = string | number | boolean | string[];

const initialForm = {
  chiefComplaint: "",
  medicalHistory: "",
  medications: "",
  pacemaker: false,
  fractureRisk: false,
  skinIssue: false,
  fallHistory: false,
  walkingAid: "なし",
  painScale: 0,
  consentTerms: false,
  consentMedia: false,
};

export function IntakeApp() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [template, setTemplate] = useState<QuestionnaireTemplate | null>(null);
  const [customResponses, setCustomResponses] = useState<
    Record<string, CustomResponse>
  >({});
  const [suggestions, setSuggestions] = useState<SuggestionSet>({
    chief: [],
    history: [],
    medications: [],
  });
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.customer_id === customerId),
    [customerId, customers],
  );

  useEffect(() => {
    const requestedCustomer = new URLSearchParams(window.location.search).get(
      "customerId",
    );
    fetch(
      `/api/intake${requestedCustomer ? `?customerId=${encodeURIComponent(requestedCustomer)}` : ""}`,
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error ?? "利用者情報を読み込めませんでした。");
        const list = (body.customers as Customer[]).filter(
          (customer) => customer.first_visit,
        );
        setCustomers(list);
        setCustomerId(
          list.find((customer) => customer.customer_id === requestedCustomer)
            ?.customer_id ??
            list.find((customer) => !customer.id)?.customer_id ??
            list[0]?.customer_id ??
            "",
        );
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "利用者情報を読み込めませんでした。",
        ),
      );
  }, []);

  useEffect(() => {
    fetch("/api/intake-template", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setTemplate(body.template);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "問診表を読み込めませんでした。",
        ),
      );
  }, []);

  useEffect(() => {
    if (!customerId) return;
    const controller = new AbortController();
    const contexts = [
      "intake_chief_complaint",
      "intake_medical_history",
      "intake_medications",
    ] as const;
    const load = async () => {
      setSuggestionsLoading(true);
      return Promise.all(
        contexts.map(async (context) => {
          const response = await fetch("/api/text-suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ context, customerId }),
            signal: controller.signal,
          });
          const body = await response.json();
          if (!response.ok)
            throw new Error(body.error ?? "入力候補を作成できませんでした。");
          return body.suggestions as string[];
        }),
      );
    };
    load()
      .then(([chief, history, medications]) => {
        setSuggestions({ chief, history, medications });
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError"))
          setError(
            reason instanceof Error
              ? reason.message
              : "入力候補を作成できませんでした。",
          );
      })
      .finally(() => setSuggestionsLoading(false));
    return () => controller.abort();
  }, [customerId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, ...form, customResponses }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error);
      return;
    }
    setDone(true);
  }

  if (done)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f0f7f5] p-5">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <CheckCircle2 className="mx-auto text-[#087f71]" size={44} />
          <h1 className="mt-4 text-2xl font-black">問診を送信しました</h1>
          <p className="mt-2 text-sm text-[#60777c]">
            施設スタッフが内容を確認します。
          </p>
          <Link
            href="/customer"
            className="mt-5 inline-block rounded-xl bg-[#087f71] px-6 py-3 font-black text-white"
          >
            マイページへ
          </Link>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#f0f7f5] p-3 text-[#17353d] sm:p-5">
      <form
        onSubmit={submit}
        className="mx-auto max-w-3xl rounded-3xl bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="flex items-center justify-between">
          <Brand />
          <Link href="/customer" className="text-sm font-black text-[#087f71]">
            戻る
          </Link>
        </div>
        <div className="mt-5">
          <p className="text-[10px] font-black tracking-[.15em] text-[#087f71]">
            FIRST VISIT
          </p>
          <h1 className="text-2xl font-black">
            {template?.title ?? "初診問診"}
          </h1>
          <p className="mt-1 text-base leading-7 text-[#60777c]">
            {template?.introduction_text ??
              "登録内容をもとに入力候補を表示します。内容は自由に修正できます。"}
          </p>
        </div>

        <label className="mt-4 block text-sm font-black">
          利用者
          <select
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value);
              setForm(initialForm);
              setCustomResponses({});
            }}
            className="mt-2 min-h-13 w-full rounded-xl border-2 border-[#d7e4e1] bg-white p-3 text-base"
          >
            {customers.map((customer) => (
              <option key={customer.customer_id} value={customer.customer_id}>
                {customer.name}（{customer.customer_code}）
              </option>
            ))}
          </select>
        </label>
        {selectedCustomer && (
          <div className="mt-3 flex gap-3 rounded-2xl bg-[#eff7f5] p-4">
            <ClipboardList className="shrink-0 text-[#087f71]" size={20} />
            <div>
              <p className="text-sm font-black">登録内容</p>
              <p className="mt-1 text-sm leading-6 text-[#60777c]">
                診断名：{selectedCustomer.diagnosis_name || "未登録"}
                <br />
                現在の症状：{selectedCustomer.primary_condition || "未登録"}
                <br />
                目標：{selectedCustomer.goal || "未登録"}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-5">
          <QuestionArea
            label={
              template?.items.find(
                (item) => item.system_field === "chiefComplaint",
              )?.label ?? "現在もっとも困っていること"
            }
            value={form.chiefComplaint}
            onChange={(value) =>
              setForm((current) => ({ ...current, chiefComplaint: value }))
            }
            required
          >
            <RotatingTextSuggestions
              suggestions={suggestions.chief}
              loading={suggestionsLoading}
              onSelect={(candidate) =>
                setForm((current) => ({
                  ...current,
                  chiefComplaint: appendSuggestion(
                    current.chiefComplaint,
                    candidate,
                  ),
                }))
              }
            />
          </QuestionArea>
          <QuestionArea
            label={
              template?.items.find(
                (item) => item.system_field === "medicalHistory",
              )?.label ?? "既往歴・手術歴"
            }
            value={form.medicalHistory}
            onChange={(value) =>
              setForm((current) => ({ ...current, medicalHistory: value }))
            }
          >
            <RotatingTextSuggestions
              suggestions={suggestions.history}
              loading={suggestionsLoading}
              onSelect={(candidate) =>
                setForm((current) => ({
                  ...current,
                  medicalHistory: appendSuggestion(
                    current.medicalHistory,
                    candidate,
                  ),
                }))
              }
            />
          </QuestionArea>
          <QuestionArea
            label={
              template?.items.find(
                (item) => item.system_field === "medications",
              )?.label ?? "服薬内容"
            }
            value={form.medications}
            onChange={(value) =>
              setForm((current) => ({ ...current, medications: value }))
            }
          >
            <RotatingTextSuggestions
              suggestions={suggestions.medications}
              loading={suggestionsLoading}
              onSelect={(candidate) =>
                setForm((current) => ({
                  ...current,
                  medications: appendSuggestion(current.medications, candidate),
                }))
              }
            />
          </QuestionArea>
          <label className="block text-sm font-black">
            {template?.items.find((item) => item.system_field === "walkingAid")
              ?.label ?? "歩行補助具"}
            <input
              value={form.walkingAid}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  walkingAid: event.target.value,
                }))
              }
              className="mt-2 min-h-13 w-full rounded-xl border-2 border-[#d7e4e1] p-3 text-base"
            />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["pacemaker", "心臓ペースメーカー"],
            ["fractureRisk", "骨折リスク"],
            ["skinIssue", "皮膚トラブル"],
            ["fallHistory", "過去6か月の転倒"],
          ].map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded-xl bg-[#f3f7f6] p-3 text-xs font-bold"
            >
              <input
                type="checkbox"
                checked={form[key as keyof typeof form] as boolean}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
                className="size-5 accent-[#087f71]"
              />
              {label}
            </label>
          ))}
        </div>
        <label className="mt-5 block text-sm font-black">
          {template?.items.find((item) => item.system_field === "painScale")
            ?.label ?? "現在の痛み"}
          ：{form.painScale}/10
          <input
            type="range"
            min="0"
            max="10"
            value={form.painScale}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                painScale: Number(event.target.value),
              }))
            }
            className="mt-2 w-full accent-[#087f71]"
          />
        </label>
        {(template?.items.filter((item) => !item.system_field).length ?? 0) >
          0 && (
          <section className="mt-6 border-t border-[#dce8e5] pt-5">
            <h2 className="text-lg font-black">施設からの追加質問</h2>
            <p className="mt-1 text-xs text-[#71858a]">
              数値・選択・動画など、施設が設定した項目です。
            </p>
            <div className="mt-4 space-y-5">
              {template?.items
                .filter((item) => !item.system_field)
                .map((item) => (
                  <CustomQuestion
                    key={item.id}
                    item={item}
                    value={customResponses[item.item_key]}
                    onChange={(value) =>
                      setCustomResponses((current) => ({
                        ...current,
                        [item.item_key]: value,
                      }))
                    }
                  />
                ))}
            </div>
          </section>
        )}
        <div className="mt-5 space-y-2">
          <label className="flex gap-3 rounded-xl bg-[#fff7df] p-4 text-sm font-bold">
            <input
              required
              type="checkbox"
              checked={form.consentTerms}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  consentTerms: event.target.checked,
                }))
              }
              className="size-5 accent-[#087f71]"
            />
            {template?.consent_text ?? "利用規約と安全確認事項に同意します"}
          </label>
          <label className="flex gap-3 rounded-xl bg-[#f3f7f6] p-4 text-sm">
            <input
              type="checkbox"
              checked={form.consentMedia}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  consentMedia: event.target.checked,
                }))
              }
              className="size-5 accent-[#087f71]"
            />
            評価動画の施設内保存に同意します（任意）
          </label>
        </div>
        <p className="mt-4 rounded-xl bg-[#f5f8f7] p-3 text-xs leading-5 text-[#60777c]">
          候補は入力支援用です。医学的判断や服薬確認は、診療情報・お薬手帳をもとに療法士が行います。
        </p>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]"
          >
            {error}
          </p>
        )}
        <button
          disabled={!customerId}
          className="mt-5 min-h-14 w-full rounded-xl bg-[#087f71] py-3.5 text-base font-black text-white disabled:bg-[#9abeb8]"
        >
          問診を送信する
        </button>
      </form>
    </main>
  );
}

function QuestionArea({
  label,
  value,
  onChange,
  required = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-black">
        {label}
        {required && (
          <span className="ml-2 rounded-md bg-[#fff0ed] px-1.5 py-0.5 text-[10px] text-[#bd4f3f]">
            必須
          </span>
        )}
        <textarea
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="mt-2 w-full resize-none rounded-xl border-2 border-[#d7e4e1] p-3 text-base leading-6 outline-none focus:border-[#087f71] focus:ring-4 focus:ring-[#dff4ed]"
        />
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function CustomQuestion({
  item,
  value,
  onChange,
}: {
  item: TemplateItem;
  value: CustomResponse | undefined;
  onChange: (value: CustomResponse) => void;
}) {
  const label = (
    <span>
      {item.label}
      {item.required && (
        <span className="ml-2 rounded-md bg-[#fff0ed] px-1.5 py-0.5 text-[10px] text-[#bd4f3f]">
          必須
        </span>
      )}
    </span>
  );
  const inputClass =
    "mt-2 min-h-13 w-full rounded-xl border-2 border-[#d7e4e1] bg-white p-3 text-base outline-none focus:border-[#087f71]";
  return (
    <div>
      <label className="block text-sm font-black">
        {label}
        {item.field_type === "long_text" ? (
          <textarea
            required={item.required}
            rows={3}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClass} resize-none`}
          />
        ) : item.field_type === "number" ? (
          <span className="flex items-center gap-2">
            <input
              required={item.required}
              type="number"
              min={item.min_value ?? undefined}
              max={item.max_value ?? undefined}
              value={typeof value === "number" ? value : ""}
              onChange={(event) =>
                onChange(
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              className={inputClass}
            />
            {item.unit && (
              <span className="mt-2 shrink-0 text-sm">{item.unit}</span>
            )}
          </span>
        ) : item.field_type === "single_choice" ? (
          <select
            required={item.required}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
          >
            <option value="">選択してください</option>
            {item.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        ) : item.field_type === "multiple_choice" ? (
          <span className="mt-2 grid gap-2 sm:grid-cols-2">
            {item.options.map((option) => {
              const selected = Array.isArray(value) && value.includes(option);
              return (
                <span
                  key={option}
                  className="flex items-center gap-2 rounded-xl bg-[#f3f7f6] p-3 text-sm font-bold"
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => {
                      const current = Array.isArray(value) ? value : [];
                      onChange(
                        event.target.checked
                          ? [...current, option]
                          : current.filter((entry) => entry !== option),
                      );
                    }}
                    className="size-5 accent-[#087f71]"
                  />
                  {option}
                </span>
              );
            })}
          </span>
        ) : item.field_type === "boolean" ? (
          <select
            required={item.required}
            value={typeof value === "boolean" ? String(value) : ""}
            onChange={(event) => onChange(event.target.value === "true")}
            className={inputClass}
          >
            <option value="">選択してください</option>
            <option value="false">いいえ</option>
            <option value="true">はい</option>
          </select>
        ) : item.field_type === "video" ? (
          <input
            required={item.required}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={(event) => onChange(event.target.files?.[0]?.name ?? "")}
            className={inputClass}
          />
        ) : (
          <input
            required={item.required}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
          />
        )}
      </label>
      {item.help_text && (
        <p className="mt-1 text-xs leading-5 text-[#71858a]">
          {item.help_text}
        </p>
      )}
    </div>
  );
}
