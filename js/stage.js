// Сцена: кадры, строки, межтитры, документы, плёнка.
const $ = (s) => document.querySelector(s);
const dock = $('#dock'), stage = $('#stage'), frame = $('#frame'), textEl = $('#text'), titleEl = $('#title'), docEl = $('#doc');
const EXT = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_LINES = 4;
let shotId = null;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function setEra(era) {
  document.body.className = document.body.className.replace(/\bera-\w+/g, '').trim() + ` era-${era}`;
}

// ---------- кадры ----------
function loadImg(id) {
  return new Promise((resolve) => {
    let i = 0; const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => (++i < EXT.length ? (img.src = `img/${id}.${EXT[i]}`) : resolve(null));
    img.src = `img/${id}.${EXT[0]}`;
  });
}
function frameLabel(id) {
  const m = id.match(/^ch(\d+)_(\d+)/); if (m) return `Кадр ${+m[1]}·${+m[2]}`;
  return id.startsWith('pro') ? 'Пролог' : id;
}
function swap(el) {
  const old = [...frame.children];
  frame.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  old.forEach((o) => { o.classList.remove('on'); setTimeout(() => o.remove(), 1700); });
}
export async function showImage(id, caption = '') {
  stage.classList.remove('cardmode');
  if (!id || id === 'none') { shotId = null; swap(document.createElement('div')); return; }
  if (id === shotId) return;
  shotId = id;
  const img = await loadImg(id);
  if (shotId !== id) return;
  const el = document.createElement('div'); el.className = 'shot';
  if (img) { img.alt = caption; el.append(img); }
  else {
    el.classList.add('plate');
    el.innerHTML = `<span class="lbl"></span><span class="cap"></span>`;
    el.querySelector('.lbl').textContent = frameLabel(id);
    el.querySelector('.cap').textContent = caption;
  }
  swap(el);
}

