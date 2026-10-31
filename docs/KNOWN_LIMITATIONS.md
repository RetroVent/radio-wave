# Known Limitations & Technical Boundaries

In accordance with our engineering and scientific integrity standards, this document outlines the exact technical boundaries of **Vintage Radio v1.0**.

## 1. Browser & Platform Boundaries

1. **Single Active Chrome Tab Scope (Not System-Wide OS Audio):**
   - Chrome's `chrome.tabCapture` API captures audio originating inside a Chrome browser tab. It cannot process audio from external desktop applications (such as the native macOS/Windows Spotify desktop app, Apple Music app, or Zoom desktop client).
   - While one tab is actively captured, audio in that tab is processed continuously even as you browse other tabs. Clicking **Switch here** in the popup moves processing cleanly to a new media tab.
2. **Restricted Chrome Pages:**
   - By Chrome security design, extensions cannot capture `chrome://` pages, `chrome-extension://` pages, DevTools windows, or the **Chrome Web Store** (`chromewebstore.google.com`). If invoked on one of these pages, Vintage Radio displays an explanation and offers one-click access to the built-in **Signal Workbench** auditioner.
3. **Hardware-Enforced DRM / Encrypted Media Extensions (EME):**
   - Most browser media sites (YouTube, SoundCloud, Bandcamp, podcasts, web radio, standard Spotify Web streams) expose audio to `chrome.tabCapture`. However, video/audio streams using hardware-enforced Encrypted Media Extensions (such as Widevine L1 hardware-protected video playback on certain subscription cinema platforms) may output silence to `tabCapture` per browser DRM protections. Vintage Radio never attempts to bypass DRM or browser security boundaries.
4. **Bluetooth / Output Latency:**
   - The DSP engine itself introduces minimal processing latency (`128` samples = `2.67 ms` at `48 kHz` via `AudioWorklet` + Chrome's interactive Web Audio output buffer, typically `~15–30 ms` total on wired/built-in outputs). Bluetooth headphones add their own codec latency downstream of Chrome.

## 2. Acoustic & Scientific Boundaries

1. **Parametric Physical Modeling vs. Measured Full-Length Convolution IRs:**
   - Our enclosure and paper-cone stages use cascaded RBJ biquad filters and oversampled waveshapers rather than long FIR impulse responses of a single microphone/room placement. This enables `< 2%` single-core CPU usage, zero convolution latency, and smooth continuous `Character Intensity` morphing, at the trade-off of not replicating fine high-Q comb reflections of a specific physical room.
2. **Individual Differences in Emotional & Nostalgic Response:**
   - As documented in `research/PSYCHOACOUSTICS_AND_NOSTALGIA.md`, peer-reviewed studies (`Barrett et al., 2010`; `Hennessy et al., 2025`; `Martínez-Molina et al., 2016`) establish that nostalgia and emotional reward depend primarily on personal familiarity and autobiographical association with the music being played—not on spectral coloration alone. Vintage Radio provides historically and psychoacoustically grounded sonic framing without claiming universal emotional or neurochemical effects.
