# Hangout Now 公開デモ

公開デモ: https://hangoutnow-demo.onrender.com/

このアカウントとデータはすべて架空です。実在する人物や連絡先の情報は使用しないでください。

## 主催者

- メール: `demo-host@hangoutnow.example`
- パスワード: `HangoutNow-Demo-2026!`
- 用途: 募集作成、参加申請の承認、チャット

## 参加者

- メール: `demo-guest@hangoutnow.example`
- パスワード: `HangoutNow-Demo-2026!`
- 用途: 募集検索、参加申請、チャット

## 初期状態の準備・復元

```powershell
npm.cmd run demo:seed
```

メールアドレス、パスワード、API URLは環境変数で上書きできます。

- `HANGOUTNOW_DEMO_HOST_EMAIL`
- `HANGOUTNOW_DEMO_GUEST_EMAIL`
- `HANGOUTNOW_DEMO_PASSWORD`
- `HANGOUTNOW_API_URL`
- `HANGOUTNOW_DEMO_URL`
