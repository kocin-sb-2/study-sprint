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
   9. INTERACTIVE CONCEPT MAP (D3.js Force Graph)
   Replaced vis.js with D3 force-directed layout for:
   - Free-form 2D physics (nodes float, cluster, repel)
   - Smooth SVG zoom/pan via d3-zoom
   - Rich HTML labels and cross-section connection arcs
   - Responsive canvas that fills available space
---------------------------------------------------------- */

/* --- 9a. Load D3 from CDN on first use --- */
var _d3Loaded = false;
function loadD3(callback) {
  if (window.d3) { callback(); return; }
  if (_d3Loaded) {
    var poll = setInterval(function () {
      if (window.d3) { clearInterval(poll); callback(); }
    }, 80);
    return;
  }
  _d3Loaded = true;
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js';
  s.onload = function () { callback(); };
  s.onerror = function () { callback(new Error('d3-load-failed')); };
  document.head.appendChild(s);
}

/* --- 9b. Extract structured data from the page DOM --- */
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
      var name = nameEl.textContent.trim().replace(/\s+/g, ' ');
      var detailEl = topic.querySelector('.topic-detail');
      var detail = detailEl ? detailEl.textContent.trim() : '';
      var isHL = !!topic.querySelector('.hl-tag');
      var isDone = _ls.get(pageKey + ':' + topic.id) === '1';

      var keywords = [];
      topic.querySelectorAll('.concept-item strong, .term-word, .formula-card').forEach(function (el) {
        var t = el.textContent.replace(/[:\(\)]/g, '').trim().toLowerCase();
        if (t.length > 2 && t.length < 60) keywords.push(t);
      });

      topics.push({
        id: topic.id, name: name, detail: detail, isHL: isHL, isDone: isDone,
        keywords: keywords,
        conceptCount: topic.querySelectorAll('.concept-item').length,
        formulaCount: topic.querySelectorAll('.formula-card').length,
        termCount: topic.querySelectorAll('.term-item').length
      });
    });
    sections.push({ label: sLabel, color: col, topics: topics });
  });
  return sections;
}

/* --- 9b2. Find cross-topic connections via shared keywords --- */
function findConnections(sections) {
  var connections = [], allTopics = [];
  sections.forEach(function (s, si) {
    s.topics.forEach(function (t) { allTopics.push({ topic: t, si: si }); });
  });
  for (var i = 0; i < allTopics.length; i++) {
    for (var j = i + 1; j < allTopics.length; j++) {
      if (allTopics[i].si === allTopics[j].si) continue;
      var a = allTopics[i].topic, b = allTopics[j].topic, shared = [];
      a.keywords.forEach(function (kw) {
        b.keywords.forEach(function (kw2) {
          if (kw === kw2 || (kw.length > 5 && kw2.indexOf(kw) !== -1) || (kw2.length > 5 && kw.indexOf(kw2) !== -1)) {
            if (shared.indexOf(kw) === -1) shared.push(kw);
          }
        });
      });
      if (shared.length >= 1) connections.push({ source: a.id, target: b.id, shared: shared });
    }
  }
  return connections;
}

/* --- 9b3. Build D3 graph data --- */
function buildD3Data(sections, connections, filter) {
  var nodes = [], links = [], nodeMap = {};
  var h1 = document.querySelector('.hero h1');
  var rootLabel = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : 'Subject';
  var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() ||
    getComputedStyle(document.documentElement).getPropertyValue('--accent-physics').trim() || '#4fc3f7';

  /* Root */
  var root = { id: '__root__', label: rootLabel, type: 'root', color: accent, radius: 32 };
  nodes.push(root); nodeMap[root.id] = root;

  sections.forEach(function (sec, si) {
    var secNode = { id: '__sec_' + si, label: sec.label, type: 'section', color: sec.color, radius: 22, sectionIdx: si };
    nodes.push(secNode); nodeMap[secNode.id] = secNode;
    links.push({ source: '__root__', target: secNode.id, type: 'hierarchy', color: sec.color, width: 3 });

    sec.topics.forEach(function (t) {
      if (filter.hl && !t.isHL) return;
      if (filter.mastery === 'done' && !t.isDone) return;
      if (filter.mastery === 'todo' && t.isDone) return;
      if (filter.section !== -1 && filter.section !== si) return;

      var richness = t.conceptCount + t.formulaCount + t.termCount;
      var r = Math.min(10 + richness * 1.2, 26);
      var col = t.isDone ? '#66bb6a' : (t.isHL ? '#b388ff' : sec.color);

      var node = {
        id: t.id, label: t.name, type: 'topic', color: col, radius: r,
        sectionIdx: si, sectionColor: sec.color, topicData: t
      };
      nodes.push(node); nodeMap[node.id] = node;
      links.push({ source: secNode.id, target: t.id, type: 'hierarchy', color: sec.color, width: 1.2 });
    });
  });

  /* Cross-links */
  connections.forEach(function (c) {
    if (nodeMap[c.source] && nodeMap[c.target]) {
      links.push({ source: c.source, target: c.target, type: 'cross', shared: c.shared, width: 1.5 });
    }
  });

  return { nodes: nodes, links: links };
}

