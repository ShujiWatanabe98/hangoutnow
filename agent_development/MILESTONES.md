# Development Milestones

## Progress Rule

各マイルストーンは開始条件、作業、成果物、完了条件で判定します。未確認の項目は `unknown` とし、証拠のない完了報告はしません。

## D0: Product Requirements and Risk Model

**Goal:** MVPの範囲、受入条件、安全境界を固定する。

### Agent actions

- 現在の実装とPRODUCT、API、SECURITY文書の差分を調査する
- MVPユーザーストーリーを主導線順に整理する
- 各ストーリーに受入条件と失敗条件を付ける
- 位置情報、チャット、通報、本人確認の脅威モデルを作る
- 非機能要件と対象外を明文化する

### Deliverables

- MVP Requirements Matrix
- Acceptance Criteria
- Threat Model
- Non-functional Requirements
- Prioritized Backlog

### Exit criteria

- 主導線の要件に未解決の重大な矛盾がない
- 承認前後の位置情報境界が明文化されている
- P0/P1の機能と対象外が人間に承認されている

## D1: Architecture and Development Foundation

**Goal:** 安全に機能を追加・検証できる基盤を完成する。

### Agent actions

- strict TypeScript、lint、typecheck、test、buildを整える
- 環境変数検証と秘密情報管理を整える
- DBマイグレーションとテストDB運用を確認する
- 認証、認可、入力検証、レート制限の共通方式を作る
- 構造化ログから機微情報を除外する
- CIで必須検証を自動化する

### Exit criteria

- クリーン環境でインストールと必須検証が成功する
- DB変更がマイグレーションで再現できる
- 秘密情報や正確なGPS座標がリポジトリ・ログにない
- CIが失敗を検知できる

## D2: Identity, Profile, and Trust

**Goal:** 成人ユーザーが安全に登録し、信頼情報を設定できる。

### Agent actions

- 登録、ログイン、更新トークン、ログアウトを完成する
- 18歳以上の境界値をサーバーで検証する
- プロフィール、写真、興味、概略エリアを実装する
- 電話確認と試行回数制限を実装する
- アカウント状態とセッション失効をテストする

### Exit criteria

- 認証・プロフィールの正常系と不正系が自動テスト済み
- パスワードと更新トークンが平文保存されない
- 本番で確認コードが応答に含まれない
- 18歳未満がAPI直接呼出しでも登録できない

## D3: Discover and Create Hangout

**Goal:** 活動を作成・発見でき、承認前は概略位置だけを扱う。

### Agent actions

- 30、60、180分後のHangout作成を実装する
- 距離、時間、状態による一覧・詳細を実装する
- PostGIS検索、ページング、インデックスを検証する
- 正確な座標と公開用概略座標を分離する
- 空状態、位置情報拒否、手動エリア選択を実装する
- ホストだけが更新・キャンセルできるようにする

### Exit criteria

- APIとモバイルの作成・発見導線が実機相当で完走する
- 未承認ユーザーへ正確な座標が返らないテストがある
- 不正な時刻、距離、定員、座標が拒否される
- 代表的な検索条件の性能基準を満たす

## D4: Join, Match, and Capacity Integrity

**Goal:** 参加申請と承認を競合に強く、安全に成立させる。

### Agent actions

- 参加申請、一覧、承認、拒否を完成する
- 重複申請と自己申請を防ぐ
- 同時承認でも定員超過しないトランザクションを実装する
- ブロック済みユーザーの参加をサーバーで拒否する
- 承認後だけ正確な集合位置を返す
- 状態遷移と通知を冪等にする

### Exit criteria

- 認可と状態遷移の自動テストがある
- 競合テストで定員を超えない
- 承認前後の座標精度がテストで証明される
- キャンセル・拒否・期限切れのUI状態が一貫する

## D5: Chat, Notifications, and Hangout Completion

**Goal:** 承認済みメンバーだけが連絡し、安全に集合完了できる。

### Agent actions

- チャットルーム、履歴、送信を完成する
- 承認済みメンバーだけにアクセスを制限する
- 通知受信箱、既読、設定、リアルタイム更新を完成する
- 再接続、重複通知、メッセージ長を扱う
- 開催後の参加確認と相互フィードバックを実装する
- 私信をログ・分析・プッシュ本文へ不用意に含めない

### Exit criteria

- 未承認・拒否・無関係ユーザーがチャットへアクセスできない
- 再送しても重大な重複副作用がない
- 通知オフ設定が守られる
- 主導線がHangout完了とフィードバックまで通る

## D6: Safety and Operations Console

**Goal:** ブロック、通報、調査、対応を公開前に完成する。

### Agent actions

- ブロック、解除、通報、重複防止を完成する
- ブロック後の一覧、参加、チャット、通知アクセスを再検証する
- 管理画面の認証・認可を本番向けに設計する
- 通報キュー、状態、担当、監査履歴を実装する
- レート制限、悪用対策、保持期間を確認する
- 機微情報を最小限にした運用手順を作る

### Exit criteria

- ブロック・通報がE2Eテスト済み
- 管理者用固定共有トークンが本番の最終方式ではない
- 管理操作に最小権限と監査記録がある
- 重大インシデントの対応訓練が実施可能

## D7: Growth Readiness and Observability

**Goal:** 公開後に獲得から安全な成立まで測定・改善できる。

### Agent actions

- 匿名化したファネルイベントを実装する
- Hangout共有ページ、ディープリンク、キャンペーン属性を実装する
- crash、latency、error rate、job、realtimeの監視を追加する
- 正確なGPSや私信を分析基盤へ送らないことを検証する
- 運用ダッシュボードに供給、3H Match、安全指標を追加する
- `agent_operation` が必要とするデータ定義と整合させる

### Exit criteria

- installからattendedまで匿名集計で追跡できる
- チャネル・地域バケット・時間帯別に品質を比較できる
- アラートと担当者が定義されている
- 個人を特定できる小集計や正確な位置情報が露出しない

## D8: Release Candidate and Store Readiness

**Goal:** ストア提出可能な、検証済みリリース候補を作る。

### Agent actions

- `RELEASE_CHECKLIST.md` を実行する
- lint、typecheck、tests、build、migrationをクリーン環境で実行する
- iOS、Android、代表画面幅、権限拒否、低速通信を確認する
- アクセシビリティ、クラッシュ、性能、依存関係を点検する
- プライバシー表示と実際のデータ利用を照合する
- リリースノート、ロールバック、既知の制約を作る

### Exit criteria

- P0/P1欠陥が0件
- 必須検証が成功し証拠が保存されている
- 本番相当環境で主導線と安全機能が完走する
- ロールバックとインシデント担当が明確
- 人間がストア提出を承認している

## D9: Post-Launch Reliability and Iteration

**Goal:** 公開後の障害、安全問題、利用データへ素早く対応する。

### Agent actions

- crash、error、latency、認証、realtime、DBを監視する
- P0/P1を再現し、修正し、回帰テストを追加する
- agent_operationのボトルネックをプロダクト改善へ変換する
- 週次で依存関係、性能、セキュリティ、安全指標をレビューする
- DB変更を段階的かつ後方互換に展開する
- 不要なログとデータ保持を定期的に見直す

### Exit criteria

この段階は継続サイクルです。各変更はTASK_BRIEFから開始し、COMPLETION_REPORTで閉じます。

## Status Format

```text
Current milestone: Dx - name
Evidence:
- confirmed fact and source

Unmet exit criteria:
- unmet or unknown item

Top engineering priority:
- one outcome

Tasks this cycle:
1. task / acceptance criteria / verification

Risks:
- risk and mitigation

Approvals required:
- item or none
```
