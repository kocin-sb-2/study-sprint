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
  }

  /* Homepage */
  if (isHomepage) {
    initHomeSearch();        /* subject filter input         */
    injectSyllabusLink();    /* link to syllabus guide       */
    initMasteryDashboard();  /* cross-subject progress panel */
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
function injectSyllabusLink() {
  var footer = document.querySelector('.footer-note');
  if (!footer) return;
  if (footer.querySelector('a[href="study-sprint-syllabus-guide.html"]')) return;

  var div = document.createElement('div');
  div.className = 'ss-syllabus-link';
  div.innerHTML =
    '<a href="study-sprint-syllabus-guide.html">&#128214; View Full Syllabus Master Guide &rarr;</a>';
  footer.appendChild(div);
}

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
   9. INTERACTIVE MIND MAPS (vis.js Network)
   WHY: Experts see connections between concepts; novices see
   isolated facts. Interactive graphs activate spatial memory
   and support dual-coding (Paivio 1986). Unlike static diagrams,
   a live-rendered graph reads directly from the page DOM — so it
   always reflects Cowork's latest content with zero maintenance.
   vis.js Network adds physics, zoom/pan, hover tooltips, and
   click-to-jump — things a hand-drawn diagram can never do.

   The graph is built by reading .section / .topic elements
   directly from the DOM, so it never needs manual updates.
   Clicking a topic node scrolls to and expands that topic.
---------------------------------------------------------- */

/* --- 9a. Load vis.js Network from CDN on first use --- */
var _visLoaded = false;
function loadVisNetwork(callback) {
  if (window.vis && window.vis.Network) { callback(); return; }
  if (_visLoaded) {
    /* Script tag injected but not resolved yet — poll briefly */
    var poll = setInterval(function () {
      if (window.vis && window.vis.Network) {
        clearInterval(poll);
        callback();
      }
    }, 80);
    return;
  }
  _visLoaded = true;

  /* vis-network CSS (tooltips, cursors) */
  var link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/vis-network@9/dist/vis-network.min.css';
  document.head.appendChild(link);

  var script    = document.createElement('script');
  script.src    = 'https://cdn.jsdelivr.net/npm/vis-network@9/dist/vis-network.min.js';
  script.onload = function () { callback(); };
  script.onerror = function () { callback(new Error('load-failed')); };
  document.head.appendChild(script);
}

/* --- 9b. Extract structured data from the page DOM --- */
function extractPageData() {
  var pageKey = '/' + location.pathname.split('/').filter(Boolean).pop();
  var palette = ['#4fc3f7','#ff8a65','#b388ff','#66bb6a','#ffd54f','#4db6ac','#f48fb1','#ffb74d'];
  var sections = [];
  var si = 0;

  document.querySelectorAll('.section').forEach(function (sec) {
    var numEl = sec.querySelector('.section-number');
    var titleEl = sec.querySelector('.section-title');
    if (!titleEl) return;
    var col = palette[si++ % palette.length];
    var sLabel = (numEl ? numEl.textContent.trim() + '  ' : '') + titleEl.textContent.trim();
    var topics = [];

    sec.querySelectorAll('.topic[id]').forEach(function (topic) {
      var nameEl = topic.querySelector('.topic-name');
      if (!nameEl) return;
      var name = nameEl.textContent.trim().replace(/\s+/g, ' ');
      var detailEl = topic.querySelector('.topic-detail');
      var detail = detailEl ? detailEl.textContent.trim() : '';
      var isHL = !!topic.querySelector('.hl-tag');
      var isDone = _ls.get(pageKey + ':' + topic.id) === '1';

      /* Extract key concepts as keywords for cross-linking */
      var keywords = [];
      topic.querySelectorAll('.concept-item strong, .term-word, .formula-card').forEach(function (el) {
        var t = el.textContent.replace(/[:\(\)]/g, '').trim().toLowerCase();
        if (t.length > 2 && t.length < 60) keywords.push(t);
      });

      var conceptCount = topic.querySelectorAll('.concept-item').length;
      var formulaCount = topic.querySelectorAll('.formula-card').length;
      var termCount = topic.querySelectorAll('.term-item').length;

      topics.push({
        id: topic.id, name: name, detail: detail, isHL: isHL,
        isDone: isDone, keywords: keywords,
        conceptCount: conceptCount, formulaCount: formulaCount, termCount: termCount
      });
    });

    sections.push({ label: sLabel, color: col, topics: topics });
  });
  return sections;
}

/* --- 9b2. Find cross-topic connections via shared keywords --- */
function findConnections(sections) {
  var connections = [];
  var allTopics = [];
  sections.forEach(function (s, si) {
    s.topics.forEach(function (t) { allTopics.push({ topic: t, sectionIdx: si }); });
  });

  for (var i = 0; i < allTopics.length; i++) {
    for (var j = i + 1; j < allTopics.length; j++) {
      if (allTopics[i].sectionIdx === allTopics[j].sectionIdx) continue;
      var a = allTopics[i].topic, b = allTopics[j].topic;
      var shared = [];
      a.keywords.forEach(function (kw) {
        b.keywords.forEach(function (kw2) {
          if (kw === kw2 || (kw.length > 5 && kw2.indexOf(kw) !== -1) || (kw2.length > 5 && kw.indexOf(kw2) !== -1)) {
            if (shared.indexOf(kw) === -1) shared.push(kw);
          }
        });
      });
      if (shared.length >= 1) {
        connections.push({ from: a.id, to: b.id, shared: shared });
      }
    }
  }
  return connections;
}

/* --- 9b3. Build vis.js graph from structured data --- */
function buildMapData(sections, connections, filter) {
  var isDark = !document.documentElement.classList.contains('ss-light');
  var textDark = '#0a0e17';
  var textLight = isDark ? '#e8ecf4' : '#1a1a2e';
  var dimColor = isDark ? '#2a3654' : '#c0c8d8';

  var h1 = document.querySelector('.hero h1');
  var rootLabel = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : 'Subject';
  var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() ||
    getComputedStyle(document.documentElement).getPropertyValue('--accent-physics').trim() || '#4fc3f7';

  var nodes = [], edges = [], nid = 1;
  var topicIdMap = {}; /* topic.id → vis node id */

  var rootId = nid++;
  nodes.push({
    id: rootId, label: rootLabel, shape: 'ellipse',
    widthConstraint: { maximum: 160 },
    color: { background: accent, border: accent, highlight: { background: accent, border: '#fff' } },
    font: { color: textDark, size: 14, face: 'Source Sans 3, sans-serif', bold: true },
    shadow: { enabled: true, size: 12, x: 0, y: 4, color: 'rgba(0,0,0,0.4)' },
    level: 0
  });

  sections.forEach(function (sec, si) {
    var sid = nid++;
    nodes.push({
      id: sid, label: sec.label, shape: 'box',
      margin: { top: 8, bottom: 8, left: 10, right: 10 },
      widthConstraint: { maximum: 170 },
      color: { background: sec.color, border: sec.color, highlight: { background: sec.color, border: '#fff' } },
      font: { color: textDark, size: 12, face: 'Source Sans 3, sans-serif', bold: true },
      shadow: { enabled: true, size: 8, x: 0, y: 3, color: 'rgba(0,0,0,0.3)' },
      level: 1, sectionIdx: si
    });
    edges.push({
      from: rootId, to: sid, color: { color: sec.color, opacity: 0.9 }, width: 2.5,
      smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.5 }
    });

    sec.topics.forEach(function (t) {
      /* Apply filters */
      if (filter.hl && !t.isHL) return;
      if (filter.mastery === 'done' && !t.isDone) return;
      if (filter.mastery === 'todo' && t.isDone) return;
      if (filter.section !== -1 && filter.section !== si) return;

      var tid = nid++;
      topicIdMap[t.id] = tid;
      var label = t.name.length > 28 ? t.name.slice(0, 26) + '…' : t.name;

      /* Size by content richness */
      var richness = t.conceptCount + t.formulaCount + t.termCount;
      var nodeSize = Math.min(8 + richness * 1.5, 24);

      /* Color by mastery state */
      var bg, border;
      if (t.isDone) {
        bg = isDark ? '#1b5e20' : '#a5d6a7'; border = '#66bb6a';
      } else if (t.isHL) {
        bg = '#b388ff'; border = '#9c6fe0';
      } else {
        bg = sec.color; border = sec.color;
      }

      /* Badge showing content counts */
      var badge = '';
      if (t.conceptCount) badge += '💡' + t.conceptCount + ' ';
      if (t.formulaCount) badge += '📐' + t.formulaCount + ' ';
      if (t.termCount) badge += '📖' + t.termCount;

      nodes.push({
        id: tid, label: label, shape: t.isHL ? 'diamond' : 'dot',
        size: nodeSize, topicElId: t.id, topicData: t, sectionIdx: si,
        color: { background: bg, border: border, highlight: { background: '#fff', border: sec.color } },
        font: { color: textLight, size: 10, face: 'Source Sans 3, sans-serif' },
        level: 2, badge: badge
      });
      edges.push({
        from: sid, to: tid, color: { color: sec.color, opacity: 0.4 }, width: 1.2,
        smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.4 }
      });
    });
  });

  /* Cross-topic connections (dashed lines) */
  connections.forEach(function (c) {
    var fromId = topicIdMap[c.from], toId = topicIdMap[c.to];
    if (!fromId || !toId) return;
    edges.push({
      from: fromId, to: toId,
      dashes: [6, 4], width: 1.5,
      color: { color: isDark ? 'rgba(255,213,79,0.5)' : 'rgba(180,140,0,0.4)' },
      smooth: { type: 'curvedCW', roundness: 0.2 },
      arrows: { to: { enabled: false } },
      title: 'Shared: ' + c.shared.slice(0, 3).join(', ')
    });
  });

  return { nodes: nodes, edges: edges, topicIdMap: topicIdMap };
}

