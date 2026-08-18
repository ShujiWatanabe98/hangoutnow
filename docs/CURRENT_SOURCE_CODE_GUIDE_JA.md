# HangoutNow 現行ソースコード ツリーと解説

> 調査対象: ローカルリポジトリの `2a8f8e5`（2026-08-18 時点）。
> 
> この資料は、追跡対象のソース・設定・テストを対象にした保守向けの案内です。`node_modules/`、`dist/`、Expo のキャッシュなどの生成物はツリーから省略しています。

## 1. 全体像

HangoutNow は npm workspaces による TypeScript モノレポです。「人を先にマッチさせる」のではなく、Hangout（今から行う活動）を起点に参加申請、承認、チャット、実施へ進む構成です。

```text
ブラウザ公開サイト / デモ (apps/demo) ─┐
Expo モバイルアプリ (apps/mobile) ────────┼─ REST / Socket.IO ── NestJS API (apps/api)
運営管理画面 (apps/admin) ────────────────┘                         │
                                                                    ├─ PostgreSQL + PostGIS
                                                                    └─ S3 互換オブジェクトストレージ（本番画像）
```

- `apps/api` が認証・ドメインルール・永続化・通知を一元的に担当する。
- `apps/mobile` は Expo / React Native の参加者・主催者向けクライアント、`apps/demo` は公開サイトとブラウザデモである。
- `apps/admin` は通報の確認とモデレーション操作に限定した Next.js 管理画面である。
- API は、未承認の閲覧者には正確な集合場所・住所・座標を返さない。承認後にのみ詳細を返す。

## 2. リポジトリツリー

```text
hangoutnow/
├─ apps/
│  ├─ api/                         # NestJS API と Prisma
│  │  ├─ src/
│  │  │  ├─ auth/                  # メール、デモ、OAuth、電話認証、プロフィール
│  │  │  ├─ hangouts/              # Hangout 作成・検索・申請・承認・実施・評価
│  │  │  ├─ chat/                  # Hangout チャット、条件付き 1:1 チャット
│  │  │  ├─ notifications/         # 通知、Push token、Socket.IO Gateway
│  │  │  ├─ safety/                # ブロック、通報、運営モデレーション
│  │  │  ├─ analytics/             # ファネルイベント
│  │  │  ├─ demo/                  # デモ利用者専用の初期化・履歴生成
│  │  │  ├─ newsletter/            # 購読・配信・配信停止
│  │  │  ├─ host-status/           # 主催者ランク計算
│  │  │  ├─ storage/               # プロフィール/Hangout画像の保存処理
│  │  │  ├─ prisma/                # PrismaService
│  │  │  ├─ health/                # ヘルスチェック
│  │  │  ├─ app.module.ts          # モジュール、Controller、Provider の組立て
│  │  │  └─ main.ts                # CORS、入力検証、2 MB body 制限、起動
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma          # PostgreSQL の論理スキーマ
│  │  │  └─ migrations/            # 23 本の順序付きマイグレーション
│  │  ├─ test/                     # API の Vitest テスト
│  │  ├─ Dockerfile                # API の Render/コンテナ用ビルド
│  │  └─ package.json
│  ├─ mobile/                      # Expo / React Native アプリ
│  │  ├─ src/App.tsx               # 画面、API呼び出し、Socket.IO、状態管理
│  │  ├─ App.tsx                   # src/App.tsx の再エクスポート入口
│  │  ├─ assets/                   # アプリアイコン・スプラッシュ
│  │  ├─ store-assets/             # ストア提出用アセット
│  │  ├─ app.json / eas.json       # Expo と EAS 設定
│  │  └─ package.json
│  ├─ demo/                        # 公開サイトおよびブラウザデモ
│  │  ├─ public/
│  │  │  ├─ index.html             # ランディングページ
│  │  │  ├─ demo.html / app.html   # ブラウザ版アプリ
│  │  │  ├─ app.js                 # デモの画面・APIクライアント
│  │  │  ├─ *.html / *.css / *.js  # SEO記事、規約、安全、購読、共有機能
│  │  │  └─ assets/                # Hangout・プロフィール・OGP画像、ロゴ
│  │  ├─ test/web-parity.test.mjs  # 公開サイトとデモの実装乖離テスト
│  │  ├─ server.mjs                # 静的配信と API プロキシ
│  │  └─ package.json
│  └─ admin/                       # Next.js 運営コンソール
│     └─ app/page.tsx              # 通報一覧、状態変更、警告/停止/復旧
├─ packages/
│  ├─ shared/src/index.ts          # Hangout 開始可能時間の共有定数
│  └─ config/                      # 将来の共有設定パッケージ（READMEのみ）
├─ scripts/
│  ├─ seed-public-demo.mjs         # 公開デモ用データ投入
│  ├─ seed-mutual-five-star-demo.mjs # 1:1 チャット可能な評価済みデモ投入
│  └─ seed-week-history-demo.mjs   # 週次履歴デモ投入
├─ docs/                           # API、設計、デプロイ、セキュリティ、運用資料
├─ agent_*/                        # 開発・運営・マーケティング協働用資料
├─ docker-compose.yml              # ローカル PostGIS と API
├─ render.yaml                     # Render API / demo サービス定義
├─ package.json                    # workspace 共通コマンド
└─ .env.example                    # ローカル環境変数の雛形
```

