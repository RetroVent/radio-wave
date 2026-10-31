# Privacy & Permissions Policy

**Vintage Radio processes 100% of audio locally inside your browser on your device.**

## Zero Data Collection Guarantee

- **No Audio Recording or Storage:** Captured tab audio streams directly through an in-memory Web Audio `AudioWorklet` buffer (`128` samples ≈ `2.67 ms` at `48 kHz`) to your speakers and is immediately discarded. Audio is never written to disk or indexed.
- **No Network Transmission:** The extension contains zero analytics SDKs, zero telemetry servers, zero cloud APIs, and zero external font or script imports (`content_security_policy: "script-src 'self'; object-src 'self';"`).
- **No Microphone Access:** Vintage Radio never requests `microphone` capture permissions. It processes browser tab playback only when you explicitly click **Enable Radio**.
- **No Browsing History Surveillance:** Vintage Radio does **not** request `<all_urls>` host permissions or inject content scripts into every website you visit.

---

## Justification of Requested Chrome Permissions

| Permission   | Why It Is Required                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabCapture` | Allows capturing the audio output stream of the active Chrome tab after you explicitly click **Enable Radio**.                                                    |
| `offscreen`  | Required by Chrome Manifest V3 so the real-time Web Audio `AudioContext` and `AudioWorklet` continue playing uninterrupted after you close the toolbar popup.     |
| `activeTab`  | Grants temporary access to the currently open tab when you click the toolbar icon so `tabCapture` can attach to that specific tab without broad site permissions. |
| `storage`    | Saves your local UI preferences (selected preset, slider positions, and `Auto-duck` toggle) inside `chrome.storage.local` on your computer.                       |
