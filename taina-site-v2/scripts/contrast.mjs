#!/usr/bin/env node
// Проверка контраста текстовых пар по формуле WCAG 2.x.
// Цвета читаются напрямую из src/styles/tokens.css — токены остаются
// единственным источником правды, скрипт ничего не дублирует руками.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokensPath = path.join(__dirname, '..', 'src', 'styles', 'tokens.css');
const tokensCss = readFileSync(tokensPath, 'utf8');

/** @type {Map<string, string>} */
const colors = new Map();
for (const match of tokensCss.matchAll(/--(color-[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  colors.set(match[1], match[2]);
}

if (colors.size === 0) {
  console.error('Не нашёл ни одного --color-* токена в tokens.css — что-то не так с парсингом.');
  process.exit(1);
}

// Цвета, которые CLAUDE.md прямо запрещает использовать как цвет текста
// (Ruby/Crimson — только акценты на ромбе, контраст на чёрном ~2,2:1).
const forbiddenAsText = ['color-ruby', 'color-crimson'];

// Реальные пары «текст на фоне», которые встречаются в дизайн-системе.
// Добавляя сюда новую пару, разработчик обязан убедиться, что она проходит AA.
const textPairs = [
  { name: 'ivory текст на bg', fg: 'color-ivory', bg: 'color-bg' },
  { name: 'sand текст на bg', fg: 'color-sand', bg: 'color-bg' },
  { name: 'gold текст/акцент на bg', fg: 'color-gold', bg: 'color-bg' },
  { name: 'ivory текст на surface', fg: 'color-ivory', bg: 'color-surface' },
  { name: 'sand текст на surface', fg: 'color-sand', bg: 'color-surface' },
  { name: 'gold текст на surface', fg: 'color-gold', bg: 'color-surface' },
  { name: 'bg текст на золотой кнопке', fg: 'color-bg', bg: 'color-gold' },
];

const MIN_CONTRAST = 4.5;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

let failed = false;

console.log(`Токены (${colors.size}):`);
for (const [name, hex] of colors) console.log(`  --${name}: ${hex}`);
console.log('');

for (const pair of textPairs) {
  if (forbiddenAsText.includes(pair.fg)) {
    console.error(
      `✗ Пара «${pair.name}»: --${pair.fg} запрещён как цвет текста (см. CLAUDE.md — Ruby/Crimson только для ромба).`,
    );
    failed = true;
    continue;
  }

  const fgHex = colors.get(pair.fg);
  const bgHex = colors.get(pair.bg);
  if (!fgHex || !bgHex) {
    console.error(`✗ Пара «${pair.name}»: не нашёл токен --${pair.fg} или --${pair.bg}.`);
    failed = true;
    continue;
  }

  const ratio = contrastRatio(fgHex, bgHex);
  const ok = ratio >= MIN_CONTRAST;
  if (!ok) failed = true;
  console.log(
    `${ok ? '✓' : '✗'} ${pair.name}: ${ratio.toFixed(2)}:1 ${ok ? '' : `(нужно ≥ ${MIN_CONTRAST}:1)`}`,
  );
}

// Дополнительная защита: если ruby/crimson вообще попали в textPairs как fg
// где-то ещё (например, скопипастили пару) — уже отловлено выше по forbiddenAsText.

console.log('');
if (failed) {
  console.error('Контраст не прошёл проверку.');
  process.exit(1);
} else {
  console.log(`Все пары проходят AA (≥ ${MIN_CONTRAST}:1 для текста).`);
}
