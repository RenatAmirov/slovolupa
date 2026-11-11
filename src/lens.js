import { analyze } from './analyzer.cjs';
import { translateEnglish, translateWord } from './translation.mjs';
import { explanationPrompt, requestExplanation } from './explanation.js';
import latinFont from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2';
import cyrillicFont from '@fontsource-variable/manrope/files/manrope-cyrillic-wght-normal.woff2';

let mapFontLoaded = false;
function loadMapFont() {
  if (mapFontLoaded) return;
  mapFontLoaded = true;
  for (const [data, unicodeRange] of [[latinFont, 'U+0000-00FF,U+2000-206F'], [cyrillicFont, 'U+0400-045F,U+2116']]) {
    const font = new FontFace('Slovolupa Map', data, { weight: '200 800', unicodeRange });
    font.load().then((loaded) => document.fonts.add(loaded)).catch(() => {});
  }
}

const CATEGORY_LABEL = { content: 'Значимое слово', pronoun: 'Местоимение', interjection: 'Междометие', stopword: 'Стоп-слово', short: 'Короткое слово' };
const CSS = `
:host { all: initial !important; position: fixed !important; left: var(--lens-x, 12px) !important; top: var(--lens-y, 12px) !important; display: block !important; z-index: 2147483647 !important; color-scheme: light !important; }
* { box-sizing: border-box; }
.panel { width: var(--available-width); height: var(--available-height); display: flex; flex-direction: column; overflow: hidden; background: #fbfcfa; border: 1px solid #d8e1db; border-radius: 18px; box-shadow: 0 18px 60px #132c2633, 0 2px 8px #132c2612; color: #193b33; font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; text-align: left; direction: ltr; letter-spacing: normal; }
button { font: inherit; cursor: pointer; border: 0; color: inherit; }
button:focus-visible, [tabindex]:focus-visible { outline: 2px solid #3c8069; outline-offset: -3px; }
.header { display: flex; align-items: center; gap: 10px; padding: 16px 18px 10px; flex: 0 0 auto; }
.header-selection { gap: 8px; padding: 4px 12px; }
.header-selection .heading { line-height: 1.15; }
.header-selection .eyebrow { display: block; }
.logo { width: 30px; height: 30px; display: flex; gap: 3px; align-items: end; justify-content: center; padding: 7px; background: #174b3e; border-radius: 9px; }
.logo i { display: block; width: 4px; background: #d4efd7; border-radius: 1px; height: 8px; }
.logo i:nth-child(2) { height: 17px; } .logo i:nth-child(3) { height: 12px; }
.heading { flex: 1; min-width: 0; } .heading strong { display: block; font-size: 14px; letter-spacing: -.2px; } .eyebrow { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #73857b; }
.close { width: 30px; height: 30px; border-radius: 8px; background: transparent; font-size: 22px; line-height: 1; color: #6f7f77; } .close:hover { background: #eaf0eb; }
.summary { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 18px 12px; } .pill { padding: 3px 8px; background: #edf2ed; color: #52665b; border-radius: 5px; font-size: 11px; }
.summary-bottom { flex: 0 0 auto; padding: 8px 18px; border-top: 1px solid #e4e9e3; }
.tabs { padding: 0 18px; display: flex; flex-wrap: wrap; gap: 0 18px; border-bottom: 1px solid #e4e9e3; flex: 0 0 auto; } .tab { padding: 8px 0; background: transparent; font-size: 12px; border-bottom: 2px solid transparent; color: #78877d; } .tab[aria-selected=true] { border-color: #26654c; color: #20573f; font-weight: 650; }
.tabs-bottom { border-top: 1px solid #e4e9e3; border-bottom: 0; }
.tabs-bottom + .summary-bottom { border-top: 0; }
.body { padding: 18px; min-height: 0; overflow: auto; overscroll-behavior: contain; flex: 1 1 auto; scrollbar-width: thin; }
.legend { display: flex; flex-wrap: wrap; gap: 10px; font-size: 10px; color: #75847b; margin-bottom: 14px; align-items: center; } .legend b { font-size: 14px; color: #255c43; } .water-toggle { margin-left: auto; border-radius: 5px; background: #eaf0e9; padding: 4px 8px; font-size: 10px; } .water-toggle[aria-pressed=true] { background: #f9e9cd; color: #8b5b17; }
.legend-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
.legend-actions .water-toggle { margin-left: 0; }
.explain-button { border-radius: 5px; background: #dcebdc; color: #20573f; padding: 4px 8px; font-size: 10px; }
.explanation { position: fixed; inset: 10px auto auto 10px; width: calc(50vw - 20px); height: calc(100dvh - 20px); max-width: none; max-height: none; margin: 0; padding: 0; border: 1px solid #d8e1db; border-radius: 14px; background: #fbfcfa; color: #193b33; font: 15px/1.65 system-ui, sans-serif; }
.explanation[open] { display: flex; flex-direction: column; }
.explanation::backdrop { background: #e7f0e980; }
.explanation .header { border-bottom: 1px solid #e4e9e3; }
.explanation h2 { flex: 1; margin: 0; font-size: 18px; }
.explanation-actions { display: flex; align-items: center; gap: 6px; } .explanation .speak-button { border: 1px solid #b8cbbd; border-radius: 6px; padding: 5px 8px; background: #edf4ed; color: #20573f; font-size: 11px; white-space: nowrap; } .explanation .speak-button[aria-pressed=true] { background: #f9e9cd; color: #805314; } .explanation .speak-button:disabled, .speech-control:disabled { opacity: .55; cursor: not-allowed; }
.playback-controls { display: none; align-items: center; gap: 4px; margin: 0 0 9px; padding: 4px 6px; border: 1px solid #d8e5da; border-radius: 7px; background: #f3f8f3; } .playback-controls.visible { display: flex; } .speech-control { display: grid; width: 26px; height: 26px; place-items: center; border: 1px solid #b8cbbd; border-radius: 50%; padding: 0; background: #fff; color: #20573f; font: 14px/1 system-ui, sans-serif; } .speech-control:hover:not(:disabled) { background: #e3efe5; } .speech-control.stop { background: #f9e9cd; color: #805314; } .playback-controls .hint { margin: 0 0 0 3px; font-size: 10px; white-space: nowrap; }
.explanation-body { flex: 1 1 auto; min-height: 0; padding: 16px 18px; overflow-y: scroll; overflow-x: hidden; overscroll-behavior: contain; scrollbar-color: #6d9981 #edf2ed; scrollbar-width: auto; }
.explanation-body::-webkit-scrollbar { width: 12px; } .explanation-body::-webkit-scrollbar-track { background: #edf2ed; } .explanation-body::-webkit-scrollbar-thumb { min-height: 36px; border: 3px solid #edf2ed; border-radius: 8px; background: #6d9981; }
.explanation-text { overflow-wrap: anywhere; }
.explanation-text::highlight(slovolupa-current-sentence) { background: #ffd5e0; color: #193b33; }
.explanation-text > :first-child { margin-top: 0; } .explanation-text > :last-child { margin-bottom: 0; }
.explanation-text h1, .explanation-text h2, .explanation-text h3 { line-height: 1.25; color: #174b3e; } .explanation-text h1 { font-size: 1.45em; } .explanation-text h2 { font-size: 1.22em; } .explanation-text h3 { font-size: 1.08em; }
.explanation-text p { margin: .75em 0; } .explanation-text ul, .explanation-text ol { margin: .7em 0; padding-left: 1.5em; } .explanation-text li + li { margin-top: .25em; }
.explanation-text blockquote { margin: .8em 0; padding: .25em 0 .25em .8em; border-left: 3px solid #79a992; color: #49685b; } .explanation-text pre { margin: .8em 0; padding: .75em; overflow: auto; border-radius: 7px; background: #eaf1ea; font: .88em/1.45 ui-monospace, Consolas, monospace; white-space: pre-wrap; }
.explanation-text code { padding: .08em .25em; border-radius: 3px; background: #eaf1ea; font: .9em ui-monospace, Consolas, monospace; } .explanation-text pre code { padding: 0; background: transparent; } .explanation-text a { color: #176044; text-decoration-thickness: 1px; }
.explanation .hint { margin: 0 0 10px; font-size: 12px; color: #52665b; }
.explanation details { margin-top: 16px; font-size: 12px; }
.explanation summary { cursor: pointer; color: #20573f; }
.explanation textarea { display: block; width: 100%; margin-top: 8px; padding: 8px; color: inherit; font: inherit; }
.text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; color: #204b37; font-size: 16px; font-family: 'Slovolupa Map', 'Segoe UI Variable', system-ui, sans-serif; }
.word { border-radius: 3px; } .word:hover { background: #deebdc; } .water { color: #7e887e; } .show-water .water { background: #faecd2; color: #8e662c; }
.word.top-frequency { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; }
.word-info { position: fixed; z-index: 1; display: none; max-width: min(260px, calc(100vw - 10px)); padding: 3px 5px; border: 1px solid #c7d6cc; border-radius: 5px; background: #f7fbf6; box-shadow: 0 3px 12px #132c2630; color: #294d3d; font: 9px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; pointer-events: none; }
.word-info.visible { display: block; }
.translation { padding: 12px 15px; margin: 0 0 16px; background: #edf3ec; border-radius: 9px; }
.translation strong { display: block; margin-bottom: 4px; }
.translation-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.translation-text .translation-highlight { background: #ffe052; border-radius: 3px; }
.translation-text .translation-highlight.nearby { background: #fff1a8; }
.word.original-highlight { background: #a1e4a8; color: #173e30; }
.hint { color: #849086; font-size: 10px; margin: 15px 0 0; }
.footer { display: flex; justify-content: space-between; gap: 10px; padding: 10px 18px; border-top: 1px solid #e4e9e3; color: #7c8c80; font-size: 10px; flex: 0 0 auto; } .local { color: #47735a; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .stat { padding: 12px; border-radius: 9px; background: #eff3ec; } .stat b { display: block; color: #20533e; font-size: 23px; font-weight: 550; line-height: 1.3; } .stat span { font-size: 10px; color: #738271; }
.detail { margin-top: 16px; display: grid; gap: 6px; font-size: 12px; } .detail div { display: flex; justify-content: space-between; border-bottom: 1px solid #edf0e9; padding: 4px 0; }
.note { font-size: 11px; color: #7a887c; margin: 15px 0 0; }
table { width: 100%; border-collapse: collapse; font-size: 11px; } th { text-align: right; color: #839082; font-size: 9px; font-weight: 500; padding: 0 4px 8px; } th:first-child { text-align: left; } td { padding: 8px 4px; text-align: right; border-top: 1px solid #e7ece3; } td:first-child { text-align: left; overflow-wrap: anywhere; max-width: 180px; } td strong { font-size: 13px; font-weight: 650; } .forms { display: block; color: #839082; font-size: 10px; margin-top: 2px; } .empty { padding: 20px 0; color: #7c8879; }
@media (prefers-reduced-motion: no-preference) { .panel { animation: enter 110ms ease-out; } @keyframes enter { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } } }
`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, className, action, label) {
  const node = el('button', className, text);
  node.type = 'button';
  if (label) { node.setAttribute('aria-label', label); node.title = label; }
  node.addEventListener('click', action);
  return node;
}

