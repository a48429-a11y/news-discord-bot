# news-discord-bot

世界各地域のニュースRSSフィードを10分おきに自動チェックし、新着記事を地域別のDiscordチャンネルに振り分けて投稿するBotです。GitHub Actionsだけで動くので、常時起動しておくサーバーは不要です。

## 仕組み

- GitHub Actionsが10分おきに`scripts/check-news.mjs`を実行
- `feeds.json`に書かれたRSSフィードを取得し、前回までに投稿済みの記事（`data/seen.json`に記録）と比較
- 新着記事があれば、そのフィードの`channel`タグに対応するDiscord Webhookに投稿し、`data/seen.json`を更新してコミット
- 各フィードを初めてチェックするとき（初回実行時）は、その時点の記事を「既読」として記録するだけで投稿はしません（過去記事が大量投稿されるのを防ぐため）
- `channel`タグに対応するWebhook Secretが未設定のフィードは、投稿・既読登録ともにスキップされます（後からSecretを追加すれば、その時点からそのフィードが動き出します）

## 対応チャンネル

`feeds.json`の各フィードには`channel`タグが付いており、以下のSecret名に対応するWebhookへ投稿されます。

| channel | 地域 | Secret名 |
|---|---|---|
| `general` | 世界全般(Reuters/BBC) | `DISCORD_WEBHOOK_URL` |
| `jp` | 日本 | `DISCORD_WEBHOOK_JP` |
| `na` | 北米 | `DISCORD_WEBHOOK_NA` |
| `cn` | 中国 | `DISCORD_WEBHOOK_CN` |
| `eu` | 北欧・西欧・南欧 | `DISCORD_WEBHOOK_EU` |
| `kr` | 朝鮮半島 | `DISCORD_WEBHOOK_KR` |
| `me` | 中東 | `DISCORD_WEBHOOK_ME` |
| `af` | アフリカ | `DISCORD_WEBHOOK_AF` |
| `latam` | 中南米 | `DISCORD_WEBHOOK_LATAM` |
| `oc` | オセアニア | `DISCORD_WEBHOOK_OC` |

## セットアップ手順

### 1. Discord Webhookを作成する

投稿したい地域ごとにDiscordチャンネルを作成し、それぞれで「連携サービス」→「ウェブフック」→「新しいウェブフック」→「ウェブフックURLをコピー」を行います。

### 2. GitHub Secretsに登録する

このリポジトリの `Settings` → `Secrets and variables` → `Actions` → `New repository secret` で、上の対応表のSecret名にそれぞれのWebhook URLを登録してください。全チャンネル分を一度に用意する必要はなく、できたものから順に登録すれば、その地域だけ動き出します。

さらに任意で以下も登録できます。

| Name | 値 | 必須 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic APIキー（要約機能を使う場合のみ） | 任意 |

`ANTHROPIC_API_KEY` を設定しない場合、Botは記事の要約をせず、タイトルとリンクだけをDiscordに投稿します（追加課金なし）。後から設定すれば、次回実行分からAI要約が自動で有効になります。

### 3. 動作確認

Secretsを登録したら、GitHubの `Actions` タブ →「News to Discord」→「Run workflow」で手動実行できます。初回はブートストラップ（既読登録のみ）なので、Discordには何も投稿されません。2回目以降の実行で新着記事があれば投稿されます。

## カスタマイズ

- **監視するニュースサイトを変える/追加する**: `feeds.json` を編集してください。`name`（表示名）・`url`（RSSフィードのURL）・`channel`（上の対応表のタグ、省略時は`general`）を追加するだけです。
- **チェック頻度を変える**: `.github/workflows/news-bot.yml` の `cron: '*/10 * * * *'` を編集してください（例: 1時間おきなら `0 * * * *`）。
- ※ Reuters/AP/Euronewsは公式のRSS配信を終了している、または不安定なため、Google Newsのサイト内検索RSS（`site:reuters.com`など）経由で代用しています。
