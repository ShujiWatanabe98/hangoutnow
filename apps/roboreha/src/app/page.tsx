import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Database, ShieldCheck, Smartphone, Tablet, UserPlus } from "lucide-react";
import { Brand } from "@/components/brand";

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Brand />
          <span className="rounded-full border border-[#cfe3de] bg-white px-3 py-1.5 text-xs font-bold text-[#087f71]">MVP / DEMO</span>
        </header>

        <section className="grid items-center gap-10 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#dff4ed] px-3.5 py-2 text-xs font-bold text-[#08675f]">
              <CheckCircle2 size={15} /> 顧客・予約・HAL・安全をひとつに
            </div>
            <h1 className="max-w-3xl text-[clamp(2.4rem,6vw,5rem)] font-black leading-[1.06] tracking-[-0.055em] text-[#17353d]">
              一人ひとりの<br /><span className="text-[#087f71]">「もう一歩」</span>を<br />つなぐ基幹システム。
            </h1>
            <p className="mt-7 max-w-xl text-base font-medium leading-8 text-[#63777d] sm:text-lg">
              顧客はスマートフォンから予約を確認。施設スタッフはiPadで受付、安全確認、HAL機器の割当まで一貫して管理できます。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Link href="/customer/register" className="group rounded-[28px] border-2 border-[#9fd5ca] bg-[#effaf7] p-6 shadow-[0_18px_60px_rgba(32,74,70,.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_70px_rgba(32,74,70,.13)]">
              <div className="flex items-start justify-between">
                <div className="grid size-12 place-items-center rounded-2xl bg-[#087f71] text-white"><UserPlus size={25} /></div>
                <ArrowRight className="text-[#7ba9a1] transition group-hover:translate-x-1 group-hover:text-[#087f71]" />
              </div>
              <p className="mt-6 text-xs font-black tracking-[.12em] text-[#087f71]">はじめての方</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">顧客スマホ登録</h2>
              <p className="mt-2 text-sm leading-6 text-[#687d84]">基本情報を登録し、受付番号を発行します。</p>
            </Link>
            <Link href="/customer" className="group rounded-[28px] border border-[#d7e7e3] bg-white p-6 shadow-[0_18px_60px_rgba(32,74,70,.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_70px_rgba(32,74,70,.13)]">
              <div className="flex items-start justify-between">
                <div className="grid size-12 place-items-center rounded-2xl bg-[#dff4ed] text-[#087f71]"><Smartphone size={25} /></div>
                <ArrowRight className="text-[#9eb1ad] transition group-hover:translate-x-1 group-hover:text-[#087f71]" />
              </div>
              <h2 className="mt-8 text-2xl font-black tracking-[-0.03em]">顧客スマホ</h2>
              <p className="mt-2 text-sm leading-6 text-[#687d84]">次回予約、回数券、空き枠予約をわかりやすく。</p>
            </Link>
            <Link href="/facility" className="group rounded-[28px] bg-[#17353d] p-6 text-white shadow-[0_18px_60px_rgba(21,50,58,.2)] transition hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div className="grid size-12 place-items-center rounded-2xl bg-white/10 text-[#8de3d2]"><Tablet size={25} /></div>
                <ArrowRight className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white" />
              </div>
              <h2 className="mt-8 text-2xl font-black tracking-[-0.03em]">施設iPad</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">本日の予約、バイタル判定、HAL稼働を俯瞰。</p>
            </Link>
            <Link href="/admin" className="group rounded-[28px] bg-[#263b63] p-6 text-white shadow-[0_18px_60px_rgba(31,48,83,.18)] transition hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div className="grid size-12 place-items-center rounded-2xl bg-white/10 text-[#b9c8ff]"><ShieldCheck size={25} /></div>
                <ArrowRight className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white" />
              </div>
              <h2 className="mt-8 text-2xl font-black tracking-[-0.03em]">admin</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">全センターの運営、機器、利用実績と改善傾向を確認。</p>
            </Link>
          </div>
        </section>

        <section className="grid gap-3 border-t border-[#dce8e5] py-6 text-sm text-[#657a80] sm:grid-cols-3">
          <div className="flex items-center gap-2"><Database size={17} className="text-[#087f71]" /> PostgreSQL</div>
          <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#087f71]" /> 三者重複をDBで防止</div>
          <div className="flex items-center gap-2"><Building2 size={17} className="text-[#087f71]" /> 拠点IDによる論理分離</div>
        </section>
      </div>
    </main>
  );
}
