const snowball = require('snowball-stemmers');
const { classify } = require('./stopwords.cjs');
const stemmers = { ru: snowball.newStemmer('russian'), en: snowball.newStemmer('english') };
const stemCache = new Map();
const TOKEN = /\p{L}[\p{L}\p{M}]*(?:['’ʼ-]\p{L}[\p{L}\p{M}]*)*/gu;
const truncate = (value, digits) => Math.floor((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;

function normalize(word) {
  return word.normalize('NFC').toLowerCase().replace(/ё/gu, 'е').replace(/[’ʼ]/gu, "'");
}

function languageOf(word) {
  if (/^[а-яё-]+$/iu.test(word)) return 'ru';
  if (/^[a-z'-]+$/iu.test(word)) return 'en';
  return null;
}

function stem(word, language = languageOf(word)) {
  const normalized = normalize(word);
  if (!language) return normalized;
  const key = `${language}:${normalized}`;
  if (!stemCache.has(key)) {
    if (stemCache.size >= 12000) stemCache.clear();
    stemCache.set(key, stemmers[language].stem(normalized));
  }
  return stemCache.get(key);
}

function analyze(text) {
  if (typeof text !== 'string') throw new TypeError('Ожидается строка');
  const tokens = [];
  const groups = new Map();
  const languages = new Set();
  let cursor = 0;
  let total = 0;
  let waterCount = 0;
  const categories = { pronoun: 0, interjection: 0, stopword: 0, short: 0 };
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > cursor) tokens.push({ text: text.slice(cursor, match.index), isWord: false });
    const original = match[0];
    const normalized = normalize(original);
    const language = languageOf(normalized);
    if (language) languages.add(language);
    const category = classify(normalized, language);
    const water = category !== 'content';
    const root = stem(normalized, language);
    const key = `${language || 'other'}:${root}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, root, language, count: 0, coreCount: 0, forms: new Map() };
      groups.set(key, group);
    }
    group.count++;
    if (!water) group.coreCount++;
    group.forms.set(original, (group.forms.get(original) || 0) + 1);
    tokens.push({ text: original, isWord: true, key, root, language, category, water });
    total++;
    if (water) { waterCount++; categories[category]++; }
    cursor = match.index + original.length;
  }
  if (cursor < text.length) tokens.push({ text: text.slice(cursor), isWord: false });

  const core = total - waterCount;
  let maxFrequency = 0;
  let maxCoreFrequency = 0;
  for (const group of groups.values()) {
    maxFrequency = Math.max(maxFrequency, group.count);
    maxCoreFrequency = Math.max(maxCoreFrequency, group.coreCount);
    if (group.coreCount) {
      const repetitions = Math.log2(group.coreCount);
      group.fontSize = Math.round(16 - 44 * Math.expm1(-repetitions / 7));
      group.fontWeight = Math.round(400 - 400 * Math.expm1(-repetitions / 4));
    }
  }
  for (const token of tokens) {
    if (!token.isWord) continue;
    const group = groups.get(token.key);
    token.count = group.count;
    token.fontSize = token.water ? 14 : group.fontSize;
    token.fontWeight = token.water ? 400 : group.fontWeight;
    token.topFrequency = !token.water && maxCoreFrequency > 1 && group.coreCount === maxCoreFrequency;
  }
  const frequencies = Array.from(groups.values(), (group) => ({
    ...group,
    label: [...group.forms].sort((a, b) => b[1] - a[1])[0][0],
    forms: [...group.forms.keys()],
    density: total ? truncate(group.count / total * 100, 1) : 0,
    coreDensity: core ? truncate(group.coreCount / core * 100, 1) : 0,
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'));
  return {
    text, tokens, frequencies,
    stats: {
      words: total, coreWords: core, waterWords: waterCount,
      vocabulary: groups.size, coreVocabulary: frequencies.filter((group) => group.coreCount).length,
      characters: Array.from(text).length,
      charactersWithoutSpaces: Array.from(text.replace(/\s/gu, '')).length,
      // We show 100%, rather than Istio's documented empty-core special case.
      waterPercent: total ? Math.floor(waterCount / total * 100) : 0,
      nausea: truncate(Math.sqrt(maxFrequency), 2), categories,
      languages: [...languages].sort(),
    },
  };
}

module.exports = { analyze, stem, normalize, languageOf };