/* --- 9c. Mind map feature init (upgraded) --- */
/* --- 9c. D3 Force-Directed Concept Map --- */
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
  (hero.querySelector('.badge-row') || hero).appendChild(btn);

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
  toolbar.innerHTML =
    '<span class="ss-mindmap-title">' + ((document.querySelector('.hero h1') || {}).textContent || 'Concept Map') + '</span>' +
    '<button class="ss-mindmap-fullscreen" id="ss-map-fit">⊞ Fit</button>' +
    '<button class="ss-mindmap-fullscreen" id="ss-map-expand">⛶ Expand</button>' +
    '<button class="ss-mindmap-close" id="ss-map-close">✕ Close</button>';

  /* Filter bar */
  var filterBar = document.createElement('div');
  filterBar.className = 'ss-mindmap-filters';
  var sOpts = '<option value="-1">All sections</option>';
  sections.forEach(function (s, i) {
    sOpts += '<option value="' + i + '">' + s.label.replace(/</g, '&lt;') + '</option>';
  });
  filterBar.innerHTML =
    '<select class="ss-map-select" id="ss-map-section">' + sOpts + '</select>' +
    '<select class="ss-map-select" id="ss-map-mastery"><option value="all">All progress</option><option value="done">✓ Completed</option><option value="todo">○ Not done</option></select>' +
    '<label class="ss-map-toggle"><input type="checkbox" id="ss-map-hl"> HL only</label>' +
    '<span class="ss-map-stats" id="ss-map-stats"></span>';

  /* SVG canvas */
  var canvasWrap = document.createElement('div');
  canvasWrap.className = 'ss-mindmap-canvas';
  canvasWrap.style.height = '600px';
  canvasWrap.id = 'ss-d3-canvas';

  /* Loading */
  var loadingDiv = document.createElement('div');
  loadingDiv.className = 'ss-mindmap-loading';
  loadingDiv.innerHTML = '<div class="ss-mindmap-spinner"></div><span>Building concept map…</span>';
  loadingDiv.style.display = 'none';

  /* Detail panel */
  var detailPanel = document.createElement('div');
  detailPanel.className = 'ss-map-detail';
  detailPanel.style.display = 'none';

  /* Legend */
  var legend = document.createElement('div');
  legend.className = 'ss-mindmap-legend';
  legend.innerHTML =
    '<span class="ss-legend-item"><span class="ss-legend-dot" style="background:#4fc3f7"></span>Topic</span>' +
    '<span class="ss-legend-item"><span class="ss-legend-dot" style="background:#66bb6a"></span>Mastered</span>' +
    '<span class="ss-legend-item"><span class="ss-legend-diamond"></span>HL</span>' +
    '<span class="ss-legend-item"><span style="display:inline-block;width:20px;height:2px;background:#ffd54f;border-radius:1px;vertical-align:middle"></span> Cross-link</span>' +
    '<span class="ss-legend-hint">Drag nodes · Scroll to zoom · Click for details</span>';

  /* Assemble */
  inner.appendChild(toolbar);
  inner.appendChild(filterBar);
  inner.appendChild(loadingDiv);
  var mapBody = document.createElement('div');
  mapBody.className = 'ss-map-body';
  mapBody.appendChild(canvasWrap);
  mapBody.appendChild(detailPanel);
  inner.appendChild(mapBody);
  inner.appendChild(legend);
  container.appendChild(inner);

  var progressWrap = document.getElementById('ss-progress-wrap');
  (progressWrap || hero).insertAdjacentElement('afterend', container);

  var simulation = null, svg = null, rendered = false;

  function updateStats(data) {
    var el = document.getElementById('ss-map-stats');
    if (!el) return;
    var topics = data.nodes.filter(function (n) { return n.type === 'topic'; });
    var done = topics.filter(function (n) { return n.topicData && n.topicData.isDone; }).length;
    el.textContent = topics.length + ' topics · ' + done + ' mastered · ' + connections.length + ' cross-links';
  }

  function showDetail(d) {
    var t = d.topicData;
    if (!t) { detailPanel.style.display = 'none'; return; }
    var html = '<div class="ss-detail-header"><strong>' + t.name + '</strong>' +
      (t.isHL ? ' <span class="ss-detail-hl">HL</span>' : '') +
      (t.isDone ? ' <span class="ss-detail-done">✓</span>' : '') +
      '<button class="ss-detail-close" onclick="this.closest(\'.ss-map-detail\').style.display=\'none\'">✕</button></div>';
    if (t.detail) html += '<p class="ss-detail-desc">' + t.detail + '</p>';
    html += '<div class="ss-detail-counts">' +
      (t.conceptCount ? '<span>💡 ' + t.conceptCount + ' concepts</span>' : '') +
      (t.formulaCount ? '<span>📐 ' + t.formulaCount + ' formulas</span>' : '') +
      (t.termCount ? '<span>📖 ' + t.termCount + ' terms</span>' : '') + '</div>';

    var related = connections.filter(function (c) { return c.source === t.id || c.target === t.id; });
    if (related.length) {
      html += '<div class="ss-detail-links"><strong>Connected topics:</strong>';
      related.forEach(function (r) {
        var oid = r.source === t.id ? r.target : r.source;
        var oel = document.getElementById(oid);
        var oname = oel ? (oel.querySelector('.topic-name') || {}).textContent || oid : oid;
        html += '<div class="ss-detail-link-item">↔ ' + oname + '<span class="ss-detail-shared">' + r.shared.slice(0, 3).join(', ') + '</span></div>';
      });
      html += '</div>';
    }
    html += '<button class="ss-detail-goto" onclick="var e=document.getElementById(\'' + t.id + '\');if(e){e.classList.add(\'expanded\');e.scrollIntoView({behavior:\'smooth\',block:\'center\'});e.style.outline=\'2px solid var(--ss-accent)\';setTimeout(function(){e.style.outline=\'\'},2200)}">↩ Jump to topic on page</button>';
    detailPanel.innerHTML = html;
    detailPanel.style.display = 'block';
  }

  function renderGraph() {
    loadingDiv.style.display = 'flex';
    canvasWrap.style.display = 'none';
    detailPanel.style.display = 'none';

    loadD3(function (err) {
      if (err || !window.d3) {
        loadingDiv.innerHTML = '<span style="color:#ef5350">Could not load D3.js — check internet.</span>';
        return;
      }

      var data = buildD3Data(sections, connections, filter);
      updateStats(data);

      /* Clear previous */
      canvasWrap.innerHTML = '';
      if (simulation) simulation.stop();

      var isDark = !document.documentElement.classList.contains('ss-light');
      var w = canvasWrap.clientWidth || 900;
      var h = canvasWrap.clientHeight || 600;

      svg = d3.select(canvasWrap).append('svg')
        .attr('width', '100%').attr('height', '100%')
        .attr('viewBox', [0, 0, w, h].join(' '))
        .style('background', isDark ? '#0d1117' : '#f5f7fa');

      /* Defs for glow + arrow */
      var defs = svg.append('defs');
      var glow = defs.append('filter').attr('id', 'glow');
      glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
      glow.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic'])
        .enter().append('feMergeNode').attr('in', function (d) { return d; });

      var g = svg.append('g');

      /* Zoom */
      var zoom = d3.zoom().scaleExtent([0.2, 4]).on('zoom', function (event) {
        g.attr('transform', event.transform);
      });
      svg.call(zoom);

      /* Links */
      var link = g.append('g').selectAll('line')
        .data(data.links).enter().append('line')
        .attr('stroke', function (d) {
          if (d.type === 'cross') return isDark ? '#ffd54f' : '#b8860b';
          return d.color || '#555';
        })
        .attr('stroke-opacity', function (d) { return d.type === 'cross' ? 0.5 : 0.35; })
        .attr('stroke-width', function (d) { return d.width || 1; })
        .attr('stroke-dasharray', function (d) { return d.type === 'cross' ? '6,4' : null; });

      /* Nodes */
      var node = g.append('g').selectAll('g')
        .data(data.nodes).enter().append('g')
        .style('cursor', 'pointer')
        .call(d3.drag()
          .on('start', function (event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', function (event, d) { d.fx = event.x; d.fy = event.y; })
          .on('end', function (event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
        );

      /* Node shapes */
      node.each(function (d) {
        var el = d3.select(this);
        if (d.type === 'root') {
          el.append('circle').attr('r', d.radius)
            .attr('fill', d.color).attr('stroke', '#fff').attr('stroke-width', 2)
            .attr('filter', 'url(#glow)');
        } else if (d.type === 'section') {
          el.append('rect')
            .attr('x', -d.radius * 2.5).attr('y', -d.radius * 0.8)
            .attr('width', d.radius * 5).attr('height', d.radius * 1.6)
            .attr('rx', 8).attr('fill', d.color).attr('stroke', '#fff').attr('stroke-width', 1.5)
            .attr('filter', 'url(#glow)');
        } else {
          if (d.topicData && d.topicData.isHL) {
            /* Diamond for HL */
            el.append('rect')
              .attr('x', -d.radius).attr('y', -d.radius)
              .attr('width', d.radius * 2).attr('height', d.radius * 2)
              .attr('rx', 3)
              .attr('transform', 'rotate(45)')
              .attr('fill', d.color).attr('stroke', '#fff').attr('stroke-width', 1);
          } else {
            el.append('circle').attr('r', d.radius)
              .attr('fill', d.color).attr('stroke', isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)')
              .attr('stroke-width', 1.5);
          }
          /* Mastery ring */
          if (d.topicData && d.topicData.isDone) {
            el.append('circle').attr('r', d.radius + 4)
              .attr('fill', 'none').attr('stroke', '#66bb6a').attr('stroke-width', 2)
              .attr('stroke-dasharray', '4,2').attr('opacity', 0.8);
          }
        }
      });

      /* Labels */
      node.append('text')
        .text(function (d) {
          if (d.type === 'root') return d.label;
          if (d.type === 'section') return d.label.length > 30 ? d.label.slice(0, 28) + '…' : d.label;
          return d.label.length > 22 ? d.label.slice(0, 20) + '…' : d.label;
        })
        .attr('text-anchor', 'middle')
        .attr('dy', function (d) { return d.type === 'topic' ? d.radius + 14 : 4; })
        .attr('fill', isDark ? '#c8d0e0' : '#2a2a3e')
        .attr('font-size', function (d) { return d.type === 'root' ? 13 : d.type === 'section' ? 11 : 9; })
        .attr('font-weight', function (d) { return d.type === 'topic' ? 400 : 700; })
        .attr('font-family', 'Source Sans 3, sans-serif')
        .style('pointer-events', 'none');

      /* Content count badges for topics */
      node.filter(function (d) { return d.type === 'topic'; }).append('text')
        .text(function (d) {
          var t = d.topicData;
          var parts = [];
          if (t.conceptCount) parts.push('💡' + t.conceptCount);
          if (t.formulaCount) parts.push('📐' + t.formulaCount);
          return parts.join(' ');
        })
        .attr('text-anchor', 'middle')
        .attr('dy', function (d) { return d.radius + 26; })
        .attr('fill', isDark ? '#6b7a90' : '#8090a0')
        .attr('font-size', 8)
        .style('pointer-events', 'none');

      /* Hover effects */
      node.on('mouseover', function (event, d) {
        d3.select(this).select('circle, rect').transition().duration(150)
          .attr('stroke-width', 3).attr('stroke', '#fff');
      }).on('mouseout', function (event, d) {
        d3.select(this).select('circle, rect').transition().duration(150)
          .attr('stroke-width', d.type === 'root' ? 2 : 1.5)
          .attr('stroke', d.type === 'topic' ? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)') : '#fff');
      });

      /* Click */
      node.on('click', function (event, d) {
        event.stopPropagation();
        if (d.type === 'topic') showDetail(d);
      });
      svg.on('click', function () { detailPanel.style.display = 'none'; });

      /* Force simulation */
      simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(function (d) { return d.id; })
          .distance(function (d) {
            if (d.type === 'cross') return 250;
            if (d.source.type === 'root') return 160;
            return 90;
          }).strength(function (d) { return d.type === 'cross' ? 0.05 : 0.4; }))
        .force('charge', d3.forceManyBody().strength(function (d) {
          return d.type === 'root' ? -600 : d.type === 'section' ? -300 : -120;
        }))
        .force('center', d3.forceCenter(w / 2, h / 2))
        .force('collision', d3.forceCollide().radius(function (d) { return d.radius + 12; }))
        .force('x', d3.forceX(w / 2).strength(0.04))
        .force('y', d3.forceY(h / 2).strength(0.04));

      simulation.on('tick', function () {
        link.attr('x1', function (d) { return d.source.x; })
            .attr('y1', function (d) { return d.source.y; })
            .attr('x2', function (d) { return d.target.x; })
            .attr('y2', function (d) { return d.target.y; });
        node.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
      });

      /* After simulation settles, fit view */
      setTimeout(function () {
        var bounds = g.node().getBBox();
        var pad = 40;
        var scale = Math.min(w / (bounds.width + pad * 2), h / (bounds.height + pad * 2), 1.5);
        var tx = w / 2 - (bounds.x + bounds.width / 2) * scale;
        var ty = h / 2 - (bounds.y + bounds.height / 2) * scale;
        svg.transition().duration(800).call(
          zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale)
        );
      }, 2500);

      loadingDiv.style.display = 'none';
      canvasWrap.style.display = '';
      rendered = true;
    });
  }

  function fitView() {
    if (!svg) return;
    var g = svg.select('g');
    var bounds = g.node().getBBox();
    var w = canvasWrap.clientWidth || 900, h = canvasWrap.clientHeight || 600;
    var pad = 40;
    var scale = Math.min(w / (bounds.width + pad * 2), h / (bounds.height + pad * 2), 1.5);
    var tx = w / 2 - (bounds.x + bounds.width / 2) * scale;
    var ty = h / 2 - (bounds.y + bounds.height / 2) * scale;
    svg.transition().duration(500).call(
      d3.zoom().transform, d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }

  function onFilterChange() {
    filter.section = parseInt(document.getElementById('ss-map-section').value, 10);
    filter.mastery = document.getElementById('ss-map-mastery').value;
    filter.hl = document.getElementById('ss-map-hl').checked;
    rendered = false;
    renderGraph();
  }

  function showMap() {
    container.style.display = 'block';
    sections = extractPageData();
    connections = findConnections(sections);
    rendered = false;
    renderGraph();
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideMap() {
    container.style.display = 'none';
    inner.classList.remove('ss-mindmap-fullscreen-active');
    document.getElementById('ss-map-expand').innerHTML = '⛶ Expand';
    canvasWrap.style.height = '600px';
    detailPanel.style.display = 'none';
  }

  btn.addEventListener('click', function () { container.style.display === 'none' ? showMap() : hideMap(); });
  document.getElementById('ss-map-close').addEventListener('click', hideMap);
  document.getElementById('ss-map-fit').addEventListener('click', fitView);
  document.getElementById('ss-map-section').addEventListener('change', onFilterChange);
  document.getElementById('ss-map-mastery').addEventListener('change', onFilterChange);
  document.getElementById('ss-map-hl').addEventListener('change', onFilterChange);

  document.getElementById('ss-map-expand').addEventListener('click', function () {
    inner.classList.toggle('ss-mindmap-fullscreen-active');
    if (inner.classList.contains('ss-mindmap-fullscreen-active')) {
      this.innerHTML = '⛶ Shrink';
      canvasWrap.style.height = (window.innerHeight - 160) + 'px';
    } else {
      this.innerHTML = '⛶ Expand';
      canvasWrap.style.height = '600px';
    }
    setTimeout(fitView, 150);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && inner.classList.contains('ss-mindmap-fullscreen-active')) {
      inner.classList.remove('ss-mindmap-fullscreen-active');
      document.getElementById('ss-map-expand').innerHTML = '⛶ Expand';
      canvasWrap.style.height = '600px';
      setTimeout(fitView, 150);
    }
  });

  window.addEventListener('ss-theme-change', function () {
    if (rendered && container.style.display !== 'none') { rendered = false; renderGraph(); }
  });
}

/* (Graph is now built live from the DOM using D3.js) */
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
