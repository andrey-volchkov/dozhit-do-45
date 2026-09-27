// Звук: синтез Web Audio. Если в audio/manifest.json есть id, играет запись из audio/<id>.mp3.
let ctx, master, ambBus, sfxBus, verbIn, white, brown;
let current = null;          // текущий эмбиент {id, stop}
let muted = false;
let files = new Set();
let collector = null;       // источники текущего эмбиента, чтобы их остановить
const bufs = {};

const R = (a, b) => a + Math.random() * (b - a);
const now = () => ctx.currentTime;

export async function initAudio() {
  if (ctx) { if (ctx.state !== 'running') await ctx.resume(); return; }
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);
  ambBus = gain(1, master); sfxBus = gain(1, master);
  // Синтетическое пространство: затухающий шум вместо импульсного отклика.
  const verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.6;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  verb.buffer = ir; verbIn = gain(0.35, verb); verb.connect(master);
  white = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  brown = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const w = white.getChannelData(0), b = brown.getChannelData(0); let last = 0;
  for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
  for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
  try { const r = await fetch('audio/manifest.json'); if (r.ok) files = new Set(await r.json()); } catch {}
  await ctx.resume();
}

export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, now(), 0.05); }
export const isMuted = () => muted;

// ---------- строительные блоки ----------
function gain(v, dest) { const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }
function filt(type, f, q = 0.7, dest) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; if (dest) n.connect(dest); return n; }
function src(buf, loop = true) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; if (loop) s.loopStart = 0; return s; }
function pan(p, dest) { const n = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (n.pan) n.pan.value = p; n.connect(dest); return n; }
// Короткий шумовой удар: фильтр, громкость, длительность, задержка.
function hit(dest, { type = 'bandpass', f = 1000, q = 1, v = 0.3, a = 0.001, d = 0.05, t = 0, verb = 0 } = {}) {
  const s = src(white, false), g = gain(0), n = filt(type, f, q);
  s.connect(n).connect(g).connect(dest); if (verb) g.connect(gain(verb, verbIn));
  const T = now() + t; g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v, T + a); g.gain.exponentialRampToValueAtTime(0.0001, T + a + d);
  s.start(T, Math.random()); s.stop(T + a + d + 0.05);
}
function tone(dest, { f = 440, f2, type = 'sine', v = 0.2, a = 0.002, d = 0.3, t = 0, verb = 0 } = {}) {
  const o = ctx.createOscillator(), g = gain(0); o.type = type; o.connect(g).connect(dest); if (verb) g.connect(gain(verb, verbIn));
  const T = now() + t; o.frequency.setValueAtTime(f, T); if (f2) o.frequency.exponentialRampToValueAtTime(f2, T + a + d);
  g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v, T + a); g.gain.exponentialRampToValueAtTime(0.0001, T + a + d);
  o.start(T); o.stop(T + a + d + 0.05);
}
// Постоянный шум через фильтр, с медленным «дыханием» громкости.
function bed(out, buf, type, f, q, v, lfo = 0, depth = 0) {
  const s = src(buf), g = gain(v); s.connect(filt(type, f, q)).connect(g).connect(out); s.start(0, Math.random() * 2);
  if (collector) collector.push(s);
  if (lfo) { const o = ctx.createOscillator(), og = gain(v * depth); o.frequency.value = lfo; o.connect(og).connect(g.gain); o.start(); if (collector) collector.push(o); }
  return s;
}
// Случайно повторяющееся событие; возвращает функцию остановки.
function every(min, max, fn) { let on = true, id; const loop = () => { if (!on) return; fn(); id = setTimeout(loop, R(min, max)); }; id = setTimeout(loop, R(0, max)); return () => { on = false; clearTimeout(id); }; }

