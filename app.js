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
    initProgress();
    initSubjectSearch();
    initPrintButton();
    initMindMap();
    initQuizMode();
    initFeedbackTab();
    initStudyTools();
    initOnboarding();
  }

  /* Homepage */
  if (isHomepage) {
    initHomeSearch();
    injectSyllabusLink();
    initMasteryDashboard();
    initFeedbackTab();
    initStudyTools();
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
        /* Counts toward today's "studied" record for streak engine */
        if (typeof ssRecordAction === 'function') ssRecordAction('topic');
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

  /* Hardcoded fallback topic counts so the Novice/level line and percentages
     can be computed even before the user has visited each subject page (which
     is when :__total__ gets written). This was the bug: Swedish track showed
     no overall % because the user hadn't opened those pages yet, while IB
     looked correct only because those pages had been opened. */
  var subjects = [
    { path: '/ib-physics-hl.html',   label: 'IB Physics HL',  color: '#4fc3f7', group: 'ib',  href: 'ib-physics-hl.html',   fallback: 24 },
    { path: '/ib-chemistry-hl.html', label: 'IB Chemistry HL',color: '#ff8a65', group: 'ib',  href: 'ib-chemistry-hl.html', fallback: 26 },
    { path: '/ib-math-aa-hl.html',   label: 'IB Math AA HL',  color: '#b388ff', group: 'ib',  href: 'ib-math-aa-hl.html',   fallback: 29 },
    { path: '/fysik2.html',          label: 'Fysik 2',        color: '#4fc3f7', group: 'swe', href: 'fysik2.html',          fallback: 19 },
    { path: '/kemi2.html',           label: 'Kemi 2',         color: '#ff8a65', group: 'swe', href: 'kemi2.html',           fallback: 24 },
    { path: '/matematik5.html',      label: 'Matematik 5',    color: '#b388ff', group: 'swe', href: 'matematik5.html',      fallback: 18 }
  ];

  var track = _ls.get('ss-track') || '';
  var mySubjects = [];
  try { mySubjects = JSON.parse(_ls.get('ss-my-subjects') || '[]'); } catch (e) { mySubjects = []; }

  var systems = document.querySelector('.systems');

  function getProgress(path) {
    /* Use stored total if the page has been visited; else fall back to
       the hardcoded subject topic count so percentages and the Novice/
       Apprentice level line work consistently for every track. */
    var stored = parseInt(_ls.get(path + ':__total__') || '0', 10);
    var subj = subjects.filter(function (s) { return s.path === path; })[0];
    var total = stored > 0 ? stored : (subj ? subj.fallback : 0);
    var done = 0;
    _ls.keys().forEach(function (k) {
      if (k.indexOf(path + ':topic-') !== -1 && _ls.get(k) === '1') done++;
    });
    return { total: total, done: done, visited: stored > 0 };
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
    var panel = document.getElementById('ss-track-panel');

    /* Reorder: selected track goes first, other goes second */
    if (track === 'swe' && sweSection && ibSection) {
      systems.appendChild(ibSection); /* moves IB to end */
    } else if (track === 'ib' && sweSection && ibSection) {
      systems.appendChild(sweSection); /* moves Swedish to end */
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
    /* Always show progress for the selected track's subjects */
    var showSubjects = track ? subjects.filter(function (s) { return s.group === track; }) : [];
    if (mySubjects.length > 0) {
      showSubjects = subjects.filter(function (s) { return mySubjects.indexOf(s.path) !== -1; });
    }

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
      html += '<div class="ss-dash-progress">';
      if (totalCount > 0) {
        var pct = Math.round((totalDone / totalCount) * 100);
        var level = pct < 25 ? 'Novice' : pct < 50 ? 'Apprentice' : pct < 75 ? 'Scholar' : pct < 100 ? 'Master' : 'Legend ⭐';
        html += '<div class="ss-dash-header"><span class="ss-dash-level">' + level + ' — ' + pct + '%</span></div>' +
          '<div class="ss-dash-overall-track"><div class="ss-dash-overall-fill" style="width:' + pct + '%"></div></div>';
      }
      html += bars + '</div>';
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

    html += '<textarea class="ss-comment-input" placeholder="What\'s missing or unclear? (max 500 chars)" rows="2" maxlength="500"></textarea>' +
      /* Honeypot field — bots fill this, humans never see it. Server should drop any submission with website != "" */
      '<input type="text" class="ss-comment-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
      '<div class="ss-comment-actions">' +
        '<span class="ss-comment-count" id="ss-comment-count-' + topic.id + '">0 / 500</span>' +
        '<button class="ss-comment-submit">Add suggestion</button>' +
      '</div>';

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
      var hp    = box.querySelector('.ss-comment-hp');
      var text  = input.value.trim();
      if (!text) return;

      /* --- Client-side guards (real protection lives server-side) --- */
      /* 1. Honeypot — silently drop bot submissions */
      if (hp && hp.value) { input.value = ''; return; }
      /* 2. Length cap */
      if (text.length > 500) text = text.slice(0, 500);
      if (text.length < 3)   { alert('Suggestion is too short.'); return; }
      /* 3. Rate limit — max 1 comment / 10s, max 8 / hour, per browser */
      var now = Date.now();
      var rl  = JSON.parse(_ls.get('ss-comment-rl') || '{"last":0,"hour":[]}');
      if (now - rl.last < 10000) { alert('Please wait a few seconds before posting again.'); return; }
      rl.hour = rl.hour.filter(function (t) { return now - t < 3600000; });
      if (rl.hour.length >= 8) { alert('Hourly limit reached. Please come back later — your local copy is still saved.'); return; }
      rl.last = now; rl.hour.push(now);
      _ls.set('ss-comment-rl', JSON.stringify(rl));

      var comment = { text: text, time: new Date().toLocaleDateString(), hidden: false };
      comments.push(comment);
      _ls.set(key, JSON.stringify(comments));
      sendToSheet(pageKey, topic.id, comment);
      input.value = '';
      updateBtn();
      renderBox();
    });

    var input = box.querySelector('.ss-comment-input');
    if (input) {
      input.focus();
      var counter = box.querySelector('#ss-comment-count-' + topic.id);
      input.addEventListener('input', function () {
        if (counter) counter.textContent = input.value.length + ' / 500';
      });
    }
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
    var payload = {
      page: String(page || '').slice(0, 80),
      topic: String(topicId || '').slice(0, 80),
      text: String(comment.text || '').slice(0, 500),
      ts: Date.now(),
      ua: (navigator.userAgent || '').slice(0, 120),
      website: '' /* honeypot — server should drop any payload where this is non-empty */
    };
    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(SS_SHEET_URL, blob);
  } catch (e) { /* Silent fail — local storage is the primary store */ }
}

