# Development Phase Log

This log records objective deliverables, test execution results, encountered issues/fixes, and transitions across all eight development phases.

---

## Phase 1: Repository & Skill Inspection — COMPLETED

- **Completed:**
  - Audited local environment and toolchains (`node v24.14.0`, `npm`, `python3`, Google Chrome `156.0`, Playwright Chromium `1234`) and read instructions for relevant installed skills (`dsp`, `frontend-design`, `webapp-testing`, `taste-skill`, `emil-design-eng`, `ui-ux-pro-max`, `test-driven-development`, `database-lookup`, `citation-verification`).
- **Tested:** Verified tool paths and skill instructions.
- **Failed / Fixed:** None.
- **Next:** Phase 2 (Historical, psychoacoustic, and competitor research + technical specification).

---

## Phase 2: Research & Specification — COMPLETED

- **Completed:**
  - Authored all 6 research documents in `research/`:
    - `RESEARCH_PLAN.md`, `HISTORICAL_RADIO_RESEARCH.md`, `PSYCHOACOUSTICS_AND_NOSTALGIA.md`, `COMPETITOR_ANALYSIS.md`, `TECHNICAL_DECISIONS.md` (PRD, MV3 + AudioWorklet spec, gain staging, test plan, decision log), and `SOURCES.md`.
  - Established **Warm Tabletop (`warm-tabletop`)** as the initial default profile based on symmetrical passband balance (`85 Hz – 5.8 kHz`), cross-genre musicality, and low listener fatigue.
- **Tested:** Programmatically queried NCBI PubMed E-utilities and OpenAlex APIs to verify every cited DOI, PMID, author list, and publication date.
- **Failed / Fixed:** Anonymous Crossref batch requests hit HTTP `429`; switched to PubMed E-utilities + OpenAlex REST APIs with zero errors.
- **Next:** Phase 3 & 4 (Extension plumbing + TDD modular DSP engine).

---

## Phase 3: Minimal Extension Capture & Routing Plumbing — COMPLETED

- **Completed:**
  - Configured TypeScript (`strict: true`), ESLint 9, Prettier, and a 3-stage programmatic Vite builder (`scripts/build.mjs`) producing CSP-compliant HTML views, ES module `dist/background.js`, and self-contained IIFE `dist/worklet/vintage-radio-processor.js`.
  - Implemented `public/manifest.json` (`tabCapture`, `offscreen`, `activeTab`, `storage`), anti-aliased custom icons (`16/32/48/128`), `src/background/index.ts`, and `src/offscreen/index.ts` with defensive `MediaStreamTrack` teardown so native tab audio is always restored on stop/error/close.
- **Tested:** Built unpacked extension into `dist/` and verified MV3 service worker registration in real Chromium.
- **Failed / Fixed:** None.
- **Next:** Phase 4 (Full modular DSP engine & synthetic verification suite).

---

## Phase 4: Modular Audio DSP Engine & Automated Synthetic Testing — COMPLETED

- **Completed:**
  - Implemented modular, zero-allocation DSP stages in `src/dsp/`: `smoother.ts`, `biquad.ts`, `saturation.ts`, `compressor.ts`, `noise.ts`, `tuning.ts`, and `pipeline.ts`, plus `src/worklet/vintage-radio-processor.ts`.
  - Implemented all 5 researched profiles in `src/shared/presets.ts` and pure settings reducer in `src/shared/storage.ts`.
  - Wrote `20` automated unit & synthetic signal tests across `tests/dsp/*.test.ts` and `tests/state/*.test.ts`.
