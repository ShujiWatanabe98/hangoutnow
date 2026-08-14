# Development Request — Enable the First 100 Users Strategy

**From:** agent_marketing and agent_operation  
**To:** agent_development  
**Date:** 2026-08-13  
**Priority:** P0  
**Status:** accepted for development planning  
**Source strategy:** `agent_collaboration/cycle_001_foundation/09_FIRST_100_USERS_STRATEGY.md`

## Decision needed

Hangout Nowの最初の10人によるCohort 0を安全に開始し、その後25人ずつ100人まで段階解放できるプロダクトを完成させてください。

## Requested outcome

2人以上の成人テスターがiOS/Androidのモバイルアプリで、次の導線を完走できること。

```text
Register -> Profile and phone verification -> Discover/Create -> Join request
-> Host approve/reject -> Exact meeting location reveal -> Chat
-> Hangout completion -> Attendance confirmation -> Mutual feedback
```

同時に、MarketingとOperationが次を匿名集計できるようにしてください。

```text
Acquisition source -> Registration -> Activation -> 3H Match
-> Attendance -> Satisfaction -> D7 active
```

## Customer problem

予定が急に空いた成人が、近くで同じ活動をしたい人を見つけ、安全条件を確認し、30分・1時間・3時間以内に公共の場所で活動できる必要があります。

## Initial scope

- Target: 18歳以上
- Area: 新宿駅周辺約2km
- Time: 金曜・土曜18:00–22:00
- Activities: カフェ、早めの食事
- Initial users: 10-person internal Cohort 0
- Progressive release: 25 -> 50 -> 75 -> 100 users
- Infrastructure: Render Hobby, one Starter API, basic-256mb PostgreSQL, S3-compatible media storage

この条件をコードへ固定して全国利用を不可能にする必要はありません。ただし、初期運用がこのセルへ集中できるフィルター、手動エリア、計測単位が必要です。

## P0 development work

### DEV-002 — Atomic capacity approval

- 最後の空席に複数申請が同時承認されても定員を超えないこと
- DBレベルで原子的に保証すること
- 競合テストを追加すること
- 二重承認、満員後承認、キャンセルとの状態競合を扱うこと

### DEV-003 — Mobile vertical slice

- 登録、ログイン、トークン更新、ログアウト
- 成人確認、プロフィール写真、電話確認
- 現在地許可と手動エリア選択
- Hangout一覧、時間フィルター、詳細、空状態
- Hangout作成、編集、キャンセル
- 参加申請、申請状態、主催者の承認・拒否
- 承認前の概略位置、承認後の正確な集合場所
- 承認済みメンバーだけのチャット
- ローディング、失敗、再試行、オフライン・再接続
- 小さい画面と基本アクセシビリティ

### DEV-004 — Completion, attendance and mutual feedback

- Hangoutの開催完了状態
- ホストと参加者による出欠確認
- 重複送信に耐える冪等性
- 無断欠席と異議がある場合の状態
- 開催後5段階満足度
- 「同じ条件なら再利用したいか」
- 相互フィードバック
- 個人評価を公開する前の集計・最低件数・モデレーション方針
- DB変更はマイグレーションを作成

### DEV-005 — Safety operations

- モバイルからのブロック・通報
- 不適切な募集・文章のフィルタリング方針と実装
- 公開された問い合わせ先
- 名前付き管理者認証
- 通報状態、担当者、対応履歴、監査記録
- 重大・通常案件の分類
- ブロック後のDiscover、Join、Chat、Notification遮断
- Cohort 0前に通報対応を模擬試験できること

### DEV-006 — Privacy-preserving measurement

次のイベントを実装してください。

- `registration_completed`
- `phone_verification_completed`
- `discover_viewed`
- `hangout_created`
- `join_requested`
- `join_accepted`
- `matched_within_3h`
- `attendance_confirmed`
- `feedback_submitted`
- `retained_action`
- 集計用のreport、block、cancellation、no-show

イベントには次を含めません。

- 正確な緯度・経度
- メール、電話番号
- パスワード、トークン
- チャット本文、通報詳細
- プロフィール自由記述

許可された粗い`area_bucket`、時間帯、活動カテゴリ、キャンペーンIDだけを使用します。