/* ============================================================
   13. STUDY TOOLS — REWRITTEN & EXPANDED
   ----
   A wellbeing-first, research-backed companion that lives at the
   bottom of every page. Modules:

     A. Wellbeing Panel — categorised, contextual, compassionate
        tips that adapt to time of day, day of week, current
        streak, and life context (eg "exam-week" mode).
     B. Pomodoro — circular SVG progress ring, auto-cycle through
        work / short-break / long-break, real Web Audio chime
        (no broken data URI), browser notifications, today's
        session count + total focus minutes, smart reminders.
     C. Streak engine — counts a day "studied" only if the user
        did something meaningful (a pomodoro, a study log, OR
        marking ≥ 1 topic done). Tracks current streak, longest
        streak, and a 14-day mini calendar.
     D. Study Log — daily reflection journal with optional
        attachment; persists last 50 entries.
     E. How To Study — wisdom panel with study-technique guidance
        (active recall, spaced repetition, exam compassion, etc.)

   The whole thing is collapsible (state remembered in
   localStorage) so it never gets in the way once you've read it.
============================================================ */

/* ---- A. WELLBEING TIP DATABASE ----
   Categories:
     sleep        — sleep is the #1 memory consolidator
     nutrition    — fuel for the brain
     movement     — short bursts beat marathons
     mental       — psychological wellbeing & exam anxiety
     technique    — study method science
     compassion   — humane reminders for crunch time
     environment  — phone, light, noise, posture
*/
var SS_WELLBEING_TIPS = [
  /* SLEEP */
  { cat: 'sleep', icon: '😴', text: 'Sleep is when your brain replays and consolidates today\'s learning. 7-9 hours before an exam outperforms 3 extra hours of cramming.', source: 'Walker, "Why We Sleep" (2017)' },
  { cat: 'sleep', icon: '🌙', text: 'A short nap (10-20 min) after a study session boosts memory retention by up to 30%. Set a timer; longer naps cause grogginess.', source: 'Lahl et al., 2008' },
  { cat: 'sleep', icon: '🛏️', text: 'No screens 30 min before bed. Blue light suppresses melatonin by ~50%. Your past-self studied so future-you could rest.', source: 'Chang et al., 2015' },
  { cat: 'sleep', icon: '☀️', text: 'Same wake time every day — even weekends — stabilises your circadian rhythm and improves cognition more than long lie-ins.', source: 'Walker, 2017' },

  /* NUTRITION */
  { cat: 'nutrition', icon: '🧠', text: 'Your brain uses 20% of your daily calories. Skipping meals directly impairs working memory and concentration.', source: 'Gailliot et al., 2007' },
  { cat: 'nutrition', icon: '💧', text: 'Even 1-2% dehydration reduces cognitive performance and mood. Keep water at your desk; refill it twice today.', source: 'Masento et al., 2014' },
  { cat: 'nutrition', icon: '🥦', text: 'Slow-release carbs (oats, beans, whole grains) sustain focus 2-3× longer than sugar spikes followed by crashes.', source: 'Benton, 2002' },
  { cat: 'nutrition', icon: '🐟', text: 'Omega-3 (fish, walnuts, chia) supports neural plasticity. Long-term diet quality predicts academic results.', source: 'Gómez-Pinilla, 2008' },
  { cat: 'nutrition', icon: '☕', text: 'Caffeine helps focus but has a 5-6h half-life. A 4pm coffee is still in your brain at 10pm — and ruins sleep.', source: 'Drake et al., 2013' },

  /* MOVEMENT */
  { cat: 'movement', icon: '🚶', text: 'A 20-minute walk boosts creative thinking by up to 60% for the next 2+ hours. Study, walk, study — not study, study, study.', source: 'Oppezzo & Schwartz, 2014' },
  { cat: 'movement', icon: '🧘', text: 'Stand up, stretch, and look 6 metres into the distance for 30 seconds every 25 minutes. Saves your eyes, neck, and focus.', source: 'Rosenfield, 2011 (20-20-20 rule)' },
  { cat: 'movement', icon: '💪', text: 'Even one session of moderate exercise enhances memory encoding for the next 30-60 minutes. Try 10 push-ups before a hard topic.', source: 'Roig et al., 2013' },

  /* MENTAL HEALTH & EXAM ANXIETY */
  { cat: 'mental', icon: '✍️', text: 'Spending 10 minutes writing about your exam worries beforehand reduces test anxiety and improves scores by ~15%.', source: 'Ramirez & Beilock, 2011' },
  { cat: 'mental', icon: '🌬️', text: 'Box breathing — 4 in, 4 hold, 4 out, 4 hold — for 90 seconds drops your heart rate and reactivates the prefrontal cortex.', source: 'US Navy SEAL training protocol' },
  { cat: 'mental', icon: '💛', text: 'Self-compassion (talking to yourself like a friend) predicts exam performance better than self-criticism. Be kind to yourself.', source: 'Neff & Germer, 2013' },
  { cat: 'mental', icon: '🧘‍♀️', text: 'Two weeks of 10-minute daily mindfulness raises GRE-style reading scores by ~16%. Even short practices add up.', source: 'Mrazek et al., 2013' },
  { cat: 'mental', icon: '🤝', text: 'Loneliness reduces cognitive function as much as poor sleep. Text a friend, study with one, or eat a meal with family today.', source: 'Cacioppo & Hawkley, 2009' },

  /* STUDY TECHNIQUE */
  { cat: 'technique', icon: '🎯', text: 'Active recall (closing the book and trying to remember) is 2-3× more effective than re-reading. Use Quiz Mode on every topic.', source: 'Roediger & Butler, 2011' },
  { cat: 'technique', icon: '🔁', text: 'Spaced repetition: revisit a topic after 1 day, then 3, then 7, then 21. You\'ll remember 5× more for the same time invested.', source: 'Cepeda et al., 2008' },
  { cat: 'technique', icon: '🔀', text: 'Interleaving topics (mixing subjects) feels harder but produces 43% better long-term retention than blocked practice.', source: 'Rohrer & Taylor, 2007' },
  { cat: 'technique', icon: '🗺️', text: 'Drawing a concept map by hand activates the same memory networks as the test will. Use the Mind Map button on each subject page.', source: 'Nesbit & Adesope, 2006' },
  { cat: 'technique', icon: '👨‍🏫', text: 'Explaining a topic out loud as if teaching someone (the Feynman technique) reveals every gap in your understanding.', source: 'Bargh & Schul, 1980' },
  { cat: 'technique', icon: '⏰', text: 'Your brain focuses deeply for ~25 minutes before drifting. Use the Pomodoro timer — short bursts beat marathons.', source: 'Cirillo, 2006' },

  /* COMPASSIONATE — exam crunch */
  { cat: 'compassion', icon: '🌱', text: 'You are not behind. You are exactly where someone who is learning would be. Progress is not linear.', source: 'Carol Dweck, growth mindset research' },
  { cat: 'compassion', icon: '🤍', text: 'Your worth is not your grade. The exam measures recall under pressure, not your intelligence or your future.', source: 'Self-compassion research, Neff' },
  { cat: 'compassion', icon: '🍵', text: 'It\'s OK to take a real break. A bath, a meal with someone you love, an episode of a show — these are not laziness; they\'re recovery.', source: 'Kahneman & Tversky, attention as a resource' },
  { cat: 'compassion', icon: '🌧️', text: 'A bad study day does not mean a bad week. Tomorrow is a clean slate. Treat yourself like someone you\'re responsible for helping.', source: 'Jordan Peterson paraphrase' },
  { cat: 'compassion', icon: '☂️', text: 'If you are crying, anxious, or shaking — please pause. Eat something, drink water, message someone. The studying can wait 20 minutes.', source: 'Compassionate exam care' },

  /* ENVIRONMENT */
  { cat: 'environment', icon: '📵', text: 'Just having your phone visible — even face-down and silent — reduces cognitive capacity by ~10%. Put it in another room.', source: 'Ward et al., 2017' },
  { cat: 'environment', icon: '🌅', text: 'Morning study sessions have ~20% better retention than late-night ones. Save passive review (videos) for evenings.', source: 'May et al., 2005' },
  { cat: 'environment', icon: '🌡️', text: 'Cooler rooms (18-21°C) improve concentration and reduce drowsiness. Crack a window before a long session.', source: 'Lan et al., 2009' },
  { cat: 'environment', icon: '🎵', text: 'Lyrics in your study music compete with reading. Lo-fi, classical, or ambient is far less disruptive than vocals.', source: 'Perham & Vizard, 2011' },

  /* JUST START — momentum hacks for when you cannot begin */
  { cat: 'just-start', icon: '🌱', text: 'Study badly on purpose. Tell yourself: "I\'m allowed to do a terrible job for 10 minutes." Perfection kills momentum. Once you start, your brain naturally wants to improve what it\'s doing.', source: 'Behavioral activation therapy' },
  { cat: 'just-start', icon: '🚪', text: 'Change location. Your brain links places to behavior. One spot for studying, another for relaxing. Even moving to a different room or library can reset focus instantly.', source: 'Context-dependent memory, Godden & Baddeley 1975' },
  { cat: 'just-start', icon: '🎁', text: 'Reward effort, not results. Don\'t wait until you "finish everything." Try: "If I focus 45 minutes I get a snack/walk/episode." This trains your brain to value the process, not just the outcome.', source: 'Operant conditioning, Skinner' },
  { cat: 'just-start', icon: '🌧️', text: 'Designate 10 minutes to let it all out — cry, journal, vent to a friend. Turn emotional overload into something contained, so it doesn\'t hijack your entire day. Then return to the desk.', source: 'Pennebaker expressive writing, 1997' },
  { cat: 'just-start', icon: '⏱️', text: 'The "two-minute rule": commit to just 2 minutes of studying. That\'s it. The hardest part is starting; once started, momentum carries you.', source: 'BJ Fogg, Tiny Habits (2019)' },
  { cat: 'just-start', icon: '📋', text: 'Make the next action absurdly small. Not "study chemistry" — "open the chemistry tab and read one paragraph." Big tasks paralyse; tiny ones get done.', source: 'Implementation intentions, Gollwitzer 1999' },

  /* WISDOM — Thirukkural & timeless reminders */
  { cat: 'wisdom', icon: '📜', text: '"உள்ளுவ தெல்லாம் உயர்வுள்ளல்; மற்றது தள்ளினும் தள்ளாமை நீர்த்து." — Aim only at noble heights; even if you fall, falling from height is itself dignity.', source: 'Thirukkural 596, Thiruvalluvar' },
  { cat: 'wisdom', icon: '📜', text: '"கற்க கசடறக் கற்பவை; கற்றபின் நிற்க அதற்குத் தக." — Learn flawlessly what you must learn; then live by what you have learned.', source: 'Thirukkural 391, Thiruvalluvar' },
  { cat: 'wisdom', icon: '📜', text: '"தொட்டனைத் தூறும் மணற்கேணி; மாந்தர்க்குக் கற்றனைத் தூறும் அறிவு." — Sand reveals water the deeper you dig; humans reveal wisdom the more they learn.', source: 'Thirukkural 396, Thiruvalluvar' },
  { cat: 'wisdom', icon: '📜', text: '"யாதானும் நாடாமால் ஊராமால்; என்னொருவன் சாந்துணையும் கல்லாத வாறு." — All the world is your home, every town your own — once you have learnt. Why then would anyone refuse to study till the end?', source: 'Thirukkural 397, Thiruvalluvar' },
  { cat: 'wisdom', icon: '📜', text: '"மடியுளாள் மாமுகடி; என்ப மடியிலான் தாளுளாள் தாமரையினாள்." — Misfortune dwells in laziness; fortune (Lakshmi) dwells in the feet of the diligent.', source: 'Thirukkural 617, Thiruvalluvar' },
  { cat: 'wisdom', icon: '📜', text: '"ஆகூழால் தோன்றும் அசைவின்மை கைப்பொருள்; போகூழால் தோன்றும் மடி." — Unwavering effort brings fortune; laziness brings its loss. Effort is the only luck you control.', source: 'Thirukkural 619, Thiruvalluvar' },
  { cat: 'wisdom', icon: '📜', text: '"வெள்ளத் தனைய மலர்நீட்டம்; மாந்தர்தம் உள்ளத் தனையது உயர்வு." — As deep as the water, so tall the lotus. As high as your thought, so high you rise.', source: 'Thirukkural 595, Thiruvalluvar' },
  { cat: 'wisdom', icon: '📜', text: '"அழுக்கா றுடையான்கண் ஆக்கம்போன்று இல்லை; யாதனும் தீமை செயல்." — Nothing harms a person more than envy of another\'s success. Compare yourself only to who you were yesterday.', source: 'Thirukkural 169, Thiruvalluvar (paraphrase)' },
  { cat: 'wisdom', icon: '🪷', text: '"You have a right to perform your duty, but never to the fruits of action." Study because the work is yours, not because the grade is.', source: 'Bhagavad Gita 2.47' },
  { cat: 'wisdom', icon: '🌿', text: '"The wound is the place where the Light enters you." A bad mock exam is information, not identity. Read the wound, then keep walking.', source: 'Rumi' },
  { cat: 'wisdom', icon: '🕊️', text: '"Between stimulus and response there is a space. In that space is our power to choose our response." When panic rises, breathe and choose.', source: 'Viktor Frankl' },
  { cat: 'wisdom', icon: '🌅', text: '"Nothing in nature blooms all year." Your mind has seasons too — winter rest is preparation, not failure.', source: 'Folk wisdom' }
];