/* --- 9c. Mind map feature init (upgraded) --- */
function initMindMap() {
  var hero = document.querySelector('.hero');
  if (!hero || !document.querySelector('.section')) return;

  var sections = extractPageData();
  var connections = findConnections(sections);
  var filter = { section: -1, mastery: 'all', hl: false };

  /* Trigger button */
  var btn = document.createElement('button');
  btn.className = 'ss-mindmap-btn';
  btn.innerHTML = '🧠 Concept Map';
  var badgeRow = hero.querySelector('.badge-row');
  (badgeRow || hero).appendChild(btn);

  /* Container */
  var container = document.createElement('div');
  container.className = 'ss-mindmap-container';
  container.id = 'ss-mindmap';
  container.style.display = 'none';

  var inner = document.createElement('div');
  inner.className = 'ss-mindmap-inner';

  /* Toolbar */
  var toolbar = document.createElement('div');
  toolbar.className = 'ss-mindmap-toolbar';

  var titleSpan = document.createElement('span');
  titleSpan.className = 'ss-mindmap-title';
  titleSpan.textContent = (document.querySelector('.hero h1') || {}).textContent || 'Concept Map';

  var fitBtn = document.createElement('button');
  fitBtn.className = 'ss-mindmap-fullscreen';
  fitBtn.innerHTML = '⊞ Fit';

  var fullscreenBtn = document.createElement('button');
  fullscreenBtn.className = 'ss-mindmap-fullscreen';
  fullscreenBtn.innerHTML = '⛶ Expand';

  var closeBtn = document.createElement('button');
  closeBtn.className = 'ss-mindmap-close';
  closeBtn.innerHTML = '✕ Close';

  toolbar.appendChild(titleSpan);
  toolbar.appendChild(fitBtn);
  toolbar.appendChild(fullscreenBtn);
  toolbar.appendChild(closeBtn);

  /* Filter bar */
  var filterBar = document.createElement('div');
  filterBar.className = 'ss-mindmap-filters';

  var sectionOpts = '<option value="-1">All sections</option>';
  sections.forEach(function (s, i) {
    sectionOpts += '<option value="' + i + '">' + s.label.replace(/</g, '&lt;') + '</option>';
  });

  filterBar.innerHTML =
    '<select class="ss-map-select" id="ss-map-section">' + sectionOpts + '</select>' +
    '<select class="ss-map-select" id="ss-map-mastery">' +
      '<option value="all">All progress</option>' +
      '<option value="done">✓ Completed</option>' +
      '<option value="todo">○ Not done</option>' +
    '</select>' +
    '<label class="ss-map-toggle"><input type="checkbox" id="ss-map-hl"> HL only</label>' +
    '<span class="ss-map-stats" id="ss-map-stats"></span>';

  /* Canvas */
  var canvas = document.createElement('div');
  canvas.className = 'ss-mindmap-canvas';
  canvas.style.height = '520px';

  /* Loading */
  var loadingDiv = document.createElement('div');
  loadingDiv.className = 'ss-mindmap-loading';
  loadingDiv.innerHTML = '<div class="ss-mindmap-spinner"></div><span>Building concept map…</span>';
  loadingDiv.style.display = 'none';

  /* Detail panel (shown on node click) */
  var detailPanel = document.createElement('div');
  detailPanel.className = 'ss-map-detail';
  detailPanel.id = 'ss-map-detail';
  detailPanel.style.display = 'none';

  /* Legend */
  var legend = document.createElement('div');
  legend.className = 'ss-mindmap-legend';
  legend.innerHTML =
    '<span class="ss-legend-item"><span class="ss-legend-dot" style="background:#4fc3f7"></span>Topic</span>' +
    '<span class="ss-legend-item"><span class="ss-legend-dot" style="background:#1b5e20"></span>Mastered</span>' +
    '<span class="ss-legend-item"><span class="ss-legend-diamond"></span>HL</span>' +
    '<span class="ss-legend-item"><span class="ss-legend-dot" style="background:#ffd54f;width:16px;height:2px;border-radius:1px"></span>Cross-link</span>' +
    '<span class="ss-legend-hint">Click node for details · Scroll to zoom · Drag to pan</span>';

  inner.appendChild(toolbar);
  inner.appendChild(filterBar);
  inner.appendChild(loadingDiv);
  var mapBody = document.createElement('div');
  mapBody.className = 'ss-map-body';
  mapBody.appendChild(canvas);
  mapBody.appendChild(detailPanel);
  inner.appendChild(mapBody);
  inner.appendChild(legend);
  container.appendChild(inner);

  var progressWrap = document.getElementById('ss-progress-wrap');
  (progressWrap || hero).insertAdjacentElement('afterend', container);

  var network = null, currentData = null, rendered = false;

  function updateStats(data) {
    var el = document.getElementById('ss-map-stats');
    if (!el) return;
    var topicNodes = data.nodes.filter(function (n) { return n.topicElId; });
    var done = topicNodes.filter(function (n) { return n.topicData && n.topicData.isDone; }).length;
    var crossLinks = connections.length;
    el.textContent = topicNodes.length + ' topics · ' + done + ' done · ' + crossLinks + ' cross-links';
  }

  function showDetail(nodeData) {
    var t = nodeData.topicData;
    if (!t) { detailPanel.style.display = 'none'; return; }
    var isDark = !document.documentElement.classList.contains('ss-light');

    var html = '<div class="ss-detail-header">' +
      '<strong>' + t.name + '</strong>' +
      (t.isHL ? ' <span class="ss-detail-hl">HL</span>' : '') +
      (t.isDone ? ' <span class="ss-detail-done">✓ Done</span>' : '') +
      '<button class="ss-detail-close" id="ss-detail-close">✕</button>' +
    '</div>';
    if (t.detail) html += '<p class="ss-detail-desc">' + t.detail + '</p>';
    html += '<div class="ss-detail-counts">' +
      (t.conceptCount ? '<span>💡 ' + t.conceptCount + ' concepts</span>' : '') +
      (t.formulaCount ? '<span>📐 ' + t.formulaCount + ' formulas</span>' : '') +
      (t.termCount ? '<span>📖 ' + t.termCount + ' terms</span>' : '') +
    '</div>';

    /* Show cross-connections */
    var related = connections.filter(function (c) { return c.from === t.id || c.to === t.id; });
    if (related.length) {
      html += '<div class="ss-detail-links"><strong>Connected topics:</strong>';
      related.forEach(function (r) {
        var otherId = r.from === t.id ? r.to : r.from;
        var otherEl = document.getElementById(otherId);
        var otherName = otherEl ? (otherEl.querySelector('.topic-name') || {}).textContent || otherId : otherId;
        html += '<div class="ss-detail-link-item">↔ ' + otherName +
          '<span class="ss-detail-shared">' + r.shared.slice(0, 3).join(', ') + '</span></div>';
      });
      html += '</div>';
    }

    html += '<button class="ss-detail-goto" id="ss-detail-goto" data-topic="' + t.id + '">↩ Jump to topic on page</button>';

    detailPanel.innerHTML = html;
    detailPanel.style.display = 'block';

    document.getElementById('ss-detail-close').addEventListener('click', function () {
      detailPanel.style.display = 'none';
    });
    document.getElementById('ss-detail-goto').addEventListener('click', function () {
      var el = document.getElementById(this.getAttribute('data-topic'));
      if (!el) return;
      el.classList.add('expanded');
      var header = el.querySelector('.topic-header');
      if (header) header.setAttribute('aria-expanded', 'true');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.outline = '2px solid var(--ss-accent)';
      setTimeout(function () { el.style.outline = ''; }, 2200);
    });
  }

  function renderNetwork() {
    loadingDiv.style.display = 'flex';
    canvas.style.display = 'none';
    detailPanel.style.display = 'none';

    loadVisNetwork(function (err) {
      if (err || !window.vis) {
        loadingDiv.innerHTML = '<span style="color:#ef5350">Could not load vis.js — check internet and refresh.</span>';
        return;
      }

      currentData = buildMapData(sections, connections, filter);
      updateStats(currentData);

      if (network) { network.destroy(); network = null; }

      network = new vis.Network(canvas, {
        nodes: new vis.DataSet(currentData.nodes),
        edges: new vis.DataSet(currentData.edges)
      }, {
        layout: {
          hierarchical: {
            enabled: true, direction: 'LR', sortMethod: 'directed',
            levelSeparation: 210, nodeSpacing: 80, treeSpacing: 120,
            parentCentralization: true
          }
        },
        physics: { enabled: false },
        interaction: {
          hover: true, tooltipDelay: 120, zoomView: true,
          dragView: true, dragNodes: true, multiselect: false,
          navigationButtons: false, keyboard: false
        },
        nodes: { borderWidth: 1.5 },
        edges: { arrows: { to: { enabled: true, scaleFactor: 0.45 } } }
      });

      network.once('stabilized', function () {
        loadingDiv.style.display = 'none';
        canvas.style.display = '';
        network.fit({ animation: { duration: 600, easingFunction: 'easeInOutQuad' } });
        rendered = true;
      });

      setTimeout(function () {
        if (!rendered) {
          loadingDiv.style.display = 'none';
          canvas.style.display = '';
          if (network) network.fit();
          rendered = true;
        }
      }, 3500);

      network.on('click', function (params) {
        if (!params.nodes.length) { detailPanel.style.display = 'none'; return; }
        var nodeId = params.nodes[0];
        var match = currentData.nodes.filter(function (n) { return n.id === nodeId; })[0];
        if (match && match.topicData) showDetail(match);
      });

      network.on('hoverNode', function () { canvas.style.cursor = 'pointer'; });
      network.on('blurNode', function () { canvas.style.cursor = ''; });
      network.on('dragging', function () { canvas.style.cursor = 'grabbing'; });
      network.on('dragEnd', function () { canvas.style.cursor = ''; });
    });
  }

  /* Filter change handlers */
  function onFilterChange() {
    filter.section = parseInt(document.getElementById('ss-map-section').value, 10);
    filter.mastery = document.getElementById('ss-map-mastery').value;
    filter.hl = document.getElementById('ss-map-hl').checked;
    rendered = false;
    renderNetwork();
  }

  function showMap() {
    container.style.display = 'block';
    /* Re-extract progress state in case user toggled done buttons */
    sections = extractPageData();
    connections = findConnections(sections);
    rendered = false;
    renderNetwork();
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideMap() {
    container.style.display = 'none';
    inner.classList.remove('ss-mindmap-fullscreen-active');
    fullscreenBtn.innerHTML = '⛶ Expand';
    canvas.style.height = '520px';
    detailPanel.style.display = 'none';
  }

  btn.addEventListener('click', function () {
    container.style.display === 'none' ? showMap() : hideMap();
  });
  closeBtn.addEventListener('click', hideMap);
  fitBtn.addEventListener('click', function () { if (network) network.fit({ animation: { duration: 400 } }); });

  document.getElementById('ss-map-section').addEventListener('change', onFilterChange);
  document.getElementById('ss-map-mastery').addEventListener('change', onFilterChange);
  document.getElementById('ss-map-hl').addEventListener('change', onFilterChange);

  fullscreenBtn.addEventListener('click', function () {
    inner.classList.toggle('ss-mindmap-fullscreen-active');
    if (inner.classList.contains('ss-mindmap-fullscreen-active')) {
      fullscreenBtn.innerHTML = '⛶ Shrink';
      canvas.style.height = (window.innerHeight - 180) + 'px';
    } else {
      fullscreenBtn.innerHTML = '⛶ Expand';
      canvas.style.height = '520px';
    }
    if (network) setTimeout(function () { network.fit(); }, 120);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && inner.classList.contains('ss-mindmap-fullscreen-active')) {
      inner.classList.remove('ss-mindmap-fullscreen-active');
      fullscreenBtn.innerHTML = '⛶ Expand';
      canvas.style.height = '520px';
      if (network) network.fit();
    }
  });

  window.addEventListener('ss-theme-change', function () {
    if (rendered && container.style.display !== 'none') {
      rendered = false;
      renderNetwork();
    }
  });
}