// ---------- карточка 1905 года ----------
// Два базовых кадра: ch01_01_group (без Сеньки) и ch01_01_group_senka (Сенька с краю, Лёвка отдельно на другом).
// Смаз, бант и бледнеющие фигуры — маски из img/masks.json, доли кадра [x, y, w, h].
let masks = null;
const DEFAULT_MASKS = {
  ch01_01_group: { levka: [0.05, 0.2, 0.2, 0.76], mitya: [0.27, 0.2, 0.2, 0.76], asya: [0.5, 0.23, 0.21, 0.73], varya: [0.74, 0.42, 0.17, 0.54], ribbon: [0.775, 0.6, 0.09, 0.09] },
  ch01_01_group_senka: { senka: [0.01, 0.12, 0.18, 0.85], mitya: [0.2, 0.2, 0.16, 0.76], asya: [0.37, 0.23, 0.17, 0.73], varya: [0.55, 0.42, 0.13, 0.54], ribbon: [0.58, 0.6, 0.07, 0.09], levka: [0.8, 0.2, 0.17, 0.76] },
};
const LIGHT = { asya: true }; // белое платье
function drawStandIn(w, h, M) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const bg = g.createRadialGradient(w * 0.5, h * 0.35, w * 0.1, w * 0.5, h * 0.5, w * 0.9);
  bg.addColorStop(0, '#a8977a'); bg.addColorStop(1, '#5c4d37'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(236,224,198,.22)'; g.lineWidth = w * 0.004; // нарисованная балюстрада
  g.strokeRect(w * 0.03, h * 0.47, w * 0.94, h * 0.018); g.strokeRect(w * 0.03, h * 0.66, w * 0.94, h * 0.014);
  for (let x = 0.05; x < 0.96; x += 0.042) { g.beginPath(); g.ellipse(w * x, h * 0.57, w * 0.011, h * 0.075, 0, 0, 7); g.stroke(); }
  g.beginPath(); g.ellipse(w * 0.5, h * 0.41, w * 0.045, h * 0.045, 0, 0, 7); g.stroke();
  g.fillStyle = 'rgba(40,32,22,.55)'; g.fillRect(0, h * 0.88, w, h * 0.12); // ковёр
  const f = document.createElement('canvas'); f.width = w; f.height = h; const q = f.getContext('2d');
  for (const [who, r] of Object.entries(M)) { // мягкие силуэты: голова, плечи, корпус
    if (who === 'ribbon') continue;
    const x = r[0] * w, y = r[1] * h, bw = r[2] * w, bh = r[3] * h, cx = x + bw / 2, L = LIGHT[who];
    q.fillStyle = L ? 'rgba(232,222,200,.92)' : 'rgba(34,27,19,.9)';
    q.beginPath(); q.ellipse(cx, y + bh * 0.07, bw * 0.2, bh * 0.065, 0, 0, 7); q.fill();
    q.beginPath(); q.moveTo(cx - bw * 0.1, y + bh * 0.13);
    q.quadraticCurveTo(cx - bw * 0.42, y + bh * 0.15, cx - bw * 0.4, y + bh * 0.3);
    q.lineTo(cx - bw * (L ? 0.48 : 0.34), y + bh * (L ? 0.78 : 0.62)); q.lineTo(cx - bw * 0.2, y + bh); q.lineTo(cx + bw * 0.2, y + bh);
    q.lineTo(cx + bw * (L ? 0.48 : 0.34), y + bh * (L ? 0.78 : 0.62)); q.lineTo(cx + bw * 0.4, y + bh * 0.3);
    q.quadraticCurveTo(cx + bw * 0.42, y + bh * 0.15, cx + bw * 0.1, y + bh * 0.13); q.closePath(); q.fill();
  }
  if (M.ribbon) { const [x, y, bw, bh] = M.ribbon; q.fillStyle = 'rgba(92,84,74,.95)'; q.beginPath(); q.ellipse((x + bw / 2) * w, (y + bh / 2) * h, bw * w / 2, bh * h / 2, 0, 0, 7); q.fill(); }
  g.filter = 'blur(5px)'; g.drawImage(f, 0, 0); g.filter = 'none';
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,245,225' : '20,15,10'},${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  return c;
}
export async function showCard(s) {
  shotId = 'card';
  const id = s.senka ? 'ch01_01_group_senka' : 'ch01_01_group';
  if (!masks) { try { masks = await (await fetch('img/masks.json')).json(); } catch { masks = {}; } }
  const M = { ...DEFAULT_MASKS[id], ...(masks[id] || {}) };
  const img = await loadImg(id);
  const W = 1200, H = 1500;
  const srcC = img || drawStandIn(W, H, M);
  const sw = img ? img.naturalWidth : W, sh = img ? img.naturalHeight : H;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const scale = Math.max(W / sw, H / sh), dw = sw * scale, dh = sh * scale, dx = (W - dw) / 2, dy = (H - dh) / 2;
  g.drawImage(srcC, 0, 0, sw, sh, dx, dy, dw, dh);
  const R = ([x, y, w, h]) => [dx + x * dw, dy + y * dh, w * dw, h * dh];
  if (s.moved && M.mitya) { // смаз: размытая копия фигуры со сдвигом
    const snap = document.createElement('canvas'); snap.width = W; snap.height = H; snap.getContext('2d').drawImage(c, 0, 0);
    const [x, y, w, h] = R(M.mitya);
    g.save(); g.beginPath(); g.rect(x - 14, y, w + 28, h); g.clip();
    g.filter = 'blur(7px)'; g.globalAlpha = 0.85; g.drawImage(snap, 0, 0); g.globalAlpha = 0.45;
    g.drawImage(snap, 10, 0); g.drawImage(snap, -8, 1); g.restore();
  }
  for (const who of s.gone || []) { // ушедшие бледнеют
    if (!M[who]) continue;
    const [x, y, w, h] = R(M[who]); const cx = x + w / 2, cy = y + h / 2;
    g.save(); g.translate(cx, cy); g.scale(w / h, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, h * 0.62);
    gr.addColorStop(0, 'rgba(226,214,188,.66)'); gr.addColorStop(0.7, 'rgba(226,214,188,.5)'); gr.addColorStop(1, 'rgba(226,214,188,0)');
    g.fillStyle = gr; g.fillRect(-h, -h, h * 2, h * 2); g.restore();
  }
  if (M.ribbon) { const [x, y, w, h] = R(M.ribbon); g.save(); g.globalCompositeOperation = 'color'; g.filter = 'blur(3px)'; g.fillStyle = 'rgba(150,24,18,.7)';
    g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); g.fill(); g.restore(); }
  const el = document.createElement('div'); el.className = 'shot card';
  el.innerHTML = '<div class="mount"></div>';
  const mount = el.firstChild; mount.append(c);
  const imp = document.createElement('div'); imp.className = 'imprint'; imp.textContent = 'Фотографія Н. И. Гринберга · Кіевъ, Подолъ'; mount.append(imp);
  stage.classList.add('cardmode');
  swap(el);
}

