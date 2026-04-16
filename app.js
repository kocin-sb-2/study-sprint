/* ============================================================
   Study Sprint — app.js
   Provides: section/topic toggles, progress tracking,
   in-page search, homepage filter, print mode.

   WHY A SEPARATE FILE:
   Extracting behaviour into one shared script is the DRY
   ("Don't Repeat Yourself") principle in practice — a single
   source of truth means a bug fixed or feature added here
   propagates to every page automatically, rather than requiring
   eight identical edits. It also keeps Cowork-managed HTML
   files lean: only content changes there, nothing else.
============================================================ */

/* ----------------------------------------------------------
   0. SAFE localStorage WRAPPER
   Private browsing or full storage can throw. Wrap all access.
---------------------------------------------------------- */
var _ls = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
  keys: function () { try { return Object.keys(localStorage); } catch (e) { return []; } }
};

/* ----------------------------------------------------------
   1. SECTION & TOPIC TOGGLES
   (previously inlined on every page — now centralised)
   These must stay on `window` because onclick="" attributes
   call them as globals.
---------------------------------------------------------- */
function toggle(id) {
  var body  = document.getElementById('body-'  + id);
  var arrow = document.getElementById('arrow-' + id);
  var header = body ? body.previousElementSibling : null;
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = 'flex';
    if (arrow) arrow.classList.add('open');
    if (header) header.setAttribute('aria-expanded', 'true');
  } else {
    body.style.display = 'none';
    if (arrow) arrow.classList.remove('open');
    if (header) header.setAttribute('aria-expanded', 'false');
  }
}

function toggleTopic(id) {
  var el = document.getElementById('topic-' + id);
  if (!el) return;
  el.classList.toggle('expanded');
  var header = el.querySelector('.topic-header');
  if (header) header.setAttribute('aria-expanded', el.classList.contains('expanded') ? 'true' : 'false');
}

/* ----------------------------------------------------------
   1b. PRACTICE QUESTION SYSTEM — SOLUTION TOGGLE
   Called via onclick="toggleSolution(this)" on each .q-toggle-btn.
   WHY GLOBAL: Cowork generates the HTML and uses onclick="".
   Like toggle() and toggleTopic(), this must live on window.
   WHY SIBLING APPROACH: The solution div immediately follows
   the button in DOM order, making this a zero-dependency lookup.
---------------------------------------------------------- */
function toggleSolution(btn) {
  /* The .q-solution is the next sibling element after the button */
  var sol = btn.nextElementSibling;
  if (!sol || !sol.classList.contains('q-solution')) return;
  var isOpen = sol.classList.toggle('q-solution--open');
  btn.textContent = isOpen ? '▾ Hide Solution' : '▸ Show Solution';
  btn.classList.toggle('q-toggle-btn--open', isOpen);
}

/* ----------------------------------------------------------
   2. BOOT — single unified DOMContentLoaded listener.
   WHY ONE LISTENER: Having two DOMContentLoaded handlers is
   legal but fragile — execution order between them is
   undefined and it makes reading the init sequence harder.
   One consolidated boot block makes it explicit and safe.
---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  var hasTopics  = !!document.querySelector('.topic-list');
  var isHomepage = !!document.querySelector('.systems');

  /* Every page gets dark mode */
  initDarkModeToggle();

  /* Subject pages */
  if (hasTopics && !isHomepage) {
    initProgress();          /* progress bar + done buttons  */
    initSubjectSearch();     /* in-page topic search         */
    initPrintButton();       /* floating print/PDF button    */
    initMindMap();           /* interactive vis.js concept map */
    initQuizMode();          /* quiz mode toggle for PQS     */
    initFeedbackTab();       /* subtle feedback side tab     */
  }

  /* Homepage */
  if (isHomepage) {
    initHomeSearch();        /* subject filter input         */
    injectSyllabusLink();    /* link to syllabus guide       */
    initMasteryDashboard();  /* cross-subject progress panel */
    initFeedbackTab();       /* subtle feedback side tab     */
  }
});

/* ----------------------------------------------------------
   3. PROGRESS TRACKING
   WHY: Cognitive science (Ebbinghaus forgetting curve) shows
   that self-testing and completion signals dramatically improve
   long-term retention. Letting students mark topics "done"
   gives them a visible feedback loop and activates the
   goal-gradient effect — progress bars accelerate effort as
   completion nears (Kivetz et al., 2006).

   HOW: All state lives in localStorage, keyed by page path +
   topic id. Zero server required, works offline, survives
   page refreshes.
---------------------------------------------------------- */
function initProgress() {
  var topics = Array.prototype.slice.call(
    document.querySelectorAll('.topic[id]')
  );
  if (!topics.length) return;

  /* Normalise to just /filename.html so the key is identical whether
     the site is served from the root, a sub-folder (GitHub Pages adds
     a repo-name prefix like /study-sprint/fysik2.html), or file://. */
  var pageKey = '/' + location.pathname.split('/').filter(Boolean).pop();
  var total   = topics.length;

  /* Store total so the homepage dashboard can read it without loading this page.
     WHY: localStorage only contains done topics (keys are removed when undone),
     so the dashboard cannot infer the total from localStorage alone. Saving it
     here gives the dashboard a stable denominator. */
  _ls.set(pageKey + ':__total__', total);

  /* Inject progress bar between .hero and .content */
  var hero = document.querySelector('.hero');
  if (hero) {
    var wrap = document.createElement('div');
    wrap.id        = 'ss-progress-wrap';
    wrap.className = 'ss-progress-wrap';
    wrap.innerHTML =
      '<div class="ss-progress-label">' +
        '<span id="ss-done-count">0</span> / ' + total + ' topics completed' +
        '<button class="ss-reset-btn" id="ss-reset-btn" title="Clear all progress">Reset</button>' +
      '</div>' +
      '<div class="ss-progress-track">' +
        '<div class="ss-progress-fill" id="ss-progress-fill"></div>' +
      '</div>';
    hero.insertAdjacentElement('afterend', wrap);

    document.getElementById('ss-reset-btn').addEventListener('click', function () {
      topics.forEach(function (t) {
        _ls.del(pageKey + ':' + t.id);
      });
      location.reload();
    });
  }

  /* Inject a done-button into each topic header */
  topics.forEach(function (topic) {
    var header = topic.querySelector('.topic-header');
    if (!header) return;

    var isDone = _ls.get(pageKey + ':' + topic.id) === '1';
    if (isDone) topic.classList.add('ss-done');

    var btn = document.createElement('button');
    btn.className   = 'ss-done-btn' + (isDone ? ' active' : '');
    btn.setAttribute('aria-label', isDone ? 'Mark as not done' : 'Mark as done');
    btn.textContent = isDone ? '✓' : '○';

    btn.addEventListener('click', function (e) {
      e.stopPropagation(); /* prevent toggling topic expansion */
      var done = _ls.get(pageKey + ':' + topic.id) === '1';
      if (done) {
        _ls.del(pageKey + ':' + topic.id);
        btn.className   = 'ss-done-btn';
        btn.textContent = '○';
        btn.setAttribute('aria-label', 'Mark as done');
        topic.classList.remove('ss-done');
      } else {
        _ls.set(pageKey + ':' + topic.id, '1');
        btn.className   = 'ss-done-btn active';
        btn.textContent = '✓';
        btn.setAttribute('aria-label', 'Mark as not done');
        topic.classList.add('ss-done');
      }
      refreshProgressBar(pageKey, topics);
    });

    header.appendChild(btn);
  });

  refreshProgressBar(pageKey, topics);
}

