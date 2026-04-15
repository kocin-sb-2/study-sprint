# Practice Question System (PQS) — AI Generation Instructions
**Study Sprint · Copy-paste these instructions into your AI system to generate content**

---

## WHAT YOU ARE BUILDING

You are adding exam-style practice questions with worked solutions to an existing study website called **Study Sprint**. The site has 6 subject pages, each containing topics structured in collapsible cards. Your job is to add a `questions` info-block inside every topic's `.topic-body` section.

The system (CSS + JavaScript) is already live. You only need to write HTML.

---

## MASTER SYSTEM PROMPT
*Copy this into the AI's system/instruction field before any subject work:*

```
You are an expert exam question writer for IB HL and Swedish Gymnasium science/math courses.
Your task: generate exam-quality practice questions with full worked solutions for topics on the Study Sprint website.

OUTPUT RULES (never deviate):
1. Output ONLY valid HTML — no prose, no markdown, no explanations outside of HTML comments.
2. Every output is a single <div class="info-block"> block ready to paste into a .topic-body section.
3. Follow the exact HTML structure specified in the template below.
4. Write questions that mirror real IB Paper 2/3 or Swedish exam style.
5. Worked solutions must be complete, showing every step of reasoning or calculation.
6. Always include a "Common error" examtip at the end of each question.
7. Do not repeat questions between topics. Questions must be specific to that topic's content.
8. Use plain Unicode for math where possible (e.g., ² ³ √ × ÷ → ≈ ≠ ≤ ≥ Δ θ λ μ π ω).
   For complex expressions, write them clearly in text (e.g., "v² = u² + 2as").
```

---

## HTML TEMPLATE — EXACT STRUCTURE

Every questions block follows this exact template. Do not alter class names.

```html
<div class="info-block">
  <div class="info-block-title questions">🎯 Practice Questions</div>
  <div class="q-list">

    <!-- QUESTION 1: Recall (L1) -->
    <div class="q-item" data-type="recall" data-marks="2">
      <div class="q-meta">
        <span class="q-badge q-badge--recall">Recall</span>
        <span class="q-marks">[2 marks]</span>
        <span class="q-diff q-diff--l1">L1</span>
      </div>
      <p class="q-stem">Write the question text here. Make it clear and unambiguous.</p>
      <button class="q-toggle-btn" onclick="toggleSolution(this)">▸ Show Solution</button>
      <div class="q-solution">
        <div class="q-steps">
          <div class="q-step"><strong>Answer:</strong> Write the answer here. [1 mark]</div>
          <div class="q-step"><strong>Explanation:</strong> Brief explanation of the answer. [1 mark]</div>
        </div>
        <div class="q-examtip">Common error: describe the typical mistake students make.</div>
      </div>
    </div>

    <!-- QUESTION 2: Application (L2) -->
    <div class="q-item" data-type="application" data-marks="3">
      <div class="q-meta">
        <span class="q-badge q-badge--application">Application</span>
        <span class="q-marks">[3 marks]</span>
        <span class="q-diff q-diff--l2">L2</span>
      </div>
      <p class="q-stem">Write the application question here. Describe a scenario or context.</p>
      <button class="q-toggle-btn" onclick="toggleSolution(this)">▸ Show Solution</button>
      <div class="q-solution">
        <div class="q-steps">
          <div class="q-step"><strong>Step 1:</strong> First step of reasoning. [1 mark]</div>
          <div class="q-step"><strong>Step 2:</strong> Second step. [1 mark]</div>
          <div class="q-step"><strong>Conclusion:</strong> Final answer with units/context. [1 mark]</div>
        </div>
        <div class="q-examtip">Common error: describe the typical mistake students make.</div>
      </div>
    </div>

    <!-- QUESTION 3: Calculation (L2-L3) — use for STEM subjects -->
    <div class="q-item" data-type="calculation" data-marks="4">
      <div class="q-meta">
        <span class="q-badge q-badge--calculation">Calculation</span>
        <span class="q-marks">[4 marks]</span>
        <span class="q-diff q-diff--l3">L3</span>
      </div>
      <p class="q-stem">Write the calculation question. Include all given values clearly.</p>
      <button class="q-toggle-btn" onclick="toggleSolution(this)">▸ Show Solution</button>
      <div class="q-solution">
        <div class="q-steps">
          <div class="q-step"><strong>Given:</strong> List all given values with symbols and units.</div>
          <div class="q-step"><strong>Formula:</strong> State the relevant formula. [1 mark]</div>
          <div class="q-step"><strong>Substitution:</strong> Show the substitution with numbers. [1 mark]</div>
          <div class="q-step"><strong>Answer:</strong> Final numerical answer with correct units. [1 mark]</div>
          <div class="q-step"><strong>Check:</strong> Verify units / order of magnitude / sign. [1 mark]</div>
        </div>
        <div class="q-examtip">Common error: describe the typical calculation mistake.</div>
      </div>
    </div>

    <!-- QUESTION 4: Analysis (L3) — higher-order thinking -->
    <div class="q-item" data-type="analysis" data-marks="4">
      <div class="q-meta">
        <span class="q-badge q-badge--analysis">Analysis</span>
        <span class="q-marks">[4 marks]</span>
        <span class="q-diff q-diff--l3">L3</span>
      </div>
      <p class="q-stem">Write the analysis question. Ask for evaluation, comparison, or explanation of a concept.</p>
      <button class="q-toggle-btn" onclick="toggleSolution(this)">▸ Show Solution</button>
      <div class="q-solution">
        <div class="q-steps">
          <div class="q-step"><strong>Point 1:</strong> First key point. [1 mark]</div>
          <div class="q-step"><strong>Point 2:</strong> Second key point, developed with evidence. [1 mark]</div>
          <div class="q-step"><strong>Point 3:</strong> Third point or counter-consideration. [1 mark]</div>
          <div class="q-step"><strong>Conclusion:</strong> Synthesise into a final answer. [1 mark]</div>
        </div>
        <div class="q-examtip">Common error: describe the common mistake in analysis questions.</div>
      </div>
    </div>

  </div>
</div>
```

