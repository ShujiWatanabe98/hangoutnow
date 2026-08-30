import { Brand } from "./brand";

export function LoadingScreen({ label = "データを読み込んでいます" }: { label?: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="flex flex-col items-center gap-5">
        <Brand />
        <div className="h-1.5 w-44 overflow-hidden rounded-full bg-[#dce8e5]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#087f71]" />
        </div>
        <p className="text-sm font-medium text-[#687d84]">{label}</p>
      </div>
    </main>
  );
}
