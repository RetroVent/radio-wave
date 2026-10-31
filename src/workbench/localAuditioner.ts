import { VintageRadioPipeline } from '../dsp/pipeline';
import type { AudioTelemetry, DspRuntimeParams } from '../shared/types';
import type { WorkletInboundMessage } from '../worklet/vintage-radio-processor';

export type AuditionSignalType = 'jazz-chord' | 'spoken-cadence' | 'sub-groove' | 'pink-noise';

/**
 * Self-contained local Web Audio signal generator & AudioWorklet DSP auditioner
 * for the Signal Workbench page. Enables immediate controlled listening comparisons
 * across music, spoken word (with pauses to verify Idle Noise Ducking), sub-bass
 * (to verify missing-fundamental overtones), and reference pink noise.
 */
export class LocalAuditioner {
  private context: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private processorNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private fallbackPipeline: VintageRadioPipeline | null = null;
  private engineMode: 'audioworklet' | 'fallback' = 'audioworklet';
  private currentSignal: AuditionSignalType = 'jazz-chord';
  private onTelemetry?: (telemetry: AudioTelemetry) => void;

  constructor(onTelemetry?: (telemetry: AudioTelemetry) => void) {
    this.onTelemetry = onTelemetry;
  }

  private buildLoopBuffer(ctx: AudioContext, type: AuditionSignalType): AudioBuffer {
    const sr = ctx.sampleRate;
    const durationSec = 6;
    const length = sr * durationSec;
    const buffer = ctx.createBuffer(2, length, sr);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    let rng = 0x2468ace1;
    const nextRand = () => {
      rng ^= rng << 13;
      rng ^= rng >>> 17;
      rng ^= rng << 5;
      return ((rng >>> 0) / 0xffffffff) * 2 - 1;
    };

    let pk0 = 0;
    let pk1 = 0;
    let pk2 = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sr;
      let l = 0;
      let r = 0;

      if (type === 'jazz-chord') {
        // Warm electric-piano voicing (Dm9 -> G13 progression, 3s each)
        const chordIdx = t < 3 ? 0 : 1;
        const localT = t % 3;
        const env = Math.min(1, localT / 0.025) * Math.exp(-localT * 0.65);
        const freqs =
          chordIdx === 0
            ? [146.83, 293.66, 349.23, 440.0, 523.25, 659.25]
            : [98.0, 196.0, 349.23, 493.88, 659.25, 880.0];
        const amps = [0.22, 0.16, 0.14, 0.12, 0.1, 0.08];
        for (let k = 0; k < freqs.length; k++) {
          const f = freqs[k];
          const trem = 1 + 0.08 * Math.sin(2 * Math.PI * 4.2 * t + k);
          const harmonic =
            Math.sin(2 * Math.PI * f * t) +
            0.18 * Math.exp(-localT * 2.2) * Math.sin(4 * Math.PI * f * t);
          l += amps[k] * env * trem * harmonic;
          r += amps[k] * env * trem * Math.sin(2 * Math.PI * f * t + (k % 2 === 0 ? 0.18 : -0.18));
        }
      } else if (type === 'spoken-cadence') {
        // Simulated vocal glottal harmonic pulse + vowel formants + 1.4s silent pause (t = 4.2..5.8s)
        // so listeners can directly hear Idle Noise Ducking engage during pauses!
        const speaking = t < 4.15;
        if (speaking) {
          const syllableRate = 3.6;
          const sylEnv = Math.max(0, Math.sin(Math.PI * ((t * syllableRate) % 1))) ** 0.7;
          const f0 = 128 + 18 * Math.sin(2 * Math.PI * 0.8 * t);
          let voice = 0;
          for (let h = 1; h <= 16; h++) {
            const freq = f0 * h;
            // Formant peaks around 520 Hz, 1450 Hz, and 2550 Hz
            const f1 = Math.exp(-(((freq - 520) / 180) ** 2));
            const f2 = 0.65 * Math.exp(-(((freq - 1450) / 280) ** 2));
            const f3 = 0.35 * Math.exp(-(((freq - 2550) / 360) ** 2));
            const weight = (f1 + f2 + f3 + 0.06 / h) * sylEnv;
            voice += weight * Math.sin(2 * Math.PI * freq * t + h * 0.3);
          }
          l = voice * 0.22;
          r = voice * 0.22;
        }
      } else if (type === 'sub-groove') {
        // Pure sinusoidal 65 Hz / 82 Hz sub-bass + crisp high-hat clicks
        // Demonstrates missing-fundamental harmonic generation on small-speaker presets!
        const beatT = t % 0.75;
        const noteHz = Math.floor(t / 1.5) % 2 === 0 ? 65.41 : 82.41;
        const subEnv = Math.min(1, beatT / 0.012) * Math.exp(-beatT * 2.4);
        const sub = 0.42 * subEnv * Math.sin(2 * Math.PI * noteHz * t);
        const hatT = t % 0.375;
        const hat = hatT < 0.04 ? nextRand() * Math.exp(-hatT * 90) * 0.12 : 0;
        l = sub + hat;
        r = sub + hat * 0.85;
      } else {
        // Calibrated -16 dBFS stereo pink noise for objective loudness-match A/B testing
        const wL = nextRand();
        pk0 = 0.99765 * pk0 + wL * 0.099046;
        pk1 = 0.963 * pk1 + wL * 0.2965164;
        pk2 = 0.57 * pk2 + wL * 1.0526913;
        const p = (pk0 + pk1 + pk2 + wL * 0.1848) * 0.042;
        l = p;
        r = p;
      }

      left[i] = l;
      right[i] = r;
    }

