import DjVuDocument from 'djvujs-dist/library/src/DjVuDocument.js';

let document;

function getTextBlocks(page) {
  const text = page.getText();
  if (!text.trim()) return [];
  const bytes = new TextEncoder().encode(text);
  const offsets = new Set([0, bytes.length]);
  let previousLine;

  // DjVu text zones store UTF-8 byte offsets. Use explicit paragraphs when
  // present and large vertical gaps when the file only has line zones.
  function visit(zone) {
    if (zone.type === 4) offsets.add(zone.textStart);
    if (zone.type === 5) {
      if (previousLine && Math.abs(zone.y - previousLine.y) > 1.35 * Math.max(zone.height, previousLine.height)) {
        offsets.add(zone.textStart);
      }
      previousLine = zone;
    } else if (zone.type < 5) {
      zone.children?.forEach(visit);
    }
  }
  const root = page.getPageTextZone();
  if (root) visit(root);

  const boundaries = [...offsets].filter((offset) => offset >= 0 && offset <= bytes.length).sort((a, b) => a - b);
  const decoder = new TextDecoder();
  return boundaries.slice(1).flatMap((end, index) =>
    decoder.decode(bytes.subarray(boundaries[index], end)).split(/(?:\r?\n[ \t]*){2,}|[\f\x1d-\x1f]/u)
  ).map((block) => block.trim().replace(/\r?\n/g, ' ')).filter(Boolean);
}

self.onmessage = async ({ data: { id, operation, data } }) => {
  try {
    let result;
    if (operation === 'open') {
      document = new DjVuDocument(data);
      if (!document.isBundled()) {
        throw new Error('Для многофайлового DjVu нужна копия, объединённая в один файл.');
      }
      result = document.getPagesQuantity();
      if (!result) throw new Error('В документе нет страниц.');
    } else {
      const page = await document.getPage(data.number);
      if (operation === 'page') {
        const width = page.getWidth();
        const height = page.getHeight();
        const rotated = page.getRotation() % 180 !== 0;
        result = {
          width: rotated ? height : width,
          height: rotated ? width : height,
          blocks: getTextBlocks(page),
        };
      } else {
        if (page.getWidth() * page.getHeight() > 64_000_000) {
          throw new Error('Страница слишком велика для отображения.');
        }
        const image = page.getImageData();
        result = await createImageBitmap(image, {
          resizeWidth: data.width,
          resizeHeight: data.height,
          resizeQuality: 'high',
        });
      }
    }
    self.postMessage({ id, result }, result instanceof ImageBitmap ? [result] : []);
  } catch (error) {
    self.postMessage({ id, error: error.message || String(error) });
  }
};
