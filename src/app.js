import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { traceImage, otsuThreshold, estimateHardEdges, parseFont, missingGlyphs, textToLayers } from './trace.js';
import { makeModel } from './geom.js';
import { potracePathsToRings } from './pathparse.js';
import { toFillSvg, toLaserSvg, toDxf } from './export.js';
import { buildPartGeometries, buildStlBlob, build3mfBlob } from './mesh.js';
import builtinFontData from '../assets/NotoSansKR-Bold-subset.otf';
import { kvGet, kvSet, kvDel, lsGet, lsSet } from './store.js';
import { isCollection, splitCollection, fontDisplayName, fontPostscript } from './fontutil.js';
import { T, applyLang, setLang, initLang, getLang } from './i18n.js';

const $ = (s) => document.querySelector(s);
const el = {};
[
  'modeImage', 'modeText', 'paneImage', 'paneText', 'drop', 'file', 'fileName', 'colors', 'thr', 'thrVal', 'thrRow', 'thrAuto',
  'invert', 'invertRow', 'bgRow', 'removeBg', 'tres', 'tresVal', 'omit', 'omitVal', 'blur', 'blurVal', 'blurRow', 'res', 'corner', 'cornerVal', 'lineTol', 'lineTolVal', 'axisSnap', 'optArcs', 'optParallel', 'optWidth', 'optAlign', 'optSym', 'upscale', 'denoise', 'engine', 'engineRow',
  'text', 'fontSel', 'fontFileBtn', 'fontFile', 'fontLocalBtn', 'localFontRow', 'localFontSel', 'align', 'lineH', 'lineHVal',
  'width', 'heightOut', 'tol', 'btnFill', 'btnLaser', 'btnDxf', 'btnStl', 'btn3mf', 'laserSingle', 'thick', 'stepAuto', 'stepZero', 'colorHeights', 'baseOn', 'baseOpts', 'baseShape', 'baseMargin', 'baseH', 'baseColor', 'baseFill', 'baseFillRow', 'baseCut', 'borderOn', 'borderOpts', 'borderW', 'borderH', 'ringOn', 'ringOpts', 'ringPos', 'ringOuter', 'ringHole', 'ringDx', 'ringDy', 'ringReset', 'edgeType', 'edgeSize', 'edgeOpts', 'edgeColor', 'edgeBase',
  'projOpen', 'projSave', 'projFile', 'langSel', 'fontDefault', 'fontRemove',
  'tab2d', 'tab3d', 'view2d', 'view3d', 'badge3d', 'status', 'msg', 'v2Fill', 'v2Line', 'modeView2d',
].forEach((id) => (el[id] = document.getElementById(id)));

const S = {
  mode: 'image',
  img: null,
  imgId: 0,
  raster: null, // {key, imgd}
  fonts: [],
  localList: [],
  layers: null,
  traceKey: '',
  model: null,
  view: '2d',
  v2mode: 'fill',
  dirty3d: true,
};

// ---------- 폰트 ----------
// S.fonts: {id, name, font(파싱 결과, 필요할 때 만듦), buf?}. 불러온 폰트는 IndexedDB에 기억 ('fonts' 목록 + 'font:<id>' 바이트)
{
  const u8 = builtinFontData;
  const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  S.fonts.push({ id: 'builtin', name: 'Noto Sans KR Bold (내장)', font: parseFont(buf) });
}
const fontEntry = (id) => S.fonts.find((f) => f.id === id);
async function getFont(id) {
  const f = fontEntry(id) || S.fonts[0];
  if (!f.font) {
    const buf = f.buf || (await kvGet('font:' + f.id));
    if (!buf) throw new Error('font missing');
    f.font = parseFont(buf);
    f.buf = buf;
  }
  return f.font;
}
const fontKey = (name, buf) => 'u' + [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, buf.byteLength >>> 0).toString(36);

function saveFontIndex() {
  kvSet('fonts', S.fonts.filter((f) => f.id !== 'builtin').map((f) => ({ id: f.id, name: f.name })));
}
function addFontEntry(name, buf, font) {
  const id = fontKey(name, buf);
  let f = fontEntry(id);
  if (!f) {
    f = { id, name, font, buf };
    S.fonts.push(f);
    el.fontSel.add(new Option(name, id));
    kvSet('font:' + id, buf).then(saveFontIndex);
  }
  return f;
}
/** 폰트 파일 바이트 → 목록에 추가 (TTC는 여러 폰트로 나눔). 추가된 항목 반환 */
function addFontBuffer(buf, fallbackName, wantPs) {
  const bufs = isCollection(buf) ? splitCollection(buf) : [buf];
  const added = [];
  bufs.forEach((b, i) => {
    let font;
    try {
      font = parseFont(b);
    } catch (e) {
      return;
    }
    if (wantPs && bufs.length > 1 && fontPostscript(font) !== wantPs) return;
    const name = (wantPs && fallbackName) || fontDisplayName(font, bufs.length > 1 ? `${fallbackName} ${i + 1}` : fallbackName);
    added.push(addFontEntry(name, b, font));
  });
  // 설치 폰트의 postScript 이름이 컬렉션 안에서 안 맞으면 첫 폰트
  if (!added.length && wantPs && bufs.length > 1) return addFontBuffer(bufs[0], fallbackName);
  return added;
}
async function loadFontFiles(files) {
  const added = [];
  for (const f of files) {
    try {
      added.push(...addFontBuffer(await f.arrayBuffer(), f.name.replace(/\.[^.]+$/, '')));
    } catch (e) {}
  }
  if (!added.length) return setMsg([T('폰트를 읽을 수 없습니다. .ttf / .otf / .woff / .ttc 파일인지 확인해 주세요.')]);
  el.fontSel.value = added[0].id;
  setMode('text', true);
  schedule(0);
  S.flash = T('폰트 {n}개를 불러왔습니다: {names}', { n: added.length, names: added.map((a) => escapeHtml(a.name)).join(', ') });
}
async function restoreFonts() {
  const list = (await kvGet('fonts')) || [];
  for (const it of list) {
    if (fontEntry(it.id)) continue;
    S.fonts.push({ id: it.id, name: it.name, font: null });
    el.fontSel.add(new Option(it.name, it.id));
  }
  const def = lsGet('svgforge.defaultFont');
  if (def && fontEntry(def)) el.fontSel.value = def;
}

