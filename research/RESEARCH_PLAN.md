# Research Plan: Vintage Radio Real-Time Audio Emulation

## 1. Mission & Research Scope

Before writing DSP or extension code, our multidisciplinary engineering and research team established an empirical plan to answer four foundational questions:

1. **Historical Electroacoustics:** Which historical broadcast transmission standards, receiver topologies, and loudspeaker/enclosure acoustics produce recognizable, musical "vintage radio" coloration, and what are their documented physical bounds versus estimated parameters?
2. **Psychoacoustics & Auditory Memory:** How does human hearing perceive band-limiting, cabinet formant resonances, even/odd harmonic distortion, dynamic range compression, and colored background noise — and what does peer-reviewed neuroscience actually establish (and _not_ establish) regarding nostalgia and music-evoked autobiographical memories (MEAMs)?
3. **Competitive Landscape & User Pain Points:** What do pro-audio speaker/radio emulators (AudioThing Speakers, McDSP FutzBox, XLN Audio RC-20, iZotope Vinyl) do well, why do existing Chrome Web Store equalizer/lo-fi extensions frustrate users, and how should our first release differentiate itself?
4. **Chrome Manifest V3 & Real-Time Web Audio Constraints:** What is the most reliable, lowest-latency, click-free architecture for capturing tab audio in Chrome MV3 while preserving local playback, zero network egress, and deterministic testability?

---

## 2. Workspace & Installed Skill Audit (Phase 1 Summary)

Prior to research and implementation, we audited `/Users/ishanksahni` (preserving all unrelated workspace files), initialized `/Users/ishanksahni/money` as a clean Git repository (`main`), verified local toolchains (`node v24.14.0`, `npm`, `python3`, Google Chrome desktop binary), and inspected the installed agent skills in `~/.gemini/skills/`:

