# Student Feedback — Backend Setup & Architecture

The Study Sprint comments box (`💬` next to every topic header) works in two layers:

1. **Local layer (always on)** — every suggestion is saved to the student's own `localStorage`. They can read, edit, hide, delete, and export their own suggestions even when offline. **No backend is required for the site to be useful.**
2. **Optional sync layer** — when `SS_SHEET_URL` in `app.js` is set, every new suggestion is also fired off (via `navigator.sendBeacon`) to a Google Apps Script Web App that appends a row to a Google Sheet. You read the Sheet, see what students struggle with, fix it.

This document explains how to set up the sync layer **safely** for a static-only site.

---

## Why Google Apps Script (and not a "real" backend)?

| Option | Cost | Ops burden | Verdict for this project |
| --- | --- | --- | --- |
| **Google Apps Script + Sheet** | Free, no card | None — Google hosts it | ✅ **Recommended starting point** |
| Cloudflare Worker + KV | Free tier generous | Low — one config file | ✅ **Migrate here if abuse appears** |
| Netlify / Vercel Functions | Free tier | Low | ✅ Good (you already deploy to Vercel) |
| Firebase Firestore | Free tier | Medium — auth, rules | ⚠️ Overkill until you need accounts |
| Self-hosted server | $5/mo | High | ❌ Not worth it for a study site |

**Start with Apps Script.** It writes straight to a Sheet you already know how to read, costs nothing, and survives indefinitely. Migrate to a Cloudflare Worker only if you start seeing spam or need real moderation.

---

## Setup — Google Apps Script (15 minutes)

### 1. Create the Sheet
1. Open <https://sheets.new>
2. Name it: `Study Sprint — Student Feedback`
3. Add a header row: `Time | Page | Topic | Suggestion | UA | IP-hash`

### 2. Add the Apps Script
1. In the Sheet: **Extensions → Apps Script**
2. Paste this (it includes the safety guards the front-end already cooperates with):

```javascript
const RATE_LIMIT_PER_HOUR = 30;            // per IP-hash
const MAX_TEXT = 500;
const BANNED_PATTERNS = [/https?:\/\//i, /<script/i, /\b(viagra|crypto|casino|seo)\b/i];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    // 1. Honeypot — bots fill this; humans never do.
    if (data.website) return ok();              // silently accept & drop

    // 2. Validate fields
    const text  = String(data.text  || '').trim().slice(0, MAX_TEXT);
    const page  = String(data.page  || '').slice(0, 80);
    const topic = String(data.topic || '').slice(0, 80);
    if (text.length < 3) return ok();

    // 3. Spam-pattern filter
    for (const p of BANNED_PATTERNS) if (p.test(text)) return ok();

    // 4. Per-IP rate limit (30/hr) using cached hash
    const ipHash = Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
        (e.parameter && e.parameter.ip) || data.ts + ':' + (data.ua || ''))
    ).slice(0, 12);
    const cache = CacheService.getScriptCache();
    const k = 'rl:' + ipHash;
    const n = parseInt(cache.get(k) || '0', 10);
    if (n >= RATE_LIMIT_PER_HOUR) return ok();
    cache.put(k, String(n + 1), 3600);

    // 5. Append
    const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sh.appendRow([new Date(), page, topic, text, (data.ua || '').slice(0, 120), ipHash]);

    return ok();
  } catch (err) {
    return ok();   // never leak errors to the public endpoint
  }
}

function ok() {
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}
```

### 3. Deploy
1. **Deploy → New deployment → Web app**
2. Execute as: **Me**
3. Who has access: **Anyone**
4. Click **Deploy**, copy the URL.

### 4. Wire it into the site
Open `app.js`, find:
```js
var SS_SHEET_URL = '';
```
and paste your URL between the quotes. Commit + push. Done.

---

## What the front-end already does for you

- **Length cap** — textarea has `maxlength="500"` and a live character counter
- **Honeypot field** — hidden `website` input; submissions where it's filled are dropped
- **Client rate limit** — 1 comment / 10 sec, max 8 / hour per browser (localStorage)
- **Local-first** — everything works offline; the Sheet sync is best-effort
- **Edit / hide / delete** — students manage their own suggestions in-place
- **Export TSV** — a single download per page key for moving feedback into your editor

---

## Threat model — what you're actually protecting against

| Threat | Defence |
| --- | --- |
| Bots posting spam | Honeypot field + spam-pattern filter on the server |
| One person posting 1000 times | Client rate limit + server rate limit per IP-hash |
| Oversized payloads | 500-char cap on both client and server |
| XSS via comment text | All comments are HTML-escaped on render (`replace(/</g, '&lt;')`) |
| Leaking student identities | No accounts, no emails collected, no IP stored — only a 12-char hash |
| Apps Script endpoint going down | Site keeps working — `localStorage` is the source of truth |

You are **not** protecting state secrets. Worst-case abuse is a cluttered Sheet, which you can clear in 10 seconds.

---

## When to migrate to a Cloudflare Worker

Migrate if any of these become true:

- You're getting > 50 spam comments/day despite the filters
- You want real-time moderation (auto-hide flagged comments before you read them)
- You want to display comments to other students (currently they're private to each browser)
- You add multiple sites / multiple sheets and want one shared backend

A Worker + Cloudflare D1 (SQLite) gives you a real database, IP-level rate limiting, and Turnstile (captcha) integration — all on the free tier. Same `sendBeacon` POST contract, just swap the URL.

---

## Reading the Sheet usefully

Sort by `Topic` to cluster suggestions about the same concept. Add a `Status` column (`open / fixed / wontfix`) and update it as you edit topics. A 5-minute weekly scroll through the Sheet is enough to keep the site improving.
