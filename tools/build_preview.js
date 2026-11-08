// 실제 health_log + 예시 Tasks 스냅샷을 Dashboard.html 에 주입해 미리보기 HTML 생성
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const [csv, today, out] = process.argv.slice(2);
const snap = execFileSync('node', [path.join(__dirname, 'test_engine.js'), csv, today, '--json'], { env: { ...process.env, TZ: 'Asia/Seoul' } }).toString();
const html = fs.readFileSync(path.join(__dirname, '..', 'Dashboard.html'), 'utf8');
const inject = '<script>window.__PREVIEW__=true;window.__SNAPSHOT__=' + snap.replace(/</g, '\\u003c') + ';</script>\n';
fs.writeFileSync(out, html.replace('<script>\n(function', inject + '<script>\n(function'));
console.log('wrote', out, fs.statSync(out).size, 'bytes');
