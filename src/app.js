import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { traceImage, otsuThreshold, estimateHardEdges, parseFont, missingGlyphs, textToLayers } from './trace.js';
import { makeModel } from './geom.js';
import { potracePathsToRings } from './pathparse.js';
import { toFillSvg, toLaserSvg, toDxf } from './export.js';
import { buildLayerGeometries, buildStlBlob } from './mesh.js';
import builtinFontData from '../assets/NotoSansKR-Bold-subset.otf';

const $ = (s) => document.querySelector(s);
const el = {};
[
  'modeImage', 'modeText', 'paneImage', 'paneText', 'drop', 'file', 'fileName', 'colors', 'thr', 'thrVal', 'thrRow', 'thrAuto',
  'invert', 'invertRow', 'bgRow', 'removeBg', 'tres', 'tresVal', 'omit', 'omitVal', 'blur', 'blurVal', 'blurRow', 'res', 'corner', 'cornerVal', 'lineTol', 'lineTolVal', 'axisSnap', 'optArcs', 'optParallel', 'optWidth', 'optAlign', 'optSym', 'upscale', 'denoise', 'engine', 'engineRow',
  'text', 'fontSel', 'fontFileBtn', 'fontFile', 'fontLocalBtn', 'localFontRow', 'localFontSel', 'align', 'lineH', 'lineHVal',
  'width', 'heightOut', 'tol', 'btnFill', 'btnLaser', 'btnDxf', 'btnStl', 'laserSingle', 'thick', 'step',
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
{
  const u8 = builtinFontData;
  const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  S.fonts.push({ id: 'builtin', name: 'Noto Sans KR Bold (내장)', font: parseFont(buf) });
}
const curFont = () => (S.fonts.find((f) => f.id === el.fontSel.value) || S.fonts[0]).font;

function addFont(name, font) {
  const id = 'f' + S.fonts.length;
  S.fonts.push({ id, name, font });
  el.fontSel.add(new Option(name, id));
  el.fontSel.value = id;
  schedule(0);
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

async function loadFile(file) {
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
    setMsg(['이미지를 열 수 없습니다. PNG/JPG/WebP/SVG 파일인지 확인해 주세요.']);
    return;
  }
  S.imgId++;
  S.raster = null;
  el.fileName.textContent = `${name} (${Math.round(S.img.natW)}×${Math.round(S.img.natH)})`;
  el.fileName.title = name;
  setMode('image', true);
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
    S.autoNote = hard ? '계단형(각진 픽셀) 가장자리를 감지해 곡선 허용오차를 0.80으로 자동 설정했습니다.' : '';
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
  const res = await up.upscale(base, scale, (f) => setStatus(`<span>AI 업스케일 중… ${Math.round(f * 100)}%</span>`));
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
  setStatus('<span>처리 중…</span>');
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
          '<b>이미지 열기</b><br>클릭해서 파일 선택 · 끌어다 놓기 · Ctrl+V 붙여넣기<br><span style="font-size:12px">PNG · JPG · WebP · SVG</span>',
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
      if (!text.trim()) return showEmpty('글자를 입력하면 여기에 미리보기가 나타납니다.');
      const font = curFont();
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
      if (miss.length) warnings.push(`선택한 폰트에 없는 글자: ${miss.map((c) => `<b>${escapeHtml(c)}</b>`).join(' ')} — 다른 폰트를 선택해 주세요.`);
    }
  } catch (e) {
    if (e && e.message === 'cancelled') return; // 더 새로운 요청으로 대체됨
    console.error(e);
    return showEmpty('처리 중 오류가 발생했습니다: ' + escapeHtml(String(e.message || e)));
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
    setMsg(['추출된 도형이 없습니다.' + (S.mode === 'image' ? ' 임계값·색 수를 바꿔 보세요.' : '')].concat(warnings));
    return;
  }
  if (S.mode === 'image' && S.autoNote) warnings.push(S.autoNote);
  if (S.mode === 'image' && el.engine.value === 'potrace')
    warnings.push(parseInt(el.colors.value, 10) > 1 ? 'Potrace 엔진은 흑백 전용이라 다색에는 기본 엔진을 썼습니다.' : 'Potrace 엔진: 디자인 보정(직선·원호·평행 등)은 적용되지 않습니다. GPL-2.0 라이선스.');
  if (S.mode === 'image' && S.img && parseInt(el.upscale.value, 10) > 1 && Math.max(S.img.natW, S.img.natH) >= 1200)
    warnings.push('이미지가 이미 충분히 커서 AI 업스케일 효과가 작습니다. 작거나 흐린 이미지에 쓰세요.');
  if (m.layers.length > 4) warnings.push(`색이 ${m.layers.length}개입니다. MakerLab 도구에는 4색 이하를 권장합니다 (색 수를 줄여 보세요).`);
  if (m.ringCount > 3000) warnings.push(`도형 조각이 ${m.ringCount}개로 많습니다. '노이즈 제거'나 '곡선 단순화'를 올리면 가벼워집니다.`);
  el.heightOut.textContent = m.height.toFixed(2);
  S.dirty3d = true;
  render2d();
  render3dIfVisible();
  updateButtons();
  const sw = m.layers.map((l) => `<span><i class="sw" style="background:${l.color}"></i>${l.color}</span>`).join(' ');
  setStatus(
    `<span>도형 ${m.ringCount}개</span><span>노드 ${m.nodeCount}</span><span>${m.width.toFixed(1)} × ${m.height.toFixed(1)} mm</span>${sw}${fixSummary(layers, m)}`
  );
  setMsg(warnings);
}

