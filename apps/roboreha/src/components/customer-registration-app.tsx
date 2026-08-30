"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ClipboardList, LockKeyhole, Phone, UserPlus } from "lucide-react";
import { Brand } from "./brand";
import { RotatingTextSuggestions, appendSuggestion } from "./rotating-text-suggestions";
import { DIAGNOSIS_OPTIONS } from "@/lib/rehab-text-suggestions";

type FormData = {
  familyName: string;
  givenName: string;
  familyNameKana: string;
  givenNameKana: string;
  birthDate: string;
  phone: string;
  email: string;
  postalCode: string;
  address: string;
  diagnosisName: string;
  primaryCondition: string;
  goal: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  consentPrivacy: boolean;
  consentContact: boolean;
};

type Registration = { id: string; customerId: string; customerCode: string; name: string; submittedAt: string };

const initialForm: FormData = {
  familyName: "", givenName: "", familyNameKana: "", givenNameKana: "", birthDate: "",
  phone: "", email: "", postalCode: "", address: "", diagnosisName: "", primaryCondition: "", goal: "",
  emergencyName: "", emergencyRelation: "", emergencyPhone: "", consentPrivacy: false, consentContact: true,
};

const steps = ["基本情報", "連絡先", "ご利用目的", "緊急連絡先", "内容確認"];
const todayString = new Date().toISOString().slice(0, 10);

