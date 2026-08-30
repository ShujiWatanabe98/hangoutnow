"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Eye,
  GripVertical,
  Hash,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
  Video,
  X,
} from "lucide-react";

type IntakeItem = {
  customer_id: string;
  customer_code: string;
  name: string;
  primary_condition: string;
  first_visit: boolean;
  id: string | null;
  chief_complaint: string | null;
  medical_history: string | null;
  medications: string | null;
  pacemaker: boolean;
  fracture_risk: boolean;
  skin_issue: boolean;
  fall_history: boolean;
  walking_aid: string | null;
  pain_scale: number | null;
  status: string | null;
};

type FieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "single_choice"
  | "multiple_choice"
  | "boolean"
  | "video";
type TemplateItem = {
  id: string;
  item_key: string;
  label: string;
  help_text: string | null;
  field_type: FieldType;
  required: boolean;
  unit: string | null;
  min_value: string | null;
  max_value: string | null;
  options: string[];
  sort_order: number;
  system_field: string | null;
};
type QuestionnaireTemplate = {
  id: string;
  title: string;
  introduction_text: string;
  consent_text: string;
  updated_at: string;
  items: TemplateItem[];
};
type ItemDraft = {
  id?: string;
  label: string;
  helpText: string;
  fieldType: FieldType;
  required: boolean;
  unit: string;
  minValue: string;
  maxValue: string;
  optionsText: string;
};

const emptyDraft: ItemDraft = {
  label: "",
  helpText: "",
  fieldType: "long_text",
  required: false,
  unit: "",
  minValue: "",
  maxValue: "",
  optionsText: "",
};
const fieldLabels: Record<FieldType, string> = {
  short_text: "短文テキスト",
  long_text: "長文テキスト",
  number: "数値",
  single_choice: "単一選択",
  multiple_choice: "複数選択",
  boolean: "はい・いいえ",
  video: "動画",
};

