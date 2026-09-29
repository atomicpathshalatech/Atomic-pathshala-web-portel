/**
 * Teacher voice filter for the class audio (what students hear):
 *
 *   mic (browser noise suppression + echo cancel + voice isolation where
 *   available) → RNNoise (AI noise suppression: keyboard, fans, traffic,
 *   people nearby) → high-pass 90 Hz (fans, AC hum, traffic rumble) → low-pass
 *   9 kHz (hiss) → CLOSE-TALK NOISE GATE → compressor (even voice level)
 *
 * The gate is what keeps a room quiet between sentences: speech right at
 * the mic is much louder than noise ~1 m away, so anything below the open
 * threshold is pulled down smoothly (not hard-muted — that sounds broken).
 *
 * `gateStep` is a pure function (unit-tested) and its source is also what
 * runs inside the AudioWorklet, so the tested logic IS the shipped logic.
 */

export interface GateParams {
  /** Opens above this level (dBFS). Close-talk speech is ~-30..-15. */
  openDb: number;
  /** Closes below this level (dBFS) — lower than openDb (hysteresis). */
  closeDb: number;
  /** Stays open this long after speech stops (ms) — no chopped word ends. */
  holdMs: number;
  attackMs: number;
  releaseMs: number;
  /** Gain while closed (dB) — quiet, not dead silence. */
  floorDb: number;
}

export const DEFAULT_GATE: GateParams = {
  openDb: -42,
  closeDb: -50,
  holdMs: 250,
  attackMs: 5,
  releaseMs: 180,
  floorDb: -32,
};

export interface GateState {
  open: boolean;
  holdLeftMs: number;
  gain: number;
}

/** One block of the gate: level of this block (dBFS) + block length → new state (gain to apply). */
export function gateStep(state: GateState, levelDb: number, blockMs: number, p: GateParams): GateState {
  let { open, holdLeftMs } = state;
  if (levelDb >= p.openDb) {
    open = true;
    holdLeftMs = p.holdMs;
  } else if (open) {
    if (levelDb < p.closeDb) {
      holdLeftMs -= blockMs;
      if (holdLeftMs <= 0) open = false;
    } else {
      holdLeftMs = p.holdMs; // still speaking softly
    }
  }
  const target = open ? 1 : Math.pow(10, p.floorDb / 20);
  const tau = target > state.gain ? p.attackMs : p.releaseMs;
  const k = 1 - Math.exp(-blockMs / Math.max(1, tau));
  return { open, holdLeftMs, gain: state.gain + (target - state.gain) * k };
}

// Bound to a fixed name: a production minifier may rename the function itself.
const WORKLET_SOURCE = `
const gateStep = (${gateStep.toString()});
class AtomicVoiceGate extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.p = options.processorOptions.params;
    this.state = { open: false, holdLeftMs: 0, gain: Math.pow(10, this.p.floorDb / 20) };
  }
  process(inputs, outputs) {
    const input = inputs[0], output = outputs[0];
    if (!input || input.length === 0) return true;
    let sum = 0, n = 0;
    for (const ch of input) { for (let i = 0; i < ch.length; i++) { sum += ch[i] * ch[i]; } n += ch.length; }
    const rms = Math.sqrt(sum / Math.max(1, n));
    const levelDb = 20 * Math.log10(rms + 1e-9);
    const blockMs = (input[0].length / sampleRate) * 1000;
    const prev = this.state.gain;
    this.state = gateStep(this.state, levelDb, blockMs, this.p);
    for (let c = 0; c < output.length; c++) {
      const src = input[Math.min(c, input.length - 1)], dst = output[c];
      for (let i = 0; i < dst.length; i++) dst[i] = src[i] * (prev + (this.state.gain - prev) * (i / dst.length));
    }
    return true;
  }
}
registerProcessor("atomic-voice-gate", AtomicVoiceGate);
`;

/** Mic constraints: every built-in voice cleanup the browser offers. */
export const MIC_CONSTRAINTS: MediaTrackConstraints & Record<string, unknown> = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  // Chromium: ML voice isolation where the platform supports it (ignored elsewhere).
  voiceIsolation: true,
  channelCount: 1,
  // RNNoise works on 48 kHz mono.
  sampleRate: 48000,
};

/**
 * Wraps a raw mic track in the filter chain. Returns the filtered track and a
 * stop(); on any failure returns the raw track unchanged (never lose audio).
 */
