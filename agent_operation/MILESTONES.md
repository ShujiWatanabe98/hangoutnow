# Operation Milestones

## Purpose

この計画は、Hangout Now が現在開発中で、今後アプリが完成し、App Store / Google Play に公開されることを前提にしています。

日付は公開日を `T` とした相対表記です。公開日が決まっていない間も、開始条件と完了条件によって現在のマイルストーンを判定します。

エージェントは各マイルストーンで次を行います。

1. 開始条件を証拠付きで確認する
2. 未確定値を `unknown` として記録する
3. 最大3件の優先作業へ絞る
4. 成果物を作成する
5. 完了条件を検証する
6. 人間の承認後に次へ進む

---

## M0: Product and Market Foundation

**目安:** 開発中、T-12週以前  
**目的:** 誰の、いつの、どの活動を最初に成立させるか決める。

### Start conditions

- MVPのコンセプトと主導線が定義されている
- 18歳以上を対象とする方針がある

### Agent actions

- `エリア x 曜日・時間帯 x アクティビティ` の初期候補を比較する
- 想定ユーザー10〜20人へのインタビュー質問票を作る
- 競合ではなく、現在使われている代替手段を整理する
- 初期セルを1つ、予備セルを1つ提案する
- 主価値を1文、ストア用短文を3案、禁止表現を作る
- North Star Metricを `3H Match Rate` とし、補助指標を定義する
- 初期ホストの条件、役割、特典、安全責任を定義する

### Deliverables

- Ideal Customer Profile
- 初期セル選定表
- インタビュー票と匿名集計
- ポジショニング文書
- KPI辞書
- 初期ホストプログラム案

### Exit criteria

- 初期セルと対象外が人間に承認されている
- 想定ユーザー10人以上から検証可能な回答がある
- 「誰が、いつ、なぜ使うか」を1文で説明できる
- 指標の分母・分子・計測時点が定義されている

### Human approval

- 対象市場、ブランド表現、初期ホストへの特典・支出

---

## M1: Growth-Ready Product Design

**目安:** T-12〜T-8週  
**目的:** 完成後に獲得効果と利用成立を測れる設計にする。

### Start conditions

- 初期セルとMVP機能が決まっている
- 開発チームが計測要件を受け取れる

### Agent actions

- ストア閲覧から実参加までのイベント計測仕様を作る
- チャネル、キャンペーン、共有リンクのアトリビューションを設計する
- 正確な座標を送らない地域バケット仕様を定義する
- 空一覧、募集作成、参加申請、承認待ち、未成立時の導線をレビューする
- Hangout共有ページとディープリンク要件を作る
- 紹介の成果条件を「ダウンロード」ではなく安全に完了した初回Hangoutにする
- 通報、ブロック、キャンセル、無断欠席の運用要件をレビューする
- ストア審査で説明が必要な位置情報・ユーザー投稿・安全機能を整理する

### Deliverables

- Analytics Event Specification
- Acquisition Attribution Specification
- Deep Link / Share Page Requirements
- Empty State and Activation Review
- Safety Operations Requirements
- Store Review Readiness Checklist

### Exit criteria

- 必須イベントが開発計画に入り、テスト方法がある
- 承認前の正確な座標がUI、ログ、分析、広告へ出ない設計になっている
- DiscoverからHangout完了まで計測上つながる
- 共有リンクから適切なHangoutへ復帰できる仕様がある

### Human approval

- 計測SDK、外部サービス、プライバシー開示、紹介特典

---

## M2: Closed Alpha Readiness

**目安:** T-8〜T-6週  
**目的:** 実ユーザーを大量獲得する前に、主要体験を安全に完走させる。

### Start conditions

- テスト可能なアプリがある
- 登録、募集、申請、承認、チャット、通報の主要機能が動く

### Agent actions

- 同意済み成人20〜50人のテスト計画を作る
- テスト用の実在Hangoutを対象セルに集中配置する
- 初回利用観察とアンケートを準備する
- ファネル欠損、クラッシュ、空状態、安全問題を記録する
- サポート返信テンプレートとインシデント連絡網を作る
- 初期ホスト5〜10人を訓練する資料を作る
- テスト終了後に重大度別の改善優先順位を出す

### Deliverables

- Alpha Test Plan
- Host Onboarding Guide
- Support and Incident Runbook
- Daily Alpha Dashboard Definition
- Alpha Findings Report

