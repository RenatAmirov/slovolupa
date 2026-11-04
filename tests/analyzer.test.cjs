const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyze, stem } = require('../src/analyzer.cjs');

test('Русские словоформы и ё/е объединяются', () => {
  const result = analyze('Текст, тексты, текстом. Ёлка и елки.');
  assert.equal(result.frequencies.find((g) => g.root === stem('текст')).count, 3);
  assert.equal(stem('Ёлка'), stem('елки'));
});
test('Английский Snowball: read/reading, write/writes/writing', () => {
  assert.equal(stem('reading'), stem('reads'));
  assert.equal(stem('writing'), stem('writes'));
  assert.equal(analyze('Write writes writing.').frequencies[0].count, 3);
});
test('Пунктуация, пробелы, эмодзи и числа сохраняются побайтно', () => {
  const text = '«Текст», текст…\n\tText — texts! 42; 3.14, 😀 <b> & "hello". Мысль..';
  assert.equal(analyze(text).tokens.map((token) => token.text).join(''), text);
});
test('Местоимения, междометия и стоп-слова входят в водность', () => {
  const result = analyze('Я ах и текст. We wow the text.');
  assert.equal(result.stats.words, 8);
  assert.equal(result.stats.waterWords, 6);
  assert.equal(result.stats.waterPercent, 75);
  assert.equal(result.stats.categories.pronoun, 2);
  assert.equal(result.stats.categories.interjection, 2);
  assert.equal(result.stats.categories.stopword, 2);
  assert.deepEqual(result.stats.languages, ['en', 'ru']);
});
test('Слова короче 3 букв — вода, содержательные слова не фильтруются по основе', () => {
  const result = analyze('TV UX лес разный');
  assert.equal(result.stats.waterWords, 2);
  assert.equal(result.tokens.find((t) => t.text === 'разный').water, false);
});
test('Размер и weight увеличиваются с частотой; вода не доминирует', () => {
  const result = analyze('и и и и и и текст тексты текстом мысль мысли ритм');
  const token = (word) => result.tokens.find((t) => t.text === word);
  assert.ok(token('текст').fontSize > token('мысль').fontSize);
  assert.ok(token('мысль').fontSize > token('ритм').fontSize);
  assert.ok(token('текст').fontWeight > token('мысль').fontWeight);
  assert.ok(token('и').fontSize < token('ритм').fontSize);
  assert.equal(token('текст').fontSize, token('текстом').fontSize);
});
test('Тошнота учитывает стоп-слова и усекается, а не округляется', () => {
  assert.equal(analyze('и и и').stats.nausea, 1.73);
  assert.equal(analyze('и '.repeat(8)).stats.nausea, 2.82);
});
test('Частоты в ядре и в тексте имеют разные знаменатели', () => {
  const result = analyze('The text texts and ideas.');
  const group = result.frequencies.find((g) => g.root === 'text');
  assert.equal(group.density, 40);
  assert.equal(group.coreDensity, 66.6);
});
test('Пустой текст, только знаки и только вода обрабатываются без NaN', () => {
  for (const text of ['', '42 — 😀\n...', 'и я ах the we wow']) {
    const result = analyze(text);
    assert.ok(Number.isFinite(result.stats.waterPercent));
    assert.ok(Number.isFinite(result.stats.nausea));
    assert.equal(result.tokens.map((t) => t.text).join(''), text);
  }
  assert.equal(analyze('и я ах').stats.waterPercent, 100);
  assert.equal(analyze('').stats.nausea, 0);
});
test('Апострофы и дефисы сохраняются; сокращения распознаются', () => {
  const result = analyze("Don't don’t кто-то кто-нибудь человек-паук");
  assert.equal(result.stats.words, 5);
  assert.equal(result.stats.waterWords, 4);
  assert.equal(result.tokens.filter((t) => t.isWord)[0].key, result.tokens.filter((t) => t.isWord)[1].key);
});
test('Большой текст сохраняется целиком', () => {
  const text = 'Текст, тексты! Words, wording.\n'.repeat(5000);
  const result = analyze(text);
  assert.equal(result.tokens.map((t) => t.text).join(''), text);
  assert.equal(result.stats.words, 20000);
});
