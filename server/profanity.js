'use strict';

/**
 * GAZE — filterProfanity
 * Лёгкий фильтр без внешних зависимостей.
 * Нормализует текст (лат→кириллица, лит-спам) перед проверкой.
 */

// ── Русские паттерны (основа + вариации через regex) ─────────────────────────
const RU_PATTERNS = [
  /х[уy]й/i, /хуё/i, /пизд/i, /ёбан/i, /еба[нлть]/i, /[её]б[аи]/i,
  /блядь/i, /блять/i, /бля[тд]/i, /мудак/i, /муда[кч]/i, /ёб/i,
  /сука/i, /залупа/i, /ёбн/i, /пиздо/i, /хуёв/i, /мудил/i,
  /долбоёб/i, /долбаёб/i, /шлюх/i, /проститут/i, /педик/i, /педерас/i,
  /пиздат/i, /охуе/i, /охуй/i, /уёбищ/i, /уёб/i, /ёбаный/i,
  /блядск/i, /ёбаная/i, /ёбаного/i, /ёбаному/i,
];

// ── Английские паттерны ───────────────────────────────────────────────────────
const EN_PATTERNS = [
  /\bf+u+c+k+\b/i, /\bs+h+i+t+\b/i, /\bass+h+o+l+e+\b/i,
  /\bb+i+t+c+h+\b/i, /\bc+u+n+t+\b/i, /\bd+i+c+k+\b/i,
  /\bn+i+g+g+/i, /\bf+a+g+\b/i, /\bwhore\b/i, /\bcrap\b/i,
];

// ── Нормализация: латиница → похожая кириллица ────────────────────────────────
const LATIN_TO_CYR = {
  'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с',
  'x': 'х', 'y': 'у', 'h': 'н', 'k': 'к', 'b': 'в',
  '3': 'з', '4': 'ч', '0': 'о', '1': 'и', '@': 'а',
};

function normalize(text) {
  return text
    .toLowerCase()
    .split('')
    .map(ch => LATIN_TO_CYR[ch] || ch)
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/(.)\1{2,}/g, '$1$1'); // сжать повторы: "хуууй" → "хуй"
}

/**
 * Проверить текст на нецензурную лексику
 * @param {string} text
 * @returns {{ clean: boolean, matches: string[] }}
 */
function filterProfanity(text) {
  if (!text || typeof text !== 'string') return { clean: true, matches: [] };

  const normalized = normalize(text);
  const original   = text.toLowerCase();
  const matches    = [];

  for (const pattern of RU_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(original)) {
      matches.push(pattern.source);
    }
  }
  for (const pattern of EN_PATTERNS) {
    if (pattern.test(original)) {
      matches.push(pattern.source);
    }
  }

  return { clean: matches.length === 0, matches };
}

/**
 * Цензурировать текст (заменить матерные слова на ***)
 * @param {string} text
 * @returns {string}
 */
function censorText(text) {
  if (!text) return text;
  let result = text;

  const allPatterns = [...RU_PATTERNS, ...EN_PATTERNS];
  for (const pattern of allPatterns) {
    result = result.replace(new RegExp(pattern.source, 'gi'), match => '*'.repeat(match.length));
  }
  return result;
}

module.exports = { filterProfanity, censorText };