function refreshProgressBar(pageKey, topics) {
  var done = 0;
  topics.forEach(function (t) {
    if (_ls.get(pageKey + ':' + t.id) === '1') done++;
  });
  var fill  = document.getElementById('ss-progress-fill');
  var count = document.getElementById('ss-done-count');
  var pct   = topics.length ? Math.round((done / topics.length) * 100) : 0;
  if (fill)  fill.style.width  = pct + '%';
  if (count) count.textContent = done;
}

/* ----------------------------------------------------------
   4. IN-PAGE SEARCH (subject pages)
   WHY: Nielsen Norman Group research consistently ranks search
   as the dominant navigation strategy for information-dense
   sites. When content exceeds ~7 chunks (Miller's Law), users
   switch from browsing to searching. A page with 25+ topics
   clearly exceeds that threshold.
---------------------------------------------------------- */
function initSubjectSearch() {
  var content = document.querySelector('.content');
  if (!content) return;

  var wrap = document.createElement('div');
  wrap.className = 'ss-search-wrap';
  wrap.innerHTML =
    '<span class="ss-search-icon">&#128269;</span>' +
    '<input class="ss-search-input" id="ss-search" type="search"' +
    ' placeholder="Search topics, concepts, formulas…" autocomplete="off" spellcheck="false">' +
    '<button class="ss-search-clear" id="ss-search-clear" title="Clear search" aria-label="Clear search" style="display:none">&#10005;</button>';

  content.insertBefore(wrap, content.firstChild);

  var input    = document.getElementById('ss-search');
  var clearBtn = document.getElementById('ss-search-clear');
  var sections = document.querySelectorAll('.section');

  input.addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    clearBtn.style.display = q ? 'flex' : 'none';
    filterTopics(q, sections);
  });

  clearBtn.addEventListener('click', function () {
    input.value            = '';
    clearBtn.style.display = 'none';
    filterTopics('', sections);
    input.focus();
  });
}

function filterTopics(q, sections) {
  sections.forEach(function (section) {
    var topics = section.querySelectorAll('.topic');
    var anyVisible = false;

    if (!q) {
      /* Reset to default state */
      topics.forEach(function (t) { t.style.display = ''; });
      var body = section.querySelector('.topic-list');
      if (body && body.style.display === 'none') {
        /* leave collapsed sections as-is */
      }
      section.style.display = '';
      return;
    }

    topics.forEach(function (t) {
      var matches = t.textContent.toLowerCase().indexOf(q) !== -1;
      t.style.display = matches ? '' : 'none';
      if (matches) {
        anyVisible = true;
        if (!t.classList.contains('expanded')) t.classList.add('expanded');
      }
    });

    section.style.display = anyVisible ? '' : 'none';
    if (anyVisible) {
      var list  = section.querySelector('.topic-list');
      var arrow = section.querySelector('.section-arrow');
      if (list)  list.style.display  = 'flex';
      if (arrow) arrow.classList.add('open');
    }
  });
}

/* ----------------------------------------------------------
   5. HOMEPAGE SUBJECT FILTER
   WHY: As the site grows (more subjects, more curriculum
   systems), the homepage becomes a navigation bottleneck.
   A live-filter input costs nothing to render but saves users
   from scanning an entire list — a direct application of
   Fitts's Law (reducing distance/time to target).
---------------------------------------------------------- */
function initHomeSearch() {
  var hero = document.querySelector('.hero');
  if (!hero) return;

  var wrap = document.createElement('div');
  wrap.className = 'ss-home-search-wrap';
  wrap.innerHTML =
    '<span class="ss-search-icon">&#128269;</span>' +
    '<input class="ss-home-search-input" id="ss-home-search" type="search"' +
    ' placeholder="Filter subjects — e.g. physics, IB, Swedish…" autocomplete="off">';

  hero.insertAdjacentElement('afterend', wrap);

  document.getElementById('ss-home-search').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();

    document.querySelectorAll('.subject-card').forEach(function (card) {
      card.style.display = (!q || card.textContent.toLowerCase().indexOf(q) !== -1) ? '' : 'none';
    });

    /* Hide entire system group if all its cards are hidden */
    document.querySelectorAll('.system-group').forEach(function (group) {
      var cards   = group.querySelectorAll('.subject-card');
      var visible = Array.prototype.some.call(cards, function (c) {
        return c.style.display !== 'none';
      });
      group.style.display = visible ? '' : 'none';
    });
  });
}

/* ----------------------------------------------------------
   6. SYLLABUS MASTER GUIDE LINK (homepage footer)
   Injects a link to study-sprint-syllabus-guide.html if it
   isn't already present, so the page is reachable without
   editing the HTML.
---------------------------------------------------------- */
/* --- 6. (Removed — syllabus link no longer injected) --- */
function injectSyllabusLink() { /* no-op */ }

/* ----------------------------------------------------------
   7. PRINT / SAVE AS PDF BUTTON
   WHY: Despite the digital shift, ~65 % of students report
   printing study materials at least occasionally (EDUCAUSE
   Student Technology Report, 2022). A dedicated print button
   that pre-expands all sections prevents the common problem
   of collapsed content not appearing in the printed output.
   window.print() triggers the browser's native PDF dialog.
---------------------------------------------------------- */
function initPrintButton() {
  var btn = document.createElement('button');
  btn.className = 'ss-print-btn';
  btn.innerHTML = '&#128424; Print / Save PDF';
  btn.title     = 'Expand all sections and open print dialog';

  btn.addEventListener('click', function () {
    /* Expand every section and topic before printing */
    document.querySelectorAll('.topic-list').forEach(function (l) {
      l.style.display = 'flex';
    });
    document.querySelectorAll('.section-arrow').forEach(function (a) {
      a.classList.add('open');
    });
    document.querySelectorAll('.topic').forEach(function (t) {
      t.classList.add('expanded');
    });
    window.print();
  });

  document.body.appendChild(btn);
}

/* ----------------------------------------------------------
   8. DARK MODE TOGGLE
   WHY: Students study at all hours. A dark/light toggle
   respects circadian preferences and reduces eye strain
   during night sessions. Persisted in localStorage.
---------------------------------------------------------- */
function initDarkModeToggle() {
  var btn = document.createElement('button');
  btn.className = 'ss-darkmode-btn';
  btn.title     = 'Toggle light/dark mode';

  var isDark = _ls.get('ss-theme') !== 'light';
  applyTheme(isDark);
  btn.textContent = isDark ? '☀️' : '🌙';

  btn.addEventListener('click', function () {
    isDark = !isDark;
    applyTheme(isDark);
    btn.textContent = isDark ? '☀️' : '🌙';
    _ls.set('ss-theme', isDark ? 'dark' : 'light');
  });

  document.body.appendChild(btn);
}