## 3. 実行単位と責務

| 単位 | 技術 | 主な責務 | 主な起動・検証 |
| --- | --- | --- | --- |
| `@hangout-now/api` | NestJS 11、Prisma 6 | 認証、Hangout、チャット、安全、通知、画像、購読 | `npm run dev:api` / `npm run test -w @hangout-now/api` |
| `@hangout-now/mobile` | Expo 54、React Native | ネイティブ利用者体験、SecureStore、位置情報、Push、Socket.IO | `npm start -w @hangout-now/mobile` |
| `@hangout-now/demo` | Node.js HTTP、静的 HTML/CSS/JS | 公開サイト、デモ、API への同一オリジンプロキシ | `npm start -w @hangout-now/demo` |
| `@hangout-now/admin` | Next.js 15 | 運営トークンを使う通報対応 | 型検査のみ定義 |
| `@hangout-now/shared` | TypeScript | 30/60/180 分の開始時間定数 | 型検査のみ定義 |

ルートの `lint`、`typecheck`、`test` は、各 workspace に同名スクリプトがある場合にまとめて実行する。Node.js 20 以上が前提である。

## 4. 主要な利用フロー

1. **Discover**: モバイルまたはデモが `GET /hangouts` を呼び、時間帯・位置・半径で OPEN の Hangout を取得する。サービスエリアは新宿・渋谷である。
2. **Join**: 利用者はメッセージ付きで `POST /hangouts/:id/join` を送る。性別・年齢・ブロック・定員・アカウント状態を API が判定する。
3. **Match**: 主催者は申請を `POST /join-requests/:id/accept` または `reject` で処理する。満員時は waitlist、参加者は出欠を更新できる。
4. **Chat**: 承認者だけが活動の `chat-rooms` を読書きできる。終了済み Hangout で相互に 5 点評価済みの組み合わせのみ `direct-chats` を作成できる。
5. **Hangout**: 主催者が `start`、その後 `finish` を実行する。終了後は参加者評価と履歴表示を行う。

モバイルは `home`、`map`、`create`、`detail`、`phone`、`chat`、`rating`、`profile`、`notifications` の 9 画面を `apps/mobile/src/App.tsx` で保持する。主催者とゲストのデモログインもこのアプリ側で扱う。

## 5. API とドメイン境界

### 認証・利用者

- `/auth`: メール登録・ログイン・トークン更新・デモログインに加え、LINE、Google、Apple、X の OAuth 開始/コールバック/引換を提供する。
- `/users/me`: 自分のプロフィール、主催者ステータス、プロフィール更新・退会、電話番号認証を扱う。
- アクセストークンは JWT、リフレッシュトークンはハッシュ化して DB に保存する。全体にレート制限があり、認証の登録・ログインはより厳しい制限を設定する。

### Hangout と位置情報

- `/hangouts`: 作成、一覧、詳細、更新、取消、ハート、申請、開始、終了、評価を扱う。
- `/join-requests`: 主催者の承認・拒否と、参加者の出欠を扱う。
- `Hangout` には公開場所と集合場所を分離して持つ。未承認者には公開用の概略位置だけを返し、集合場所名、住所、経路 URL、正確な緯度経度を秘匿する。
- 作成には電話認証とプロフィール写真が必要で、画像は API で正規化する。本番は S3 互換ストレージが未設定なら失敗閉鎖する。

