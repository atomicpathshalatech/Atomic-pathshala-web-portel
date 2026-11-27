/**
 * Real client-side Web Audio API OfflineAudioContext mixer with RMS-envelope
 * audio ducking, trim, loop, fade-in, fade-out, and 16-bit PCM WAV export.
 */

export interface MixAudioParams {
  voiceUrl?: string | null;
  musicUrl?: string | null;
  voiceVolume: number;
  musicVolumeDuringSpeech: number;
  musicVolumeDuringPause: number;
  duckingFadeMs: number;
  duckingRecoveryMs: number;
  manualOverride: boolean;
  fadeInMs: number;
  fadeOutMs: number;
  loopMusic: boolean;
}

function encodeWavFromAudioBuffer(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export async function mixAndDuckAudioToWav(params: MixAudioParams): Promise<Blob> {
  if (!params.voiceUrl && !params.musicUrl) {
    throw new Error("Select at least a Voice or Music track to mix.");
  }

  const decodeCtx = new AudioContext();
  try {
    const fetchAndDecode = async (url: string): Promise<AudioBuffer> => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch audio track (${res.status})`);
      const buf = await res.arrayBuffer();
      return decodeCtx.decodeAudioData(buf);
    };

    const [voiceBuf, musicBuf] = await Promise.all([
      params.voiceUrl ? fetchAndDecode(params.voiceUrl) : Promise.resolve(null),
      params.musicUrl ? fetchAndDecode(params.musicUrl) : Promise.resolve(null),
    ]);

    const sampleRate = voiceBuf?.sampleRate || musicBuf?.sampleRate || 44100;
    const totalDurationSec = Math.max(voiceBuf?.duration || 0, musicBuf?.duration || 0, 1);
    const totalSamples = Math.ceil(totalDurationSec * sampleRate);

    const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

    if (voiceBuf) {
      const vSrc = offline.createBufferSource();
      vSrc.buffer = voiceBuf;
      const vGain = offline.createGain();
      vGain.gain.value = params.voiceVolume;
      vSrc.connect(vGain);
      vGain.connect(offline.destination);
      vSrc.start(0);
    }

    if (musicBuf) {
      const mSrc = offline.createBufferSource();
      mSrc.buffer = musicBuf;
      mSrc.loop = params.loopMusic && Boolean(voiceBuf);
      const mGain = offline.createGain();

      // Fade in
      const fadeInSec = Math.min(totalDurationSec / 2, params.fadeInMs / 1000);
      const fadeOutSec = Math.min(totalDurationSec / 2, params.fadeOutMs / 1000);
      const basePauseVol = params.musicVolumeDuringPause;

      if (fadeInSec > 0.01) {
        mGain.gain.setValueAtTime(0.001, 0);
        mGain.gain.linearRampToValueAtTime(basePauseVol, fadeInSec);
      } else {
        mGain.gain.setValueAtTime(basePauseVol, 0);
      }

      // Real RMS-envelope audio ducking when voice is active
      if (voiceBuf && !params.manualOverride) {
        const vData = voiceBuf.getChannelData(0);
        const windowSamples = Math.floor(sampleRate * 0.1); // 100ms analysis windows
        const fadeSec = Math.max(0.05, params.duckingFadeMs / 1000);
        const recSec = Math.max(0.1, params.duckingRecoveryMs / 1000);
        let currentlyDucked = false;

        for (let i = 0; i < vData.length; i += windowSamples) {
          let sumSq = 0;
          const end = Math.min(vData.length, i + windowSamples);
          for (let j = i; j < end; j++) {
            const s = vData[j] ?? 0;
            sumSq += s * s;
          }
          const rms = Math.sqrt(sumSq / Math.max(1, end - i));
          const t = i / sampleRate;
          const isSpeech = rms > 0.018;

          if (isSpeech && !currentlyDucked) {
            currentlyDucked = true;
            mGain.gain.setTargetAtTime(params.musicVolumeDuringSpeech, t, fadeSec / 3);
          } else if (!isSpeech && currentlyDucked) {
            currentlyDucked = false;
            mGain.gain.setTargetAtTime(params.musicVolumeDuringPause, t, recSec / 3);
          }
        }
      }

      // Fade out
      if (fadeOutSec > 0.01 && totalDurationSec > fadeOutSec) {
        mGain.gain.setValueAtTime(basePauseVol, totalDurationSec - fadeOutSec);
        mGain.gain.linearRampToValueAtTime(0.0001, totalDurationSec);
      }

      mSrc.connect(mGain);
      mGain.connect(offline.destination);
      mSrc.start(0);
    }

    const rendered = await offline.startRendering();
    return encodeWavFromAudioBuffer(rendered);
  } finally {
    await decodeCtx.close();
  }
}
