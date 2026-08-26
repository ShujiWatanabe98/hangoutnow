# Apple App Review 再提出チェック

対象: HangoutNow 1.0

## Appleからの指摘と対応

- Guideline 2.3.3: 6.5インチのスクリーンショットを、Discover、Hangout詳細、グループトークの実画面へ差し替える。
- Guideline 4: iOSでは `expo-apple-authentication` のシステム提供ボタンを使い、独自のAppleロゴを表示しない。
- Guideline 2.3.6: 実装していない「ペアレンタルコントロール」と「年齢確認」は年齢制限指定で「いいえ」にする。

## 追加した審査安全対策

- プロフィール、Hangout、参加申請、グループトーク、1対1トークを投稿前の共通コンテンツフィルタへ通す。
- 通報内容は運営確認の証拠を失わないよう、投稿フィルタの対象外にする。
- Appleから受け取る更新トークンはAES-256-GCMで暗号化して保存する。平文トークンや投稿本文をログへ出さない。
- Appleログイン利用者がアカウントを削除するときは、アプリ内データを削除する前にAppleの `/auth/revoke` で更新トークンを失効する。
- 暗号化キーは `OAUTH_TOKEN_ENCRYPTION_KEY` を優先し、未設定時は本番必須の `JWT_ACCESS_SECRET` から用途分離した鍵を導出する。
- Prismaマイグレーション `20260826053000_apple_token_revocation` をAPI起動前に適用する。

## 再提出前の確認

1. `npm.cmd run lint`
2. `npm.cmd run typecheck`
3. `npm.cmd test`
4. Expo公開設定に `usesAppleSignIn: true` と `expo-apple-authentication` が含まれること
5. 実機/TestFlightでAppleボタン、ログイン、アカウント削除、位置情報拒否時の手動エリア選択を確認すること
6. App Store Connectで修正版ビルドを選択し、スクリーンショットと年齢制限指定を再確認すること
7. App Reviewへの返信内容と選択ビルドが一致してから再提出すること

## App Reviewメモ案

Hangout Now is an activity-first social matching app for adults aged 18 and over. There are no in-app purchases.

The reviewer can use the fully featured demo mode without creating an account. From the login screen, select the participant demo, open a Hangout, submit a join request, then switch to the host demo to approve it and inspect the members-only group chat.

Location permission is optional. Users can select Shinjuku or Shibuya manually when location access is denied. Exact venue details and coordinates remain hidden until a join request is accepted.

User-generated text is filtered before posting. Users can report and block another user, and the operator can review reports and apply warnings, suspension, or bans. Contact information is published at https://method-more.com/faq.html.

Account deletion is available from the profile screen. For accounts created with Sign in with Apple, deletion revokes the Apple refresh token before deleting the account and associated data.

The iOS login screen uses the system-provided Sign in with Apple button. The App Store screenshots show the full app UI in use. Parental Controls and Age Assurance are set to None because those features are not provided.