// ---------- голоса ----------
const tick = (out, v = 0.12, hi = true) => hit(out, { f: hi ? 3200 : 2400, q: 6, v, d: 0.012 });
const crackle = (out, v = 0.05) => hit(out, { f: R(1800, 5200), q: 2, v: R(v * 0.3, v), d: R(0.003, 0.012) });
function voices(out, n, lo, hi, v, rate) { for (let i = 0; i < n; i++) bed(out, white, 'bandpass', R(lo, hi), R(2.5, 6), v, R(rate * 0.3, rate), 0.9); }
function heart(out, v = 0.3) { tone(out, { f: 62, f2: 40, v, d: 0.16 }); tone(out, { f: 55, f2: 38, v: v * 0.7, d: 0.14, t: 0.27 }); }
function chirp(out, v = 0.05) { const n = Math.floor(R(1, 4)); for (let i = 0; i < n; i++) tone(out, { f: R(3600, 5200), f2: R(2400, 3200), v, d: R(0.04, 0.09), t: i * R(0.07, 0.12) }); }

const AMB = {
  office(o) { const h = ctx.createOscillator(); h.frequency.value = 50; const hg = gain(0.012, o); h.connect(hg); h.start(); collector.push(h);
    bed(o, brown, 'lowpass', 220, 0.7, 0.05); return [every(1000, 1000, () => tick(o, 0.05))]; },
  atelier(o) { bed(o, brown, 'lowpass', 180, 0.7, 0.07); bed(o, brown, 'lowpass', 600, 0.7, 0.02);
    let tt = true; return [every(90, 650, () => crackle(o, 0.05)), every(1000, 1000, () => tick(o, 0.06, (tt = !tt)))]; },
  street(o) { bed(o, brown, 'lowpass', 700, 0.7, 0.09); voices(o, 4, 350, 900, 0.018, 0.6); return []; },
  crowd(o) { bed(o, brown, 'lowpass', 320, 0.7, 0.16); voices(o, 9, 260, 1500, 0.035, 1.6);
    return [every(3500, 8000, () => swell(o, 0.12))]; },
  panic(o) { bed(o, brown, 'lowpass', 400, 0.7, 0.2); voices(o, 10, 500, 2200, 0.05, 4.5);
    return [every(60, 160, () => hit(o, { type: 'lowpass', f: 300, v: R(0.05, 0.14), d: 0.05 })), every(1500, 3500, () => swell(o, 0.18))]; },
  home(o) { bed(o, brown, 'lowpass', 150, 0.7, 0.04); let tt = true; return [every(1000, 1000, () => tick(o, 0.07, (tt = !tt)))]; },
  riot(o) { const f = filt('lowpass', 1100, 0.7, o); bed(f, brown, 'lowpass', 300, 0.7, 0.14); voices(f, 8, 300, 1300, 0.03, 2);
    return [every(40, 260, () => crackle(o, 0.035)), every(2500, 7000, () => glass(o, 0.25)), every(3000, 9000, () => swell(f, 0.1))]; },
  darkroom(o) { bed(o, brown, 'lowpass', 120, 0.7, 0.03); const f = filt('lowpass', 420, 0.7, o); bed(f, brown, 'lowpass', 300, 0.7, 0.07); voices(f, 5, 300, 900, 0.02, 2);
    return [every(880, 950, () => heart(o, 0.28))]; },
  dawn(o) { bed(o, brown, 'lowpass', 300, 0.7, 0.025); bed(o, white, 'bandpass', 500, 0.5, 0.012, 0.08, 0.8); return [every(600, 2600, () => chirp(o, 0.04))]; },
};

function swell(o, v) { const s = src(white, false), n = filt('lowpass', 300, 0.7), g = gain(0); s.connect(n).connect(g).connect(o);
  const T = now(); n.frequency.setValueAtTime(300, T); n.frequency.exponentialRampToValueAtTime(1700, T + 0.9); n.frequency.exponentialRampToValueAtTime(500, T + 2.4);
  g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(v, T + 0.7); g.gain.linearRampToValueAtTime(0, T + 2.6); s.start(T, Math.random()); s.stop(T + 2.7); }
function glass(o, v = 0.7) { hit(o, { type: 'highpass', f: 1400, v, d: 0.5, verb: 0.3 }); hit(o, { type: 'lowpass', f: 200, v: v * 0.5, d: 0.2 });
  for (let i = 0; i < 26; i++) tone(o, { f: R(1900, 7600), v: R(0.01, 0.05) * v, d: R(0.12, 0.9), t: R(0, 0.75) * (i > 8 ? 1 : 0.2) }); }

