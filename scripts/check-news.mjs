import Parser from 'rss-parser';
import fs from 'node:fs/promises';

const FEEDS_PATH = new URL('../feeds.json', import.meta.url);
const SEEN_PATH = new URL('../data/seen.json', import.meta.url);
const MAX_SEEN_PER_FEED = 300;
const POST_INTERVAL_MS = 1200;

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!webhookUrl) {
  console.error('DISCORD_WEBHOOK_URL is not set. Aborting.');
  process.exit(1);
}

const parser = new Parser();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadJson(url, fallback) {
  try {
    const text = await fs.readFile(url, 'utf-8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function summarize(title, contentSnippet, link) {
  if (!anthropicKey) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `次のニュース記事を日本語で2文以内に要約してください。\nタイトル: ${title}\n本文抜粋: ${contentSnippet ?? '(なし)'}\nURL: ${link}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error('Anthropic API error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? null;
  } catch (err) {
    console.error('Summarize failed:', err.message);
    return null;
  }
}

async function postToDiscord(feedName, item, summary) {
  const embed = {
    title: (item.title ?? '(no title)').slice(0, 256),
    url: item.link,
    description: (summary ?? item.contentSnippet ?? '').slice(0, 300),
    footer: { text: feedName },
    timestamp: item.isoDate ?? undefined,
  };
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) {
    console.error('Discord post failed:', res.status, await res.text());
  }
}

async function main() {
  const feeds = await loadJson(FEEDS_PATH, []);
  const seen = await loadJson(SEEN_PATH, {});
  let changed = false;

  for (const feed of feeds) {
    let parsed;
    try {
      parsed = await parser.parseURL(feed.url);
    } catch (err) {
      console.error(`Failed to fetch feed ${feed.name} (${feed.url}):`, err.message);
      continue;
    }

    const items = parsed.items ?? [];
    const isFirstRun = !(feed.url in seen);
    const seenIds = new Set(seen[feed.url] ?? []);

    const newItems = items.filter((item) => {
      const id = item.guid || item.link;
      return id && !seenIds.has(id);
    });

    if (isFirstRun) {
      console.log(`[${feed.name}] first run: bootstrapping ${items.length} item(s) without posting`);
    } else if (newItems.length > 0) {
      const ordered = [...newItems].reverse();
      for (const item of ordered) {
        const summary = await summarize(item.title, item.contentSnippet, item.link);
        await postToDiscord(feed.name, item, summary);
        await sleep(POST_INTERVAL_MS);
      }
      console.log(`[${feed.name}] posted ${ordered.length} new item(s)`);
    }

    for (const item of items) {
      const id = item.guid || item.link;
      if (id) seenIds.add(id);
    }
    seen[feed.url] = [...seenIds].slice(-MAX_SEEN_PER_FEED);
    changed = true;
  }

  if (changed) {
    await fs.writeFile(SEEN_PATH, `${JSON.stringify(seen, null, 2)}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
