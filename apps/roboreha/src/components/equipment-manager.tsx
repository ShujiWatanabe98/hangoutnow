"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { withBasePath } from "@/lib/base-path";
import {
  Activity,
  AlertTriangle,
  Armchair,
  CalendarSync,
  Check,
  Footprints,
  Gauge,
  Minus,
  PackagePlus,
  Plus,
  Save,
  X,
} from "lucide-react";

type Category = "hal" | "treadmill" | "bench";
type EquipmentModel = {
  id: string;
  category: Category;
  equipment_name: string;
  model_number: string;
  quantity: number;
  hal_capacity_per_unit: number;
  note: string | null;
  updated_at: string;
};
type Device = {
  id: string;
  asset_code: string;
  serial_number: string;
  model_type: string;
  model_number: string;
  size_label: string | null;
  body_part: "upper_limb" | "lower_limb" | "lumbar" | null;
  image_url: string | null;
  image_source_url: string | null;
  status: string;
  usage_count: number;
};

const categoryMeta: Record<
  Category,
  { label: string; singular: string; icon: typeof Activity; tone: string }
> = {
  hal: {
    label: "HAL機器",
    singular: "HAL機種",
    icon: Activity,
    tone: "bg-[#e5f5f0] text-[#087f71]",
  },
  treadmill: {
    label: "トレッドミル",
    singular: "トレッドミル",
    icon: Footprints,
    tone: "bg-[#eaf3f8] text-[#2d7490]",
  },
  bench: {
    label: "ベンチ",
    singular: "ベンチ",
    icon: Armchair,
    tone: "bg-[#eef1fb] text-[#5769a7]",
  },
};
const modelLabel: Record<string, string> = {
  lower_limb: "下肢タイプ",
  single_joint: "関節タイプ（上肢）",
  lumbar: "腰タイプ",
};
const bodyPartLabel: Record<string, string> = {
  lower_limb: "下肢",
  upper_limb: "上肢",
  lumbar: "腰",
};
const sizeLabel = (value: string | null) =>
  value === "S" ? "S（小）" : value === "L" ? "L（大）" : (value ?? "共通");