### DEV-007 — Invite, share and attribution

- Hangoutごとの共有リンク
- 活動、開始時刻、概略エリア、残席のみ公開
- 正確な集合位置、参加者の私的情報を公開しない
- 未インストール時はストア、インストール済みなら該当Hangoutへ遷移
- 登録・ログイン後も目的のHangoutへ復帰
- 招待・コミュニティ・発信者ごとのキャンペーンIDを保持
- iOS/Androidの失敗時フォールバック

## P1 development work

- 初期ホスト向け申請未処理リマインダー
- 開始15分前リマインダーのモバイル統合
- 通知設定とロック画面のプライバシー
- 構造化されたキャンセル理由、問い合わせ分類
- Supply Coverage、3H Match、安全、満足度の管理ダッシュボード
- Cohortごとの招待上限またはfeature flag
- Cohort 0で必要なサポート診断情報。ただし機微情報は含めない

## Acceptance criteria

### Core journey

1. 2人の成人テスターが実機または同等環境で主導線を完走できる。
2. 主催者以外は申請を承認・拒否できない。
3. 未承認ユーザーと第三者へ正確な位置情報を返さない。
4. 承認済みユーザーだけが正確な集合場所とチャットへアクセスできる。
5. ブロック後は対象ユーザーとの発見、参加、チャット、通知が遮断される。
6. 同時承認でも定員を超えない。
7. 開催完了、出欠、満足度、相互評価が記録される。

### Growth and operations

8. 流入元からActivation、3H Match、Attendance、D7を匿名集計できる。
9. Cohort 0の10人だけを招待して実施できる。
10. 空一覧では募集作成または次の時間帯という明確な行動を提示する。
11. 通報を名前付き管理者が処理し、状態と対応履歴を残せる。
12. Operationが個人情報なしでCohortのGo / Pauseを判断できる。

### Infrastructure

13. Render Starter API 1台、basic-256mb PostgreSQLで動作する。
14. プロフィール画像本体をAPIサーバーへ永続保存しない。
15. Redis、Worker、autoscalingを初期必須依存にしない。
16. DB変更にマイグレーションがある。

## Required tests

- Unit tests for business state transitions
- API E2E for authentication, authorization and validation
- Concurrent final-seat approval test
- Coordinate visibility before and after approval
- Block/report and post-block access tests
- Chat membership tests
- Attendance and feedback authorization/idempotency tests
- Analytics payload privacy tests
- Share/deep-link route tests
- Mobile component/flow tests where appropriate
- Manual iOS/Android smoke test
- Small-screen and location-denied verification
- Render-equivalent production smoke test before Cohort 0

必須コマンド:

```text
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
```

## Delivery sequence

### Release A — Safety and integrity

- DEV-002
- Existing social-safety test expansion
- Required migrations if any

### Release B — Cohort 0 mobile journey

- DEV-003
- Mobile block/report
- Basic attendance/completion

### Release C — Measurable Alpha

- DEV-004
- DEV-005 named admin workflow
- DEV-006

### Release D — First 100 acquisition readiness

- DEV-007
- Store/deep-link integration
- Operations dashboard and release checklist

各Release終了時にagent_marketingとagent_operationへ結果を返し、次Releaseの要求が変わっていないか確認してください。

## Required response from agent_development

実装開始前に次を返してください。

```text
Feasibility:
Proposed architecture:
Work breakdown:
Dependencies:
Migration impact:
Security and privacy risks:
One-time development estimate:
Recurring infrastructure impact:
Measurement approach:
Recommended first implementation slice:
Questions or missing decisions:
```

## Approval boundaries

agent_developmentはローカル実装、マイグレーション作成、テストを進められます。

次は人間承認が必要です。

- 本番デプロイ
- 本番DBマイグレーション
- S3、SMS、分析サービスの契約・課金
- ストア提出、予約注文、事前登録、一般公開
- 実ユーザーへの通知
- 個人評価の公開仕様

## Definition of done

ソース実装だけでは完了しません。Cohort 0の架空成人アカウント10人相当を用いて、主要導線、安全、通報対応、匿名計測を検証し、agent_marketingとagent_operationが開始可否を判断できる証拠を提出した時点で完了です。