- **Tested:** Ran `npm test` (`vitest run`) across sine waves, `20 Hz–20 kHz` log sweeps, impulses, digital silence, white/pink noise, musical composites, mono/stereo signals, `-60 dBFS` & `+6 dBFS` inputs, mid-stream preset switches, `44.1/48/96 kHz` sample rates, and `60s` continuous playback (`~1.0s` execution time = `1.67%` single-core CPU).
- **Failed / Fixed (Caught via TDD):**
  1. `ButterworthCascade` initially defaulted `snap=false` on first `configure()`, causing `-22.86 dB` instead of `-24.1 dB` at one octave; fixed by snapping filter state on initial configuration while keeping live transitions smoothed.
  2. `SaturationStage` initially applied its soft ceiling _after_ the `15 Hz` DC blocker, re-introducing `0.00158` DC offset on asymmetric tube waveforms; fixed by placing the soft ceiling _prior_ to the `15 Hz` DC blocker (`< 1e-3` DC verified).
  3. Initial `makeupGainDb` estimates left narrowband presets up to `-2.6 dB` quieter than Bypass; empirically calibrated all 5 presets so every preset matches dry broadband loudness within `±1.5 dB` (`20/20` tests passing).
- **Next:** Phase 5 (Popup & Signal Workbench interface design).

---

## Phase 5: Interface & Product Design — COMPLETED

- **Completed:**
  - Designed hardware-inspired warm-alabaster & charcoal token system (`src/styles/tokens.css`) with WCAG AA (`>= 4.5:1`) contrast, keyboard navigation, custom `cubic-bezier(0.23, 1, 0.32, 1)` motion, `:active` tactile scale, and `prefers-reduced-motion` support.
  - Built `Popup` (`src/popup/Popup.tsx`), analytical `PassbandPlot` (`src/components/PassbandPlot.tsx`), and full-page `Signal Workbench` (`src/workbench/Workbench.tsx` + `src/workbench/localAuditioner.ts`) connecting 100% of visible controls to live DSP parameters.
- **Tested:** Verified rendering and accessibility states at exact Chrome popup (`380×550`) and desktop (`1120×840`) viewports.
- **Failed / Fixed:** Unused `measureRmsLinear` import caught by `tsc --noEmit` and removed cleanly.
- **Next:** Phase 6 & 7 (Real Chrome E2E integration testing & visual/engineering refinement).

---

## Phase 6 & Phase 7: Real Chrome Integration Testing & Critical Refinement — COMPLETED

- **Completed:**
  - Authored `tests/e2e/extension.spec.ts` launching real `Google Chrome for Testing` with `--load-extension=dist`.
  - Captured Retina (`2×`) screenshots of `Popup` and `Signal Workbench` and performed a critical visual & engineering audit:
    1. Fixed multi-line title wrap misalignment in `Workbench` (`Linear Transfer Curve (20 Hz – 20 kHz)` aligned vertically with `Original | Processed`).
    2. Added SVG clip bounds and `100 / 1k / 5k / 10k` frequency micro-labels to `PassbandPlot` so `24 dB/oct` skirts terminate cleanly at the baseline.
    3. Added filled progress tracks (`--range-pct`) on all range sliders for instant visual readability.
    4. Replaced raw lowercase saturation slug in Calibration drawer with human-readable stage labels (`Stage: Single-Ended Tube`, `Stage: Class-B Germanium`, etc.).
    5. Added one-click `Switch here` action in `Popup` context strip when opening the popup on a new media tab while another tab is already captured.
- **Tested:** Re-built production bundle and verified Retina screenshots + Playwright E2E suite (`2/2` passing, `0` console errors, `0` external network requests).
- **Failed / Fixed:** All 5 visual/UX refinements verified cleanly on second screenshot pass.
- **Next:** Phase 8 (Final formatting, full test gate verification, scratch cleanup, and Git commit).

---

## Phase 8: Final Delivery & Verification — COMPLETED

- **Completed:**
  - Authored `README.md`, `docs/ARCHITECTURE.md`, `docs/USER_GUIDE.md`, `docs/PRIVACY.md`, `docs/KNOWN_LIMITATIONS.md`, and finalized `docs/PHASE_LOG.md`.
  - Ran Prettier formatting, ESLint, TypeScript check, production build, Vitest DSP/unit suite, and Playwright real-Chrome MV3 extension E2E suite.
  - Committed complete source tree and lockfile cleanly to Git.
