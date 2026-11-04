DjVu decoder source for Slovolupa
Upstream DjVu.js 0.5.4: https://github.com/RussCoder/djvujs/tree/d068f46a6935e7bef57206e26396f988774d4be6
Upstream PNGJS 5.0.0: https://github.com/pngjs/pngjs/tree/v5.0.0
From this directory, rebuild the bundled worker with:
npx esbuild@0.25.12 djvu-worker.mjs --bundle --minify --target=chrome111 --legal-comments=eof --alias:djvujs-dist=./djvujs-dist --alias:pngjs/browser=./pngjs/browser.js --outfile=../djvu-worker.js