function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.remove('ss-light');
  } else {
    document.documentElement.classList.add('ss-light');
  }
  /* Notify mind map so it can re-render with correct colours */
  window.dispatchEvent(new CustomEvent('ss-theme-change'));
}

/* ----------------------------------------------------------
   9. CONCEPT MAP — Clean Radial Layout (D3.js)
   Static orbital layout: subject center → section rings → topics.
   No physics simulation. Deterministic, readable, mobile-friendly.
---------------------------------------------------------- */

function loadD3(callback) {
  if (window.d3) { callback(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
  s.onload = function () { callback(); };
  s.onerror = function () { callback(new Error('fail')); };
  document.head.appendChild(s);
}

function extractPageData() {
  var pageKey = '/' + location.pathname.split('/').filter(Boolean).pop();
  var palette = ['#4fc3f7','#ff8a65','#b388ff','#66bb6a','#ffd54f','#4db6ac','#f48fb1','#ffb74d'];
  var sections = [], si = 0;
  document.querySelectorAll('.section').forEach(function (sec) {
    var numEl = sec.querySelector('.section-number');
    var titleEl = sec.querySelector('.section-title');
    if (!titleEl) return;
    var col = palette[si++ % palette.length];
    var sLabel = (numEl ? numEl.textContent.trim() + ' ' : '') + titleEl.textContent.trim();
    var topics = [];
    sec.querySelectorAll('.topic[id]').forEach(function (topic) {
      var nameEl = topic.querySelector('.topic-name');
      if (!nameEl) return;
      topics.push({
        id: topic.id,
        name: nameEl.textContent.trim().replace(/\s+/g, ' '),
        detail: (topic.querySelector('.topic-detail') || {}).textContent || '',
        isHL: !!topic.querySelector('.hl-tag'),
        isDone: _ls.get(pageKey + ':' + topic.id) === '1',
        keywords: Array.prototype.slice.call(topic.querySelectorAll('.concept-item strong, .term-word')).map(function (el) {
          return el.textContent.replace(/[:\(\)]/g, '').trim().toLowerCase();
        }).filter(function (t) { return t.length > 2 && t.length < 60; }),
        conceptCount: topic.querySelectorAll('.concept-item').length,
        formulaCount: topic.querySelectorAll('.formula-card').length,
        termCount: topic.querySelectorAll('.term-item').length
      });
    });
    sections.push({ label: sLabel, color: col, topics: topics });
  });
  return sections;
}

function findConnections(sections) {
  var conns = [], all = [];
  sections.forEach(function (s, si) { s.topics.forEach(function (t) { all.push({ t: t, si: si }); }); });
  for (var i = 0; i < all.length; i++) {
    for (var j = i + 1; j < all.length; j++) {
      if (all[i].si === all[j].si) continue;
      var shared = [];
      all[i].t.keywords.forEach(function (a) {
        all[j].t.keywords.forEach(function (b) {
          if (a === b || (a.length > 5 && b.indexOf(a) !== -1) || (b.length > 5 && a.indexOf(b) !== -1))
            if (shared.indexOf(a) === -1) shared.push(a);
        });
      });
      if (shared.length >= 2) conns.push({ from: all[i].t.id, to: all[j].t.id, shared: shared });
    }
  }
  return conns;
}

function initMindMap() {
  var hero = document.querySelector('.hero');
  if (!hero || !document.querySelector('.section')) return;

  var btn = document.createElement('button');
  btn.className = 'ss-mindmap-btn';
  btn.innerHTML = '🧠 Concept Map';
  (hero.querySelector('.badge-row') || hero).appendChild(btn);

  var container = document.createElement('div');
  container.className = 'ss-mindmap-container';
  container.style.display = 'none';

  var inner = document.createElement('div');
  inner.className = 'ss-mindmap-inner';

  inner.innerHTML =
    '<div class="ss-mindmap-toolbar">' +
      '<span class="ss-mindmap-title">' + ((hero.querySelector('h1') || {}).textContent || 'Concept Map') + '</span>' +
      '<button class="ss-map-mode-btn" id="ss-map-mode" title="Switch view">🔀 Explore</button>' +
      '<button class="ss-mindmap-fullscreen" id="ss-map-expand">⛶ Expand</button>' +
      '<button class="ss-mindmap-close" id="ss-map-close">✕</button>' +
    '</div>' +
    '<div class="ss-mindmap-loading" id="ss-map-loading" style="display:none"><div class="ss-mindmap-spinner"></div><span>Building map…</span></div>' +
    '<div class="ss-map-body">' +
      '<div class="ss-mindmap-canvas" id="ss-d3-canvas" style="height:600px"></div>' +
      '<div class="ss-map-detail" id="ss-map-detail" style="display:none"></div>' +
    '</div>' +
    '<div class="ss-mindmap-legend">' +
      '<span class="ss-legend-item"><span class="ss-legend-dot" style="background:#4fc3f7"></span>Topic</span>' +
      '<span class="ss-legend-item"><span class="ss-legend-dot" style="background:#66bb6a"></span>Done</span>' +
      '<span class="ss-legend-item"><span class="ss-legend-diamond"></span>HL</span>' +
      '<span class="ss-legend-item"><span style="display:inline-block;width:20px;height:2px;background:#ffd54f;border-radius:1px;vertical-align:middle"></span> Link</span>' +
      '<span class="ss-legend-hint" id="ss-map-hint">Scroll to zoom · Drag to pan · Click for details</span>' +
    '</div>';

  container.appendChild(inner);
  var pw = document.getElementById('ss-progress-wrap');
  (pw || hero).insertAdjacentElement('afterend', container);

  var mode = 'radial'; /* 'radial' or 'explore' */
  var simulation = null;

  function showDetail(t, connections) {
    var dp = document.getElementById('ss-map-detail');
    var html = '<div class="ss-detail-header"><strong>' + t.name + '</strong>' +
      (t.isHL ? ' <span class="ss-detail-hl">HL</span>' : '') +
      (t.isDone ? ' <span class="ss-detail-done">✓</span>' : '') +
      '<button class="ss-detail-close" onclick="this.closest(\'.ss-map-detail\').style.display=\'none\'">✕</button></div>';
    if (t.detail) html += '<p class="ss-detail-desc">' + t.detail + '</p>';
    html += '<div class="ss-detail-counts">' +
      (t.conceptCount ? '<span>💡' + t.conceptCount + '</span>' : '') +
      (t.formulaCount ? '<span>📐' + t.formulaCount + '</span>' : '') +
      (t.termCount ? '<span>📖' + t.termCount + '</span>' : '') + '</div>';
    var rel = connections.filter(function (c) { return c.from === t.id || c.to === t.id; });
    if (rel.length) {
      html += '<div class="ss-detail-links"><strong>Connected to:</strong>';
      rel.forEach(function (r) {
        var oid = r.from === t.id ? r.to : r.from;
        var oel = document.getElementById(oid);
        html += '<div class="ss-detail-link-item">↔ ' + ((oel ? oel.querySelector('.topic-name') : null) || {}).textContent || oid + '</div>';
      });
      html += '</div>';
    }
    html += '<button class="ss-detail-goto" onclick="var e=document.getElementById(\'' + t.id +
      '\');if(e){e.classList.add(\'expanded\');e.scrollIntoView({behavior:\'smooth\',block:\'center\'});}">↩ Go to topic</button>';
    dp.innerHTML = html;
    dp.style.display = 'block';
  }

  /* ---- Shared: compute positions for all nodes ---- */
  function computeLayout(sections, w, h) {
    var cx = w / 2, cy = h / 2;
    var innerR = Math.min(w, h) * 0.15;
    var outerR = Math.min(w, h) * 0.38;
    var totalTopics = 0;
    sections.forEach(function (s) { totalTopics += s.topics.length; });

    var items = []; /* { type, data, x, y, r, color, sectionIdx, ... } */
    var secAngleStart = 0;

    /* Center */
    items.push({ type: 'root', x: cx, y: cy, r: 28, label: (hero.querySelector('h1') || {}).textContent || 'Subject' });

    sections.forEach(function (sec, si) {
      var secAngle = (sec.topics.length / Math.max(totalTopics, 1)) * Math.PI * 2;
      var midAngle = secAngleStart + secAngle / 2 - Math.PI / 2;
      var sx = cx + Math.cos(midAngle) * innerR;
      var sy = cy + Math.sin(midAngle) * innerR;

      items.push({ type: 'section', data: sec, x: sx, y: sy, r: 18, color: sec.color, si: si,
        arcStart: secAngleStart, arcEnd: secAngleStart + secAngle });

      sec.topics.forEach(function (t, ti) {
        var tAngle = secAngleStart + (ti + 0.5) / Math.max(sec.topics.length, 1) * secAngle - Math.PI / 2;
        var richness = t.conceptCount + t.formulaCount + t.termCount;
        var r = Math.min(7 + richness * 0.8, 18);
        items.push({
          type: 'topic', data: t, r: r, si: si, color: sec.color,
          x: cx + Math.cos(tAngle) * outerR,
          y: cy + Math.sin(tAngle) * outerR,
          secX: sx, secY: sy
        });
      });

      secAngleStart += secAngle;
    });

    return { items: items, cx: cx, cy: cy, innerR: innerR, outerR: outerR };
  }

  /* ---- RADIAL RENDER ---- */
  function renderRadial(sections, connections) {
    var canvas = document.getElementById('ss-d3-canvas');
    var isDark = !document.documentElement.classList.contains('ss-light');
    var w = canvas.clientWidth || 900, h = canvas.clientHeight || 600;
    canvas.innerHTML = '';
    if (simulation) { simulation.stop(); simulation = null; }

    var layout = computeLayout(sections, w, h);
    var svg = d3.select(canvas).append('svg')
      .attr('width', '100%').attr('height', '100%')
      .attr('viewBox', '0 0 ' + w + ' ' + h)
      .style('background', isDark ? '#0d1117' : '#f5f7fa');

    var g = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.3, 3]).on('zoom', function (ev) { g.attr('transform', ev.transform); }));

    var defs = svg.append('defs');
    var glow = defs.append('filter').attr('id', 'glow');
    glow.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'b');
    glow.append('feMerge').selectAll('feMergeNode').data(['b', 'SourceGraphic']).enter().append('feMergeNode').attr('in', function (d) { return d; });

    var topicPos = {};

    /* Arc bands */
    layout.items.filter(function (d) { return d.type === 'section'; }).forEach(function (s) {
      g.append('path')
        .attr('d', d3.arc().innerRadius(layout.innerR - 8).outerRadius(layout.outerR + 20)
          .startAngle(s.arcStart).endAngle(s.arcEnd).padAngle(0.03))
        .attr('transform', 'translate(' + layout.cx + ',' + layout.cy + ')')
        .attr('fill', s.color).attr('opacity', isDark ? 0.06 : 0.08);
    });

    layout.items.forEach(function (item) {
      if (item.type === 'root') {
        g.append('circle').attr('cx', item.x).attr('cy', item.y).attr('r', item.r)
          .attr('fill', isDark ? '#1a2236' : '#fff')
          .attr('stroke', layout.items[1] ? layout.items[1].color : '#4fc3f7')
          .attr('stroke-width', 3).attr('filter', 'url(#glow)');
        g.append('text').attr('x', item.x).attr('y', item.y + 1)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('fill', isDark ? '#e8ecf4' : '#1a1a2e')
          .attr('font-size', 11).attr('font-weight', 700)
          .attr('font-family', 'Playfair Display, serif')
          .text(item.label.length > 14 ? item.label.slice(0, 12) + '…' : item.label);
      } else if (item.type === 'section') {
        g.append('circle').attr('cx', item.x).attr('cy', item.y).attr('r', item.r)
          .attr('fill', item.color).attr('stroke', isDark ? '#1a2236' : '#fff')
          .attr('stroke-width', 2).attr('filter', 'url(#glow)');
        var sl = item.data.label.replace(/^\d+\s*/, '');
        g.append('text').attr('x', item.x).attr('y', item.y + 30)
          .attr('text-anchor', 'middle').attr('fill', item.color)
          .attr('font-size', 9).attr('font-weight', 600)
          .attr('font-family', 'Source Sans 3, sans-serif')
          .text(sl.length > 18 ? sl.slice(0, 16) + '…' : sl);
      } else {
        var t = item.data;
        topicPos[t.id] = { x: item.x, y: item.y };
        var col = t.isDone ? '#66bb6a' : (t.isHL ? '#b388ff' : item.color);

        g.append('line').attr('x1', item.secX).attr('y1', item.secY)
          .attr('x2', item.x).attr('y2', item.y)
          .attr('stroke', item.color).attr('stroke-opacity', 0.2).attr('stroke-width', 1);

        var ng = g.append('g').attr('transform', 'translate(' + item.x + ',' + item.y + ')').style('cursor', 'pointer');
        if (t.isHL) {
          ng.append('rect').attr('x', -item.r).attr('y', -item.r).attr('width', item.r * 2).attr('height', item.r * 2)
            .attr('rx', 3).attr('transform', 'rotate(45)')
            .attr('fill', col).attr('stroke', isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)').attr('stroke-width', 1);
        } else {
          ng.append('circle').attr('r', item.r)
            .attr('fill', col).attr('stroke', isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)').attr('stroke-width', 1);
        }
        if (t.isDone) {
          ng.append('circle').attr('r', item.r + 3).attr('fill', 'none')
            .attr('stroke', '#66bb6a').attr('stroke-width', 1.5).attr('stroke-dasharray', '3,2');
        }
        var tl = t.name.length > 20 ? t.name.slice(0, 18) + '…' : t.name;
        ng.append('text').attr('y', item.r + 12).attr('text-anchor', 'middle')
          .attr('fill', isDark ? '#a0aec0' : '#4a5568').attr('font-size', 8)
          .attr('font-family', 'Source Sans 3, sans-serif').text(tl);

        ng.on('mouseover', function () { d3.select(this).select('circle,rect').transition().duration(120).attr('stroke', '#fff').attr('stroke-width', 2.5); })
          .on('mouseout', function () { d3.select(this).select('circle,rect').transition().duration(120).attr('stroke', isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)').attr('stroke-width', 1); });
        ng.on('click', function (ev) {
          ev.stopPropagation();
          showDetail(t, connections);
          g.selectAll('.cross-link').attr('stroke-opacity', 0.08);
          g.selectAll('.cl-' + t.id.replace(/[^a-zA-Z0-9]/g, '_')).attr('stroke-opacity', 0.7);
        });
      }
    });

    /* Cross-links */
    connections.forEach(function (c) {
      var a = topicPos[c.from], b = topicPos[c.to];
      if (!a || !b) return;
      var sf = c.from.replace(/[^a-zA-Z0-9]/g, '_'), st = c.to.replace(/[^a-zA-Z0-9]/g, '_');
      g.append('path')
        .attr('d', 'M' + a.x + ',' + a.y + ' Q' + ((a.x + b.x) / 2 + (a.y - b.y) * 0.15) + ',' + ((a.y + b.y) / 2 + (b.x - a.x) * 0.15) + ' ' + b.x + ',' + b.y)
        .attr('fill', 'none').attr('stroke', isDark ? '#ffd54f' : '#b8860b')
        .attr('stroke-width', 1.2).attr('stroke-opacity', 0.25).attr('stroke-dasharray', '5,3')
        .attr('class', 'cross-link cl-' + sf + ' cl-' + st);
    });

    svg.on('click', function () {
      document.getElementById('ss-map-detail').style.display = 'none';
      g.selectAll('.cross-link').attr('stroke-opacity', 0.25);
    });
  }

  /* ---- EXPLORE (force) RENDER ---- */
  function renderExplore(sections, connections) {
    var canvas = document.getElementById('ss-d3-canvas');
    var isDark = !document.documentElement.classList.contains('ss-light');
    var w = canvas.clientWidth || 900, h = canvas.clientHeight || 600;
    canvas.innerHTML = '';
    if (simulation) { simulation.stop(); simulation = null; }

    var layout = computeLayout(sections, w, h);

    /* Build D3 force data, seeded from radial positions */
    var nodes = [], links = [], nodeMap = {};
    layout.items.forEach(function (item) {
      var n = { id: item.type === 'root' ? '__root__' : (item.type === 'section' ? '__sec_' + item.si : item.data.id),
        x: item.x, y: item.y, r: item.r, type: item.type, color: item.color,
        data: item.data, si: item.si, label: item.type === 'root' ? item.label : (item.data ? (item.data.label || item.data.name) : '') };
      nodes.push(n); nodeMap[n.id] = n;
      if (item.type === 'section') links.push({ source: '__root__', target: n.id, type: 'h', color: item.color });
      if (item.type === 'topic') links.push({ source: '__sec_' + item.si, target: n.id, type: 'h', color: item.color });
    });
    connections.forEach(function (c) {
      if (nodeMap[c.from] && nodeMap[c.to]) links.push({ source: c.from, target: c.to, type: 'cross', shared: c.shared });
    });

    var svg = d3.select(canvas).append('svg')
      .attr('width', '100%').attr('height', '100%')
      .attr('viewBox', '0 0 ' + w + ' ' + h)
      .style('background', isDark ? '#0d1117' : '#f5f7fa');

    var g = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.2, 4]).on('zoom', function (ev) { g.attr('transform', ev.transform); }));

    var defs = svg.append('defs');
    var glow = defs.append('filter').attr('id', 'glow');
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'b');
    glow.append('feMerge').selectAll('feMergeNode').data(['b', 'SourceGraphic']).enter().append('feMergeNode').attr('in', function (d) { return d; });

    /* Links */
    var link = g.append('g').selectAll('line').data(links).enter().append('line')
      .attr('stroke', function (d) { return d.type === 'cross' ? (isDark ? '#ffd54f' : '#b8860b') : (d.color || '#555'); })
      .attr('stroke-opacity', function (d) { return d.type === 'cross' ? 0.3 : 0.2; })
      .attr('stroke-width', function (d) { return d.type === 'cross' ? 1.5 : (d.source === '__root__' ? 2.5 : 1); })
      .attr('stroke-dasharray', function (d) { return d.type === 'cross' ? '5,3' : null; });

    /* Nodes */
    var node = g.append('g').selectAll('g').data(nodes).enter().append('g').style('cursor', 'grab');

    node.each(function (d) {
      var el = d3.select(this);
      var col = d.type === 'topic' ? (d.data.isDone ? '#66bb6a' : (d.data.isHL ? '#b388ff' : d.color)) : d.color;
      if (d.type === 'root') {
        el.append('circle').attr('r', d.r).attr('fill', isDark ? '#1a2236' : '#fff')
          .attr('stroke', nodes[1] ? nodes[1].color : '#4fc3f7').attr('stroke-width', 3).attr('filter', 'url(#glow)');
      } else if (d.type === 'section') {
        el.append('circle').attr('r', d.r).attr('fill', col)
          .attr('stroke', isDark ? '#1a2236' : '#fff').attr('stroke-width', 2).attr('filter', 'url(#glow)');
      } else if (d.data.isHL) {
        el.append('rect').attr('x', -d.r).attr('y', -d.r).attr('width', d.r * 2).attr('height', d.r * 2)
          .attr('rx', 3).attr('transform', 'rotate(45)')
          .attr('fill', col).attr('stroke', isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)').attr('stroke-width', 1);
      } else {
        el.append('circle').attr('r', d.r).attr('fill', col)
          .attr('stroke', isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)').attr('stroke-width', 1.5);
      }
      if (d.type === 'topic' && d.data.isDone) {
        el.append('circle').attr('r', d.r + 3).attr('fill', 'none')
          .attr('stroke', '#66bb6a').attr('stroke-width', 1.5).attr('stroke-dasharray', '3,2');
      }
    });

    /* Labels */
    node.append('text')
      .text(function (d) {
        var l = d.label || '';
        var max = d.type === 'root' ? 14 : d.type === 'section' ? 20 : 18;
        return l.length > max ? l.slice(0, max - 2) + '…' : l;
      })
      .attr('text-anchor', 'middle')
      .attr('dy', function (d) { return d.type === 'topic' ? d.r + 13 : (d.type === 'root' ? 1 : d.r + 14); })
      .attr('dominant-baseline', function (d) { return d.type === 'root' ? 'middle' : 'auto'; })
      .attr('fill', function (d) { return d.type === 'section' ? d.color : (isDark ? '#a0aec0' : '#4a5568'); })
      .attr('font-size', function (d) { return d.type === 'root' ? 11 : d.type === 'section' ? 9 : 8; })
      .attr('font-weight', function (d) { return d.type === 'topic' ? 400 : 700; })
      .attr('font-family', function (d) { return d.type === 'root' ? 'Playfair Display, serif' : 'Source Sans 3, sans-serif'; })
      .style('pointer-events', 'none');

    /* Hover + click */
    node.on('mouseover', function () { d3.select(this).select('circle,rect').transition().duration(120).attr('stroke', '#fff').attr('stroke-width', 2.5); })
      .on('mouseout', function (ev, d) { d3.select(this).select('circle,rect').transition().duration(120).attr('stroke-width', d.type === 'root' ? 3 : (d.type === 'section' ? 2 : 1.5)); });
    node.filter(function (d) { return d.type === 'topic'; }).on('click', function (ev, d) {
      ev.stopPropagation();
      showDetail(d.data, connections);
    });
    svg.on('click', function () { document.getElementById('ss-map-detail').style.display = 'none'; });

    /* Drag */
    node.call(d3.drag()
      .on('start', function (ev, d) {
        if (!ev.active) simulation.alphaTarget(0.15).restart();
        d.fx = d.x; d.fy = d.y;
        d3.select(this).style('cursor', 'grabbing');
      })
      .on('drag', function (ev, d) { d.fx = ev.x; d.fy = ev.y; })
      .on('end', function (ev, d) {
        if (!ev.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
        d3.select(this).style('cursor', 'grab');
      })
    );

    /* Force simulation — gentle, starts from radial positions */
    simulation = d3.forceSimulation(nodes)
      .alpha(0.3) /* start gentle, not explosive */
      .alphaDecay(0.02)
      .force('link', d3.forceLink(links).id(function (d) { return d.id; })
        .distance(function (d) { return d.type === 'cross' ? 200 : (d.source.id === '__root__' ? 120 : 70); })
        .strength(function (d) { return d.type === 'cross' ? 0.03 : 0.5; }))
      .force('charge', d3.forceManyBody().strength(function (d) {
        return d.type === 'root' ? -400 : d.type === 'section' ? -200 : -60;
      }))
      .force('center', d3.forceCenter(w / 2, h / 2).strength(0.05))
      .force('collision', d3.forceCollide().radius(function (d) { return d.r + 8; }));

    simulation.on('tick', function () {
      link.attr('x1', function (d) { return d.source.x; }).attr('y1', function (d) { return d.source.y; })
          .attr('x2', function (d) { return d.target.x; }).attr('y2', function (d) { return d.target.y; });
      node.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    });
  }

  /* ---- Main render dispatcher ---- */
  function render() {
    var sections = extractPageData();
    var connections = findConnections(sections);
    var canvas = document.getElementById('ss-d3-canvas');
    var loading = document.getElementById('ss-map-loading');
    loading.style.display = 'flex';
    canvas.style.display = 'none';

    loadD3(function (err) {
      if (err) { loading.innerHTML = '<span style="color:#ef5350">Failed to load D3.</span>'; return; }
      if (mode === 'radial') renderRadial(sections, connections);
      else renderExplore(sections, connections);
      loading.style.display = 'none';
      canvas.style.display = '';
    });
  }

  /* ---- Controls ---- */
  function showMap() {
    container.style.display = 'block';
    render();
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideMap() {
    container.style.display = 'none';
    inner.classList.remove('ss-mindmap-fullscreen-active');
    document.getElementById('ss-map-expand').innerHTML = '⛶ Expand';
    document.getElementById('ss-d3-canvas').style.height = '600px';
    document.getElementById('ss-map-detail').style.display = 'none';
    if (simulation) { simulation.stop(); simulation = null; }
  }

  btn.addEventListener('click', function () { container.style.display === 'none' ? showMap() : hideMap(); });
  document.getElementById('ss-map-close').addEventListener('click', hideMap);

  document.getElementById('ss-map-mode').addEventListener('click', function () {
    mode = mode === 'radial' ? 'explore' : 'radial';
    this.innerHTML = mode === 'radial' ? '🔀 Explore' : '📐 Radial';
    document.getElementById('ss-map-hint').textContent = mode === 'radial'
      ? 'Scroll to zoom · Drag to pan · Click for details'
      : 'Drag nodes around · Scroll to zoom · Click for details';
    render();
  });

  document.getElementById('ss-map-expand').addEventListener('click', function () {
    inner.classList.toggle('ss-mindmap-fullscreen-active');
    var c = document.getElementById('ss-d3-canvas');
    if (inner.classList.contains('ss-mindmap-fullscreen-active')) {
      this.innerHTML = '⛶ Shrink'; c.style.height = (window.innerHeight - 140) + 'px';
    } else {
      this.innerHTML = '⛶ Expand'; c.style.height = '600px';
    }
    render();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && inner.classList.contains('ss-mindmap-fullscreen-active')) {
      inner.classList.remove('ss-mindmap-fullscreen-active');
      document.getElementById('ss-map-expand').innerHTML = '⛶ Expand';
      document.getElementById('ss-d3-canvas').style.height = '600px';
      render();
    }
  });

  window.addEventListener('ss-theme-change', function () {
    if (container.style.display !== 'none') render();
  });
}

