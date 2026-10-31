# Vintage Radio — Real-Time Broadcast & Receiver Audio Emulation for Chrome

**Vintage Radio** is a research-driven Chrome Manifest V3 extension that transforms audio playing in an active browser tab (music, podcasts, interviews, streaming video) into convincing historical radio receiver and broadcast playback in real time.

Instead of applying a generic low-pass filter and white noise, Vintage Radio runs a modular, sample-rate-independent DSP chain inside a dedicated **Web Audio `AudioWorklet`**—modeling pre-baffle harmonic excitation (missing-fundamental bass retention), open-back wooden and plastic cabinet resonances, paper-cone presence peaks, 2× oversampled vacuum-tube and germanium push-pull nonlinearities with 15 Hz DC blocking, gentle broadcast program limiting, spectrally shaped RF/atmospheric static with automatic **Idle Noise Ducking**, and **loudness-matched Original / Processed A/B comparison**.

---

## Key Capabilities

- **One-Click Active Tab Capture:** Captures audio from the active Chrome tab via an explicit user gesture (`chrome.tabCapture` + `chrome.offscreen`) and restores native unmuted tab audio immediately when stopped.
- **Five Scientifically & Historically Grounded Profiles:**
  1. **Warm Tabletop _(Default)_:** 1950s wood-cabinet domestic tube receiver (`85 Hz – 5.8 kHz`, `225 Hz` enclosure warmth, single-ended tube 2nd-order harmonics, subtle room tone).
  2. **Mid-Century AM:** 1948 "All-American Five" superheterodyne (`135 Hz – 4.2 kHz` `24 dB/oct` 455 kHz IF skirt, monaural `5"` speaker coloration, trace `60/120 Hz` heater ripple).
  3. **Transistor Pocket:** 1957 pocket portable (`360 Hz – 3.3 kHz`, `2.35 kHz` paper-cone peak, Class-B germanium odd-order push-pull stage, missing-fundamental bass excitation, **zero** AC mains hum).
  4. **Late-Night DX:** Atmospheric nighttime skywave broadcast voicing (`120 Hz – 4.6 kHz`, smooth broadcast AGC density, narrowed intimate stereo, gentle `0.13 Hz` ionospheric selective-fading drift).
  5. **Clean Vintage:** Minimal 1968 studio broadcast warmth (`55 Hz – 9.2 kHz`, `<1.2%` THD warmth, `65%` cohesive stereo stage, `0%` default static).
- **Loudness-Matched A/B Bypass (`B` Shortcut):** Calibrated per-profile makeup gain keeps Processed and Original signals matched within `±1.5 dB` RMS on broadband musical material so loudness bias never distorts comparisons.
- **Intelligent Static Floor (`Auto-duck` + True Zero):** Independently adjustable colored noise drops to a true zero-CPU bypass at `0%` and automatically ducks by `~22 dB` when tab audio pauses for more than `300 ms`.
- **Built-In Signal Workbench (`workbench.html`):** Full-tab acoustic calibration lab with a self-contained Web Audio reference generator (_Warm Electric Piano_, _Spoken Cadence + Pause_, _65 Hz Sub-Bass + Pulse_, _Calibrated Pink Noise_) and real-time `20 Hz – 20 kHz` transfer curve inspector.
- **100% Local Privacy:** Zero audio recording, zero microphone access, zero `<all_urls>` content scripts, and zero external network calls.

---

## Quick Start: Build & Load Unpacked Extension in Chrome

### Prerequisites

- **Node.js** `>= 20` (tested on `v24.14.0`) and **npm**
- **Google Chrome** or **Chromium** (Manifest V3, Chrome `116+`)

### 1. Install Dependencies & Build Production Bundle

```bash
cd /Users/ishanksahni/money
npm install
npm run build
```

This compiles TypeScript strictly (`tsc --noEmit`) and outputs the ready-to-load extension package in `dist/`.

### 2. Load into Google Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select `/Users/ishanksahni/money/dist`.
4. Pin **Vintage Radio** in the Chrome toolbar.
5. Open a media tab (e.g., YouTube, Spotify Web, SoundCloud, NPR, or any HTML5 audio/video page), start playback, click the **Vintage Radio** icon, and press **Enable Radio**!
   - _Tip:_ To audition presets immediately without opening an external site, click **Workbench ↗** in the popup footer and press **Play Reference Audio**.

---

## Running Automated Tests & Quality Checks

