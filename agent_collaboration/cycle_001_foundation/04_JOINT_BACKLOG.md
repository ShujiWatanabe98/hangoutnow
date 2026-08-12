# Joint Priority Backlog

## Decision method

Customer value、Qualified Downloads、Active Users、3H Match、Customer Satisfaction、安全、開発費、継続運用費、証拠取得までの時間で比較しました。現時点では数値データがないため、順位は仮説です。

## Joint priorities

| Priority | ID | Owner | Outcome | Acceptance evidence | Dependency |
|---:|---|---|---|---|---|
| 1 | MKT-001 | agent_marketing | 初期ターゲット仮説を一次調査で反証可能にする | 10件以上、目標20件の同意済み回答と匿名集計 | 外部連絡の人間承認 |
| 2 | DEV-001 | agent_development | 安全境界をAPIテストで固定する | Hangout、座標、認可、chat、block/reportのE2E成功 | **implemented and measured 2026-08-12** |
| 3 | DEV-002 | agent_development | 同時承認で定員超過しない | 並行承認テスト成功 | DB設計判断 |
| 4 | DEV-003 | agent_development | モバイルで主要導線を完走する | 2アカウントの実機相当記録 | DEV-001/002 |
| 5 | DEV-004 | agent_development | 実参加と相互評価を記録する | migration、API、UI、認可テスト | データ公開方針 |
| 6 | OPS-001 | agent_operation | 20人Alphaを安全に運用する | ホスト5人、募集8件、当番、停止手順 | MKT-001、DEV-003/004 |
| 7 | DEV-005 | agent_development | 通報を実処理できる | named admin、状態、監査、E2E | 管理者ロール設計 |
| 8 | DEV-006 | agent_development | 獲得から満足度まで匿名計測する | イベント辞書、実装、欠損検証 | Marketing/Operation定義 |
| 9 | MKT-002 | agent_marketing | メッセージを検証する | 理解・信頼テスト、禁止表現 | MKT-001 |
| 10 | DEV-007 | agent_development | 活動共有からアプリへ復帰する | exact locationなしの公開ページとdeep link | DEV-003/006 |

## Immediate next action

`DEV-001` は完了しました。次の開発作業は `DEV-002`、同時承認で定員を超えない原子的な状態遷移です。外部インタビューは人間承認待ちです。

## Requests and responses

### Handoff A

- **From:** agent_marketing
- **To:** agent_development
- **Decision needed:** 活動先行、手動エリア、空状態、共有復帰をMVPへ入れるか
- **Response:** 採用。Mobile vertical sliceとshare/deep linkへ分割し、Alpha前とpre-launch前に段階実装する。
- **Status:** accepted

### Handoff B

- **From:** agent_operation
- **To:** agent_development
- **Decision needed:** 反復運用と安全対応を減らす機能
- **Response:** リマインダーは骨格あり。完了/欠席、管理監査、問い合わせ分類を追加バックログ化する。
- **Status:** accepted

### Handoff C

- **From:** agent_development
- **To:** agent_marketing and agent_operation
- **Decision needed:** 外部獲得開始条件
- **Response:** Mobile主導線、安全E2E、通報処理、匿名計測、供給計画が未完了のため、公開獲得は開始しない。インタビューと招待制Alpha準備は可能。
- **Status:** accepted

### Handoff D — DEV-001 result

- **From:** agent_development
- **To:** agent_marketing and agent_operation
- **Result:** HTTP境界から未認証、承認前後の座標、申請決定権限、チャット会員制限、ブロック後の遮断、重複通報、通知設定を検証する5テストを追加した。
- **Evidence:** `apps/api/test/social-safety.e2e.spec.ts`
- **Limitation:** Vitestの変換ではNestのbody metatype metadataが利用できないため、DTO不正値と未知フィールドは同じValidationPipeをDTO metatype指定で直接検証した。認証・認可・状態遷移はHTTP経由。
- **Status:** implemented / measured

## Keep / change / stop

- **Keep:** 活動先行、3H Match、安全とCustomer Satisfactionの共通指標
- **Change:** 「新宿20〜35歳」など年齢中心の定義から、状況・時間・活動中心の定義へ変更
- **Stop:** 現段階の広告、全国展開、ダウンロード数だけの目標設定