/* (Concept map: dual-mode radial + explore, built from DOM) */
/* ----------------------------------------------------------
   10. CROSS-SUBJECT MASTERY DASHBOARD (homepage)
   WHY: Self-Determination Theory says autonomy + competence
   = intrinsic motivation. Showing mastery across all subjects
   gives students a powerful sense of overall progress and
   control over their learning journey.
---------------------------------------------------------- */
function initMasteryDashboard() {
  if (!document.querySelector('.systems')) return;

  var subjects = [
    { path: '/ib-physics-hl.html',   label: 'IB Physics HL',  color: '#4fc3f7', group: 'ib', href: 'ib-physics-hl.html' },
    { path: '/ib-chemistry-hl.html', label: 'IB Chemistry HL',color: '#ff8a65', group: 'ib', href: 'ib-chemistry-hl.html' },
    { path: '/ib-math-aa-hl.html',   label: 'IB Math AA HL',  color: '#b388ff', group: 'ib', href: 'ib-math-aa-hl.html' },
    { path: '/fysik2.html',          label: 'Fysik 2',        color: '#4fc3f7', group: 'swe', href: 'fysik2.html' },
    { path: '/kemi2.html',           label: 'Kemi 2',         color: '#ff8a65', group: 'swe', href: 'kemi2.html' },
    { path: '/matematik5.html',      label: 'Matematik 5',    color: '#b388ff', group: 'swe', href: 'matematik5.html' }
  ];

  var track = _ls.get('ss-track') || '';
  var mySubjects = [];
  try { mySubjects = JSON.parse(_ls.get('ss-my-subjects') || '[]'); } catch (e) { mySubjects = []; }

  var systems = document.querySelector('.systems');

  function getProgress(path) {
    var total = parseInt(_ls.get(path + ':__total__') || '0', 10);
    var done = 0;
    _ls.keys().forEach(function (k) {
      if (k.indexOf(path + ':topic-') !== -1 && _ls.get(k) === '1') done++;
    });
    return { total: total, done: done };
  }

  function save() {
    if (track) _ls.set('ss-track', track); else _ls.del('ss-track');
    _ls.set('ss-my-subjects', JSON.stringify(mySubjects));
  }

  function applyVisuals() {
    var ibGroup = document.querySelector('.system-badge.ib');
    var sweGroup = document.querySelector('.system-badge.swe');
    var ibSection = ibGroup ? ibGroup.closest('.system-group') : null;
    var sweSection = sweGroup ? sweGroup.closest('.system-group') : null;

    /* Reorder sections */
    if (track === 'swe' && sweSection && ibSection) {
      systems.insertBefore(sweSection, ibSection);
    }

    /* Dim cards */
    document.querySelectorAll('.subject-card').forEach(function (card) {
      card.classList.remove('ss-card-dimmed');
    });

    if (track) {
      subjects.forEach(function (s) {
        var card = document.querySelector('a.subject-card[href="' + s.href + '"]');
        if (!card) return;
        if (s.group !== track) {
          card.classList.add('ss-card-dimmed');
        } else if (mySubjects.length > 0 && mySubjects.indexOf(s.path) === -1) {
          card.classList.add('ss-card-dimmed');
        }
      });
    }
  }

  function render() {
    var old = document.getElementById('ss-track-panel');
    if (old) old.remove();

    var panel = document.createElement('div');
    panel.id = 'ss-track-panel';
    panel.className = 'ss-track-panel';

    /* Static title, no explanatory text */
    var html = '<div class="ss-track-header">' +
      '<span class="ss-track-title">📊 Study Progress</span>' +
      (track ? '<button class="ss-track-reset" id="ss-track-reset">Reset</button>' : '') +
    '</div>';

    /* Track chips */
    html += '<div class="ss-track-chips">' +
      '<button class="ss-track-chip' + (track === 'ib' ? ' on' : '') + '" data-track="ib" style="--chip-color:#4fc3f7">🌍 IB Diploma</button>' +
      '<button class="ss-track-chip' + (track === 'swe' ? ' on' : '') + '" data-track="swe" style="--chip-color:#ffd54f">🇸🇪 Gymnasium</button>' +
    '</div>';

    /* Subject chips — show when track is selected */
    if (track) {
      var trackSubs = subjects.filter(function (s) { return s.group === track; });
      html += '<div class="ss-subject-chips">';
      trackSubs.forEach(function (s) {
        var on = mySubjects.indexOf(s.path) !== -1;
        html += '<button class="ss-subject-chip' + (on ? ' on' : '') + '" data-path="' + s.path + '" style="--chip-color:' + s.color + '">' + s.label + '</button>';
      });
      html += '</div>';
    }

    /* Progress bars */
    var showSubjects = mySubjects.length > 0
      ? subjects.filter(function (s) { return mySubjects.indexOf(s.path) !== -1; })
      : (track ? subjects.filter(function (s) { return s.group === track; }) : []);

    if (showSubjects.length > 0) {
      var totalDone = 0, totalCount = 0, bars = '';
      showSubjects.forEach(function (s) {
        var p = getProgress(s.path);
        totalDone += p.done; totalCount += p.total;
        var pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        bars += '<div class="ss-dash-row"><span class="ss-dash-label">' + s.label + '</span>' +
          '<div class="ss-dash-track"><div class="ss-dash-fill" style="width:' + pct + '%;background:' + s.color + '"></div></div>' +
          '<span class="ss-dash-pct">' + (p.total ? pct + '%' : '—') + '</span></div>';
      });
      var pct = totalCount ? Math.round((totalDone / totalCount) * 100) : 0;
      var level = pct < 25 ? 'Novice' : pct < 50 ? 'Apprentice' : pct < 75 ? 'Scholar' : pct < 100 ? 'Master' : 'Legend ⭐';
      html += '<div class="ss-dash-progress">' +
        (totalCount > 0 ? '<div class="ss-dash-header"><span class="ss-dash-level">' + level + ' — ' + pct + '%</span></div><div class="ss-dash-overall-track"><div class="ss-dash-overall-fill" style="width:' + pct + '%"></div></div>' : '') +
        bars + '</div>';
    }

    panel.innerHTML = html;
    systems.insertBefore(panel, systems.firstChild);
    applyVisuals();

    /* Bind track chips */
    panel.querySelectorAll('.ss-track-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var t = this.getAttribute('data-track');
        if (track === t) { track = ''; mySubjects = []; }
        else { track = t; mySubjects = []; }
        save(); render();
      });
    });

    /* Bind subject chips */
    panel.querySelectorAll('.ss-subject-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var p = this.getAttribute('data-path');
        var idx = mySubjects.indexOf(p);
        if (idx !== -1) mySubjects.splice(idx, 1); else mySubjects.push(p);
        save(); render();
      });
    });

    /* Reset */
    var resetBtn = document.getElementById('ss-track-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        track = ''; mySubjects = [];
        save(); render();
      });
    }
  }

  render();
}