// ---------- 메시지/상태 ----------
function setMsg(list) {
  el.msg.innerHTML = list.map((t) => `<div class="note">${t}</div>`).join('');
}
function setStatus(html) {
  el.status.innerHTML = html;
}

// ---------- 이미지 로딩 ----------
function svgNaturalSize(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(parseFloat);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { w: vb[2], h: vb[3] };
  const w = parseFloat(root.getAttribute('width'));
  const h = parseFloat(root.getAttribute('height'));
  if (w > 0 && h > 0) return { w, h };
  return { w: 512, h: 512 };
}

async function loadFile(file, keep = false) {
  if (!file) return;
  const name = file.name || 'image';
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(name);
  try {
    if (isSvg) {
      const text = await file.text();
      const { w, h } = svgNaturalSize(text);
      S.img = { name, kind: 'svg', svgText: text, natW: w, natH: h };
    } else {
      const bmp = await createImageBitmap(file);
      S.img = { name, kind: 'raster', bmp, natW: bmp.width, natH: bmp.height };
    }
  } catch (e) {
    setMsg([T('이미지를 열 수 없습니다. PNG/JPG/WebP/SVG 파일인지 확인해 주세요.')]);
    return;
  }
  S.img.file = file; // 프로젝트 저장용 원본
  S.imgId++;
  S.raster = null;
  el.fileName.textContent = `${name} (${Math.round(S.img.natW)}×${Math.round(S.img.natH)})`;
  el.fileName.title = name;
  setMode('image', true);
  S.autoNote = '';
  if (keep) return schedule(0); // 프로젝트 불러오기: 저장된 설정 유지
  // 새 이미지: 자동 임계값
  try {
    const imgd = await rasterize(S.img, parseInt(el.res.value, 10));
    const t = otsuThreshold(imgd);
    el.thr.value = t;
    el.thrVal.textContent = t;
    // 계단형(안티앨리어싱 없는) 가장자리면 허용오차를 키워 픽셀 계단을 흡수
    const hard = estimateHardEdges(imgd) < 0.1;
    el.tres.value = hard ? 0.8 : 0.4;
    el.tresVal.textContent = parseFloat(el.tres.value).toFixed(2);
    S.autoNote = hard ? '계단형(각진 픽셀) 가장자리를 감지해 곡선 허용오차를 0.80으로 자동 설정했습니다.' : ''; // 표시할 때 T()
  } catch (e) {}
  schedule(0);
}

/* global __UPSCALE_SRC__ */
let upLoader = null;
/** AI 업스케일 모듈: 가능하면 워커(백그라운드), 안 되면 화면 스레드에서 */
function loadUpscaler() {
  if (upLoader) return upLoader;
  upLoader = (async () => {
    const url = URL.createObjectURL(new Blob([__UPSCALE_SRC__], { type: 'text/javascript' }));
    try {
      const w = new Worker(url);
      let n = 0;
      const jobs = new Map();
      w.onmessage = (e) => {
        const j = jobs.get(e.data.id);
        if (!j) return;
        if (e.data.progress != null) j.onProgress && j.onProgress(e.data.progress);
        else if (e.data.error) {
          jobs.delete(e.data.id);
          j.reject(new Error(e.data.error));
        } else if (e.data.done) {
          jobs.delete(e.data.id);
          j.resolve({ width: e.data.width, height: e.data.height, data: new Uint8ClampedArray(e.data.buffer), backend: e.data.backend });
        }
      };
      w.onerror = (ev) => {
        for (const [, j] of jobs) j.reject(new Error('upscale worker'));
        jobs.clear();
      };
      return {
        upscale(imgd, scale, onProgress) {
          return new Promise((resolve, reject) => {
            const id = ++n;
            jobs.set(id, { resolve, reject, onProgress });
            const buffer = imgd.data.slice().buffer;
            w.postMessage({ id, width: imgd.width, height: imgd.height, buffer, scale }, [buffer]);
          });
        },
      };
    } catch (e) {
      await new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = url;
        sc.onload = res;
        sc.onerror = () => rej(new Error('upscaler'));
        document.head.appendChild(sc);
      });
      return self.SVGForgeUpscale;
    }
  })();
  return upLoader;
}
const upCache = new Map();
/** AI 업스케일된 원본 (결과 긴 변 최대 2400px). 이미지·배율별로 캐시 */
async function upscaledSource(img, scale) {
  const key = `${S.imgId}:${scale}`;
  if (upCache.has(key)) return upCache.get(key);
  const base = await rasterize(img, Math.max(64, Math.floor(2400 / scale)), true);
  const up = await loadUpscaler();
  const t0 = performance.now();
  const res = await up.upscale(base, scale, (f) => setStatus(`<span>${T('AI 업스케일 중… {p}%', { p: Math.round(f * 100) })}</span>`));
  res.ms = performance.now() - t0;
  const c = document.createElement('canvas');
  c.width = res.width;
  c.height = res.height;
  c.getContext('2d').putImageData(new ImageData(res.data, res.width, res.height), 0, 0);
  const out = { canvas: c, w: res.width, h: res.height, backend: res.backend, ms: res.ms };
  upCache.clear();
  upCache.set(key, out);
  return out;
}

async function rasterize(img, maxSide, noUpscale = false) {
  const upS = noUpscale ? 1 : parseInt(el.upscale.value, 10) || 1;
  const key = `${S.imgId}:${maxSide}:${upS}`;
  if (!noUpscale && S.raster && S.raster.key === key) return S.raster.imgd;
  let w, h, source;
  if (img.kind === 'svg') {
    const sc = maxSide / Math.max(img.natW, img.natH);
    w = Math.max(1, Math.round(img.natW * sc));
    h = Math.max(1, Math.round(img.natH * sc));
    const doc = new DOMParser().parseFromString(img.svgText, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', `0 0 ${img.natW} ${img.natH}`);
    root.setAttribute('width', w);
    root.setAttribute('height', h);
    const blob = new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    source = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('svg load'));
      im.src = url;
    });
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } else {
    const sc = Math.min(1, maxSide / Math.max(img.natW, img.natH));
    w = Math.max(1, Math.round(img.natW * sc));
    h = Math.max(1, Math.round(img.natH * sc));
    source = img.bmp;
  }
  if (upS > 1) {
    const u = await upscaledSource(img, upS);
    const sc = Math.min(1, maxSide / Math.max(u.w, u.h));
    w = Math.max(1, Math.round(u.w * sc));
    h = Math.max(1, Math.round(u.h * sc));
    source = u.canvas;
    S.upInfo = u;
  } else S.upInfo = null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  const imgd = ctx.getImageData(0, 0, w, h);
  if (!noUpscale) S.raster = { key, imgd };
  return imgd;
}

