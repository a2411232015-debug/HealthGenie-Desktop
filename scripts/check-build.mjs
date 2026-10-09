// 建置完成後的檢查：確認網頁引用的檔案都存在、樣式有正確產生、沒有把金鑰打包進去。
// 執行：npm run build && node scripts/check-build.mjs
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const problems = [];
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

for (const [, url] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
  if (/^(https?:)?\/\//.test(url)) {
    problems.push(`index.html 引用了外部網址：${url}`);
    continue;
  }
  if (url.startsWith('/')) problems.push(`index.html 使用了絕對路徑（GitHub Pages 子目錄與桌面版會找不到）：${url}`);
  if (!fs.existsSync(path.join(dist, url.replace(/^\.?\//, '')))) problems.push(`找不到 index.html 引用的檔案：${url}`);
}

const manifestPath = path.join(dist, 'manifest.webmanifest');
if (!fs.existsSync(manifestPath)) problems.push('缺少 manifest.webmanifest');
else {
  for (const icon of JSON.parse(fs.readFileSync(manifestPath, 'utf8')).icons) {
    if (!fs.existsSync(path.join(dist, icon.src))) problems.push(`找不到 App 圖示：${icon.src}`);
  }
}

const files = fs.readdirSync(path.join(dist, 'assets'));
const css = files.filter((file) => file.endsWith('.css')).map((file) => fs.readFileSync(path.join(dist, 'assets', file), 'utf8')).join('\n');
for (const selector of ['.bg-teal-600', '.rounded-2xl', '.md\\:ml-64', '#print-root']) {
  if (!css.includes(selector)) problems.push(`樣式檔缺少 ${selector}（Tailwind 可能沒有正確建置）`);
}
if (css.includes('@tailwind')) problems.push('樣式檔仍有未處理的 @tailwind 指令');

const js = files.filter((file) => file.endsWith('.js')).map((file) => fs.readFileSync(path.join(dist, 'assets', file), 'utf8')).join('\n');
if (/AIza[0-9A-Za-z_-]{35}/.test(js)) problems.push('網頁程式裡出現 Google API 金鑰！請移除 VITE_GEMINI_API_KEY');
if (/service_role|sb_secret_/.test(js)) problems.push('網頁程式裡出現 Supabase 管理金鑰！');

if (problems.length > 0) {
  for (const problem of problems) console.log(`::error::${problem}`);
  process.exit(1);
}
console.log(`::notice::建置檢查通過：${files.length} 個資源檔、樣式 ${(css.length / 1024).toFixed(0)} KB、程式 ${(js.length / 1024).toFixed(0)} KB`);
