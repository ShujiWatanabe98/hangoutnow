# RoboReha Render移行構成

## 現在の互換フェーズ

- `hangoutnow-demo` が method-more.com、管理画面、RoboRehaへの入口を提供する。
- `methodmore-roboreha-private` は現時点では無料Web Serviceであり、名前にprivateを含むが公開URLを持つ。
- RoboReha動画は共通保存APIを通す。Renderでは移行完了まで `ROBOREHA_VIDEO_STORAGE_MODE=local` を明示する。
- `/api/healthz` の `videoStorage.durable` が `false` の間、動画はRender再デプロイやスピンダウンで失われ得るため、実患者データを保存しない。

## 目標構成

1. `methodmore-gateway`：公開Web Service。method-more.com、Basic認証、静的画面、RoboRehaへの中継を担当する。
2. `roboreha-app`：Private Service。RoboRehaの画面・APIを担当し、外部から直接アクセスさせない。
3. `roboreha-db`：RoboReha専用Render Postgres。`roboreha` スキーマの移行確認後に接続先を切り替える。
4. 非公開S3互換バケット：評価動画と身体機能動画を保存する。公開URLは付与せず、RoboReha API経由で認証付き配信する。
5. `hangoutnow-api` と `salonrecord` は業務とデータ所有者が異なるため、統合せず独立サービスを維持する。

## S3互換ストレージ設定

Private Serviceへ次のSecretを登録し、接続テスト後に `ROBOREHA_VIDEO_STORAGE_MODE=s3` へ変更する。

- `ROBOREHA_S3_REGION`
- `ROBOREHA_S3_BUCKET`
- `ROBOREHA_S3_ACCESS_KEY_ID`
- `ROBOREHA_S3_SECRET_ACCESS_KEY`
- `ROBOREHA_S3_ENDPOINT`（AWS S3以外の場合）
- `ROBOREHA_S3_PREFIX`（省略時 `roboreha-videos`）
- `ROBOREHA_S3_FORCE_PATH_STYLE`（必要なプロバイダーのみ `true`）

## 無停止の切替順序

1. 非公開バケットを作成し、テスト用オブジェクトの保存・Range再生・削除を検証する。
2. 現行Postgresのバックアップを作成し、RoboReha専用DBへリストアする。
3. 専用DBでマイグレーション、100名デモデータ、予約、会計、動画メタデータを照合する。
4. `roboreha-app` Private Serviceを作成し、内部URLからヘルスチェックと主要画面を確認する。
5. Gatewayの上流だけをPrivate Serviceへ変更する。旧サービスはロールバック用に保持する。
6. 公開URLでログイン、評価動画アップロード、Range再生、AI解析、保存、再取得を確認する。
7. 監視期間後に重複サービスを停止する。DBとバケットはバックアップ保持期間を満たすまで削除しない。

## 課金・外部変更の実行ゲート

Private Service、専用Postgres、オブジェクトストレージは継続課金または外部データ送信を伴う。作成前に、利用プロバイダー、リージョン、概算費用、保存期間、認証情報の登録方法を確認する。