export async function createVoiceFilter(
  mic: MediaStreamTrack,
  params: GateParams = DEFAULT_GATE,
  opts: { rnnoise?: boolean } = {}
): Promise<{ track: MediaStreamTrack; stop: () => Promise<void>; filtered: boolean; rnnoise: boolean }> {
  let ctx: AudioContext | null = null;
  // RNNoise (AI noise suppression) first. Loaded only here (it's ~5 MB with
  // the model embedded), and entirely optional: if it can't run, the rest of
  // the chain still cleans the voice.
  let denoiser: { stopProcessing(): void } | null = null;
  let monoCtx: AudioContext | null = null;
  let source: MediaStreamTrack = mic;
  if (opts.rnnoise !== false) {
    try {
      const { NoiseSuppressionProcessor } = await import("@shiguredo/noise-suppression");
      if (NoiseSuppressionProcessor.isSupported()) {
        // RNNoise only handles MONO: a stereo track makes it fail silently and
        // its output goes dead (tested — the teacher would be mute). Many mics
        // ignore channelCount:1, so always downmix first.
        monoCtx = new AudioContext({ sampleRate: 48000 });
        await monoCtx.resume().catch(() => undefined);
        const monoDest = monoCtx.createMediaStreamDestination();
        monoDest.channelCount = 1;
        monoDest.channelCountMode = "explicit";
        monoDest.channelInterpretation = "speakers";
        monoCtx.createMediaStreamSource(new MediaStream([mic])).connect(monoDest);
        const mono = monoDest.stream.getAudioTracks()[0]!;
        const proc = new NoiseSuppressionProcessor();
        const cleaned = await proc.startProcessing(mono as Parameters<typeof proc.startProcessing>[0]);
        // Never trust a silent failure: audio frames must actually come out.
        if (await producesAudio(cleaned)) {
          source = cleaned;
          denoiser = proc;
        } else {
          console.warn("[voice_filter] RNNoise produced no audio — using the basic filter");
          proc.stopProcessing();
          await monoCtx.close().catch(() => undefined);
          monoCtx = null;
        }
      }
    } catch (err) {
      console.warn("[voice_filter] RNNoise unavailable", err);
      denoiser = null;
      source = mic;
      await monoCtx?.close().catch(() => undefined);
      monoCtx = null;
    }
  }
  try {
    ctx = new AudioContext({ sampleRate: 48000 });
    // Started explicitly: without a visible window Chromium may leave it suspended.
    await ctx.resume().catch(() => undefined);
    const src = ctx.createMediaStreamSource(new MediaStream([source]));
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 90;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 9000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    const dest = ctx.createMediaStreamDestination();

    let gate: AudioNode | null = null;
    if (ctx.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
      try {
        await ctx.audioWorklet.addModule(url);
        gate = new AudioWorkletNode(ctx, "atomic-voice-gate", { processorOptions: { params } });
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    src.connect(highpass).connect(lowpass);
    (gate ? lowpass.connect(gate) : lowpass).connect(comp).connect(dest);

    const track = dest.stream.getAudioTracks()[0]!;
    const c = ctx;
    const d = denoiser;
    return {
      track,
      filtered: true,
      rnnoise: Boolean(d),
      stop: async () => {
        track.stop();
        d?.stopProcessing();
        await monoCtx?.close().catch(() => undefined);
        await c.close().catch(() => undefined);
      },
    };
  } catch (err) {
    console.warn("[voice_filter] unavailable, sending the raw mic", err);
    await ctx?.close().catch(() => undefined);
    denoiser?.stopProcessing();
    await monoCtx?.close().catch(() => undefined);
    return { track: mic, filtered: false, rnnoise: false, stop: async () => undefined };
  }
}

/** True if at least one audio frame comes out of `track` within `ms` (reads a clone). */
async function producesAudio(track: MediaStreamTrack, ms = 1500): Promise<boolean> {
  const Processor = (globalThis as { MediaStreamTrackProcessor?: new (init: { track: MediaStreamTrack }) => { readable: ReadableStream<{ close(): void }> } }).MediaStreamTrackProcessor;
  if (!Processor) return true; // can't check here — trust it
  const probe = track.clone();
  const reader = new Processor({ track: probe }).readable.getReader();
  try {
    const got = await Promise.race([
      reader.read().then((r) => {
        r.value?.close();
        return !r.done;
      }),
      new Promise<boolean>((res) => setTimeout(() => res(false), ms)),
    ]);
    return got;
  } catch {
    return false;
  } finally {
    reader.cancel().catch(() => undefined);
    probe.stop();
  }
}
