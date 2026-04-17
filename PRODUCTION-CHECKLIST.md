# Study Sprint — Production Readiness Checklist

A short, honest list of what's left between today's build and a polished
public launch. Tick them off in any order.

---

## 1. Backend wiring (5 min — needs you)

- [ ] Open `FEEDBACK-BACKEND-SETUP.md` and follow steps 1–3 (create the two
      tabs, paste the Apps Script, deploy as Web App).
- [ ] Copy the deployment URL (`https://script.google.com/macros/s/.../exec`).
- [ ] Paste it into `app.js`:
      ```js
      var SS_SHEET_URL = 'https://script.google.com/macros/s/.../exec';
      ```
- [ ] Commit + push. Vercel rebuilds in ~30 s.
- [ ] Smoke-test: open any subject page → leave a test comment → confirm
      the row lands in the **Comments** tab. Then add a Study Log entry →
      confirm it lands in **StudyLogs**.

Until this is wired, everything still works for each student locally; only
the central sheet stays empty.

---

## 2. SEO + social previews (10 min)

For each top-level HTML page (`index.html`, `ib-physics-hl.html`,
`ib-chemistry-hl.html`, `ib-math-aa-hl.html`, `fysik2.html`, `kemi2.html`,
`matematik5.html`):

- [ ] `<title>` describes the subject (e.g. "IB Physics HL — Study Sprint").
- [ ] `<meta name="description" content="…one sentence…">`.
- [ ] Open Graph tags so links unfurl nicely on WhatsApp / Discord:
      ```html
      <meta property="og:title" content="…">
      <meta property="og:description" content="…">
      <meta property="og:image" content="https://study-sprint-kocin.vercel.app/og.png">
      <meta property="og:url" content="https://study-sprint-kocin.vercel.app/…">
      ```
- [ ] Add a 1200×630 PNG at `/og.png` (any clean cover with the title).
- [ ] Add a `favicon.ico` or `favicon.svg` linked from `<head>`.
- [ ] Add `sitemap.xml` and `robots.txt` at the root.

---

## 3. Performance pass (15 min)

- [ ] Run Lighthouse on the deployed URL. Target ≥ 90 on Performance,
      Accessibility, Best Practices, SEO.
- [ ] Add `loading="lazy"` and `decoding="async"` to every `<img>` below
      the fold.
- [ ] Add `defer` to `<script src="app.js">` if it isn't already.
- [ ] Confirm `extras.css` is the only stylesheet (avoid render-blocking
      duplicates).
- [ ] Optional: precompress big notes PDFs or move them to a release
      bucket so the initial HTML stays light.

---

## 4. Accessibility audit (10 min)

- [ ] Tab through every page with the keyboard — focus rings should be
      visible on all interactive items in the floating launcher and
      Companion tabs.
- [ ] Run axe DevTools or Lighthouse a11y on one subject page.
- [ ] Confirm `prefers-reduced-motion` actually disables the scroll
      animation (DevTools → Rendering → Emulate CSS media feature).
- [ ] Confirm dark-mode contrast on the new Recovery panel.

---

## 5. Privacy + safety note (5 min)

Add a small footer link "Privacy" pointing to a one-paragraph page that
states honestly:

> Study Sprint stores your progress, streaks and study log in your own
> browser (localStorage). When you leave a topic comment or save a study
> log, that text — together with a one-way hash of your browser /
> network signature for spam control — is appended to a private Google
> Sheet visible only to the site owner. Nothing is shared with third
> parties. No accounts, no cookies, no tracking pixels.

---

## 6. Content sweep (one evening)

- [ ] Skim each subject page top-to-bottom on a phone — anything that
      wraps badly, looks cut off, or feels redundant?
- [ ] Pick one or two topics on each page and add a worked example, a
      common-mistake callout, or a memorable mnemonic. The Companion is
      strong; the *content* is what students stay for.
- [ ] Make sure every external link opens with `rel="noopener"`.

---

## 7. Pre-launch smoke test

Run through this on a fresh browser profile (or incognito) so localStorage
starts empty:

- [ ] Homepage loads, dark-mode toggle works, search returns results.
- [ ] Open IB Physics HL → onboarding card appears → dismiss it → it
      stays dismissed on reload.
- [ ] Click 🧘 in the floating launcher → Companion opens, all six tabs
      switch (Wellbeing, Pomodoro, Streak, Log, Recovery, How to Study).
- [ ] Take the Recovery 60-second check → score appears, persists on
      reload, "Open Recovery" CTA in the burnout banner jumps to it.
- [ ] Pomodoro: start a 1-minute test cycle → end-chime plays → streak
      ticks up.
- [ ] Add a study log entry → edit it → delete it → all three sync
      attempts hit the sheet (`study-log`, `study-log-edit`,
      `study-log-delete`).
- [ ] Leave a topic comment with the honeypot field (DevTools) filled →
      confirm it's silently dropped.
- [ ] Resize to 360 px wide → tabs scroll horizontally, launcher is
      icon-only, modals fill the screen, Pomodoro ring is 170 px.
- [ ] 404: visit `/does-not-exist` → custom 404 page appears.

---

## 8. Nice-to-have, not blockers

- [ ] Service worker for offline read of already-visited pages.
- [ ] Weekly digest email (Apps Script trigger → email of new comments).
- [ ] Burnout proactive nudge: when a student crosses the threshold three
      sessions in a row, surface the Recovery CTA on next visit.
- [ ] Move from Apps Script to Cloudflare Workers + D1 if comment volume
      ever exceeds ~50 / day or you want to display peer comments back.
- [ ] Add a tiny "Last updated: YYYY-MM-DD" stamp on each subject page so
      students know the notes are alive.

---

That's it. Items 1–4 are the actual launch blockers; the rest is polish
you can do across the term as students start using it.
