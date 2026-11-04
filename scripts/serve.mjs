import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export function createDemoServer() {
  return createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const relative = pathname === '/' ? 'demo/index.html' : decodeURIComponent(pathname.slice(1));
    const target = path.resolve(root, relative);
    if (!target.startsWith(root) || !/^(demo|extension)[\\/]/u.test(relative)) { response.writeHead(403).end(); return; }
    try {
      let data = await readFile(target);
      if (path.extname(target) === '.html' && new URL(request.url, 'http://localhost').searchParams.has('native')) {
        data = Buffer.from(data.toString().replace('<script src="/extension/content.js"></script>', ''));
      }
      const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' }[path.extname(target)] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(data);
    } catch { response.writeHead(404).end(); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createDemoServer();
  server.listen(4173, '127.0.0.1', () => console.log('Демонстрация: http://127.0.0.1:4173'));
}