// The model response is untrusted: build Markdown elements through the DOM instead
// of assigning HTML, so tags returned by a model cannot execute on the page.
function appendMarkdownInline(parent, source) {
  const pattern = /(`[^`]*`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*]+\*|_[^_]+_)/g;
  let position = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > position) parent.append(document.createTextNode(source.slice(position, match.index)));
    const token = match[0];
    let element;
    if (token.startsWith('`')) element = el('code', '', token.slice(1, -1));
    else if (token.startsWith('**') || token.startsWith('__')) element = el('strong', '', token.slice(2, -2));
    else if (token.startsWith('~~')) element = el('s', '', token.slice(2, -2));
    else if (token.startsWith('[')) {
      const [, label, href] = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/) || [];
      if (label && href) {
        element = el('a', '', label); element.href = href; element.target = '_blank'; element.rel = 'noopener noreferrer';
      }
    } else element = el('em', '', token.slice(1, -1));
    parent.append(element || document.createTextNode(token));
    position = match.index + token.length;
  }
  if (position < source.length) parent.append(document.createTextNode(source.slice(position)));
}

function renderMarkdown(output, markdown) {
  const fragment = document.createDocumentFragment();
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (/^```/.test(line)) {
      const code = []; index++;
      while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index++;
      const pre = el('pre'); pre.append(el('code', '', code.join('\n'))); fragment.append(pre); continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { const node = el(`h${heading[1].length}`); appendMarkdownInline(node, heading[2]); fragment.append(node); index++; continue; }
    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) { fragment.append(el('hr')); index++; continue; }
    const listMatch = line.match(/^\s*([-*+])\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (listMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch); const list = el(ordered ? 'ol' : 'ul');
      while (index < lines.length) {
        const item = ordered ? lines[index].match(/^\s*\d+[.)]\s+(.+)$/) : lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!item) break;
        const node = el('li'); appendMarkdownInline(node, item[1]); list.append(node); index++;
      }
      fragment.append(list); continue;
    }
    if (line.startsWith('>')) {
      const quote = el('blockquote');
      while (index < lines.length && lines[index].startsWith('>')) {
        if (quote.childNodes.length) quote.append(document.createElement('br'));
        appendMarkdownInline(quote, lines[index++].replace(/^>\s?/, ''));
      }
      fragment.append(quote); continue;
    }
    const paragraph = el('p');
    while (index < lines.length && lines[index].trim() && !/^```|^(#{1,3})\s+|^\s*([-*+])\s+|^\s*\d+[.)]\s+|^>/.test(lines[index])) {
      if (paragraph.childNodes.length) paragraph.append(document.createElement('br'));
      appendMarkdownInline(paragraph, lines[index++]);
    }
    fragment.append(paragraph);
  }
  output.replaceChildren(fragment);
}

function splitSpeechSentences(text) {
  return text.match(/[^.!?…]+[.!?…]*|[.!?…]+/gu)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
}

function textRangeForOffsets(root, start, end) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let position = 0;
  let startPoint;
  let endPoint;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const nextPosition = position + node.data.length;
    if (!startPoint && start >= position && start <= nextPosition) startPoint = [node, start - position];
    if (!endPoint && end >= position && end <= nextPosition) endPoint = [node, end - position];
    if (startPoint && endPoint) break;
    position = nextPosition;
  }
  if (!startPoint || !endPoint) return null;
  const range = document.createRange();
  range.setStart(...startPoint);
  range.setEnd(...endPoint);
  return range;
}

export class Lens {
  constructor({ onClose, onWaterChange }) {
    this.onClose = onClose;
    this.onWaterChange = onWaterChange;
    this.host = el('word-lens-overlay');
    this.host.id = 'word-lens-overlay';
    this.shadow = this.host.attachShadow({ mode: 'open' });
    const style = el('style'); style.textContent = CSS;
    this.panel = el('section', 'panel');
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Словолупа — анализ текста');
    this.wordInfo = el('div', 'word-info');
    this.wordInfo.setAttribute('role', 'tooltip');
    this.shadow.append(style, this.panel, this.wordInfo);
    this.tab = 'map';
    this.visible = false;
  }
  contains(event) { return event.composedPath().includes(this.host); }
  get explanationOpen() { return Boolean(this.explanationDialog?.open); }

