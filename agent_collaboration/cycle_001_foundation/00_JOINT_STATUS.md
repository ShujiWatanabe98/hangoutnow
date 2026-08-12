# Joint Status — Cycle 001

**実施日:** 2026-08-12  
**対象:** Hangout Nowのみ  
**サイクル目的:** 初期ターゲット仮説を定義し、開発と運用の最優先事項へ接続する。

## Current milestones

- `agent_marketing`: M0 Research Foundation
- `agent_operation`: M0 Product and Market Foundation
- `agent_development`: D0 Product Requirements and Risk Model

既存APIの機能数ではなく、各マイルストーンの完了条件に必要な市場証拠、実機導線、テスト、安全運用が揃っていないため、この現在地と判定しました。

## Joint decision

### Initial hypothesis cell

`新宿駅周辺おおむね2km x 金曜・土曜 18:00–22:00 x カフェ・早めの食事 x 18歳以上`

これは公開対象の決定ではなく、一次調査とクローズドテストで反証する仮説です。

### Target situation

予定が空いた、仕事や用事が早く終わったなどの理由で、今から1〜2時間だけ公共の場所で軽い活動をしたい成人。

### Exclusions for the first test

- 18歳未満
- 恋愛・性的出会いを主目的とする利用
- 深夜帯
- 個人宅、車内、密室を集合場所とする活動
- 飲酒を主目的とする活動
- 大人数イベント

## Evidence

- `FACT`: Hangout Nowの定義済み主導線は登録、募集・発見、申請、承認、チャット、集合、相互評価である。Source: `docs/PRODUCT.md`。
- `FACT`: APIには認証、電話確認、Hangout、申請、チャット、通知、ブロック、通報の骨格がある。Source: `apps/api/src`、2026-08-12確認。
- `FACT`: モバイルアプリ本体はブランド名と「今から何する？」を表示するだけで、主導線は未実装である。Source: `apps/mobile/src/App.tsx`、2026-08-12確認。
- `FACT`: 令和7年の内閣府調査では、孤独感が「しばしばある・常にある」は全体4.5%で、若年層を含む年代差が示されている。ただし、これは本サービスの利用意向を示すものではない。Source: https://www.cao.go.jp/kodoku_koritsu/torikumi/zenkokuchousa/r7/pdf/tyosakekka_point.pdf
- `FACT`: 2025年国勢調査速報で東京都の1世帯当たり人員は1.88人。これも即時活動マッチング需要を直接証明しない。Source: https://www.stat.go.jp/data/kokusei/2025/kekka/pdf/outline.pdf
- `FACT`: AppleのUGC要件は、不適切コンテンツのフィルタ、通報、ブロック、連絡先を要求する。また位置情報の利用目的説明と同意が必要。Source: https://developer.apple.com/app-store/review/guidelines/
- `HYPOTHESIS`: 高密度な駅周辺、週末夕方、短時間のカフェ・食事は、需要と安全な公共場所の供給を同時に作りやすい。

## Unknowns blocking milestone completion

- 対象候補者が直近3か月に同様の状況を経験した頻度
- 現在使う代替手段と、見知らぬ成人との活動を選ぶ条件
- 許容距離、待ち時間、人数、本人確認水準
- 新宿で同時間帯に必要なホスト供給数
- 初期セルのQualified Downloadから実参加までの転換率
- Customer Satisfactionの基準値

## This cycle’s top priorities

1. 成人候補者10〜20人の一次調査を実施可能な状態にする
2. モバイル主導線と安全上のP0ギャップを開発バックログへ固定する
3. 20人規模のクローズドテストを低コストで運営できる設計にする

## Human approvals required next

- インタビュー対象者への外部連絡
- 調査参加への謝礼の有無と上限
- 初期セル仮説を新宿で検証すること
- 実在ユーザー情報を扱う場合の同意文と保存期間

