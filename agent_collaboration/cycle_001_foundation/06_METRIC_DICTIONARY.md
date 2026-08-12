# Shared Metric Dictionary — Draft

全時刻は内部UTC、レポート表示はAsia/Tokyoとし、期間を明記します。実装前の共同定義であり、現在計測済みではありません。

| Metric | Definition | Numerator | Denominator | Window | Guardrail |
|---|---|---|---|---|---|
| Qualified Download | 対象地域・18歳以上で登録完了した初回インストール | 条件を満たす登録 | 初回インストール | 7日 | 正確なGPSを保存しない |
| Activation Rate | 登録後に募集作成または参加申請した割合 | 24時間以内の該当ユーザー | 登録完了ユーザー | 登録後24h | bot/testを除外 |
| Supply Coverage | 対象セルに参加可能募集がある時間の割合 | 募集あり15分枠 | 対象15分枠 | 指定時間帯 | 公式募集を識別 |
| 3H Match Rate | 作成から3時間以内に1人以上承認されたHangout割合 | 条件を満たすHangout | 有効に公開されたHangout | 作成後3h | 取消・不正の除外を明記 |
| Attendance Rate | 承認済み参加枠の実参加割合 | 参加確認済み | 承認済み参加枠 | 開催後24h | 相互確認/異議処理が必要 |
| D7 Active Rate | 登録7日目までに有効行動を再度行った割合 | day 2–7に発見、作成、申請、参加のいずれか | 登録コホート | 7日 | 単なる起動を主指標にしない |
| D30 Active Rate | 登録30日目までに有効行動を行った割合 | day 8–30の有効行動 | 登録コホート | 30日 | 同上 |
| Customer Satisfaction | 完了後5段階質問の平均と分布 | 各回答 | 回答者 | 開催後24h | 回答率を併記 |
| First Contact Resolution | 追加往復なしに解決した問い合わせ割合 | 初回解決件数 | 対象問い合わせ | 7日 | 安全案件は別扱い |
| CAC per Activated User | 獲得費用をActivation人数で割る | 承認済み外部費用 | Activated users | キャンペーン期間 | 人件費含有を明記 |

## Event boundary

予定イベント:

`store_view -> install -> registration_completed -> discover_viewed -> hangout_created / join_requested -> join_accepted -> matched_within_3h -> attendance_confirmed -> feedback_submitted -> retained_action`

イベントへ含めない情報:

- 正確な緯度・経度
- パスワード、アクセストークン、更新トークン
- 電話番号、メールアドレス
- チャット本文、通報詳細
- プロフィール自由記述

地域は承認された粗い`area_bucket`だけを使用します。5件未満の機微な内訳は表示しません。

