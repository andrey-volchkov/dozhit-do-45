// Прогон веток сюжета: транскрипты для редактора/плейтестера и проверка тупиков.
//   node tools/walk.mjs --from ch01 --path 1,2,3        один маршрут (номера вариантов с 1; остальное — первый вариант)
//   node tools/walk.mjs --from ch01 --sample 3 --seed 7 случайные маршруты
//   node tools/walk.mjs --from ch01 --check             перебор всех веток (выдержка тоже ветвится)
//   --set father=rail --set coins=2                      входное состояние
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { Story } = require('inkjs');
const json = readFileSync(new URL('../story.json', import.meta.url), 'utf8');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
let seed = +opt('seed', 1);
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function fresh() {
  const s = new Story(json);
  s.onError = (m, t) => { throw new Error(`${t}: ${m}`); };
  for (const kv of sets) {
    const [k, v] = kv.split('=');
    s.variablesState[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
  }
  const from = opt('from', null);
  if (from) s.ChoosePathString(from);
  return s;
}

const tagsOf = (s) => (s.currentTags || []).map((t) => t.trim());
const holdOf = (tags) => tags.find((t) => t.startsWith('hold'));

// Идёт до следующей развилки. pick(kind, options) → индекс.
function run(s, pick, out) {
  for (;;) {
    while (s.canContinue) {
      const text = s.Continue().trim();
      const tags = tagsOf(s);
      const title = tags.find((t) => t.startsWith('title'));
      if (title) out.push(`\n== ${title.replace(/^title:\s*/, '')} ==`);
      const img = tags.find((t) => t.startsWith('image'));
      if (img) out.push(`   [кадр ${img.replace(/^image:\s*/, '').split('::')[0].trim()}]`);
      if (text && text !== '@') out.push((tags.some((t) => t.startsWith('pov')) ? '  ~ ' : '') + text);
      const hold = holdOf(tags);
      if (hold) {
        const v = hold.split(':')[2].trim();
        const moved = pick('hold', ['не шевелился', 'пошевелился']) === 1;
        s.variablesState[v] = moved;
        out.push(`   [выдержка: ${moved ? 'пошевелился' : 'не шевелился'}]`);
      }
    }
    const ch = s.currentChoices;
    if (!ch.length) return;
    const labels = ch.map((c) => ((c.tags || []).includes('silent') ? '(молчание)' : c.text));
    const i = pick('choice', labels);
    out.push(`   > ${labels[i]}${labels.length > 1 ? `   [другие: ${labels.filter((_, j) => j !== i).join(' | ')}]` : ''}`);
    s.ChooseChoiceIndex(i);
  }
}

if (args.includes('--check')) {
  let paths = 0; const ends = new Map();
  const dfs = (stateJson, prefix) => {
    const s = fresh(); if (stateJson) s.state.LoadJson(stateJson);
    const forks = [];
    let depth = 0;
    const pick = (kind, opts) => {
      if (depth < prefix.length) return prefix[depth++];
      forks.push(opts.length); depth++; return 0;
    };
    // Детерминированный повтор с префиксом, затем разворачиваем развилки.
    const out = [];
    try { run(s, pick, out); } catch (e) { console.error('ОШИБКА на пути', prefix.join(','), e.message); process.exitCode = 1; return; }
    if (!forks.length) {
      paths++; const last = out.filter((l) => !l.startsWith('   ')).slice(-1)[0] || '';
      ends.set(last, (ends.get(last) || 0) + 1); return;
    }
    // Первая новая развилка: перебрать все варианты.
    for (let k = 0; k < forks[0]; k++) dfs(null, [...prefix, k]);
  };
  dfs(null, []);
  console.log(`Путей: ${paths}. Последние строки путей:`);
  for (const [l, n] of ends) console.log(`  ${n} × ${l}`);
} else {
  const n = +opt('sample', 0);
  const path = (opt('path', '') || '').split(',').filter(Boolean).map((x) => +x - 1);
  for (let r = 0; r < Math.max(1, n); r++) {
    let d = 0;
    const pick = (kind, opts) => (n ? Math.floor(rnd() * opts.length) : Math.min(path[d++] ?? 0, opts.length - 1));
    const out = [];
    run(fresh(), pick, out);
    console.log(`\n######## Маршрут ${r + 1} ########\n` + out.join('\n'));
  }
}
