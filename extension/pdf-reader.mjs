import { getDocument, GlobalWorkerOptions } from './pdfjs/pdf.min.mjs';
GlobalWorkerOptions.workerSrc = new URL('./pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const input = document.getElementById('file');
const status = document.getElementById('status');
const output = document.getElementById('document');
let generation = 0;
let task;
let pageObserver;

function pagePreview(page, observer, previews) {
  const viewport = page.getViewport({ scale: 1 });
  const preview = document.createElement('div');
  preview.className = 'pdf-preview';
  preview.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
  preview.textContent = 'Загрузка страницы…';
  previews.set(preview, { page, viewport, render: null });
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
      const { page, viewport } = state;
      const scale = Math.min(1400 / viewport.width, 2000 / viewport.height, 2);
      const scaled = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(scaled.width));
      canvas.height = Math.max(1, Math.ceil(scaled.height));
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Оригинал страницы ${page.pageNumber}`);
      const render = page.render({ canvas, viewport: scaled });
      state.render = render;
      render.promise.then(() => {
        if (state.render === render && target.isConnected) target.replaceChildren(canvas);
      }, () => {
        if (state.render === render && target.isConnected) target.replaceChildren('Не удалось отобразить оригинал страницы.');
      }).finally(() => {
        if (state.render === render) state.render = null;
        page.cleanup();
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

input.addEventListener('change', async () => {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const run = ++generation;
  const old = task;
  task = null;
  pageObserver?.disconnect();
  output.replaceChildren();
  status.textContent = 'Читаем PDF…';
  try {
    await old?.destroy().catch(() => {});
    const data = new Uint8Array(await file.arrayBuffer());
    if (run !== generation) return;
    task = getDocument({
      data, isEvalSupported: false,
      cMapUrl: new URL('./pdfjs/cmaps/', import.meta.url).href, cMapPacked: true,
      standardFontDataUrl: new URL('./pdfjs/standard_fonts/', import.meta.url).href,
      wasmUrl: new URL('./pdfjs/wasm/', import.meta.url).href,
      iccUrl: new URL('./pdfjs/iccs/', import.meta.url).href,
    });
    const pdf = await task.promise;
    if (run !== generation) return;
    const previews = new WeakMap();
    const observer = observePreviews(previews);
    pageObserver = observer;
    let pagesWithText = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      if (run !== generation) return;
      const blocks = paragraphs(content.items);
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
      columns.append(pagePreview(page, observer, previews), text);
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
      status.textContent = `${file.name} · ${number} из ${pdf.numPages} стр.`;
    }
    status.textContent = pagesWithText
      ? `${file.name} · страниц с текстом: ${pagesWithText} из ${pdf.numPages}`
      : `${file.name} · текстовый слой не найден. Для скана потребуется OCR.`;
  } catch (error) {
    if (run !== generation) return;
    status.textContent = error.name === 'PasswordException'
      ? 'Этот PDF защищён паролем. Откройте копию без пароля.'
      : 'Не удалось прочитать PDF. Проверьте файл и попробуйте снова.';
    if (!output.childElementCount) {
      pageObserver?.disconnect();
      const failed = task;
      task = null;
      await failed?.destroy().catch(() => {});
    }
  }
});
input.disabled = false;
