import { analyze } from './analyzer.cjs';
import { translateEnglish, translateWord } from './translation.mjs';
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
.text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; color: #204b37; font-size: 16px; font-family: 'Slovolupa Map', 'Segoe UI Variable', system-ui, sans-serif; }
.word { border-radius: 3px; } .word:hover { background: #deebdc; } .water { color: #7e887e; } .show-water .water { background: #faecd2; color: #8e662c; }
.word.top-frequency { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; }
.translation { padding: 12px 15px; margin: 0 0 16px; background: #edf3ec; border-radius: 9px; }
.translation strong { display: block; margin-bottom: 4px; }
.translation-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.translation-text mark { background: #ffe052; color: inherit; border-radius: 3px; }
.translation-text mark.nearby { background: #fff1a8; }
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
  if (label) node.setAttribute('aria-label', label);
  node.addEventListener('click', action);
  return node;
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
    this.shadow.append(style, this.panel);
    this.tab = 'map';
    this.visible = false;
  }
  contains(event) { return event.composedPath().includes(this.host); }
  show(result, mode, highlightWater) {
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
        if (output) output.textContent = message;
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
  hide() { this.visible = false; this.host.remove(); }
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
      tabs.classList.add('tabs-bottom');
      summary.classList.add('summary-bottom');
      this.panel.append(header, body, tabs, summary, footer);
    } else {
      this.panel.append(header, summary, tabs, body, footer);
    }
  }
  renderMap(body) {
    let output;
    if (this.translation) {
      const section = el('section', 'translation');
      output = el('div', 'translation-text', this.translation);
      output.setAttribute('role', 'status');
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
    legend.append(toggle);
    const text = el('div', `text${this.highlightWater ? ' show-water' : ''}`);
    text.setAttribute('dir', 'auto');
    let hovered;
    if (output) {
      const findMatch = async (word, words, tokens) => {
        const original = word.textContent;
        const nameMatches = tokens.some((token) => token.isWord && token.language === 'en' && token.text === original);
        let roots;
        if (!nameMatches) {
          if (!this.wordTranslations.has(original)) {
            this.wordTranslations.set(original, translateWord(original).then((translated) =>
              new Set(analyze(translated).tokens.filter((token) => token.language === 'ru').map((token) => token.root))
            ).catch(() => new Set()));
          }
          roots = await this.wordTranslations.get(original);
        }
        let occurrence = 0;
        for (const candidate of words) {
          if (candidate === word) break;
          if (nameMatches ? candidate.textContent === original : candidate.dataset.root === word.dataset.root) occurrence++;
        }
        const matches = tokens.filter((token) => nameMatches ? token.isWord && token.text === original
          : token.language === 'ru' && roots.has(token.root));
        return matches[Math.min(occurrence, matches.length - 1)];
      };
      text.addEventListener('pointerover', async (event) => {
        const word = event.target.closest('.word');
        if (!word || word === hovered) return;
        hovered = word;
        output.textContent = this.translation;
        const tokens = this.translatedTokens;
        if (!tokens) return;
        const words = [...text.querySelectorAll('.word')];
        const index = words.indexOf(word);
        const isCurrent = () => hovered === word && output.isConnected && this.translatedTokens === tokens;
        const match = await findMatch(word, words, tokens);
        if (!isCurrent()) return;
        let nearby = [];
        if (!match) {
          nearby = await Promise.all([-1, 1].map(async (direction) => {
            for (let distance = 1; distance <= 3 && isCurrent(); distance++) {
              const neighbor = words[index + direction * distance];
              if (!neighbor) break;
              const candidate = await findMatch(neighbor, words, tokens);
              if (candidate) return candidate;
            }
          }));
        }
        if (!isCurrent()) return;
        const highlighted = document.createDocumentFragment();
        for (const token of tokens) {
          if (token === match) highlighted.append(el('mark', '', token.text));
          else if (nearby.includes(token)) {
            const hint = el('mark', 'nearby', token.text);
            hint.title = 'Соответствие соседнего слова';
            highlighted.append(hint);
          } else highlighted.append(document.createTextNode(token.text));
        }
        output.replaceChildren(highlighted);
      });
      text.addEventListener('pointerout', (event) => {
        if (!hovered || hovered.contains(event.relatedTarget)) return;
        hovered = null;
        output.textContent = this.translation;
      });
    }
    const fragment = document.createDocumentFragment();
    for (const token of this.result.tokens) {
      if (!token.isWord) { fragment.append(document.createTextNode(token.text)); continue; }
      const span = el('span', `word${token.water ? ' water' : ''}`, token.text);
      span.style.fontSize = `${token.fontSize}px`;
      if (token.topFrequency) span.classList.add('top-frequency');
      else span.style.fontWeight = token.fontWeight;
      span.dataset.root = token.root; span.dataset.count = token.count; span.dataset.category = token.category;
      span.title = `${CATEGORY_LABEL[token.category]} · основа «${token.root}» · ${token.count} повтор. в тексте`;
      fragment.append(span);
    }
    text.append(fragment);
    body.append(legend, text, el('p', 'hint', 'Наведите на слово: основа и число повторений. Служебные слова приглушены.'));
    if (output) body.append(el('p', 'hint', 'Яркая подсветка показывает найденное соответствие. Светлая указывает на переводы соседних слов.'));
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
