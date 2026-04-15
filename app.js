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

  /* Toolbar */
  inner.innerHTML =
    '<div class="ss-mindmap-toolbar">' +
      '<span class="ss-mindmap-title">' + ((hero.querySelector('h1') || {}).textContent || 'Concept Map') + '</span>' +
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
      '<span class="ss-legend-hint">Scroll to zoom · Drag to pan · Click topic for details</span>' +
    '</div>';

  container.appendChild(inner);
  var pw = document.getElementById('ss-progress-wrap');
  (pw || hero).insertAdjacentElement('afterend', container);

  var rendered = false;

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
        var on = oel ? (oel.querySelector('.topic-name') || {}).textContent || oid : oid;
        html += '<div class="ss-detail-link-item">↔ ' + on + '</div>';
      });
      html += '</div>';
    }
    html += '<button class="ss-detail-goto" onclick="var e=document.getElementById(\'' + t.id +
      '\');if(e){e.classList.add(\'expanded\');e.scrollIntoView({behavior:\'smooth\',block:\'center\'});}">↩ Go to topic</button>';
    dp.innerHTML = html;
    dp.style.display = 'block';
  }

  function render() {
    var sections = extractPageData();
    var connections = findConnections(sections);
    var canvas = document.getElementById('ss-d3-canvas');
    var loading = document.getElementById('ss-map-loading');
    loading.style.display = 'flex';
    canvas.style.display = 'none';

    loadD3(function (err) {
      if (err) { loading.innerHTML = '<span style="color:#ef5350">Failed to load D3.</span>'; return; }

      canvas.innerHTML = '';
      var isDark = !document.documentElement.classList.contains('ss-light');
      var w = canvas.clientWidth || 900;
      var h = canvas.clientHeight || 600;
      var cx = w / 2, cy = h / 2;

      var svg = d3.select(canvas).append('svg')
        .attr('width', '100%').attr('height', '100%')
        .attr('viewBox', '0 0 ' + w + ' ' + h)
        .style('background', isDark ? '#0d1117' : '#f5f7fa')
        .style('border-radius', '0 0 12px 12px');

      var g = svg.append('g');
      svg.call(d3.zoom().scaleExtent([0.3, 3]).on('zoom', function (ev) {
        g.attr('transform', ev.transform);
      }));

      /* Defs */
      var defs = svg.append('defs');
      var glow = defs.append('filter').attr('id', 'glow');
      glow.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'b');
      glow.append('feMerge').selectAll('feMergeNode').data(['b', 'SourceGraphic']).enter().append('feMergeNode').attr('in', function (d) { return d; });

      var totalTopics = 0;
      sections.forEach(function (s) { totalTopics += s.topics.length; });
      var numSections = sections.length;

      /* Calculate radii */
      var innerR = Math.min(w, h) * 0.15;  /* section ring */
      var outerR = Math.min(w, h) * 0.38;  /* topic ring */

      /* Draw section arcs as background bands */
      var secAngleStart = 0;
      var secPositions = [];
      var topicPositions = {};

      sections.forEach(function (sec, si) {
        var secAngle = (sec.topics.length / Math.max(totalTopics, 1)) * Math.PI * 2;
        var midAngle = secAngleStart + secAngle / 2 - Math.PI / 2;

        /* Section arc band */
        var arc = d3.arc()
          .innerRadius(innerR - 8)
          .outerRadius(outerR + 20)
          .startAngle(secAngleStart)
          .endAngle(secAngleStart + secAngle)
          .padAngle(0.03);

        g.append('path').attr('d', arc)
          .attr('transform', 'translate(' + cx + ',' + cy + ')')
          .attr('fill', sec.color).attr('opacity', isDark ? 0.06 : 0.08);

        /* Section label on inner ring */
        var sx = cx + Math.cos(midAngle) * innerR;
        var sy = cy + Math.sin(midAngle) * innerR;
        secPositions.push({ x: sx, y: sy, angle: midAngle, color: sec.color, label: sec.label });

        /* Section node */
        g.append('circle').attr('cx', sx).attr('cy', sy).attr('r', 18)
          .attr('fill', sec.color).attr('stroke', isDark ? '#1a2236' : '#fff').attr('stroke-width', 2)
          .attr('filter', 'url(#glow)');

        /* Section label */
        var shortLabel = sec.label.replace(/^\d+\s*/, '');
        if (shortLabel.length > 18) shortLabel = shortLabel.slice(0, 16) + '…';
        g.append('text').attr('x', sx).attr('y', sy + 30)
          .attr('text-anchor', 'middle')
          .attr('fill', sec.color).attr('font-size', 9).attr('font-weight', 600)
          .attr('font-family', 'Source Sans 3, sans-serif')
          .text(shortLabel);

        /* Topics on outer ring, evenly spaced within this section's arc */
        sec.topics.forEach(function (t, ti) {
          var tAngle = secAngleStart + (ti + 0.5) / Math.max(sec.topics.length, 1) * secAngle - Math.PI / 2;
          var richness = t.conceptCount + t.formulaCount + t.termCount;
          var r = Math.min(7 + richness * 0.8, 18);
          var tx = cx + Math.cos(tAngle) * outerR;
          var ty = cy + Math.sin(tAngle) * outerR;
          topicPositions[t.id] = { x: tx, y: ty };

          /* Line from section to topic */
          g.append('line')
            .attr('x1', sx).attr('y1', sy).attr('x2', tx).attr('y2', ty)
            .attr('stroke', sec.color).attr('stroke-opacity', 0.2).attr('stroke-width', 1);

          /* Topic node */
          var col = t.isDone ? '#66bb6a' : (t.isHL ? '#b388ff' : sec.color);
          var nodeG = g.append('g').attr('transform', 'translate(' + tx + ',' + ty + ')').style('cursor', 'pointer');

          if (t.isHL) {
            nodeG.append('rect').attr('x', -r).attr('y', -r).attr('width', r * 2).attr('height', r * 2)
              .attr('rx', 3).attr('transform', 'rotate(45)')
              .attr('fill', col).attr('stroke', isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)').attr('stroke-width', 1);
          } else {
            nodeG.append('circle').attr('r', r)
              .attr('fill', col).attr('stroke', isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)').attr('stroke-width', 1);
          }

          /* Done ring */
          if (t.isDone) {
            nodeG.append('circle').attr('r', r + 3)
              .attr('fill', 'none').attr('stroke', '#66bb6a').attr('stroke-width', 1.5).attr('stroke-dasharray', '3,2');
          }

          /* Topic label */
          var tLabel = t.name.length > 20 ? t.name.slice(0, 18) + '…' : t.name;
          nodeG.append('text').attr('y', r + 12)
            .attr('text-anchor', 'middle')
            .attr('fill', isDark ? '#a0aec0' : '#4a5568').attr('font-size', 8)
            .attr('font-family', 'Source Sans 3, sans-serif')
            .text(tLabel);

          /* Hover */
          nodeG.on('mouseover', function () {
            d3.select(this).select('circle, rect').transition().duration(120)
              .attr('stroke', '#fff').attr('stroke-width', 2.5);
          }).on('mouseout', function () {
            d3.select(this).select('circle, rect').transition().duration(120)
              .attr('stroke', isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)').attr('stroke-width', 1);
          });

          /* Click */
          nodeG.on('click', function (ev) {
            ev.stopPropagation();
            showDetail(t, connections);
            /* Highlight connected links */
            g.selectAll('.cross-link').attr('stroke-opacity', 0.08);
            g.selectAll('.cross-link-' + t.id.replace(/[^a-zA-Z0-9]/g, '_')).attr('stroke-opacity', 0.7);
          });
        });

        secAngleStart += secAngle;
      });

      /* Cross-links as curved arcs */
      connections.forEach(function (c) {
        var a = topicPositions[c.from], b = topicPositions[c.to];
        if (!a || !b) return;
        var mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.15;
        var my = (a.y + b.y) / 2 + (b.x - a.x) * 0.15;
        var safeFrom = c.from.replace(/[^a-zA-Z0-9]/g, '_');
        var safeTo = c.to.replace(/[^a-zA-Z0-9]/g, '_');
        g.append('path')
          .attr('d', 'M' + a.x + ',' + a.y + ' Q' + mx + ',' + my + ' ' + b.x + ',' + b.y)
          .attr('fill', 'none')
          .attr('stroke', isDark ? '#ffd54f' : '#b8860b')
          .attr('stroke-width', 1.2)
          .attr('stroke-opacity', 0.25)
          .attr('stroke-dasharray', '5,3')
          .attr('class', 'cross-link cross-link-' + safeFrom + ' cross-link-' + safeTo);
      });

      /* Center node */
      g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 28)
        .attr('fill', isDark ? '#1a2236' : '#fff')
        .attr('stroke', sections[0] ? sections[0].color : '#4fc3f7').attr('stroke-width', 3)
        .attr('filter', 'url(#glow)');

      var rootLabel = (hero.querySelector('h1') || {}).textContent || 'Subject';
      g.append('text').attr('x', cx).attr('y', cy + 1)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', isDark ? '#e8ecf4' : '#1a1a2e')
        .attr('font-size', 11).attr('font-weight', 700)
        .attr('font-family', 'Playfair Display, serif')
        .text(rootLabel.length > 14 ? rootLabel.slice(0, 12) + '…' : rootLabel);

      /* Click background to deselect */
      svg.on('click', function () {
        document.getElementById('ss-map-detail').style.display = 'none';
        g.selectAll('.cross-link').attr('stroke-opacity', 0.25);
      });

      loading.style.display = 'none';
      canvas.style.display = '';
      rendered = true;
    });
  }

  function showMap() {
    container.style.display = 'block';
    rendered = false;
    render();
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideMap() {
    container.style.display = 'none';
    inner.classList.remove('ss-mindmap-fullscreen-active');
    document.getElementById('ss-map-expand').innerHTML = '⛶ Expand';
    document.getElementById('ss-d3-canvas').style.height = '600px';
    document.getElementById('ss-map-detail').style.display = 'none';
  }

  btn.addEventListener('click', function () { container.style.display === 'none' ? showMap() : hideMap(); });
  document.getElementById('ss-map-close').addEventListener('click', hideMap);

  document.getElementById('ss-map-expand').addEventListener('click', function () {
    inner.classList.toggle('ss-mindmap-fullscreen-active');
    var canvas = document.getElementById('ss-d3-canvas');
    if (inner.classList.contains('ss-mindmap-fullscreen-active')) {
      this.innerHTML = '⛶ Shrink';
      canvas.style.height = (window.innerHeight - 140) + 'px';
    } else {
      this.innerHTML = '⛶ Expand';
      canvas.style.height = '600px';
    }
    rendered = false;
    render();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && inner.classList.contains('ss-mindmap-fullscreen-active')) {
      inner.classList.remove('ss-mindmap-fullscreen-active');
      document.getElementById('ss-map-expand').innerHTML = '⛶ Expand';
      document.getElementById('ss-d3-canvas').style.height = '600px';
      rendered = false; render();
    }
  });

  window.addEventListener('ss-theme-change', function () {
    if (container.style.display !== 'none') { rendered = false; render(); }
  });
}

/* (Concept map built live from DOM using D3.js radial layout) */
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