| Skill Repository                       | Inspected Skills                                                                                           | Relevance & Application Decision                                                                                                                                                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shortwavlabs/agent-skills`            | `dsp` (`SKILL.md`, `references/filters.md`, `references/effects.md`)                                       | **Applied directly.** Adopted sample-rate independence (`w0 = 2π·fc/Fs`), RBJ biquad Direct Form II Transposed design, denormal guards (`1e-24`), exponential one-pole parameter smoothing, and zero-allocation audio thread loops.                                                             |
| `anthropics/skills`                    | `frontend-design`, `webapp-testing`                                                                        | **Applied directly.** Used `frontend-design` anti-slop calibration and two-pass token planning; used `webapp-testing` Playwright reconnaissance-and-verification principles.                                                                                                                    |
| `Leonxlnx/taste-skill`                 | `taste-skill` (`SKILL.md`, `references/app-screens.md`)                                                    | **Applied directly.** Adopted app-screen rules: flat tactile surfaces separated by 1px hairline rules or 1 tone step, <=5% accent pixel budget, tabular numerals, zero decorative cards/glows, and one signature domain element (live passband & signal calibration scale).                     |
| `emilkowalski/skills`                  | `emil-design-eng`                                                                                          | **Applied directly.** Adopted Animation Decision Framework: custom `cubic-bezier(0.23, 1, 0.32, 1)` ease-out under 180ms, `:active { transform: scale(0.97) }`, no animation on high-frequency keyboard toggles, `prefers-reduced-motion` support.                                              |
| `nextlevelbuilder/ui-ux-pro-max-skill` | `ui-ux-pro-max` (`scripts/search.py`)                                                                      | **Applied selectively.** Queried `--design-system` for Minimalism & Swiss utility accessibility rules (`>=4.5:1` contrast, keyboard nav, focus rings); overrode generic lavender palette in favor of the brief's warm neutral + deep charcoal + restrained amber/forest-green hardware palette. |
| `addyosmani/agent-skills`              | `test-driven-development`, `spec-driven-development`, `performance-optimization`, `security-and-hardening` | **Applied directly.** Structured DSP unit tests around synthetic test vectors before tuning, strict least-privilege MV3 permissions, and zero external network calls.                                                                                                                           |
| `KalarisLabs` & `K-Dense-AI`           | `citation-verification`, `database-lookup`                                                                 | **Applied directly.** Queried NCBI PubMed E-utilities and OpenAlex REST APIs directly to verify every peer-reviewed paper's DOI, PMID, publication year, journal, and authorship rather than citing from model memory.                                                                          |

---

## 3. Methodology & Evidence Standards

1. **Primary Technical Sources First:** Use FCC Title 47 Part 73 / ITU-R BS.450 broadcast specifications, _Radiotron Designer's Handbook_ (4th ed., 1953), Harry F. Olson's _Acoustical Engineering_ (1957), and documented schematics (All-American Five 12SA7/12SK7/12SQ7/50L6GT/35Z5GT; 1954 Regency TR-1 262 kHz IF superheterodyne).
2. **Explicit Epistemic Labeling:** Every parameter in our receiver matrix is labeled as either:
   - **[Documented Specification]:** Directly attested in broadcast standards, tube/transistor datasheets, or schematic component values.
   - **[Electroacoustic Estimate]:** Reconstructed from physical speaker cone diameter, open-back baffle dimensions, or typical alignment tolerances, with assumptions stated.
   - **[Artistic / Perceptual Voicing]:** Tuned for listening comfort and musicality where strict historical degradation (e.g., severe heterodyne whistle or >15% clipping) would be unpleasant.
3. **Citation Integrity:** Every biomedical, psychoacoustic, and cognitive neuroscience citation in `PSYCHOACOUSTICS_AND_NOSTALGIA.md` and `SOURCES.md` was verified programmatically against PubMed (`eutils.ncbi.nlm.nih.gov`) and OpenAlex (`api.openalex.org`) on 2026-11-01. No neurochemical claims (e.g., guaranteed dopamine release) or universal nostalgia guarantees are made.

---

## 4. High-Risk Technical Assumptions Identified Pre-Implementation

| Risk / Assumption                                                 | Severity | Mitigation Strategy                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chrome MV3 `tabCapture.getMediaStreamId` user-gesture context** | Critical | Verified against Chrome Extensions docs: `getMediaStreamId({ targetTabId })` must be invoked inside the user-activated extension UI context (`popup` / `workbench` click handler) where `activeTab` is granted, then forwarded to the service worker and consumed in `offscreen.html`.                                                                     |
| **Tab muting on capture (`suppressLocalAudioPlayback`)**          | Critical | Consuming a tab stream via `getUserMedia({ chromeMediaSource: 'tab' })` automatically silences the tab's native audio output. The offscreen document must immediately route the `MediaStreamAudioSourceNode` through the DSP graph to `audioContext.destination` and close all tracks cleanly on Stop so Chrome restores native tab audio instantaneously. |
| **Loudness bias during Bypass / Preset comparison**               | High     | Band-limiting removes sub-bass and high-treble energy, reducing broadband RMS power while concentrating midrange energy near 1–3 kHz (peak ear sensitivity). Each profile includes calibrated makeup gain tested on pink noise and multi-tone musical signals so A/B Bypass matches perceived loudness within ±0.8 dB.                                     |
| **Idle static annoyance when source audio pauses**                | Medium   | Competitor analysis identified iZotope Vinyl's #1 complaint: continuous static when playback stops. We implement an envelope-following **Idle Noise Ducking** gate (enabled by default, toggleable) that smoothly attenuates radio hiss when input signal drops below `-55 dBFS` for >600 ms.                                                              |
| **Asymmetric waveshaper DC offset**                               | Medium   | Even-order (`x²`) tube saturation introduces DC offset proportional to signal variance, which can cause clicks on bypass. We place a dedicated 15 Hz first-order DC-blocking high-pass filter immediately after the nonlinear stage.                                                                                                                       |

---

## 5. Research Deliverables Checklist

- [x] `research/RESEARCH_PLAN.md` (This document)
- [x] `research/HISTORICAL_RADIO_RESEARCH.md`
- [x] `research/PSYCHOACOUSTICS_AND_NOSTALGIA.md`
- [x] `research/COMPETITOR_ANALYSIS.md`
- [x] `research/TECHNICAL_DECISIONS.md` (Includes PRD, Technical Architecture Spec, and Test Plan)
- [x] `research/SOURCES.md`