/* Subset selectors used by the smart-tip rotation */
function ssPickTipsForContext(streak, sessionsToday, focusMinutesToday) {
  var hour = new Date().getHours();
  var dow = new Date().getDay(); /* 0 Sun..6 Sat */
  var pool = SS_WELLBEING_TIPS.slice();

  /* Time-of-day biases (always include a sprinkle of wisdom) */
  var morningCats   = ['just-start', 'sleep', 'nutrition', 'technique', 'wisdom'];
  var afternoonCats = ['movement', 'technique', 'environment', 'nutrition', 'wisdom'];
  var eveningCats   = ['mental', 'compassion', 'sleep', 'wisdom'];
  var nightCats     = ['sleep', 'compassion', 'mental', 'wisdom'];

  var preferred;
  if (hour >= 5 && hour < 12)       preferred = morningCats;
  else if (hour >= 12 && hour < 17) preferred = afternoonCats;
  else if (hour >= 17 && hour < 22) preferred = eveningCats;
  else                              preferred = nightCats;

  /* Weekend → bias compassion + rest */
  if (dow === 0 || dow === 6) preferred = preferred.concat(['compassion', 'mental', 'wisdom']);

  /* Long streak (5+) → compassion-bias to prevent burnout */
  if (streak >= 5) preferred = preferred.concat(['compassion', 'mental']);

  /* No sessions yet today → bias the just-start kit */
  if (!sessionsToday) preferred = preferred.concat(['just-start', 'just-start']);

  /* BURNOUT GUARD: 6+ sessions, 4+ focus hours, or streak > 14 → force rest pool */
  var burnout = (sessionsToday >= 6) || (focusMinutesToday >= 240) || (streak > 14);
  if (burnout) preferred = ['compassion', 'mental', 'wisdom'];

  /* Filter pool to preferred categories, fallback to all */
  var filtered = pool.filter(function (t) { return preferred.indexOf(t.cat) !== -1; });
  return filtered.length ? filtered : pool;
}

