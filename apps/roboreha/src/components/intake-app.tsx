"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ClipboardList } from "lucide-react";
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
  sort_order: number;
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
  const [touchedQuestionKeys, setTouchedQuestionKeys] = useState<string[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.customer_id === customerId),
    [customerId, customers],
  );
  const orderedQuestions = useMemo(
    () =>
      [...(template?.items ?? [])].sort(
        (left, right) => left.sort_order - right.sort_order,
      ),
    [template],
  );

  function markQuestionTouched(itemKey: string) {
    setTouchedQuestionKeys((current) =>
      current.includes(itemKey) ? current : [...current, itemKey],
    );
  }

  function isQuestionAnswered(item: TemplateItem) {
    const touched = touchedQuestionKeys.includes(item.item_key);
    if (item.system_field) {
      const value = form[item.system_field as keyof typeof form];
      if (typeof value === "boolean" || typeof value === "number") return touched;
      if (item.system_field === "walkingAid") return touched;
      return typeof value === "string" && value.trim().length > 0;
    }
    const value = customResponses[item.item_key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return value !== undefined;
  }

  const answeredQuestionCount = orderedQuestions.filter(isQuestionAnswered).length;
  const remainingQuestionCount = Math.max(
    0,
    orderedQuestions.length - answeredQuestionCount,
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

  function updateSystemQuestion(
    item: TemplateItem,
    value: string | number | boolean,
  ) {
    if (!item.system_field) return;
    setForm((current) => ({ ...current, [item.system_field!]: value }));
    markQuestionTouched(item.item_key);
  }

  function renderQuestionInput(item: TemplateItem) {
    if (item.system_field === "chiefComplaint")
      return (
        <QuestionArea
          label={item.label}
          value={form.chiefComplaint}
          onChange={(value) => updateSystemQuestion(item, value)}
          required={item.required}
        >
          <RotatingTextSuggestions
            suggestions={suggestions.chief}
            loading={suggestionsLoading}
            onSelect={(candidate) =>
              updateSystemQuestion(
                item,
                appendSuggestion(form.chiefComplaint, candidate),
              )
            }
          />
        </QuestionArea>
      );
    if (item.system_field === "medicalHistory")
      return (
        <QuestionArea
          label={item.label}
          value={form.medicalHistory}
          onChange={(value) => updateSystemQuestion(item, value)}
          required={item.required}
        >
          <RotatingTextSuggestions
            suggestions={suggestions.history}
            loading={suggestionsLoading}
            onSelect={(candidate) =>
              updateSystemQuestion(
                item,
                appendSuggestion(form.medicalHistory, candidate),
              )
            }
          />
        </QuestionArea>
      );
    if (item.system_field === "medications")
      return (
        <QuestionArea
          label={item.label}
          value={form.medications}
          onChange={(value) => updateSystemQuestion(item, value)}
          required={item.required}
        >
          <RotatingTextSuggestions
            suggestions={suggestions.medications}
            loading={suggestionsLoading}
            onSelect={(candidate) =>
              updateSystemQuestion(
                item,
                appendSuggestion(form.medications, candidate),
              )
            }
          />
        </QuestionArea>
      );
    if (item.system_field === "walkingAid") {
      const options = item.options.length
        ? item.options
        : ["なし", "杖", "歩行器", "手すり", "その他"];
      return (
        <label className="block text-sm font-black">
          {item.label}
          {item.required && <RequiredBadge />}
          <select
            required={item.required}
            value={
              touchedQuestionKeys.includes(item.item_key) ? form.walkingAid : ""
            }
            onChange={(event) => updateSystemQuestion(item, event.target.value)}
            className="mt-2 min-h-13 w-full rounded-xl border-2 border-[#d7e4e1] bg-white p-3 text-base"
          >
            <option value="">選択してください</option>
            {options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      );
    }
    if (item.system_field === "painScale")
      return (
        <label className="block text-sm font-black">
          {item.label}：{form.painScale}/10
          {item.required && <RequiredBadge />}
          <input
            type="range"
            min={item.min_value ?? "0"}
            max={item.max_value ?? "10"}
            value={form.painScale}
            onChange={(event) =>
              updateSystemQuestion(item, Number(event.target.value))
            }
            className="mt-3 w-full accent-[#087f71]"
          />
          {!touchedQuestionKeys.includes(item.item_key) && (
            <span className="mt-1 block text-xs font-bold text-[#71858a]">
              スライダーを動かして回答してください
            </span>
          )}
        </label>
      );
    if (
      item.system_field &&
      ["pacemaker", "fractureRisk", "skinIssue", "fallHistory"].includes(
        item.system_field,
      )
    ) {
      const key = item.system_field as
        | "pacemaker"
        | "fractureRisk"
        | "skinIssue"
        | "fallHistory";
      return (
        <BooleanQuestion
          label={item.label}
          required={item.required}
          answered={touchedQuestionKeys.includes(item.item_key)}
          value={form[key]}
          onChange={(value) => updateSystemQuestion(item, value)}
        />
      );
    }
    return (
      <CustomQuestion
        item={item}
        value={customResponses[item.item_key]}
        onChange={(value) => {
          setCustomResponses((current) => ({
            ...current,
            [item.item_key]: value,
          }));
          markQuestionTouched(item.item_key);
        }}
      />
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const missingIndex = orderedQuestions.findIndex(
      (item) => item.required && !isQuestionAnswered(item),
    );
    if (missingIndex >= 0) {
      const missing = orderedQuestions[missingIndex];
      setActiveQuestionIndex(missingIndex);
      setError(`問診${missingIndex + 1}「${missing.label}」に回答してください。`);
      document
        .getElementById(`intake-question-${missing.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
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
          <Link href="/customer" className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-black text-[#087f71]">
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
              setTouchedQuestionKeys([]);
              setActiveQuestionIndex(0);
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

        {orderedQuestions.length > 0 && (
          <>
            <nav
              aria-label="問診の進捗"
              className="sticky top-2 z-10 mt-5 rounded-2xl border border-[#cfe0dc] bg-white/95 p-3 shadow-sm backdrop-blur"
            >
              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max items-center px-1">
                  {orderedQuestions.map((item, index) => {
                    const answered = isQuestionAnswered(item);
                    const active = index === activeQuestionIndex;
                    return (
                      <span key={item.id} className="flex items-center">
                        <button
                          type="button"
                          aria-label={`問診${index + 1} ${item.label}`}
                          aria-current={active ? "step" : undefined}
                          onClick={() => {
                            setActiveQuestionIndex(index);
                            document
                              .getElementById(`intake-question-${item.id}`)
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                          }}
                          className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${
                            answered
                              ? "bg-[#087f71] text-white"
                              : active
                                ? "bg-[#17353d] text-white"
                                : "bg-[#e7eeec] text-[#829397]"
                          }`}
                        >
                          {answered ? <Check size={15} /> : index + 1}
                        </button>
                        {index < orderedQuestions.length - 1 && (
                          <span
                            className={`h-1 w-6 rounded-full ${
                              answered ? "bg-[#087f71]" : "bg-[#e7eeec]"
                            }`}
                          />
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-center text-sm font-black">
                問診中 {Math.min(activeQuestionIndex + 1, orderedQuestions.length)} / {orderedQuestions.length}
                <span className="mx-2 text-[#a6b5b8]">・</span>
                回答済み {answeredQuestionCount}問
                <span className="mx-2 text-[#a6b5b8]">・</span>
                あと {remainingQuestionCount}問
              </p>
            </nav>
            <div className="mt-4 space-y-4">
              {orderedQuestions.map((item, index) => {
                const answered = isQuestionAnswered(item);
                return (
                  <article
                    id={`intake-question-${item.id}`}
                    key={item.id}
                    onFocusCapture={() => setActiveQuestionIndex(index)}
                    onPointerDown={() => setActiveQuestionIndex(index)}
                    className={`scroll-mt-32 rounded-2xl border-2 p-4 transition ${
                      index === activeQuestionIndex
                        ? "border-[#87cabe] bg-[#fbfffe]"
                        : "border-[#dce8e5] bg-white"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#17353d] px-3 py-1 text-xs font-black text-white">
                        問診 {index + 1}
                      </span>
                      <span
                        className={`text-xs font-black ${
                          answered ? "text-[#087f71]" : "text-[#829397]"
                        }`}
                      >
                        {answered ? "回答済み" : "未回答"}
                      </span>
                    </div>
                    {renderQuestionInput(item)}
                    {item.system_field && item.help_text && (
                      <p className="mt-2 text-xs leading-5 text-[#71858a]">
                        {item.help_text}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </>
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

function RequiredBadge() {
  return (
    <span className="ml-2 rounded-md bg-[#fff0ed] px-1.5 py-0.5 text-[10px] text-[#bd4f3f]">
      必須
    </span>
  );
}

function BooleanQuestion({
  label,
  value,
  answered,
  required,
  onChange,
}: {
  label: string;
  value: boolean;
  answered: boolean;
  required: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-black">
        {label}
        {required && <RequiredBadge />}
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {[
          { label: "いいえ", value: false },
          { label: "はい", value: true },
        ].map((option) => {
          const selected = answered && value === option.value;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-13 rounded-xl border-2 text-base font-black ${
                selected
                  ? "border-[#087f71] bg-[#e7f5f1] text-[#087f71]"
                  : "border-[#d7e4e1] bg-white text-[#526d72]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
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
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-black">
        {label}
        {required && <RequiredBadge />}
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
