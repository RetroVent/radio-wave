import type { SettingsAction } from './storage';
import type { AudioTelemetry, DspRuntimeParams, SessionState } from './types';

export type ExtensionMessage =
  | { type: 'GET_SESSION_STATE' }
  | {
      type: 'START_CAPTURE';
      streamId?: string;
      tabId: number;
      tabTitle: string;
      tabUrl: string;
    }
  | { type: 'STOP_CAPTURE' }
  | { type: 'DISPATCH_SETTINGS'; action: SettingsAction }
  | { type: 'CLEAR_ERROR' }
  // Internal background <-> offscreen messages
  | {
      type: 'OFFSCREEN_START';
      streamId: string;
      params: DspRuntimeParams;
    }
  | { type: 'OFFSCREEN_STOP' }
  | { type: 'OFFSCREEN_UPDATE_PARAMS'; params: DspRuntimeParams }
  | { type: 'OFFSCREEN_TELEMETRY'; telemetry: AudioTelemetry }
  | { type: 'OFFSCREEN_STREAM_ENDED'; reason?: string }
  // Broadcast to open Popup / Workbench views
  | { type: 'SESSION_STATE_UPDATED'; state: SessionState };

export interface OffscreenStartResponse {
  ok: boolean;
  sampleRate?: number;
  engineMode?: 'audioworklet' | 'fallback';
  error?: string;
}

export interface SessionActionResponse {
  ok: boolean;
  state: SessionState;
  error?: string;
}

export function isCapturableTabUrl(url: string | undefined | null): {
  capturable: boolean;
  reason?: string;
} {
  if (!url) {
    return {
      capturable: false,
      reason:
        'Open a website playing audio (such as YouTube, Spotify, or a podcast) to activate capture.',
    };
  }
  const lowered = url.toLowerCase();
  if (
    lowered.startsWith('chrome://') ||
    lowered.startsWith('edge://') ||
    lowered.startsWith('about:') ||
    lowered.startsWith('devtools://')
  ) {
    return {
      capturable: false,
      reason:
        'Chrome blocks audio capture on internal browser pages. Switch to a regular media tab or try the Signal Workbench demo.',
    };
  }
  if (lowered.startsWith('chrome-extension://')) {
    return {
      capturable: false,
      reason:
        'Switch to a regular website tab to capture browser audio, or use the built-in Signal Workbench auditioner.',
    };
  }
  if (
    lowered.includes('chromewebstore.google.com') ||
    lowered.includes('chrome.google.com/webstore')
  ) {
    return {
      capturable: false,
      reason: 'Chrome security restricts extensions from capturing the Chrome Web Store.',
    };
  }
  return { capturable: true };
}