/* Burnout signal — used by the UI to show a "please rest" banner */
function ssBurnoutSignal(streak, sessionsToday, focusMinutesToday) {
  var reasons = [];
  if (sessionsToday >= 6)      reasons.push(sessionsToday + ' Pomodoros today');
  if (focusMinutesToday >= 240) reasons.push(Math.round(focusMinutesToday/60*10)/10 + 'h of focus today');
  if (streak > 14)             reasons.push(streak + '-day streak with no rest');
  return reasons.length ? reasons : null;
}

/* ---- B. AUDIO CHIME (Web Audio API, no external file) ---- */
function ssPlayChime(kind) {
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    var ctx = new Ctx();
    var notes = kind === 'break' ? [523.25, 659.25, 783.99]   /* C5 E5 G5 — bright */
                                 : [783.99, 659.25, 523.25];  /* G5 E5 C5 — settle */
    notes.forEach(function (freq, i) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      var t0 = ctx.currentTime + i * 0.18;
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      o.start(t0); o.stop(t0 + 0.34);
    });
    setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1200);
  } catch (e) { /* silent fail */ }
}

/* ---- C. STREAK ENGINE ----
   A "study day" requires meaningful action. We track:
     ss-study-days   : { 'YYYY-MM-DD': { pomos: n, logs: n, topicsDone: n } }
     ss-streak-best  : longest consecutive study-day streak
   A day counts as STUDIED if:
       pomos >= 1  OR  logs >= 1  OR  topicsDone >= 1
*/
function ssLoadStudyDays() {
  try { return JSON.parse(_ls.get('ss-study-days') || '{}'); }
  catch (e) { return {}; }
}
function ssSaveStudyDays(d) { _ls.set('ss-study-days', JSON.stringify(d)); }

function ssIsStudied(day) {
  if (!day) return false;
  return (day.pomos || 0) >= 1 || (day.logs || 0) >= 1 || (day.topicsDone || 0) >= 1;
}

function ssRecordAction(kind /* 'pomo' | 'log' | 'topic' */) {
  var days = ssLoadStudyDays();
  var today = new Date().toISOString().slice(0, 10);
  if (!days[today]) days[today] = { pomos: 0, logs: 0, topicsDone: 0 };
  if (kind === 'pomo')  days[today].pomos     = (days[today].pomos || 0) + 1;
  if (kind === 'log')   days[today].logs      = (days[today].logs  || 0) + 1;
  if (kind === 'topic') days[today].topicsDone= (days[today].topicsDone || 0) + 1;
  ssSaveStudyDays(days);
  /* Update best streak */
  var s = ssComputeStreak(days);
  var best = parseInt(_ls.get('ss-streak-best') || '0', 10);
  if (s.current > best) _ls.set('ss-streak-best', String(s.current));
}

function ssComputeStreak(days) {
  if (!days) days = ssLoadStudyDays();
  var current = 0, d = new Date();
  for (var i = 0; i < 365; i++) {
    var key = d.toISOString().slice(0, 10);
    if (ssIsStudied(days[key])) { current++; d.setDate(d.getDate() - 1); }
    else if (i === 0) {
      /* Today not yet studied — don't break the chain; check yesterday */
      d.setDate(d.getDate() - 1);
    } else break;
  }
  var best = parseInt(_ls.get('ss-streak-best') || '0', 10);
  return { current: current, best: Math.max(best, current) };
}

/* Build a 14-day mini calendar of study days */
function ssBuildCalendar(days) {
  var html = '<div class="ss-cal">';
  var today = new Date();
  for (var i = 13; i >= 0; i--) {
    var d = new Date(today); d.setDate(today.getDate() - i);
    var key = d.toISOString().slice(0, 10);
    var dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1);
    var studied = ssIsStudied(days[key]);
    var isToday = i === 0;
    var cls = 'ss-cal-cell' + (studied ? ' on' : '') + (isToday ? ' today' : '');
    var title = key + (studied ? ' — studied' : '');
    html += '<div class="' + cls + '" title="' + title + '"><span class="ss-cal-d">' + dayLabel + '</span><span class="ss-cal-n">' + d.getDate() + '</span></div>';
  }
  html += '</div>';
  return html;
}