    return buffer;
  }

  async start(signal: AuditionSignalType, params: DspRuntimeParams): Promise<void> {
    await this.stop();
    this.currentSignal = signal;

    const ctx = new AudioContext({ latencyHint: 'interactive' });
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const src = ctx.createBufferSource();
    src.buffer = this.buildLoopBuffer(ctx, signal);
    src.loop = true;

    let procNode: AudioWorkletNode | ScriptProcessorNode;
    try {
      const workletUrl =
        typeof chrome !== 'undefined' && chrome.runtime?.getURL
          ? chrome.runtime.getURL('worklet/vintage-radio-processor.js')
          : './worklet/vintage-radio-processor.js';
      await ctx.audioWorklet.addModule(workletUrl);
      const wn = new AudioWorkletNode(ctx, 'vintage-radio-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      wn.port.onmessage = (ev: MessageEvent<{ type: string; telemetry?: AudioTelemetry }>) => {
        if (ev.data?.type === 'TELEMETRY' && ev.data.telemetry && this.onTelemetry) {
          this.onTelemetry(ev.data.telemetry);
        }
      };
      wn.port.postMessage({
        type: 'UPDATE_PARAMS',
        params,
        snap: true,
      } satisfies WorkletInboundMessage);
      procNode = wn;
      this.engineMode = 'audioworklet';
    } catch {
      this.engineMode = 'fallback';
      const pipe = new VintageRadioPipeline(ctx.sampleRate);
      pipe.updateParams(params, true);
      this.fallbackPipeline = pipe;
      let count = 0;
      const sn = ctx.createScriptProcessor(512, 2, 2);
      sn.onaudioprocess = (ev) => {
        pipe.process(
          ev.inputBuffer.getChannelData(0),
          ev.inputBuffer.getChannelData(1),
          ev.outputBuffer.getChannelData(0),
          ev.outputBuffer.getChannelData(1),
        );
        count++;
        if (count >= 4 && this.onTelemetry) {
          count = 0;
          this.onTelemetry(pipe.getTelemetrySnapshot(Date.now()));
        }
      };
      procNode = sn;
    }

    src.connect(procNode);
    procNode.connect(ctx.destination);
    src.start();

    this.context = ctx;
    this.sourceNode = src;
    this.processorNode = procNode;
  }

  updateParams(params: DspRuntimeParams): void {
    if (!this.context || !this.processorNode) return;
    if (this.engineMode === 'audioworklet' && 'port' in this.processorNode) {
      this.processorNode.port.postMessage({
        type: 'UPDATE_PARAMS',
        params,
        snap: false,
      } satisfies WorkletInboundMessage);
    } else if (this.fallbackPipeline) {
      this.fallbackPipeline.updateParams(params, false);
    }
  }

  async switchSignal(signal: AuditionSignalType, params: DspRuntimeParams): Promise<void> {
    if (!this.context) {
      this.currentSignal = signal;
      return;
    }
    await this.start(signal, params);
  }

  getSignalType(): AuditionSignalType {
    return this.currentSignal;
  }

  isRunning(): boolean {
    return this.context !== null && this.context.state === 'running';
  }

  async stop(): Promise<void> {
    try {
      this.sourceNode?.stop();
      this.sourceNode?.disconnect();
    } catch {
      // Ignore
    }
    try {
      this.processorNode?.disconnect();
    } catch {
      // Ignore
    }
    if (this.context && this.context.state !== 'closed') {
      try {
        await this.context.close();
      } catch {
        // Ignore
      }
    }
    this.sourceNode = null;
    this.processorNode = null;
    this.fallbackPipeline = null;
    this.context = null;
  }
}
