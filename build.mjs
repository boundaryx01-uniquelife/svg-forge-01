import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

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
const tpl = readFileSync('src/template.html', 'utf8');
mkdirSync('dist', { recursive: true });
const outName = withPotrace ? 'dist/svg-forge.html' : 'dist/svg-forge-nogpl.html';
writeFileSync(outName, tpl.replace('<!--BUNDLE-->', () => `<script>${js}</script>`));
console.log('built', outName, ((js.length + tpl.length) / 1024).toFixed(0) + ' KB');