const SFX = {
  lamp(o) { hit(o, { type: 'highpass', f: 2000, v: 0.5, d: 0.006 }); hit(o, { type: 'highpass', f: 1600, v: 0.3, d: 0.006, t: 0.07 }); tone(o, { f: 110, v: 0.1, d: 0.04 }); },
  paper(o) { const s = src(white, false), n = filt('bandpass', 2400, 0.8), g = gain(0); s.connect(n).connect(g).connect(o); const T = now();
    n.frequency.linearRampToValueAtTime(3400, T + 0.5); g.gain.linearRampToValueAtTime(0.14, T + 0.15); g.gain.linearRampToValueAtTime(0, T + 0.55); s.start(T); s.stop(T + 0.6); },
  doorbell(o) { [0, 0.11, 0.27].forEach((t, k) => [2093, 2690, 3322, 4230].forEach((f) => tone(o, { f: f * R(0.995, 1.005), v: 0.035 / (k + 1) * R(0.6, 1), d: 0.9, t, verb: 0.2 }))); },
  whistle(o) { [[2500, 3400, 0], [2700, 3700, 0.2]].forEach(([a, b, t]) => { tone(o, { f: a, f2: b, v: 0.09, a: 0.02, d: 0.12, t });
    tone(o, { f: b, f2: b * 0.86, v: 0.07, a: 0.005, d: 0.1, t: t + 0.13 }); }); hit(o, { type: 'highpass', f: 4000, v: 0.02, d: 0.3 }); },
  cap(o) { hit(o, { f: 1200, q: 2, v: 0.25, d: 0.008 }); tone(o, { f: 180, v: 0.12, d: 0.04 }); },
  roar(o) { swell(o, 0.4); hit(o, { type: 'lowpass', f: 900, v: 0.2, a: 0.4, d: 1.8 }); },
  volley(o) { for (let i = 0; i < 6; i++) { const t = R(0, 0.28); hit(o, { type: 'highpass', f: 150, v: 0.9, d: 0.12, t, verb: 0.7 }); tone(o, { f: 70, f2: 32, v: 0.45, d: 0.3, t, verb: 0.4 }); } },
  hooves(o) { const p = pan(-0.6, o); if (p.pan) p.pan.linearRampToValueAtTime(0.6, now() + 2.6);
    for (let k = 0; k < 8; k++) for (let j = 0; j < 3; j++) { const t = k * 0.34 + j * 0.1, v = 0.35 * Math.sin(Math.PI * (k + 0.5) / 8);
      hit(p, { type: 'lowpass', f: 420, v, d: 0.06, t }); tone(p, { f: 90, v: v * 0.6, d: 0.05, t }); } },
  whip(o) { const s = src(white, false), n = filt('bandpass', 700, 3), g = gain(0); s.connect(n).connect(g).connect(o); const T = now();
    n.frequency.exponentialRampToValueAtTime(5000, T + 0.09); g.gain.linearRampToValueAtTime(0.35, T + 0.08); g.gain.linearRampToValueAtTime(0, T + 0.1); s.start(T); s.stop(T + 0.12);
    hit(o, { type: 'highpass', f: 2500, v: 0.9, d: 0.004, t: 0.095, verb: 0.3 }); },
  door(o) { tone(o, { f: 72, v: 0.4, d: 0.25 }); hit(o, { type: 'lowpass', f: 500, v: 0.25, d: 0.08 }); hit(o, { type: 'highpass', f: 2500, v: 0.25, d: 0.004, t: 0.05 }); },
  door_open(o) { const w = ctx.createOscillator(), n = filt('bandpass', 900, 9), g = gain(0); w.type = 'sawtooth'; w.connect(n).connect(g).connect(o); const T = now();
    w.frequency.setValueAtTime(160, T); w.frequency.linearRampToValueAtTime(240, T + 0.7); g.gain.linearRampToValueAtTime(0.05, T + 0.1); g.gain.linearRampToValueAtTime(0, T + 0.75); w.start(T); w.stop(T + 0.8);
    hit(o, { type: 'highpass', f: 2200, v: 0.3, d: 0.004 }); },
  handle(o) { hit(o, { type: 'highpass', f: 2000, v: 0.3, d: 0.005 }); tone(o, { f: 1250, f2: 900, v: 0.03, d: 0.14, t: 0.02 }); hit(o, { type: 'highpass', f: 2600, v: 0.25, d: 0.004, t: 0.2 }); },
  glass(o) { glass(o, 0.8); },
  crunch(o) { for (let i = 0; i < 70; i++) hit(o, { type: 'highpass', f: R(2200, 5000), v: R(0.03, 0.14), d: R(0.002, 0.008), t: R(0, 2.2) }); },
  crack(o) { hit(o, { type: 'highpass', f: 1500, v: 0.8, d: 0.004 }); tone(o, { f: 320, v: 0.25, d: 0.03 }); },
  steps(o) { for (let k = 0; k < 4; k++) { tone(o, { f: 80, v: 0.18, d: 0.07, t: k * 0.55 }); for (let i = 0; i < 6; i++) hit(o, { type: 'highpass', f: 3000, v: R(0.03, 0.08), d: 0.004, t: k * 0.55 + R(0, 0.12) }); } },
  type(o) { hit(o, { f: 3000, q: 1.5, v: 0.22, d: 0.004 }); tone(o, { f: 130, v: 0.08, d: 0.02 }); },
  bell(o) { tone(o, { f: 2600, v: 0.07, d: 1.1, verb: 0.2 }); tone(o, { f: 3900, v: 0.03, d: 0.8 }); },
  tick(o) { hit(o, { f: 2900, q: 5, v: 0.09, d: 0.01 }); tone(o, { f: 1400, v: 0.02, d: 0.02 }); },
  seeds(o) { [0, 0.09, 0.9, 1.0, 2.1].forEach((t) => hit(o, { type: 'highpass', f: 2600, v: 0.12, d: 0.004, t })); },
  knock(o) { [0, 0.42, 0.84].forEach((t) => { tone(o, { f: 85, f2: 60, v: 0.5, d: 0.16, t }); hit(o, { type: 'lowpass', f: 700, v: 0.3, d: 0.05, t }); }); },
  flash(o) { swell(o, 0.25); for (let i = 0; i < 20; i++) crackle(o, 0.12); },
};