// ---------- 백그라운드 계산 (Web Worker) ----------
/* global __WORKER_SRC__ */
let worker = null;
let workerFailed = false;
let reqId = 0;
const pending = new Map();
function getWorker() {
  if (worker || workerFailed) return worker;
  try {
    const url = URL.createObjectURL(new Blob([__WORKER_SRC__], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = (e) => {
      const r = pending.get(e.data.id);
      if (!r) return;
      pending.delete(e.data.id);
      e.data.ok ? r.resolve(e.data) : r.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      // 워커가 동작하지 않는 환경: 이후로는 화면 스레드에서 계산
      workerFailed = true;
      worker = null;
      for (const [, r] of pending) r.reject(new Error('worker'));
      pending.clear();
    };
  } catch (e) {
    workerFailed = true;
    worker = null;
  }
  return worker;
}
/** 최신 요청만 의미가 있으므로, 새 요청이 오면 오래된 계산 중인 워커는 종료하고 새로 시작 */
async function runTrace(imgd, p) {
  const w = getWorker();
  if (!w) {
    const layers = traceImage(imgd, p);
    return layers;
  }
  if (pending.size) {
    worker.terminate();
    for (const [, r] of pending) r.reject(new Error('cancelled'));
    pending.clear();
    worker = null;
  }
  const ww = getWorker();
  const id = ++reqId;
  const buffer = imgd.data.slice().buffer;
  try {
    const res = await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ww.postMessage({ id, width: imgd.width, height: imgd.height, buffer, opts: p }, [buffer]);
    });
    const layers = res.layers;
    layers.stats = res.stats;
    return layers;
  } catch (e) {
    if (e.message === 'cancelled') throw e;
    if (workerFailed) return traceImage(imgd, p);
    throw e;
  }
}

// ---------- Potrace 엔진 (선택, GPL) ----------
/* global __POTRACE_SRC__ */
let ptLoader = null;
function loadPotrace() {
  if (!ptLoader) {
    ptLoader = new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([__POTRACE_SRC__], { type: 'text/javascript' }));
      const sc = document.createElement('script');
      sc.src = url;
      sc.onload = () => res(self.SVGForgePotrace);
      sc.onerror = () => rej(new Error('potrace'));
      document.head.appendChild(sc);
    });
  }
  return ptLoader;
}
async function runPotrace(imgd, p) {
  const { width: w, height: h, data: d } = imgd;
  const bin = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3] / 255;
    const l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a + 255 * (1 - a);
    const ink = a >= 0.5 && (p.invert ? l >= p.threshold : l < p.threshold);
    const v = ink ? 0 : 255;
    bin[i * 4] = bin[i * 4 + 1] = bin[i * 4 + 2] = v;
    bin[i * 4 + 3] = 255;
  }
  const pt = await loadPotrace();
  const alphamax = Math.min(1.334, Math.max(0.3, 0.55 + (p.cornerAngle - 15) * 0.018));
  const paths = await pt.trace(new ImageData(bin, w, h), {
    turdsize: Math.max(0, Math.round(p.minArea)),
    turnpolicy: 4,
    alphamax,
    opticurve: 1,
    opttolerance: Math.max(0.05, p.tol * 0.5),
  });
  const layers = [{ color: '#000000', rings: potracePathsToRings(paths, h) }];
  layers.stats = { engine: 'potrace' };
  return layers;
}
if (!__POTRACE_SRC__) el.engineRow.classList.add('hide');

// ---------- 계산 파이프라인 ----------
let timer = 0;
let seq = 0;
function schedule(delay = 180) {
  clearTimeout(timer);
  setStatus(`<span>${T('처리 중…')}</span>`);
  timer = setTimeout(compute, delay);
}

function safeBase() {
  if (S.mode === 'image' && S.img) return S.img.name.replace(/\.[^.]+$/, '') || 'image';
  const t = (el.text.value.split('\n')[0] || 'text').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 20);
  return t || 'text';
}