| Command                | Description                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`             | Runs **Vitest** automated unit & synthetic DSP signal tests (`20` tests across biquad accuracy, harmonic distortion DFT, DC blocking, missing-fundamental harmonics, noise gating, mono/stereo phase, loudness-matched bypass, click-free transitions, sample-rate independence at `44.1/48/96 kHz`, and a `60s` CPU stability benchmark). |
| `npm run test:e2e`     | Launches **Playwright** with real Chromium loading the unpacked `dist/` Manifest V3 extension to verify service worker registration, popup layout ergonomics, keyboard navigation, `chrome.storage.local` persistence, restricted-URL recovery, and live `AudioWorklet` telemetry in `Signal Workbench`.                                   |
| `npm run lint`         | Runs **ESLint** (`typescript-eslint` + `react-hooks`) with zero warnings/errors allowed.                                                                                                                                                                                                                                                   |
| `npm run format:check` | Checks code formatting via **Prettier**.                                                                                                                                                                                                                                                                                                   |
| `npm run build`        | Type-checks and builds `dist/` (`popup.html`, `workbench.html`, `offscreen.html`, `background.js`, `worklet/vintage-radio-processor.js`).                                                                                                                                                                                                  |

---

## Repository Structure

```text
money/
├── public/
│   ├── manifest.json                 # Chrome Manifest V3 definition (minimal permissions)
│   └── icons/                        # Custom anti-aliased 16/32/48/128 PNG icons
├── research/
│   ├── RESEARCH_PLAN.md              # Empirical research plan & skill audit
│   ├── HISTORICAL_RADIO_RESEARCH.md  # AA5, Braun tabletop, Regency TR-1, FM & DX specs
│   ├── PSYCHOACOUSTICS_AND_NOSTALGIA.md # Verified peer-reviewed psychoacoustics & MEAMs
│   ├── COMPETITOR_ANALYSIS.md        # Plugin & extension matrix + release scope
│   ├── TECHNICAL_DECISIONS.md        # PRD, MV3 + AudioWorklet spec, gain staging, decision log
│   └── SOURCES.md                    # Programmatically verified DOIs, PMIDs & standards
├── docs/
│   ├── ARCHITECTURE.md               # Deep-dive extension & DSP architecture
│   ├── USER_GUIDE.md                 # End-user controls, shortcuts & listening tips
│   ├── PRIVACY.md                    # Permission justification & local-only guarantee
│   ├── KNOWN_LIMITATIONS.md          # Browser, DRM, and scope boundaries
│   └── PHASE_LOG.md                  # Phase-by-phase engineering & verification log
├── src/
│   ├── dsp/                          # Zero-allocation sample-rate-independent DSP modules
│   ├── worklet/                      # Self-contained AudioWorkletProcessor
│   ├── background/                   # MV3 Service Worker state, badge & offscreen manager
│   ├── offscreen/                    # Tab MediaStream + AudioContext + fault fallback
│   ├── popup/                        # 380px toolbar UI (React + Braun/Rams token system)
│   ├── workbench/                    # Full-tab Signal Workbench & reference synth
│   ├── components/                   # Analytical SVG passband & telemetry meter component
│   ├── hooks/                        # Extension runtime / standalone session hook
│   ├── shared/                       # Validated types, presets, storage reducer, messages
│   └── styles/                       # CSS design tokens & reduced-motion accessibility
├── scripts/
│   └── build.mjs                     # 3-stage Vite build for HTML, Service Worker & Worklet
└── tests/
    ├── dsp/                          # Synthetic signal & acoustic verification tests
    ├── state/                        # Preset validation & storage reducer unit tests
    └── e2e/                          # Playwright unpacked Chrome MV3 extension tests
```

---

## Delivery Status & Honest Scope Assessment

### Completed & Verified in v1.0

- Complete historical, psychoacoustic/neuroscientific, and competitive research suite (`research/*`).
- Five distinct, loudness-calibrated radio profiles (`Warm Tabletop` default) with zero fake controls.
- Full Manifest V3 `tabCapture` + `offscreen` + `AudioWorklet` real-time audio pipeline with automatic `ScriptProcessorNode` fallback and guaranteed native tab audio restoration on stop/close.
- Automated Vitest DSP & state suite (`20/20` passing) + Playwright real-Chrome MV3 E2E suite (`2/2` passing) + clean ESLint & TypeScript builds.

### Chrome Web Store Readiness Note

This repository builds a clean, CSP-compliant unpacked Manifest V3 bundle (`dist/`) with minimal permissions and icons (`16/32/48/128`). However, **we do not claim turnkey Chrome Web Store publication readiness** without completing manual store-listing steps outside code scope (developer account registration, store promotional screenshots, privacy-policy URL hosting, and manual QA against DRM-protected subscription services).

### Deferred Future Enhancements (v2.0+)

- Optional user-uploaded speaker impulse response (`.wav` convolution) slot alongside parametric modeling.
- Optional keyboard global media command (`chrome.commands`) for toggling bypass without opening the popup.