function fixSummary(layers, m) {
  const st = layers && layers.stats;
  if (!st || S.mode !== 'image') return '';
  let arcs = 0;
  for (const l of m.layers) for (const it of l.items) for (const c of it.ring) if (c[0] === 'A') arcs++;
  const parts = [];
  if (st.snapped) parts.push(`수평·수직 ${st.snapped}`);
  if (st.parallel) parts.push(`평행 ${st.parallel}`);
  if (st.width) parts.push(`두께 ${st.width}`);
  if (st.aligned) parts.push(`정렬 ${st.aligned}`);
  if (arcs) parts.push(`원호 ${arcs}`);
  if (st.symAxis != null) parts.push('좌우 대칭');
  if (S.upInfo) parts.push(`AI ×${el.upscale.value}`);
  if (st.engine === 'potrace') return '<span>엔진: Potrace</span>';
  return parts.length ? `<span title="디자인 보정으로 맞춘 항목 수">보정: ${parts.join(' · ')}</span>` : '';
}

function showEmpty(text, clickable = false) {
  S.model = null;
  S.layers = null;
  S.traceKey = '';
  el.view2d.innerHTML = `<div class="empty${clickable ? ' clickable' : ''}">${text}</div>`;
  if (clickable) el.view2d.firstChild.onclick = () => el.file.click();
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
  ['btnFill', 'btnLaser', 'btnDxf', 'btnStl'].forEach((id) => (el[id].disabled = !ok));
}

function render2d() {
  const m = S.model;
  if (!m || !m.layers.length) {
    el.view2d.innerHTML = '<div class="empty">표시할 도형이 없습니다.</div>';
    return;
  }
  const svg =
    S.v2mode === 'fill'
      ? toFillSvg(m, { xmlDecl: false })
      : toLaserSvg(m, { xmlDecl: false, single: false, strokeWidth: Math.max(0.1, m.width / 260) });
  el.view2d.innerHTML = svg;
}

// ---------- 3D 미리보기 ----------
let T = null;
function init3d() {
  if (T) return T;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    el.view3d.insertAdjacentHTML('afterbegin', '<div class="empty">이 브라우저에서는 3D 미리보기(WebGL)를 쓸 수 없습니다. STL 저장은 정상 동작합니다.</div>');
    T = { failed: true };
    return T;
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
  T = { renderer, scene, camera, group, controls };
  new ResizeObserver(() => resize3d()).observe(el.view3d);
  return T;
}

function resize3d() {
  if (!T || T.failed || S.view !== '3d') return;
  const w = el.view3d.clientWidth;
  const h = el.view3d.clientHeight;
  if (!w || !h) return;
  T.renderer.setSize(w, h, false);
  T.camera.aspect = w / h;
  T.camera.updateProjectionMatrix();
  T.renderer.render(T.scene, T.camera);
}

function render3dIfVisible() {
  if (S.view === '3d') rebuild3d();
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
  const thickness = Math.max(0.2, parseFloat(el.thick.value) || 3);
  const step = Math.max(0, parseFloat(el.step.value) || 0);
  const geos = buildLayerGeometries(m, { thickness, step });
  let maxH = 0;
  for (const g of geos) {
    maxH = Math.max(maxH, g.height);
    t.group.add(new THREE.Mesh(g.geometry, new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.55, metalness: 0.05 })));
  }
  el.badge3d.textContent = `${m.width.toFixed(1)} × ${m.height.toFixed(1)} × ${maxH.toFixed(1)} mm`;
  const size = Math.max(m.width, m.height, maxH);
  const c = new THREE.Vector3(m.width / 2, m.height / 2, maxH / 2);
  t.controls.target.copy(c);
  if (S.dirty3d) {
    t.camera.position.set(c.x, c.y - size * 0.75, c.z + size * 1.5);
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
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) loadFile(f);
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

const bindRange = (input, label, fmt = (v) => v) =>
  input.addEventListener('input', () => {
    label.textContent = fmt(input.value);
    schedule();
  });
bindRange(el.thr, el.thrVal);
bindRange(el.tres, el.tresVal, (v) => parseFloat(v).toFixed(2));
bindRange(el.corner, el.cornerVal, (v) => v + '°');
bindRange(el.lineTol, el.lineTolVal, (v) => (parseFloat(v) > 0 ? parseFloat(v).toFixed(1) : '끔'));
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
el.thick.addEventListener('input', () => {
  S.dirty3d = false;
  render3dIfVisible();
});
el.step.addEventListener('input', () => {
  S.dirty3d = false;
  render3dIfVisible();
});

// 폰트 파일 / 설치 폰트
el.fontFileBtn.onclick = () => el.fontFile.click();
el.fontFile.onchange = async () => {
  const f = el.fontFile.files[0];
  el.fontFile.value = '';
  if (!f) return;
  try {
    addFont(f.name.replace(/\.[^.]+$/, ''), parseFont(await f.arrayBuffer()));
  } catch (e) {
    setMsg(['폰트를 읽을 수 없습니다. .ttf / .otf / .woff 파일을 선택해 주세요. (.ttc는 지원하지 않습니다)']);
  }
};
if ('queryLocalFonts' in window) el.fontLocalBtn.classList.remove('hide');
el.fontLocalBtn.onclick = async () => {
  try {
    S.localList = await window.queryLocalFonts();
  } catch (e) {
    setMsg(['설치된 폰트 접근이 허용되지 않았습니다. 폰트 파일을 직접 불러와 주세요.']);
    return;
  }
  S.localList.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ko'));
  el.localFontSel.innerHTML = '<option value="">폰트를 선택하세요…</option>';
  S.localList.forEach((fd, i) => el.localFontSel.add(new Option(fd.fullName, String(i))));
  el.localFontRow.classList.remove('hide');
};
el.localFontSel.onchange = async () => {
  const fd = S.localList[parseInt(el.localFontSel.value, 10)];
  if (!fd) return;
  try {
    const buf = await (await fd.blob()).arrayBuffer();
    addFont(fd.fullName, parseFont(buf));
    setMsg([]);
  } catch (e) {
    setMsg(['이 폰트는 불러올 수 없습니다(.ttc 컬렉션 등). 폰트 파일(.ttf/.otf)을 직접 선택해 주세요.']);
  }
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
  const blob = buildStlBlob(S.model, {
    thickness: Math.max(0.2, parseFloat(el.thick.value) || 3),
    step: Math.max(0, parseFloat(el.step.value) || 0),
  });
  if (blob) download(blob, `${safeBase()}.stl`);
};

window.__svgforge = S;
syncColorUi();
updateButtons();
setView('2d');
schedule(0);