export function CustomerRegistrationApp() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [postalStatus, setPostalStatus] = useState("");
  const [symptomSuggestions, setSymptomSuggestions] = useState<string[]>([]);
  const [goalSuggestions, setGoalSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const lastAutoAddress = useRef("");

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const postalCode = form.postalCode.replace(/\D/g, "");
    if (postalCode.length !== 7) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPostalStatus("住所を検索中…");
      try {
        const response = await fetch(`/api/postal-code?postalCode=${postalCode}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "住所を検索できませんでした。");
        setForm((current) => {
          if (current.address.trim() && current.address !== lastAutoAddress.current) return current;
          lastAutoAddress.current = body.address;
          return { ...current, address: body.address };
        });
        setPostalStatus("住所を自動入力しました。番地・建物名を追記してください。");
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setPostalStatus(reason instanceof Error ? reason.message : "住所を検索できませんでした。住所は手入力できます。");
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form.postalCode]);

  useEffect(() => {
    if (step !== 2 || !form.diagnosisName) return;
    const controller = new AbortController();
    const load = async () => {
      setSuggestionsLoading(true);
      return Promise.all(["registration_symptom", "registration_goal"].map(async (context) => {
      const response = await fetch("/api/text-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, diagnosisName: form.diagnosisName, birthDate: form.birthDate }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "入力候補を作成できませんでした。");
        return body.suggestions as string[];
      }));
    };
    load().then(([symptoms, goals]) => {
      setSymptomSuggestions(symptoms);
      setGoalSuggestions(goals);
    }).catch((reason) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "入力候補を作成できませんでした。");
    }).finally(() => setSuggestionsLoading(false));
    return () => controller.abort();
  }, [form.birthDate, form.diagnosisName, step]);

  function validateCurrentStep() {
    if (step === 0 && (!form.familyName.trim() || !form.givenName.trim() || !form.familyNameKana.trim() || !form.givenNameKana.trim() || !form.birthDate)) {
      return "お名前、フリガナ、生年月日を入力してください。";
    }
    if (step === 0 && (form.birthDate < "1900-01-01" || form.birthDate > todayString)) return "生年月日は1900年から本日までの日付で入力してください。";
    if (step === 1 && !/^[0-9０-９+＋()（）\-ー\s]{8,24}$/.test(form.phone)) return "電話番号を正しく入力してください。";
    if (step === 1 && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "メールアドレスを正しく入力してください。";
    if (step === 2 && !form.diagnosisName) return "診断名を選択してください。";
    if (step === 3 && (!form.emergencyName.trim() || !form.emergencyRelation.trim() || !/^[0-9０-９+＋()（）\-ー\s]{8,24}$/.test(form.emergencyPhone))) {
      return "緊急連絡先のお名前、続柄、電話番号を入力してください。";
    }
    if (step === 3 && !form.consentPrivacy) return "個人情報の取扱いを確認し、同意してください。";
    return "";
  }

  function next() {
    const message = validateCurrentStep();
    if (message) { setError(message); return; }
    setError("");
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/customer-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "登録を完了できませんでした。");
      setRegistration(body.registration);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登録を完了できませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  if (registration) return <RegistrationComplete registration={registration} />;

  return (
    <main className="min-h-screen bg-[#edf6f3] px-3 py-3 text-[#17353d] sm:px-5 sm:py-6">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[28px] bg-white shadow-[0_20px_70px_rgba(27,73,68,.12)]">
        <header className="border-b border-[#dce8e5] px-5 py-4 sm:px-7">
          <div className="flex items-center justify-between gap-3">
            <Brand />
            <Link href="/" className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-black text-[#087f71]"><ChevronLeft size={19} />入口へ</Link>
          </div>
        </header>

        <section className="bg-[#17353d] px-5 py-6 text-white sm:px-7">
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#8de3d2] text-[#17353d]"><UserPlus size={25} /></div>
            <div><p className="text-xs font-black tracking-[.12em] text-[#8de3d2]">NEW CUSTOMER</p><h1 className="text-2xl font-black">顧客スマホ登録</h1></div>
          </div>
          <p className="mt-3 text-base leading-7 text-white/75">はじめてご利用になる方の登録画面です。約3分で入力できます。</p>
        </section>

        <nav aria-label="登録手順" className="border-b border-[#dce8e5] px-4 py-4 sm:px-7">
          <div className="flex items-center gap-1.5">
            {steps.map((label, index) => <div key={label} className="flex flex-1 items-center gap-1.5">
              <span aria-current={step === index ? "step" : undefined} className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${index < step ? "bg-[#087f71] text-white" : index === step ? "bg-[#17353d] text-white" : "bg-[#e7eeec] text-[#829397]"}`}>{index < step ? <Check size={16} /> : index + 1}</span>
              {index < steps.length - 1 && <span className={`h-1 flex-1 rounded-full ${index < step ? "bg-[#087f71]" : "bg-[#e7eeec]"}`} />}
            </div>)}
          </div>
          <p className="mt-2 text-center text-sm font-black">{step + 1} / 5　{steps[step]}</p>
        </nav>

        <div className="px-5 py-6 sm:px-7">
          {step === 0 && <section aria-labelledby="step-title">
            <StepTitle title="基本情報" description="お名前と生年月日を入力してください。" />
            <div className="mt-5 grid grid-cols-2 gap-3"><Input label="姓" value={form.familyName} onChange={(value) => update("familyName", value)} placeholder="山田" autoComplete="family-name" required /><Input label="名" value={form.givenName} onChange={(value) => update("givenName", value)} placeholder="太郎" autoComplete="given-name" required /></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><Input label="セイ" value={form.familyNameKana} onChange={(value) => update("familyNameKana", value)} placeholder="ヤマダ" required /><Input label="メイ" value={form.givenNameKana} onChange={(value) => update("givenNameKana", value)} placeholder="タロウ" required /></div>
            <div className="mt-4"><Input label="生年月日" type="date" min="1900-01-01" max={todayString} value={form.birthDate} onChange={(value) => update("birthDate", value)} autoComplete="bday" required /></div>
          </section>}

          {step === 1 && <section aria-labelledby="step-title">
            <StepTitle title="連絡先" description="施設からご連絡できる情報を入力してください。" />
            <div className="mt-5 space-y-4"><Input label="電話番号" type="tel" inputMode="tel" value={form.phone} onChange={(value) => update("phone", value)} placeholder="090-1234-5678" autoComplete="tel" required /><Input label="メールアドレス（任意）" type="email" inputMode="email" value={form.email} onChange={(value) => update("email", value)} placeholder="example@example.jp" autoComplete="email" /><div><Input label="郵便番号（任意）" inputMode="numeric" value={form.postalCode} onChange={(value) => { setPostalStatus(""); update("postalCode", value); }} placeholder="371-0000" autoComplete="postal-code" />{postalStatus && <p role="status" className="mt-2 text-sm font-bold text-[#087f71]">{postalStatus}</p>}</div><Area label="住所（任意）" value={form.address} onChange={(value) => update("address", value)} placeholder="群馬県前橋市…" autoComplete="street-address" /></div>
          </section>}

          {step === 2 && <section aria-labelledby="step-title">
            <StepTitle title="ご利用について" description="診断名を選ぶと、生年月日と施設の過去記録をもとに入力候補を表示します。" />
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-black">診断名<span className="ml-2 rounded-md bg-[#fff0ed] px-1.5 py-0.5 text-[10px] text-[#bd4f3f]">必須</span><select value={form.diagnosisName} onChange={(event) => { setSymptomSuggestions([]); setGoalSuggestions([]); update("diagnosisName", event.target.value); }} className="mt-2 min-h-13 w-full rounded-xl border-2 border-[#d7e4e1] bg-white px-3 text-base outline-none focus:border-[#087f71] focus:ring-4 focus:ring-[#dff4ed]"><option value="">診断名を選択してください</option>{DIAGNOSIS_OPTIONS.map((diagnosis) => <option key={diagnosis} value={diagnosis}>{diagnosis}</option>)}</select></label>
              <div><Area label="現在の症状（任意）" value={form.primaryCondition} onChange={(value) => update("primaryCondition", value)} placeholder="歩くときに困っていることを入力してください" /><div className="mt-2"><RotatingTextSuggestions suggestions={form.diagnosisName ? symptomSuggestions : []} loading={suggestionsLoading && Boolean(form.diagnosisName)} onSelect={(candidate) => update("primaryCondition", appendSuggestion(form.primaryCondition, candidate))} /></div></div>
              <div><Area label="HALを使って実現したいこと（任意）" value={form.goal} onChange={(value) => update("goal", value)} placeholder="できるようになりたい生活動作を入力してください" /><div className="mt-2"><RotatingTextSuggestions suggestions={form.diagnosisName ? goalSuggestions : []} loading={suggestionsLoading && Boolean(form.diagnosisName)} onSelect={(candidate) => update("goal", appendSuggestion(form.goal, candidate))} /></div></div>
            </div>
            <p className="mt-3 rounded-xl bg-[#f5f8f7] p-3 text-xs leading-5 text-[#60777c]">候補は入力支援用であり、診断や医学的判断を行うものではありません。内容はご本人と療法士が確認します。</p>
            <div className="mt-5 flex gap-3 rounded-2xl bg-[#eff7f5] p-4 text-sm leading-6 text-[#526d72]"><ClipboardList className="mt-0.5 shrink-0 text-[#087f71]" size={21} /><p>詳しい体調や安全確認は、登録後の「初診問診」で入力できます。</p></div>
          </section>}

          {step === 3 && <section aria-labelledby="step-title">
            <StepTitle title="緊急連絡先・同意" description="安全なご利用のため、緊急時の連絡先を登録してください。" />
            <div className="mt-5 space-y-4"><Input label="緊急連絡先のお名前" value={form.emergencyName} onChange={(value) => update("emergencyName", value)} placeholder="山田 花子" required /><Input label="続柄" value={form.emergencyRelation} onChange={(value) => update("emergencyRelation", value)} placeholder="配偶者、子など" required /><Input label="緊急連絡先の電話番号" type="tel" inputMode="tel" value={form.emergencyPhone} onChange={(value) => update("emergencyPhone", value)} placeholder="090-9876-5432" required /></div>
            <div className="mt-5 space-y-3"><CheckField checked={form.consentPrivacy} onChange={(value) => update("consentPrivacy", value)} required>個人情報を施設で安全に管理し、利用登録とサービス提供に使用することに同意します。</CheckField><CheckField checked={form.consentContact} onChange={(value) => update("consentContact", value)}>予約や初回利用の案内を電話またはメールで受け取ります。</CheckField></div>
          </section>}

          {step === 4 && <section aria-labelledby="step-title">
            <StepTitle title="登録内容の確認" description="内容を確認し、「この内容で登録する」を押してください。" />
            <div className="mt-5 space-y-3"><Review title="お名前" value={`${form.familyName} ${form.givenName}（${form.familyNameKana} ${form.givenNameKana}）`} edit={() => setStep(0)} /><Review title="生年月日" value={formatDate(form.birthDate)} edit={() => setStep(0)} /><Review title="連絡先" value={[form.phone, form.email, form.postalCode, form.address].filter(Boolean).join("\n")} edit={() => setStep(1)} /><Review title="診断名・現在の症状・目標" value={[form.diagnosisName, form.primaryCondition, form.goal].filter(Boolean).join("\n") || "未入力"} edit={() => setStep(2)} /><Review title="緊急連絡先" value={`${form.emergencyName}（${form.emergencyRelation}）\n${form.emergencyPhone}`} edit={() => setStep(3)} /></div>
            <div className="mt-5 flex gap-3 rounded-2xl bg-[#fff7df] p-4 text-sm leading-6 text-[#6e5a20]"><LockKeyhole className="mt-0.5 shrink-0" size={21} /><p>登録後、受付番号を発行します。マイページの利用方法は施設からご案内します。</p></div>
          </section>}

          {error && <p role="alert" className="mt-5 rounded-2xl bg-[#fff0ed] p-4 text-base font-bold leading-6 text-[#b94637]">{error}</p>}

          <div className="mt-6 flex gap-3">
            {step > 0 && <button type="button" onClick={() => { setError(""); setStep((current) => current - 1); }} className="flex min-h-14 flex-1 items-center justify-center gap-1 rounded-2xl border-2 border-[#cbded9] bg-white text-base font-black"><ArrowLeft size={20} />戻る</button>}
            {step < 4 ? <button type="button" onClick={next} className="flex min-h-14 flex-[1.5] items-center justify-center gap-2 rounded-2xl bg-[#087f71] text-base font-black text-white shadow-[0_10px_24px_rgba(8,127,113,.2)]">次へ進む<ArrowRight size={20} /></button> : <button type="button" disabled={submitting} onClick={submit} className="flex min-h-14 flex-[1.7] items-center justify-center gap-2 rounded-2xl bg-[#087f71] px-3 text-base font-black text-white disabled:bg-[#9abeb8]">{submitting ? "登録しています…" : "この内容で登録する"}<CheckCircle2 size={20} /></button>}
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-[#71858a]">入力内容は、ぐんまロボケアセンターの利用登録に使用します。</p>
        </div>
      </div>
    </main>
  );
}

