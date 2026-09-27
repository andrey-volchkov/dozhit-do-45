// Прогон игры в headless Chromium для плейтеста: печатает строки и варианты, кликает дальше.
//   node tools/play.mjs [url] [выборы 1,2,0 — 0 = молчание] [ширина] [высота] [тронуть на выдержке 0|1] [папка для скриншотов]
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const [,, url = 'http://localhost:8765/', picks = '1,1,1', w = '1280', h = '720', move = '0', dir = ''] = process.argv;
const choices = picks.split(',').map(Number);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url); await p.click('#btn-new');
const look = () => p.evaluate(() => ({
  lines: [...document.querySelectorAll('#text p')].map((x) => x.textContent),
  choices: [...document.querySelectorAll('#choices button')].map((x) => x.textContent),
  title: document.getElementById('title').hidden ? '' : document.getElementById('title').textContent,
  card: !!document.querySelector('.card'), start: !document.getElementById('start').hidden,
}));
let seen = new Set(), step = 0, n = 0;
const shot = async (tag) => dir && p.screenshot({ path: `${dir}/${String(n++).padStart(2, '0')}-${tag}.png` });
for (let i = 0; i < 600; i++) {
  await p.waitForTimeout(350);
  const s = await look();
  if (s.start && i > 5) break;
  if (s.title && !seen.has('T' + s.title)) { seen.add('T' + s.title); console.log(`\n== ${s.title} ==`); await shot('title'); }
  for (const l of s.lines) if (!seen.has(l)) { seen.add(l); console.log(l); }
  if (s.lines.at(-1) === 'Не шевелись.') { await shot('hold'); if (move === '1') await p.mouse.click(+w / 2, +h / 2); await p.waitForTimeout(5200); continue; }
  if (s.choices.length) {
    await p.waitForTimeout(900); await shot('choice');
    const c = choices[step++] ?? 1; console.log(`   > ${c ? s.choices[c - 1] : '(молчание)'}   [${s.choices.join(' | ')}]`);
    if (c) await p.locator('#choices button').nth(c - 1).click(); else await p.waitForTimeout(9500);
    continue;
  }
  if (s.card) { await p.waitForTimeout(1500); await shot('card'); }
  await p.mouse.click(+w / 2, +h / 3);
}
console.log('\nошибки страницы:', errs.length ? errs : 'нет'); await b.close();
