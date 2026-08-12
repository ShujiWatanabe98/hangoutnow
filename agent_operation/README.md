# Hangout Now Operation Agent

Hangout Now のユーザー獲得、ダウンロード、初回利用、3時間以内のマッチ成立、継続利用を改善する運用エージェントです。

単純なダウンロード数ではなく、対象エリア内の募集密度と `3H Match Rate` を最優先します。

## ファイル

- `AGENT.md`: エージェントの役割、判断基準、禁止事項
- `MILESTONES.md`: 開発中から公開後の成長運用までの段階別タスク
- `PLAYBOOK.md`: 公開前から継続運用までの実行手順
- `CAMPAIGN_BRIEF.md`: 施策を開始するときの入力テンプレート
- `WEEKLY_REPORT.md`: 週次レビューの出力テンプレート

## 使い方

AIエージェントに次のように依頼します。

```text
agent_operation/AGENT.md と agent_operation/PLAYBOOK.md に従ってください。
現在地を agent_operation/MILESTONES.md の開始条件から判定してください。
agent_operation/CAMPAIGN_BRIEF.md を今回の条件で埋め、今週実施する施策を最大3件提案してください。
未入力の数値は推測せず、unknown としてください。
```

週次レビューでは、分析対象期間と匿名化された集計値だけを渡します。氏名、連絡先、正確なGPS座標、トークン、非公開メッセージは渡さないでください。

## 成功の定義

成功は次の順で評価します。

1. 安全上の重大事故がない
2. 対象エリア・時間帯で十分な募集が見つかる
3. `3H Match Rate` が改善する
4. 初回Hangout成立率と実参加率が改善する
5. 7日・30日継続率が改善する
6. 上記を維持したまま、質の高いダウンロードが増える