function RegistrationComplete({ registration }: { registration: Registration }) {
  return <main className="grid min-h-screen place-items-center bg-[#edf6f3] p-4 text-[#17353d]"><section className="w-full max-w-lg rounded-[30px] bg-white p-6 text-center shadow-[0_20px_70px_rgba(27,73,68,.12)] sm:p-8">
    <div className="mx-auto grid size-20 place-items-center rounded-full bg-[#dff4ed] text-[#087f71]"><CheckCircle2 size={45} strokeWidth={2.5} /></div>
    <p className="mt-5 text-xs font-black tracking-[.12em] text-[#087f71]">REGISTRATION COMPLETE</p><h1 className="mt-1 text-3xl font-black">登録が完了しました</h1><p className="mt-3 text-base leading-7 text-[#60777c]">{registration.name} 様、ご登録ありがとうございます。</p>
    <div className="mt-6 rounded-2xl border-2 border-[#9fd5ca] bg-[#effaf7] p-5"><p className="text-sm font-bold text-[#60777c]">受付番号</p><p className="mt-1 text-3xl font-black tracking-[.08em] text-[#087f71]">{registration.customerCode}</p><p className="mt-2 text-xs text-[#71858a]">お問い合わせの際にお伝えください</p></div>
    <div className="mt-5 rounded-2xl bg-[#f5f8f7] p-4 text-left"><p className="font-black">次のお手続き</p><p className="mt-1 text-sm leading-6 text-[#60777c]">初診問診を入力すると、当日の受付がスムーズです。マイページの利用方法は施設からご案内します。</p></div>
    <Link href={`/intake?customerId=${registration.customerId}`} className="mt-5 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#087f71] text-base font-black text-white"><ClipboardList size={20} />続けて初診問診へ</Link>
    <Link href="/" className="mt-3 flex min-h-12 items-center justify-center rounded-2xl border border-[#cbded9] text-sm font-black">入口画面へ戻る</Link>
    <a href="tel:027-000-0000" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#087f71]"><Phone size={17} />ぐんまロボケアセンターへ電話</a>
  </section></main>;
}

