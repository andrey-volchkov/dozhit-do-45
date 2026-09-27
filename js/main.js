// Старт, меню, архив жизней.
import { Player, readSave, dropSave } from './player.js';
import * as A from './audio.js';
import { startGrain } from './stage.js';

const $ = (s) => document.querySelector(s);
const ARCH = 'vyderzhka.archive.v1', PREFS = 'vyderzhka.prefs.v1';
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const prefs = get(PREFS, { muted: false, still: matchMedia('(prefers-reduced-motion: reduce)').matches });
A.setMuted(prefs.muted);
document.body.classList.toggle('still', prefs.still);
startGrain();

const storyJson = fetch('story.json').then((r) => r.text());
const start = $('#start'), menu = $('#menu'), menuBtn = $('#menu-btn');

function paintStart() {
  $('#btn-continue').hidden = !readSave();
  const arch = get(ARCH, []);
  $('#btn-archive').hidden = !arch.length;
  $('#btn-archive').textContent = `Архив жизней (${arch.length})`;
  const ol = $('#archive'); ol.innerHTML = '';
  for (const a of arch) { const li = document.createElement('li'); li.textContent = a; ol.append(li); }
  start.classList.remove('off'); start.hidden = false; menuBtn.hidden = true;
}

async function begin(resume) {
  await A.initAudio();
  const player = new Player(await storyJson);
  if (resume) player.load(resume); else dropSave();
  player.onEnd = (ending) => {
    if (ending) put(ARCH, [...get(ARCH, []), ending]);
    setTimeout(paintStart, 1200);
  };
  start.classList.add('off'); setTimeout(() => (start.hidden = true), 1400);
  menuBtn.hidden = false;
  player.run();
}

$('#btn-new').onclick = () => begin(null);
$('#btn-continue').onclick = () => begin(readSave());
$('#btn-archive').onclick = () => { $('#archive').hidden = !$('#archive').hidden; };

function paintMenu() {
  menu.querySelector('[data-act=sound]').textContent = `Звук: ${prefs.muted ? 'выкл' : 'вкл'}`;
  menu.querySelector('[data-act=motion]').textContent = `Движение: ${prefs.still ? 'выкл' : 'вкл'}`;
}
const toggleMenu = (on = menu.hidden) => { paintMenu(); menu.hidden = !on; };
menuBtn.onclick = () => toggleMenu(true);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && start.hidden) toggleMenu(); });
menu.addEventListener('click', (e) => {
  const act = e.target.dataset.act;
  if (act === 'sound') { prefs.muted = !prefs.muted; A.setMuted(prefs.muted); }
  if (act === 'motion') { prefs.still = !prefs.still; document.body.classList.toggle('still', prefs.still); }
  if (act === 'restart') { dropSave(); location.reload(); }
  if (act === 'close') return toggleMenu(false);
  put(PREFS, prefs); paintMenu();
});

paintStart();