  showExplanation() {
    if (this.explanationOpen) return;
    const prompt = explanationPrompt(this.result.text);
    const dialog = el('dialog', 'explanation');
    dialog.setAttribute('aria-labelledby', 'explanation-title');
    const title = el('h2', '', 'Объяснить как ребенку');
    title.id = 'explanation-title';
    const close = button('×', 'close', () => dialog.close(), 'Закрыть объяснение');
    let isSpeaking = false;
    let isPaused = false;
    let activeAudio;
    let playbackUrls = [];
    let audioSources = [];
    let audioRequestId = 0;
    let sentenceIndex = 0;
    let spokenText = '';
    let spokenSentences = [];
    const speechHighlightName = 'slovolupa-current-sentence';
    const playback = el('div', 'playback-controls');
    playback.setAttribute('aria-label', 'Управление озвучкой');
    const speechStatus = el('span', 'hint', '');
    const finish = () => {
      isSpeaking = false;
      isPaused = false;
      activeAudio?.pause();
      activeAudio = undefined;
      playbackUrls = [];
      for (const source of audioSources) if (source) URL.revokeObjectURL(source);
      audioSources = [];
      audioRequestId += 1;
      sentenceIndex = 0;
      spokenText = '';
      spokenSentences = [];
      globalThis.CSS?.highlights?.delete(speechHighlightName);
      playback.classList.remove('visible');
      speak.textContent = 'Произнести вслух';
      speak.setAttribute('aria-pressed', 'false');
      speak.disabled = false;
      updateControls();
    };
    const updateControls = () => {
      pause.disabled = !isSpeaking || isPaused || !activeAudio;
      resume.disabled = !isSpeaking || !isPaused || !activeAudio;
      stop.disabled = !isSpeaking;
      previous.disabled = !isSpeaking || !playbackUrls.length || sentenceIndex === 0;
      next.disabled = !isSpeaking || !playbackUrls.length || sentenceIndex >= playbackUrls.length - 1;
      speechStatus.textContent = isSpeaking && playbackUrls.length ? `${sentenceIndex + 1} / ${playbackUrls.length}` : '';
    };
    const highlightCurrentSentence = () => {
      if (!globalThis.CSS?.highlights || typeof Highlight === 'undefined') return;
      const sentence = spokenSentences[sentenceIndex];
      const rootText = result.textContent;
      const rootOffset = rootText.indexOf(spokenText);
      const before = spokenSentences.slice(0, sentenceIndex).join('');
      const localOffset = spokenText.indexOf(sentence, Math.max(0, before.length));
      if (!sentence || rootOffset < 0 || localOffset < 0) return;
      const range = textRangeForOffsets(result, rootOffset + localOffset, rootOffset + localOffset + sentence.length);
      if (!range) return;
      globalThis.CSS.highlights.set(speechHighlightName, new Highlight(range));
      requestAnimationFrame(() => {
        if (!isSpeaking || sentence !== spokenSentences[sentenceIndex]) return;
        const line = Array.from(range.getClientRects()).at(-1);
        const viewport = body.getBoundingClientRect();
        const safetyGap = 28;
        if (line && line.bottom > viewport.bottom - safetyGap) {
          body.scrollBy({
            top: line.bottom - viewport.bottom + safetyGap,
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          });
        }
      });
    };
    const startAudio = (source, requestId) => {
      if (!isSpeaking || requestId !== audioRequestId) return;
      const audio = new Audio(source);
      activeAudio = audio;
      updateControls();
      audio.onended = () => {
        if (audio !== activeAudio) return;
        if (sentenceIndex + 1 < playbackUrls.length) playSentence(sentenceIndex + 1);
        else finish();
      };
      audio.onerror = () => {
        if (audio !== activeAudio) return;
        finish();
        alert('Браузер не смог воспроизвести полученный аудиофайл.');
      };
      audio.play().catch(() => {
        if (audio !== activeAudio) return;
        finish();
        alert('Браузер не разрешил воспроизведение озвучки.');
      });
    };
    const playSentence = (nextIndex) => {
      if (!isSpeaking || !playbackUrls[nextIndex]) return;
      activeAudio?.pause();
      activeAudio = undefined;
      sentenceIndex = nextIndex;
      isPaused = false;
      highlightCurrentSentence();
      updateControls();
      const requestId = ++audioRequestId;
      if (audioSources[sentenceIndex]) {
        startAudio(audioSources[sentenceIndex], requestId);
        return;
      }
      chrome.runtime.sendMessage({ type: 'fetch-speech-audio', url: playbackUrls[sentenceIndex] }).then((response) => {
        if (!isSpeaking || requestId !== audioRequestId) return;
        if (!response?.audio) throw new Error(response?.error || 'Помощник не вернул аудиофайл.');
        const binary = atob(response.audio);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        audioSources[sentenceIndex] = URL.createObjectURL(new Blob([bytes], { type: response.contentType || 'audio/mpeg' }));
        startAudio(audioSources[sentenceIndex], requestId);
      }).catch((error) => {
        if (!isSpeaking || requestId !== audioRequestId) return;
        finish();
        alert(error?.message || 'Не удалось получить аудио для озвучки.');
      });
    };
    const pause = button('⏸', 'speech-control', () => {
      activeAudio?.pause();
      isPaused = true;
      updateControls();
    }, 'Приостановить озвучку');
    const resume = button('▶', 'speech-control', () => {
      if (!activeAudio) return;
      isPaused = false;
      activeAudio.play().catch(() => { isPaused = true; });
      updateControls();
    }, 'Продолжить озвучку');
    const stop = button('■', 'speech-control stop', finish, 'Остановить озвучку');
    const previous = button('⏮', 'speech-control', () => playSentence(Math.max(0, sentenceIndex - 1)), 'Вернуться на одно предложение назад');
    const next = button('⏭', 'speech-control', () => playSentence(Math.min(playbackUrls.length - 1, sentenceIndex + 1)), 'Перейти на одно предложение вперёд');
    playback.append(pause, resume, stop, previous, next, speechStatus);
    const startSpeaking = () => {
      if (isSpeaking) return;
      spokenText = result.textContent.trim();
      if (!spokenText || result.dataset.ready !== 'true') return;
      spokenSentences = splitSpeechSentences(spokenText);
      if (!spokenSentences.length) return;
      isSpeaking = true;
      playback.classList.add('visible');
      speak.textContent = 'Готовим озвучку…';
      speak.setAttribute('aria-pressed', 'true');
      speak.disabled = true;
      updateControls();
      chrome.runtime.sendMessage({ type: 'synthesize-speech', text: spokenText }).then((response) => {
        if (!isSpeaking) return;
        if (!Array.isArray(response?.urls) || !response.urls.length) throw new Error(response?.error || 'Помощник не вернул аудио.');
        playbackUrls = response.urls;
        speak.textContent = 'Произнести вслух';
        playSentence(0);
      }).catch((error) => {
        finish();
        alert(error?.message || 'Не удалось подготовить озвучку.');
      });
    };
    const speak = button('Произнести вслух', 'speak-button', startSpeaking, 'Произнести весь текст объяснения вслух');
    speak.setAttribute('aria-pressed', 'false');
    speak.disabled = true;
    speak.title = 'Озвучить качественным голосом Yandex SpeechKit';
    const actions = el('div', 'explanation-actions');
    actions.append(speak, close);
    const header = el('div', 'header');
    header.append(title, actions);

    const body = el('div', 'explanation-body');
    const result = el('div', 'explanation-text', 'Готовим объяснение…');
    result.setAttribute('role', 'status');
    const details = el('details');
    const promptField = el('textarea');
    promptField.rows = 6;
    promptField.readOnly = true;
    promptField.value = prompt;
    promptField.setAttribute('aria-label', 'Промпт с выделенным текстом');
    details.append(el('summary', '', 'Показать промпт'), promptField);
    body.append(el('p', 'hint', 'Запрос на объяснение отправляется в DarkAPI через локальный помощник.'), playback, result, details);
    dialog.append(header, body);
    dialog.addEventListener('close', () => {
      if (isSpeaking) finish();
      if (this.explanationDialog === dialog) this.explanationDialog = null;
      dialog.remove();
    }, { once: true });

    this.explanationDialog = dialog;
    this.shadow.append(dialog);
    dialog.showModal();
    close.focus();
    requestExplanation(prompt).then(
      (text) => {
        if (!dialog.open) return;
        renderMarkdown(result, text);
        result.dataset.ready = 'true';
        speak.disabled = false;
        startSpeaking();
      },
      (error) => { if (dialog.open) result.textContent = error.message; },
    );
  }