---

## QUESTION TYPE RULES

| Type | Badge Class | Diff | Marks | Purpose |
|------|-------------|------|-------|---------|
| Recall | `q-badge--recall` | L1 | 1–2 | Define, state, identify — direct knowledge retrieval |
| Application | `q-badge--application` | L2 | 2–4 | Apply a concept to a new context or scenario |
| Calculation | `q-badge--calculation` | L2–L3 | 3–5 | Numerical problem using given formulas |
| Analysis | `q-badge--analysis` | L3 | 3–5 | Explain, evaluate, compare, design — higher-order |

**Per topic: write 3–4 questions.** Ideal mix: 1 Recall + 1 Application + 1–2 Calculation/Analysis depending on subject.

**Difficulty tags:**
- `q-diff--l1` = straightforward recall (L1)
- `q-diff--l2` = requires understanding or moderate calculation (L2)
- `q-diff--l3` = requires synthesis, multi-step work, or HL-level insight (L3)

---

## WHERE TO INSERT IN THE HTML

Find the `.topic-body` div for the target topic. Add the questions block as the **last child** (after all existing `info-block` divs):

```html
<div class="topic-body">
  <div class="info-block">...(Key Concepts)...</div>
  <div class="info-block">...(Key Terms)...</div>
  <div class="info-block">...(Formulas — if present)...</div>
  <div class="info-block">...(Exam Focus)...</div>
  <!-- ↓ ADD YOUR BLOCK HERE ↓ -->
  <div class="info-block">
    <div class="info-block-title questions">🎯 Practice Questions</div>
    <div class="q-list">
      ...questions...
    </div>
  </div>
</div>
```

---

## SUBJECT-SPECIFIC INSTRUCTIONS

---

### SUBJECT 1: IB Chemistry HL (`ib-chemistry-hl.html`)
**24 topics** · IB Chemistry 2025 syllabus · IB DP Higher Level

