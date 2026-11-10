import { VintageRadioPipeline } from '../dsp/pipeline';
import type { ExtensionMessage, OffscreenStartResponse } from '../shared/messages';
import type { AudioTelemetry, DspRuntimeParams } from '../shared/types';
import type { WorkletInboundMessage } from '../worklet/vintage-radio-processor';

interface ActiveAudioSession {
  stream: MediaStream;
  context: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  processorNode: AudioWorkletNode | ScriptProcessorNode;
  fallbackPipeline: VintageRadioPipeline | null;
  engineMode: 'audioworklet' | 'fallback';
}

let activeSession: ActiveAudioSession | null = null;
let fallbackTelemetryCounter = 0;

function postTelemetry(telemetry: AudioTelemetry): void {
  chrome.runtime
    .sendMessage({
      type: 'OFFSCREEN_TELEMETRY',
      telemetry,
    } satisfies ExtensionMessage)
    .catch(() => {});
}

async function cleanupActiveSession(): Promise<void> {
  const session = activeSession;
  activeSession = null;
  if (!session) return;

  try {
    session.sourceNode.disconnect();
  } catch {
    // Ignore disconnect errors
  }
  try {
    session.processorNode.disconnect();
  } catch {
    // Ignore disconnect errors
  }

  // Crucial: stopping every MediaStreamTrack immediately restores native Chrome tab audio output!
  for (const track of session.stream.getTracks()) {
    try {
      track.onended = null;
      track.stop();
    } catch {
      // Ignore track stop errors
    }
  }

  try {
    if (session.context.state !== 'closed') {
      await session.context.close();
    }
  } catch {
    // Ignore close errors
  }
}

async function startCaptureGraph(
  streamId: string,
  initialParams: DspRuntimeParams,
): Promise<OffscreenStartResponse> {
  await cleanupActiveSession();

  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;

  try {
    // Chrome tabCapture mandatory constraint format for offscreen getUserMedia
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    } as unknown as MediaStreamConstraints;

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('Captured tab stream did not contain an audio track.');
    }

    context = new AudioContext({ latencyHint: 'interactive' });
    if (context.state === 'suspended') {
      await context.resume();
    }

    const sourceNode = context.createMediaStreamSource(stream);
    let processorNode: AudioWorkletNode | ScriptProcessorNode;
    let fallbackPipeline: VintageRadioPipeline | null = null;
    let engineMode: 'audioworklet' | 'fallback' = 'audioworklet';

    try {
      const moduleUrl = chrome.runtime.getURL('worklet/vintage-radio-processor.js');
      await context.audioWorklet.addModule(moduleUrl);
      const workletNode = new AudioWorkletNode(context, 'vintage-radio-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      workletNode.port.onmessage = (
        event: MessageEvent<{ type: string; telemetry?: AudioTelemetry }>,
      ) => {
        if (event.data?.type === 'TELEMETRY' && event.data.telemetry) {
          postTelemetry(event.data.telemetry);
        }
      };
      workletNode.port.postMessage({
        type: 'UPDATE_PARAMS',
        params: initialParams,
        snap: true,
      } satisfies WorkletInboundMessage);

      processorNode = workletNode;
    } catch {
      // Resilient fallback so the tab is NEVER left muted if AudioWorklet loading fails
      engineMode = 'fallback';
      const pipeline = new VintageRadioPipeline(context.sampleRate);
      pipeline.updateParams(initialParams, true);
      fallbackPipeline = pipeline;

      const scriptNode = context.createScriptProcessor(512, 2, 2);
      scriptNode.onaudioprocess = (audioEvent) => {
        const inBuf = audioEvent.inputBuffer;
        const outBuf = audioEvent.outputBuffer;
        const lIn = inBuf.getChannelData(0);
        const rIn = inBuf.numberOfChannels > 1 ? inBuf.getChannelData(1) : lIn;
        const lOut = outBuf.getChannelData(0);
        const rOut = outBuf.numberOfChannels > 1 ? outBuf.getChannelData(1) : lOut;
        pipeline.process(lIn, rIn, lOut, rOut);

        fallbackTelemetryCounter++;
        if (fallbackTelemetryCounter >= 5) {
          fallbackTelemetryCounter = 0;
          postTelemetry(pipeline.getTelemetrySnapshot(Date.now()));
        }
      };
      processorNode = scriptNode;
    }

    sourceNode.connect(processorNode);
    processorNode.connect(context.destination);

    // Handle external stream termination (e.g. tab closed or navigated to chrome://)
    for (const track of audioTracks) {
      track.onended = () => {
        void cleanupActiveSession().then(() => {
          chrome.runtime
            .sendMessage({
              type: 'OFFSCREEN_STREAM_ENDED',
              reason: 'Tab audio stream ended.',
            } satisfies ExtensionMessage)
            .catch(() => {});
        });
      };
    }

    activeSession = {
      stream,
      context,
      sourceNode,
      processorNode,
      fallbackPipeline,
      engineMode,
    };

    return {
      ok: true,
      sampleRate: context.sampleRate,
      engineMode,
    };
  } catch (err) {
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      }
    }
    if (context && context.state !== 'closed') {
      try {
        await context.close();
      } catch {
        // Ignore
      }
    }
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Failed to open tab audio stream in offscreen context.',
    };
  }
}

function updateActiveParams(params: DspRuntimeParams): void {
  if (!activeSession) return;
  if (activeSession.engineMode === 'audioworklet' && 'port' in activeSession.processorNode) {
    activeSession.processorNode.port.postMessage({
      type: 'UPDATE_PARAMS',
      params,
      snap: false,
    } satisfies WorkletInboundMessage);
  } else if (activeSession.fallbackPipeline) {
    activeSession.fallbackPipeline.updateParams(params, false);
  }
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

  if (msg.type === 'OFFSCREEN_START') {
    void startCaptureGraph(msg.streamId, msg.params).then(sendResponse);
    return true;
  }

  if (msg.type === 'OFFSCREEN_STOP') {
    void cleanupActiveSession().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'OFFSCREEN_UPDATE_PARAMS') {
    updateActiveParams(msg.params);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
