import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDemoServer } from '../scripts/serve.mjs';

const server = createDemoServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/?native=1`;
const profile = await mkdtemp(path.join(os.tmpdir(), 'word-lens-test-'));
const extension = path.resolve('extension');
const localChromium = path.resolve('.cache/chromium/chrome-win64/chrome.exe');
const browserExecutable = process.env.WORD_LENS_CHROMIUM_EXECUTABLE || (existsSync(localChromium) ? localChromium : undefined);
await mkdir('test-results', { recursive: true });
let context;
let passed = 0;
async function check(name, run) {
  await run();
  console.log(`✓ ${name}`);
  passed++;
}
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 },
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  const overlay = page.locator('word-lens-overlay');
  const panel = overlay.locator('.panel');
  async function reset() {
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.getSelection().removeAllRanges());
    await page.mouse.move(3, 3);
    await page.waitForTimeout(250);
  }
  async function select(selector = '#russian') {
    await page.mouse.move(3, 3);
    await page.mouse.down();
    await page.evaluate((selector) => {
      const node = document.querySelector(selector);
      const range = document.createRange(); range.selectNodeContents(node);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    }, selector);
    await page.mouse.up();
    await panel.waitFor();
  }
  async function assertBounds() {
    await panel.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
    const box = await panel.boundingBox(); const viewport = page.viewportSize();
    const margins = [box.x - viewport.width / 2, box.y, viewport.width - box.x - box.width, viewport.height - box.y - box.height];
    assert.ok(margins.every((margin) => Math.abs(margin - 10) < 1), JSON.stringify({ box, viewport }));
  }
  await check('Настоящее расширение MV3 загружается и показывает абзац только по щелчку', async () => {
    await page.locator('#russian').hover();
    await page.waitForTimeout(650);
    assert.equal(await overlay.count(), 0);
    await page.locator('#russian').click();
    await panel.waitFor();
    assert.equal(await overlay.locator('.eyebrow').textContent(), 'Абзац');
    assert.equal(await overlay.locator('.text').textContent(), await page.locator('#russian').innerText());
    await assertBounds();
  });
  await check('Вкладки и подсветка работают; щелчок вне окна закрывает его', async () => {
    await overlay.getByRole('tab', { name: 'Частоты', exact: true }).click();
    assert.ok(await overlay.locator('tbody tr').count());
    await overlay.getByRole('tab', { name: 'Показатели', exact: true }).click();
    assert.equal(await overlay.locator('.stat').count(), 4);
    await overlay.getByRole('tab', { name: 'Карта текста', exact: true }).click();
    await overlay.getByRole('button', { name: 'Подсветить воду' }).click();
    assert.equal(await overlay.locator('.text').getAttribute('class'), 'text show-water');
    await page.mouse.click(3, 3); await page.waitForTimeout(100);
    assert.equal(await overlay.count(), 0);
  });
  await check('При перетаскивании мышью окно появляется только после отпускания кнопки', async () => {
    await reset();
    const positions = await page.locator('#russian').evaluate((node) => {
      const text = node.firstChild;
      const start = document.createRange(); start.setStart(text, 0); start.setEnd(text, 1);
      const end = document.createRange(); end.setStart(text, 55); end.setEnd(text, 56);
      const a = start.getBoundingClientRect(), b = end.getBoundingClientRect();
      return { x1: a.left + 1, y1: a.top + a.height / 2, x2: b.right - 1, y2: b.top + b.height / 2 };
    });
    await page.mouse.move(positions.x1, positions.y1);
    await page.mouse.down();
    await page.mouse.move(positions.x2, positions.y2, { steps: 12 });
    await page.waitForTimeout(700);
    assert.equal(await overlay.count(), 0);
    assert.ok((await page.evaluate(() => getSelection().toString())).length > 20);
    await page.mouse.up();
    await panel.waitFor();
    assert.equal(await overlay.locator('.eyebrow').textContent(), 'Выделенный текст');
    assert.equal(await overlay.locator('.text').textContent(), await page.evaluate(() => getSelection().toString()));
  });
  await check('Окно выделения сохраняется при движении курсора, прокрутке и снятии выделения программой', async () => {
    await page.mouse.move(2, 2); await page.waitForTimeout(500);
    await page.evaluate(() => { getSelection().removeAllRanges(); window.scrollBy(0, 250); });
    await page.waitForTimeout(300);
    assert.equal(await panel.count(), 1);
    await assertBounds();
    await page.keyboard.press('x');
    await page.waitForTimeout(300);
    assert.equal(await overlay.count(), 0);
    await page.evaluate(() => window.scrollTo(0, 0));
  });
  await check('Любая клавиша вне окна и щелчок вне окна закрывают выделение без повторного появления', async () => {
    await reset(); await select();
    await page.keyboard.press('a'); await page.waitForTimeout(500);
    assert.equal(await overlay.count(), 0);
    await reset(); await select();
    await page.mouse.click(3, 3); await page.waitForTimeout(500);
    assert.equal(await overlay.count(), 0);
  });
  await check('Выделение клавиатурой не открывает окно', async () => {
    await reset();
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+a');
    assert.ok(await page.evaluate(() => getSelection().toString()));
    assert.equal(await overlay.count(), 0);
  });
  await check('Пока существует выделение, наведение на другой абзац его не заменяет', async () => {
    await reset(); await select('#english');
    await page.keyboard.press('Escape');
    await page.locator('#russian').hover(); await page.waitForTimeout(700);
    assert.equal(await overlay.count(), 0);
  });
  await check('Окно удерживается в маленьком окне браузера, длинный текст прокручивается', async () => {
    await reset();
    await page.evaluate(() => { const p = document.createElement('p'); p.id = 'long'; p.textContent = 'Текст, тексты, текстом! Мысль... '.repeat(700); document.body.append(p); });
    await select('#long');
    const selectedLongText = await page.evaluate(() => getSelection().toString());
    await page.setViewportSize({ width: 340, height: 300 });
    await page.waitForTimeout(150);
    await assertBounds();
    assert.ok((await overlay.locator('.text').textContent()) === selectedLongText, 'Длинное выделение должно сохраняться целиком');
    assert.ok(await overlay.locator('.body').evaluate((node) => node.scrollHeight > node.clientHeight));
    const summary = overlay.locator('.summary');
    assert.deepEqual(await summary.locator('.pill').allTextContents(), ['2800 слов', '0% воды', 'RU']);
    const summaryBox = await summary.boundingBox();
    const bodyBox = await overlay.locator('.body').boundingBox();
    const tabsBox = await overlay.getByRole('tablist').boundingBox();
    assert.ok(tabsBox.y >= bodyBox.y + bodyBox.height - 1);
    assert.ok(summaryBox.y >= tabsBox.y + tabsBox.height - 1);
    const frequencyTab = overlay.getByRole('tab', { name: 'Частоты', exact: true });
    await frequencyTab.click();
    assert.equal(await frequencyTab.getAttribute('aria-selected'), 'true');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => { document.getElementById('long').remove(); window.scrollTo(0, 0); });
  });
  await check('Произвольный HTML из текста отображается безопасно; div и пунктуация поддерживаются', async () => {
    await reset();
    await page.locator('#mixed').evaluate((node) => { node.textContent = '<img src=x onerror="window.pwned=1"> Текст, тексты… Text!'; });
    await select('#mixed');
    assert.equal(await overlay.locator('.text').textContent(), await page.locator('#mixed').textContent());
    assert.equal(await overlay.locator('img').count(), 0);
    assert.equal(await page.evaluate(() => window.pwned), undefined);
  });
  await check('Поля ввода не вызывают анализ', async () => {
    await reset();
    await page.locator('#private-text').click(); await page.waitForTimeout(700);
    assert.equal(await overlay.count(), 0);
    await page.locator('#private-text').focus(); await page.keyboard.press('Control+a');
    await page.waitForTimeout(300); assert.equal(await overlay.count(), 0);
  });
  await check('Настройки расширения сохраняются и применяются к уже открытой странице', async () => {
    const manager = await context.newPage();
    await manager.goto('chrome://extensions');
    const item = manager.locator('extensions-item').filter({ hasText: 'Словолупа' });
    await item.waitFor();
    const id = await item.getAttribute('id');
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.locator('#enabled').uncheck();
    await popup.getByRole('status').filter({ hasText: 'Настройки сохранены' }).waitFor();
    await reset(); await page.locator('#russian').click(); await page.waitForTimeout(700);
    assert.equal(await overlay.count(), 0);
    await popup.locator('#enabled').check();
    await page.mouse.move(3, 3); await page.locator('#russian').click(); await panel.waitFor();
    await check('Локальный PDF открывается из меню; щелчок анализирует текст PDF', async () => {
      const fixture = await context.newPage();
      await fixture.setContent(`
        <meta charset="utf-8">
        <p>Текст, тексты, текстом! Мысль.</p><p>Write, writes, writing! Idea.</p>
        <table style="border-collapse:collapse;background:#f1c84c"><tr>
          <td style="border:1px solid;padding:12px">Год</td><td style="border:1px solid;padding:12px">2026</td>
        </tr></table>
        <svg width="200" height="110" aria-label="Диаграмма">
          <rect x="10" y="35" width="50" height="65" fill="#287842"/>
          <rect x="75" y="5" width="50" height="95" fill="#287842"/>
        </svg>
        <img alt="Иллюстрация" width="100" height="60"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='60'%3E%3Crect width='100' height='60' fill='%233c6eb4'/%3E%3C/svg%3E">
      `);
      const buffer = await fixture.pdf({ printBackground: true });
      await fixture.close();
      const opened = context.waitForEvent('page');
      await popup.getByRole('link', { name: /Открыть PDF/ }).click();
      const reader = await opened;
      reader.on('pageerror', (error) => console.error(error));
      await reader.locator('#file:enabled').waitFor({ timeout: 10000 });
      await reader.locator('#file').setInputFiles({ name: 'example.pdf', mimeType: 'application/pdf', buffer });
      const first = reader.locator('#document p').first();
      await first.waitFor({ timeout: 10000 });
      assert.match(await first.textContent(), /Текст, тексты, текстом!/u);
      assert.match(await reader.locator('#document').textContent(), /Write, writes, writing!/u);
      const canvas = reader.getByRole('img', { name: 'Оригинал страницы 1' });
      await canvas.waitFor({ timeout: 10000 });
      const renderedColors = await canvas.evaluate((node) => {
        const { data } = node.getContext('2d').getImageData(0, 0, node.width, node.height);
        const palette = [[241, 200, 76], [40, 120, 66], [60, 110, 180]];
        const found = new Set();
        for (let i = 0; i < data.length && found.size < palette.length; i += 4) {
          for (const [index, color] of palette.entries()) {
            if (color.every((channel, offset) => Math.abs(data[i + offset] - channel) < 4)) found.add(index);
          }
        }
        return found.size;
      });
      assert.equal(renderedColors, 3, 'В оригинале видны таблица, диаграмма и иллюстрация');
      await reader.screenshot({ path: 'test-results/pdf-preview.png' });
      await first.click();
      const map = reader.locator('word-lens-overlay .text');
      await map.waitFor();
      assert.equal(await map.locator('[data-root="текст"][data-count="3"]').count(), 3);
      await reader.keyboard.press('Escape');
      await check('DjVu сохраняет оригинал страниц и поддерживает анализ встроенного текста', async () => {
        const assets = path.resolve('node_modules/djvujs-dist/library/assets');
        await reader.locator('#file').setInputFiles(path.join(assets, 'DjVu3Spec_5-10.djvu'));
        const status = reader.getByRole('status').filter({ hasText: 'страниц с текстом:' });
        await status.waitFor({ timeout: 15000 });
        assert.equal(await reader.locator('#document section').count(), 6);
        const preview = reader.getByRole('img', { name: 'Оригинал страницы 1', exact: true });
        await preview.waitFor({ timeout: 15000 });
        assert.ok(await preview.evaluate((canvas) => {
          const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
          return data.some((value, index) => index % 4 === 0 && value < 180);
        }), 'В оригинале DjVu видны элементы страницы');
        await reader.screenshot({ path: 'test-results/djvu-preview.png' });
        const paragraph = reader.locator('#document section p').filter({ hasText: /[A-Za-z]{3}/ }).first();
        const original = await paragraph.textContent();
        await paragraph.click();
        await map.waitFor();
        assert.equal(await map.textContent(), original);
        await reader.keyboard.press('Escape');

        await reader.locator('#file').setInputFiles(path.join(assets, 'boy_jb2_rotate90.djvu'));
        await reader.getByRole('status').filter({ hasText: 'текстовый слой не найден' }).waitFor();
        await preview.waitFor();
        assert.equal(await reader.locator('#document section').count(), 1);
        assert.equal(await reader.locator('#document p').count(), 0);
        assert.ok(await preview.evaluate((canvas) => canvas.width > 0 && canvas.height > 0));
      });
      await reader.close();
    });
    await popup.close(); await manager.close();
  });
  await check('Нет ошибок JavaScript на странице', async () => assert.deepEqual(errors, []));
  await check('Наведение подсвечивает соответствующие слова в обе стороны', async () => {
    const fixture = await context.newPage();
    await fixture.setContent('<p id="original">She buys books and works with books.</p>');
    await fixture.evaluate(() => {
      Object.defineProperty(globalThis, 'Translator', {
        value: {
          availability: async () => 'available',
          create: async ({ sourceLanguage }) => ({
            translate: async (text) => sourceLanguage === 'ru' ? 'book' : ({
              books: 'книги', and: 'а', works: 'работает',
            })[text] ?? 'Она покупает книги и работает с книгами.',
            destroy() {},
          }),
        },
      });
    });
    await fixture.addScriptTag({ path: path.join(extension, 'content.js') });
    await fixture.locator('#original').click();
    const books = fixture.locator('word-lens-overlay .word').getByText('books', { exact: true });
    const originalHighlight = fixture.locator('word-lens-overlay .original-highlight');
    const translatedWords = fixture.locator('word-lens-overlay .translation-text [data-root]');
    await translatedWords.getByText('книгами', { exact: true }).hover();
    await originalHighlight.waitFor();
    assert.ok(await books.last().evaluate((word) => word.classList.contains('original-highlight')));
    assert.equal(await originalHighlight.evaluate((word) => getComputedStyle(word).backgroundColor), 'rgb(161, 228, 168)');
    await fixture.mouse.move(3, 3);
    await originalHighlight.waitFor({ state: 'detached' });
    await translatedWords.getByText('книги', { exact: true }).hover();
    await originalHighlight.waitFor();
    assert.ok(await books.first().evaluate((word) => word.classList.contains('original-highlight')));

    await books.first().hover();
    const mark = fixture.locator('word-lens-overlay .translation-text .translation-highlight');
    await mark.waitFor();
    assert.equal(await mark.textContent(), 'книги');
    await books.last().hover();
    await fixture.waitForFunction(() => document.querySelector('word-lens-overlay').shadowRoot.querySelector('.translation-highlight')?.textContent === 'книгами');
    assert.equal(await mark.textContent(), 'книгами');
    await fixture.locator('word-lens-overlay .word').getByText('and', { exact: true }).hover();
    const nearby = fixture.locator('word-lens-overlay .translation-text .translation-highlight.nearby');
    await nearby.last().waitFor();
    assert.deepEqual(await nearby.allTextContents(), ['книги', 'работает']);
    await fixture.mouse.move(3, 3);
    await mark.waitFor({ state: 'detached' });
    await fixture.close();
  });
  await reset();
  await page.goto(url); await select('#russian');
  await overlay.screenshot({ path: 'test-results/popup.png' });
  await page.screenshot({ path: 'test-results/preview.png', fullPage: false });
  console.log(`Готово: ${passed} браузерных проверок. Снимки: test-results/`);
} catch (error) {
  if (context) await context.pages().at(-1)?.screenshot({ path: 'test-results/failure.png' }).catch(() => {});
  throw error;
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  // Only the dedicated temporary test profile created above is removed.
  if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('word-lens-test-')) await rm(profile, { recursive: true, force: true });
}