### Exit criteria

- 同意済みテスターが主導線を実機で完走している
- P0/P1の重大問題が0件
- 通報・ブロック・サポート手順が担当者によって試行されている
- 主要イベントの計測欠損がない
- 初回操作で繰り返し発生する重大な離脱原因が解消されている

### Human approval

- テスター募集、外部連絡、謝礼、個人データの取扱い

---

## M3: Launch Supply and Creative Preparation

**目安:** T-6〜T-3週  
**目的:** 公開日に空のアプリを作らず、獲得素材と供給を揃える。

### Start conditions

- Alphaの重大問題が解消済み
- 公開候補日と初期セルが決まっている

### Agent actions

- 公開初週の時間帯別募集計画を作る
- 初期ホスト、店舗、施設、コミュニティの候補リストを作る
- 人間承認後、個別の提携文面とフォロー手順を準備する
- ストア説明、キーワード、スクリーンショット台本、プレビュー動画台本を作る
- 活動別の短尺動画を10本以上企画する
- ランディングページ、QR、共有リンクごとの計測パラメータを作る
- FAQ、安全ページ、プライバシー説明、コミュニティガイドラインを確認する
- 公開初週の問い合わせ・通報対応シフト案を作る

### Deliverables

- Launch Supply Calendar
- Host / Partner Pipeline
- App Store and Google Play Asset Brief
- Short Video Content Calendar
- Landing Page and Campaign Link Map
- Launch Support Schedule

### Exit criteria

- 公開初週の重点時間帯ごとに実在募集の担当者がいる
- ストア素材と説明が完成し、実装内容と一致している
- すべての獲得リンクをテスト環境で検証できる
- 公開時間帯に通報・問い合わせへ対応できる
- 架空の募集、レビュー、推薦文が含まれていない

### Human approval

- 提携先への連絡、出演者の同意、広告素材、公開素材、支出

---

## M4: Store Submission and Pre-Launch

**目安:** T-3週〜T-1日  
**目的:** 審査対応と、公開直後に集中流入を作る準備を完了する。

### Start conditions

- リリース候補版がある
- プライバシー、安全、サポート情報が揃っている

### Agent actions

- ストア提出項目と掲載内容の整合性を点検する
- 審査質問への回答案を作る
- 予約登録または待機リストを管理する
- 公開日ごとのGo / No-Goチェックリストを運用する
- 初日、3日目、7日目のコンテンツと通知案を準備する
- チャネル別のUTM・キャンペーンIDとダッシュボードを検証する
- ストア却下または公開延期時の連絡文面を用意する
- 公開範囲が初期セルを超えないよう配信計画を確認する

### Deliverables

- Store Submission Checklist
- Review Response Pack
- Waitlist / Pre-registration Plan
- Launch Go / No-Go Checklist
- Launch Communications Pack
- Delay and Rejection Contingency Plan

### Exit criteria

- ストア審査を通過している、または公開予約可能な状態
- 本番ビルド、ストア掲載、プライバシー表示が一致する
- 本番計測が匿名テストで確認済み
- 初週の募集、担当者、連絡先、停止判断者が確定している
- 人間のGo判断が記録されている

### Human approval

- ストア提出、公開日時、対外発表、プッシュ通知、Go / No-Go

---

## M5: Controlled Public Launch

**目安:** T〜T+7日  
**目的:** ダウンロード数ではなく、重点セルで安全な初回成立を作る。

### Start conditions

- ストアで一般ユーザーがダウンロードできる
- 公開初週の実在募集と運営体制が稼働している

### Agent actions

- ストア、共有リンク、登録、募集表示を本番で確認する
- 承認済みの短尺動画、提携QR、コミュニティ告知を時間差で開始する
- `Supply Coverage`、Activation、3H Match、安全指標を日次確認する
- 空一覧のセルへの送客を停止するよう提案する
- 問い合わせと同意済みフィードバックを毎日分類する
- ストアレビューへ誘導する場合、肯定評価を条件にせず全ユーザーへ公平に依頼する
- 日次で `continue / adjust / pause` を人間に提案する

### Deliverables

- Production Smoke Test Report
- Daily Launch Scorecard
- Issue and Feedback Triage
- Channel Quality Comparison
- Day 7 Launch Report

### Exit criteria

