// 실제 health_log + 예시 Tasks 스냅샷을 주입한 미리보기 HTML 생성
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [csv, today, out] = process.argv.slice(2);
const engineTest = new URL('../../tools/test_engine.js', import.meta.url).pathname;
const snap = execFileSync('node', [engineTest, csv, today, '--json'], { env: { ...process.env, TZ: 'Asia/Seoul' } }).toString();
const html = readFileSync(new URL('../../Dashboard.html', import.meta.url), 'utf8');
const inject = `<script>window.__PREVIEW__=true;window.__SNAPSHOT__=${snap.replace(/</g, '\\u003c')};</script>\n`;
writeFileSync(out, inject + html);
console.log('wrote', out);