async function compute() {
  const my = ++seq;
  const warnings = [];
  const width = Math.min(1000, Math.max(1, parseFloat(el.width.value) || 50));
  const tol = parseFloat(el.tol.value) || 0.05;
  let layers = null;

  try {
    if (S.mode === 'image') {
      if (!S.img)
        return showEmpty(
          `<b>${T('이미지 열기')}</b><br>${T('클릭해서 파일 선택 · 끌어다 놓기 · Ctrl+V 붙여넣기')}<br><span style="font-size:12px">PNG · JPG · WebP · SVG</span>`,
          true
        );
      const maxSide = parseInt(el.res.value, 10);
      const p = {
        colors: parseInt(el.colors.value, 10),
        threshold: parseInt(el.thr.value, 10),
        invert: el.invert.checked,
        removeBg: el.removeBg.checked,
        tol: parseFloat(el.tres.value),
        minArea: parseFloat(el.omit.value),
        cornerAngle: parseFloat(el.corner.value),
        lineTol: parseFloat(el.lineTol.value),
        snapDeg: el.axisSnap.checked ? 3 : 0,
        arcs: el.optArcs.checked,
        parallel: el.optParallel.checked,
        equalWidth: el.optWidth.checked,
        align: el.optAlign.checked,
        symmetry: el.optSym.checked,
        denoise: el.denoise.checked,
        blur: parseInt(el.blur.value, 10),
      };
      const key = 'img|' + S.imgId + '|' + maxSide + '|' + el.upscale.value + '|' + el.engine.value + '|' + JSON.stringify(p);
      if (key === S.traceKey && S.layers) {
        layers = S.layers;
      } else {
        const imgd = await rasterize(S.img, maxSide);
        if (my !== seq) return;
        layers = el.engine.value === 'potrace' && p.colors <= 1 ? await runPotrace(imgd, p) : await runTrace(imgd, p);
        if (my !== seq) return;
        S.layers = layers;
        S.traceKey = key;
      }
    } else {
      const text = el.text.value;
      if (!text.trim()) return showEmpty(T('글자를 입력하면 여기에 미리보기가 나타납니다.'));
      let font;
      try {
        font = await getFont(el.fontSel.value);
      } catch (e) {
        el.fontSel.value = 'builtin';
        font = S.fonts[0].font;
      }
      if (my !== seq) return;
      const p = { align: el.align.value, lineHeight: parseFloat(el.lineH.value) };
      const key = 'txt|' + el.fontSel.value + '|' + text + '|' + JSON.stringify(p);
      if (key === S.traceKey && S.layers) {
        layers = S.layers;
      } else {
        layers = textToLayers(font, text, p);
        S.layers = layers;
        S.traceKey = key;
      }
      const miss = missingGlyphs(font, text);
      if (miss.length) warnings.push(T('선택한 폰트에 없는 글자: {chars} — 다른 폰트를 선택해 주세요.', { chars: miss.map((c) => `<b>${escapeHtml(c)}</b>`).join(' ') }));
    }
  } catch (e) {
    if (e && e.message === 'cancelled') return; // 더 새로운 요청으로 대체됨
    console.error(e);
    return showEmpty(T('처리 중 오류가 발생했습니다: ') + escapeHtml(String(e.message || e)));
  }
  if (my !== seq) return;

  S.model = makeModel(layers, width, tol);
  const m = S.model;
  if (!m.layers.length) {
    S.dirty3d = true;
    render2d();
    render3dIfVisible();
    updateButtons();
    el.heightOut.textContent = '-';
    setStatus('');
    setMsg([T('추출된 도형이 없습니다.') + (S.mode === 'image' ? T(' 임계값·색 수를 바꿔 보세요.') : '')].concat(warnings));
    return;
  }
  if (S.mode === 'image' && S.autoNote) warnings.push(T(S.autoNote));
  if (S.mode === 'image' && el.engine.value === 'potrace')
    warnings.push(T(parseInt(el.colors.value, 10) > 1 ? 'Potrace 엔진은 흑백 전용이라 다색에는 기본 엔진을 썼습니다.' : 'Potrace 엔진: 디자인 보정(직선·원호·평행 등)은 적용되지 않습니다. GPL-2.0 라이선스.'));
  if (S.mode === 'image' && S.img && parseInt(el.upscale.value, 10) > 1 && Math.max(S.img.natW, S.img.natH) >= 1200)
    warnings.push(T('이미지가 이미 충분히 커서 AI 업스케일 효과가 작습니다. 작거나 흐린 이미지에 쓰세요.'));
  if (m.layers.length > 4) warnings.push(T('색이 {n}개입니다. MakerLab 도구에는 4색 이하를 권장합니다 (색 수를 줄여 보세요).', { n: m.layers.length }));
  if (m.ringCount > 3000) warnings.push(T("도형 조각이 {n}개로 많습니다. '노이즈 제거'나 '곡선 단순화'를 올리면 가벼워집니다.", { n: m.ringCount }));
  if (S.flash) {
    warnings.unshift(S.flash);
    S.flash = '';
  }
  el.heightOut.textContent = m.height.toFixed(2);
  S.dirty3d = true;
  render2d();
  render3dIfVisible();
  updateButtons();
  const sw = m.layers.map((l) => `<span><i class="sw" style="background:${l.color}"></i>${l.color}</span>`).join(' ');
  setStatus(
    `<span>${T('도형 {n}개', { n: m.ringCount })}</span><span>${T('노드 {n}', { n: m.nodeCount })}</span><span>${m.width.toFixed(1)} × ${m.height.toFixed(1)} mm</span>${sw}${fixSummary(layers, m)}`
  );
  setMsg(warnings);
  autosave();
}

function fixSummary(layers, m) {
  const st = layers && layers.stats;
  if (!st || S.mode !== 'image') return '';
  let arcs = 0;
  for (const l of m.layers) for (const it of l.items) for (const c of it.ring) if (c[0] === 'A') arcs++;
  const parts = [];
  if (st.snapped) parts.push(T('수평·수직 {n}', { n: st.snapped }));
  if (st.parallel) parts.push(T('평행 {n}', { n: st.parallel }));
  if (st.width) parts.push(T('두께 {n}', { n: st.width }));
  if (st.aligned) parts.push(T('정렬 {n}', { n: st.aligned }));
  if (arcs) parts.push(T('원호 {n}', { n: arcs }));
  if (st.symAxis != null) parts.push(T('좌우 대칭'));
  if (S.upInfo) parts.push(`AI ×${el.upscale.value}`);
  if (st.engine === 'potrace') return `<span>${T('엔진: Potrace')}</span>`;
  return parts.length ? `<span title="${T('디자인 보정으로 맞춘 항목 수')}">${T('보정: {list}', { list: parts.join(' · ') })}</span>` : '';
}

function showEmpty(text, clickable = false) {
  S.model = null;
  S.layers = null;
  S.traceKey = '';
  el.view2d.innerHTML = `<div class="empty${clickable ? ' clickable' : ''}">${text}</div>`;
  if (clickable) el.view2d.firstChild.onclick = () => el.file.click();
  if (clickable && S.hasLast) {
    const b = document.createElement('button');
    b.className = 'btn resume';
    b.textContent = T('지난 작업 이어서 하기');
    b.onclick = (e) => {
      e.stopPropagation();
      resumeLast();
    };
    el.view2d.firstChild.append(document.createElement('br'), b);
  }
  el.heightOut.textContent = '-';
  setStatus('');
  setMsg([]);
  updateButtons();
  S.dirty3d = true;
  render3dIfVisible();
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function updateButtons() {
  const ok = !!(S.model && S.model.layers.length);
  ['btnFill', 'btnLaser', 'btnDxf', 'btnStl', 'btn3mf'].forEach((id) => (el[id].disabled = !ok));
  renderHeightChips();
}

function render2d() {
  const m = S.model;
  if (!m || !m.layers.length) {
    el.view2d.innerHTML = `<div class="empty">${T('표시할 도형이 없습니다.')}</div>`;
    return;
  }
  const svg =
    S.v2mode === 'fill'
      ? toFillSvg(m, { xmlDecl: false })
      : toLaserSvg(m, { xmlDecl: false, single: false, strokeWidth: Math.max(0.1, m.width / 260) });
  el.view2d.innerHTML = svg;
}

// ---------- 3D 미리보기 ----------
let G3 = null;
function init3d() {
  if (G3) return G3;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    el.view3d.insertAdjacentHTML('afterbegin', `<div class="empty">${T('이 브라우저에서는 3D 미리보기(WebGL)를 쓸 수 없습니다. STL 저장은 정상 동작합니다.')}</div>`);
    G3 = { failed: true };
    return G3;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  el.view3d.insertBefore(renderer.domElement, el.badge3d);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.1));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6);
  dl.position.set(-1, -1.4, 2);
  scene.add(dl);
  const group = new THREE.Group();
  scene.add(group);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.addEventListener('change', () => renderer.render(scene, camera));
  G3 = { renderer, scene, camera, group, controls };
  setupRingDrag(G3);

  new ResizeObserver(() => resize3d()).observe(el.view3d);
  return G3;
}

