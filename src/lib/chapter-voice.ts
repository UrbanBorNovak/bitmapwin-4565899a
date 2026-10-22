// Procedural radio-voice dialogue + camera foley for chapter playback.
// Browser-only; every function is a no-op when audio APIs are missing.

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx ??= new C();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(a: AudioContext, secs: number) {
  const b = a.createBuffer(1, Math.ceil(a.sampleRate * secs), a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource(); s.buffer = b; return s;
}

/** Short radio squelch click (key-up / key-down). */
export function squelch(gain = 0.12) {
  const a = ac(); if (!a) return;
  const t = a.currentTime, n = noise(a, 0.09), bp = a.createBiquadFilter(), g = a.createGain();
  bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 1.2;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  const o = a.createOscillator(); o.type = "square"; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.05);
  const og = a.createGain(); og.gain.setValueAtTime(gain * 0.4, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  n.connect(bp).connect(g).connect(a.destination); o.connect(og).connect(a.destination);
  n.start(t); o.start(t); o.stop(t + 0.06);
}

/** Low-level radio hiss bed while a line is spoken; returns stop(). */
export function radioBed(secs: number): () => void {
  const a = ac(); if (!a) return () => {};
  const t = a.currentTime, n = noise(a, secs + 0.2), hp = a.createBiquadFilter(), lp = a.createBiquadFilter(), g = a.createGain();
  hp.type = "highpass"; hp.frequency.value = 900; lp.type = "lowpass"; lp.frequency.value = 3400;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.05); g.gain.setValueAtTime(0.025, t + secs); g.gain.linearRampToValueAtTime(0, t + secs + 0.15);
  n.connect(hp).connect(lp).connect(g).connect(a.destination); n.start(t);
  return () => { try { g.gain.cancelScheduledValues(a.currentTime); g.gain.setTargetAtTime(0, a.currentTime, 0.03); n.stop(a.currentTime + 0.1); } catch { /* already stopped */ } };
}

/** Camera move whoosh on a cut. */
export function whoosh(gain = 0.09) {
  const a = ac(); if (!a) return;
  const t = a.currentTime, n = noise(a, 0.7), bp = a.createBiquadFilter(), g = a.createGain();
  bp.type = "bandpass"; bp.Q.value = 2; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.35); bp.frequency.exponentialRampToValueAtTime(500, t + 0.7);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.3); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  n.connect(bp).connect(g).connect(a.destination); n.start(t);
}

/** Deep sub-bass impact (finale / build reveal). */
export function impact(gain = 0.35) {
  const a = ac(); if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.9);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 1.2);
}

/** Stable per-speaker voice: pitch/rate derived from the name. */
export function voiceFor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { pitch: 0.55 + (h % 100) / 100 * 1.0, rate: 0.95 + ((h >> 7) % 30) / 100, pick: h };
}

/** Speak a line as a radio transmission. Returns cancel(). */
export function speakRadio(text: string, speaker: string, maxSecs: number): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  const synth = window.speechSynthesis;
  synth.cancel();
  squelch();
  const stopBed = radioBed(Math.max(1, maxSecs - 0.2));
  const u = new SpeechSynthesisUtterance(text);
  const zh = /[\u4e00-\u9fff]/.test(text);
  if (zh) u.lang = "zh-CN";
  const v = voiceFor(speaker), voices = synth.getVoices().filter((x) => x.lang.startsWith(zh ? "zh" : "en"));
  if (voices.length) u.voice = voices[v.pick % voices.length] ?? null;
  // Speed up long lines so they finish before the subtitle leaves (~2.6 words/s at rate 1; ~2 Chinese characters per word).
  const words = zh ? Math.ceil(text.replace(/[^\u4e00-\u9fff]/g, "").length / 2) : text.trim().split(/\s+/).length;
  const fit = words / (2.6 * Math.max(0.8, maxSecs - 0.3));
  u.pitch = v.pitch; u.rate = Math.min(1.7, Math.max(v.rate, fit)); u.volume = 0.9;
  u.onend = () => { stopBed(); squelch(0.08); };
  synth.speak(u);
  return () => { synth.cancel(); stopBed(); };
}

export function stopAllVoice() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
