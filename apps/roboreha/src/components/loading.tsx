"use client";

import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { Brand } from "./brand";

export function LoadingScreen({ label = "データを読み込んでいます" }: { label?: string }) {
  return (
    <main aria-busy="true" className="grid min-h-screen place-items-center px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <Brand />
        <LoaderCircle aria-hidden="true" className="animate-spin text-[#087f71]" size={42} />
        <p role="status" className="text-base font-black text-[#526d72]">{label}…</p>
      </div>
    </main>
  );
}

export function InlineLoadingState({ label = "データを読み込んでいます" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-28 items-center justify-center gap-3 rounded-2xl bg-[#f3f7f6] p-6 text-center text-sm font-black text-[#526d72]">
      <LoaderCircle aria-hidden="true" className="shrink-0 animate-spin text-[#087f71]" size={24} />
      <span>{label}…</span>
    </div>
  );
}

export function BlockingProgressOverlay({
  open,
  label,
  detail = "処理が終わるまで、このままお待ちください。",
  progress,
}: {
  open: boolean;
  label: string;
  detail?: string;
  progress?: number;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlayRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);
  if (!open) return null;
  const normalizedProgress = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div
      ref={overlayRef}
      data-testid="blocking-progress-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-busy="true"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={(event) => { if (event.key === "Tab" || event.key === "Escape") event.preventDefault(); }}
      className="fixed inset-0 z-[200] grid cursor-wait place-items-center bg-[#09262c]/70 p-5 backdrop-blur-sm"
    >
      <section className="w-full max-w-sm rounded-[28px] bg-white p-7 text-center shadow-2xl">
        <LoaderCircle aria-hidden="true" className="mx-auto animate-spin text-[#087f71]" size={52} strokeWidth={2.5} />
        <p className="mt-5 text-xl font-black text-[#173b42]">{label}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-[#687d84]">{detail}</p>
        {normalizedProgress != null && (
          <div className="mt-5" aria-label={`進捗 ${normalizedProgress}%`}>
            <div className="h-3 overflow-hidden rounded-full bg-[#dce8e5]">
              <div className="h-full rounded-full bg-[#087f71] transition-[width] duration-200" style={{ width: `${normalizedProgress}%` }} />
            </div>
            <p className="mt-2 text-lg font-black text-[#087f71]">{normalizedProgress}%</p>
          </div>
        )}
      </section>
    </div>
  );
}
