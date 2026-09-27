// Компиляция story/main.ink → story.json и проверка тегов.
// Запуск: node tools/build.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { Compiler, CompilerOptions } = require('inkjs/full');
const { PosixFileHandler } = require('inkjs/compiler/FileHandler/PosixFileHandler');

const ROOT = new URL('..', import.meta.url).pathname;
const STORY = join(ROOT, 'story');

// Все теги, которые понимает движок (js/player.js). Новый тег — сначала сюда.
const KNOWN = new Set([
  'era', 'title', 'black', 'pause', 'image', 'card', 'close', 'clear', 'auto',
  'amb', 'sfx', 'silence', 'timer', 'silent', 'hold', 'pov', 'flash', 'doc',
  'mem', 'save', 'chapter', 'ending', 'scrawl', 'fade', 'next',
]);

const errors = [];
const opts = new CompilerOptions(
  join(STORY, 'main.ink'), [], false,
  (msg) => errors.push(msg),
  new PosixFileHandler(STORY + '/'),
);
const compiler = new Compiler(readFileSync(join(STORY, 'main.ink'), 'utf8'), opts);
let story;
try { story = compiler.Compile(); } catch (e) { errors.push(String(e)); }
for (const w of compiler.warnings || []) console.warn('WARN', w);
if (errors.length || !story) {
  for (const e of errors) console.error('ERR ', e);
  process.exit(1);
}
writeFileSync(join(ROOT, 'story.json'), story.ToJson());

// Проверка тегов и кадров по исходникам.
let bad = 0;
const images = new Set();
for (const f of readdirSync(STORY).filter((f) => f.endsWith('.ink'))) {
  readFileSync(join(STORY, f), 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    for (const m of code.matchAll(/#\s*([a-z_]+)(?:\s*:\s*([^#]*))?/g)) {
      if (!KNOWN.has(m[1])) { bad++; console.error(`ERR ${f}:${i + 1} неизвестный тег #${m[1]}`); }
      if (m[1] === 'image' && m[2] && !/^none/.test(m[2].trim())) images.add(m[2].split('::')[0].trim());
    }
  });
}
const have = [...images].filter((id) => ['jpg', 'jpeg', 'png', 'webp'].some((x) => existsSync(join(ROOT, 'img', `${id}.${x}`))));
console.log(`story.json собран. Кадров в сюжете: ${images.size}, из них загружено: ${have.length}.`);
if (bad) process.exit(1);