function StepTitle({ title, description }: { title: string; description: string }) { return <div><h2 id="step-title" className="text-2xl font-black">{title}</h2><p className="mt-1 text-base leading-7 text-[#60777c]">{description}</p><p className="mt-1 text-xs font-bold text-[#bd4f3f]">「必須」は入力が必要です</p></div>; }

type InputProps = { label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: "text" | "tel" | "email" | "numeric"; placeholder?: string; autoComplete?: string; required?: boolean; min?: string; max?: string };
function Input({ label, value, onChange, type = "text", inputMode, placeholder, autoComplete, required, min, max }: InputProps) { return <label className="block text-sm font-black">{label}{required && <span className="ml-2 rounded-md bg-[#fff0ed] px-1.5 py-0.5 text-[10px] text-[#bd4f3f]">必須</span>}<input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} min={min} max={max} className="mt-2 min-h-13 w-full rounded-xl border-2 border-[#d7e4e1] bg-white px-3 text-base outline-none transition focus:border-[#087f71] focus:ring-4 focus:ring-[#dff4ed]" /></label>; }
function Area({ label, value, onChange, placeholder, autoComplete }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; autoComplete?: string }) { return <label className="block text-sm font-black">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} rows={3} className="mt-2 w-full resize-none rounded-xl border-2 border-[#d7e4e1] bg-white p-3 text-base leading-6 outline-none transition focus:border-[#087f71] focus:ring-4 focus:ring-[#dff4ed]" /></label>; }
function CheckField({ checked, onChange, children, required }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode; required?: boolean }) { return <label className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 text-sm font-bold leading-6 ${checked ? "border-[#87cabe] bg-[#effaf7]" : "border-[#d7e4e1] bg-white"}`}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-5 shrink-0 accent-[#087f71]" /><span>{children}{required && <span className="ml-2 text-xs text-[#bd4f3f]">必須</span>}</span></label>; }
function Review({ title, value, edit }: { title: string; value: string; edit: () => void }) { return <div className="rounded-2xl border border-[#dce8e5] p-4"><div className="flex items-start justify-between gap-3"><p className="text-xs font-black text-[#71858a]">{title}</p><button type="button" onClick={edit} className="min-h-11 rounded-lg bg-[#edf5f3] px-3 text-xs font-black text-[#087f71]">修正</button></div><p className="mt-1 whitespace-pre-line text-base font-bold leading-6">{value}</p></div>; }
function formatDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value; const [year, month, day] = value.split("-"); return `${year}年${Number(month)}月${Number(day)}日`; }