export function IntakeManager() {
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [selected, setSelected] = useState<IntakeItem | null>(null);
  const [template, setTemplate] = useState<QuestionnaireTemplate | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/intake", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setItems(body.customers);
  }

  async function loadTemplate() {
    const response = await fetch("/api/intake-template", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setTemplate(body.template);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/intake", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setItems(body.customers);
      })
      .catch((reason: Error) => active && setError(reason.message));
    return () => {
      active = false;
    };
  }, []);

  async function openBuilder() {
    setError("");
    try {
      await loadTemplate();
      setBuilderOpen(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "問診表を開けませんでした。",
      );
    }
  }

  async function review() {
    if (!selected?.id) return;
    const response = await fetch("/api/intake", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, action: "review" }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error);
      return;
    }
    setSelected(null);
    await load();
  }

  async function saveTemplateText() {
    if (!template) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/intake-template", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.title,
          introductionText: template.introduction_text,
          consentText: template.consent_text,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setTemplate(body.template);
      setNotice("問診表のテキストを保存しました。");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  function editItem(item: TemplateItem) {
    setDraft({
      id: item.id,
      label: item.label,
      helpText: item.help_text ?? "",
      fieldType: item.field_type,
      required: item.required,
      unit: item.unit ?? "",
      minValue: item.min_value ?? "",
      maxValue: item.max_value ?? "",
      optionsText: item.options.join("、"),
    });
  }

  async function saveItem() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        id: draft.id,
        label: draft.label,
        helpText: draft.helpText,
        fieldType: draft.fieldType,
        required: draft.required,
        unit: draft.unit,
        minValue: draft.minValue === "" ? null : Number(draft.minValue),
        maxValue: draft.maxValue === "" ? null : Number(draft.maxValue),
        options: draft.optionsText
          .split(/[、,\n]/)
          .map((option) => option.trim())
          .filter(Boolean),
      };
      const response = await fetch("/api/intake-template", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await loadTemplate();
      setDraft(null);
      setNotice(
        draft.id ? "問診項目を更新しました。" : "問診項目を追加しました。",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "項目を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: TemplateItem) {
    if (!window.confirm(`「${item.label}」を問診表から削除しますか？`)) return;
    setError("");
    const response = await fetch(`/api/intake-template?id=${item.id}`, {
      method: "DELETE",
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error);
      return;
    }
    await loadTemplate();
    setNotice("問診項目を削除しました。");
  }

  async function moveItem(itemId: string, direction: -1 | 1) {
    if (!template || saving) return;
    const currentIndex = template.items.findIndex((item) => item.id === itemId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= template.items.length)
      return;
    const previousItems = template.items;
    const nextItems = [...previousItems];
    [nextItems[currentIndex], nextItems[nextIndex]] = [
      nextItems[nextIndex],
      nextItems[currentIndex],
    ];
    setTemplate({ ...template, items: nextItems });
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/intake-template", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: nextItems.map((item) => item.id) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setTemplate(body.template);
      setNotice(
        `問診${nextIndex + 1}番へ移動しました。利用者画面の順番にも反映されます。`,
      );
    } catch (reason) {
      setTemplate({ ...template, items: previousItems });
      setError(
        reason instanceof Error ? reason.message : "順番を変更できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-black tracking-[.15em] text-[#087f71]">
            INTAKE
          </p>
          <h2 className="text-2xl font-black">初診問診</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openBuilder}
            className="flex items-center gap-2 rounded-xl border border-[#087f71] bg-white px-4 py-2 text-xs font-black text-[#087f71]"
          >
            <Settings2 size={16} /> 問診表改修
          </button>
          <a
            href="/intake"
            target="_blank"
            className="rounded-xl bg-[#087f71] px-4 py-2 text-xs font-black text-white"
          >
            利用者用問診を開く
          </a>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-2 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-2 rounded-xl bg-[#e7f5f1] p-3 text-sm font-bold text-[#087f71]">
          {notice}
        </p>
      )}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items
          .filter((item) => item.first_visit || item.id)
          .map((item) => (
            <article
              key={item.customer_id}
              className="rounded-2xl border border-[#dce8e5] bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-black">{item.name}</p>
                  <p className="text-xs text-[#71858a]">
                    {item.customer_code}・{item.primary_condition}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-black ${item.status === "reviewed" ? "bg-[#e7f5f1] text-[#087f71]" : item.id ? "bg-[#fff3d5] text-[#9a6810]" : "bg-[#fff0ed] text-[#bd4f3f]"}`}
                >
                  {item.status === "reviewed"
                    ? "確認済み"
                    : item.id
                      ? "確認待ち"
                      : "未回答"}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-[#60777c]">
                {item.chief_complaint || "初診問診の回答をお待ちしています。"}
              </p>
              <button
                disabled={!item.id}
                onClick={() => setSelected(item)}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-[#edf5f3] py-2 text-xs font-black text-[#087f71] disabled:text-[#a8b5b3]"
              >
                <Eye size={14} /> 問診詳細
              </button>
            </article>
          ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#09262c]/55 p-3">
          <section
            role="dialog"
            aria-label="問診詳細"
            className="w-full max-w-2xl rounded-3xl bg-white p-5"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-black text-[#087f71]">
                  FIRST VISIT INTAKE
                </p>
                <h3 className="text-xl font-black">
                  {selected.name}さんの問診
                </h3>
              </div>
              <button aria-label="閉じる" onClick={() => setSelected(null)}>
                <X />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Info label="主訴" value={selected.chief_complaint || "—"} />
              <Info label="既往歴" value={selected.medical_history || "なし"} />
              <Info label="服薬" value={selected.medications || "なし"} />
              <Info label="歩行補助具" value={selected.walking_aid || "なし"} />
              <Info label="疼痛" value={`${selected.pain_scale ?? 0}/10`} />
              <Info
                label="注意フラグ"
                value={
                  [
                    selected.pacemaker && "ペースメーカー",
                    selected.fracture_risk && "骨折リスク",
                    selected.skin_issue && "皮膚状態",
                    selected.fall_history && "転倒歴",
                  ]
                    .filter(Boolean)
                    .join("・") || "なし"
                }
              />
            </div>
            {selected.status !== "reviewed" ? (
              <button
                onClick={review}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#087f71] py-3 font-black text-white"
              >
                <CheckCircle2 size={18} />
                内容を確認・承認
              </button>
            ) : (
              <p className="mt-4 rounded-xl bg-[#e7f5f1] p-3 text-center font-black text-[#087f71]">
                確認済み
              </p>
            )}
          </section>
        </div>
      )}

      {builderOpen && template && (
        <div className="fixed inset-0 z-50 bg-[#09262c]/55 p-2 md:p-5">
          <section
            role="dialog"
            aria-label="問診表改修"
            className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-[#f7faf9] shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-[#dce8e5] bg-white p-4 md:p-5">
              <div>
                <p className="text-[10px] font-black tracking-[.15em] text-[#087f71]">
                  QUESTIONNAIRE BUILDER
                </p>
                <h3 className="text-xl font-black">問診表改修</h3>
                <p className="mt-1 text-xs text-[#71858a]">
                  ぐんまロボケアセンター専用の問診内容を設定します。
                </p>
              </div>
              <button
                aria-label="問診表改修を閉じる"
                onClick={() => {
                  setBuilderOpen(false);
                  setDraft(null);
                }}
                className="grid size-10 place-items-center rounded-full bg-[#edf4f2]"
              >
                <X size={20} />
              </button>
            </header>
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[360px_1fr] lg:overflow-hidden">
              <div className="border-r border-[#dce8e5] bg-white p-4 lg:overflow-y-auto">
                <label className="block text-xs font-black">
                  問診表タイトル
                  <input
                    value={template.title}
                    onChange={(event) =>
                      setTemplate({ ...template, title: event.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-[#cddedb] p-3 text-sm"
                  />
                </label>
                <label className="mt-4 block text-xs font-black">
                  説明文
                  <textarea
                    rows={4}
                    value={template.introduction_text}
                    onChange={(event) =>
                      setTemplate({
                        ...template,
                        introduction_text: event.target.value,
                      })
                    }
                    className="mt-1 w-full resize-none rounded-xl border border-[#cddedb] p-3 text-sm leading-6"
                  />
                </label>
                <label className="mt-4 block text-xs font-black">
                  同意文
                  <textarea
                    rows={5}
                    value={template.consent_text}
                    onChange={(event) =>
                      setTemplate({
                        ...template,
                        consent_text: event.target.value,
                      })
                    }
                    className="mt-1 w-full resize-none rounded-xl border border-[#cddedb] p-3 text-sm leading-6"
                  />
                </label>
                <button
                  disabled={saving}
                  onClick={saveTemplateText}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#087f71] py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  <Save size={17} />
                  テキストを保存
                </button>
              </div>
              <div className="p-4 lg:overflow-y-auto md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-black">問診項目</h4>
                    <p className="text-xs text-[#71858a]">
                      リハビリで使用しやすい標準項目を登録済みです。施設ごとに編集できます。
                    </p>
                  </div>
                  <button
                    onClick={() => setDraft({ ...emptyDraft })}
                    className="flex items-center gap-2 rounded-xl bg-[#173b42] px-4 py-2.5 text-xs font-black text-white"
                  >
                    <Plus size={16} />
                    項目を追加
                  </button>
                </div>
                <div className="mt-4 grid gap-2">
                  {template.items.map((item, index) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-[#dce8e5] bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <div className="flex shrink-0 items-center gap-2">
                            <GripVertical
                              aria-hidden="true"
                              size={18}
                              className="text-[#9aabae]"
                            />
                            <span className="grid size-9 place-items-center rounded-full bg-[#17353d] text-sm font-black text-white">
                              {index + 1}
                            </span>
                          </div>
                          <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black">{item.label}</span>
                            {item.required && (
                              <span className="rounded-full bg-[#fff0ed] px-2 py-0.5 text-[10px] font-black text-[#bd4f3f]">
                                必須
                              </span>
                            )}
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#087f71]">
                            {item.field_type === "video" ? (
                              <Video size={13} />
                            ) : item.field_type === "number" ? (
                              <Hash size={13} />
                            ) : null}
                            {fieldLabels[item.field_type]}
                            {item.unit ? `・${item.unit}` : ""}
                          </p>
                          {item.help_text && (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#71858a]">
                              {item.help_text}
                            </p>
                          )}
                          {item.options.length > 0 && (
                            <p className="mt-1 text-[11px] text-[#829397]">
                              選択肢：{item.options.join("・")}
                            </p>
                          )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={`${item.label}を上へ移動`}
                            title="上へ移動"
                            disabled={saving || index === 0}
                            onClick={() => moveItem(item.id, -1)}
                            className="grid size-11 place-items-center rounded-lg border border-[#d7e4e1] bg-white text-[#17353d] disabled:opacity-25"
                          >
                            <ChevronUp size={18} />
                          </button>
                          <button
                            type="button"
                            aria-label={`${item.label}を下へ移動`}
                            title="下へ移動"
                            disabled={saving || index === template.items.length - 1}
                            onClick={() => moveItem(item.id, 1)}
                            className="grid size-11 place-items-center rounded-lg border border-[#d7e4e1] bg-white text-[#17353d] disabled:opacity-25"
                          >
                            <ChevronDown size={18} />
                          </button>
                          <button
                            type="button"
                            aria-label={`${item.label}を編集`}
                            onClick={() => editItem(item)}
                            className="grid size-8 place-items-center rounded-lg bg-[#edf5f3] text-[#087f71]"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label={`${item.label}を削除`}
                            onClick={() => removeItem(item)}
                            className="grid size-8 place-items-center rounded-lg bg-[#fff0ed] text-[#bd4f3f]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#09262c]/60 p-3">
          <section
            role="dialog"
            aria-label="問診項目編集"
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">
                {draft.id ? "問診項目を編集" : "問診項目を追加"}
              </h3>
              <button
                aria-label="項目編集を閉じる"
                onClick={() => setDraft(null)}
              >
                <X />
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-black sm:col-span-2">
                項目名
                <input
                  value={draft.label}
                  onChange={(event) =>
                    setDraft({ ...draft, label: event.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[#cddedb] p-3 text-sm"
                />
              </label>
              <label className="text-xs font-black">
                入力形式
                <select
                  value={draft.fieldType}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      fieldType: event.target.value as FieldType,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-[#cddedb] bg-white p-3 text-sm"
                >
                  {Object.entries(fieldLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end rounded-xl bg-[#f3f7f6] p-3 text-sm font-black">
                <input
                  type="checkbox"
                  checked={draft.required}
                  onChange={(event) =>
                    setDraft({ ...draft, required: event.target.checked })
                  }
                  className="size-5 accent-[#087f71]"
                />
                必須項目にする
              </label>
              <label className="text-xs font-black sm:col-span-2">
                補足・撮影方法
                <textarea
                  rows={3}
                  value={draft.helpText}
                  onChange={(event) =>
                    setDraft({ ...draft, helpText: event.target.value })
                  }
                  className="mt-1 w-full resize-none rounded-xl border border-[#cddedb] p-3 text-sm"
                />
              </label>
              {draft.fieldType === "number" && (
                <>
                  <label className="text-xs font-black">
                    単位
                    <input
                      value={draft.unit}
                      onChange={(event) =>
                        setDraft({ ...draft, unit: event.target.value })
                      }
                      placeholder="点・秒・回など"
                      className="mt-1 w-full rounded-xl border border-[#cddedb] p-3 text-sm"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-black">
                      最小値
                      <input
                        type="number"
                        value={draft.minValue}
                        onChange={(event) =>
                          setDraft({ ...draft, minValue: event.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-[#cddedb] p-3 text-sm"
                      />
                    </label>
                    <label className="text-xs font-black">
                      最大値
                      <input
                        type="number"
                        value={draft.maxValue}
                        onChange={(event) =>
                          setDraft({ ...draft, maxValue: event.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-[#cddedb] p-3 text-sm"
                      />
                    </label>
                  </div>
                </>
              )}
              {(draft.fieldType === "single_choice" ||
                draft.fieldType === "multiple_choice") && (
                <label className="text-xs font-black sm:col-span-2">
                  選択肢（読点または改行区切り）
                  <textarea
                    rows={3}
                    value={draft.optionsText}
                    onChange={(event) =>
                      setDraft({ ...draft, optionsText: event.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-[#cddedb] p-3 text-sm"
                  />
                </label>
              )}
            </div>
            <button
              disabled={saving || !draft.label.trim()}
              onClick={saveItem}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#087f71] py-3 font-black text-white disabled:opacity-50"
            >
              <Save size={18} />
              {draft.id ? "変更を保存" : "項目を追加"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f4f8f7] p-3">
      <p className="text-[10px] font-black text-[#829397]">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}
