import {
  isCapturableTabUrl,
  type ExtensionMessage,
  type OffscreenStartResponse,
  type SessionActionResponse,
} from '../shared/messages';
import { createDefaultSettings } from '../shared/presets';
import {
  applySettingsAction,
  loadPersistedSettings,
  savePersistedSettings,
  toDspRuntimeParams,
} from '../shared/storage';
import type { SessionState } from '../shared/types';

let sessionState: SessionState = {
  status: 'idle',
  capturedTabId: null,
  capturedTabTitle: null,
  capturedTabUrl: null,
  errorMessage: null,
  sampleRate: null,
  engineMode: null,
  settings: createDefaultSettings(),
  telemetry: null,
};

let initPromise: Promise<void> | null = null;
let offscreenMutex: Promise<void> = Promise.resolve();

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const persisted = await loadPersistedSettings();
      sessionState = {
        ...sessionState,
        settings: persisted,
      };
      await syncBadge();
    })();
  }
  await initPromise;
}

async function syncBadge(): Promise<void> {
  try {
    if (!chrome.action) return;
    if (sessionState.status === 'capturing') {
      if (sessionState.settings.bypass) {
        await chrome.action.setBadgeText({ text: 'BYP' });
        await chrome.action.setBadgeBackgroundColor({ color: '#6E685F' });
      } else {
        await chrome.action.setBadgeText({ text: 'ON' });
        await chrome.action.setBadgeBackgroundColor({ color: '#2A6049' });
      }
    } else if (sessionState.status === 'error') {
      await chrome.action.setBadgeText({ text: '!' });
      await chrome.action.setBadgeBackgroundColor({ color: '#B85D19' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    // Ignore badge errors during startup/teardown
  }
}

function broadcastState(): void {
  void syncBadge();
  chrome.runtime
    .sendMessage({
      type: 'SESSION_STATE_UPDATED',
      state: sessionState,
    } satisfies ExtensionMessage)
    .catch(() => {
      // Expected when popup/workbench is closed
    });
}

async function ensureOffscreenDocument(): Promise<void> {
  const run = async () => {
    if ('getContexts' in chrome.runtime) {
      const existing = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      });
      if (existing.length > 0) return;
    }

    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification:
        'Capture active tab audio stream via tabCapture and render real-time vintage radio DSP locally.',
    });
  };

  offscreenMutex = offscreenMutex.then(run, run);
  await offscreenMutex;
}

async function closeOffscreenDocumentSafely(): Promise<void> {
  const run = async () => {
    try {
      if ('getContexts' in chrome.runtime) {
        const existing = await chrome.runtime.getContexts({
          contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        });
        if (existing.length === 0) return;
      }
      await chrome.offscreen.closeDocument();
    } catch {
      // Already closed
    }
  };

  offscreenMutex = offscreenMutex.then(run, run);
  await offscreenMutex;
}

async function obtainStreamIdFallback(tabId: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) {
        reject(
          new Error(
            chrome.runtime.lastError?.message ??
              'Unable to acquire tab audio stream. Click the Vintage Radio toolbar icon on an active media tab.',
          ),
        );
        return;
      }
      resolve(streamId);
    });
  });
}

async function handleStartCapture(
  msg: Extract<ExtensionMessage, { type: 'START_CAPTURE' }>,
): Promise<SessionActionResponse> {
  await ensureInitialized();

  // Defense-in-depth: query actual tab from Chrome to prevent URL spoofing
  let verifiedUrl = msg.tabUrl;
  let verifiedTitle = msg.tabTitle;
  if (typeof chrome !== 'undefined' && chrome.tabs?.get) {
    try {
      const liveTab = await chrome.tabs.get(msg.tabId);
      if (liveTab.url) verifiedUrl = liveTab.url;
      if (liveTab.title) verifiedTitle = liveTab.title;
    } catch {
      // Tab may have closed or tab access failed
    }
  }

  const urlCheck = isCapturableTabUrl(verifiedUrl);
  if (!urlCheck.capturable) {
    sessionState = {
      ...sessionState,
      status: 'error',
      errorMessage: urlCheck.reason ?? 'This tab cannot be captured.',
      telemetry: null,
    };
    broadcastState();
    return { ok: false, state: sessionState, error: sessionState.errorMessage ?? undefined };
  }

  // If another tab is currently captured, stop it cleanly first so it never stays muted
  if (sessionState.status === 'capturing') {
    await handleStopCapture();
  }

  sessionState = {
    ...sessionState,
    status: 'starting',
    errorMessage: null,
    telemetry: null,
  };
  broadcastState();

  try {
    const streamId = msg.streamId || (await obtainStreamIdFallback(msg.tabId));
    await ensureOffscreenDocument();

    const response = (await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_START',
      streamId,
      params: toDspRuntimeParams(sessionState.settings),
    } satisfies ExtensionMessage)) as OffscreenStartResponse | undefined;

    if (!response?.ok) {
      throw new Error(response?.error || 'Offscreen audio engine failed to initialize.');
    }

    sessionState = {
      ...sessionState,
      status: 'capturing',
      capturedTabId: msg.tabId,
      capturedTabTitle: verifiedTitle || 'Active Browser Tab',
      capturedTabUrl: verifiedUrl,
      sampleRate: response.sampleRate ?? 48000,
      engineMode: response.engineMode ?? 'audioworklet',
      errorMessage: null,
    };
    broadcastState();
    return { ok: true, state: sessionState };
  } catch (err) {
    await closeOffscreenDocumentSafely();
    const message =
      err instanceof Error
        ? err.message
        : 'Audio capture could not start on this tab. Try reloading the page and clicking Enable.';
    sessionState = {
      ...sessionState,
      status: 'error',
      capturedTabId: null,
      capturedTabTitle: null,
      capturedTabUrl: null,
      sampleRate: null,
      engineMode: null,
      telemetry: null,
      errorMessage: message,
    };
    broadcastState();
    return { ok: false, state: sessionState, error: message };
  }
}

