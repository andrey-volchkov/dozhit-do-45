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
// Базовый кадр ch01_01_group (или нарисованная замена) + маски из img/masks.json.
let masks = null;
const DEFAULT_MASKS = {
  senka: [0.02, 0.12, 0.22, 0.85], mitya: [0.24, 0.2, 0.17, 0.76], levka: [0.41, 0.2, 0.17, 0.76],
  varya: [0.58, 0.42, 0.14, 0.55], ribbon: [0.61, 0.6, 0.08, 0.1], asya: [0.73, 0.24, 0.22, 0.72],
};
function drawStandIn(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#9c8b6b'); bg.addColorStop(1, '#6a5a41'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(235,222,195,.35)'; g.lineWidth = w * 0.004; // нарисованная балюстрада
  g.strokeRect(w * 0.04, h * 0.5, w * 0.92, h * 0.02); g.strokeRect(w * 0.04, h * 0.7, w * 0.92, h * 0.015);
  for (let x = 0.06; x < 0.95; x += 0.045) { g.beginPath(); g.ellipse(w * x, h * 0.61, w * 0.012, h * 0.08, 0, 0, 7); g.stroke(); }
  g.beginPath(); g.ellipse(w * 0.5, h * 0.44, w * 0.05, h * 0.05, 0, 0, 7); g.stroke();
  g.fillStyle = '#3f3426'; g.fillRect(0, h * 0.86, w, h * 0.14); // ковёр
  const fig = (cx, top, bw, tone) => { g.fillStyle = tone; g.beginPath(); g.ellipse(w * cx, h * (top + 0.05), w * bw * 0.33, h * 0.052, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(w * (cx - bw * 0.35), h * (top + 0.1)); g.lineTo(w * (cx + bw * 0.35), h * (top + 0.1)); g.lineTo(w * (cx + bw * 0.5), h * 0.95); g.lineTo(w * (cx - bw * 0.5), h * 0.95); g.fill(); };
  fig(0.13, 0.14, 0.17, '#241d15'); fig(0.325, 0.24, 0.13, '#2b2319'); fig(0.495, 0.24, 0.13, '#2b2319'); fig(0.65, 0.45, 0.1, '#2e251a'); fig(0.84, 0.29, 0.15, '#cfc3a8');
  g.fillStyle = '#6d6252'; g.fillRect(w * 0.625, h * 0.63, w * 0.05, h * 0.06); // бант
  return c;
}
export async function showCard(s) {
  shotId = 'card';
  if (!masks) { try { masks = (await (await fetch('img/masks.json')).json()).ch01_01_group; } catch { masks = DEFAULT_MASKS; } }
  const M = { ...DEFAULT_MASKS, ...masks };
  const img = await loadImg('ch01_01_group');
  const W = 1200, H = 1500;
  const srcC = img || drawStandIn(W, H);
  const sw = img ? img.naturalWidth : W, sh = img ? img.naturalHeight : H;
  const cut = s.senka ? 0 : M.senka[0] + M.senka[2];           // без Сеньки кадр обрезан слева
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const sx = cut * sw, sW = sw - sx;
  const scale = Math.max(W / sW, H / sh), dw = sW * scale, dh = sh * scale, dx = (W - dw) / 2, dy = (H - dh) / 2;
  g.drawImage(srcC, sx, 0, sW, sh, dx, dy, dw, dh);
  const R = ([x, y, w, h]) => [dx + ((x - cut) / (1 - cut)) * dw, dy + y * dh, (w / (1 - cut)) * dw, h * dh];
  if (s.moved) { // смаз: размытая копия фигуры со сдвигом
    const [x, y, w, h] = R(M.mitya);
    g.save(); g.beginPath(); g.rect(x - 12, y, w + 24, h); g.clip();
    g.filter = 'blur(7px)'; g.globalAlpha = 0.85; g.drawImage(c, 0, 0); g.globalAlpha = 0.45;
    g.drawImage(c, 9, 0); g.drawImage(c, -7, 1); g.restore();
  }
  for (const who of s.gone || []) { // ушедшие бледнеют
    const [x, y, w, h] = R(M[who]); const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(226,214,188,0)'); gr.addColorStop(0.2, 'rgba(226,214,188,.62)'); gr.addColorStop(0.8, 'rgba(226,214,188,.62)'); gr.addColorStop(1, 'rgba(226,214,188,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  { const [x, y, w, h] = R(M.ribbon); g.save(); g.globalCompositeOperation = 'color'; g.fillStyle = 'rgba(190,30,22,.9)';
    g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); g.fill(); g.restore(); }
  const el = document.createElement('div'); el.className = 'shot card';
  el.innerHTML = '<div class="mount"></div>';
  const mount = el.firstChild; mount.append(c);
  const imp = document.createElement('div'); imp.className = 'imprint'; imp.textContent = 'Фотографія Н. И. Гринберга · Кіевъ, Подолъ'; mount.append(imp);
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