// ---------- записи ----------
async function buffer(id) {
  if (!bufs[id]) bufs[id] = fetch(`audio/${id}.mp3`).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a));
  return bufs[id];
}

// ---------- публичное ----------
export function amb(id) {
  if (!ctx) return;
  if (current && current.id === id) return;
  if (current) current.stop(1.6);
  current = null;
  if (!id || id === 'none') return;
  const out = gain(0, ambBus); out.gain.setTargetAtTime(1, now(), 0.6);
  let stops = []; const live = [];
  if (files.has(id)) buffer(id).then((b) => { const s = src(b); s.connect(out); s.start(); stops.push(() => s.stop()); }).catch(() => {});
  else if (AMB[id]) { collector = live; stops = AMB[id](out) || []; collector = null; }
  current = { id, stop(fade = 1.2) { out.gain.setTargetAtTime(0, now(), fade / 4); setTimeout(() => { stops.forEach((f) => f()); live.forEach((n) => { try { n.stop(); } catch {} }); out.disconnect(); }, fade * 1000 + 200); } };
}

export function sfx(id) {
  if (!ctx) return;
  sfxBus.gain.cancelScheduledValues(now()); sfxBus.gain.setValueAtTime(1, now());
  if (files.has(id)) buffer(id).then((b) => { const s = src(b, false); s.connect(sfxBus); s.start(); }).catch(() => {});
  else if (SFX[id]) SFX[id](sfxBus);
}

// Тишина: всё обрывается разом.
export function silence() {
  if (!ctx) return;
  if (current) current.stop(0.05);
  current = null;
  sfxBus.gain.setTargetAtTime(0, now(), 0.01);
}
