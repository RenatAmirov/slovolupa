import { getDocument, GlobalWorkerOptions } from './pdfjs/pdf.min.mjs';
import { createDjvuReader } from './djvu-reader.mjs';
GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const input = document.getElementById('file');
const status = document.getElementById('status');
const output = document.getElementById('document');
let generation = 0;
let task;
let pageObserver;

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
      const title = document.createElement('h2');
      title.textContent = `Страница ${number}`;
      section.append(title);
      const columns = document.createElement('div');
      columns.className = 'page-columns';
      const text = document.createElement('div');
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
