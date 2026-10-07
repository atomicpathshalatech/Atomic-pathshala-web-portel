/**
 * Synthesizes a pleasant WhatsApp-style notification sound using the Web Audio API.
 * Requires no external audio files and works on all modern browsers.
 */
let audioCtx: AudioContext | null = null;

export function playWhatsAppDing(volume = 0.3) {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => null);
    }

    const now = audioCtx.currentTime;

    // Dual-tone chime: 880Hz (A5) followed immediately by 1760Hz (A6)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08); // D6

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1760, now + 0.04);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now + 0.04);

    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch {
    // Non-blocking
  }
}