function resize3d() {
  if (!G3 || G3.failed || S.view !== '3d') return;
  const w = el.view3d.clientWidth;
  const h = el.view3d.clientHeight;
  if (!w || !h) return;
  G3.renderer.setSize(w, h, false);
  G3.camera.aspect = w / h;
  G3.camera.updateProjectionMatrix();
  G3.renderer.render(G3.scene, G3.camera);
}

function render3dIfVisible() {
  if (S.view === '3d') rebuild3d();
}

// ---------- 색별 높이차 ----------
S.heightByColor = new Map(); // 색 → 높이차(mm). 같은 색은 다시 트레이싱해도 값 유지
function colorOffsets() {
  const m = S.model;
  if (!m) return [];
  return m.layers.map((l) => S.heightByColor.get(l.color) || 0);
}
function renderHeightChips() {
  const m = S.model;
  const box = el.colorHeights;
  const colors = m ? m.layers.map((l) => l.color) : [];
  const sig = colors.join(',');
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = '';
  if (!colors.length) {
    box.innerHTML = '<span style="color:var(--sub);font-size:12px;padding-top:5px">-</span>';
    return;
  }
  colors.forEach((c, i) => {
    const lab = document.createElement('label');
    lab.className = 'hchip';
    lab.title = T('색 {i} {c}: 기본 두께에 더할 높이 (mm, 음수 가능)', { i: i + 1, c });
    lab.innerHTML = `<i class="sw" style="background:${c}"></i><input type="number" step="0.2" min="-50" max="50" data-color="${c}">`;
    const inp = lab.querySelector('input');
    inp.value = S.heightByColor.get(c) || 0;
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      S.heightByColor.set(c, isFinite(v) ? v : 0);
      on3dChange(false);
      autosave();
    });
    box.appendChild(lab);
  });
}
function setAllOffsets(fn) {
  const m = S.model;
  if (!m) return;
  m.layers.forEach((l, i) => S.heightByColor.set(l.color, Math.round(fn(i) * 100) / 100));
  el.colorHeights.dataset.sig = '';
  renderHeightChips();
  on3dChange(true);
}

/** 오른쪽 '3D 출력' 설정 */
function solidOpts() {
  const nv = (e, d, lo = 0) => Math.max(lo, parseFloat(e.value) || d);
  return {
    thickness: nv(el.thick, 3, 0.2),
    offsets: colorOffsets(),
    base: { on: el.baseOn.checked, shape: el.baseShape.value, margin: Math.max(0, parseFloat(el.baseMargin.value) || 0), height: nv(el.baseH, 1.5, 0.2), color: el.baseColor.value, fill: Math.max(0, parseFloat(el.baseFill.value) || 0), cutHoles: el.baseCut.checked },
    border: { on: el.baseOn.checked && el.borderOn.checked, width: nv(el.borderW, 1.2, 0.4), height: nv(el.borderH, 1, 0.2) },
    ring: { on: el.ringOn.checked, pos: el.ringPos.value, outer: nv(el.ringOuter, 8, 3), hole: nv(el.ringHole, 4, 1), dx: parseFloat(el.ringDx.value) || 0, dy: parseFloat(el.ringDy.value) || 0 },
    edge: { type: el.edgeType.value, size: nv(el.edgeSize, 0.6, 0.1), onColor: el.edgeColor.checked, onBase: el.edgeBase.checked },
  };
}

function rebuild3d() {
  const t = init3d();
  if (t.failed) return;
  for (const ch of [...t.group.children]) {
    ch.geometry.dispose();
    ch.material.dispose();
    t.group.remove(ch);
  }
  const m = S.model;
  if (!m || !m.layers.length) {
    el.badge3d.textContent = '';
    resize3d();
    return;
  }
  const so = solidOpts();
  if (S.dragging) so.edge = { type: 'none' }; // 끄는 동안은 빠르게
  const geos = buildPartGeometries(m, so);
  S.ringInfo = geos.info && geos.info.ring ? geos.info.ring : null;
  let maxH = 0;
  for (const g of geos) {
    maxH = Math.max(maxH, g.z1);
    t.group.add(new THREE.Mesh(g.geometry, new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.55, metalness: 0.05 })));
  }
  const inf = geos.info || {};
  const bb = inf.bbox || [0, 0, m.width, m.height];
  el.badge3d.textContent = inf.size ? `${inf.size[0].toFixed(1)} × ${inf.size[1].toFixed(1)} × ${inf.size[2].toFixed(1)} mm · ${T('파트 {n}개', { n: geos.length })}` : '';
  if (inf.ring && !inf.ring.attached) el.badge3d.textContent += ' · ' + T('⚠ 고리가 몸체에서 떨어져 있음');
  else if (inf.ring) el.badge3d.textContent += ' · ' + T('고리는 끌어서 옮길 수 있음');
  const size = Math.max(bb[2] - bb[0], bb[3] - bb[1], maxH);
  const c = new THREE.Vector3((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, maxH / 2);
  t.controls.target.copy(c);
  if (S.dirty3d) {
    t.camera.position.set(c.x, c.y - size * 0.95, c.z + size * 1.85);
    t.camera.near = size / 100;
    t.camera.far = size * 50;
    t.camera.updateProjectionMatrix();
    t.controls.update();
  }
  S.dirty3d = false;
  resize3d();
}