// ---------- текст ----------
export function clearText() { textEl.innerHTML = ''; dock.classList.remove('center'); }
export function line(text, { close = false, scrawl = false, pov = false } = {}) {
  if (close || scrawl) clearText();
  else if (dock.classList.contains('center')) clearText();
  const p = document.createElement('p');
  p.textContent = text;
  if (close) p.className = 'close'; if (scrawl) p.className = 'scrawl'; if (pov) p.classList.add('pov');
  [...textEl.children].forEach((o) => o.classList.add('old'));
  textEl.append(p);
  if (close || scrawl) dock.classList.add('center');
  while (textEl.children.length > MAX_LINES) textEl.firstChild.remove();
  requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('in')));
  return p;
}
export const lines = () => [...textEl.children].map((p) => p.textContent);

// ---------- межтитры, чернота, вспышка ----------
export function showTitle(t) {
  const [a, b] = t.split('::').map((x) => x.trim());
  titleEl.innerHTML = '<div class="t"></div>';
  const box = titleEl.firstChild;
  if (b) { const s = document.createElement('span'); s.className = 'small'; s.textContent = a; box.append(s); }
  const big = document.createElement('span'); big.className = 'big'; big.textContent = b || a; box.append(big);
  titleEl.hidden = false;
}
export function hideTitle() { titleEl.hidden = true; titleEl.innerHTML = ''; }
export function black(on) { stage.classList.toggle('black', on); if (on) clearText(); }
export function flash() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

// ---------- документы на машинке ----------
export function docOpen() { docEl.hidden = false; docEl.innerHTML = ''; }
export function docClose() { docEl.hidden = true; docEl.innerHTML = ''; }
export async function docType(text, onKey, fast = () => false) {
  const p = document.createElement('p'); docEl.append(p);
  for (const ch of text) { p.textContent += ch; if (ch.trim()) onKey(); if (!fast()) await sleep(ch === ' ' ? 30 : 42 + Math.random() * 40); }
}

// ---------- зерно ----------
export function startGrain() {
  const c = $('#grain'), g = c.getContext('2d');
  const frames = []; const W = 256, H = 256;
  for (let k = 0; k < 6; k++) { const d = g.createImageData(W, H); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } frames.push(d); }
  const resize = () => { c.width = Math.ceil(innerWidth / 2); c.height = Math.ceil(innerHeight / 2); };
  resize(); addEventListener('resize', resize);
  const tile = document.createElement('canvas'); tile.width = W; tile.height = H; const tg = tile.getContext('2d');
  let k = 0;
  const draw = () => {
    tg.putImageData(frames[k++ % frames.length], 0, 0);
    const pat = g.createPattern(tile, 'repeat'); g.save(); g.translate(-Math.random() * W, -Math.random() * H); g.fillStyle = pat; g.fillRect(0, 0, c.width + W, c.height + H); g.restore();
  };
  let last = 0;
  const loop = (t) => { if (!document.body.classList.contains('still') && t - last > 70) { draw(); last = t; } requestAnimationFrame(loop); };
  draw(); requestAnimationFrame(loop);
}