/* ----------------------------------------------------------
   11. PRACTICE QUESTION SYSTEM — QUIZ MODE
   WHY: "Testing effect" research (Roediger & Karpicke, 2006)
   shows that attempting retrieval BEFORE seeing the answer
   produces far stronger long-term memory than re-reading. Quiz
   mode hides all solutions at once so students can attempt each
   question cold, then reveal only the ones they need.

   HOW: Adds a toggle button to the page toolbar. Toggling adds/
   removes .ss-quiz-on on <body>. CSS handles hiding solutions.
   State is not persisted (intentional — each session is fresh).
---------------------------------------------------------- */
function initQuizMode() {
  var questions = document.querySelectorAll('.q-item');
  if (!questions.length) return;

  var quizBtn = document.createElement('button');
  quizBtn.id = 'ss-quiz-mode-btn';
  quizBtn.className = 'ss-quiz-mode-btn';
  quizBtn.title = 'Hide all solutions — test yourself';
  quizBtn.innerHTML = '🎯 Quiz Mode';
  document.body.appendChild(quizBtn);

  var quizOn = false;
  var total = questions.length;

  quizBtn.addEventListener('click', function () {
    quizOn = !quizOn;
    document.body.classList.toggle('ss-quiz-on', quizOn);
    quizBtn.classList.toggle('ss-quiz-active', quizOn);
    quizBtn.innerHTML = quizOn ? '✕ Exit Quiz' : '🎯 Quiz Mode';

    if (!quizOn) {
      document.querySelectorAll('.q-solution--open').forEach(function (s) { s.classList.remove('q-solution--open'); });
      document.querySelectorAll('.q-toggle-btn').forEach(function (b) { b.textContent = '▸ Show Solution'; b.classList.remove('q-toggle-btn--open'); });
    }
  });
}

