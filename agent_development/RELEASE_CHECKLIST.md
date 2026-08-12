# Release Candidate Checklist

## Scope and Evidence

- [ ] リリース対象と対象外が記録されている
- [ ] すべての受入条件に検証証拠がある
- [ ] P0/P1の未解決不具合がない
- [ ] 既知の制約がリリースノートにある

## Code Quality

- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run typecheck`
- [ ] `npm.cmd test`
- [ ] 全workspaceのbuild
- [ ] 一時的なデバッグコード、秘密情報、不要ログがない
- [ ] `any` や検証されない外部入力がない

## Database and API

- [ ] DB変更にマイグレーションがある
- [ ] クリーンDBと既存データ相当の両方でマイグレーションを検証した
- [ ] API入力、認証、認可、レート制限を検証した
- [ ] 破壊的変更には互換期間または移行手順がある
- [ ] UTCとISO 8601の境界が守られている

## Location and Privacy

- [ ] 承認前に正確な座標をAPIが返さない
- [ ] ログ、分析、通知に正確な座標を含めない
- [ ] パスワード、トークン、私信、機微情報をログへ出さない
- [ ] 位置情報拒否時に安全な代替導線がある
- [ ] プライバシー表示が実際のデータ利用と一致する

## Safety

- [ ] 18歳未満をサーバーで拒否する
- [ ] ブロック後に発見、参加、チャットが遮断される
- [ ] 通報が保存され、重複と悪用を扱える
- [ ] 管理機能に最小権限と監査記録がある
- [ ] インシデント対応担当と停止手順がある

## User Journey

- [ ] Discover
- [ ] Create Hangout
- [ ] Join request
- [ ] Host accept / reject
- [ ] Match and exact-location reveal
- [ ] Chat
- [ ] Hangout completion and feedback
- [ ] Cancel, failure, retry, empty states

## Devices and Operations

- [ ] 対象iOS・Android実機または同等環境
- [ ] 小さい画面、文字拡大、基本アクセシビリティ
- [ ] 低速・切断・再接続
- [ ] crash、error、latency、realtime、DB監視
- [ ] バックアップ、ロールバック、復旧手順

## Release Boundary

- [ ] ローカル検証と本番公開を区別して報告する
- [ ] 本番デプロイは人間が承認した
- [ ] ストア提出・公開は人間が承認した
- [ ] 公開後の担当者と監視時間が決まっている