- 7日間のファネルをチャネル別・セル別に確認できる
- P0/P1問題が0件、または送客停止と対応が実施済み
- 重点セルのSupply Coverageと3H Match Rateが合意基準を満たす
- 少なくとも1つの再利用または招待ループが観測できる
- 次の14日間に継続するチャネルと停止するチャネルが決まっている

### Human approval

- キャンペーン公開・停止、広告支出、ユーザーへの一斉連絡

---

## M6: Activation and Retention Optimization

**目安:** T+2〜T+6週  
**目的:** 獲得した人が初回Hangoutを成立させ、再利用する割合を高める。

### Start conditions

- 1週間以上の本番ファネルがある
- 重点セルで継続的な募集がある

### Agent actions

- 最大離脱点を毎週1つ選ぶ
- 1回に主要変数を1つ変える実験を最大3件運用する
- 空一覧、申請未承認、Hangout未成立の回復施策を設計する
- ホストの再募集と参加者の友人招待を改善する
- ストア素材を活動テーマ別に比較する
- CACをActivated User、3H Match、D7 Retained User単位で比較する
- 通報、ブロック、無断欠席の変化を獲得施策と併記する
- `WEEKLY_REPORT.md` で毎週レビューする

### Deliverables

- Weekly Growth and Community Report
- Experiment Backlog and Results
- Activation Recovery Plan
- Host Retention Plan
- Channel Cohort Report

### Exit criteria

- 4週間分の一貫した計測データがある
- Activation、3H Match、Attendance、D7の改善要因を説明できる
- 再現可能な獲得チャネルが1つ以上ある
- 成長しても安全指標が合意範囲内にある
- 次セルへ展開できるホスト獲得方法と運用能力がある

### Human approval

- 実験公開、特典、通知、広告予算の変更

---

## M7: Repeatable Growth and Geographic Expansion

**目安:** T+6週以降  
**目的:** 品質を落とさず、隣接セルへ再現可能に拡大する。

### Start conditions

- 既存セルが合意した成立率、継続率、安全基準を満たす
- 新セルの供給を先行確保できる

### Agent actions

- 次セルの需要、移動距離、活動、時間帯を評価する
- ホストと提携先を先に確保する
- 小規模な供給テスト後に送客する
- 既存セルと新セルの品質を同じ定義で比較する
- エリア別ストアページ、クリエイティブ、ランディングページを作る
- サポートと安全対応能力に応じた同時展開数を提案する
- 月次でチャネル、セル、コホートの投資配分を見直す

### Deliverables

- Expansion Readiness Scorecard
- New Cell Launch Brief
- Capacity and Safety Plan
- Monthly Portfolio Report

### Exit criteria

- 新セルが4週間、合意基準を満たす
- 既存セルのSupply Coverageと安全性を悪化させていない
- 展開手順を別担当者でも再現できる
- 次の展開、維持、撤退の判断が記録されている

### Human approval

- 新エリア公開、予算配分、提携、運営人員の増加

---

## M8: Sustainable Operations

**目安:** 複数セルで安定後  
**目的:** 短期的な獲得ではなく、安全で持続可能な成長運用へ移行する。

### Start conditions

- 複数セルで再現可能な成長が確認されている

### Agent actions

- 季節性、曜日、地域ごとの需要予測を改善する
- チャネル別LTVと安全コストを含む投資判断を行う
- 休眠ユーザーの再活性化を、同意と通知設定に基づいて設計する
- ホスト品質、コミュニティ健全性、サポート能力を監視する
- 四半期ごとに対象市場、ポジショニング、KPIを再検証する
- 古い施策、不要なデータ、効果のない通知を整理するよう提案する

### Deliverables

- Quarterly Growth Review
- Demand and Supply Forecast
- Retention and Reactivation Plan
- Community Health Review
- Budget Allocation Recommendation

### Exit criteria

この段階は終了ではなく、四半期ごとの継続サイクルです。

### Human approval

- 年間予算、対象市場変更、料金・特典、安全基準の変更

---

## Stage Status Format

エージェントは各レビューの冒頭で次を出力します。

```text
Current milestone: Mx - name
Evidence:
- confirmed item
- confirmed item

Unmet exit criteria:
- unmet or unknown item

Top priority now:
- one measurable objective

Actions this cycle:
1. action / owner / due / success metric / stop condition
2. action / owner / due / success metric / stop condition

Approvals required:
- approval item or none
```

公開日や数値が不明でも、推測して次の段階へ進めません。
