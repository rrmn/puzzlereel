// Inlines the engines, app and styles into one self-contained page.
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
let engines = read('engines.js');
const head = '(function (root) {';
const tail = /\}\)\(typeof window !== 'undefined' \? window : globalThis\);\s*$/;
if (!engines.includes(head) || !tail.test(engines)) throw new Error('engines.js wrapper changed');
engines = engines.replace(head, 'function PuzzleEnginesFactory(root) {')
  .replace(tail, '}\nPuzzleEnginesFactory(window);\n');
const app = read('app.js');
for (const [name, src] of [['engines', engines], ['app', app]]) {
  if (/<\/script/i.test(src)) throw new Error(name + ' contains a closing script tag');
}
const out = read('shell.html')
  .replace('/*CSS*/', () => read('style.css'))
  .replace('/*ENGINES*/', () => engines)
  .replace('/*APP*/', () => app);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'puzzle-reel.html'), out);
console.log('wrote dist/puzzle-reel.html', (out.length / 1024).toFixed(1) + ' KB');
