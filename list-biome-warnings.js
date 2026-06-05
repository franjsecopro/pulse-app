const { execSync } = require('child_process');

let rawOut = '';
try {
  rawOut = execSync('pnpm exec biome check --max-diagnostics=200 .', {
    encoding: 'utf8',
    cwd: __dirname + '\\frontend',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  rawOut = (e.stdout || '') + '\n' + (e.stderr || '');
}

const byFile = {};
const seen = new Set();
let totalW = 0;
let totalE = 0;

const lines = rawOut.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/^([^\s:]+\.(?:ts|tsx|js|jsx)):(\d+):\d+\s+(lint\/\S+|format)\s+/);
  if (!m) continue;
  const file = m[1];
  const ln = parseInt(m[2], 10);
  const rule = m[3];
  if (!byFile[file]) byFile[file] = { warnings: 0, errors: 0, rules: {}, lines: [] };
  if (rule === 'format') {
    byFile[file].errors++;
    totalE++;
  } else {
    byFile[file].warnings++;
    totalW++;
    byFile[file].rules[rule] = (byFile[file].rules[rule] || 0) + 1;
    byFile[file].lines.push(ln);
  }
  seen.add(file + ':' + ln + ':' + rule);
}

const sorted = Object.entries(byFile).sort((a, b) => (b[1].warnings + b[1].errors) - (a[1].warnings + a[1].errors));

console.log('### Resumen');
console.log('- Archivos con issues: ' + sorted.length);
console.log('- Warnings (lint): ' + totalW);
console.log('- Errors (formato): ' + totalE);
console.log('');
console.log('### Por archivo (ordenado por cantidad)');
console.log('');
console.log('| #  | Archivo | W | E | Reglas |');
console.log('|----|---------|---|---|--------|');
sorted.forEach(([file, info], i) => {
  const rel = file.replace(/\\/g, '/');
  const rulesStr = Object.entries(info.rules).sort((a, b) => b[1] - a[1]).map(([r, c]) => r + '(' + c + ')').join(', ');
  console.log('| ' + String(i + 1).padStart(2) + ' | `' + rel + '` | ' + info.warnings + ' | ' + info.errors + ' | ' + rulesStr + ' |');
});

console.log('\n### Detalle de lineas (lint)');
sorted.forEach(([file, info]) => {
  if (info.warnings === 0) return;
  const rel = file.replace(/\\/g, '/');
  console.log('\n**' + info.warnings + 'W** `' + rel + '`' + (info.errors > 0 ? '  + ' + info.errors + ' format error' : ''));
  info.lines.sort((a, b) => a - b);
  console.log('  Lineas: ' + info.lines.join(', '));
});

if (totalE > 0) {
  console.log('\n### Archivos con error de formato');
  sorted.forEach(([file, info]) => {
    if (info.errors > 0) console.log('  - `' + file.replace(/\\/g, '/') + '` (correr `biome format --write ' + file + '`)');
  });
}
