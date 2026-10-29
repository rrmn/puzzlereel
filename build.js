// Inlines the engines, app and styles into self-contained pages:
//   dist/puzzle-reel.html  a complete HTML document for any static host
//   dist/artifact.html     the same page as body content, for claude.ai artifacts
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
const filled = read('shell.html')
  .replace('/*CSS*/', () => read('style.css'))
  .replace('/*ENGINES*/', () => engines)
  .replace('/*APP*/', () => app);
const [headPart, bodyPart] = filled.split('<!--BODY-->');
if (bodyPart == null) throw new Error('shell.html needs a <!--BODY--> marker');
const standalone = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<meta name="theme-color" content="#FFB648">\n' +
  headPart.trim() + '\n</head>\n<body>\n' + bodyPart.trim() + '\n</body>\n</html>\n';
const artifact = headPart.trim() + '\n' + bodyPart.trim() + '\n';
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'puzzle-reel.html'), standalone);
fs.writeFileSync(path.join(__dirname, 'dist', 'artifact.html'), artifact);
console.log('wrote dist/puzzle-reel.html and dist/artifact.html', (standalone.length / 1024).toFixed(1) + ' KB');