function setView(v) {
  S.view = v;
  el.tab2d.classList.toggle('on', v === '2d');
  el.tab3d.classList.toggle('on', v === '3d');
  el.view2d.classList.toggle('hide', v !== '2d');
  el.view3d.classList.toggle('hide', v !== '3d');
  el.modeView2d.classList.toggle('hide', v !== '2d');
  if (v === '3d') requestAnimationFrame(rebuild3d);
}

// ---------- UI 연결 ----------
function setMode(m, silent) {
  S.mode = m;
  el.modeImage.classList.toggle('on', m === 'image');
  el.modeText.classList.toggle('on', m === 'text');
  el.paneImage.classList.toggle('hide', m !== 'image');
  el.paneText.classList.toggle('hide', m !== 'text');
  if (!silent) schedule(0);
}

function syncColorUi() {
  const one = parseInt(el.colors.value, 10) <= 1;
  el.thrRow.classList.toggle('hide', !one);
  el.invertRow.classList.toggle('hide', !one);
  el.bgRow.classList.toggle('hide', one);
}

el.modeImage.onclick = () => setMode('image');
el.modeText.onclick = () => setMode('text');
el.tab2d.onclick = () => setView('2d');
el.tab3d.onclick = () => setView('3d');
el.v2Fill.onclick = () => {
  S.v2mode = 'fill';
  el.v2Fill.classList.add('on');
  el.v2Line.classList.remove('on');
  render2d();
};
el.v2Line.onclick = () => {
  S.v2mode = 'line';
  el.v2Line.classList.add('on');
  el.v2Fill.classList.remove('on');
  render2d();
};

el.drop.onclick = () => el.file.click();
el.file.onchange = () => {
  loadFile(el.file.files[0]);
  el.file.value = '';
};
// 화면 어디에 끌어다 놓아도 불러오기 (미리보기 영역에 안내 표시)
let dragTimer = 0;
['dragenter', 'dragover'].forEach((ev) =>
  window.addEventListener(ev, (e) => {
    e.preventDefault();
    const types = (e.dataTransfer && e.dataTransfer.types) || [];
    if (![...types].includes('Files')) return;
    document.body.classList.add('dragging');
    clearTimeout(dragTimer);
    dragTimer = setTimeout(() => document.body.classList.remove('dragging'), 200);
  })
);
window.addEventListener('drop', () => document.body.classList.remove('dragging'));
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
  if (!files.length) return;
  const proj = files.find((f) => /\.svgforge$/i.test(f.name));
  const fonts = files.filter((f) => /\.(ttf|otf|woff|ttc)$/i.test(f.name));
  if (proj) openProjectFile(proj);
  else if (fonts.length) loadFontFiles(fonts);
  else loadFile(files[0]);
});
window.addEventListener('paste', (e) => {
  const items = (e.clipboardData && e.clipboardData.items) || [];
  for (const it of items) {
    if (it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) loadFile(new File([f], 'pasted-image.png', { type: f.type }));
      break;
    }
  }
});

const rangeLabels = [];
const bindRange = (input, label, fmt = (v) => v) => {
  rangeLabels.push(() => (label.textContent = fmt(input.value)));
  input.addEventListener('input', () => {
    label.textContent = fmt(input.value);
    schedule();
  });
};
const syncLabels = () => rangeLabels.forEach((f) => f());
bindRange(el.thr, el.thrVal);
bindRange(el.tres, el.tresVal, (v) => parseFloat(v).toFixed(2));
bindRange(el.corner, el.cornerVal, (v) => v + '°');
bindRange(el.lineTol, el.lineTolVal, (v) => (parseFloat(v) > 0 ? parseFloat(v).toFixed(1) : T('끔')));
bindRange(el.omit, el.omitVal);
bindRange(el.blur, el.blurVal);
bindRange(el.lineH, el.lineHVal, (v) => parseFloat(v).toFixed(2));
el.thrAuto.onclick = async () => {
  if (!S.img) return;
  const imgd = await rasterize(S.img, parseInt(el.res.value, 10));
  const t = otsuThreshold(imgd);
  el.thr.value = t;
  el.thrVal.textContent = t;
  schedule(0);
};
el.colors.onchange = () => {
  syncColorUi();
  schedule(0);
};
[el.invert, el.removeBg, el.res, el.align, el.axisSnap, el.optArcs, el.optParallel, el.optWidth, el.optAlign, el.optSym, el.upscale, el.denoise, el.engine].forEach((c) => c.addEventListener('change', () => schedule(0)));
el.text.addEventListener('input', () => schedule(250));
el.fontSel.addEventListener('change', () => schedule(0));
el.width.addEventListener('input', () => schedule(200));
el.tol.addEventListener('change', () => schedule(0));
// 3D 설정: 바꾸면 3D 미리보기로 보여줌
function on3dChange(showView) {
  el.baseOpts.classList.toggle('hide', !el.baseOn.checked);
  el.borderOpts.classList.toggle('hide', !el.borderOn.checked);
  el.baseFillRow.classList.toggle('hide', el.baseShape.value !== 'outline');
  el.ringOpts.classList.toggle('hide', !el.ringOn.checked);
  el.edgeOpts.classList.toggle('hide', el.edgeType.value === 'none');
  if (showView && S.view !== '3d' && S.model) {
    S.dirty3d = true;
    setView('3d');
    return;
  }
  render3dIfVisible();
  autosave();
}
[el.thick, el.baseMargin, el.baseH, el.baseFill, el.edgeSize, el.ringDx, el.ringDy, el.borderW, el.borderH, el.ringOuter, el.ringHole].forEach((e) => e.addEventListener('input', () => on3dChange(false)));
[el.baseOn, el.baseShape, el.baseColor, el.baseCut, el.edgeType, el.edgeColor, el.edgeBase, el.borderOn, el.ringOn, el.ringPos].forEach((e) => e.addEventListener('change', () => on3dChange(true)));

el.stepAuto.onclick = () => setAllOffsets((i) => i * 0.4);
el.stepZero.onclick = () => setAllOffsets(() => 0);

// 고리 위치: 자동 위치를 바꾸면 이동값 초기화
el.ringPos.addEventListener('change', () => {
  el.ringDx.value = 0;
  el.ringDy.value = 0;
});
el.ringReset.onclick = () => {
  el.ringDx.value = 0;
  el.ringDy.value = 0;
  on3dChange(true);
};

