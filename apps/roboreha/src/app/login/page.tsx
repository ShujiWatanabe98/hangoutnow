import { withBasePath } from "@/lib/base-path";

export const metadata = { title: "ログイン | RoboReha" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; locked?: string }> }) {
  const query = await searchParams;
  const message = query.locked ? "試行回数が多すぎます。15分後にもう一度お試しください。" : query.error ? "ユーザー名またはパスワードが違います。" : "";
  return (
    <main className="private-login-shell">
      <section className="private-login-card">
        <div className="private-login-brand"><span>R</span><div><small>PRIVATE PREVIEW</small><strong>RoboCare One</strong></div></div>
        <h1>RoboReha</h1>
        <p>閲覧にはユーザー名とパスワードが必要です。</p>
        {message ? <p className="private-login-error" role="alert">{message}</p> : null}
        <form action={withBasePath("/api/private-auth")} method="post">
          <label>ユーザー名<input name="username" type="text" autoComplete="username" required autoFocus /></label>
          <label>パスワード<input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit">ログイン</button>
        </form>
        <small className="private-login-note">このページは限定共有の検証環境です。<br />データは架空のデモ情報です。</small>
      </section>
    </main>
  );
}
