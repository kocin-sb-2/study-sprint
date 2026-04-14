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
   1. SECTION & TOPIC TOGGLES
   (previously inlined on every page — now centralised)
   These must stay on `window` because onclick="" attributes
   call them as globals.
---------------------------------------------------------- */
function toggle(id) {
  var body  = document.getElementById('body-'  + id);
  var arrow = document.getElementById('arrow-' + id);
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = 'flex';
    if (arrow) arrow.classList.add('open');
  } else {
    body.style.display = 'none';
    if (arrow) arrow.classList.remove('open');
  }
}

function toggleTopic(id) {
  var el = document.getElementById('topic-' + id);
  if (el) el.classList.toggle('expanded');
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
    initMindMap();           /* concept map (lazy Mermaid)   */
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

  var pageKey = location.pathname;
  var total   = topics.length;

  /* Store total so the homepage dashboard can read it without loading this page.
     WHY: localStorage only contains done topics (keys are removed when undone),
     so the dashboard cannot infer the total from localStorage alone. Saving it
     here gives the dashboard a stable denominator. */
  localStorage.setItem(pageKey + ':__total__', total);

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
        localStorage.removeItem(pageKey + ':' + t.id);
      });
      location.reload();
    });
  }

  /* Inject a done-button into each topic header */
  topics.forEach(function (topic) {
    var header = topic.querySelector('.topic-header');
    if (!header) return;

    var isDone = localStorage.getItem(pageKey + ':' + topic.id) === '1';
    if (isDone) topic.classList.add('ss-done');

    var btn = document.createElement('button');
    btn.className   = 'ss-done-btn' + (isDone ? ' active' : '');
    btn.setAttribute('aria-label', isDone ? 'Mark as not done' : 'Mark as done');
    btn.textContent = isDone ? '✓' : '○';

    btn.addEventListener('click', function (e) {
      e.stopPropagation(); /* prevent toggling topic expansion */
      var done = localStorage.getItem(pageKey + ':' + topic.id) === '1';
      if (done) {
        localStorage.removeItem(pageKey + ':' + topic.id);
        btn.className   = 'ss-done-btn';
        btn.textContent = '○';
        btn.setAttribute('aria-label', 'Mark as done');
        topic.classList.remove('ss-done');
      } else {
        localStorage.setItem(pageKey + ':' + topic.id, '1');
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
    if (localStorage.getItem(pageKey + ':' + t.id) === '1') done++;
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
    '<button class="ss-search-clear" id="ss-search-clear" title="Clear search" style="display:none">&#10005;</button>';

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

  var isDark = localStorage.getItem('ss-theme') !== 'light';
  applyTheme(isDark);
  btn.textContent = isDark ? '☀️' : '🌙';

  btn.addEventListener('click', function () {
    isDark = !isDark;
    applyTheme(isDark);
    btn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('ss-theme', isDark ? 'dark' : 'light');
  });

  document.body.appendChild(btn);
}

function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.remove('ss-light');
  } else {
    document.documentElement.classList.add('ss-light');
  }
}

/* ----------------------------------------------------------
   9. INTERACTIVE MIND MAPS (Mermaid.js)
   WHY: Experts see connections between concepts; novices
   see isolated facts. Mind maps activate spatial memory
   and reduce cognitive load (dual-coding theory, Paivio 1986).

   FIX NOTES (v2):
   - Mermaid auto-renders on load if it finds .mermaid elements.
     We now use a placeholder class and only add .mermaid when
     the user clicks, AFTER calling initialize({ startOnLoad:false }).
   - Removed special unicode chars from edge labels that broke
     Mermaid's parser (ω, ², θ, Σ etc.).
   - Added error handling + loading state.
   - Theme adapts to dark/light mode.
   - Fullscreen toggle + zoom/pan via CSS transform.
---------------------------------------------------------- */
var MIND_MAPS = {
  'fysik2.html': {
    title: 'Fysik 2 — Concept Map',
    diagram: 'flowchart TD\n' +
      '  F2["Fysik 2"] --> S01["Rorelse och Krafter"]\n' +
      '  F2 --> S02["Oscillationer och Vagor"]\n' +
      '  F2 --> S03["Elektricitet och Magnetism"]\n' +
      '  F2 --> S04["Atomfysik"]\n' +
      '  F2 --> S05["Karnfysik"]\n' +
      '  F2 --> S06["Astrofysik"]\n' +
      '  S01 --> S01a["Cirkular rorelse"]\n' +
      '  S01 --> S01b["Gravitation"]\n' +
      '  S01 --> S01c["Rorelsemangd"]\n' +
      '  S02 --> S02a["SHM"]\n' +
      '  S02 --> S02b["Vagor"]\n' +
      '  S02 --> S02c["Ljud och Ljus"]\n' +
      '  S03 --> S03a["E-falt"]\n' +
      '  S03 --> S03b["B-falt"]\n' +
      '  S03 --> S03c["Induktion"]\n' +
      '  S03 --> S03d["Vaxelstrom"]\n' +
      '  S04 --> S04a["Energinivaer"]\n' +
      '  S04 --> S04b["Fotoelektriska"]\n' +
      '  S05 --> S05a["Bindningsenergi"]\n' +
      '  S05 --> S05b["Sonderfall"]\n' +
      '  S05 --> S05c["Karnreaktioner"]\n' +
      '  S06 --> S06a["Stjarnor och HR"]\n' +
      '  S06 --> S06b["Kosmologi"]\n' +
      '  S01a -.-> S01b\n' +
      '  S02a -.-> S01a\n' +
      '  S03c -.-> S03b\n' +
      '  S04a -.-> S04b\n' +
      '  S05a -.-> S05c'
  },
  'kemi2.html': {
    title: 'Kemi 2 — Concept Map',
    diagram: 'flowchart TD\n' +
      '  K2["Kemi 2"] --> S01["Organisk Kemi"]\n' +
      '  K2 --> S02["Biokemi"]\n' +
      '  K2 --> S03["Jamvikt och Kinetik"]\n' +
      '  K2 --> S04["Analytisk Kemi"]\n' +
      '  K2 --> S05["Laborationer"]\n' +
      '  S01 --> S01a["Kolkemi"]\n' +
      '  S01 --> S01b["IUPAC-nomenklatur"]\n' +
      '  S01 --> S01c["Reaktionstyper"]\n' +
      '  S01 --> S01d["Funktionella grupper"]\n' +
      '  S01 --> S01e["Isomeri"]\n' +
      '  S02 --> S02a["Proteiner"]\n' +
      '  S02 --> S02b["Kolhydrater"]\n' +
      '  S02 --> S02c["Lipider"]\n' +
      '  S02 --> S02d["Enzymer"]\n' +
      '  S03 --> S03a["Kemisk jamvikt"]\n' +
      '  S03 --> S03b["Reaktionshastighet"]\n' +
      '  S03 --> S03c["Syra-bas"]\n' +
      '  S03 --> S03d["Redox"]\n' +
      '  S04 --> S04a["Spektroskopi"]\n' +
      '  S04 --> S04b["Kromatografi"]\n' +
      '  S04 --> S04c["Titrering"]\n' +
      '  S01c -.-> S03b\n' +
      '  S03a -.-> S03c\n' +
      '  S03d -.-> S04c\n' +
      '  S01a -.-> S01e'
  },
  'matematik5.html': {
    title: 'Matematik 5 — Concept Map',
    diagram: 'flowchart TD\n' +
      '  M5["Matematik 5"] --> S01["Differentialekvationer"]\n' +
      '  M5 --> S02["Komplexa Tal"]\n' +
      '  M5 --> S03["Diskret Matematik"]\n' +
      '  M5 --> S04["Bevisforing"]\n' +
      '  S01 --> S01a["1a ordningen ODE"]\n' +
      '  S01 --> S01b["Linjara ODE"]\n' +
      '  S01 --> S01c["2a ordningen ODE"]\n' +
      '  S01 --> S01d["Tillampningar"]\n' +
      '  S02 --> S02a["a + bi"]\n' +
      '  S02 --> S02b["Operationer"]\n' +
      '  S02 --> S02c["Polar form"]\n' +
      '  S02 --> S02d["Komplexa rotter"]\n' +
      '  S03 --> S03a["Kombinatorik"]\n' +
      '  S03 --> S03b["Talteori"]\n' +
      '  S03 --> S03c["Grafteori"]\n' +
      '  S03 --> S03d["Induktion"]\n' +
      '  S04 --> S04a["Bevismetoder"]\n' +
      '  S04 --> S04b["Logik"]\n' +
      '  S04 --> S04c["Strategier"]\n' +
      '  S01c -.-> S02d\n' +
      '  S02c -.-> S02d\n' +
      '  S03d -.-> S04a'
  },
  'ib-physics-hl.html': {
    title: 'IB Physics HL — Concept Map',
    diagram: 'flowchart TD\n' +
      '  PH["IB Physics HL"] --> A["A: Space Time Motion"]\n' +
      '  PH --> B["B: Particulate Matter"]\n' +
      '  PH --> C["C: Wave Behaviour"]\n' +
      '  PH --> D["D: Fields"]\n' +
      '  PH --> E["E: Nuclear and Quantum"]\n' +
      '  A --> A1["Kinematics"]\n' +
      '  A --> A2["Forces and Momentum"]\n' +
      '  A --> A3["Energy and Power"]\n' +
      '  A --> A4["HL: Rigid Body"]\n' +
      '  A --> A5["HL: Relativity"]\n' +
      '  B --> B1["Thermal Energy"]\n' +
      '  B --> B2["Greenhouse"]\n' +
      '  B --> B3["Gas Laws"]\n' +
      '  B --> B4["HL: Thermodynamics"]\n' +
      '  B --> B5["Circuits"]\n' +
      '  C --> C1["SHM"]\n' +
      '  C --> C2["Wave Model"]\n' +
      '  C --> C3["Wave Phenomena"]\n' +
      '  C --> C4["Standing Waves"]\n' +
      '  C --> C5["HL: Doppler"]\n' +
      '  D --> D1["Gravitational"]\n' +
      '  D --> D2["Electric and Magnetic"]\n' +
      '  D --> D3["Motion in Fields"]\n' +
      '  D --> D4["HL: Induction"]\n' +
      '  E --> E1["Atomic Structure"]\n' +
      '  E --> E2["HL: Quantum"]\n' +
      '  E --> E3["Radioactivity"]\n' +
      '  E --> E4["Fission and Fusion"]\n' +
      '  E --> E5["Particle Physics"]\n' +
      '  A1 -.-> A2\n' +
      '  A2 -.-> A3\n' +
      '  B3 -.-> B1\n' +
      '  D1 -.-> D2\n' +
      '  E1 -.-> E2\n' +
      '  D4 -.-> B5'
  },
  'ib-chemistry-hl.html': {
    title: 'IB Chemistry HL — Concept Map',
    diagram: 'flowchart TD\n' +
      '  CH["IB Chemistry HL"] --> S1["S1: Particulate Matter"]\n' +
      '  CH --> S2["S2: Bonding"]\n' +
      '  CH --> S3["S3: Classification"]\n' +
      '  CH --> R1["R1: Energy"]\n' +
      '  CH --> R2["R2: Rates and Equilibrium"]\n' +
      '  CH --> R3["R3: Mechanisms"]\n' +
      '  S1 --> S1a["Atoms and Isotopes"]\n' +
      '  S1 --> S1b["Electron Config"]\n' +
      '  S1 --> S1c["The Mole"]\n' +
      '  S1 --> S1d["Ideal Gases"]\n' +
      '  S2 --> S2a["Ionic Model"]\n' +
      '  S2 --> S2b["Covalent and VSEPR"]\n' +
      '  S2 --> S2c["Metallic"]\n' +
      '  S2 --> S2d["Intermolecular Forces"]\n' +
      '  S3 --> S3a["Periodic Table"]\n' +
      '  S3 --> S3b["Organic Nomenclature"]\n' +
      '  R1 --> R1a["Enthalpy and Hess"]\n' +
      '  R1 --> R1b["HL: Gibbs Free Energy"]\n' +
      '  R2 --> R2a["Stoichiometry"]\n' +
      '  R2 --> R2b["HL: Rate Laws"]\n' +
      '  R2 --> R2c["Kc Kp Le Chatelier"]\n' +
      '  R3 --> R3a["Acids Bases and pH"]\n' +
      '  R3 --> R3b["Redox and Electrochem"]\n' +
      '  R3 --> R3c["HL: SN1 vs SN2"]\n' +
      '  R3 --> R3d["Polymerization"]\n' +
      '  S1b -.-> S2b\n' +
      '  S2a -.-> R1a\n' +
      '  R1a -.-> R1b\n' +
      '  R2b -.-> R2c\n' +
      '  R3a -.-> R3b'
  },
  'ib-math-aa-hl.html': {
    title: 'IB Math AA HL — Concept Map',
    diagram: 'flowchart TD\n' +
      '  MA["IB Math AA HL"] --> T1["1: Number and Algebra"]\n' +
      '  MA --> T2["2: Functions"]\n' +
      '  MA --> T3["3: Geometry and Trig"]\n' +
      '  MA --> T4["4: Stats and Probability"]\n' +
      '  MA --> T5["5: Calculus"]\n' +
      '  T1 --> T1a["Sequences and Series"]\n' +
      '  T1 --> T1b["Logs and Exponents"]\n' +
      '  T1 --> T1c["Binomial Theorem"]\n' +
      '  T1 --> T1d["HL: Proof and Induction"]\n' +
      '  T1 --> T1e["HL: Complex Numbers"]\n' +
      '  T2 --> T2a["Domain Range Inverse"]\n' +
      '  T2 --> T2b["Polynomials"]\n' +
      '  T2 --> T2c["Exp and Log Functions"]\n' +
      '  T2 --> T2d["HL: Partial Fractions"]\n' +
      '  T2 --> T2e["Transformations"]\n' +
      '  T3 --> T3a["Trig Identities"]\n' +
      '  T3 --> T3b["Trig Functions"]\n' +
      '  T3 --> T3c["Vectors and Dot Product"]\n' +
      '  T3 --> T3d["HL: 3D Lines and Planes"]\n' +
      '  T4 --> T4a["Descriptive Stats"]\n' +
      '  T4 --> T4b["Probability and Bayes"]\n' +
      '  T4 --> T4c["Distributions"]\n' +
      '  T4 --> T4d["HL: Hypothesis Testing"]\n' +
      '  T5 --> T5a["Differentiation"]\n' +
      '  T5 --> T5b["Optimization"]\n' +
      '  T5 --> T5c["Integration"]\n' +
      '  T5 --> T5d["HL: Integration Tech"]\n' +
      '  T5 --> T5e["Applications"]\n' +
      '  T5 --> T5f["HL: Diff Equations"]\n' +
      '  T1a -.-> T5c\n' +
      '  T1e -.-> T3a\n' +
      '  T5a -.-> T5c\n' +
      '  T2c -.-> T5a\n' +
      '  T1d -.-> T4d'
  }
};

/* Prevent Mermaid from auto-rendering on page load */
/* Dynamically load Mermaid from CDN the first time it is needed.
   WHY DYNAMIC: Adding a <script> tag to every HTML page would
   require 6 edits and break every time Cowork regenerates a file.
   Injecting it on demand means zero HTML changes and Mermaid is
   only fetched when the user actually opens a mind map. */
function loadMermaid(callback) {
  if (window.mermaid) { callback(); return; }

  var script    = document.createElement('script');
  script.src    = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
  script.onload = function () {
    window.mermaid.initialize({ startOnLoad: false });
    callback();
  };
  script.onerror = function () {
    callback(new Error('load-failed'));
  };
  document.head.appendChild(script);
}

function initMindMap() {
  var hero = document.querySelector('.hero');
  if (!hero || !document.querySelector('.topic-list')) return;

  /* Find map for current page — match by filename, not full path */
  var path = location.pathname;
  var mapData = null;
  Object.keys(MIND_MAPS).forEach(function (key) {
    if (path.indexOf(key) !== -1) mapData = MIND_MAPS[key];
  });
  if (!mapData) return;

  /* Create toggle button */
  var btn = document.createElement('button');
  btn.className = 'ss-mindmap-btn';
  btn.innerHTML = '🧠 Mind Map';
  btn.title     = 'View concept connections for this subject';

  /* Create map container (NOT rendered yet — no .mermaid class) */
  var container = document.createElement('div');
  container.className = 'ss-mindmap-container';
  container.id = 'ss-mindmap';
  container.style.display = 'none';

  var inner = document.createElement('div');
  inner.className = 'ss-mindmap-inner';

  var toolbar = document.createElement('div');
  toolbar.className = 'ss-mindmap-toolbar';

  var titleSpan = document.createElement('span');
  titleSpan.className = 'ss-mindmap-title';
  titleSpan.textContent = mapData.title;

  var fullscreenBtn = document.createElement('button');
  fullscreenBtn.className = 'ss-mindmap-fullscreen';
  fullscreenBtn.innerHTML = '⛶ Expand';
  fullscreenBtn.title = 'Toggle fullscreen';

  var closeBtn = document.createElement('button');
  closeBtn.className = 'ss-mindmap-close';
  closeBtn.innerHTML = '✕ Close';

  toolbar.appendChild(titleSpan);
  toolbar.appendChild(fullscreenBtn);
  toolbar.appendChild(closeBtn);

  /* Diagram placeholder — class is 'ss-mermaid-pending', NOT 'mermaid' */
  var mermaidDiv = document.createElement('div');
  mermaidDiv.className = 'ss-mermaid-pending';
  mermaidDiv.textContent = mapData.diagram;

  var loadingDiv = document.createElement('div');
  loadingDiv.className = 'ss-mindmap-loading';
  loadingDiv.innerHTML = '<div class="ss-mindmap-spinner"></div><span>Generating mind map…</span>';

  inner.appendChild(toolbar);
  inner.appendChild(loadingDiv);
  inner.appendChild(mermaidDiv);
  container.appendChild(inner);

  /* Insert after progress bar or hero */
  var progressWrap = document.getElementById('ss-progress-wrap');
  var insertAfter  = progressWrap || hero;
  insertAfter.insertAdjacentElement('afterend', container);

  /* Button in hero */
  var badgeRow = hero.querySelector('.badge-row');
  if (badgeRow) {
    badgeRow.appendChild(btn);
  } else {
    hero.appendChild(btn);
  }

  var mapRendered = false;

  function getMermaidTheme() {
    var isLight = document.documentElement.classList.contains('ss-light');
    return {
      theme: isLight ? 'default' : 'dark',
      themeVariables: isLight ? {
        primaryColor: '#e3f2fd',
        primaryTextColor: '#1a1a2e',
        primaryBorderColor: '#0288d1',
        lineColor: '#90a4ae',
        secondaryColor: '#fff3e0',
        tertiaryColor: '#f3e5f5',
        fontSize: '14px'
      } : {
        primaryColor: '#1e2a42',
        primaryTextColor: '#e8ecf4',
        primaryBorderColor: '#4fc3f7',
        lineColor: '#3a4f6f',
        secondaryColor: '#2a1f1f',
        tertiaryColor: '#1a1230',
        fontSize: '14px'
      },
      flowchart: { curve: 'basis', padding: 20, htmlLabels: true }
    };
  }

  function renderMap() {
    /* Load Mermaid on first use, then render */
    loadingDiv.style.display = 'flex';
    mermaidDiv.style.display = 'none';

    loadMermaid(function (err) {
      if (err || !window.mermaid) {
        loadingDiv.innerHTML = '<span style="color:#ef5350">Mind map unavailable — check internet connection and refresh.</span>';
        return;
      }
      _doRender();
    });
  }

  function _doRender() {

    /* Apply theme-aware config */
    var config = getMermaidTheme();
    config.startOnLoad = false;
    config.securityLevel = 'loose';
    window.mermaid.initialize(config);

    /* Give it a unique id (Mermaid v10 requires it) and the .mermaid class */
    var uid = 'ss-mermaid-' + Date.now();
    mermaidDiv.id = uid;
    mermaidDiv.className = 'mermaid';
    mermaidDiv.removeAttribute('data-processed');
    mermaidDiv.innerHTML = '';
    mermaidDiv.textContent = mapData.diagram;

    try {
      var result = window.mermaid.run({ nodes: [mermaidDiv] });

      /* mermaid.run() may or may not return a Promise depending on version */
      if (result && typeof result.then === 'function') {
        result.then(function() {
          loadingDiv.style.display = 'none';
          mermaidDiv.style.display = 'flex';
          mapRendered = true;
        }).catch(function(err) {
          console.error('Mermaid render error:', err);
          loadingDiv.innerHTML = '<span style="color:#ef5350">Mind map failed to render. Try refreshing.</span>';
        });
      } else {
        /* Sync path — give Mermaid a moment to inject SVG */
        setTimeout(function() {
          loadingDiv.style.display = 'none';
          mermaidDiv.style.display = 'flex';
          mapRendered = true;
        }, 600);
      }
    } catch (e) {
      console.error('Mermaid sync error:', e);
      loadingDiv.innerHTML = '<span style="color:#ef5350">Mind map failed to render. Try refreshing.</span>';
    }
  } /* end _doRender */

  function showMap() {
    container.style.display = 'block';
    if (!mapRendered) {
      renderMap();
    }
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideMap() {
    container.style.display = 'none';
    inner.classList.remove('ss-mindmap-fullscreen-active');
    fullscreenBtn.innerHTML = '⛶ Expand';
  }

  btn.addEventListener('click', function () {
    if (container.style.display === 'none') {
      showMap();
    } else {
      hideMap();
    }
  });

  closeBtn.addEventListener('click', hideMap);

  fullscreenBtn.addEventListener('click', function () {
    inner.classList.toggle('ss-mindmap-fullscreen-active');
    if (inner.classList.contains('ss-mindmap-fullscreen-active')) {
      fullscreenBtn.innerHTML = '⛶ Shrink';
    } else {
      fullscreenBtn.innerHTML = '⛶ Expand';
    }
  });

  /* Close fullscreen on Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && inner.classList.contains('ss-mindmap-fullscreen-active')) {
      inner.classList.remove('ss-mindmap-fullscreen-active');
      fullscreenBtn.innerHTML = '⛶ Expand';
    }
  });
}

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
    var total = parseInt(localStorage.getItem(s.path + ':__total__') || '0', 10);
    var done  = 0;
    Object.keys(localStorage).forEach(function (key) {
      if (key.indexOf(s.path + ':topic-') !== -1 && localStorage.getItem(key) === '1') {
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

  if (totalCount === 0) return; /* User hasn't visited any subject page yet */

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
