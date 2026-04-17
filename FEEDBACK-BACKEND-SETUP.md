# Sheet sync — Setup for Comments + Study Logs

The Study Sprint companion stores everything locally in each student's browser
first. When you turn on Sheet sync, two new things happen automatically:

- **Topic comments** (the `💬` button next to every topic header) → appended to the **Comments** tab
- **Study Log entries** (the `📝 Study Log` panel inside the Companion) → appended to the **StudyLogs** tab, with edits / deletes also recorded

> ⚠️ **Important about your share link:**
> The "anyone with the link can edit" link you created is for *humans* opening the Sheet in their browser. It does **not** let arbitrary front-end JavaScript write to the Sheet — Google's REST API requires OAuth (which would mean exposing a key, which would be unsafe).
>
> The fix is the standard pattern below: deploy a small Apps Script that lives **inside** the Sheet. The script has implicit permission to write, so the front-end just POSTs JSON to the script's URL. No keys exposed.

---

## Your Sheet

```
ID:   1Aoxb3lmWjh-05Fg3oexTW5zsHnS8qoy4VYv37T4BhUI
Link: https://docs.google.com/spreadsheets/d/1Aoxb3lmWjh-05Fg3oexTW5zsHnS8qoy4VYv37T4BhUI/edit
```

---

## Setup (15 minutes, once)

### 1. Prepare two tabs in the Sheet

Open the Sheet and rename / create two tabs:

**Tab `Comments`** — header row:
```
Time | Page | Topic | Suggestion | UA | IP-hash
```

**Tab `StudyLogs`** — header row:
```
Time | Action | Page | Date | Note | Attachment | EntryID | UA | IP-hash
```

(`Action` will be `study-log`, `study-log-edit`, or `study-log-delete`.)

### 2. Open Apps Script

In the Sheet: **Extensions → Apps Script**. Delete whatever's there. Paste this:

```javascript
/**
 * Study Sprint — sync endpoint for topic comments and study logs.
 * Bound to spreadsheet 1Aoxb3lmWjh-05Fg3oexTW5zsHnS8qoy4VYv37T4BhUI
 */

const SHEET_ID = '1Aoxb3lmWjh-05Fg3oexTW5zsHnS8qoy4VYv37T4BhUI';
const RATE_LIMIT_PER_HOUR = 60;
const MAX_TEXT = 1000;
const BANNED_PATTERNS = [
  /https?:\/\//i,
  /<script/i,
  /\b(viagra|crypto|casino|seo\s+services|porn)\b/i
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    // 1. Honeypot — silently drop bot submissions
    if (data.website) return ok();

    // 2. Per-IP rate limit (hash from UA + timestamp window)
    const ipKey = Utilities.base64Encode(
      Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        String(data.ua || '') + ':' + Math.floor(Date.now() / 60000)
      )
    ).slice(0, 12);
    const cache = CacheService.getScriptCache();
    const k = 'rl:' + ipKey;
    const n = parseInt(cache.get(k) || '0', 10);
    if (n >= RATE_LIMIT_PER_HOUR) return ok();
    cache.put(k, String(n + 1), 3600);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const action = String(data.topic || '').slice(0, 40);

    // Decide which sheet to write to based on the topic field
    if (action === 'study-log' || action === 'study-log-edit' || action === 'study-log-delete') {
      const sh = ss.getSheetByName('StudyLogs') || ss.insertSheet('StudyLogs');
      const note = clean(data.text || '');
      if (action === 'study-log' && (!note || note.length < 2)) return ok();
      if (action === 'study-log' && spammy(note)) return ok();
      sh.appendRow([
        new Date(),
        action,
        clean(data.page).slice(0, 80),
        clean(data.date || '').slice(0, 12),
        note.slice(0, MAX_TEXT),
        clean(data.attachment || '').slice(0, 300),
        clean(data.id || '').slice(0, 40),
        clean(data.ua || '').slice(0, 120),
        ipKey
      ]);
    } else {
      // Default: topic comment
      const sh = ss.getSheetByName('Comments') || ss.insertSheet('Comments');
      const text = clean(data.text || '');
      if (text.length < 3) return ok();
      if (spammy(text)) return ok();
      sh.appendRow([
        new Date(),
        clean(data.page).slice(0, 80),
        action,
        text.slice(0, MAX_TEXT),
        clean(data.ua || '').slice(0, 120),
        ipKey
      ]);
    }

    return ok();
  } catch (err) {
    return ok(); // never leak errors to a public endpoint
  }
}

function clean(s) { return String(s || '').replace(/[\u0000-\u001F\u007F]/g, '').trim(); }
function spammy(s) { return BANNED_PATTERNS.some(function (p) { return p.test(s); }); }
function ok() {
  return ContentService.createTextOutput('ok')
    .setMimeType(ContentService.MimeType.TEXT);
}
```

