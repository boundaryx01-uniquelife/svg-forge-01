import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// 버전: package.json → src/version.js (화면·3MF·도움말에 표시)
const PKG = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
writeFileSync(new URL('./src/version.js', import.meta.url), `// build.mjs가 package.json에서 만듦 — 직접 고치지 마세요\nexport const VERSION = '${PKG.version}';\n`);

const wres = await build({
  entryPoints: ['src/worker.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome110', 'edge110', 'firefox110', 'safari16'],
  write: false,
  legalComments: 'none',
});
const workerSrc = wres.outputFiles[0].text;
console.log('worker bundle', (workerSrc.length / 1024).toFixed(0) + ' KB');

const ures = await build({
  entryPoints: ['src/upscale.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome110', 'edge110', 'firefox110', 'safari16'],
  loader: { '.bin': 'binary', '.json': 'json' },
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const upscaleSrc = ures.outputFiles[0].text;
console.log('upscale bundle', (upscaleSrc.length / 1024).toFixed(0) + ' KB');

const withPotrace = !process.argv.includes('--no-potrace');
let potraceSrc = '';
if (withPotrace) {
  const pres = await build({
    entryPoints: ['src/potrace_entry.js'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['chrome110', 'edge110', 'firefox110', 'safari16'],
    external: ['node:fs', 'node:path', 'node:url', 'node:crypto', 'node:module'],
    write: false,
    legalComments: 'none',
  });
  potraceSrc = pres.outputFiles[0].text;
  console.log('potrace bundle (GPL-2.0)', (potraceSrc.length / 1024).toFixed(0) + ' KB');
} else console.log('potrace 제외 빌드');

const result = await build({
  entryPoints: ['src/app.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome110', 'edge110', 'firefox110', 'safari16'],
  loader: { '.otf': 'binary' },
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"', __WORKER_SRC__: JSON.stringify(workerSrc), __UPSCALE_SRC__: JSON.stringify(upscaleSrc), __POTRACE_SRC__: JSON.stringify(potraceSrc) },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let tpl = readFileSync('src/template.html', 'utf8');
// 변경 이력: CHANGELOG.md 를 그대로 끼워 넣는다 (저장소와 사이트가 따로 놀지 않게)
if (tpl.includes('<!--CHANGELOG-->')) tpl = tpl.replace('<!--CHANGELOG-->', () => changelogHtml());
mkdirSync('dist', { recursive: true });
const outName = withPotrace ? 'dist/svg-forge.html' : 'dist/svg-forge-nogpl.html';
writeFileSync(outName, tpl.replace('<!--BUNDLE-->', () => `<script>${js}</script>`));
console.log('built', outName, ((js.length + tpl.length) / 1024).toFixed(0) + ' KB');

/** CHANGELOG.md → 아주 작은 마크다운 변환 (제목·목록·굵게·코드·링크) */
function changelogHtml() {
  let md = '';
  try {
    md = readFileSync('CHANGELOG.md', 'utf8');
  } catch (e) {
    return '';
  }
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const inline = (t) =>
    esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, a, b) => (/^https?:/.test(b) ? `<a href="${b}" target="_blank" rel="noopener">${a}</a>` : a));
  const out = [];
  let started = false;        // 첫 '##' 전의 머리말은 창 아래 안내와 겹쳐 버린다
  let inList = false;
  const closeList = () => { if (inList) (out.push('</ul>'), (inList = false)); };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }
    if (!started && !/^##/.test(line)) continue;
    let m;
    if ((m = line.match(/^#\s+(.*)/))) { closeList(); continue; }          // 문서 제목은 창 제목과 겹쳐 뺀다
    if ((m = line.match(/^##\s+(.*)/))) { closeList(); started = true; out.push(`<h4>${inline(m[1])}</h4>`); continue; }
    if ((m = line.match(/^###\s+(.*)/))) { closeList(); out.push(`<h4 style="color:var(--ink);font-size:12.5px">${inline(m[1])}</h4>`); continue; }
    if ((m = line.match(/^[-*]\s+(.*)/))) {
      if (!inList) (out.push('<ul>'), (inList = true));
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p style="margin:4px 0">${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}