/* ---- D. MAIN STUDY TOOLS RENDER ---- */
function initStudyTools() {
  var footer = document.querySelector('footer, .footer, .footer-note');
  var anchor = footer || document.body;

  var tools = document.createElement('div');
  tools.className = 'ss-study-tools';
  tools.id = 'ss-study-tools';

  /* Collapsed state — remembered across pages */
  var collapsed = _ls.get('ss-tools-collapsed') === '1';
  if (collapsed) tools.classList.add('ss-tools-collapsed');

  var pageKey = '/' + location.pathname.split('/').filter(Boolean).pop();

  /* Initial data */
  var days = ssLoadStudyDays();
  var todayKey = new Date().toISOString().slice(0, 10);
  var todayData = days[todayKey] || { pomos: 0, logs: 0, topicsDone: 0 };
  var streak = ssComputeStreak(days);
  var pomoMinutesToday = parseInt(_ls.get('ss-pomo-minutes:' + todayKey) || '0', 10);
  var logs = JSON.parse(_ls.get('ss-study-logs') || '[]');

  /* Pick a tip set; show first by default, allow next/category nav */
  var tipPool = ssPickTipsForContext(streak.current, todayData.pomos, pomoMinutesToday);
  var burnoutReasons = ssBurnoutSignal(streak.current, todayData.pomos, pomoMinutesToday);
  var tipIdx = Math.floor(Math.random() * tipPool.length);
  function currentTip() { return tipPool[tipIdx % tipPool.length]; }

  /* Build the markup */
  tools.innerHTML =
    /* ---- Toolbar (header + collapse toggle) ---- */
    '<div class="ss-tools-bar">' +
      '<div class="ss-tools-bar-left">' +
        '<span class="ss-tools-title">🧘 Study Companion</span>' +
        '<span class="ss-tools-meta">' +
          '<span class="ss-tools-stat" title="Current streak">🔥 <b id="ss-streak-cur">' + streak.current + '</b>d</span>' +
          '<span class="ss-tools-stat" title="Longest streak">🏆 <b>' + streak.best + '</b>d best</span>' +
          '<span class="ss-tools-stat" title="Focus minutes today">⏱️ <b id="ss-pomo-mins">' + pomoMinutesToday + '</b>m today</span>' +
        '</span>' +
      '</div>' +
      '<button class="ss-tools-toggle" id="ss-tools-toggle" aria-label="Toggle study companion">' +
        (collapsed ? '▾ Show' : '▴ Hide') +
      '</button>' +
    '</div>' +

    '<div class="ss-tools-body">' +

      /* ---- Tabs ---- */
      '<div class="ss-tabs" role="tablist">' +
        '<button class="ss-tab on" data-tab="wellbeing">💛 Wellbeing</button>' +
        '<button class="ss-tab" data-tab="pomodoro">🍅 Focus Timer</button>' +
        '<button class="ss-tab" data-tab="streak">📅 Streak</button>' +
        '<button class="ss-tab" data-tab="log">📝 Study Log</button>' +
        '<button class="ss-tab" data-tab="howto">📚 How to Study</button>' +
      '</div>' +

      /* ---- WELLBEING PANEL ---- */
      '<div class="ss-panel on" data-panel="wellbeing">' +
        (burnoutReasons ?
          '<div class="ss-burnout">' +
            '<div class="ss-burnout-h">🛑 Please rest now.</div>' +
            '<p>You\'ve done <strong>' + burnoutReasons.join(', ') + '</strong>. ' +
            'Your brain locks in memory <em>during rest</em>, not during the 7th Pomodoro. Stop here. Eat. Walk. Sleep early. ' +
            'Future-you will thank present-you for the wisdom of stopping.</p>' +
          '</div>' : '') +
        '<div class="ss-tip" id="ss-tip">' +
          '<div class="ss-tip-icon">' + currentTip().icon + '</div>' +
          '<div class="ss-tip-body">' +
            '<p class="ss-tip-text">' + currentTip().text + '</p>' +
            '<span class="ss-tip-source">— ' + currentTip().source + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="ss-tip-controls">' +
          '<button class="ss-tip-btn" id="ss-tip-next">Another tip →</button>' +
          '<div class="ss-tip-cats">' +
            '<button class="ss-tip-cat" data-cat="just-start">🌱 Just Start</button>' +
            '<button class="ss-tip-cat" data-cat="wisdom">📜 Wisdom</button>' +
            '<button class="ss-tip-cat" data-cat="sleep">😴 Sleep</button>' +
            '<button class="ss-tip-cat" data-cat="nutrition">🥦 Food</button>' +
            '<button class="ss-tip-cat" data-cat="movement">🚶 Move</button>' +
            '<button class="ss-tip-cat" data-cat="mental">🧘 Mind</button>' +
            '<button class="ss-tip-cat" data-cat="compassion">💛 Care</button>' +
            '<button class="ss-tip-cat" data-cat="technique">🎯 Method</button>' +
            '<button class="ss-tip-cat" data-cat="environment">📵 Setup</button>' +
          '</div>' +
        '</div>' +
        '<div class="ss-care-box">' +
          '<strong>A reminder:</strong> Sleep, food, water, and a friend nearby will do more for your exam than another hour of cramming. ' +
          'Your brain is a body part — take care of the body and the brain works.' +
        '</div>' +
      '</div>' +

      /* ---- POMODORO PANEL ---- */
      '<div class="ss-panel" data-panel="pomodoro">' +
        '<div class="ss-juststart" id="ss-juststart">' +
          '<div class="ss-juststart-h">🌱 Can\'t get started?</div>' +
          '<p class="ss-juststart-sub">Three keys that unlock momentum when nothing else will:</p>' +
          '<ol class="ss-juststart-steps">' +
            '<li><strong>Promise yourself a bad job.</strong> "I\'m allowed to study terribly for 10 minutes." Perfection paralyses; permission unlocks.</li>' +
            '<li><strong>Pick the smallest possible action.</strong> Not "study Chemistry" — "open one topic and read one paragraph."</li>' +
            '<li><strong>Set the reward upfront.</strong> "If I focus 25 minutes, I get [snack / walk / one episode]."</li>' +
          '</ol>' +
          '<div class="ss-juststart-actions">' +
            '<button class="ss-juststart-btn" id="ss-juststart-go">▶ Start a 10-minute commitment timer</button>' +
            '<button class="ss-juststart-btn ss-juststart-btn--ghost" id="ss-juststart-vent">🌧️ I need 10 min to vent first</button>' +
          '</div>' +
        '</div>' +
        '<div class="ss-pomo-wrap">' +
          /* SVG progress ring */
          '<div class="ss-pomo-ring">' +
            '<svg viewBox="0 0 200 200" width="200" height="200">' +
              '<circle cx="100" cy="100" r="90" stroke="var(--ss-border)" stroke-width="6" fill="none"/>' +
              '<circle id="ss-pomo-progress" cx="100" cy="100" r="90" stroke="var(--ss-accent)" stroke-width="6" fill="none" ' +
                'stroke-linecap="round" stroke-dasharray="565.5" stroke-dashoffset="0" transform="rotate(-90 100 100)"/>' +
            '</svg>' +
            '<div class="ss-pomo-center">' +
              '<div class="ss-pomo-time" id="ss-pomo-time">25:00</div>' +
              '<div class="ss-pomo-mode" id="ss-pomo-mode">Focus</div>' +
            '</div>' +
          '</div>' +
          '<div class="ss-pomo-side">' +
            '<div class="ss-pomo-cycle" id="ss-pomo-cycle">Session 1 of 4 · then long break</div>' +
            '<div class="ss-pomo-controls">' +
              '<button class="ss-pomo-btn ss-pomo-btn--primary" id="ss-pomo-start">▶ Start</button>' +
              '<button class="ss-pomo-btn" id="ss-pomo-skip">⏭ Skip</button>' +
              '<button class="ss-pomo-btn" id="ss-pomo-reset">↺ Reset</button>' +
            '</div>' +
            '<div class="ss-pomo-presets">' +
              '<button class="ss-pomo-preset on" data-mode="focus" data-min="25">25 / 5</button>' +
              '<button class="ss-pomo-preset" data-mode="focus" data-min="50">50 / 10</button>' +
              '<button class="ss-pomo-preset" data-mode="focus" data-min="15">15 / 3 (light)</button>' +
            '</div>' +
            '<div class="ss-pomo-today">' +
              'Today: <b id="ss-pomo-sessions">' + todayData.pomos + '</b> session' + (todayData.pomos === 1 ? '' : 's') +
              ' · <b id="ss-pomo-mins-2">' + pomoMinutesToday + '</b> focus minutes' +
            '</div>' +
            '<label class="ss-pomo-opt">' +
              '<input type="checkbox" id="ss-pomo-notify"' + (Notification && Notification.permission === 'granted' ? ' checked' : '') + '>' +
              ' Browser notification when timer ends' +
            '</label>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ---- STREAK PANEL ---- */
      '<div class="ss-panel" data-panel="streak">' +
        '<div class="ss-streak-stats">' +
          '<div class="ss-streak-stat"><div class="ss-streak-num">' + streak.current + '</div><div class="ss-streak-lbl">Current streak</div></div>' +
          '<div class="ss-streak-stat"><div class="ss-streak-num">' + streak.best + '</div><div class="ss-streak-lbl">Longest streak</div></div>' +
          '<div class="ss-streak-stat"><div class="ss-streak-num">' + Object.keys(days).filter(function (k) { return ssIsStudied(days[k]); }).length + '</div><div class="ss-streak-lbl">Study days total</div></div>' +
        '</div>' +
        ssBuildCalendar(days) +
        '<p class="ss-streak-rule">A day counts as <em>studied</em> when you complete <strong>1+ Pomodoro</strong>, write a <strong>study log entry</strong>, or mark <strong>1+ topic done</strong>. Take guilt-free rest days — recovery is part of the work.</p>' +
      '</div>' +

      /* ---- LOG PANEL ---- */
      '<div class="ss-panel" data-panel="log">' +
        '<div class="ss-log-prompt">What did I learn today? What felt hard? One thing I\'m proud of?</div>' +
        '<textarea class="ss-log-textarea" id="ss-log-text" placeholder="Two sentences are enough. Reflection is what turns practice into mastery." rows="3"></textarea>' +
        '<div class="ss-log-actions">' +
          '<input class="ss-log-attach" id="ss-log-attach" type="text" placeholder="Optional: link to notes, photo, doc">' +
          '<button class="ss-log-submit" id="ss-log-submit">Save entry</button>' +
        '</div>' +
        '<div class="ss-log-entries" id="ss-log-entries"></div>' +
      '</div>' +

      /* ---- HOW TO STUDY PANEL ---- */
      '<div class="ss-panel" data-panel="howto">' +
        '<div class="ss-howto-intro">Read one card a day. These are the techniques that actually work — backed by decades of research, written for human beings who get tired.</div>' +
        '<div class="ss-howto-grid">' +

          /* === MOMENTUM (the user\'s 4 tips, woven in naturally) === */
          '<div class="ss-howto-card ss-howto-momentum">' +
            '<h4>🌱 Study Badly On Purpose</h4>' +
            '<p>Tell yourself: <em>"I\'m allowed to do a terrible job for 10 minutes."</em> Perfection kills momentum. Once you start, your brain naturally wants to improve what it\'s doing.</p>' +
            '<span class="ss-howto-src">Behavioral activation · the 10-min rule</span>' +
          '</div>' +
          '<div class="ss-howto-card ss-howto-momentum">' +
            '<h4>🚪 Change Location</h4>' +
            '<p>Your brain links places to behavior. One spot for studying, another for relaxing. Even moving to another room or a library can reset your focus instantly.</p>' +
            '<span class="ss-howto-src">Context-dependent memory · Godden & Baddeley, 1975</span>' +
          '</div>' +
          '<div class="ss-howto-card ss-howto-momentum">' +
            '<h4>🎁 Reward Effort, Not Results</h4>' +
            '<p>Don\'t wait until you "finish everything." Try: <em>"If I focus for 45 minutes I get a snack / walk / video."</em> This trains your brain to value the process, not just the outcome.</p>' +
            '<span class="ss-howto-src">Operant conditioning · Skinner</span>' +
          '</div>' +
          '<div class="ss-howto-card ss-howto-momentum">' +
            '<h4>🌧️ The 10-Minute Vent Box</h4>' +
            '<p>Designate 10 minutes to <em>let it all out</em> — cry, journal, message someone. Turn emotional overload into something controlled and contained, so it doesn\'t hijack your entire day.</p>' +
            '<span class="ss-howto-src">Pennebaker, expressive writing (1997)</span>' +
          '</div>' +

          /* === CORE TECHNIQUES === */
          '<div class="ss-howto-card">' +
            '<h4>🎯 Active Recall</h4>' +
            '<p>Close the book. Try to write the topic from scratch. The struggle <em>is</em> the learning. Use Quiz Mode on every topic.</p>' +
            '<a class="ss-howto-link" href="https://www.science.org/doi/10.1126/science.1199327" target="_blank" rel="noopener">📄 Karpicke & Blunt, Science (2011)</a>' +
            '<span class="ss-howto-src">2-3× more effective than re-reading</span>' +
          '</div>' +
          '<div class="ss-howto-card">' +
            '<h4>🔁 Spaced Repetition</h4>' +
            '<p>Revisit a topic at intervals: 1 day → 3 days → 7 days → 21 days. Use the "done" buttons to track which topics are due for a review.</p>' +
            '<a class="ss-howto-link" href="https://www.youtube.com/watch?v=cVf38y07cfk" target="_blank" rel="noopener">▶ Ali Abdaal — How to Study (8 min)</a>' +
            '<span class="ss-howto-src">Cepeda et al., 2008</span>' +
          '</div>' +
          '<div class="ss-howto-card">' +
            '<h4>👨‍🏫 Feynman Technique</h4>' +
            '<p>Explain the topic out loud as if to a 12-year-old. Where you stumble is what you don\'t understand yet. Go re-learn that, repeat.</p>' +
            '<a class="ss-howto-link" href="https://fs.blog/feynman-learning-technique/" target="_blank" rel="noopener">📖 Farnam Street — Feynman Technique</a>' +
            '<span class="ss-howto-src">Feynman, 1985</span>' +
          '</div>' +
          '<div class="ss-howto-card">' +
            '<h4>🔀 Interleaving</h4>' +
            '<p>Don\'t study one subject for 3 hours. Mix Physics → Math → Chem in 25-min blocks. It feels harder but retention is 43% better.</p>' +
            '<a class="ss-howto-link" href="https://uweb.cas.usf.edu/~drohrer/pdfs/Rohrer&Taylor2007IS.pdf" target="_blank" rel="noopener">📄 Rohrer & Taylor (2007)</a>' +
            '<span class="ss-howto-src">"Desirable difficulty"</span>' +
          '</div>' +
          '<div class="ss-howto-card">' +
            '<h4>🗺️ Concept Mapping</h4>' +
            '<p>Drawing connections between ideas builds the same neural pathways the exam will use. Use the Mind Map button on each subject.</p>' +
            '<a class="ss-howto-link" href="https://cmap.ihmc.us/docs/theory-of-concept-maps" target="_blank" rel="noopener">📖 Novak — Theory of Concept Maps</a>' +
            '<span class="ss-howto-src">Nesbit & Adesope, 2006</span>' +
          '</div>' +
          '<div class="ss-howto-card">' +
            '<h4>✍️ Pre-Exam Worry Dump</h4>' +
            '<p>10 minutes before an exam, write down everything you\'re worried about. One study showed this raised average grades by 0.4 points.</p>' +
            '<a class="ss-howto-link" href="https://www.science.org/doi/10.1126/science.1199427" target="_blank" rel="noopener">📄 Ramirez & Beilock, Science (2011)</a>' +
            '<span class="ss-howto-src">Frees up working memory</span>' +
          '</div>' +
          '<div class="ss-howto-card">' +
            '<h4>📅 Study Plan Skeleton</h4>' +
            '<p>For every topic: <em>Read → Recall → Practice → Review</em>. Block 25-min Pomodoros, alternate subjects, finish with a reflection in the Study Log.</p>' +
            '<a class="ss-howto-link" href="https://bjorklab.psych.ucla.edu/research/" target="_blank" rel="noopener">📖 Bjork Lab — Desirable Difficulties</a>' +
            '<span class="ss-howto-src">Bjork & Bjork, 2011</span>' +
          '</div>' +
          '<div class="ss-howto-card">' +
            '<h4>🧘 Deep Work Block</h4>' +
            '<p>One uninterrupted 90-minute block per day, phone in another room, single subject. This single habit out-performs 6 hours of distracted study.</p>' +
            '<a class="ss-howto-link" href="https://www.youtube.com/watch?v=p6zMpVwh4ts" target="_blank" rel="noopener">▶ Cal Newport — Deep Work (talk)</a>' +
            '<span class="ss-howto-src">Newport, 2016</span>' +
          '</div>' +

          /* === HUMAN REMINDERS === */
          '<div class="ss-howto-card ss-howto-care">' +
            '<h4>💛 The Hardest Truth</h4>' +
            '<p>Working harder while ignoring sleep, food, and emotions is not dedication — it\'s self-harm dressed up as virtue. <strong>Rest is a strategy.</strong></p>' +
            '<span class="ss-howto-src">Care for yourself first.</span>' +
          '</div>' +
          '<div class="ss-howto-card ss-howto-care">' +
            '<h4>🪷 Thirukkural — On Effort</h4>' +
            '<p><em>"ஆகூழால் தோன்றும் அசைவின்மை கைப்பொருள்; போகூழால் தோன்றும் மடி."</em><br>Unwavering effort brings fortune; laziness loses it. <strong>Effort is the only luck you control.</strong></p>' +
            '<span class="ss-howto-src">Thirukkural 619 · Thiruvalluvar</span>' +
          '</div>' +
          '<div class="ss-howto-card ss-howto-care">' +
            '<h4>🕊️ Your Worth ≠ Your Grade</h4>' +
            '<p>The exam measures recall under pressure on one specific morning. It does not measure your intelligence, your kindness, or your future. Whatever happens — you are still whole.</p>' +
            '<span class="ss-howto-src">Self-compassion · Neff, 2003</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

    '</div>'; /* end .ss-tools-body */

  if (footer) { footer.insertAdjacentElement('beforebegin', tools); }
  else { document.body.appendChild(tools); }

  /* ====== Wire up: collapse toggle ====== */
  document.getElementById('ss-tools-toggle').addEventListener('click', function () {
    var nowCollapsed = !tools.classList.contains('ss-tools-collapsed');
    tools.classList.toggle('ss-tools-collapsed', nowCollapsed);
    _ls.set('ss-tools-collapsed', nowCollapsed ? '1' : '0');
    this.textContent = nowCollapsed ? '▾ Show' : '▴ Hide';
  });

  /* ====== Wire up: tabs ====== */
  document.querySelectorAll('.ss-tab').forEach(function (t) {
    t.addEventListener('click', function () {
      var name = this.getAttribute('data-tab');
      document.querySelectorAll('.ss-tab').forEach(function (x) { x.classList.toggle('on', x === t); });
      document.querySelectorAll('.ss-panel').forEach(function (p) {
        p.classList.toggle('on', p.getAttribute('data-panel') === name);
      });
      _ls.set('ss-tools-tab', name);
    });
  });
  /* Restore last tab */
  var lastTab = _ls.get('ss-tools-tab');
  if (lastTab) {
    var btn = document.querySelector('.ss-tab[data-tab="' + lastTab + '"]');
    if (btn) btn.click();
  }

  /* ====== Wire up: wellbeing tip rotation + categories ====== */
  function paintTip() {
    var t = currentTip();
    var box = document.getElementById('ss-tip');
    if (!box) return;
    box.querySelector('.ss-tip-icon').textContent = t.icon;
    box.querySelector('.ss-tip-text').textContent = t.text;
    box.querySelector('.ss-tip-source').textContent = '— ' + t.source;
    box.classList.remove('ss-tip-fade'); void box.offsetWidth; box.classList.add('ss-tip-fade');
  }
  document.getElementById('ss-tip-next').addEventListener('click', function () {
    tipIdx = (tipIdx + 1) % tipPool.length;
    paintTip();
  });
  document.querySelectorAll('.ss-tip-cat').forEach(function (cb) {
    cb.addEventListener('click', function () {
      var cat = this.getAttribute('data-cat');
      tipPool = SS_WELLBEING_TIPS.filter(function (t) { return t.cat === cat; });
      tipIdx = 0;
      document.querySelectorAll('.ss-tip-cat').forEach(function (x) { x.classList.remove('on'); });
      this.classList.add('on');
      paintTip();
    });
  });

  /* ====== Wire up: Pomodoro ====== */
  var pomoFocus = 25, pomoBreak = 5, pomoLong = 15;
  var pomoMode = 'focus';      /* 'focus' | 'break' | 'long' */
  var pomoLeft = pomoFocus * 60;
  var pomoTotal = pomoFocus * 60;
  var pomoRunning = false;
  var pomoInterval = null;
  var pomoSessionInCycle = 1;  /* 1..4 then long break */

  var timeEl    = document.getElementById('ss-pomo-time');
  var modeEl    = document.getElementById('ss-pomo-mode');
  var cycleEl   = document.getElementById('ss-pomo-cycle');
  var ringEl    = document.getElementById('ss-pomo-progress');
  var startBtn  = document.getElementById('ss-pomo-start');
  var skipBtn   = document.getElementById('ss-pomo-skip');
  var resetBtn  = document.getElementById('ss-pomo-reset');
  var notifyChk = document.getElementById('ss-pomo-notify');

  var RING_LEN = 2 * Math.PI * 90; /* circumference for r=90 */
  if (ringEl) ringEl.setAttribute('stroke-dasharray', RING_LEN.toFixed(2));

  function fmt(s) { var m = Math.floor(s / 60); var x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; }
  function paintTimer() {
    if (timeEl) timeEl.textContent = fmt(pomoLeft);
    if (modeEl) modeEl.textContent = pomoMode === 'focus' ? 'Focus' : (pomoMode === 'long' ? 'Long break' : 'Break');
    if (cycleEl) cycleEl.textContent = pomoMode === 'focus'
      ? 'Session ' + pomoSessionInCycle + ' of 4 · then long break'
      : (pomoMode === 'long' ? '15 min long break — stretch, snack, breathe' : '5 min break — stand up, water, eyes off screen');
    if (ringEl) {
      var ratio = pomoTotal > 0 ? (pomoLeft / pomoTotal) : 0;
      ringEl.setAttribute('stroke-dashoffset', (RING_LEN * (1 - ratio)).toFixed(2));
      ringEl.setAttribute('stroke', pomoMode === 'focus' ? 'var(--ss-accent)' : '#66bb6a');
    }
  }
  paintTimer();

  function notifyEnd(kind) {
    ssPlayChime(kind);
    if (notifyChk && notifyChk.checked && 'Notification' in window) {
      try {
        if (Notification.permission === 'granted') {
          new Notification(kind === 'break' ? '🍅 Time to focus' : '✅ Focus session complete', {
            body: kind === 'break' ? 'Break over — back to work for 25 minutes.' : 'Take a 5-min break. Stand up, drink water.',
            icon: 'favicon.svg'
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      } catch (e) {}
    }
  }

  function advanceCycle() {
    /* On finishing a focus block: log it + decide next mode */
    if (pomoMode === 'focus') {
      ssRecordAction('pomo');
      var mins = Math.round(pomoTotal / 60);
      var k = 'ss-pomo-minutes:' + new Date().toISOString().slice(0, 10);
      _ls.set(k, String(parseInt(_ls.get(k) || '0', 10) + mins));
      /* update the bar stats */
      var total = parseInt(_ls.get(k), 10);
      var minsEl = document.getElementById('ss-pomo-mins');
      var mins2  = document.getElementById('ss-pomo-mins-2');
      var sessEl = document.getElementById('ss-pomo-sessions');
      if (minsEl) minsEl.textContent = total;
      if (mins2) mins2.textContent = total;
      var d2 = ssLoadStudyDays();
      var todayD = d2[new Date().toISOString().slice(0,10)] || { pomos: 0 };
      if (sessEl) sessEl.textContent = todayD.pomos;
      var streakNow = ssComputeStreak();
      var sCur = document.getElementById('ss-streak-cur');
      if (sCur) sCur.textContent = streakNow.current;

      if (pomoSessionInCycle >= 4) { pomoMode = 'long'; pomoTotal = pomoLong * 60; pomoSessionInCycle = 1; }
      else { pomoMode = 'break'; pomoTotal = pomoBreak * 60; pomoSessionInCycle++; }
      pomoLeft = pomoTotal;
      notifyEnd('break');
    } else {
      /* End of break — back to focus */
      pomoMode = 'focus'; pomoTotal = pomoFocus * 60; pomoLeft = pomoTotal;
      notifyEnd('focus');
    }
    paintTimer();
  }

  startBtn.addEventListener('click', function () {
    if (pomoRunning) {
      clearInterval(pomoInterval);
      pomoRunning = false;
      startBtn.textContent = '▶ Resume';
    } else {
      pomoRunning = true;
      startBtn.textContent = '⏸ Pause';
      /* Ask for notification permission early */
      if (notifyChk && notifyChk.checked && 'Notification' in window && Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch (e) {}
      }
      pomoInterval = setInterval(function () {
        pomoLeft--;
        paintTimer();
        if (pomoLeft <= 0) {
          clearInterval(pomoInterval);
          pomoRunning = false;
          startBtn.textContent = '▶ Start';
          advanceCycle();
        }
      }, 1000);
    }
  });

  skipBtn.addEventListener('click', function () {
    clearInterval(pomoInterval);
    pomoRunning = false;
    startBtn.textContent = '▶ Start';
    pomoLeft = 0;
    advanceCycle();
  });

  resetBtn.addEventListener('click', function () {
    clearInterval(pomoInterval);
    pomoRunning = false;
    pomoMode = 'focus';
    pomoSessionInCycle = 1;
    pomoTotal = pomoFocus * 60;
    pomoLeft = pomoTotal;
    startBtn.textContent = '▶ Start';
    paintTimer();
  });

  document.querySelectorAll('.ss-pomo-preset').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.ss-pomo-preset').forEach(function (x) { x.classList.remove('on'); });
      this.classList.add('on');
      pomoFocus = parseInt(this.getAttribute('data-min'), 10);
      pomoBreak = pomoFocus >= 50 ? 10 : (pomoFocus >= 25 ? 5 : 3);
      pomoLong  = pomoFocus >= 50 ? 20 : 15;
      clearInterval(pomoInterval);
      pomoRunning = false;
      pomoMode = 'focus';
      pomoSessionInCycle = 1;
      pomoTotal = pomoFocus * 60;
      pomoLeft = pomoTotal;
      startBtn.textContent = '▶ Start';
      paintTimer();
    });
  });

  /* ====== Wire up: Just Start activator ====== */
  var jsGo   = document.getElementById('ss-juststart-go');
  var jsVent = document.getElementById('ss-juststart-vent');
  if (jsGo) jsGo.addEventListener('click', function () {
    /* Switch to a 10-min "permission to be bad" focus block */
    document.querySelectorAll('.ss-pomo-preset').forEach(function (x) { x.classList.remove('on'); });
    pomoFocus = 10; pomoBreak = 3; pomoLong = 15;
    pomoMode = 'focus'; pomoSessionInCycle = 1;
    pomoTotal = 10 * 60; pomoLeft = pomoTotal;
    paintTimer();
    jsGo.textContent = '✓ Timer set — press ▶ Start. You only owe yourself 10 bad minutes.';
    setTimeout(function () { startBtn && startBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
  });
  if (jsVent) jsVent.addEventListener('click', function () {
    /* Switch to log tab and prime the textarea */
    var logTab = document.querySelector('.ss-tab[data-tab="log"]');
    if (logTab) logTab.click();
    setTimeout(function () {
      var ta = document.getElementById('ss-log-text');
      if (ta) {
        ta.placeholder = 'Let it out. What\'s heavy right now? No one will read this but you. After 10 minutes, return to the desk.';
        ta.focus();
      }
    }, 200);
  });

  /* ====== Wire up: Study Log ====== */
  function renderLogs() {
    var el = document.getElementById('ss-log-entries');
    if (!el) return;
    var recent = logs.slice(0, 5);
    if (!recent.length) {
      el.innerHTML = '<span class="ss-log-empty">No entries yet — write your first reflection. Two sentences is enough to build the habit.</span>';
      return;
    }
    el.innerHTML = recent.map(function (l) {
      return '<div class="ss-log-entry">' +
        '<span class="ss-log-date">' + l.date + '</span>' +
        '<span class="ss-log-note">' + l.note.replace(/</g, '&lt;').slice(0, 180) + (l.note.length > 180 ? '…' : '') + '</span>' +
        (l.attachment ? '<a class="ss-log-link" href="' + l.attachment.replace(/"/g, '') + '" target="_blank" rel="noopener">📎</a>' : '') +
      '</div>';
    }).join('');
  }
  renderLogs();

  document.getElementById('ss-log-submit').addEventListener('click', function () {
    var text = document.getElementById('ss-log-text').value.trim();
    if (!text) return;
    var attach = document.getElementById('ss-log-attach').value.trim();
    var entry = { date: new Date().toISOString().slice(0, 10), page: pageKey, note: text, attachment: attach };
    logs.unshift(entry);
    _ls.set('ss-study-logs', JSON.stringify(logs.slice(0, 50)));
    document.getElementById('ss-log-text').value = '';
    document.getElementById('ss-log-attach').value = '';
    sendToSheet(pageKey, 'study-log', entry);
    /* Record the day */
    ssRecordAction('log');
    /* Update header stats */
    var s = ssComputeStreak();
    var sCur = document.getElementById('ss-streak-cur');
    if (sCur) sCur.textContent = s.current;
    renderLogs();
  });
}

/* ----------------------------------------------------------
   14. FIRST-VISIT ONBOARDING
---------------------------------------------------------- */
function initOnboarding() {
  if (_ls.get('ss-onboarded') === '1') return;
  var hero = document.querySelector('.hero');
  if (!hero) return;

  var bar = document.createElement('div');
  bar.className = 'ss-onboard';
  bar.innerHTML =
    '<span class="ss-onboard-text">💡 <strong>Tip:</strong> Try <em>🧠 Concept Map</em> to see how topics connect, <em>🎯 Quiz Mode</em> to test yourself, and <em>💬</em> on any topic to suggest improvements.</span>' +
    '<button class="ss-onboard-close" id="ss-onboard-close">Got it</button>';
  hero.insertAdjacentElement('afterend', bar);

  document.getElementById('ss-onboard-close').addEventListener('click', function () {
    bar.remove();
    _ls.set('ss-onboarded', '1');
  });
}

/* (boot sequence consolidated in section 2 above) */
