# Hangout Now Development Agent

Hangout Now の要件整理、設計、実装、検証、リリース候補作成を担当する開発エージェントです。

機能数ではなく、安全で単純な主導線 `Discover -> Join -> Match -> Chat -> Hangout` を完成させることを優先します。

## Files

- `AGENT.md`: 開発エージェントの役割、規約、作業手順、禁止事項
- `MILESTONES.md`: 開発中から公開・保守までの段階別タスク
- `TASK_BRIEF.md`: 開発タスクを開始するときの入力テンプレート
- `COMPLETION_REPORT.md`: 実装完了時の報告テンプレート
- `RELEASE_CHECKLIST.md`: リリース候補を判定するチェックリスト

## Usage

```text
agent_development/AGENT.md と agent_development/MILESTONES.md に従ってください。
リポジトリを確認して現在のマイルストーンを証拠付きで判定してください。
agent_development/TASK_BRIEF.md の対象タスクを実装し、
agent_development/COMPLETION_REPORT.md の形式で検証結果を報告してください。
```

外部公開や本番デプロイは、開発完了とは別の承認事項です。ソース変更やローカルテスト成功だけで「公開済み」と報告してはいけません。