### 会話・通知・安全

- `/chat-rooms` は Hangout 参加者向け、`/direct-chats` は相互 5 点評価後の 1:1 向けである。
- `/notifications` は通知一覧、既読、一括削除、Push token、設定を扱う。`RealtimeGateway` が認証済み Socket.IO 接続へ通知イベントを送る。
- `/safety` はブロックと通報、`/admin/reports` は管理トークンを必須とする通報処理である。運営操作は `WARNING`、`SUSPEND`、`BAN`、`RESTORE` 等を記録する。
- `/analytics/events` は発見・詳細閲覧・申請・承認・作成・完了のファネルを保存する。`/newsletter/subscriptions` は同意付き購読・配信停止を扱う。

## 6. データモデル

`apps/api/prisma/schema.prisma` が唯一の DB モデル定義で、変更には `apps/api/prisma/migrations/` に新しい Prisma マイグレーションが必要である。

| 領域 | 主なモデル | 内容 |
| --- | --- | --- |
| 利用者・認証 | `User`、`RefreshToken`、`OAuthIdentity`、`OAuthLoginTicket`、`PhoneVerification` | アカウント、認証連携、電話認証、アカウント状態 |
| 活動 | `Hangout`、`JoinRequest`、`HangoutHeart`、`HangoutRating` | 活動、申請/出欠、保存、実施後評価 |
| 会話 | `ChatRoom`、`Message`、`DirectChat`、`DirectMessage` | 活動内および条件付き 1:1 のメッセージ |
| 信頼・安全 | `Block`、`Report`、`ModerationAction`、`UserStamp` | 相互非表示、通報と運営履歴、信頼表示 |
| 配信・計測 | `Notification`、`PushToken`、`FunnelEvent`、`NewsletterSubscription` | 通知、Push 登録、行動計測、メール購読 |
| 興味 | `Interest`、`UserInterest` | 興味タグの多対多関係 |

重要な状態は `HangoutStatus`（`OPEN`、`FULL`、`STARTED`、`FINISHED`、`CANCELLED`）、`JoinRequestStatus`、`AttendanceStatus`、`AccountStatus` で表現される。

## 7. ローカル開発とデプロイ

### ローカル

1. `.env.example` を `.env` に複製して必須値を設定する。
2. `docker compose up -d` で PostGIS と API を起動する。PostgreSQL はホストの `5433`、API は `3000` を使う。
3. API は起動時に `prisma migrate deploy` を実行する。開発でスキーマを編集した場合は `npm run prisma:migrate -w @hangout-now/api`、その後 `npm run prisma:generate -w @hangout-now/api` を実行する。
4. 公開サイト/デモは `npm start -w @hangout-now/demo`（既定 `4173`）で起動する。`API_URL` または `DEMO_PROXY_API_URL` があれば `/api/*` を API にプロキシする。

### Render

- `render.yaml` は `hangoutnow-api`（Docker、Starter）と `hangoutnow-demo`（Node、Free）を定義する。
- API は `GET /health` を health check に用い、CORS は `method-more.com` とデモのオリジンを許可する。
- 本番 DB、OAuth secret、S3、Twilio、Resend の秘匿値は Render 側で手動設定する。リポジトリや `.env.example` に実値を置かない。

## 8. テストが守る代表ルール

`apps/api/test/` と `apps/demo/test/` は、少なくとも次を自動確認する。

- 不正入力・未認証・年齢/性別/定員/ブロックの制約
- 正確な集合場所を承認前に漏らさないこと
- 主催者を常に 1 人にすること、キャンセルと終了後削除の違い
- 出欠キャンセルによる waitlist の繰上げ
- チャットの権限制御、相互 5 点評価後だけの 1:1 チャット
- 画像の形式・サイズ正規化と本番ストレージの fail-closed 動作
- 通知設定・ニュースレター同意/配信停止・デモ専用リセット
- 公開サイトとブラウザデモが同じアプリ資産・主要フローを使うこと

変更時は、少なくとも `npm run lint`、`npm run typecheck`、`npm test` を実行する。仕様変更が API、Prisma、モバイルにまたがる場合は、DTO、マイグレーション、型、画面、テストを同時に更新する。
