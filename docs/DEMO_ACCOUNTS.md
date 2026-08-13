# Hangout Now 公開デモ

公開デモ: https://hangoutnow-demo.onrender.com/

このアカウントとデータはすべて架空です。実在する人物や連絡先の情報は使用しないでください。

## 主催者

- メール: `demo-host@hangoutnow.example`
- パスワード: `HangoutNow-Demo-2026!`
- 設定: 男性、主なエリアは新宿、電話番号確認済み
- 用途: 新宿・渋谷でのHangout作成、参加申請の承認、チャット、集合場所ナビ

## 参加者

- メール: `demo-guest@hangoutnow.example`
- パスワード: `HangoutNow-Demo-2026!`
- 設定: 女性、主なエリアは渋谷、電話番号確認済み
- 用途: 募集検索、参加申請、承認後の具体的な集合場所確認、チャット、集合場所ナビ

## 現在のデモ仕様

- Hangoutを公開できるエリアは新宿・渋谷です。
- 承認前は「新宿駅周辺」「渋谷駅周辺」など概略エリアだけを表示します。
- 店名、住所、正確な座標は主催者と承認済み参加者だけに表示します。
- 正確な集合場所が表示された後は、地図アプリへ目的地を渡してナビできます。
- デモ募集には性別・年齢の参加条件を設定できます。

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