export function EquipmentManager({
  models,
  devices,
  onChanged,
}: {
  models: EquipmentModel[];
  devices: Device[];
  onChanged: () => Promise<void>;
}) {
  const [rows, setRows] = useState(models);
  const [addingCategory, setAddingCategory] = useState<Category | null>(null);
  const [newItem, setNewItem] = useState({
    equipmentName: "",
    modelNumber: "",
    quantity: 1,
    halCapacityPerUnit: 1,
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingSave, setPendingSave] = useState<EquipmentModel | null>(null);
  const totals = useMemo(
    () => ({
      hal: rows
        .filter((item) => item.category === "hal")
        .reduce((sum, item) => sum + Number(item.quantity), 0),
      treadmill: rows
        .filter((item) => item.category === "treadmill")
        .reduce((sum, item) => sum + Number(item.quantity), 0),
      bench: rows
        .filter((item) => item.category === "bench")
        .reduce((sum, item) => sum + Number(item.quantity), 0),
    }),
    [rows],
  );

  function changeRow(
    id: string,
    field:
      | "equipment_name"
      | "model_number"
      | "quantity"
      | "hal_capacity_per_unit",
    value: string | number,
  ) {
    setRows((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  }
  function changeQuantity(id: string, delta: number) {
    setRows((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.min(
                999,
                Math.max(0, Number(item.quantity) + delta),
              ),
            }
          : item,
      ),
    );
  }
  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  async function saveRow(row: EquipmentModel) {
    setSavingId(row.id);
    setError("");
    try {
      const response = await fetch("/api/equipment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          equipmentName: row.equipment_name,
          modelNumber: row.model_number,
          quantity: Number(row.quantity),
          halCapacityPerUnit: Number(row.hal_capacity_per_unit),
          note: row.note ?? "",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "保存できませんでした。");
      setRows((current) =>
        current.map((item) => (item.id === row.id ? body.equipment : item)),
      );
      showNotice(
        body.bookingUpdate?.message ??
          `${categoryMeta[row.category].singular}を保存し、予約可能枠を更新しました`,
      );
      setPendingSave(null);
      await onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "保存できませんでした。",
      );
    } finally {
      setSavingId(null);
    }
  }

  function startAdding(category: Category) {
    setAddingCategory(category);
    setNewItem({
      equipmentName: "",
      modelNumber: "",
      quantity: 1,
      halCapacityPerUnit: category === "bench" ? 2 : 1,
    });
    setError("");
  }
  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    if (!addingCategory) return;
    setSavingId("new");
    setError("");
    try {
      const response = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: addingCategory,
          ...newItem,
          note: "",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "登録できませんでした。");
      setRows((current) => [...current, body.equipment]);
      showNotice(
        body.bookingUpdate?.message ??
          `${categoryMeta[addingCategory].singular}を登録し、予約可能枠を更新しました`,
      );
      setAddingCategory(null);
      await onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "登録できませんでした。",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black tracking-[0.15em] text-[#087f71]">
            EQUIPMENT MASTER
          </p>
          <h2 className="text-2xl font-black tracking-[-0.04em]">機材管理</h2>
          <p className="mt-1 text-xs text-[#71858a]">
            機種・型番を登録し、施設内の保有台数を編集できます。
          </p>
        </div>
        <span className="rounded-full border border-[#dce8e5] bg-white px-3 py-2 text-xs font-bold text-[#60777c]">
          ぐんま拠点の機材マスタ
        </span>
      </div>
      <div className="mb-4 flex gap-3 rounded-2xl border border-[#e8cf83] bg-[#fff8df] p-4 text-[#72581b]">
        <CalendarSync size={22} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-black">予約機能と自動連動します</p>
          <p className="mt-1 text-xs font-bold leading-5">
            保存後、顧客・施設の予約可能枠をすぐに再計算します。既存予約に影響し、予約が消える可能性がある変更は保存できません。先に予約を変更してから機材変更してください。
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(categoryMeta) as Category[]).map((category) => {
          const meta = categoryMeta[category];
          const Icon = meta.icon;
          return (
            <div
              key={category}
              className="rounded-[20px] border border-[#dce8e5] bg-white p-4 md:p-5"
            >
              <div
                className={`grid size-10 place-items-center rounded-xl ${meta.tone}`}
              >
                <Icon size={20} />
              </div>
              <p className="mt-4 text-xs font-bold text-[#71858a]">
                {meta.label}
              </p>
              <p className="mt-1 text-3xl font-black tracking-[-0.05em]">
                {totals[category]}
                <span className="ml-1 text-sm text-[#829397]">台</span>
              </p>
            </div>
          );
        })}
      </div>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]"
        >
          {error}
        </div>
      )}
      <section className="mt-5 rounded-[24px] border border-[#dce8e5] bg-white p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black">HAL個体管理</h3>
            <p className="mt-1 text-xs text-[#71858a]">
              機材写真・装着部位・サイズ・使用回数・点検状態
            </p>
          </div>
          <span className="rounded-full bg-[#e7f5f1] px-3 py-1 text-xs font-black text-[#087f71]">
            {devices.length}個体
          </span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {devices.map((device) => {
            const ready = device.status === "available";
            return (
              <div
                key={device.id}
                className="overflow-hidden rounded-[20px] border border-[#dce8e5] bg-white"
              >
                <div className="relative aspect-[4/3] bg-[#f5f8f7] p-3">
                  {device.image_url ? (
                    <Image
                      src={withBasePath(device.image_url)}
                      alt={`${modelLabel[device.model_type]} ${sizeLabel(device.size_label)}の機材写真`}
                      fill
                      sizes="(min-width:1280px) 240px, (min-width:768px) 45vw, 90vw"
                      className="object-contain p-3"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[#087f71]">
                      <Activity size={38} />
                    </div>
                  )}
                  <span
                    className={`absolute right-2 top-2 z-10 rounded-full px-2.5 py-1 text-[10px] font-black shadow-sm ${ready ? "bg-[#e7f5f1] text-[#087f71]" : "bg-[#fff0df] text-[#a7650b]"}`}
                  >
                    {ready ? "利用可能" : "点検中"}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-lg font-black">
                        {device.asset_code}
                      </h4>
                      <p className="mt-1 text-xs font-bold text-[#087f71]">
                        {modelLabel[device.model_type]}
                      </p>
                    </div>
                    <span className="rounded-lg bg-[#edf4f2] px-2 py-1 text-[11px] font-black">
                      {sizeLabel(device.size_label)}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-[#71858a]">
                    {device.model_number}・装着部位{" "}
                    {bodyPartLabel[device.body_part ?? ""] ?? "共通"}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Gauge size={15} className="text-[#087f71]" />
                    <b>使用 {device.usage_count}回</b>
                  </div>
                  <p className="mt-3 truncate text-[10px] text-[#92a1a4]">
                    S/N {device.serial_number}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="mt-5 space-y-5">
        {(Object.keys(categoryMeta) as Category[]).map((category) => {
          const meta = categoryMeta[category];
          const Icon = meta.icon;
          const categoryRows = rows.filter(
            (item) => item.category === category,
          );
          return (
            <section
              key={category}
              className="overflow-hidden rounded-[24px] border border-[#dce8e5] bg-white"
            >
              <header className="flex items-center justify-between gap-3 border-b border-[#e2ebe9] px-4 py-4 md:px-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`grid size-10 place-items-center rounded-xl ${meta.tone}`}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-black">{meta.label}</h3>
                    <p className="text-[11px] text-[#819397]">
                      {categoryRows.length}機種・合計{totals[category]}台
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => startAdding(category)}
                  className="flex items-center gap-2 rounded-xl bg-[#173b42] px-3.5 py-2.5 text-xs font-black text-white"
                >
                  <PackagePlus size={16} /> 機種を登録
                </button>
              </header>
              <div className="divide-y divide-[#e8efed]">
                {categoryRows.map((row) => (
                  <div
                    key={row.id}
                    className={`grid items-end gap-3 p-4 md:px-6 ${category === "hal" ? "md:grid-cols-[1.4fr_1fr_170px_96px]" : "md:grid-cols-[1.25fr_1fr_150px_190px_96px]"}`}
                  >
                    <label className="text-[11px] font-bold text-[#71858a]">
                      機材名
                      <input
                        value={row.equipment_name}
                        onChange={(event) =>
                          changeRow(
                            row.id,
                            "equipment_name",
                            event.target.value,
                          )
                        }
                        className="mt-1.5 w-full rounded-xl border border-[#d5e2df] bg-[#f9fbfa] px-3 py-2.5 text-sm font-bold text-[#18313a]"
                      />
                    </label>
                    <label className="text-[11px] font-bold text-[#71858a]">
                      機種・型番
                      <input
                        value={row.model_number}
                        onChange={(event) =>
                          changeRow(row.id, "model_number", event.target.value)
                        }
                        className="mt-1.5 w-full rounded-xl border border-[#d5e2df] bg-[#f9fbfa] px-3 py-2.5 text-sm font-bold text-[#18313a]"
                      />
                    </label>
                    <div>
                      <span className="text-[11px] font-bold text-[#71858a]">
                        登録台数
                      </span>
                      <div className="mt-1.5 grid grid-cols-[38px_1fr_38px] overflow-hidden rounded-xl border border-[#d5e2df] bg-white">
                        <button
                          aria-label={`${row.equipment_name}を1台減らす`}
                          onClick={() => changeQuantity(row.id, -1)}
                          className="grid place-items-center bg-[#f1f6f5] text-[#58716f]"
                        >
                          <Minus size={15} />
                        </button>
                        <input
                          aria-label={`${row.equipment_name}の登録台数`}
                          inputMode="numeric"
                          min="0"
                          max="999"
                          type="number"
                          value={row.quantity}
                          onChange={(event) =>
                            changeRow(
                              row.id,
                              "quantity",
                              Number(event.target.value),
                            )
                          }
                          className="min-w-0 px-2 py-2.5 text-center font-black outline-none"
                        />
                        <button
                          aria-label={`${row.equipment_name}を1台増やす`}
                          onClick={() => changeQuantity(row.id, 1)}
                          className="grid place-items-center bg-[#f1f6f5] text-[#087f71]"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                    {category !== "hal" && (
                      <label className="text-[11px] font-bold text-[#71858a]">
                        1台あたり使用可能HAL台数
                        <input
                          aria-label={`${row.equipment_name}の使用可能HAL台数`}
                          type="number"
                          min="1"
                          max="20"
                          value={row.hal_capacity_per_unit}
                          onChange={(event) =>
                            changeRow(
                              row.id,
                              "hal_capacity_per_unit",
                              Number(event.target.value),
                            )
                          }
                          className="mt-1.5 w-full rounded-xl border border-[#d5e2df] bg-[#f9fbfa] px-3 py-2.5 text-center font-black"
                        />
                      </label>
                    )}
                    <button
                      disabled={savingId === row.id}
                      onClick={() => setPendingSave(row)}
                      className="flex h-[43px] items-center justify-center gap-1.5 rounded-xl bg-[#087f71] text-xs font-black text-white disabled:bg-[#aac6c1]"
                    >
                      <Save size={15} />
                      {savingId === row.id ? "保存中" : "保存"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {pendingSave && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#09262c]/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setPendingSave(null)
          }
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="equipment-save-title"
            className="w-full max-w-lg rounded-[26px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fff0df] text-[#a7650b]">
                <AlertTriangle size={23} />
              </div>
              <div>
                <h3 id="equipment-save-title" className="text-xl font-black">
                  機材変更と予約への影響を確認
                </h3>
                <p className="mt-2 text-sm font-bold leading-6 text-[#687d84]">
                  「{pendingSave.equipment_name}
                  」を保存すると、予約可能枠の更新を実行します。
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-[#fff8df] p-4 text-sm font-bold leading-6 text-[#72581b]">
              既存予約に影響して予約が消える場合、この変更は保存されません。予約を変更してから機材変更してください。
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setPendingSave(null)}
                className="min-h-12 rounded-xl border border-[#d7e4e1] font-black"
              >
                戻る
              </button>
              <button
                disabled={savingId === pendingSave.id}
                onClick={() => saveRow(pendingSave)}
                className="min-h-12 rounded-xl bg-[#087f71] font-black text-white disabled:bg-[#aac6c1]"
              >
                {savingId === pendingSave.id ? "更新中…" : "確認して保存"}
              </button>
            </div>
          </section>
        </div>
      )}
      {addingCategory && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#09262c]/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setAddingCategory(null)
          }
        >
          <form
            onSubmit={createItem}
            className="w-full max-w-lg rounded-[26px] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black tracking-wider text-[#087f71]">
                  NEW EQUIPMENT
                </p>
                <h3 className="mt-1 text-2xl font-black">
                  {categoryMeta[addingCategory].singular}を登録
                </h3>
              </div>
              <button
                type="button"
                aria-label="閉じる"
                onClick={() => setAddingCategory(null)}
                className="grid size-10 place-items-center rounded-full bg-[#eef4f2]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-bold text-[#687d84]">
                機材名
                <input
                  autoFocus
                  required
                  value={newItem.equipmentName}
                  onChange={(event) =>
                    setNewItem({
                      ...newItem,
                      equipmentName: event.target.value,
                    })
                  }
                  placeholder={
                    addingCategory === "hal"
                      ? "例：自立支援用HAL 下肢タイプ"
                      : addingCategory === "treadmill"
                        ? "例：免荷式トレッドミル"
                        : "例：昇降式トレーニングベンチ"
                  }
                  className="mt-2 w-full rounded-xl border border-[#d5e2df] px-4 py-3 text-sm font-bold"
                />
              </label>
              <label className="block text-xs font-bold text-[#687d84]">
                機種・型番
                <input
                  required
                  value={newItem.modelNumber}
                  onChange={(event) =>
                    setNewItem({ ...newItem, modelNumber: event.target.value })
                  }
                  placeholder="機種名または管理用の型番"
                  className="mt-2 w-full rounded-xl border border-[#d5e2df] px-4 py-3 text-sm font-bold"
                />
              </label>
              <label className="block text-xs font-bold text-[#687d84]">
                登録台数
                <input
                  required
                  type="number"
                  min="0"
                  max="999"
                  value={newItem.quantity}
                  onChange={(event) =>
                    setNewItem({
                      ...newItem,
                      quantity: Number(event.target.value),
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-[#d5e2df] px-4 py-3 text-lg font-black"
                />
              </label>
              {addingCategory !== "hal" && (
                <label className="block text-xs font-bold text-[#687d84]">
                  1台あたり使用可能HAL台数
                  <input
                    required
                    type="number"
                    min="1"
                    max="20"
                    value={newItem.halCapacityPerUnit}
                    onChange={(event) =>
                      setNewItem({
                        ...newItem,
                        halCapacityPerUnit: Number(event.target.value),
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-[#d5e2df] px-4 py-3 text-lg font-black"
                  />
                  <span className="mt-1 block text-[10px] text-[#819397]">
                    {addingCategory === "treadmill"
                      ? "下肢タイプは予約1件につき1枠を使用"
                      : "腰タイプが同時に使用できる上限"}
                  </span>
                </label>
              )}
            </div>
            {error && (
              <p className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]">
                {error}
              </p>
            )}
            <button
              disabled={savingId === "new"}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#087f71] py-4 font-black text-white disabled:bg-[#aac6c1]"
            >
              <Plus size={18} />
              {savingId === "new" ? "登録しています…" : "登録する"}
            </button>
          </form>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="fixed right-5 top-20 z-50 flex items-center gap-2 rounded-full bg-[#173b42] px-5 py-3 text-sm font-black text-white shadow-xl"
        >
          <Check size={17} className="text-[#8de3d2]" />
          {notice}
        </div>
      )}
    </div>
  );
}
