"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";

export function appendSuggestion(current: string, suggestion: string) {
  const trimmed = current.trim();
  if (!trimmed) return suggestion;
  if (trimmed.includes(suggestion)) return current;
  return `${trimmed}\n${suggestion}`;
}

export function RotatingTextSuggestions({
  suggestions,
  onSelect,
  loading = false,
  title = "入力候補（タップで追加）",
  description = "選ぶと入力欄へ追加され、次の候補に入れ替わります。",
}: {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  loading?: boolean;
  title?: string;
  description?: string;
}) {
  const fingerprint = suggestions.join("\u0000");
  const [usedBySet, setUsedBySet] = useState<Record<string, string[]>>({});
  const visible = useMemo(() => {
    const used = usedBySet[fingerprint] ?? [];
    return suggestions.filter((suggestion) => !used.includes(suggestion)).slice(0, 3);
  }, [fingerprint, suggestions, usedBySet]);

  return (
    <div className="rounded-2xl border border-[#bcded7] bg-[#effaf7] p-3.5">
      <div className="flex gap-2">
        <Lightbulb className="mt-0.5 shrink-0 text-[#087f71]" size={18} />
        <div>
          <p className="text-sm font-black text-[#176c62]">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-[#60777c]">{description}</p>
        </div>
      </div>
      <div className="mt-2.5 grid gap-2" aria-live="polite" aria-busy={loading}>
        {loading && <p className="rounded-xl bg-white p-3 text-sm font-bold text-[#60777c]">登録情報から候補を作成しています…</p>}
        {!loading && visible.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => {
              onSelect(suggestion);
              setUsedBySet((current) => ({ ...current, [fingerprint]: [...(current[fingerprint] ?? []), suggestion] }));
            }}
            className="min-h-12 rounded-xl border border-[#c8e2dc] bg-white px-3 py-2.5 text-left text-sm font-bold leading-5 text-[#284c52] transition hover:border-[#087f71] hover:bg-[#f7fffd] focus:outline-none focus:ring-4 focus:ring-[#d0eee7]"
          >
            <span className="mr-1 text-[#087f71]">＋</span>{suggestion}
          </button>
        ))}
        {!loading && suggestions.length === 0 && <p className="rounded-xl bg-white p-3 text-sm text-[#60777c]">診断名を選択すると候補を表示します。</p>}
        {!loading && suggestions.length > 0 && visible.length === 0 && <p className="rounded-xl bg-white p-3 text-sm font-bold text-[#60777c]">すべての候補を入力しました。文章は自由に修正できます。</p>}
      </div>
    </div>
  );
}
