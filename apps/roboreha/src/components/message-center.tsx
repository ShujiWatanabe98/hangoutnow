"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCheck, ChevronLeft, MessageCircle, Mic, MicOff, Phone, Search, Send, ShieldCheck, Sparkles, UserRound, Volume2, X } from "lucide-react";

type Message = {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "facility" | "ai";
  sender_name: string;
  body: string;
  sent_at: string;
  read_at: string | null;
};

type Conversation = {
  customer_id: string;
  name: string;
  name_kana: string;
  conversation_id: string | null;
  last_message: string | null;
  sent_at: string | null;
  last_sender_type: "customer" | "facility" | "ai" | null;
  last_read_at: string | null;
  unread_count: number;
};

const messageTime = (value: string) => new Intl.DateTimeFormat("ja-JP", {
  month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tokyo",
}).format(new Date(value));
const readTime = (value: string) => new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tokyo",
}).format(new Date(value));

function Bubble({ message, ownRole }: { message: Message; ownRole: "customer" | "facility" }) {
  const own = message.sender_type === ownRole;
  const ai = message.sender_type === "ai";
  return <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
    <div className={`flex max-w-[84%] items-end gap-1.5 ${own ? "flex-row-reverse" : ""}`}>
      <div className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${own ? "rounded-br-md bg-[#79d9c5] text-[#12363a]" : ai ? "rounded-bl-md border border-[#d9d1f3] bg-[#f8f5ff] text-[#41366f]" : "rounded-bl-md border border-[#dce8e5] bg-white text-[#17353d]"}`}>{ai && <span className="mb-1 flex items-center gap-1 text-[10px] font-black text-[#6d57b5]"><Sparkles size={12} />AI自動応答</span>}{message.body}</div>
      <div className={`mb-0.5 shrink-0 text-[9px] leading-4 text-[#71858a] ${own ? "text-right" : ""}`}>
        {own && <span aria-label={message.read_at ? `既読 ${readTime(message.read_at)}` : "未読"} className={`flex items-center justify-end gap-0.5 font-black ${message.read_at ? "text-[#087f71]" : "text-[#87979a]"}`}><CheckCheck size={11} />{message.read_at ? `既読 ${readTime(message.read_at)}` : "未読"}</span>}
        {messageTime(message.sent_at)}
      </div>
    </div>
  </div>;
}

function Composer({ value, sending, onChange, onSend, large = false, onMic, listening = false }: { value: string; sending: boolean; onChange: (value: string) => void; onSend: (event: FormEvent) => void; large?: boolean; onMic?: () => void; listening?: boolean }) {
  return <form onSubmit={onSend} className="flex items-end gap-2 border-t border-[#dce8e5] bg-white p-3">
    {onMic && <button type="button" onClick={onMic} aria-label={listening ? "音声入力を停止" : "マイクで入力"} className={`grid size-12 shrink-0 place-items-center rounded-full ${listening ? "bg-[#dc6b58] text-white" : "bg-[#eee9ff] text-[#6954b1]"}`}>{listening ? <MicOff size={21} /> : <Mic size={21} />}</button>}
    <textarea aria-label="メッセージを入力" value={value} onChange={(event) => onChange(event.target.value)} maxLength={1000} rows={1} placeholder="メッセージを入力" className={`max-h-28 min-h-12 flex-1 resize-none rounded-2xl border-2 border-[#dce8e5] bg-[#f8fbfa] px-4 py-3 outline-none focus:border-[#68bfae] ${large ? "text-base" : "text-sm"}`} />
    <button type="submit" aria-label="メッセージを送信" disabled={sending || !value.trim()} className="grid size-12 shrink-0 place-items-center rounded-full bg-[#087f71] text-white disabled:bg-[#b9cbc7]"><Send size={21} /></button>
  </form>;
}

export function FacilityMessageCenter({ onUnreadChange }: { onUnreadChange?: (count: number) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    const response = await fetch("/api/messages?role=facility", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "会話を読み込めませんでした。");
    setConversations(body.conversations);
    onUnreadChange?.((body.conversations ?? []).reduce((sum: number, item: Conversation) => sum + Number(item.unread_count ?? 0), 0));
    return body.conversations as Conversation[];
  }, [onUnreadChange]);

  const loadThread = useCallback(async (customerId: string) => {
    const response = await fetch(`/api/messages?role=facility&customerId=${customerId}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "メッセージを読み込めませんでした。");
    setConversations(body.conversations);
    setMessages(body.messages);
    onUnreadChange?.((body.conversations ?? []).reduce((sum: number, item: Conversation) => sum + Number(item.unread_count ?? 0), 0));
  }, [onUnreadChange]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void loadList().catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    const firstLoad = window.setTimeout(() => { void loadThread(selectedId).catch((reason: Error) => setError(reason.message)); }, 0);
    const timer = window.setInterval(() => { void loadThread(selectedId).catch(() => undefined); }, 5000);
    return () => { window.clearTimeout(firstLoad); window.clearInterval(timer); };
  }, [selectedId, loadThread]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages]);

  const filtered = useMemo(() => conversations.filter((item) => `${item.name}${item.name_kana}`.includes(search.trim())), [conversations, search]);
  const selected = conversations.find((item) => item.customer_id === selectedId);
  const totalUnread = conversations.reduce((sum, item) => sum + item.unread_count, 0);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setSending(true); setError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "facility", customerId: selectedId, body: draft }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "送信できませんでした。");
      setDraft(""); await loadThread(selectedId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "送信できませんでした。"); } finally { setSending(false); }
  }

  return <div className="mx-auto max-w-[1400px]">
    <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-black text-[#087f71]">MESSAGES</p><h2 className="text-2xl font-black">利用者メッセージ</h2><p className="mt-1 text-xs text-[#71858a]">利用者からの相談や連絡に返信できます。</p></div>{totalUnread > 0 && <span className="rounded-full bg-[#dc6b58] px-3 py-1 text-xs font-black text-white">未読 {totalUnread}件</span>}</div>
    {error && <p role="alert" className="mb-3 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#bd4f3f]">{error}</p>}
    <section className="flex h-[calc(100vh-150px)] min-h-[560px] max-h-[760px] overflow-hidden rounded-[24px] border border-[#dce8e5] bg-white">
      <aside className={`${selectedId ? "hidden md:flex" : "flex"} w-full flex-col border-r border-[#dce8e5] md:w-[340px]`}>
        <div className="border-b border-[#dce8e5] p-3"><label className="flex min-h-11 items-center gap-2 rounded-xl bg-[#f2f6f5] px-3"><Search size={17} className="text-[#71858a]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="利用者を検索" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></div>
        <div className="flex-1 overflow-y-auto">{filtered.map((item) => <button key={item.customer_id} onClick={() => { setSelectedId(item.customer_id); setError(""); }} className={`flex w-full items-center gap-3 border-b border-[#edf2f1] p-3 text-left ${selectedId === item.customer_id ? "bg-[#e7f5f1]" : "hover:bg-[#f6f9f8]"}`}>
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#d9eeea] font-black text-[#087f71]">{item.name.replace(/\s/g, "").slice(0, 1)}</div>
          <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><b className="text-sm">{item.name}</b>{item.sent_at && <span className="shrink-0 text-[9px] text-[#819397]">{messageTime(item.sent_at)}</span>}</div><div className="mt-1 flex min-w-0 items-center gap-1.5"><p className="min-w-0 flex-1 truncate text-xs text-[#71858a]">{item.last_message ?? "メッセージはまだありません"}</p>{item.last_sender_type === "facility" && <span className={`flex shrink-0 items-center gap-0.5 text-[9px] font-black ${item.last_read_at ? "text-[#087f71]" : "text-[#87979a]"}`}><CheckCheck size={11} />{item.last_read_at ? "既読" : "未読"}</span>}</div></div>
          {item.unread_count > 0 && <span aria-label={`${item.name} 未読 ${item.unread_count}件`} className="shrink-0 rounded-full bg-[#dc6b58] px-2 py-1 text-[10px] font-black text-white">未読 {item.unread_count}件</span>}
        </button>)}{!loading && filtered.length === 0 && <p className="p-8 text-center text-sm font-bold text-[#71858a]">該当する利用者はいません</p>}</div>
      </aside>
      <div className={`${selectedId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-[#edf5f3]`}>
        {selected ? <><header className="flex min-h-16 items-center gap-3 border-b border-[#dce8e5] bg-white px-3"><button aria-label="会話一覧へ戻る" onClick={() => setSelectedId(null)} className="grid size-11 place-items-center rounded-xl bg-[#edf4f2] md:hidden"><ChevronLeft /></button><div className="grid size-10 place-items-center rounded-full bg-[#d9eeea] text-[#087f71]"><UserRound size={20} /></div><div><h3 className="font-black">{selected.name}</h3><p className="text-[10px] text-[#71858a]">利用者とのメッセージ</p></div></header><div aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-3 md:p-5">{messages.length ? messages.map((message) => <Bubble key={message.id} message={message} ownRole="facility" />) : <div className="grid h-full place-items-center text-center text-sm font-bold text-[#71858a]"><div><MessageCircle className="mx-auto mb-3" size={36} /><p>まだメッセージはありません</p><p className="mt-1 text-xs font-normal">下の入力欄から連絡できます。</p></div></div>}<div ref={endRef} /></div><Composer value={draft} sending={sending} onChange={setDraft} onSend={send} /></> : <div className="grid h-full place-items-center text-center text-[#71858a]"><div><MessageCircle className="mx-auto mb-3" size={42} /><p className="font-black">利用者を選択してください</p></div></div>}
      </div>
    </section>
  </div>;
}

export function CustomerMessageCenter({ onUnreadChange }: { onUnreadChange?: (count: number) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [store, setStore] = useState<{ name: string; phone: string }>({ name: "ロボケアセンター", phone: "" });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"facility" | "ai">("facility");
  const [aiInfo, setAiInfo] = useState<{ consented: boolean; notices: string[]; provider: string; model: string } | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consenting, setConsenting] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/messages?role=customer", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "メッセージを読み込めませんでした。");
    setMessages(body.messages); setStore(body.store); onUnreadChange?.(0);
  }, [onUnreadChange]);

  const loadAiInfo = useCallback(async () => {
    const response = await fetch("/api/ai-chat", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "AI自動応答の状態を確認できませんでした。");
    setAiInfo(body);
    return body as { consented: boolean; notices: string[]; provider: string; model: string };
  }, []);

  useEffect(() => {
    let active = true;
    const firstLoad = window.setTimeout(() => { void load().catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); }); }, 0);
    const timer = window.setInterval(() => { void load().catch(() => undefined); }, 5000);
    return () => { active = false; window.clearTimeout(firstLoad); window.clearInterval(timer); };
  }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAiInfo().catch((reason: Error) => setError(reason.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAiInfo]);

  function chooseMode(next: "facility" | "ai") {
    setError(""); setVoiceStatus("");
    if (next === "ai" && !aiInfo?.consented) { setConsentOpen(true); return; }
    setMode(next);
  }

  async function acceptConsent() {
    setConsenting(true); setError("");
    try {
      const response = await fetch("/api/ai-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "consent", accepted: true }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "同意内容を保存できませんでした。");
      await loadAiInfo(); setConsentOpen(false); setMode("ai");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "同意内容を保存できませんでした。"); } finally { setConsenting(false); }
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) { setVoiceStatus("この端末では回答の読み上げを利用できません。"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "ja-JP"; utterance.rate = 0.95; window.speechSynthesis.speak(utterance);
    setVoiceStatus("AIの回答を読み上げています。");
  }

  async function startVoice() {
    if (listening) { recognitionRef.current?.stop(); return; }
    setError(""); setVoiceStatus("マイクの使用許可を確認しています…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("この端末ではマイク入力を利用できません。");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach((track) => track.stop());
      const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!Recognition) throw new Error("このブラウザは日本語の音声認識に対応していません。文字入力をご利用ください。");
      const recognition = new Recognition(); recognitionRef.current = recognition; recognition.lang = "ja-JP"; recognition.continuous = false; recognition.interimResults = false;
      recognition.onstart = () => { setListening(true); setVoiceStatus("お話しください。聞き取り後に文章を確認できます。"); };
      recognition.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript?.trim() ?? ""; if (transcript) { setDraft(transcript); setVoiceDraft(true); setVoiceStatus("聞き取りました。内容を確認して送信してください。"); } };
      recognition.onerror = () => setError("音声を聞き取れませんでした。マイク設定を確認して、もう一度お試しください。");
      recognition.onend = () => { setListening(false); recognitionRef.current = null; };
      recognition.start();
    } catch (reason) { setListening(false); setVoiceStatus(""); setError(reason instanceof Error ? reason.message : "マイクを開始できませんでした。"); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true); setError("");
    try {
      const response = mode === "ai"
        ? await fetch("/api/ai-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ask", question: draft, inputMethod: voiceDraft ? "voice" : "text" }) })
        : await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "customer", body: draft }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "送信できませんでした。");
      const shouldSpeak = mode === "ai" && voiceDraft && body.answer?.body;
      setDraft(""); setVoiceDraft(false); await load();
      if (shouldSpeak) speak(body.answer.body);
      else if (mode === "ai" && body.responseStyle) setVoiceStatus(`会話に合わせて「${body.responseStyle}」で回答しました。`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "送信できませんでした。"); } finally { setSending(false); }
  }

  const lastAiAnswer = [...messages].reverse().find((message) => message.sender_type === "ai")?.body;
  return <section className="overflow-hidden rounded-[26px] bg-white shadow-sm">
    <header className={`flex min-h-[76px] items-center justify-between px-4 text-white ${mode === "ai" ? "bg-[#5c4aa0]" : "bg-[#173b42]"}`}><div className="flex min-w-0 items-center gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-full bg-white/12">{mode === "ai" ? <Bot size={22} /> : <MessageCircle size={22} />}</div><div className="min-w-0"><h2 className="truncate text-lg font-black">{mode === "ai" ? "AIリハビリサポート" : store.name}</h2><p className="text-xs text-white/65">{mode === "ai" ? "記録を参考にした自動応答" : "センターへのご相談・ご連絡"}</p></div></div>{mode === "facility" && store.phone ? <a aria-label="センターへ電話" href={`tel:${store.phone}`} className="grid size-12 shrink-0 place-items-center rounded-full bg-white/12"><Phone size={21} /></a> : lastAiAnswer ? <button aria-label="AIの回答を読み上げる" onClick={() => speak(lastAiAnswer)} className="grid size-12 shrink-0 place-items-center rounded-full bg-white/12"><Volume2 size={21} /></button> : null}</header>
    <div role="tablist" aria-label="問い合わせ方法" className="grid grid-cols-2 gap-1 border-b border-[#dce8e5] bg-white p-2"><button role="tab" aria-selected={mode === "facility"} onClick={() => chooseMode("facility")} className={`min-h-12 rounded-xl text-sm font-black ${mode === "facility" ? "bg-[#173b42] text-white" : "bg-[#f1f5f4] text-[#60777c]"}`}><MessageCircle className="mr-1 inline" size={17} />施設に問い合わせ</button><button role="tab" aria-selected={mode === "ai"} onClick={() => chooseMode("ai")} className={`min-h-12 rounded-xl text-sm font-black ${mode === "ai" ? "bg-[#6954b1] text-white" : "bg-[#f4f0ff] text-[#6954b1]"}`}><Sparkles className="mr-1 inline" size={17} />AI自動応答</button></div>
    {mode === "ai" && <div className="flex items-start gap-2 bg-[#f4f0ff] px-4 py-2 text-[11px] leading-5 text-[#5d4d91]"><ShieldCheck size={17} className="mt-0.5 shrink-0" /><p><b>{aiInfo?.provider === "openai" ? "AIモデル接続" : "安全デモ応答"}</b>・医療判断ではありません。会話の表現から回答の長さや安心感を調整します。急な症状は施設または救急へ連絡してください。</p></div>}
    {error && <p role="alert" className="m-3 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#bd4f3f]">{error}</p>}
    <div aria-live="polite" className="h-[calc(100vh-330px)] min-h-[390px] space-y-3 overflow-y-auto bg-[#edf5f3] p-3">{loading ? <p className="p-8 text-center font-bold text-[#71858a]">メッセージを読み込み中…</p> : messages.length ? messages.map((message) => <Bubble key={message.id} message={message} ownRole="customer" />) : <div className="grid h-full place-items-center text-center text-[#71858a]"><div><MessageCircle className="mx-auto mb-3" size={38} /><p className="font-black">センターへメッセージを送れます</p><p className="mt-1 text-sm">予約や持ち物についてお気軽にご連絡ください。</p></div></div>}<div ref={endRef} /></div>
    {voiceStatus && <p role="status" className="border-t border-[#e8e2fa] bg-[#faf8ff] px-4 py-2 text-center text-xs font-bold text-[#6954b1]">{voiceStatus}</p>}
    <Composer value={draft} sending={sending} onChange={(value) => { setDraft(value); setVoiceDraft(false); }} onSend={send} large onMic={mode === "ai" ? startVoice : undefined} listening={listening} />
    <p className="border-t border-[#edf2f1] px-4 py-2 text-center text-[11px] leading-5 text-[#71858a]">{mode === "ai" ? "音声は保存せず、文字に変換された質問だけを保存します。" : "緊急のご連絡はメッセージではなく、お電話をご利用ください。"}</p>
    {consentOpen && aiInfo && <AiConsentModal notices={aiInfo.notices} saving={consenting} onAccept={acceptConsent} onClose={() => setConsentOpen(false)} />}
  </section>;
}