async function handleStopCapture(): Promise<SessionActionResponse> {
  await ensureInitialized();
  sessionState = {
    ...sessionState,
    status: 'stopping',
  };

  try {
    await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' } satisfies ExtensionMessage);
  } catch {
    // Offscreen may already have closed
  }
  await closeOffscreenDocumentSafely();

  sessionState = {
    ...sessionState,
    status: 'idle',
    capturedTabId: null,
    capturedTabTitle: null,
    capturedTabUrl: null,
    sampleRate: null,
    engineMode: null,
    telemetry: null,
    errorMessage: null,
    settings: {
      ...sessionState.settings,
      bypass: false,
    },
  };
  broadcastState();
  return { ok: true, state: sessionState };
}

chrome.runtime.onMessage.addListener((rawMessage: unknown, sender, sendResponse) => {
  // Validate that messages originate exclusively from within this extension
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  const msg = rawMessage as ExtensionMessage | undefined;
  if (!msg || typeof msg !== 'object' || !('type' in msg)) {
    return false;
  }

  // Messages handled by offscreen.ts directly should not be intercepted here
  if (
    msg.type === 'OFFSCREEN_START' ||
    msg.type === 'OFFSCREEN_STOP' ||
    msg.type === 'OFFSCREEN_UPDATE_PARAMS' ||
    msg.type === 'SESSION_STATE_UPDATED'
  ) {
    return false;
  }

  if (msg.type === 'OFFSCREEN_TELEMETRY') {
    if (sessionState.status === 'capturing') {
      sessionState = {
        ...sessionState,
        telemetry: msg.telemetry,
      };
    }
    return false;
  }

  if (msg.type === 'OFFSCREEN_STREAM_ENDED') {
    void (async () => {
      await closeOffscreenDocumentSafely();
      sessionState = {
        ...sessionState,
        status: 'idle',
        capturedTabId: null,
        capturedTabTitle: null,
        capturedTabUrl: null,
        sampleRate: null,
        engineMode: null,
        telemetry: null,
        errorMessage: null,
      };
      broadcastState();
    })();
    return false;
  }

  void (async () => {
    await ensureInitialized();

    switch (msg.type) {
      case 'GET_SESSION_STATE': {
        sendResponse({ ok: true, state: sessionState } satisfies SessionActionResponse);
        return;
      }
      case 'START_CAPTURE': {
        const res = await handleStartCapture(msg);
        sendResponse(res);
        return;
      }
      case 'STOP_CAPTURE': {
        const res = await handleStopCapture();
        sendResponse(res);
        return;
      }
      case 'DISPATCH_SETTINGS': {
        const nextSettings = applySettingsAction(sessionState.settings, msg.action);
        sessionState = {
          ...sessionState,
          settings: nextSettings,
        };
        await savePersistedSettings(nextSettings);

        if (sessionState.status === 'capturing') {
          chrome.runtime
            .sendMessage({
              type: 'OFFSCREEN_UPDATE_PARAMS',
              params: toDspRuntimeParams(nextSettings),
            } satisfies ExtensionMessage)
            .catch(() => {});
        }
        broadcastState();
        sendResponse({ ok: true, state: sessionState } satisfies SessionActionResponse);
        return;
      }
      case 'CLEAR_ERROR': {
        sessionState = {
          ...sessionState,
          status: sessionState.status === 'error' ? 'idle' : sessionState.status,
          errorMessage: null,
        };
        broadcastState();
        sendResponse({ ok: true, state: sessionState } satisfies SessionActionResponse);
        return;
      }
    }
  })();

  return true;
});

// Automatically release capture if the captured tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (sessionState.capturedTabId === tabId) {
    void handleStopCapture();
  }
});

// Keep captured tab title & restricted-navigation state synchronized
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (sessionState.capturedTabId !== tabId || sessionState.status !== 'capturing') {
    return;
  }
  const currentUrl = changeInfo.url || tab.url;
  if (currentUrl && !isCapturableTabUrl(currentUrl).capturable) {
    void handleStopCapture();
    return;
  }
  if (changeInfo.title || tab.title) {
    sessionState = {
      ...sessionState,
      capturedTabTitle: changeInfo.title ?? tab.title ?? sessionState.capturedTabTitle,
    };
    broadcastState();
  }
});

chrome.runtime.onStartup.addListener(() => {
  void ensureInitialized();
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureInitialized();
});