// 3D 화면에서 고리 끌어 옮기기
function setupRingDrag(t) {
  const dom = t.renderer.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = (ev) => {
    const r = dom.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, t.camera);
    const z = S.ringInfo ? S.ringInfo.z : 0;
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, p) ? p : null;
  };
  const nearRing = (p) => S.ringInfo && p && Math.hypot(p.x - S.ringInfo.center[0], p.y - S.ringInfo.center[1]) <= (S.ringInfo.outer / 2) * 1.15;
  let grab = null;
  let raf = 0;
  dom.addEventListener('pointerdown', (ev) => {
    if (!el.ringOn.checked) return;
    const p = hit(ev);
    if (!nearRing(p)) return;
    grab = [S.ringInfo.center[0] - p.x, S.ringInfo.center[1] - p.y];
    S.dragging = true;
    t.controls.enabled = false;
    dom.setPointerCapture(ev.pointerId);
    dom.style.cursor = 'grabbing';
    ev.preventDefault();
  });
  dom.addEventListener('pointermove', (ev) => {
    const p = hit(ev);
    if (!grab) {
      dom.style.cursor = el.ringOn.checked && nearRing(p) ? 'grab' : '';
      return;
    }
    if (!p || !S.ringInfo) return;
    const auto = S.ringInfo.auto;
    el.ringDx.value = (Math.round((p.x + grab[0] - auto[0]) * 10) / 10).toFixed(1);
    el.ringDy.value = (Math.round((p.y + grab[1] - auto[1]) * 10) / 10).toFixed(1);
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        S.dirty3d = false;
        rebuild3d();
      });
  });
  const end = (ev) => {
    if (!grab) return;
    grab = null;
    S.dragging = false;
    t.controls.enabled = true;
    dom.style.cursor = '';
    try {
      dom.releasePointerCapture(ev.pointerId);
    } catch (e) {}
    S.dirty3d = false;
    rebuild3d(); // 모서리 다듬기 포함 최종 계산
  };
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);
}

// 폰트 파일 / 설치 폰트
el.fontFileBtn.onclick = () => el.fontFile.click();
el.fontFile.onchange = () => {
  const files = [...el.fontFile.files];
  el.fontFile.value = '';
  if (files.length) loadFontFiles(files);
};
if ('queryLocalFonts' in window) el.fontLocalBtn.classList.remove('hide');
el.fontLocalBtn.onclick = async () => {
  try {
    S.localList = await window.queryLocalFonts();
  } catch (e) {
    setMsg([T('설치된 폰트 접근이 허용되지 않았습니다. 폰트 파일을 직접 불러와 주세요.')]);
    return;
  }
  S.localList.sort((a, b) => a.fullName.localeCompare(b.fullName, getLang()));
  el.localFontSel.innerHTML = '';
  el.localFontSel.add(new Option(T('폰트를 선택하세요…'), ''));
  S.localList.forEach((fd, i) => el.localFontSel.add(new Option(fd.fullName, String(i))));
  el.localFontRow.classList.remove('hide');
};
el.localFontSel.onchange = async () => {
  const fd = S.localList[parseInt(el.localFontSel.value, 10)];
  if (!fd) return;
  try {
    const buf = await (await fd.blob()).arrayBuffer();
    const added = addFontBuffer(buf, fd.fullName, fd.postscriptName);
    if (!added.length) throw new Error('parse');
    el.fontSel.value = added[0].id;
    setMsg([]);
    schedule(0);
  } catch (e) {
    setMsg([T('이 폰트는 불러올 수 없습니다. 폰트 파일을 직접 선택해 주세요.')]);
  }
};
el.fontDefault.onclick = () => {
  const f = fontEntry(el.fontSel.value) || S.fonts[0];
  lsSet('svgforge.defaultFont', f.id);
  setMsg([T('기본 폰트로 정했습니다: {name}', { name: escapeHtml(T(f.name)) })]);
};
el.fontRemove.onclick = () => {
  const f = fontEntry(el.fontSel.value);
  if (!f || f.id === 'builtin') return setMsg([T('내장 폰트는 뺄 수 없습니다.')]);
  S.fonts.splice(S.fonts.indexOf(f), 1);
  [...el.fontSel.options].find((o) => o.value === f.id)?.remove();
  kvDel('font:' + f.id);
  saveFontIndex();
  if (lsGet('svgforge.defaultFont') === f.id) lsSet('svgforge.defaultFont', 'builtin');
  el.fontSel.value = 'builtin';
  S.flash = T('목록에서 뺐습니다: {name}', { name: escapeHtml(f.name) });
  schedule(0);
};