function AiConsentModal({ notices, saving, onAccept, onClose }: { notices: string[]; saving: boolean; onAccept: () => void; onClose: () => void }) {
  const [checked, setChecked] = useState(false);
  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#17243a]/70 p-3"><section role="dialog" aria-modal="true" aria-labelledby="ai-consent-title" className="mx-auto my-4 w-full max-w-[440px] rounded-[28px] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-[#6954b1]">AI自動応答</p><h2 id="ai-consent-title" className="mt-1 text-2xl font-black">注意事項への同意</h2></div><button aria-label="同意画面を閉じる" onClick={onClose} className="grid size-11 place-items-center rounded-xl bg-[#f1f3f4]"><X /></button></div><p className="mt-3 text-sm leading-6 text-[#60777c]">安全に利用するため、以下を確認してください。</p><ul className="mt-4 space-y-2">{notices.map((notice) => <li key={notice} className="flex gap-2 rounded-xl bg-[#f7f5fc] p-3 text-sm font-bold leading-6 text-[#4f4964]"><ShieldCheck size={18} className="mt-1 shrink-0 text-[#6954b1]" />{notice}</li>)}</ul><label className="mt-4 flex min-h-14 items-center gap-3 rounded-xl border-2 border-[#d9d1f3] p-3 text-sm font-black"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="size-6 accent-[#6954b1]" />注意事項を確認し、AI自動応答の利用に同意します</label><div className="mt-4 grid grid-cols-2 gap-3"><button onClick={onClose} className="min-h-13 rounded-xl border-2 border-[#dce3e1] font-black">キャンセル</button><button onClick={onAccept} disabled={!checked || saving} className="min-h-13 rounded-xl bg-[#6954b1] font-black text-white disabled:bg-[#bbb5cd]">{saving ? "保存中…" : "同意して使う"}</button></div></section></div>;
}

type SpeechRecognitionEventLike = { results: ArrayLike<{ [index: number]: { transcript?: string } }> };
type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; onstart: (() => void) | null; onresult: ((event: SpeechRecognitionEventLike) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor } }
