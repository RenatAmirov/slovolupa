import { getDocument, GlobalWorkerOptions } from './pdfjs/pdf.min.mjs';
import { createDjvuReader } from './djvu-reader.mjs';
GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const input = document.getElementById('file');
const status = document.getElementById('status');
const output = document.getElementById('document');
const saveBookmark = document.getElementById('save-bookmark');
const openBookmark = document.getElementById('open-bookmark');
const randomWordButton = document.getElementById('random-word');
let generation = 0;
let task;
let pageObserver;
let openedDocument;

function bookmarkFilename(filename) {
  return `${filename.replace(/\.[^.]+$/u, '') || filename}.json`;
}

function currentLocation() {
  const sections = [...output.querySelectorAll('section[data-page]')];
  const section = sections.find((node) => node.getBoundingClientRect().bottom > 0) || sections.at(-1);
  if (!section) return { page: 1, offset: 0 };
  return {
    page: Number(section.dataset.page),
    offset: Math.max(0, Math.round(-section.getBoundingClientRect().top)),
  };
}

function bookmarkData() {
  const { file, format, pages } = openedDocument;
  return {
    format: 'slovolupa-bookmark', version: 1,
    document: { name: file.name, size: file.size, lastModified: file.lastModified, type: format },
    location: currentLocation(), savedAt: new Date().toISOString(),
    pages,
  };
}

function validateBookmark(data) {
  const expected = openedDocument?.file;
  if (!data || data.format !== 'slovolupa-bookmark' || data.version !== 1 || !expected ||
      data.document?.name !== expected.name || data.document?.size !== expected.size ||
      data.document?.lastModified !== expected.lastModified || !Number.isInteger(data.location?.page) ||
      !Number.isFinite(data.location?.offset)) {
    throw new Error('Эта закладка не относится к открытому файлу. Сначала выберите соответствующий PDF или DjVu.');
  }
}

function restoreBookmark(data) {
  validateBookmark(data);
  const section = output.querySelector(`section[data-page="${data.location.page}"]`);
  if (!section) throw new Error('В закладке указана страница, которой нет в этом файле.');
  const top = window.scrollY + section.getBoundingClientRect().top + Math.max(0, data.location.offset);
  window.scrollTo({ top, behavior: 'smooth' });
  status.textContent = `Открыта закладка: страница ${data.location.page}.`;
}

saveBookmark.addEventListener('click', async () => {
  if (!openedDocument) return;
  const name = bookmarkFilename(openedDocument.file.name);
  const content = JSON.stringify(bookmarkData(), null, 2);
  try {
    if (!window.showSaveFilePicker) throw new Error('unsupported');
    const handle = await window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: 'Закладка Словолупы', accept: { 'application/json': ['.json'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    status.textContent = `Закладка сохранена как ${handle.name}. Выберите папку с исходным файлом, чтобы они лежали рядом.`;
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (error.message !== 'unsupported') {
      status.textContent = 'Не удалось сохранить закладку.';
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    status.textContent = `Закладка скачана как ${name}. Переместите её в папку с исходным файлом.`;
  }
});

openBookmark.addEventListener('click', async () => {
  if (!openedDocument) return;
  try {
    if (!window.showOpenFilePicker) throw new Error('unsupported');
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Закладка Словолупы', accept: { 'application/json': ['.json'] } }],
    });
    restoreBookmark(JSON.parse(await (await handle.getFile()).text()));
  } catch (error) {
    if (error.name === 'AbortError') return;
    status.textContent = error instanceof SyntaxError ? 'Файл закладки содержит некорректный JSON.' : error.message || 'Не удалось открыть закладку.';
  }
});

function rangeForTextOffsets(element, start, end) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node, offset = 0, startNode, endNode, startOffset, endOffset;
  while ((node = walker.nextNode())) {
    const nextOffset = offset + node.textContent.length;
    if (!startNode && start >= offset && start <= nextOffset) {
      startNode = node; startOffset = start - offset;
    }
    if (end >= offset && end <= nextOffset) {
      endNode = node; endOffset = end - offset;
      break;
    }
    offset = nextOffset;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset); range.setEnd(endNode, endOffset);
  return range;
}

function jumpToRandomWord() {
  if (!openedDocument) return;
  const paragraphs = [...output.querySelectorAll('.analysis-text > p')].filter((paragraph) => /\p{L}/u.test(paragraph.textContent));
  if (!paragraphs.length) {
    status.textContent = 'В документе не найдено слов для перехода.';
    return;
  }
  const paragraph = paragraphs[Math.floor(Math.random() * paragraphs.length)];
  const words = [...paragraph.textContent.matchAll(/\p{L}+(?:[’'-]\p{L}+)*/gu)];
  const match = words[Math.floor(Math.random() * words.length)];
  const range = rangeForTextOffsets(paragraph, match.index, match.index + match[0].length);
  if (!range) return;
  paragraph.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
  requestAnimationFrame(() => {
    const selection = getSelection();
    selection?.removeAllRanges();
    // This sequence mirrors a mouse double-click: the content script sees the
    // selection on pointerup and opens the same analysis popup as for a user.
    paragraph.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerType: 'mouse', button: 0, isPrimary: true }));
    selection?.addRange(range);
    paragraph.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerType: 'mouse', button: 0, isPrimary: true }));
    paragraph.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true, button: 0, detail: 2 }));
    const page = paragraph.closest('section')?.dataset.page;
    status.textContent = `Случайное слово: «${match[0]}»${page ? ` · страница ${page}` : ''}.`;
  });
}

randomWordButton.addEventListener('click', jumpToRandomWord);

function pagePreview(page, number, observer, previews) {
  const preview = document.createElement('div');
  preview.className = 'pdf-preview';
  preview.style.aspectRatio = `${page.width} / ${page.height}`;
  preview.textContent = 'Загрузка страницы…';
  previews.set(preview, { page, number, render: null });
  observer.observe(preview);
  return preview;
}

function observePreviews(previews) {
  return new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      const state = previews.get(target);
      if (!isIntersecting) {
        state.render?.cancel();
        state.render = null;
        target.replaceChildren('Загрузка страницы…');
        continue;
      }
      if (state.render || target.querySelector('canvas')) continue;
      const { page, number } = state;
      const scale = Math.min(1400 / page.width, 2000 / page.height, 2);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(page.width * scale));
      canvas.height = Math.max(1, Math.ceil(page.height * scale));
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Оригинал страницы ${number}`);
      const render = page.render(canvas, scale);
      state.render = render;
      render.promise.then(() => {
        if (state.render === render && target.isConnected) target.replaceChildren(canvas);
      }, () => {
        if (state.render === render && target.isConnected) target.replaceChildren('Не удалось отобразить оригинал страницы.');
      }).finally(() => {
        if (state.render === render) state.render = null;
      });
    }
  }, { rootMargin: '400px 0px' });
}

// PDF has positioned glyph runs rather than explicit paragraphs. Keep the
// document's extraction order and start a paragraph at larger line gaps.
function paragraphs(items) {
  const result = [];
  let text = '', previous;
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    if (item.str) {
      if (previous) {
        const [, , , , x, y] = item.transform;
        const [, , , , oldX, oldY] = previous.transform;
        const height = Math.max(item.height, previous.height, 1);
        if (Math.abs(y - oldY) > 1.6 * height) {
          if (text.trim()) result.push(text.trim());
          text = '';
        } else if (text && !/\s$/u.test(text) && !/^\s/u.test(item.str) &&
            (previous.hasEOL || Math.abs(y - oldY) > height / 2 || x - oldX - previous.width > height * .15)) {
          text += ' ';
        }
      }
      text += item.str;
      previous = item;
    } else if (item.hasEOL && text && !/\s$/u.test(text)) text += ' ';
  }
  if (text.trim()) result.push(text.trim());
  return result;
}

function createPdfReader(buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer), isEvalSupported: false,
    cMapUrl: new URL('./pdfjs/cmaps/', import.meta.url).href, cMapPacked: true,
    standardFontDataUrl: new URL('./pdfjs/standard_fonts/', import.meta.url).href,
    wasmUrl: new URL('./pdfjs/wasm/', import.meta.url).href,
    iccUrl: new URL('./pdfjs/iccs/', import.meta.url).href,
  });
  return {
    destroy: () => loadingTask.destroy(),
    promise: loadingTask.promise.then((pdf) => ({
      numPages: pdf.numPages,
      async getPage(number) {
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        const { width, height } = page.getViewport({ scale: 1 });
        return {
          width, height, blocks: paragraphs(content.items),
          render(canvas, scale) {
            const job = page.render({ canvas, viewport: page.getViewport({ scale }) });
            return {
              cancel: () => job.cancel(),
              promise: job.promise.finally(() => page.cleanup()),
            };
          },
        };
      },
    })),
  };
}

input.addEventListener('change', async () => {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const run = ++generation;
  const old = task;
  task = null;
  openedDocument = null;
  saveBookmark.disabled = true;
  openBookmark.disabled = true;
  randomWordButton.disabled = true;
  pageObserver?.disconnect();
  output.replaceChildren();
  let format = /\.djvu?$/i.test(file.name) ? 'DjVu' : 'PDF';
  status.textContent = `Читаем ${format}…`;
  try {
    await old?.destroy().catch(() => {});
    const data = await file.arrayBuffer();
    if (run !== generation) return;
    if (data.byteLength >= 4 && new DataView(data).getUint32(0) === 0x41542654) format = 'DjVu';
    task = format === 'DjVu' ? createDjvuReader(data) : createPdfReader(data);
    const documentFile = await task.promise;
    if (run !== generation) return;
    const previews = new WeakMap();
    const observer = observePreviews(previews);
    pageObserver = observer;
    let pagesWithText = 0;
    for (let number = 1; number <= documentFile.numPages; number++) {
      const page = await documentFile.getPage(number);
      if (run !== generation) return;
      const { blocks } = page;
      const section = document.createElement('section');
      section.dataset.page = String(number);
      const title = document.createElement('h2');
      title.textContent = `Страница ${number}`;
      section.append(title);
      const columns = document.createElement('div');
      columns.className = 'page-columns';
      const text = document.createElement('div');
      text.className = 'analysis-text';
      const textTitle = document.createElement('h3');
      textTitle.textContent = 'Текст для анализа';
      text.append(textTitle);
      columns.append(pagePreview(page, number, observer, previews), text);
      section.append(columns);
      if (blocks.length) pagesWithText++;
      else {
        const empty = document.createElement('div');
        empty.textContent = 'На этой странице нет доступного текста.';
        text.append(empty);
      }
      for (const block of blocks) {
        const p = document.createElement('p');
        p.textContent = block;
        text.append(p);
      }
      output.append(section);
      status.textContent = `${file.name} · ${number} из ${documentFile.numPages} стр.`;
    }
    status.textContent = pagesWithText
      ? `${file.name} · страниц с текстом: ${pagesWithText} из ${documentFile.numPages}`
      : `${file.name} · текстовый слой не найден. Для скана потребуется OCR.`;
    openedDocument = { file, format, pages: documentFile.numPages };
    saveBookmark.disabled = false;
    openBookmark.disabled = false;
    randomWordButton.disabled = !pagesWithText;
  } catch (error) {
    if (run !== generation) return;
    status.textContent = error.name === 'PasswordException'
      ? 'Этот PDF защищён паролем. Откройте копию без пароля.'
      : error.message?.startsWith('Для многофайлового DjVu')
        ? error.message
        : `Не удалось прочитать ${format}. Проверьте файл и попробуйте снова.`;
    if (!output.childElementCount) {
      pageObserver?.disconnect();
      const failed = task;
      task = null;
      await failed?.destroy().catch(() => {});
    }
  }
});
input.disabled = false;
