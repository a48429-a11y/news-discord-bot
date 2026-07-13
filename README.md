# news-discord-bot

ニュースRSSフィード（Reuters/NHK/BBCなど）を10分おきに自動チェックし、新着記事をDiscordに投稿するBotです。GitHub Actionsだけで動くので、常時起動しておくサーバーは不要です。

## 仕組み

- GitHub Actionsが10分おきに`scripts/check-news.mjs`を実行
- `feeds.json`に書かれたRSSフィードを取得し、前回までに投稿済みの記事（`data/seen.json`に記録）と比較
- 新着記事があればDiscordのWebhookに投稿し、`data/seen.json`を更新してコミット
- 各フィードを初めてチェックするとき（初回実行時）は、その時点の記事を「既読」として記録するだけで投稿はしません（過去記事が大量投稿されるのを防ぐため）

## セットアップ手順

### 1. Discord Webhookを作成する

1. 投稿したいDiscordサーバー・チャンネルの設定を開く
2. 「連携サービス」→「ウェブフック」→「新しいウェブフック」を作成
3. 発行された Webhook URL をコピーする

### 2. GitHub Secretsに登録する

このリポジトリの `Settings` → `Secrets and variables` → `Actions` → `New repository secret` で以下を登録してください。

| Name | 値 | 必須 |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | 手順1でコピーしたWebhook URL | 必須 |
| `ANTHROPIC_API_KEY` | Anthropic APIキー（要約機能を使う場合のみ） | 任意 |

`ANTHROPIC_API_KEY` を設定しない場合、Botは記事の要約をせず、タイトルとリンクだけをDiscordに投稿します（追加課金なし）。後から設定すれば、次回実行分からAI要約が自動で有効になります。

### 3. 動作確認

Secretsを登録したら、GitHubの `Actions` タブ →「News to Discord」→「Run workflow」で手動実行できます。初回はブートストラップ（既読登録のみ）なので、Discordには何も投稿されません。2回目以降の実行で新着記事があれば投稿されます。

## カスタマイズ

- **監視するニュースサイトを変える/追加する**: `feeds.json` を編集してください。`name`（表示名）と `url`（RSSフィードのURL）を追加するだけです。
- **チェック頻度を変える**: `.github/workflows/news-bot.yml` の `cron: '*/10 * * * *'` を編集してください（例: 1時間おきなら `0 * * * *`）。
- ※ Reutersは公式のRSS配信を終了しているため、Google Newsのサイト内検索RSS（`site:reuters.com`）経由で代用しています。