**Exam style:** IB Paper 1 (MCQ), Paper 2 (structured), Paper 3 (data analysis + options)
**Mark scheme language:** Use IB-style bullet-point mark scheme. Each mark point is clearly labelled [1].
**Topic prefix format:** Topic IDs follow pattern `topic-c{section}-{number}` (e.g. `topic-c1-1`)

**Subject rules:**
- Always include units in calculation answers. Penalise omission in mark scheme.
- Use IUPAC nomenclature for all compounds.
- For organic chemistry: include structural formula description if helpful.
- HL questions should push beyond SL — ask about mechanisms, quantitative treatment, detailed electron behaviour.
- Data: provide molar mass, Ka values, electrode potentials etc. within the question if needed.
- Significant figures: state expected s.f. in the answer (usually 3 s.f. for IB).

**Question density per topic:**
- 1 × Recall (1–2 marks)
- 1 × Application (2–3 marks)
- 1 × Calculation (3–4 marks)
- 1 × Analysis — HL extension (3–4 marks) if the topic has HL content

**Sample question prompt for this subject:**
> "Generate 4 exam-style practice questions for IB Chemistry HL topic: [TOPIC NAME]. Include one recall, one application, one multi-step calculation, and one HL analysis question. Output only the HTML block using the PQS template."

---

### SUBJECT 2: IB Physics HL (`ib-physics-hl.html`)
**24 topics** · IB Physics 2025 syllabus · IB DP Higher Level

**Exam style:** IB Paper 1 (MCQ), Paper 2 (structured), Paper 3 (experimental + options)
**Mark scheme language:** IB-style. Calculations must show formula → substitution → answer.

**Subject rules:**
- Always show the formula used before substituting numbers.
- Units must appear in the "Given" list and in the final answer.
- For vector quantities, state direction or sign convention.
- HL-only content (e.g. relativistic mechanics, quantum, wave optics details): clearly label analysis questions as HL.
- Use SI units throughout. If using eV or non-SI, convert.
- Experimental context: "A student measures..." questions are highly valued.

**Question density per topic:**
- 1 × Recall (definitions, laws, units)
- 1 × Application (describe/explain physical scenario)
- 1–2 × Calculation (multi-step, given values in question)
- 1 × Analysis (HL evaluation or graphical interpretation)

**Sample question prompt for this subject:**
> "Generate 4 exam-style practice questions for IB Physics HL topic: [TOPIC NAME]. Include: one recall of a definition or law, one scenario-based application, one multi-step calculation (provide numbers), and one HL analysis. Output only the HTML PQS block."

---

### SUBJECT 3: IB Math AA HL (`ib-math-aa-hl.html`)
**29 topics** · IB Mathematics: Analysis and Approaches HL

**Exam style:** IB Paper 1 (no calculator), Paper 2 (calculator), Paper 3 (HL extended investigation)
**Mark scheme language:** Method marks (M), Accuracy marks (A), Reasoning marks (R). Label clearly.

**Subject rules:**
- Always show the exact method used, not just the answer.
- For Paper 1-type: no decimals — leave answers in exact form (fractions, surds, logarithms).
- For Paper 2-type: numerical answers to 3 s.f. unless exact.
- Proof questions: every step must be explicitly justified with a reasoning mark.
- HL topics (complex numbers, further calculus, vectors 3D, maclaurin series): label with HL difficulty.
- Do NOT ask for memorised formulas — the IB formula booklet is available. Ask how to USE them.

**Question density per topic:**
- 1 × Recall (state theorem, define, or identify)
- 1 × Application (short structured problem)
- 1 × Calculation (multi-step, show all working)
- 1 × Analysis (proof, or extended reasoning — HL)

**Sample question prompt for this subject:**
> "Generate 4 exam-style practice questions for IB Math AA HL topic: [TOPIC NAME]. Include: one recall/definition, one application problem, one multi-step calculation showing all working, and one HL proof or analysis. Output only the HTML PQS block."

---

### SUBJECT 4: Fysik 2 (`fysik2.html`)
**19 topics** · Swedish Gymnasium · Fysik 2 (Gy11)