// ---------- 프로젝트 저장·불러오기 ----------
const PROJECT_VERSION = 1;
function controlEls() {
  const list = [...document.querySelectorAll('#panelIn input, #panelIn select, #panelIn textarea, #panelOut input, #panelOut select'), el.laserSingle];
  return list.filter((e) => e.id && e.type !== 'file' && e.id !== 'localFontSel' && e.id !== 'fontSel' && !e.closest('#colorHeights'));
}
function blobToB64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
/** forFile: 파일용(바이트를 base64로) / 아니면 자동 저장용(Blob 그대로, 폰트는 기억 목록 참조) */
async function serializeProject(forFile) {
  const controls = {};
  for (const e of controlEls()) controls[e.id] = e.type === 'checkbox' ? e.checked : e.value;
  const f = fontEntry(el.fontSel.value) || S.fonts[0];
  const font = { id: f.id, name: f.name };
  if (forFile && f.id !== 'builtin') {
    const buf = f.buf || (await kvGet('font:' + f.id));
    if (buf) font.data = await blobToB64(new Blob([buf]));
  }
  let image = null;
  if (S.img && S.img.file) {
    image = { name: S.img.name, type: S.img.file.type || '' };
    if (forFile) image.data = await blobToB64(S.img.file);
    else image.blob = S.img.file;
  }
  return {
    app: 'svg-forge',
    version: PROJECT_VERSION,
    saved: new Date().toISOString(),
    mode: S.mode,
    view: S.view,
    v2mode: S.v2mode,
    controls,
    font,
    image,
    heightByColor: [...S.heightByColor.entries()],
  };
}
async function applyProject(p) {
  if (!p || p.app !== 'svg-forge' || !p.controls) throw new Error('bad project');
  const notes = [];
  // 1) 폰트
  const pf = p.font || { id: 'builtin' };
  if (fontEntry(pf.id)) el.fontSel.value = pf.id;
  else if (pf.data) {
    const u8 = b64ToBytes(pf.data);
    const buf = u8.buffer;
    let font = null;
    try {
      font = parseFont(buf);
    } catch (e) {}
    if (font) el.fontSel.value = addFontEntry(pf.name || fontDisplayName(font, 'font'), buf, font).id;
  } else {
    el.fontSel.value = 'builtin';
    if (pf.id && pf.id !== 'builtin') notes.push(T('프로젝트에 쓰인 폰트({name})가 없어 기본 폰트로 표시합니다.', { name: escapeHtml(pf.name || pf.id) }));
  }
  // 2) 설정값 (이벤트 없이 값만)
  for (const e of controlEls()) {
    if (!(e.id in p.controls)) continue;
    const v = p.controls[e.id];
    if (e.type === 'checkbox') e.checked = !!v;
    else e.value = v;
  }
  syncLabels();
  S.heightByColor = new Map(p.heightByColor || []);
  el.colorHeights.dataset.sig = '';
  syncColorUi();
  S.v2mode = p.v2mode === 'line' ? 'line' : 'fill';
  el.v2Fill.classList.toggle('on', S.v2mode === 'fill');
  el.v2Line.classList.toggle('on', S.v2mode === 'line');
  // 3) 이미지
  S.img = null;
  S.imgId++;
  S.layers = null;
  S.traceKey = '';
  el.fileName.textContent = T('끌어놓기 · 붙여넣기(Ctrl+V) 가능');
  if (p.image) {
    const blob = p.image.blob || new Blob([b64ToBytes(p.image.data || '')], { type: p.image.type || '' });
    const file = new File([blob], p.image.name || 'image', { type: p.image.type || blob.type || '' });
    await loadFile(file, true);
  }
  setMode(p.mode === 'text' ? 'text' : 'image', true);
  on3dChange(false);
  S.dirty3d = true;
  setView(p.view === '3d' ? '3d' : '2d');
  S.flash = notes.join('<br>');
  schedule(0);
}
async function saveProjectFile() {
  const p = await serializeProject(true);
  const name = `${safeBase()}.svgforge`;
  download(new Blob([JSON.stringify(p)], { type: 'application/json' }), name);
  setMsg([T('프로젝트를 저장했습니다: {name}', { name: escapeHtml(name) })]);
}
async function openProjectFile(file) {
  try {
    await applyProject(JSON.parse(await file.text()));
    S.flash = [S.flash, T('프로젝트를 불러왔습니다: {name}', { name: escapeHtml(file.name) })].filter(Boolean).join('<br>');
  } catch (e) {
    console.error(e);
    setMsg([T('프로젝트 파일을 읽을 수 없습니다.')]);
  }
}
el.projSave.onclick = saveProjectFile;
el.projOpen.onclick = () => el.projFile.click();
el.projFile.onchange = () => {
  const f = el.projFile.files[0];
  el.projFile.value = '';
  if (f) openProjectFile(f);
};

// 자동 저장: 마지막 작업을 이 브라우저에 (새로 열면 '지난 작업 이어서 하기')
let saveTimer = 0;
function autosave() {
  if (!S.ready || !S.model) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await kvSet('last', await serializeProject(false));
      S.hasLast = true;
    } catch (e) {}
  }, 1200);
}
async function resumeLast() {
  const p = await kvGet('last');
  if (!p) return;
  try {
    await applyProject(p);
  } catch (e) {
    console.error(e);
    setMsg([T('프로젝트 파일을 읽을 수 없습니다.')]);
  }
}

// ---------- 화면 언어 ----------
function refreshLang() {
  document.title = T('SVG Forge — 이미지·글자를 SVG · DXF · STL로');
  el.view2d.dataset.drop = el.view3d.dataset.drop = T('여기에 놓으면 불러옵니다');
  if (el.langSel.value !== getLang()) el.langSel.value = getLang();
}
el.langSel.onchange = () => {
  setLang(el.langSel.value);
  refreshLang();
  syncLabels();
  if (el.localFontSel.options[0] && el.localFontSel.options[0].value === '') el.localFontSel.options[0].text = T('폰트를 선택하세요…');
  el.colorHeights.dataset.sig = '';
  renderHeightChips();
  S.dirty3d = false;
  render3dIfVisible();
  schedule(0);
};

// 내보내기
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1500);
}
el.btnFill.onclick = () => S.model && download(new Blob([toFillSvg(S.model)], { type: 'image/svg+xml' }), `${safeBase()}_makerlab.svg`);
el.btnLaser.onclick = () =>
  S.model && download(new Blob([toLaserSvg(S.model, { single: el.laserSingle.checked })], { type: 'image/svg+xml' }), `${safeBase()}_laser.svg`);
el.btnDxf.onclick = () =>
  S.model && download(new Blob([toDxf(S.model, { single: el.laserSingle.checked })], { type: 'application/dxf' }), `${safeBase()}.dxf`);
el.btnStl.onclick = () => {
  if (!S.model) return;
  const blob = buildStlBlob(S.model, solidOpts());
  if (blob) download(blob, `${safeBase()}.stl`);
};
el.btn3mf.onclick = async () => {
  if (!S.model) return;
  const blob = await build3mfBlob(S.model, solidOpts(), safeBase());
  if (!blob) return;
  download(blob, `${safeBase()}.3mf`);
  const f = blob.filaments || [];
  if (f.length > 1)
    setMsg([T('3MF 저장: 필라멘트 {n}개 — {list}', { n: f.length, list: f.map((x) => `${T('{n}번', { n: x.n })} <i class="sw" style="background:${x.color}"></i>${x.color}`).join(' · ') })]);
};

window.__svgforge = S;
initLang();
applyLang();
refreshLang();
syncLabels();
syncColorUi();
updateButtons();
setView('2d');
(async () => {
  await restoreFonts();
  S.hasLast = !!(await kvGet('last'));
  S.ready = true;
  if (!S.model) schedule(0); // 빈 화면에 '지난 작업 이어서 하기' 표시
})();
schedule(0);
