import { withBasePath } from "@/lib/base-path";
import styles from "./login.module.css";

export const metadata = { title: "ログイン | RoboReha" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; locked?: string }> }) {
  const query = await searchParams;
  const message = query.locked ? "試行回数が多すぎます。15分後にもう一度お試しください。" : query.error ? "ユーザー名またはパスワードが違います。" : "";

  return (
    <main className={styles.shell}>
      <div className={styles.auroraTop} aria-hidden="true" />
      <div className={styles.auroraBottom} aria-hidden="true" />

      <section className={styles.layout}>
        <div className={styles.story}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>R</span>
            <span className={styles.brandName}>
              <small>ROBOCARE ONE</small>
              <strong>RoboReha</strong>
            </span>
          </div>

          <div className={styles.heroCopy}>
            <p className={styles.kicker}><span aria-hidden="true" /> Integrated care workspace</p>
            <h1><span>RoboReha</span><br />ケアの流れを、ひとつにつなぐ。</h1>
            <p className={styles.heroLead}>顧客・予約・HAL・安全確認・臨床記録を、現場の動きに沿ってスムーズに。</p>
          </div>

          <div className={styles.moduleList} aria-label="主な管理領域">
            <span>Customer</span>
            <span>Schedule</span>
            <span>HAL</span>
            <span>Clinical</span>
          </div>

          <div className={styles.orbit} aria-hidden="true">
            <span className={styles.orbitRing} />
            <span className={styles.orbitCore}>R</span>
            <span className={`${styles.orbitNode} ${styles.orbitNodeOne}`}>予約</span>
            <span className={`${styles.orbitNode} ${styles.orbitNodeTwo}`}>HAL</span>
            <span className={`${styles.orbitNode} ${styles.orbitNodeThree}`}>安全</span>
          </div>
        </div>

        <section className={styles.panel} aria-labelledby="login-title">
          <div className={styles.previewBadge}><span aria-hidden="true" /> Private preview</div>
          <p className={styles.panelEyebrow}>Secure access</p>
          <h2 id="login-title">おかえりなさい</h2>
          <p className={styles.panelLead}>RoboRehaワークスペースへログイン</p>

          {message ? <p className={styles.error} role="alert">{message}</p> : null}

          <form className={styles.form} action={withBasePath("/api/private-auth")} method="post">
            <label>
              <span>ユーザー名</span>
              <input name="username" type="text" autoComplete="username" placeholder="ユーザー名を入力" required autoFocus />
            </label>
            <label>
              <span>パスワード</span>
              <input name="password" type="password" autoComplete="current-password" placeholder="パスワードを入力" required />
            </label>
            <button type="submit"><span>ログイン</span><span aria-hidden="true">→</span></button>
          </form>

          <div className={styles.securityNote}>
            <span className={styles.securityIcon} aria-hidden="true">✓</span>
            <p><strong>限定共有の検証環境</strong><br />表示される情報はすべて架空のデモデータです。</p>
          </div>
        </section>
      </section>

      <p className={styles.copyright}>© Method More · RoboCare One</p>
    </main>
  );
}