/* (MIND_MAPS data removed — graph is now built live from the DOM) */

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
    { path: '/fysik2.html',          label: 'Fysik 2',        color: '#4fc3f7' },
    { path: '/kemi2.html',           label: 'Kemi 2',         color: '#ff8a65' },
    { path: '/matematik5.html',      label: 'Matematik 5',    color: '#b388ff' },
    { path: '/ib-physics-hl.html',   label: 'IB Physics HL',  color: '#4fc3f7' },
    { path: '/ib-chemistry-hl.html', label: 'IB Chemistry HL',color: '#ff8a65' },
    { path: '/ib-math-aa-hl.html',   label: 'IB Math AA HL',  color: '#b388ff' }
  ];

  var totalDone  = 0;
  var totalCount = 0;

  /* Count progress from localStorage for each subject.
     WHY TWO SEPARATE PASSES:
     initProgress() removes the localStorage key when a topic is undone,
     so the only keys present are DONE topics. That means counting keys
     gives count === done always → always 100%. The fix: initProgress()
     also stores the total as pageKey+':__total__'. We read that here for
     the denominator, and count only '1'-valued topic keys for the numerator. */
  var bars = subjects.map(function (s) {
    var total = parseInt(_ls.get(s.path + ':__total__') || '0', 10);
    var done  = 0;
    _ls.keys().forEach(function (key) {
      if (key.indexOf(s.path + ':topic-') !== -1 && _ls.get(key) === '1') {
        done++;
      }
    });
    totalDone  += done;
    totalCount += total;
    var pct = total ? Math.round((done / total) * 100) : 0;
    return '<div class="ss-dash-row">' +
      '<span class="ss-dash-label">' + s.label + '</span>' +
      '<div class="ss-dash-track"><div class="ss-dash-fill" style="width:' + pct + '%;background:' + s.color + '"></div></div>' +
      '<span class="ss-dash-pct">' + (total ? pct + '%' : '—') + '</span>' +
    '</div>';
  });

  if (totalCount === 0) {
    /* Show empty state so first-time visitors know the feature exists */
    var empty = document.createElement('div');
    empty.className = 'ss-dashboard';
    empty.innerHTML =
      '<div class="ss-dash-header">' +
        '<span class="ss-dash-title">📊 Your Study Progress</span>' +
        '<span class="ss-dash-level" style="color:var(--ss-muted)">Visit any subject to start tracking</span>' +
      '</div>';
    var systems = document.querySelector('.systems');
    systems.insertBefore(empty, systems.firstChild);
    return;
  }

  var overallPct = Math.round((totalDone / totalCount) * 100);
  var level = overallPct < 25 ? 'Novice' : overallPct < 50 ? 'Apprentice' : overallPct < 75 ? 'Scholar' : overallPct < 100 ? 'Master' : 'Legend ⭐';

  var dash = document.createElement('div');
  dash.className = 'ss-dashboard';
  dash.innerHTML =
    '<div class="ss-dash-header">' +
      '<span class="ss-dash-title">📊 Your Study Progress</span>' +
      '<span class="ss-dash-level">' + level + ' — ' + overallPct + '% overall</span>' +
    '</div>' +
    '<div class="ss-dash-overall-track"><div class="ss-dash-overall-fill" style="width:' + overallPct + '%"></div></div>' +
    bars.join('');

  var systems = document.querySelector('.systems');
  systems.insertBefore(dash, systems.firstChild);
}

/* (boot sequence consolidated in section 2 above) */