### 3. Deploy as a Web App

1. **Deploy → New deployment**
2. Type: **Web app**
3. Description: `Study Sprint sync v1`
4. Execute as: **Me (your Google account)**
5. Who has access: **Anyone** (the script itself does the validation; the Sheet stays private)
6. Click **Deploy**, accept the permission prompt, and copy the URL it gives you.
   It looks like:
   ```
   https://script.google.com/macros/s/AKfycb...../exec
   ```

### 4. Wire the URL into the site

Open `app.js`, find:
```js
var SS_SHEET_URL = '';
```
Paste your URL between the quotes:
```js
var SS_SHEET_URL = 'https://script.google.com/macros/s/AKfycb...../exec';
```
Commit + push. Vercel rebuilds in ~30 seconds.

> If you'd rather just paste the URL into the chat, I'll edit the file and push it for you.

---

## What gets sent (everything is capped & sanitised)

| Field | From | Cap |
|---|---|---|
| `page` | URL of the page (`/physics-hl-content`) | 80 chars |
| `topic` | Topic anchor id, or `study-log` / `study-log-edit` / `study-log-delete` | 40 chars |
| `text` | The suggestion or reflection | 1000 chars |
| `date` | Date stamp on log entries | 12 chars |
| `attachment` | Optional URL the student pasted | 300 chars |
| `id` | Stable id so edits update the same logical entry in your sheet | 40 chars |
| `ua` | Browser user-agent (helps you spot bots) | 120 chars |
| `website` | **Honeypot** — bots fill this; humans never see it. Silently dropped. | — |

The script also enforces:
- 60 messages / hour / IP-hash
- Spam pattern filter (urls, `<script>`, common spam keywords)
- Empty / too-short messages dropped
- All control characters stripped

---

## Front-end safety (already shipped)

- 500-char cap on comments, 1000-char on study logs (both with live counters)
- Honeypot `<input name="website">` (off-screen)
- Rate limit per browser: comments 1/10s & 8/hr · logs 1/5s & 30/hr
- All persisted text is HTML-escaped before render (no XSS even from your own past entries)
- Local storage is the source of truth — site keeps working if Apps Script is down

---

## Reading the sheet

- **Comments** tab: sort by `Topic` to cluster suggestions about the same concept. Add a `Status` column (`open / fixed / wontfix`) and tick them off as you fix the site.
- **StudyLogs** tab: filter `Action = study-log` to see only fresh entries. `study-log-edit` and `study-log-delete` rows are an audit trail — same `EntryID` lets you trace a single reflection over time.

A 5-minute weekly scroll keeps the site evolving with your students.

---

## When to graduate from Apps Script

Move to a Cloudflare Worker + D1 if:
- You see > 50 spam rows / day despite the filters
- You want to display comments to *other* students (currently they're private to each browser)
- You want real-time moderation / Turnstile captcha
- You add multiple sites and want one shared backend

Same `sendBeacon` POST contract — just swap the URL.