  show(result, mode, highlightWater) {
    this.explanationDialog?.close();
    loadMapFont();
    this.result = result;
    this.translation = result.stats.languages.join() === 'en' ? 'Подготовка перевода…' : '';
    this.translatedTokens = null;
    this.wordTranslations = new Map();
    this.mode = mode;
    this.highlightWater = highlightWater;
    this.tab = 'map';
    this.visible = true;
    if (!this.host.isConnected) document.documentElement.append(this.host);
    this.render();
    this.position();
    if (this.translation) {
      const update = (message) => {
        if (!this.visible || this.result !== result) return;
        this.translation = message;
        const output = this.shadow.querySelector('.translation-text');
        if (output) this.renderTranslation(output);
      };
      translateEnglish(result.text, update).then((translated) => {
        if (!this.visible || this.result !== result) return;
        this.translatedTokens = analyze(translated).tokens;
        update(translated);
      }, (error) => {
        update(error.message === 'Встроенный переводчик недоступен в этой вкладке Chrome.'
          ? error.message : 'Не удалось перевести текст. Закройте окно и попробуйте снова.');
      });
    }
  }
  hide() {
    this.explanationDialog?.close();
    this.hideWordInfo();
    this.visible = false;
    this.host.remove();
  }
  hideWordInfo() {
    this.wordInfo.classList.remove('visible');
    this.wordInfo.replaceChildren();
  }
  showWordInfo(word, event) {
    this.wordInfo.textContent = `${CATEGORY_LABEL[word.dataset.category]} · основа «${word.dataset.root}» · ${word.dataset.count} повтор. в тексте`;
    this.wordInfo.classList.add('visible');
    const margin = 5;
    const gap = 8;
    const rect = this.wordInfo.getBoundingClientRect();
    const left = Math.max(margin, Math.min(event.clientX + gap, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(event.clientY + gap, window.innerHeight - rect.height - margin));
    this.wordInfo.style.left = `${left}px`;
    this.wordInfo.style.top = `${top}px`;
  }
  position() {
    const viewport = window.visualViewport;
    const bounds = {
      left: viewport?.offsetLeft || 0, top: viewport?.offsetTop || 0,
      width: viewport?.width || window.innerWidth, height: viewport?.height || window.innerHeight,
    };
    const halfWidth = bounds.width / 2;
    const gap = Math.min(10, halfWidth / 4, bounds.height / 4);
    const width = Math.max(1, halfWidth - gap * 2);
    const height = Math.max(1, bounds.height - gap * 2);
    this.host.style.setProperty('--available-width', `${width}px`);
    this.host.style.setProperty('--available-height', `${height}px`);
    this.host.style.setProperty("--lens-x", `${bounds.left + halfWidth + gap}px`);
    this.host.style.setProperty("--lens-y", `${bounds.top + gap}px`);
  }
  render() {
    const { stats } = this.result;
    this.panel.replaceChildren();
    const header = el('div', 'header');
    const logo = el('div', 'logo'); logo.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) logo.append(el('i'));
    const heading = el('div', 'heading');
    heading.append(el('span', 'eyebrow', this.mode === 'selection' ? 'Выделенный текст' : 'Абзац'), el('strong', '', 'Словолупа'));
    header.append(logo, heading, button('×', 'close', () => this.onClose(), 'Закрыть анализ (Escape)'));
    const summary = el('div', 'summary');
    for (const label of [`${stats.words} слов`, `${stats.waterPercent}% воды`, stats.languages.length === 2 ? 'RU + EN' : stats.languages[0]?.toUpperCase() || 'Другой язык']) summary.append(el('span', 'pill', label));
    const tabs = el('div', 'tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Представление анализа');
    for (const [key, label] of [['map', 'Карта текста'], ['frequency', 'Частоты'], ['stats', 'Показатели']]) {
      const tab = button(label, 'tab', () => { this.tab = key; this.render(); this.shadow.getElementById(`tab-${key}`).focus({ preventScroll: true }); });
      tab.id = `tab-${key}`;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(this.tab === key));
      tab.setAttribute('aria-controls', 'lens-view'); tab.tabIndex = this.tab === key ? 0 : -1;
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const keys = ['map', 'frequency', 'stats'];
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (keys.indexOf(key) + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
        this.tab = keys[index]; this.render(); this.shadow.getElementById(`tab-${this.tab}`).focus({ preventScroll: true });
      });
      tabs.append(tab);
    }
    const body = el('div', 'body'); body.id = 'lens-view'; body.setAttribute('role', 'tabpanel'); body.setAttribute('aria-labelledby', `tab-${this.tab}`); body.tabIndex = 0;
    if (this.tab === 'map') this.renderMap(body);
    else if (this.tab === 'stats') this.renderStats(body);
    else this.renderFrequency(body);
    const footer = el('div', 'footer'); footer.append(el('span', 'local', '● Анализ на устройстве'), el('span', '', 'Snowball · RU / EN'));
    if (this.mode === 'selection') {
      header.classList.add('header-selection');
      tabs.classList.add('tabs-bottom');
      summary.classList.add('summary-bottom');
      this.panel.append(header, body, tabs, summary, footer);
    } else {
      this.panel.append(header, summary, tabs, body, footer);
    }
  }
  renderTranslation(output) {
    if (!this.translatedTokens) {
      output.textContent = this.translation;
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const token of this.translatedTokens) {
      if (!token.isWord) {
        fragment.append(document.createTextNode(token.text));
        continue;
      }
      const word = el('span', '', token.text);
      word.dataset.root = token.root;
      word.dataset.language = token.language || '';
      fragment.append(word);
    }
    output.replaceChildren(fragment);
  }

  bindWordHighlights(source, target, sourceLanguage, targetLanguage) {
    const fromEnglish = sourceLanguage === 'en';
    const highlight = fromEnglish ? 'translation-highlight' : 'original-highlight';
    const translations = this.wordTranslations;
    let hovered;
    let highlighted = [];

    function clear() {
      for (const word of highlighted) {
        word.classList.remove(highlight, 'nearby');
        if (fromEnglish) word.removeAttribute('title');
      }
      highlighted = [];
    }

    const findMatch = async (word, sourceWords, targetWords) => {
      const original = word.textContent;
      const preservedName = word.dataset.language === 'en' && targetWords.some((candidate) =>
        candidate.dataset.language === 'en' && candidate.textContent === original
      );
      let matches;
      if (preservedName) {
        matches = targetWords.filter((candidate) => candidate.dataset.language === 'en' && candidate.textContent === original);
      } else {
        if (word.dataset.language !== sourceLanguage) return;
        const key = `${sourceLanguage}:${original}`;
        if (!translations.has(key)) {
          translations.set(key, translateWord(original, sourceLanguage, targetLanguage).then((translated) =>
            new Set(analyze(translated).tokens.filter((token) => token.language === targetLanguage).map((token) => token.root))
          ).catch(() => {
            translations.delete(key);
            return new Set();
          }));
        }
        const roots = await translations.get(key);
        matches = targetWords.filter((candidate) => candidate.dataset.language === targetLanguage && roots.has(candidate.dataset.root));
      }
      if (!matches.length) return;
      let occurrence = 0;
      for (const candidate of sourceWords) {
        if (candidate === word) break;
        if (preservedName ? candidate.textContent === original : candidate.dataset.root === word.dataset.root) occurrence++;
      }
      return matches[Math.min(occurrence, matches.length - 1)];
    };

    source.addEventListener('pointerover', async (event) => {
      const word = event.target.closest('[data-root]');
      if (!word || word === hovered || !this.translatedTokens) return;
      hovered = word;
      clear();
      const sourceWords = [...source.querySelectorAll('[data-root]')];
      const targetWords = [...target.querySelectorAll('[data-root]')];
      const isCurrent = () => hovered === word && word.isConnected && target.isConnected;
      const match = await findMatch(word, sourceWords, targetWords);
      if (!isCurrent()) return;
      if (match) {
        match.classList.add(highlight);
        highlighted = [match];
      } else if (fromEnglish) {
        const index = sourceWords.indexOf(word);
        const nearby = await Promise.all([-1, 1].map(async (direction) => {
          for (let distance = 1; distance <= 3 && isCurrent(); distance++) {
            const neighbor = sourceWords[index + direction * distance];
            if (!neighbor) break;
            const candidate = await findMatch(neighbor, sourceWords, targetWords);
            if (candidate) return candidate;
          }
        }));
        if (!isCurrent()) return;
        highlighted = [...new Set(nearby.filter(Boolean))];
        for (const candidate of highlighted) {
          candidate.classList.add(highlight, 'nearby');
          candidate.title = 'Соответствие соседнего слова';
        }
      }
    });
    source.addEventListener('pointerout', (event) => {
      if (!hovered || hovered.contains(event.relatedTarget)) return;
      hovered = null;
      clear();
    });
  }

  renderMap(body) {
    let output;
    if (this.translation) {
      const section = el('section', 'translation');
      output = el('div', 'translation-text');
      output.setAttribute('role', 'status');
      this.renderTranslation(output);
      section.append(el('strong', '', 'Перевод на русский'), output);
      body.append(section);
    }
    const legend = el('div', 'legend'); legend.append(el('span', '', 'реже'), el('b', '', 'чаще → крупнее'));
    const toggle = button('Подсветить воду', 'water-toggle', () => {
      this.highlightWater = !this.highlightWater;
      toggle.setAttribute('aria-pressed', String(this.highlightWater));
      text.classList.toggle('show-water', this.highlightWater);
      this.onWaterChange(this.highlightWater);
    });
    toggle.setAttribute('aria-pressed', String(this.highlightWater));
    const actions = el('div', 'legend-actions');
    actions.append(button('Объяснить как ребенку', 'explain-button', () => this.showExplanation()), toggle);
    legend.append(actions);
    const text = el('div', `text${this.highlightWater ? ' show-water' : ''}`);
    text.setAttribute('dir', 'auto');
    if (output) {
      this.bindWordHighlights(text, output, 'en', 'ru');
      this.bindWordHighlights(output, text, 'ru', 'en');
    }
    const fragment = document.createDocumentFragment();
    for (const token of this.result.tokens) {
      if (!token.isWord) { fragment.append(document.createTextNode(token.text)); continue; }
      const span = el('span', `word${token.water ? ' water' : ''}`, token.text);
      span.style.fontSize = `${token.fontSize}px`;
      if (token.topFrequency) span.classList.add('top-frequency');
      else span.style.fontWeight = token.fontWeight;
      span.dataset.root = token.root; span.dataset.count = token.count; span.dataset.category = token.category;
      span.dataset.language = token.language || '';
      fragment.append(span);
    }
    text.append(fragment);
    text.addEventListener('pointerover', (event) => {
      const word = event.target.closest('.word');
      if (word) this.showWordInfo(word, event);
    });
    text.addEventListener('pointermove', (event) => {
      const word = event.target.closest('.word');
      if (word) this.showWordInfo(word, event);
    });
    text.addEventListener('pointerout', (event) => {
      const word = event.target.closest('.word');
      if (word && !word.contains(event.relatedTarget)) this.hideWordInfo();
    });
    body.append(legend, text, el('p', 'hint', 'Наведите на слово: основа и число повторений. Служебные слова приглушены.'));
    if (output) body.append(el('p', 'hint', 'Жёлтая подсветка показывает соответствие в переводе, зелёная — в оригинале. Светло-жёлтым отмечены переводы соседних слов.'));
  }
  renderStats(body) {
    const s = this.result.stats;
    const cards = el('div', 'stats');
    for (const [value, label] of [[s.words, 'Всего слов'], [s.coreWords, 'Слов в ядре'], [`${s.waterPercent}%`, 'Водность'], [s.nausea.toFixed(2), 'Классическая тошнота']]) {
      const card = el('div', 'stat'); card.append(el('b', '', value), el('span', '', label)); cards.append(card);
    }
    const detail = el('div', 'detail');
    for (const [label, value] of [['Символов с пробелами', s.characters], ['Символов без пробелов', s.charactersWithoutSpaces], ['Уникальных основ', s.vocabulary], ['Уникальных основ ядра', s.coreVocabulary], ['Местоимений', s.categories.pronoun], ['Междометий', s.categories.interjection], ['Других стоп-слов', s.categories.stopword], ['Коротких слов', s.categories.short]]) {
      const row = el('div'); row.append(el('span', '', label), el('strong', '', value)); detail.append(row);
    }
    body.append(cards, detail, el('p', 'note', 'Вода = стоп-слова и слова короче 3 букв / все слова. Тошнота = √ максимальной частоты, включая стоп-слова. Основа Snowball приближает морфологический корень. Словари могут отличаться от Istio.'));
  }
  renderFrequency(body) {
    const coreGroups = this.result.frequencies.filter((group) => group.coreCount).sort((a, b) => b.coreCount - a.coreCount).slice(0, 10);
    body.append(el('div', 'legend', '10 самых частых основ ядра'));
    if (!coreGroups.length) { body.append(el('div', 'empty', 'В этом тексте только стоп-слова и короткие слова.')); return; }
    const table = el('table');
    const head = el('thead'); const headRow = el('tr');
    for (const title of ['Словоформы', 'Повторы', '% текста', '% ядра']) { const th = el('th', '', title); th.scope = 'col'; headRow.append(th); }
    head.append(headRow); table.append(head);
    const tbody = el('tbody');
    for (const group of coreGroups) {
      const row = el('tr'); const word = el('td');
      word.append(el('strong', '', group.label), el('span', 'forms', group.forms.join(' · ')));
      row.append(word, el('td', '', group.coreCount), el('td', '', group.density.toFixed(1)), el('td', '', group.coreDensity.toFixed(1)));
      tbody.append(row);
    }
    table.append(tbody); body.append(table, el('p', 'note', 'Словоформы объединены по основе Snowball. Проценты усечены до одного знака.'));
  }
}
