// Кинопроектор: читает Ink и превращает теги в монтаж.
import * as S from './stage.js';
import * as A from './audio.js';

const KEY = 'vyderzhka.save.v1';
const sleep = S.sleep;

export function readSave() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
export function dropSave() { try { localStorage.removeItem(KEY); } catch {} }

function parseTags(raw) {
  const T = {};
  for (const t of raw || []) { const i = t.indexOf(':'); const k = (i < 0 ? t : t.slice(0, i)).trim(); T[k] = i < 0 ? '' : t.slice(i + 1).trim(); }
  return T;
}

export class Player {
  constructor(json) {
    this.story = new inkjs.Story(json);
    this.st = { era: 'silent', image: null, caption: '', amb: null, pov: false, chapter: 0 };
    this.pendingTimer = 0;
    this.waiter = null; this.shownAt = 0; this.holdHook = null; this.choiceKeys = null;
    this.onEnd = () => {};
    const input = (e) => {
      if (this.holdHook) { this.holdHook(); return; }
      if (e.type === 'keydown') {
        if (this.choiceKeys && /^[1-9]$/.test(e.key)) { this.choiceKeys(+e.key - 1); return; }
        if (![' ', 'Enter', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
      } else if (e.target.closest('button')) return;
      if (this.waiter && performance.now() - this.shownAt > this.waiter.min) { const w = this.waiter; this.waiter = null; w.resolve(); }
    };
    document.getElementById('stage').addEventListener('pointerdown', input);
    addEventListener('keydown', (e) => { if (!document.getElementById('menu').hidden || e.key === 'Escape') return; input(e); });
  }

  waitAdvance(min = 250) { this.shownAt = performance.now(); return new Promise((resolve) => (this.waiter = { resolve, min })); }

  async run() {
    const s = this.story;
    for (;;) {
      if (s.canContinue) {
        const text = s.Continue().trim();
        const choicesNext = !s.canContinue && s.currentChoices.length > 0;
        await this.play(text, parseTags(s.currentTags), choicesNext);
      } else if (s.currentChoices.length) await this.choose();
      else return this.finish();
    }
  }

  async play(text, T, choicesNext) {
    if ('era' in T) { S.setEra(T.era); this.st.era = T.era; }
    if ('chapter' in T) this.st.chapter = +T.chapter;
    if ('pov' in T) this.st.pov = T.pov !== 'off';
    if ('silence' in T) { A.silence(); this.st.amb = null; }
    if ('black' in T) { S.black(true); await sleep(+T.black || 1200); S.black(false); }
    if ('title' in T) {
      S.clearText(); S.showTitle(T.title);
      await ('auto' in T ? sleep(+T.auto) : this.waitAdvance(900));
      S.hideTitle();
    }
    if ('image' in T) { const [id, cap = ''] = T.image.split('::').map((x) => x.trim()); S.clearText(); S.showImage(id, cap); this.st.image = id; this.st.caption = cap; }
    if ('card' in T) { S.clearText(); S.showCard(this.cardState()); this.st.image = 'card'; }
    if ('amb' in T) { A.amb(T.amb); this.st.amb = T.amb === 'none' ? null : T.amb; }
    if ('sfx' in T) A.sfx(T.sfx);
    if ('flash' in T) S.flash();
    if ('clear' in T) S.clearText();
    if ('save' in T) this.save();
    if ('pause' in T) await sleep(+T.pause);
    if ('timer' in T) this.pendingTimer = +T.timer;

    const show = text && text !== '@';
    if (show && 'doc' in T) {
      if (document.getElementById('doc').hidden) S.docOpen();
      let fast = false; this.holdHook = () => (fast = true);
      await S.docType(text, () => A.sfx('type'), () => fast);
      this.holdHook = null;
      if (!choicesNext) await ('auto' in T ? sleep(+T.auto) : this.waitAdvance());
      return;
    }
    if (show) S.line(text, { close: 'close' in T, scrawl: 'scrawl' in T, pov: this.st.pov });
    if ('hold' in T) return this.hold(T.hold);
    if (choicesNext) return;
    if (show) await ('auto' in T ? sleep(+T.auto) : this.waitAdvance());
    else if ('card' in T) await this.waitAdvance(2500);
    else if ('auto' in T && !('title' in T)) await sleep(+T.auto);
  }

  // Выдержка: пока открыт объектив, любое касание засчитывается как «пошевелился».
  async hold(v) {
    const [sec, name] = v.split(':').map((x) => x.trim());
    this.holdHook = () => {};
    await sleep(700);                         // клик по прошлой строке не считается
    let moved = false;
    this.holdHook = () => (moved = true);
    await sleep(+sec * 1000);
    this.holdHook = null;
    this.story.variablesState[name] = moved;
  }

  choose() {
    const s = this.story, all = s.currentChoices;
    const silent = all.findIndex((c) => (c.tags || []).includes('silent'));
    const timer = silent >= 0 ? this.pendingTimer : 0;
    this.pendingTimer = 0;
    if (timer) this.save({ pendingSilent: true });   // перезагрузка посреди таймера = молчание
    const box = document.getElementById('choices'), fuse = document.getElementById('fuse');
    return new Promise((resolve) => {
      let done = false, tid;
      const pick = (i) => {
        if (done || i == null || i < 0) return; done = true;
        clearTimeout(tid); if (this.timerCtl) this.timerCtl.stop(); this.timerCtl = null; this.choiceKeys = null;
        box.innerHTML = ''; fuse.classList.remove('on');
        const bar = fuse.firstElementChild; bar.style.transition = 'none'; bar.style.transform = 'none';
        S.clearText();
        s.ChooseChoiceIndex(i); this.save();
        resolve();
      };
      const visible = all.map((c, i) => ({ c, i })).filter((x) => x.i !== silent);
      document.querySelectorAll('#text p').forEach((p) => p.classList.add('old'));
      document.querySelectorAll('#text p:last-child').forEach((p) => p.classList.remove('old'));
      visible.forEach(({ c, i }, n) => {
        const b = document.createElement('button'); b.textContent = c.text; b.style.animationDelay = `${n * 0.18}s`;
        b.addEventListener('click', () => pick(i)); box.append(b);
      });
      this.choiceKeys = (n) => visible[n] && pick(visible[n].i);
      if (timer) {
        // Таймер: тлеющая линия и тиканье. Меню ставит его на паузу (pauseTimer/resumeTimer).
        const bar = fuse.firstElementChild;
        let left = timer * 1000, started = performance.now(), ticker = 0;
        const run = () => {
          started = performance.now();
          bar.style.transition = `transform ${left / 1000}s linear`; bar.style.transform = 'scaleX(0)';
          tid = setTimeout(() => pick(silent), left);
          ticker = setInterval(() => A.sfx('tick'), left < 2500 ? 250 : 500);
        };
        const stop = () => { clearTimeout(tid); clearInterval(ticker); };
        bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)'; fuse.classList.add('on');
        requestAnimationFrame(() => requestAnimationFrame(run));
        let paused = false;
        this.timerCtl = {
          pause: () => { if (paused) return; paused = true; stop(); left = Math.max(0, left - (performance.now() - started));
            bar.style.transition = 'none'; bar.style.transform = `scaleX(${left / (timer * 1000)})`; },
          resume: () => { if (!paused) return; paused = false; run(); },
          stop,
        };
      }
    });
  }

  pauseTimer() { if (this.timerCtl) this.timerCtl.pause(); }
  resumeTimer() { if (this.timerCtl) this.timerCtl.resume(); }

  cardState() {
    const v = this.story.variablesState;
    return { senka: !!v.senka_in_photo, moved: !!v.moved_1905, gone: v.asya_gone ? ['asya'] : [] };
  }

  save(extra = {}) {
    const data = { v: 1, state: this.story.state.ToJson(), st: this.st, lines: S.lines(), pendingSilent: !!extra.pendingSilent, t: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }

  load(data) {
    this.story.state.LoadJson(data.state);
    this.st = { ...this.st, ...data.st };
    S.setEra(this.st.era);
    if (this.st.image === 'card') S.showCard(this.cardState());
    else if (this.st.image) S.showImage(this.st.image, this.st.caption);
    if (this.st.amb) A.amb(this.st.amb);
    (data.lines || []).forEach((l) => S.line(l));
    if (data.pendingSilent) {
      const i = this.story.currentChoices.findIndex((c) => (c.tags || []).includes('silent'));
      if (i >= 0) { S.clearText(); this.story.ChooseChoiceIndex(i); this.save(); }
    }
  }

  finish() {
    A.amb('none');
    dropSave();
    this.onEnd(this.story.variablesState.ending || '');
  }
}