/* ----------------------------------------------------------
   12. INLINE TOPIC COMMENTS
   Students can leave comments on any topic about what's
   missing or unclear. Stored in localStorage, exportable.
---------------------------------------------------------- */
function initFeedbackTab() {
  var topics = document.querySelectorAll('.topic[id]');
  if (!topics.length) return;

  var pageKey = '/' + location.pathname.split('/').filter(Boolean).pop();

  topics.forEach(function (topic) {
    var header = topic.querySelector('.topic-header');
    if (!header) return;

    var btn = document.createElement('button');
    btn.className = 'ss-comment-btn';
    btn.title = 'Leave a suggestion';
    var existing = JSON.parse(_ls.get('ss-comments:' + pageKey + ':' + topic.id) || '[]');
    btn.textContent = existing.length ? '💬 ' + existing.length : '💬';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      openCommentBox(topic, pageKey);
    });
    header.appendChild(btn);
  });

  /* Export button in hero area */
  var hero = document.querySelector('.hero');
  if (hero) {
    var exportBtn = document.createElement('button');
    exportBtn.className = 'ss-export-comments-btn';
    exportBtn.textContent = '📋 Export all suggestions';
    exportBtn.style.display = 'none';
    /* Show only if there are any comments */
    var anyComments = _ls.keys().some(function (k) { return k.indexOf('ss-comments:' + pageKey) === 0; });
    if (anyComments) exportBtn.style.display = '';

    exportBtn.addEventListener('click', function () {
      var all = [];
      _ls.keys().forEach(function (k) {
        if (k.indexOf('ss-comments:' + pageKey) !== 0) return;
        var tid = k.replace('ss-comments:' + pageKey + ':', '');
        var comments = JSON.parse(_ls.get(k) || '[]');
        comments.forEach(function (c) { all.push(tid + '\t' + c.text + '\t' + c.time); });
      });
      if (!all.length) { alert('No suggestions yet.'); return; }
      var tsv = 'Topic\tSuggestion\tTime\n' + all.join('\n');
      var blob = new Blob([tsv], { type: 'text/tab-separated-values' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = pageKey.replace('/', '') + '-suggestions.tsv';
      a.click();
    });
    hero.appendChild(exportBtn);
  }
}

function openCommentBox(topic, pageKey) {
  var existing = topic.querySelector('.ss-comment-box');
  if (existing) { existing.remove(); return; }

  var key = 'ss-comments:' + pageKey + ':' + topic.id;
  var comments = JSON.parse(_ls.get(key) || '[]');

  var box = document.createElement('div');
  box.className = 'ss-comment-box';

  function renderBox() {
    var html = '';
    var visible = comments.filter(function (c) { return !c.hidden; });
    var hidden = comments.filter(function (c) { return c.hidden; });

    if (visible.length) {
      html += '<div class="ss-comment-list">';
      visible.forEach(function (c, i) {
        var idx = comments.indexOf(c);
        html += '<div class="ss-comment-item">' +
          '<span class="ss-comment-text">' + c.text.replace(/</g, '&lt;') + '</span>' +
          '<span class="ss-comment-time">' + c.time + '</span>' +
          '<div class="ss-comment-item-actions">' +
            '<button class="ss-comment-act" data-action="edit" data-idx="' + idx + '" title="Edit">✏️</button>' +
            '<button class="ss-comment-act" data-action="hide" data-idx="' + idx + '" title="Hide">👁️</button>' +
            '<button class="ss-comment-act" data-action="delete" data-idx="' + idx + '" title="Delete">🗑️</button>' +
          '</div></div>';
      });
      html += '</div>';
    }

    if (hidden.length) {
      html += '<button class="ss-comment-show-hidden" id="ss-show-hidden">' + hidden.length + ' hidden suggestion' + (hidden.length > 1 ? 's' : '') + '</button>';
    }

    html += '<textarea class="ss-comment-input" placeholder="What\'s missing or unclear?" rows="2"></textarea>' +
      '<div class="ss-comment-actions"><button class="ss-comment-submit">Add suggestion</button></div>';

    box.innerHTML = html;

    /* Bind actions */
    box.querySelectorAll('.ss-comment-act').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'));
        var action = this.getAttribute('data-action');
        if (action === 'delete') {
          comments.splice(idx, 1);
        } else if (action === 'hide') {
          comments[idx].hidden = true;
        } else if (action === 'edit') {
          var newText = prompt('Edit suggestion:', comments[idx].text);
          if (newText !== null && newText.trim()) comments[idx].text = newText.trim();
        }
        _ls.set(key, JSON.stringify(comments));
        updateBtn();
        renderBox();
      });
    });

    var showHidden = box.querySelector('#ss-show-hidden');
    if (showHidden) {
      showHidden.addEventListener('click', function () {
        comments.forEach(function (c) { c.hidden = false; });
        _ls.set(key, JSON.stringify(comments));
        renderBox();
      });
    }

    box.querySelector('.ss-comment-submit').addEventListener('click', function () {
      var input = box.querySelector('.ss-comment-input');
      var text = input.value.trim();
      if (!text) return;
      var comment = { text: text, time: new Date().toLocaleDateString(), hidden: false };
      comments.push(comment);
      _ls.set(key, JSON.stringify(comments));
      sendToSheet(pageKey, topic.id, comment);
      input.value = '';
      updateBtn();
      renderBox();
    });

    var input = box.querySelector('.ss-comment-input');
    if (input) input.focus();
  }

  function updateBtn() {
    var btn = topic.querySelector('.ss-comment-btn');
    var visible = comments.filter(function (c) { return !c.hidden; });
    if (btn) btn.textContent = visible.length ? '💬 ' + visible.length : '💬';
    var exp = document.querySelector('.ss-export-comments-btn');
    if (exp) exp.style.display = '';
  }

  topic.appendChild(box);
  renderBox();
}

/* Send comment to Google Sheets via Apps Script web app.
   To set up:
   1. Create a Google Sheet
   2. Go to Extensions > Apps Script
   3. Paste this code:
      function doPost(e) {
        var data = JSON.parse(e.postData.contents);
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        sheet.appendRow([new Date(), data.page, data.topic, data.text]);
        return ContentService.createTextOutput('ok');
      }
   4. Deploy as web app (Execute as: Me, Access: Anyone)
   5. Replace the URL below with your deployment URL
*/
var SS_SHEET_URL = ''; /* Paste your Apps Script web app URL here */

function sendToSheet(page, topicId, comment) {
  if (!SS_SHEET_URL) return; /* Skip if not configured */
  try {
    navigator.sendBeacon(SS_SHEET_URL, JSON.stringify({
      page: page, topic: topicId, text: comment.text
    }));
  } catch (e) { /* Silent fail — local storage is the primary store */ }
}

/* (boot sequence consolidated in section 2 above) */