**Exam style:** Swedish national exam (Nationellt prov) — free-form written responses, no MCQ.
**Mark style:** Not IB mark-scheme. Use explanatory worked solutions with clear reasoning in Swedish-style (but write in English unless asked for Swedish).

**Subject rules:**
- Questions should follow the progression: E (basic pass) → C (apply and explain) → A (analyse and evaluate).
- Calculation questions must show all steps with units throughout.
- Include real-world contexts (Swedish relevant: wind power, nuclear plants, bridge physics, etc.).
- Do not expect formula sheet memorisation — focus on applying and understanding.
- Electromagnetic induction, special relativity (lite), and nuclear physics are key HL-equivalent areas for Fysik 2.

**Question density per topic:**
- 1 × Recall (E-level: basic definitions or state a law)
- 1 × Application (C-level: apply concept to a real scenario)
- 1 × Calculation (C/A-level: numerical with full working)
- 1 × Analysis (A-level: evaluate, compare, or explain a physical phenomenon)

**Sample question prompt for this subject:**
> "Generate 4 practice questions for Swedish Gymnasium Fysik 2 topic: [TOPIC NAME]. Match the E/C/A grading levels. Include one recall, one scenario application, one calculation, and one evaluation/analysis question. Output only the HTML PQS block."

---

### SUBJECT 5: Kemi 2 (`kemi2.html`)
**24 topics** · Swedish Gymnasium · Kemi 2 (Gy11)

**Exam style:** Swedish national exam — written responses, E/C/A grading levels.
**Mark style:** Explanatory worked solutions. Reference reaction types and mechanisms where relevant.

**Subject rules:**
- Use IUPAC naming. Include structural context for organic chemistry topics.
- Kemi 2 covers: acids/bases (advanced), redox/electrochemistry, organic synthesis, kinetics, equilibrium.
- Connect to real-world Swedish/Nordic chemistry: paper industry, pharmaceuticals, water treatment.
- Equilibrium: always require K-expression and Le Chatelier application.
- Organic synthesis routes must include reagents and conditions.
- For buffers: include both the Henderson–Hasselbalch context and the numerical calculation.

**Question density per topic:**
- 1 × Recall (E-level)
- 1 × Application (C-level)
- 1 × Calculation (C/A-level: e.g., pH, Ka, Kc, cell potential)
- 1 × Analysis (A-level: mechanism, explain, evaluate)

**Sample question prompt for this subject:**
> "Generate 4 practice questions for Swedish Gymnasium Kemi 2 topic: [TOPIC NAME]. Match E/C/A grading levels. Include recall, application, calculation, and analysis. Output only the HTML PQS block."

---

### SUBJECT 6: Matematik 5 (`matematik5.html`)
**18 topics** · Swedish Gymnasium · Matematik 5 (Gy11) — equivalent to pre-university calculus

**Exam style:** Swedish national exam — written, E/C/A graded. Focus on mathematical reasoning and proof.
**Mark style:** Show all working. Emphasise reasoning and connections between methods.

**Subject rules:**
- Matematik 5 covers: complex numbers, differential equations, Taylor/Maclaurin series, transformations, linear algebra basics.
- Questions should build on Matematik 4 knowledge without repeating it.
- Proofs are important at A-level: students must justify steps.
- For DE questions: include both general and particular solution steps.
- Complex number questions: include both rectangular and polar/exponential forms.
- Series: test both convergence reasoning and expansion computation.

**Question density per topic:**
- 1 × Recall (E-level: state definition or simple computation)
- 1 × Application (C-level: solve a structured problem)
- 1 × Calculation (C/A: multi-step, show all working)
- 1 × Analysis (A-level: prove, derive, or evaluate a claim)

**Sample question prompt for this subject:**
> "Generate 4 practice questions for Swedish Gymnasium Matematik 5 topic: [TOPIC NAME]. Match E/C/A grading levels. Include recall, application, multi-step calculation, and proof/analysis. Output only the HTML PQS block."

---

## BATCH GENERATION WORKFLOW

For each subject page, use this workflow with your AI system:

### Step 1 — Set context
Paste the Master System Prompt (above) into the system/instructions field.

### Step 2 — Paste the HTML template
Tell the AI: *"This is the exact HTML template you must use for every output. Do not change any class names."* Then paste the full template block from above.

### Step 3 — Provide topic content
Copy the text content from one `.topic-body` section (concepts, terms, formulas, exam focus) and paste it as context.

### Step 4 — Request questions
Use the subject-specific sample prompt, filling in the topic name. Example:
> "Generate 4 exam-style practice questions for IB Chemistry HL topic: **S1.2 — The Nuclear Atom** (protons, neutrons, electrons, isotopes, mass spectrometry, relative atomic mass). Include one recall, one application, one multi-step calculation, and one HL analysis. Output only the HTML PQS block."

### Step 5 — Paste the output
Open the subject HTML file. Find the target `<div class="topic-body">` section and add the output block as the last child, before the closing `</div>`.

### Step 6 — Test
Open the page in a browser. Expand the topic. The "🎯 Practice Questions" block should appear. Click "▸ Show Solution" to verify the toggle works. Click "🎯 Quiz Mode" in the toolbar to test quiz mode.

---

## QUALITY CHECKLIST (verify before pasting each block)

- [ ] Contains exactly 3–4 `q-item` divs
- [ ] Each `q-item` has `data-type` and `data-marks` attributes
- [ ] Each `q-meta` has a badge, marks span, and difficulty span
- [ ] Each button uses `onclick="toggleSolution(this)"` exactly
- [ ] `.q-solution` div is the **immediate next sibling** after the button
- [ ] Every solution has at least 2 `.q-step` divs
- [ ] Every solution ends with a `.q-examtip` div
- [ ] No hard-coded inline styles
- [ ] No markdown syntax inside HTML (no **, no ```, no #)
- [ ] Math expressions use Unicode or plain text, not LaTeX
- [ ] Question is **specific to the topic** — not generic filler

---

## TOPIC LIST REFERENCE

Use this for planning your batch generation order.

### ib-chemistry-hl.html (24 topics)
S1.1 Particulate Nature of Matter · S1.2 Nuclear Atom · S1.3 Electron Configurations · S1.4 Spectroscopic Identification · S1.5 Bonding & Structure · S2.1 Moles & Mass · S2.2 Solution Chemistry · S2.3 Atomic Spectra · S3.1 Periodic Table · S3.2 Reactivity & Stability · S3.3 Acids & Bases · S3.4 Oxidation & Reduction · S3.5 Electrochemistry · S4.1 Organic Structure · S4.2 Functional Groups · S4.3 Mechanisms · S4.4 Synthetic Routes · Additional HL content embedded in S1–S4

### ib-physics-hl.html (24 topics)
A.1 Kinematics · A.2 Forces & Dynamics · A.3 Work, Energy, Power · A.4 Momentum & Impulse · A.5 Rigid Body Rotation · B.1 Thermal Properties · B.2 Thermodynamics · B.3 Gas Laws · C.1 Simple Harmonic Motion · C.2 Wave Model · C.3 Wave Phenomena · C.4 Standing Waves & Resonance · C.5 Doppler Effect · D.1 Gravity · D.2 Electric Fields · D.3 Magnetic Fields · D.4 Electromagnetic Induction · D.5 Capacitance · E.1 Nuclear Physics · E.2 Radioactivity · E.3 Fission & Fusion · E.4 Quantum & Photoelectric · E.5 Atomic Energy Levels · E.6 Wave-Particle Duality

### ib-math-aa-hl.html (29 topics)
Algebra: Sequences & Series · Exponents & Logs · Counting & Binomial · Proof · Complex Numbers · Functions: Types & Transformations · Inverse & Composite · Rational Functions · Polynomials · Trigonometry: Unit Circle · Identities · Equations · 3D Trig · Calculus: Limits · Differentiation · Applications of Derivatives · Integration · Applications of Integrals · Differential Equations · Vectors: 2D/3D · Lines & Planes · Statistics: Probability · Distributions · Inference · Regression

### fysik2.html (19 topics)
Rörelsemängd & stötar · Roterande rörelse · Newtons lagar (fördjupning) · Gravitation · Elektriska fält · Magnetfält · Elektromagnetisk induktion · Växelström & transformatorer · Vågrörelselära · Ljusets natur · Atom- och kärnfysik · Radioaktivitet · Kärnreaktioner · Relativitetsteori · Energi & hållbarhet · Termodynamik · Optik · Mekanik (fördjupning) · Fysikaliska mätmetoder

### kemi2.html (24 topics)
Syra-basjämvikt · Buffertar · Titrering · Redoxreaktioner · Elektrokemi · Galvaniska element · Elektrolys · Kemisk jämvikt · Jämviktskonstanten Kc · Le Chateliers princip · Löslighetsjämvikt · Organisk kemi (fördjupning) · Alkaner & cykliska · Alkener & addition · Alkoholer & oxidation · Karbonylföreningar · Karboxylsyror & estrar · Aminer & amider · Polymerer · Reaktionskinetik · Aktiveringsenergi & Arrhenius · Analytisk kemi · Spektroskopi · Grön kemi

### matematik5.html (18 topics)
Komplexa tal (rektangulär form) · Komplexa tal (polär & exponentialform) · De Moivres sats · Differentialekvationer (separation) · Differentialekvationer (linjära 1:a ordningen) · Differentialekvationer (2:a ordningen) · Taylor- och Maclaurinserier · Konvergensanalys · Fourierserier (intro) · Linjär algebra: Vektorer · Matriser & determinanter · Linjära ekvationssystem · Egenvärden · Integraltransformer (intro) · Sannolikhetslära (fördjupning) · Statistiska test · Numeriska metoder · Matematisk modellering

---

## EXAMPLE OUTPUT (complete, copy-testable)

This is a reference output for `IB Chemistry HL — S1.2 The Nuclear Atom`:

```html
<div class="info-block">
  <div class="info-block-title questions">🎯 Practice Questions</div>
  <div class="q-list">

    <div class="q-item" data-type="recall" data-marks="2">
      <div class="q-meta">
        <span class="q-badge q-badge--recall">Recall</span>
        <span class="q-marks">[2 marks]</span>
        <span class="q-diff q-diff--l1">L1</span>
      </div>
      <p class="q-stem">Define the term <em>relative atomic mass</em> (Ar) and state the standard it is measured against.</p>
      <button class="q-toggle-btn" onclick="toggleSolution(this)">▸ Show Solution</button>
      <div class="q-solution">
        <div class="q-steps">
          <div class="q-step"><strong>Definition:</strong> The weighted mean mass of an atom of an element relative to 1/12 the mass of a carbon-12 atom. [1 mark]</div>
          <div class="q-step"><strong>Standard:</strong> Measured relative to ¹²C = 12.000 exactly. [1 mark]</div>
        </div>
        <div class="q-examtip">Common error: Students write "average atomic mass" without specifying it is a weighted average accounting for isotopic abundances — this loses the mark.</div>
      </div>
    </div>

    <div class="q-item" data-type="application" data-marks="3">
      <div class="q-meta">
        <span class="q-badge q-badge--application">Application</span>
        <span class="q-marks">[3 marks]</span>
        <span class="q-diff q-diff--l2">L2</span>
      </div>
      <p class="q-stem">A mass spectrum of chlorine shows two peaks: m/z = 35 (75.77% abundance) and m/z = 37 (24.23% abundance). Explain why chlorine shows two peaks and calculate the relative atomic mass of chlorine.</p>
      <button class="q-toggle-btn" onclick="toggleSolution(this)">▸ Show Solution</button>
      <div class="q-solution">
        <div class="q-steps">
          <div class="q-step"><strong>Two peaks:</strong> Chlorine has two naturally occurring isotopes — ³⁵Cl and ³⁷Cl — which have the same number of protons (17) but different numbers of neutrons (18 and 20 respectively). Each isotope produces a separate peak at its own m/z value. [1 mark]</div>
          <div class="q-step"><strong>Calculation:</strong> Ar = (35 × 0.7577) + (37 × 0.2423) = 26.52 + 8.97 = 35.49 [1 mark]</div>
          <div class="q-step"><strong>Answer:</strong> Ar(Cl) ≈ 35.5 (3 s.f.) [1 mark]</div>
        </div>
        <div class="q-examtip">Common error: Using percentage values (75.77) instead of fractional abundances (0.7577) in the calculation — gives an answer ~100× too large.</div>
      </div>
    </div>

    <div class="q-item" data-type="calculation" data-marks="4">
      <div class="q-meta">
        <span class="q-badge q-badge--calculation">Calculation</span>
        <span class="q-marks">[4 marks]</span>
        <span class="q-diff q-diff--l2">L2</span>
      </div>
      <p class="q-stem">Boron has two isotopes: ¹⁰B and ¹¹B. The relative atomic mass of boron is 10.81. Calculate the percentage abundance of ¹⁰B.</p>
      <button class="q-toggle-btn" onclick="toggleSolution(this)">▸ Show Solution</button>
      <div class="q-solution">
        <div class="q-steps">
          <div class="q-step"><strong>Setup:</strong> Let x = fraction of ¹⁰B. Then (1 − x) = fraction of ¹¹B. [1 mark]</div>
          <div class="q-step"><strong>Formula:</strong> Ar = 10x + 11(1 − x) = 10.81 [1 mark]</div>
          <div class="q-step"><strong>Solve:</strong> 10x + 11 − 11x = 10.81 → −x = −0.19 → x = 0.19 [1 mark]</div>
          <div class="q-step"><strong>Answer:</strong> Abundance of ¹⁰B = 0.19 × 100 = 19.0% [1 mark]</div>
        </div>
        <div class="q-examtip">Common error: Setting up x as the ¹¹B fraction instead of ¹⁰B — the algebra still works but students frequently get confused mid-calculation and swap the answer at the end.</div>
      </div>
    </div>

    <div class="q-item" data-type="analysis" data-marks="4">
      <div class="q-meta">
        <span class="q-badge q-badge--analysis">Analysis</span>
        <span class="q-marks">[4 marks]</span>
        <span class="q-diff q-diff--l3">L3</span>
      </div>
      <p class="q-stem">A mass spectrum of an organic compound shows a molecular ion peak at m/z = 58, with significant fragment peaks at m/z = 43 and m/z = 15. Suggest a possible structure for this compound and explain how the fragmentation supports your answer. <span class="hl-tag">HL</span></p>
      <button class="q-toggle-btn" onclick="toggleSolution(this)">▸ Show Solution</button>
      <div class="q-solution">
        <div class="q-steps">
          <div class="q-step"><strong>Molecular formula:</strong> M⁺ at m/z = 58 → molar mass = 58 g mol⁻¹. Possible formula: C₃H₆O (58) — suggests a ketone or aldehyde. [1 mark]</div>
          <div class="q-step"><strong>Fragment at 43:</strong> 58 − 43 = 15 → loss of CH₃ group (mass 15). This is consistent with loss of a methyl group from the molecular ion. [1 mark]</div>
          <div class="q-step"><strong>Fragment at 15:</strong> m/z = 15 corresponds to CH₃⁺ — confirms a methyl group is present. [1 mark]</div>
          <div class="q-step"><strong>Proposed structure:</strong> Propan-2-one (acetone, CH₃COCH₃) fits: M = 58, loses CH₃ to give CH₃CO⁺ (m/z = 43), and the CH₃⁺ fragment appears at 15. [1 mark]</div>
        </div>
        <div class="q-examtip">Common error: Forgetting that m/z = 43 represents the fragment ion that stays charged (CH₃CO⁺), not the neutral fragment that is lost. The neutral fragment has the complementary mass (15 in this case).</div>
      </div>
    </div>

  </div>
</div>
```

---

*Study Sprint · PQS Architecture v1.0 · Generated 2026-04-14*
*CSS + JS already live in extras.css and app.js — only HTML content generation needed.*
