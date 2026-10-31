import { VintageRadioPipeline } from '../dsp/pipeline';
import type { DspRuntimeParams } from '../shared/types';

// Minimal Web Audio AudioWorklet global scope declarations so TypeScript compiles cleanly
// without conflicting with DOM lib definitions.
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new (options?: unknown) => AudioWorkletProcessor,
): void;

declare const sampleRate: number;
declare const currentTime: number;

export type WorkletInboundMessage =
  { type: 'UPDATE_PARAMS'; params: Partial<DspRuntimeParams>; snap?: boolean } | { type: 'RESET' };

class VintageRadioProcessor extends AudioWorkletProcessor {
  private readonly pipeline: VintageRadioPipeline;
  private readonly silenceBuffer = new Float32Array(128);
  private blocksSinceTelemetry = 0;
  private readonly telemetryIntervalBlocks: number;

  constructor() {
    super();
    const sr = typeof sampleRate === 'number' && sampleRate > 0 ? sampleRate : 48000;
    this.pipeline = new VintageRadioPipeline(sr);
    // ~20 Hz telemetry rate (every ~18 blocks at 48 kHz / 128 frames)
    this.telemetryIntervalBlocks = Math.max(8, Math.round(sr / (128 * 20)));

    this.port.onmessage = (event: MessageEvent<WorkletInboundMessage>) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'UPDATE_PARAMS') {
        this.pipeline.updateParams(msg.params, Boolean(msg.snap));
      } else if (msg.type === 'RESET') {
        this.pipeline.reset();
      }
    };
  }

  override process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const input = inputs[0];
    const frames = output[0].length;
    const fallbackSilence =
      this.silenceBuffer.length === frames ? this.silenceBuffer : new Float32Array(frames);

    const leftIn = input && input.length > 0 && input[0] ? input[0] : fallbackSilence;
    const rightIn =
      input && input.length > 1 && input[1]
        ? input[1]
        : input && input.length > 0 && input[0]
          ? input[0]
          : fallbackSilence;

    const leftOut = output[0];
    const rightOut = output.length > 1 && output[1] ? output[1] : output[0];

    this.pipeline.process(leftIn, rightIn, leftOut, rightOut);

    // Copy to any additional surround output channels if present
    for (let ch = 2; ch < output.length; ch++) {
      output[ch].set(leftOut);
    }

    this.blocksSinceTelemetry++;
    if (this.blocksSinceTelemetry >= this.telemetryIntervalBlocks) {
      this.blocksSinceTelemetry = 0;
      const nowMs = typeof currentTime === 'number' ? Math.round(currentTime * 1000) : Date.now();
      this.port.postMessage({
        type: 'TELEMETRY',
        telemetry: this.pipeline.getTelemetrySnapshot(nowMs),
      });
    }

    return true;
  }
}

registerProcessor('vintage-radio-processor', VintageRadioProcessor);
