// dist/index.html → ../Dashboard.html  (doctype/html/head/body 래퍼 제거: Apps Script HtmlService 와 Claude Artifact 양쪽 호환)
import { readFileSync, writeFileSync } from 'node:fs';
let html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
html = html
  .replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="UTF-8"\s*\/?>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
const out = new URL('../../Dashboard.html', import.meta.url);
writeFileSync(out, html.trim() + '\n');
console.log('Dashboard.html', Buffer.byteLength(html), 'bytes');
