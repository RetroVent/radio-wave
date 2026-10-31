import { useCallback, useEffect, useState } from 'react';
import {
  isCapturableTabUrl,
  type ExtensionMessage,
  type SessionActionResponse,
} from '../shared/messages';
import { createDefaultSettings } from '../shared/presets';
import {
  applySettingsAction,
  loadPersistedSettings,
  savePersistedSettings,
  type SettingsAction,
} from '../shared/storage';
import type { SessionState } from '../shared/types';

const hasExtensionRuntime = (): boolean =>
  typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id && chrome.runtime?.sendMessage);

export interface ActiveTabSummary {
  id: number | null;
  title: string;
  url: string;
  capturable: boolean;
  reason?: string;
}

export function useExtensionSession() {
  const [session, setSession] = useState<SessionState>(() => ({
    status: 'idle',
    capturedTabId: null,
    capturedTabTitle: null,
    capturedTabUrl: null,
    errorMessage: null,
    sampleRate: null,
    engineMode: null,
    settings: createDefaultSettings(),
    telemetry: null,
  }));
  const [activeTab, setActiveTab] = useState<ActiveTabSummary>({
    id: null,
    title: 'Browser Tab',
    url: 'https://example.com',
    capturable: true,
  });
  const [loading, setLoading] = useState(true);

  const refreshActiveTab = useCallback(async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          const check = isCapturableTabUrl(tab.url);
          setActiveTab({
            id: tab.id ?? null,
            title: tab.title || 'Active Browser Tab',
            url: tab.url || '',
            capturable: check.capturable,
            reason: check.reason,
          });
        }
      } catch {
        // Ignore tab query errors in standalone preview
      }
    }
  }, []);

  // Initial state hydration & real-time listener
  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      await refreshActiveTab();
      if (hasExtensionRuntime()) {
        try {
          const res = (await chrome.runtime.sendMessage({
            type: 'GET_SESSION_STATE',
          } satisfies ExtensionMessage)) as SessionActionResponse | undefined;
          if (mounted && res?.state) {
            setSession(res.state);
          }
        } catch {
          const fallback = await loadPersistedSettings();
          if (mounted) {
            setSession((prev) => ({ ...prev, settings: fallback }));
          }
        }
      } else {
        const persisted = await loadPersistedSettings();
        if (mounted) {
          setSession((prev) => ({ ...prev, settings: persisted }));
        }
      }
      if (mounted) setLoading(false);
    }

    void hydrate();

    if (!hasExtensionRuntime()) {
      return () => {
        mounted = false;
      };
    }

    const onMessage = (rawMsg: unknown) => {
      const msg = rawMsg as ExtensionMessage | undefined;
      if (msg?.type === 'SESSION_STATE_UPDATED') {
        setSession(msg.state);
      } else if (msg?.type === 'OFFSCREEN_TELEMETRY') {
        setSession((prev) =>
          prev.status === 'capturing' ? { ...prev, telemetry: msg.telemetry } : prev,
        );
      }
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => {
      mounted = false;
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, [refreshActiveTab]);

  const dispatchSettings = useCallback(async (action: SettingsAction) => {
    // Optimistic immediate UI update for crisp <16ms slider response
    setSession((prev) => {
      const updated = applySettingsAction(prev.settings, action);
      void savePersistedSettings(updated);
      return {
        ...prev,
        settings: updated,
      };
    });

    if (hasExtensionRuntime()) {
      try {
        const res = (await chrome.runtime.sendMessage({
          type: 'DISPATCH_SETTINGS',
          action,
        } satisfies ExtensionMessage)) as SessionActionResponse | undefined;
        if (res?.state) {
          setSession(res.state);
        }
      } catch {
        // Already persisted optimistically
      }
    }
  }, []);

  /**
   * Starts capture directly inside the user-gesture click handler so `activeTab`
   * grants `chrome.tabCapture.getMediaStreamId` cleanly in Manifest V3.
   */
  const startCapture = useCallback(async () => {
    if (!hasExtensionRuntime()) {
      // Standalone UI preview mode (e.g., dev server / non-extension Playwright test)
      setSession((prev) => ({
        ...prev,
        status: 'capturing',
        capturedTabId: 1,
        capturedTabTitle: 'Preview Tab Audio',
        capturedTabUrl: 'https://preview.local/media',
        sampleRate: 48000,
        engineMode: 'audioworklet',
        errorMessage: null,
      }));
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id === undefined) {
        setSession((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'No active browser tab found to capture.',
        }));
        return;
      }

      const check = isCapturableTabUrl(tab.url);
      if (!check.capturable) {
        setSession((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: check.reason ?? 'This browser page cannot be captured.',
        }));
        return;
      }

      let streamId: string | undefined;
      if (chrome.tabCapture?.getMediaStreamId) {
        streamId = await new Promise<string>((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
            if (chrome.runtime.lastError || !id) {
              reject(
                new Error(chrome.runtime.lastError?.message || 'Unable to capture tab stream.'),
              );
              return;
            }
            resolve(id);
          });
        });
      }

      setSession((prev) => ({ ...prev, status: 'starting', errorMessage: null }));
      const res = (await chrome.runtime.sendMessage({
        type: 'START_CAPTURE',
        streamId,
        tabId: tab.id,
        tabTitle: tab.title || 'Active Browser Tab',
        tabUrl: tab.url || '',
      } satisfies ExtensionMessage)) as SessionActionResponse | undefined;

      if (res?.state) {
        setSession(res.state);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not capture audio from this tab. Ensure media is open in a standard webpage.';
      setSession((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: msg,
      }));
    }
  }, []);

  const stopCapture = useCallback(async () => {
    if (!hasExtensionRuntime()) {
      setSession((prev) => ({
        ...prev,
        status: 'idle',
        capturedTabId: null,
        capturedTabTitle: null,
        capturedTabUrl: null,
        telemetry: null,
        settings: { ...prev.settings, bypass: false },
      }));
      return;
    }

    const res = (await chrome.runtime.sendMessage({
      type: 'STOP_CAPTURE',
    } satisfies ExtensionMessage)) as SessionActionResponse | undefined;
    if (res?.state) {
      setSession(res.state);
    }
  }, []);

  const clearError = useCallback(async () => {
    setSession((prev) => ({
      ...prev,
      status: prev.status === 'error' ? 'idle' : prev.status,
      errorMessage: null,
    }));
    if (hasExtensionRuntime()) {
      await chrome.runtime
        .sendMessage({ type: 'CLEAR_ERROR' } satisfies ExtensionMessage)
        .catch(() => {});
    }
  }, []);

  const openWorkbench = useCallback(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
      void chrome.tabs.create({ url: chrome.runtime.getURL('workbench.html') });
      return;
    }
    window.open('./workbench.html', '_blank', 'noopener');
  }, []);

  return {
    session,
    activeTab,
    loading,
    dispatchSettings,
    startCapture,
    stopCapture,
    clearError,
    openWorkbench,
  };
}
