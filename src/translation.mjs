const pair = { sourceLanguage: 'en', targetLanguage: 'ru' };

export async function translateWord(word) {
  const translator = await globalThis.Translator.create(pair);
  try {
    return await translator.translate(word);
  } finally {
    translator.destroy();
  }
}
const commonStarts = new Set('A An And Are As At Be But By Can Could Do Does For From Good Had Has Have He Hello Her Here Hi How I If In Is It Its Let May My No Not Now Of On Once One Only Or Our Please Read See She So Some Take That The Their Then There These They This Those To Today Use Was We Were What When Where Which Who Why Will With Would Write Yes You Your'.split(' '));
const ambiguousNames = new Set(['May', 'Will']);

function splitNames(text) {
  const names = [];
  const chunks = [];
  let end = 0;
  const capitalized = /\b(?:[A-Z][A-Za-z]*(?:[-’'][A-Za-z]+)*)(?:[ \t]+(?:[A-Z][A-Za-z]*(?:[-’'][A-Za-z]+)*))*/g;
  for (const match of text.matchAll(capitalized)) {
    const start = match.index;
    const leading = match[0].match(/^[A-Za-z]+/)[0];
    let previous = start - 1;
    while (previous >= 0 && /\s/u.test(text[previous])) previous--;
    const sentenceStart = previous < 0 || '.!?'.includes(text[previous]);
    const possibleFullName = ambiguousNames.has(leading) && match[0].length > leading.length;
    const skip = sentenceStart && commonStarts.has(leading) && !possibleFullName
      ? (match[0].match(/^[A-Za-z]+[ \t]*/)[0].length)
      : 0;
    const name = match[0].slice(skip);
    if (!name || name === 'I') continue;
    chunks.push(text.slice(end, start + skip));
    names.push(name);
    end = start + match[0].length;
  }
  chunks.push(text.slice(end));
  return { chunks, names };
}

export async function translateEnglish(text, onProgress) {
  const api = globalThis.Translator;
  if (!api || await api.availability(pair) === 'unavailable') {
    throw new Error('Встроенный переводчик недоступен в этой вкладке Chrome.');
  }
  const translator = await api.create({
    ...pair,
    monitor(monitor) {
      monitor.addEventListener('downloadprogress', (event) => {
        onProgress(`Загрузка языковой модели… ${Math.round(event.loaded * 100)}%`);
      });
    },
  });
  try {
    onProgress('Переводим на русский…');
    const { chunks, names } = splitNames(text);
    if (!names.length) return await translator.translate(text);
    let prefix = 'ZXQNAME';
    while (text.includes(prefix)) prefix += 'X';
    const markers = names.map((_, index) => `${prefix}${index}QXZ`);
    const masked = chunks.map((chunk, index) => chunk + (markers[index] ?? '')).join('');
    const translated = await translator.translate(masked);
    if (markers.every((marker) => translated.split(marker).length === 2)) {
      return translated.replace(new RegExp(`${prefix}(\\d+)QXZ`, 'g'), (marker, index) => names[Number(index)] ?? marker);
    }
    // Some language packs alter the markers. Translate the surrounding text
    // separately in that case, so the names still retain their spelling.
    let restored = '';
    for (const [index, chunk] of chunks.entries()) {
      const trimmed = chunk.trim();
      if (trimmed) {
        const leading = chunk.match(/^\s*/u)[0];
        const trailing = chunk.match(/\s*$/u)[0];
        restored += leading + await translator.translate(trimmed) + trailing;
      } else restored += chunk;
      restored += names[index] ?? '';
    }
    return restored;
  } finally {
    translator.destroy();
  }
}
