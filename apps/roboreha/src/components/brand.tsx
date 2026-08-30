import { Activity } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#087f71] text-white shadow-[0_8px_20px_rgba(8,127,113,.2)]">
        <Activity size={22} strokeWidth={2.4} />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-[18px] font-black tracking-[-0.03em] text-[#18313a]">RoboCare One</div>
          <div className="mt-1 text-[10px] font-bold tracking-[0.16em] text-[#087f71]">POWERED BY CARE</div>
        </div>
      )}
    </div>
  );
}
