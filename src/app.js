import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { traceImage, otsuThreshold, estimateHardEdges, estimateColorCount, parseFont, missingGlyphs, textToLayers } from './trace.js';
import { makeModel } from './geom.js';
import { applyEdits, hitItem, innerPoint, strokeOf, growRings } from './edit.js';
import { buildItems } from './geom.js';
import { createSim } from './sim.js';
import { VERSION } from './version.js';
import { enhanceColorInputs } from './tiles.js';
import { keycapDims } from './keycap.js';
import { applyPattern, pressProfile } from './mold.js';
import { drawPress, stageAt, STAGES } from './pressview.js';
import { SAMPLES, sampleSvg } from './samples.js';
import { potracePathsToRings } from './pathparse.js';
import { toFillSvg, toLaserSvg, toDxf, laserModel } from './export.js';
import { printabilityReport } from './solid.js';
import { buildPartGeometries, buildStlBlob, build3mfBlob } from './mesh.js';
import builtinFontData from '../assets/NotoSansKR-Bold-subset.otf';
import hanjaFontData from '../assets/NotoSansCJKkr-Bold-hanja.otf';
import { CSS3DRenderer, CSS3DObject, CSS3DSprite } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { kvGet, kvSet, kvDel, lsGet, lsSet } from './store.js';
import { isCollection, splitCollection, fontDisplayName, fontPostscript } from './fontutil.js';
import { startCredit } from './credit.js';
import { T, applyLang, setLang, initLang, getLang, setHints, applyHints } from './i18n.js';

const $ = (s) => document.querySelector(s);
const el = {};
[
  'modeImage', 'modeText', 'paneImage', 'paneText', 'drop', 'file', 'fileName', 'colors', 'thr', 'thrVal', 'thrRow', 'thrAuto',
  'invert', 'invertRow', 'preset', 'advImage', 'bgRow', 'removeBg', 'keepRow', 'keepInner', 'tres', 'tresVal', 'omit', 'omitVal', 'blur', 'blurVal', 'blurRow', 'res', 'corner', 'cornerVal', 'lineTol', 'lineTolVal', 'axisSnap', 'optArcs', 'optParallel', 'optWidth', 'optAlign', 'optSym', 'upscale', 'denoise', 'engine', 'engineRow',
  'text', 'fontSel', 'fontFileBtn', 'fontFile', 'fontLocalBtn', 'localFontRow', 'localFontSel', 'align', 'lineH', 'lineHVal',
  'width', 'heightOut', 'tol', 'btnFill', 'btnLaser', 'btnDxf', 'btnStl', 'btn3mf', 'laserSingle', 'thick', 'stepAuto', 'stepZero', 'colorHeights', 'baseOn', 'baseOpts', 'baseShape', 'baseMargin', 'baseH', 'baseColor', 'baseFill', 'baseFillRow', 'baseFillLbl', 'baseImgBtn', 'baseImgFile', 'baseStretch', 'baseStretchLbl', 'textMode', 'ringType', 'ringSel', 'ringAdd', 'ringDel', 'charChips', 'charHint', 'charEdit', 'chScale', 'chScaleVal', 'chRot', 'chRotVal', 'chW', 'chH', 'chDz', 'chColor', 'chReset', 'chDx', 'chDy', 'chResetAll', 'dimsBtn', 'homeBtn', 'undoBtn', 'redoBtn', 'helpBtn', 'help', 'kerf', 'laserOpsBtn', 'laserDlg', 'laserRows', 'prefsBtn', 'prefs', 'pDimColor', 'pDimSize', 'pBg2d', 'pBg3d', 'pHints', 'pAutosave', 'pResetCtl', 'pResetPrefs', 'cube', 'dimLabels', 'borderOn', 'borderOpts', 'borderFull', 'borderW', 'borderH', 'ringOn', 'ringOpts', 'ringPos', 'ringOuter', 'ringHole', 'ringDx', 'ringDy', 'ringReset', 'edgeType', 'edgeSize', 'edgeOpts', 'edgeColor', 'edgeBase', 'kcOn', 'kcOpts', 'kcU', 'kcColor', 'kcH', 'kcInset', 'kcWall', 'kcTol', 'kcMode', 'kcDepth', 'kcEdge', 'kcEdgeSize', 'kcStem', 'kcInfo', 'wallOn', 'wallOpts', 'wallW', 'wallH', 'wallGap', 'wallColor', 'tdTitle', 'tdPrint', 'tdSw', 'tdEst', 'tdMoveRow', 'tdMove', 'tdHint', 'tdDel', 'edTextEdit', 'txtSw', 'txtSwEst', 'thinBtn', 'bucketBar', 'bucketBtn', 'bucketCol', 'tabPress', 'viewPress', 'pressCv', 'pressPlay', 'pressRst', 'pressPos', 'pressStage', 'pressInfo',
  'tabSim', 'viewSim', 'simCv', 'simHead', 'simPlay', 'simRst', 'simPos', 'simTime', 'simSpd', 'simCut', 'simEng', 'simTrv', 'simInfo',
  'mpOn', 'mpOpts', 'mpKind', 'mpColor', 'mpW', 'mpPitch', 'mpWall', 'mpAngle', 'mpSpokes', 'mpSpokesRow', 'mpInfo',
  'mdOn', 'mdOpts', 'mdKind', 'mdOut', 'mdColor', 'mdDome', 'mdGap', 'mdRim', 'mdPin', 'mdPair', 'mdDepth', 'mdFloor', 'mdDraft', 'mdClear', 'mdFlange', 'mdRibH', 'mdInfo', 'sampleRow',
  'projOpen', 'projSave', 'projFile', 'langSel', 'fontDefault', 'fontRemove',
  'tab2d', 'tab3d', 'view2d', 'view3d', 'badge3d', 'status', 'msg', 'v2Fill', 'v2Line', 'modeView2d', 'editbar', 'edInfo', 'edScope', 'edDel', 'edMinus', 'edPlus', 'edStep', 'edHoles', 'edColor', 'edClear', 'edCut', 'edCutW', 'edText', 'edDrop', 'textDlg', 'tdText', 'tdSize', 'tdColor',
].forEach((id) => (el[id] = document.getElementById(id)));

const S = {
  edits: [],
  editsKey: '',
  sel: null,
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
  S.fonts.push({ id: 'builtin', name: 'Noto Sans KR Bold (내장)', font: parseFont(buf), flags: { ko: true, hj: true } });
}
// 한자(KS X 1001 4,888자, Noto Sans CJK KR Bold): 필요할 때만 읽어 대체 폰트로 사용
let hanjaFont = null;
function getHanja() {
  if (!hanjaFont) {
    const u8 = hanjaFontData;
    hanjaFont = parseFont(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
  }
  return hanjaFont;
}
const hasChars = (f, str) => [...str].every((c) => f.charToGlyphIndex(c));
const fontFlags = (font) => ({ ko: hasChars(font, '가한글'), hj: hasChars(font, '漢字') });
const HANJA_RE = /[\u2E80-\u2FFF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
/** 선택 폰트에 없는 글자를 채울 대체 폰트 (내장 한글 → 내장 한자 → 불러온 다른 폰트) */
function fallbackFonts(font, text) {
  const need = [...new Set(text)].filter((c) => !/\s/.test(c) && !font.charToGlyphIndex(c));
  if (!need.length) return null;
  const list = [];
  if (S.fonts[0].font !== font) list.push(S.fonts[0].font);
  if (need.some((c) => HANJA_RE.test(c))) list.push(getHanja());
  for (const f of S.fonts) if (f.font && f.font !== font && !list.includes(f.font)) list.push(f.font);
  return list;
}
/** 폰트 목록: 한글 지원 / 한글 없음으로 나눠 표시 */
function renderFontOptions() {
  const cur = el.fontSel.value;
  el.fontSel.innerHTML = '';
  const groups = [
    [T('한글 지원 폰트'), (f) => f.flags && f.flags.ko],
    [T('한글 없는 폰트 (영문 등)'), (f) => f.flags && !f.flags.ko],
    [T('확인 중…'), (f) => !f.flags],
  ];
  for (const [label, test] of groups) {
    const g = document.createElement('optgroup');
    g.label = label;
    for (const f of S.fonts)
      if (test(f)) {
        const ko = f.flags && f.flags.ko;
        const o = new Option((ko ? '[한] ' : '') + (f.id === 'builtin' ? T(f.name) : f.name) + (f.flags && f.flags.hj ? ' · 漢' : ''), f.id);
        if (ko) o.style.color = '#1d5fd6';
        g.appendChild(o);
      }
    if (g.children.length) el.fontSel.appendChild(g);
  }
  if (cur && fontEntry(cur)) el.fontSel.value = cur;
}
const fontEntry = (id) => S.fonts.find((f) => f.id === id);
async function getFont(id) {
  const f = fontEntry(id) || S.fonts[0];
  if (!f.font) {
    const buf = f.buf || (await kvGet('font:' + f.id));
    if (!buf) throw new Error('font missing');
    f.font = parseFont(buf);
    f.buf = buf;
    if (!f.flags) {
      f.flags = fontFlags(f.font);
      saveFontIndex();
      renderFontOptions();
    }
  }
  return f.font;
}
const fontKey = (name, buf) => 'u' + [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, buf.byteLength >>> 0).toString(36);

function saveFontIndex() {
  kvSet('fonts', S.fonts.filter((f) => f.id !== 'builtin').map((f) => ({ id: f.id, name: f.name, flags: f.flags })));
}
function addFontEntry(name, buf, font) {
  const id = fontKey(name, buf);
  let f = fontEntry(id);
  if (!f) {
    f = { id, name, font, buf, flags: fontFlags(font) };
    S.fonts.push(f);
    renderFontOptions();
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
    S.fonts.push({ id: it.id, name: it.name, font: null, flags: it.flags || null });
  }
  renderFontOptions();
  const def = lsGet('svgforge.defaultFont');
  if (def && fontEntry(def)) el.fontSel.value = def;
  // 예전에 기억한 폰트는 한글 지원 여부를 뒤에서 확인
  for (const f of S.fonts) if (!f.flags) await getFont(f.id).catch(() => {});
}

// ---------- 메시지/상태 ----------
function setMsg(list) {
  el.msg.innerHTML = list.map((t) => `<div class="note">${t}</div>`).join('');
  // 메모 영역이 미리보기 밖이라 미리보기 높이가 바뀜 → 텍스트 맞춤 다시 계산
  if (S.mode === 'text' && S.model && !S.vb2) requestAnimationFrame(() => render2d());
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

async function decodeImage(file) {
  const name = file.name || 'image';
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(name);
  if (isSvg) {
    const text = await file.text();
    const { w, h } = svgNaturalSize(text);
    return { name, kind: 'svg', svgText: text, natW: w, natH: h };
  }
  const bmp = await createImageBitmap(file);
  return { name, kind: 'raster', bmp, natW: bmp.width, natH: bmp.height };
}

async function loadFile(file, keep = false) {
  if (!file) return;
  const name = file.name || 'image';
  try {
    S.img = await decodeImage(file);
  } catch (e) {
    setMsg([T('이미지를 열 수 없습니다. PNG/JPG/WebP/SVG 파일인지 확인해 주세요.')]);
    return;
  }
  S.img.file = file; // 프로젝트 저장용 원본
  if (!keep) resetHist();
  S.imgId++;
  S.vb2 = null;
  S.dirty3d = true;
  S.raster = null;
  el.fileName.textContent = `${name} (${Math.round(S.img.natW)}×${Math.round(S.img.natH)})`;
  el.fileName.title = name;
  setMode('image', true);
  S.autoNote = '';
  S.autoNote2 = '';
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
    S.autoNote = hard ? '그림 가장자리가 각져 보여, 곡선을 더 부드럽게 다듬도록 자동으로 맞췄습니다.' : ''; // 표시할 때 T()
    // 색이 여러 가지인 그림은 색 수도 자동으로 (흑백이면 1색)
    const kc = estimateColorCount(imgd);
    const opts = [...el.colors.options].map((o) => parseInt(o.value, 10));
    const want = kc < 0 ? 4 : kc <= 2 ? 1 : opts.find((v) => v >= kc) || 8;
    el.colors.value = String(want);
    syncColorUi();
    S.autoColors = want;
    if (want > 1) S.autoNote2 = kc < 0 ? '' : '색이 {n}가지로 보여 색 수를 {n}색으로 자동 설정했습니다.';
    S.autoN = kc;
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
        keepInner: el.keepInner.checked,
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
      if (!text.trim()) return showEmpty(T('텍스트를 입력하면 여기에 미리보기가 나타납니다.'));
      let font;
      try {
        font = await getFont(el.fontSel.value);
      } catch (e) {
        el.fontSel.value = 'builtin';
        font = S.fonts[0].font;
      }
      if (my !== seq) return;
      const p = { align: el.align.value, lineHeight: parseFloat(el.lineH.value) };
      const fb = fallbackFonts(font, text);
      syncCharStyles(text);
      const styles = Object.keys(S.charStyles).length ? S.charStyles : null;
      const key = 'txt|' + el.fontSel.value + '|' + text + '|' + JSON.stringify(p) + '|' + (fb ? fb.length : 0) + '|' + JSON.stringify(styles);
      if (key === S.traceKey && S.layers) {
        layers = S.layers;
      } else {
        layers = textToLayers(font, text, p, fb, styles);
        S.layers = layers;
        S.traceKey = key;
      }
      renderCharChips(text);
      S.txtKey = 'k|' + el.fontSel.value + '|' + text + '|' + JSON.stringify(p) + '|' + (fb ? fb.length : 0);
      const miss = missingGlyphs(font, text, fb);
      if (fb && el.fontSel.value !== 'builtin') {
        const sub = [...new Set(text)].filter((c) => !/\s/.test(c) && !font.charToGlyphIndex(c) && !miss.includes(c));
        if (sub.length) warnings.push(T('이 폰트에 없는 글자는 다른 폰트로 채웠습니다: {chars}', { chars: sub.slice(0, 12).map((c) => `<b>${escapeHtml(c)}</b>`).join(' ') + (sub.length > 12 ? ' …' : '') }));
      }
      if (miss.length) warnings.push(T('선택한 폰트에 없는 글자: {chars} — 다른 폰트를 선택해 주세요.', { chars: miss.map((c) => `<b>${escapeHtml(c)}</b>`).join(' ') }));
    }
  } catch (e) {
    if (e && e.message === 'cancelled') return; // 더 새로운 요청으로 대체됨
    console.error(e);
    return showEmpty(T('처리 중 오류가 발생했습니다: ') + escapeHtml(String(e.message || e)));
  }
  if (my !== seq) return;

  if (S.editsKey === '*') S.editsKey = S.traceKey;
  if (S.editsKey !== S.traceKey) {
    if (S.edits.length) S.flash = T('이미지·글자 설정이 바뀌어 도형 편집을 처음으로 되돌렸습니다.');
    S.edits = [];
    S.editsKey = S.traceKey;
  }
  let mlayers = layers;
  let refW;
  if (S.mode === 'image' && needPlate()) {
    const key = S.imgId + '|' + el.res.value + '|' + el.upscale.value;
    if (!S.plate || S.plate.key !== key) S.plate = { key, rings: silhouetteRings(await rasterize(S.img, parseInt(el.res.value, 10))) };
    if (my !== seq) return;
    if (S.plate.rings.length) mlayers = layers.concat([{ color: '#ffffff', plate: true, rings: S.plate.rings }]);
  }
  const prevXf = S.model && S.model.xf;
  if (S.mode === 'text') {
    // 글자 배율(mm/글자 단위)은 글자·폰트·너비 입력이 바뀔 때만 새로 정함 → 한 글자를 키우거나 옮겨도 다른 글자 크기는 그대로, 너비 칸은 실제 폭을 보여 줌
    if (S.txtScaleKey !== S.txtKey || S.txtWidthIn !== width || !S.txtScale) {
      S.txtScale = makeModel(mlayers, width, tol).xf.s;
      S.txtScaleKey = S.txtKey;
    }
    S.model = makeModel(mlayers, S.txtScale, tol, 1);
    const w = Math.round(S.model.width * 100) / 100;
    if (Math.abs(w - width) > 0.005 && w >= 1) el.width.value = w;
    S.txtWidthIn = Math.min(1000, Math.max(1, parseFloat(el.width.value) || 50));
  } else S.model = makeModel(mlayers, width, tol, refW);
  let m = S.model;
  if (S.mode === 'text' && m.layers.length) {
    // 획 폭 맞추기 (3D 출력용): 폰트의 지금 획 폭을 재서 정한 폭이 되도록 굵게·가늘게
    const allR = () => m.layers.flatMap((l) => l.items.map((it) => it.ring));
    const est = strokeOf(allR(), tol);
    const sw = parseFloat(el.txtSw.value);
    let now = est;
    if (sw > 0 && est.min > 0) {
      const d = (sw + 0.05 - est.min) / 2; // 최소 획 폭: 가는 곳이 정한 폭이 되게
      if (d > 0.005) {
        m.layers = m.layers.map((l) => ({ ...l, items: buildItems(growRings(l.items.map((it) => it.ring), d, tol), tol) })).filter((l) => l.items.length);
        now = strokeOf(allR(), tol);
      }
    }
    el.txtSwEst.textContent = T('지금 획: 보통 {a} · 가장 가는 곳 {b}mm', { a: now.typ.toFixed(2), b: now.min.toFixed(2) });
    el.txtSwEst.style.color = now.min < 0.8 ? '#c92a2a' : '';
  }
  if (S.mode === 'image' && S.edits.length) applyEdits(m, S.edits, tol);
  if (S.reselect && S.selPts && S.selPts.length && S.mode === 'image') {
    const sh = m.editShift || [0, 0];
    const pts = S.selPts.map((p) => [p[0] + S.selShift[0] - sh[0], p[1] + S.selShift[1] - sh[1]]);
    S.selShift = sh.slice();
    const sels = [], keepPts = [];
    for (const p of pts) {
      const h = hitItem(m, p[0], p[1]);
      if (h && !sels.some((o) => o.c === h.c && o.i === h.i)) (sels.push(h), keepPts.push(p));
    }
    S.sels = sels;
    S.selPts = keepPts;
    S.selPt = keepPts[keepPts.length - 1] || null;
    S.sel = sels[sels.length - 1] || null;
  }
  S.reselect = false;
  checkSel();
  // 몰드·패턴: 실루엣을 바깥 벽 + 내부 무늬로 바꿈 (마지막 단계 — 편집·선택은 원래 도형 기준)
  if (el.mpOn && el.mpOn.checked && m.layers.length) {
    const r = applyPattern(m, {
      pattern: el.mpKind.value,
      width: parseFloat(el.mpW.value) || 1.2,
      pitch: parseFloat(el.mpPitch.value) || 5,
      wall: parseFloat(el.mpWall.value) || 2,
      angle: parseFloat(el.mpAngle.value) || 0,
      spokes: parseInt(el.mpSpokes.value, 10) || 12,
      color: el.mpColor.value,
    });
    S.silModel = { ...m, layers: m.layers.map((l) => ({ ...l })) }; // 몰드는 무늬가 아니라 원래 실루엣 기준
    S.model = m = r.model;
    const msgs = [];
    if (r.info.noInner) msgs.push(T('도형이 벽 폭보다 얇아 무늬가 들어갈 자리가 없습니다. 벽 폭을 줄이거나 너비를 키우세요.'));
    else if (r.info.empty) msgs.push(T('무늬가 하나도 들어가지 않았습니다. 간격을 좁혀 보세요.'));
    if (msgs.length) warnings.push('⚠ ' + msgs.join(' '));
    el.mpInfo.textContent = msgs.length ? '' : T('벽 {w}mm · 선 {l}mm · 조각 {n}개', { w: r.info.wall, l: r.info.lineWidth, n: m.ringCount });
    el.mpInfo.style.color = msgs.length ? '#c92a2a' : '';
    if (msgs.length) el.mpInfo.textContent = msgs[0];
  } else { S.silModel = null; if (el.mpInfo) el.mpInfo.textContent = ''; }
  if (S.mode === 'text') {
    m.fromText = true;
    m.chars = layers.chars || [];
    // 글자를 옮겨 전체 범위가 바뀌어도 화면에서 나머지 글자가 제자리에 있게
    if (S.vb2 && prevXf && m.xf && Math.abs(prevXf.s - m.xf.s) < 1e-9) {
      S.vb2[0] += (prevXf.x0 - m.xf.x0) * m.xf.s;
      S.vb2[1] += (prevXf.y0 - m.xf.y0) * m.xf.s;
    }
  }
  if (!m.layers.length) {
    S.dirty3d = true;
    render2d();
    render3dIfVisible();
    updateButtons();
    el.heightOut.textContent = '-';
    setStatus('');
    setMsg([T('추출된 도형이 없습니다.') + (S.mode === 'image' ? T(' 임계값·색 수를 바꿔 보세요.') : '')].concat(warnings));
    updateEditBar();
    pushHist();
    return;
  }
  if (S.mode === 'image' && S.autoNote) warnings.push(T(S.autoNote));
  if (S.mode === 'image' && S.autoNote2 && parseInt(el.colors.value, 10) > 1) warnings.push(T(S.autoNote2, { n: S.autoN }));
  if (S.mode === 'image' && el.engine.value === 'potrace')
    warnings.push(T(parseInt(el.colors.value, 10) > 1 ? 'Potrace 엔진은 흑백 전용이라 다색에는 기본 엔진을 썼습니다.' : 'Potrace 엔진: 디자인 보정(직선·원호·평행 등)은 적용되지 않습니다. GPL-2.0 라이선스.'));
  if (S.mode === 'image' && S.img && parseInt(el.upscale.value, 10) > 1 && Math.max(S.img.natW, S.img.natH) >= 1200)
    warnings.push(T('이미지가 이미 충분히 커서 AI 업스케일 효과가 작습니다. 작거나 흐린 이미지에 쓰세요.'));
  S.thinPolys = null;
  if (m.ringCount <= 3000 && el.preset.value !== 'laser') {
    // 3D 프린트로 잘 안 나올 수 있는 부분 (얇은 선·아주 작은 조각·아주 작은 구멍)
    try {
      const r = printabilityReport(m);
      const parts = [];
      S.thinPolys = r.polys;
      if (r.thin) parts.push(T('가는 선 {n}곳 (폭 {w}mm 미만)', { n: r.thin, w: r.minW }));
      if (r.island) parts.push(T('아주 작은 조각 {n}개', { n: r.island }));
      if (r.hole) parts.push(T('아주 작은 구멍 {n}개', { n: r.hole }));
      if (parts.length) {
        const fix = S.mode === 'image' && r.thin ? ` <button class="btn small" data-act="fixthin">${T('가는 부분 보정 (0.8mm)')}</button>` : S.mode === 'text' && r.thin && !(parseFloat(el.txtSw.value) > 0) ? ` <button class="btn small" data-act="txtsw">${T('획 폭 0.8mm로')}</button>` : '';
        warnings.push(T('빨간 표시가 3D 출력에서 안 나오거나 끊길 수 있는 부분입니다.') + fix);
      }
      if (parts.length) warnings.push(T(S.mode === 'text' ? '⚠ 출력이 잘 안 될 수 있는 부분: {list}. 너비를 키우거나 두꺼운 폰트를 써 보세요.' : '⚠ 출력이 잘 안 될 수 있는 부분: {list}. 너비를 키우거나 고급 설정의 노이즈 제거를 올려 보세요.', { list: parts.join(', ') }));
    } catch (e) {}
  }
  if (m.ringCount > 3000) warnings.push(T(S.mode === 'text' ? '도형 조각이 {n}개로 많습니다. 곡선 정밀도를 낮추면 가벼워집니다.' : "도형 조각이 {n}개로 많습니다. 고급 설정의 '노이즈 제거'나 '곡선 허용오차'를 올리면 가벼워집니다.", { n: m.ringCount }));
  if (S.flash) {
    warnings.unshift(S.flash);
    S.flash = '';
  }
  el.heightOut.textContent = m.height.toFixed(2);
  {
    const kk = kcOpts();
    const fk = kk.on + '|' + kk.u + '|' + kk.h;
    if (S.kcFrameKey !== fk) (S.kcFrameKey = fk), (S.dirty3d = true); // 키캡을 켜거나 크기를 바꾸면 화면을 다시 맞춤
  }
  S.dirty3d = S.dirty3d || !S.frameSize; // 새 이미지·모드·프로젝트·'처음으로' 때만 화면을 처음 자리로
  render2d();
  render3dIfVisible();
  S.keepView = false;
  updateButtons();
  updateEditBar();
  updateKcInfo();
  const sw = m.layers.map((l) => `<span><i class="sw" style="background:${l.color}"></i>${l.color}</span>`).join(' ');
  setStatus(
    `<span>${T('도형 {n}개', { n: m.ringCount })}</span><span>${T('노드 {n}', { n: m.nodeCount })}</span><span>${m.width.toFixed(1)} × ${m.height.toFixed(1)} mm</span>${sw}${fixSummary(layers, m)}`
  );
  setMsg(warnings);
  autosave();
  pushHist();
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
  clearSel();
  el.heightOut.textContent = '-';
  setStatus('');
  setMsg([]);
  updateButtons();
  updateEditBar();
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
  const sv = el.view2d.querySelector('svg');
  if (!sv) return;
  sv.style.overflow = 'visible';
  const W = m.width, H = m.height, M = Math.max(W, H);
  let box = [0, 0, W, H];
  if (m.plate && needPlate()) {
    const NS = 'http://www.w3.org/2000/svg';
    const pl = document.createElementNS(NS, 'path');
    pl.setAttribute('d', m.plate.map((it) => 'M' + it.poly.map(([x, y]) => x.toFixed(3) + ' ' + y.toFixed(3)).join('L') + 'Z').join(''));
    Object.entries({ fill: '#e9ecf2', stroke: '#9aa3b5', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'stroke-dasharray': '4 3', 'fill-rule': 'evenodd' }).forEach(([k, v]) => pl.setAttribute(k, v));
    sv.insertBefore(pl, sv.firstChild);
  }
  el.bucketBar.style.display = S.view === '2d' && (S.mode === 'image' || S.mode === 'text') ? '' : 'none';
  // 3D 출력에 너무 가는 부분 표시 (빨강)
  const thinOn = S.thinPolys && S.thinPolys.length && el.preset.value !== 'laser';
  el.thinBtn.classList.toggle('hide', !thinOn);
  el.thinBtn.classList.toggle('on', thinOn && S.showThin !== false);
  if (thinOn && S.showThin !== false) {
    const NS = 'http://www.w3.org/2000/svg';
    const tp = document.createElementNS(NS, 'path');
    tp.setAttribute('class', 'thinmark');
    tp.setAttribute('d', S.thinPolys.map((p) => 'M' + p.map(([x, y]) => x.toFixed(3) + ' ' + y.toFixed(3)).join('L') + 'Z').join(''));
    Object.entries({ fill: 'rgba(255,0,40,.55)', stroke: '#ff0028', 'stroke-width': 2.5, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }).forEach(([k, v]) => tp.setAttribute(k, v));
    sv.appendChild(tp);
  }
  drawSelUi(sv);
  if (S.showDims) {
    addDims2d(sv, W, H);
    box = [-M * 0.02, -M * 0.02, W + M * 0.16, H + M * 0.16];
  }
  const bw = box[2] - box[0], bh = box[3] - box[1];
  if (S.mode === 'text') {
    // 텍스트: 글자 수와 상관없이 비슷한 크기로 보이게 — 가로는 화면의 92%, 세로는 68%까지만 차지 (한 글자는 커지지 않게, 긴 글은 작아지지 않게)
    const A = Math.max(0.3, (el.view2d.clientWidth || 800) / (el.view2d.clientHeight || 500));
    const vw = Math.max(bw / 0.92, (bh / 0.68) * A), vh = vw / A;
    S.fit2 = [box[0] - (vw - bw) / 2, box[1] - (vh - bh) / 2, vw, vh];
  } else {
    const f = 0.92;
    S.fit2 = [box[0] - (bw / f - bw) / 2, box[1] - (bh / f - bh) / 2, bw / f, bh / f];
  }
  applyVb2();
}
/** 선택 글자 상자 · 크기 점 · 회전 점 · 크기 표시 (확대·축소해도 같은 크기로 보이게 매번 다시 그림) */
function drawSelUi(sv) {
  sv.querySelectorAll('g.chui').forEach((n) => n.remove());
  if (S.mode === 'image') return drawImgSel(sv);
  if (S.mode !== 'text' || S.selChar == null || !S.model) return;
  if (selIdx().length > 1) {
    const NS2 = 'http://www.w3.org/2000/svg', g2 = document.createElementNS(NS2, 'g');
    g2.setAttribute('class', 'chui');
    for (const i of selIdx()) {
      const b = charBoxMm(i);
      if (!b) continue;
      const r = document.createElementNS(NS2, 'rect');
      Object.entries({ x: b[0] - 0.4, y: b[1] - 0.4, width: b[2] - b[0] + 0.8, height: b[3] - b[1] + 0.8, fill: 'rgba(29,95,214,.12)', stroke: '#1d5fd6', 'stroke-width': 1.5, 'stroke-dasharray': '5 3', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }).forEach(([k, v]) => r.setAttribute(k, v));
      g2.appendChild(r);
    }
    sv.appendChild(g2);
    return;
  }
  const cb = charBoxMm(S.selChar);
  if (!cb) return;
  const NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'chui');
  const mk = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text != null) n.textContent = text;
    g.appendChild(n);
    return n;
  };
  const vb = S.vb2 || S.fit2;
  const upp = vb ? vb[2] / Math.max(1, el.view2d.clientWidth) : 0.2; // 화면 1px = upp mm
  const pad = 4 * upp, hs = 4.5 * upp;
  const X0 = cb[0] - pad, Y0 = cb[1] - pad, X1 = cb[2] + pad, Y1 = cb[3] + pad;
  mk('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, fill: 'none', stroke: '#1d5fd6', 'stroke-width': 1.5, 'stroke-dasharray': '5 3', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' });
  for (const [nm, hx, hy] of [['nw', X0, Y0], ['ne', X1, Y0], ['sw', X0, Y1], ['se', X1, Y1]]) {
    mk('rect', { x: hx - hs, y: hy - hs, width: hs * 2, height: hs * 2, fill: '#fff', stroke: '#1d5fd6', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke', class: 'chhandle h-' + nm, 'data-h': nm });
  }
  const rx = (X0 + X1) / 2, ry = Y0 - 22 * upp;
  mk('line', { x1: rx, y1: Y0, x2: rx, y2: ry, stroke: '#1d5fd6', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' });
  mk('circle', { cx: rx, cy: ry, r: hs * 1.2, fill: '#1d5fd6', stroke: '#fff', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke', class: 'chhandle rot', 'data-h': 'rot' });
  mk('text', { x: rx, y: Y1 - 7 * upp, 'font-size': 11 * upp, 'font-family': 'system-ui,sans-serif', 'font-weight': 600, fill: '#1d5fd6', stroke: '#fff', 'stroke-width': 3 * upp, 'paint-order': 'stroke', 'text-anchor': 'middle', class: 'chsize', 'data-h': 'size' }, null);
  {
    const tx = g.lastChild;
    const a = document.createElementNS(NS, 'tspan'), b = document.createElementNS(NS, 'tspan'), c = document.createElementNS(NS, 'tspan');
    a.setAttribute('data-h', 'sizew'); a.textContent = (cb[2] - cb[0]).toFixed(1);
    b.textContent = ' × ';
    c.setAttribute('data-h', 'sizeh'); c.textContent = (cb[3] - cb[1]).toFixed(1);
    const u = document.createElementNS(NS, 'tspan'); u.textContent = ' mm';
    [a, b, c, u].forEach((n) => tx.appendChild(n));
  }
  if (document.activeElement !== el.chW) el.chW.value = (cb[2] - cb[0]).toFixed(1);
  if (document.activeElement !== el.chH) el.chH.value = (cb[3] - cb[1]).toFixed(1);;
  sv.appendChild(g);
}
S.sels = [];
S.selPts = [];
function clearSel() {
  S.sels = [];
  S.sel = null;
  S.selPts = [];
  S.selPt = null;
}
function checkSel() {
  const m = S.model;
  if (!m || S.mode !== 'image') return clearSel();
  S.sels = (S.sels || []).filter((q) => {
    const l = m.layers.find((x) => x.color === q.c);
    return l && q.i < l.items.length;
  });
  S.sel = S.sels[S.sels.length - 1] || null;
  if (!S.sels.length) (S.selPts = []), (S.selPt = null);
}
/** 선택을 바꿈 (pts: 각 도형 안쪽의 점 — 편집 뒤 같은 도형을 다시 찾는 데 씀) */
function setSels(arr, pts) {
  S.sels = arr;
  S.sel = arr[arr.length - 1] || null;
  S.chain = null;
  S.selPts = pts || arr.map((q) => innerPoint(S.model, q.c, q.i)).filter(Boolean);
  S.selPt = S.selPts[S.selPts.length - 1] || null;
  S.selShift = ((S.model && S.model.editShift) || [0, 0]).slice();
  const sv = el.view2d.querySelector('svg');
  if (sv) drawSelUi(sv);
  updateEditBar();
}
/** 미리보기에서 선택한 도형 표시 (확대·축소해도 같은 굵기) */
function drawImgSel(sv) {
  const m = S.model;
  if (!m || !S.sels.length) return;
  const NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'chui');
  let d = '';
  for (const q of S.sels) {
    const l = m.layers.find((x) => x.color === q.c);
    const it = l && l.items[q.i];
    if (!it) continue;
    const grp = [q.i].concat(it.hole ? [] : l.items.map((x, j) => (x.hole && x.parent === q.i ? j : -1)).filter((j) => j >= 0));
    d += grp.map((j) => 'M' + l.items[j].poly.map(([x, y]) => x.toFixed(3) + ' ' + y.toFixed(3)).join('L') + 'Z').join('');
  }
  if (!d) return;
  const pth = document.createElementNS(NS, 'path');
  Object.entries({ d, fill: 'rgba(29,95,214,.22)', 'fill-rule': 'evenodd', stroke: '#1d5fd6', 'stroke-width': 2, 'stroke-dasharray': '6 3', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }).forEach(([k, v]) => pth.setAttribute(k, v));
  g.appendChild(pth);
  sv.appendChild(g);
}
function pickAt(e) {
  S.chain = null;
  const sv = el.view2d.querySelector('svg');
  const ctm = sv && sv.getScreenCTM();
  if (!ctm) return;
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  const h = hitItem(S.model, pt.x, pt.y);
  setSels(h ? [h] : [], h ? [[pt.x, pt.y]] : []);
}
function pickSel(q) {
  setSels(q ? [q] : []);
}
function updateEditBar() {
  const m = S.model, q = S.sel;
  const l = m && q && m.layers.find((x) => x.color === q.c);
  const it = l && l.items[q.i];
  const mp = el.mpOn && el.mpOn.checked; // 패턴을 씌운 뒤에는 도형 편집 대상이 달라져 혼란 → 도구를 숨김
  const on = S.mode === 'image' && S.view === '2d' && !!S.model && !mp;
  el.editbar.style.display = on ? '' : 'none';
  el.bucketBar.style.display = !mp && S.view === '2d' && S.model && (S.mode === 'image' || S.mode === 'text') ? '' : 'none';
  el.editbar.classList.toggle('nosel', !it);
  el.edTextEdit.classList.toggle('hide', !(it && addAtSel()));
  if (it && S.sels.length > 1) {
    el.edInfo.innerHTML = `<i class="sw" style="background:${q.c}"></i>${T('도형 {n}개 선택', { n: S.sels.length })}`;
    if (document.activeElement !== el.edColor) el.edColor.value = /^#[0-9a-f]{6}$/i.test(q.c) ? q.c : '#000000';
    el.edHoles.disabled = false;
    return;
  }
  if (!it) {
    el.edInfo.textContent = T('도형을 누르면 선택 · 삭제 · 두께 · 색 편집');
    return;
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of it.poly) (x < x0 && (x0 = x), x > x1 && (x1 = x), y < y0 && (y0 = y), y > y1 && (y1 = y));
  el.edInfo.innerHTML = `<i class="sw" style="background:${q.c}"></i>${T(it.hole ? '구멍' : '도형')} ${(x1 - x0).toFixed(1)} × ${(y1 - y0).toFixed(1)} mm`;
  if (document.activeElement !== el.edColor) el.edColor.value = /^#[0-9a-f]{6}$/i.test(q.c) ? q.c : '#000000';
  el.edHoles.disabled = el.edScope.value === 'shape' && !it.hole && !l.items.some((x) => x.hole && x.parent === q.i);
}
/** 도형 편집 한 가지를 기록하고 다시 계산 (범위: 선택한 도형 / 그 색 전체) */
function editOp(t, x = {}) {
  const qs = S.sels;
  if (!qs.length || S.mode !== 'image') return;
  const whole = el.edScope.value === 'color';
  const by = new Map();
  for (const q of qs) (by.get(q.c) || by.set(q.c, []).get(q.c)).push(q.i);
  const W0 = S.model.baseW || S.model.width;
  let list = [...by].map(([c, is]) => ({ t, c, w0: W0, ...(whole ? { i: null } : { is: is.sort((a, b) => a - b) }), ...x }));
  if (t === 'col') list = list.filter((e) => e.c !== x.to);
  if (!list.length) return;
  const tail = S.edits.slice(-list.length);
  // 두께 +/−를 이어서 누르면 같은 편집에 더함 → 늘렸다 줄이면 원래대로 (겹쳐 합쳐진 뒤에도 깨지지 않음)
  if ((t === 'off' || t === 'mv') && S.chain === t && tail.length === list.length && tail.every((l, k) => l.t === t && l.c === list[k].c && !!l.is === !!list[k].is && (!l.is || l.is.length === list[k].is.length))) {
    for (const l of tail) {
      const f = (l.w0 || W0) / W0;
      if (t === 'off') l.d = Math.round((l.d + x.d * f) * 1e4) / 1e4;
      else (l.dx += x.dx * f), (l.dy += x.dy * f);
    }
    if (tail.every((l) => (t === 'off' ? Math.abs(l.d) < 1e-6 : Math.hypot(l.dx, l.dy) < 1e-6))) (S.edits.length -= tail.length), (S.chain = null);
  } else {
    S.edits.push(...list);
    S.chain = t === 'off' || t === 'mv' ? t : null;
  }
  S.editsKey = S.traceKey;
  const keep = t === 'off' || t === 'col' || t === 'mv';
  S.sels = [];
  S.sel = null;
  if (!keep) (S.selPts = []), (S.selPt = null);
  S.reselect = keep;
  schedule(0);
}
function applyVb2() {
  const sv = el.view2d.querySelector('svg');
  const b = S.vb2 || S.fit2;
  if (sv && b) sv.setAttribute('viewBox', b.map((v) => +v.toFixed(4)).join(' '));
  if (sv) drawSelUi(sv);
}
/** 2D 치수선 (화면 표시용, 저장 파일에는 없음) */
function addDims2d(sv, W, H) {
  const NS = 'http://www.w3.org/2000/svg';
  const M = Math.max(W, H), d = M * 0.06, fs = M * 0.026 * S.prefs.dimSize, col = S.prefs.dimColor;
  const g = document.createElementNS(NS, 'g');
  const line = (x1, y1, x2, y2) => {
    const l = document.createElementNS(NS, 'line');
    Object.entries({ x1, y1, x2, y2, stroke: col, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }).forEach(([k, v]) => l.setAttribute(k, v));
    g.appendChild(l);
  };
  const text = (x, y, str, rot, edit) => {
    const t = document.createElementNS(NS, 'text');
    if (edit) {
      t.classList.add('edit');
      t.addEventListener('pointerdown', (e) => e.stopPropagation());
      t.addEventListener('click', (e) => {
        const r = t.getBoundingClientRect();
        openNumEditor(r.left + r.width / 2, r.top + r.height / 2, edit.v, edit.set);
      });
      const tt = document.createElementNS(NS, 'title');
      tt.textContent = T('눌러서 치수 바꾸기');
      t.appendChild(tt);
    }
    Object.entries({ x, y, fill: col, 'font-size': fs, 'font-family': 'system-ui,sans-serif', 'font-weight': 600, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }).forEach(([k, v]) => t.setAttribute(k, v));
    if (rot) t.setAttribute('transform', `rotate(-90 ${x} ${y})`);
    t.textContent = str;
    g.appendChild(t);
  };
  const tk = d * 0.35;
  line(0, H + d, W, H + d);
  line(0, H + d - tk, 0, H + d + tk);
  line(W, H + d - tk, W, H + d + tk);
  text(W / 2, H + d - fs * 0.7, `${W.toFixed(1)} mm`, false, { v: W, set: (v) => setModelSize(v / W) });
  line(W + d, 0, W + d, H);
  line(W + d - tk, 0, W + d + tk, 0);
  line(W + d - tk, H, W + d + tk, H);
  text(W + d - fs * 0.7, H / 2, `${H.toFixed(1)} mm`, true, { v: H, set: (v) => setModelSize(v / H) });
  sv.appendChild(g);
}
/** 도형 전체 크기를 배율만큼 (너비 입력값을 바꿈) */
function setModelSize(k) {
  if (!(k > 0) || !isFinite(k)) return;
  const w = (parseFloat(el.width.value) || 50) * k;
  el.width.value = Math.min(1000, Math.max(1, Math.round(w * 100) / 100));
  schedule(0);
}
/** 숫자 바로 고치기: 화면 위치에 작은 입력 칸 */
function openNumEditor(x, y, value, onSet) {
  document.querySelectorAll('input.numedit').forEach((e) => e.remove());
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.step = '0.1';
  inp.className = 'numedit';
  inp.value = (Math.round(value * 100) / 100).toString();
  inp.style.left = x + 'px';
  inp.style.top = y + 'px';
  document.body.appendChild(inp);
  inp.focus();
  inp.select();
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    const v = parseFloat(inp.value);
    inp.remove();
    if (ok && isFinite(v) && Math.abs(v - value) > 1e-6) onSet(v);
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  inp.addEventListener('blur', () => finish(true));
}

// ---------- 글자별 조절 ----------
S.charStyles = {}; // 글자 번호 → {s, dx, dy(em), dz(mm), color}
S.selChar = null;
S.selSet = [];
/** 선택된 글자들 (대표 글자 S.selChar가 없으면 비어 있음) */
const selIdx = () => (S.selChar == null ? [] : S.selSet.includes(S.selChar) ? S.selSet : [S.selChar]);
S.prevText = null;
/** 글자를 고치면 앞·뒤 공통 부분의 글자 모양은 그대로 따라가게 */
function syncCharStyles(text) {
  const a = S.prevText == null ? null : [...S.prevText];
  const b = [...text];
  S.prevText = text;
  if (!a || a.join('') === text) return;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  const out = {};
  for (const [k, v] of Object.entries(S.charStyles)) {
    const i = +k;
    if (i < p) out[i] = v;
    else if (i >= a.length - q) out[i + b.length - a.length] = v;
  }
  S.charStyles = out;
  if (S.selChar != null) {
    if (S.selChar >= a.length - q) S.selChar += b.length - a.length;
    else if (S.selChar >= p) S.selChar = null;
    S.selSet = S.selChar == null ? [] : [S.selChar];
  }
}
const isStyled = (st) => st && ((st.s && st.s !== 1) || (st.sx && st.sx !== 1) || (st.sy && st.sy !== 1) || st.r || st.dx || st.dy || st.dz || (st.color && st.color !== '#000000'));
function renderCharChips(text) {
  const chars = [...text];
  const sig = text + '|' + selIdx().join(',') + '|' + JSON.stringify(S.charStyles);
  if (el.charChips.dataset.sig === sig) return;
  el.charChips.dataset.sig = sig;
  el.charChips.innerHTML = '';
  chars.forEach((ch, i) => {
    if (/\s/.test(ch)) return;
    const b = document.createElement('button');
    b.className = 'chchip' + (selIdx().includes(i) ? ' sel' : '') + (isStyled(S.charStyles[i]) ? ' mod' : '');
    b.textContent = ch;
    const st = S.charStyles[i];
    if (st && st.color) b.style.color = st.color;
    b.onclick = (ev) => selectChar(!(ev.ctrlKey || ev.metaKey || ev.shiftKey) && selIdx().length === 1 && S.selChar === i ? null : i, ev.ctrlKey || ev.metaKey || ev.shiftKey);
    el.charChips.appendChild(b);
  });
  el.chResetAll.classList.toggle('hide', !Object.keys(S.charStyles).length);
  const st = S.selChar != null ? S.charStyles[S.selChar] || {} : null;
  el.charEdit.classList.toggle('hide', !st);
  el.charHint.classList.toggle('hide', !!st);
  if (st) {
    el.chScale.value = Math.round((st.s || 1) * 100);
    el.chScaleVal.textContent = el.chScale.value + '%';
    el.chRot.value = Math.round(st.r || 0);
    el.chRotVal.textContent = el.chRot.value + '°';
    el.chDz.value = st.dz || 0;
    el.chColor.value = st.color || '#000000';
    const k = S.model && S.model.xf ? S.model.xf.s * 100 : 1;
    if (document.activeElement !== el.chDx) el.chDx.value = (Math.round((st.dx || 0) * k * 10) / 10).toString();
    if (document.activeElement !== el.chDy) el.chDy.value = (Math.round((st.dy || 0) * k * 10) / 10).toString();
  }
}
function selectChar(i, add) {
  if (i == null) (S.selSet = []), (S.selChar = null);
  else if (add) {
    const cur = selIdx().slice(), k = cur.indexOf(i);
    k >= 0 ? cur.splice(k, 1) : cur.push(i);
    S.selSet = cur;
    S.selChar = cur.length ? cur[cur.length - 1] : null;
  } else (S.selSet = [i]), (S.selChar = i);
  el.charChips.dataset.sig = '';
  renderCharChips(el.text.value);
  render2d();
}
function setCharStyle(i, patch) {
  applyCharStyle(i, patch);
  commitCharStyle();
}
function applyCharStyle(i, patch) {
  const st = { ...(S.charStyles[i] || {}), ...(typeof patch === 'function' ? patch(S.charStyles[i] || {}) : patch) };
  for (const k of Object.keys(st)) if (!st[k] || ((k === 's' || k === 'sx' || k === 'sy') && st[k] === 1) || (k === 'color' && st[k] === '#000000')) delete st[k];
  if (Object.keys(st).length) S.charStyles[i] = st;
  else delete S.charStyles[i];
}
function commitCharStyle() {
  el.charChips.dataset.sig = '';
  holdView();
  schedule(0);
}
/** 선택한 글자 모두에 적용 (patch가 함수면 글자마다 현재 값으로 계산) */
function setSelStyle(patch) {
  for (const i of selIdx()) applyCharStyle(i, patch);
  commitCharStyle();
}
/** 글자별 조절 중에는 지금 보고 있는 화면(확대·각도)을 그대로 둔다 */
function holdView() {
  S.keepView = true;
  if (S.view === '2d' && !S.vb2 && S.fit2) S.vb2 = S.fit2.slice();
}
/** 선택 글자의 범위 (mm, 미리보기 좌표) */
function charBoxMm(i) {
  const m = S.model;
  if (!m || !m.chars || !m.xf) return null;
  const c = m.chars.find((c) => c.i === i);
  if (!c) return null;
  const { s, x0, y0 } = m.xf;
  return [(c.box[0] - x0) * s, (c.box[1] - y0) * s, (c.box[2] - x0) * s, (c.box[3] - y0) * s];
}
/** 선택 글자의 기준점들 (mm): 범위 cb, 글자 기준점 O(크기 조절 기준), 회전 중심 C */
function charAnchor(i) {
  const m = S.model;
  const cb = charBoxMm(i);
  if (!cb) return null;
  const c = m.chars.find((c) => c.i === i);
  const { s, x0, y0 } = m.xf;
  return { cb, O: [(c.o[0] - x0) * s, (c.o[1] - y0) * s], C: [(c.c[0] - x0) * s, (c.c[1] - y0) * s] };
}
/** 선택 글자 치수(mm) 바꾸기: 가로만 / 세로만(따로 늘임) / 둘 다 같은 비율(회전한 글자). 글자 범위의 중심은 그대로 */
function applyCharSize(i, wNew, hNew) {
  const an = charAnchor(i);
  if (!an) return;
  const st = S.charStyles[i] || {};
  const w = an.cb[2] - an.cb[0], h = an.cb[3] - an.cb[1];
  let kx = wNew > 0 ? wNew / w : 1, ky = hNew > 0 ? hNew / h : 1;
  const patch = {};
  if (Math.abs(st.r || 0) > 0.01) {
    const k = wNew > 0 ? kx : ky;
    const s1 = Math.min(5, Math.max(0.1, (st.s || 1) * k));
    kx = ky = s1 / (st.s || 1);
    patch.s = s1;
  } else {
    if (wNew > 0) {
      const v = Math.min(8, Math.max(0.1, (st.sx || 1) * kx));
      kx = v / (st.sx || 1);
      patch.sx = v;
    }
    if (hNew > 0) {
      const v = Math.min(8, Math.max(0.1, (st.sy || 1) * ky));
      ky = v / (st.sy || 1);
      patch.sy = v;
    }
  }
  const F = [(an.cb[0] + an.cb[2]) / 2, (an.cb[1] + an.cb[3]) / 2], q = 1 / (S.model.xf.s * 100);
  if (!S.vb2 && S.fit2) S.vb2 = S.fit2.slice();
  patch.dx = (st.dx || 0) + (F[0] - an.O[0]) * (1 - kx) * q;
  patch.dy = (st.dy || 0) - (F[1] - an.O[1]) * (1 - ky) * q;
  setCharStyle(i, patch);
}
// 크기 숫자(가로 · 세로)를 눌러 직접 입력
el.view2d.addEventListener('click', (e) => {
  const h = e.target.closest && e.target.closest('[data-h^="size"]');
  if (!h || S.selChar == null) return;
  const an = charAnchor(S.selChar);
  if (!an) return;
  const isW = h.getAttribute('data-h') === 'sizew';
  const r = h.getBoundingClientRect();
  openNumEditor(r.left + r.width / 2, r.top + r.height / 2, isW ? an.cb[2] - an.cb[0] : an.cb[3] - an.cb[1], (v) => applyCharSize(S.selChar, isW ? v : 0, isW ? 0 : v));
});
el.chW.addEventListener('change', () => S.selChar != null && applyCharSize(S.selChar, parseFloat(el.chW.value) || 0, 0));
el.chH.addEventListener('change', () => S.selChar != null && applyCharSize(S.selChar, 0, parseFloat(el.chH.value) || 0));
el.chScale.addEventListener('input', () => {
  el.chScaleVal.textContent = el.chScale.value + '%';
  if (S.selChar != null) setSelStyle({ s: parseInt(el.chScale.value, 10) / 100 });
});
el.chRot.addEventListener('input', () => {
  el.chRotVal.textContent = el.chRot.value + '°';
  if (S.selChar != null) setSelStyle({ r: parseFloat(el.chRot.value) || 0 });
});
el.chDz.addEventListener('input', () => S.selChar != null && setSelStyle({ dz: parseFloat(el.chDz.value) || 0 }));
el.chColor.addEventListener('input', () => S.selChar != null && setSelStyle({ color: el.chColor.value.toLowerCase() }));
const mmToEm = (v) => (S.model && S.model.xf ? v / (S.model.xf.s * 100) : 0);
const movePrim = (key, v) => {
  if (S.selChar == null) return;
  const d = mmToEm(v) - ((S.charStyles[S.selChar] || {})[key] || 0);
  setSelStyle((st) => ({ [key]: (st[key] || 0) + d }));
};
el.chDx.addEventListener('input', () => movePrim('dx', parseFloat(el.chDx.value) || 0));
el.chDy.addEventListener('input', () => movePrim('dy', parseFloat(el.chDy.value) || 0));
el.chReset.onclick = () => {
  if (S.selChar == null) return;
  for (const i of selIdx()) delete S.charStyles[i];
  el.charChips.dataset.sig = '';
  holdView();
  schedule(0);
};
el.chResetAll.onclick = () => {
  S.charStyles = {};
  S.selChar = null;
  S.selSet = [];
  el.charChips.dataset.sig = '';
  holdView();
  schedule(0);
};
// 방향키로 선택 글자 미세 이동 (0.2mm, Shift: 1mm)
window.addEventListener('keydown', (e) => {
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  if (e.key === 'd' || e.key === 'D') return el.dimsBtn.click();
  if (e.key === 'h' || e.key === 'H') return el.homeBtn.click();
  if (S.mode === 'image' && S.sels.length && S.view === '2d') {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      return editOp('del');
    }
    if (e.key === 'Escape') return setSels([], []);
  }
  if (S.bucket && e.key === 'Escape') return setBucket(false);
  if (S.eyedrop && e.key === 'Escape') return setDrop(false);
  if (S.placeText && e.key === 'Escape') return setPlace(false);
  if (S.cutMode && e.key === 'Escape') return setCut(false);
  if (S.mode !== 'text' || S.selChar == null) return;
  if (e.key === 'Escape') return selectChar(null);
  if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) return;
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  const d = dirs[e.key];
  if (!d) return;
  e.preventDefault();
  const step = mmToEm(e.shiftKey ? 1 : 0.2);
  if (!S.vb2 && S.fit2) S.vb2 = S.fit2.slice();
  setSelStyle((st) => ({ dx: (st.dx || 0) + d[0] * step, dy: (st.dy || 0) + d[1] * step }));
});

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT|BUTTON/.test((document.activeElement && document.activeElement.tagName) || '')) return;
  if (!S.space) (S.space = true), (el.view2d.style.cursor = 'grab');
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && S.space) (S.space = false), (el.view2d.style.cursor = S.cutMode ? 'crosshair' : '');
});
el.edDel.onclick = () => editOp('del');
el.edHoles.onclick = () => editOp('holes');
const edStepVal = () => Math.min(5, Math.max(0.05, parseFloat(el.edStep.value) || 0.2));
el.edPlus.onclick = () => editOp('off', { d: edStepVal() });
el.edMinus.onclick = () => editOp('off', { d: -edStepVal() });
el.edColor.onchange = () => S.sels.length && el.edColor.value.toLowerCase() !== S.sel.c.toLowerCase() && editOp('col', { to: el.edColor.value.toLowerCase() });
el.edClear.onclick = () => pickSel(null);
el.edCut.onclick = () => setCut(!S.cutMode);
function setCut(on) {
  S.cutMode = !!on && S.mode === 'image';
  el.edCut.classList.toggle('on', S.cutMode);
  el.view2d.style.cursor = S.cutMode ? 'crosshair' : '';
}
el.edScope.onchange = updateEditBar;
const BUCKET_CUR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text x="0" y="20" font-size="18">🪣</text></svg>')}") 3 20, crosshair`;
/** 페인트 통이 칠할 면 (미리 보여 주기용): null = 칠할 것 없음 */
function bucketTarget(P) {
  const m = S.model;
  if (!m) return null;
  const to = el.bucketCol.value.toLowerCase();
  if (S.mode === 'image') {
    const h = hitItem(m, P.x, P.y);
    if (!h) return null;
    const l = m.layers.find((x) => x.color === h.c), it = l.items[h.i];
    if (!it.hole && h.c.toLowerCase() === to) return { same: true };
    const polys = it.hole ? [it.poly] : [it.poly].concat(l.items.filter((x) => x.hole && x.parent === h.i).map((x) => x.poly));
    return { polys };
  }
  if (S.mode === 'text' && m.chars) {
    for (const c of m.chars) {
      const b = charBoxMm(c.i);
      if (b && P.x >= b[0] && P.x <= b[2] && P.y >= b[1] && P.y <= b[3]) {
        if (((S.charStyles[c.i] || {}).color || '#000000') === to) return { same: true };
        return { polys: [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]] };
      }
    }
  }
  return null;
}
let bkRaf = 0, bkEv = null;
function bucketHover(e) {
  bkEv = e;
  if (bkRaf) return;
  bkRaf = requestAnimationFrame(() => {
    bkRaf = 0;
    const sv = el.view2d.querySelector('svg');
    if (!sv || !S.bucket) return;
    sv.querySelectorAll('path.bkhover').forEach((n) => n.remove());
    const P = new DOMPoint(bkEv.clientX, bkEv.clientY).matrixTransform(sv.getScreenCTM().inverse());
    const t = bucketTarget(P);
    // 칠할 수 있는 곳: 통 아이콘 + 칠해질 면을 미리 표시 / 없거나 이미 같은 색: 금지 표시
    el.view2d.style.cursor = t && t.polys ? BUCKET_CUR : 'not-allowed';
    if (!t || !t.polys) return;
    const pth = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pth.setAttribute('class', 'bkhover');
    pth.setAttribute('d', t.polys.map((p) => 'M' + p.map(([x, y]) => x.toFixed(3) + ' ' + y.toFixed(3)).join('L') + 'Z').join(''));
    Object.entries({ fill: el.bucketCol.value, 'fill-opacity': 0.55, 'fill-rule': 'evenodd', stroke: '#111', 'stroke-width': 1.5, 'stroke-dasharray': '4 3', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }).forEach(([k, v]) => pth.setAttribute(k, v));
    sv.appendChild(pth);
  });
}
function setBucket(on) {
  S.bucket = !!on;
  if (on) (setCut(false), setDrop(false), S.placeText && setPlace(false));
  el.bucketBtn.classList.toggle('on', S.bucket);
  el.view2d.style.cursor = S.bucket ? BUCKET_CUR : '';
  if (!S.bucket) el.view2d.querySelectorAll('path.bkhover').forEach((n) => n.remove());
}
el.bucketBtn.onclick = () => setBucket(!S.bucket);
el.bucketCol.addEventListener('change', () => setBucket(true));
el.thinBtn.onclick = () => {
  S.showThin = S.showThin === false;
  render2d();
};
el.msg.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-act]');
  if (!b) return;
  if (b.dataset.act === 'fixthin' && S.mode === 'image') {
    S.edits.push({ t: 'minw', m: 0.8, c: S.sels.length && el.edScope.value === 'color' ? S.sel.c : null });
    S.editsKey = S.traceKey;
    clearSel();
    schedule(0);
  } else if (b.dataset.act === 'txtsw') {
    el.txtSw.value = 0.8;
    schedule(0);
  }
});
el.txtSw.addEventListener('input', () => schedule(150));
function setDrop(on) {
  S.eyedrop = !!on && S.sels.length > 0;
  el.edDrop.classList.toggle('on', S.eyedrop);
  el.view2d.style.cursor = S.eyedrop ? 'cell' : S.placeText ? 'copy' : S.cutMode ? 'crosshair' : '';
}
el.edDrop.onclick = () => setDrop(!S.eyedrop);
function setPlace(on) {
  if (!on) S.placeText = null;
  el.view2d.style.cursor = S.placeText ? 'copy' : S.cutMode ? 'crosshair' : '';
  el.edText.classList.toggle('on', !!S.placeText);
  if (S.placeText) {
    pickSel(null);
    el.edInfo.textContent = T('글자를 놓을 곳을 누르세요 (Esc 취소)');
  } else updateEditBar();
}
S.tdEdit = null; // 고치는 중인 글자 편집 번호
const curW = () => (S.model ? S.model.baseW || S.model.width : 1);
async function tdRings(text) {
  let font;
  try {
    font = await getFont(el.fontSel.value);
  } catch (e) {
    font = S.fonts[0].font;
  }
  const L = textToLayers(font, text, { align: el.align.value, lineHeight: parseFloat(el.lineH.value) || 1.2 }, fallbackFonts(font, text), null);
  return L.flatMap((l) => l.rings);
}
let tdEstSeq = 0;
async function updTdEst() {
  const my = ++tdEstSeq;
  const text = el.tdText.value.trim();
  if (!text) return (el.tdEst.textContent = '');
  const rings = await tdRings(text);
  if (my !== tdEstSeq || !rings.length) return;
  const s = Math.max(0.1, parseFloat(el.tdSize.value) || 5) / 100;
  const w = strokeOf(rings.map((r) => r.map((c) => c.map((v, i) => (i ? v * s : v)))));
  el.tdEst.textContent = T('이 크기에서 획: 보통 {a} · 가장 가는 곳 {b}mm', { a: w.typ.toFixed(2), b: w.min.toFixed(2) }) + (w.min < 0.8 ? ' — ' + T('3D 출력엔 가늘어요') : '');
}
function openTd(editIdx) {
  S.tdEdit = editIdx;
  const e = editIdx != null ? S.edits[editIdx] : null;
  el.tdTitle.textContent = T(e ? '글자 고치기' : '글자 넣기');
  el.tdDel.classList.toggle('hide', !e);
  el.tdMoveRow.classList.toggle('hide', !e);
  el.tdHint.classList.toggle('hide', !!e);
  el.tdMove.checked = false;
  if (e) {
    const k = e.w0 ? curW() / e.w0 : 1;
    el.tdText.value = e.text || '';
    el.tdText.disabled = !e.text;
    el.tdSize.value = Math.round(e.s * k * 100) / 100;
    el.tdColor.value = e.c;
    el.tdPrint.checked = e.sw > 0;
    if (e.sw > 0) el.tdSw.value = e.sw;
  } else {
    el.tdText.disabled = false;
    if (S.model && !el.tdSize.dataset.set) el.tdSize.value = Math.max(0.1, Math.round(S.model.height * 0.18 * 10) / 10);
    if (!el.tdColor.dataset.set) el.tdColor.value = S.sel && /^#[0-9a-f]{6}$/i.test(S.sel.c) ? S.sel.c : '#000000';
    if (!el.tdPrint.dataset.set) el.tdPrint.checked = el.preset.value !== 'laser';
  }
  el.tdSw.disabled = !el.tdPrint.checked;
  el.textDlg.showModal ? el.textDlg.showModal() : el.textDlg.setAttribute('open', '');
  el.tdText.focus();
  updTdEst();
}
el.edText.onclick = () => {
  if (S.placeText) return setPlace(false);
  setCut(false);
  openTd(null);
};
el.edTextEdit.onclick = () => {
  const a = addAtSel();
  if (a) openTd(a.idx);
};
/** 선택한 점이 들어 있는 '글자 넣기' 편집 */
function addAtSel() {
  const m = S.model, p = S.selPt;
  if (!m || !p || !m.addBoxes) return null;
  for (let i = m.addBoxes.length - 1; i >= 0; i--) {
    const a = m.addBoxes[i], b = a.box;
    if (a.idx >= 0 && S.edits[a.idx] && S.edits[a.idx].t === 'add' && p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]) return a;
  }
  return null;
}
el.tdColor.oninput = () => (el.tdColor.dataset.set = '1');
el.tdSize.oninput = () => ((el.tdSize.dataset.set = '1'), updTdEst());
el.tdText.oninput = () => updTdEst();
el.tdPrint.onchange = () => ((el.tdPrint.dataset.set = '1'), (el.tdSw.disabled = !el.tdPrint.checked));
el.textDlg.addEventListener('close', async () => {
  const rv = el.textDlg.returnValue;
  const ei = S.tdEdit;
  S.tdEdit = null;
  if (S.mode !== 'image') return;
  const sw = el.tdPrint.checked ? Math.min(5, Math.max(0.2, parseFloat(el.tdSw.value) || 0.8)) : 0;
  const size = Math.min(500, Math.max(0.1, parseFloat(el.tdSize.value) || 5));
  const col = el.tdColor.value.toLowerCase();
  if (ei != null) {
    const e = S.edits[ei];
    if (!e || e.t !== 'add') return;
    if (rv === 'del') {
      S.edits.splice(ei, 1);
    } else if (rv === 'ok') {
      const k = e.w0 ? curW() / e.w0 : 1;
      // 지금 너비 기준으로 다시 맞춤 (크기는 입력한 mm 그대로)
      e.x *= k;
      e.y *= k;
      e.w0 = curW();
      e.s = size;
      e.sw = sw;
      e.c = col;
      const text = el.tdText.value.replace(/\s+$/, '');
      if (e.text && text.trim() && text !== e.text) {
        const rings = await tdRings(text);
        if (rings.length) (e.rings = rings), (e.text = text), (e.font = el.fontSel.value);
      }
      if (el.tdMove.checked) {
        S.placeText = { move: ei };
        S.editsKey = S.traceKey;
        schedule(0);
        return setPlace(true);
      }
    } else return;
    S.editsKey = S.traceKey;
    clearSel();
    schedule(0);
    return;
  }
  if (rv !== 'ok') return;
  const text = el.tdText.value.replace(/\s+$/, '');
  if (!text.trim()) return;
  const rings = await tdRings(text);
  if (!rings.length) return;
  S.placeText = { rings, s: size, c: col, sw, text, font: el.fontSel.value };
  setPlace(true);
});

// 2D 확대(휠)·이동(끌기)·처음으로(더블클릭)
el.view2d.addEventListener(
  'wheel',
  (e) => {
    const sv = el.view2d.querySelector('svg');
    if (!sv || !S.fit2) return;
    e.preventDefault();
    const b = (S.vb2 || S.fit2).slice();
    const ctm = sv.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    let k = Math.pow(1.0015, e.deltaY);
    const nw = Math.min(S.fit2[2] * 4, Math.max(S.fit2[2] / 40, b[2] * k));
    k = nw / b[2];
    S.vb2 = [pt.x - (pt.x - b[0]) * k, pt.y - (pt.y - b[1]) * k, b[2] * k, b[3] * k];
    applyVb2();
  },
  { passive: false }
);
{
  let pan = null;
  let drag = null;
  let hd = null;
  let cutDrag = null;
  let mvDrag = null;
  let box = null;
  const startBox = (e, ctm, add) => {
    const P = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    box = { x: e.clientX, y: e.clientY, a: [P.x, P.y], b: [P.x, P.y], add, moved: false, ctm };
    el.view2d.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const boxSelect = (b) => {
    const x0 = Math.min(b.a[0], b.b[0]), x1 = Math.max(b.a[0], b.b[0]), y0 = Math.min(b.a[1], b.b[1]), y1 = Math.max(b.a[1], b.b[1]);
    if (S.mode === 'image') {
      const found = [];
      for (const l of S.model.layers)
        l.items.forEach((it, i) => {
          if (it.hole) return;
          let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
          for (const [x, y] of it.poly) (x < a0 && (a0 = x), x > a1 && (a1 = x), y < b0 && (b0 = y), y > b1 && (b1 = y));
          if (a0 >= x0 && a1 <= x1 && b0 >= y0 && b1 <= y1) found.push({ c: l.color, i });
        });
      const arr = b.add ? S.sels.slice() : [], pts = b.add ? S.selPts.slice() : [];
      for (const q of found) if (!arr.some((o) => o.c === q.c && o.i === q.i)) (arr.push(q), pts.push(innerPoint(S.model, q.c, q.i)));
      setSels(arr, pts.every(Boolean) ? pts : undefined);
    } else if (S.mode === 'text' && S.model && S.model.chars) {
      const arr = b.add ? selIdx().slice() : [];
      for (const c of S.model.chars) {
        const bb = charBoxMm(c.i);
        if (!bb) continue;
        const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
        if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 && !arr.includes(c.i)) arr.push(c.i);
      }
      S.selSet = arr;
      S.selChar = arr.length ? arr[arr.length - 1] : null;
      el.charChips.dataset.sig = '';
      renderCharChips(el.text.value);
      render2d();
    }
  };
  let raf = 0;
  el.view2d.addEventListener('pointerdown', (e) => {
    const sv = el.view2d.querySelector('svg');
    if (!sv || (e.button !== 0 && e.button !== 1) || !S.fit2) return;
    const ctm = sv.getScreenCTM();
    if (e.button === 1) {
      // 휠(가운데) 버튼: 어떤 모드에서도 화면 이동
      pan = { x: e.clientX, y: e.clientY, b: (S.vb2 || S.fit2).slice(), a: ctm ? ctm.a : 1, id: e.pointerId, mid: true };
      el.view2d.setPointerCapture(e.pointerId);
      el.view2d.classList.add('panning');
      e.preventDefault();
      return;
    }
    if (S.cutMode && S.mode === 'image' && ctm && S.model) {
      const P = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      cutDrag = { a: [P.x, P.y], b: [P.x, P.y], ctm, id: e.pointerId };
      el.view2d.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (S.bucket && ctm && S.model && (S.mode === 'image' || S.mode === 'text')) {
      const P = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      e.preventDefault();
      const to = el.bucketCol.value.toLowerCase();
      if (S.mode === 'image') {
        const h = hitItem(S.model, P.x, P.y);
        if (!h) return;
        if (e.altKey) return (el.bucketCol.value = h.c);
        const sh = S.model.editShift || [0, 0];
        S.edits.push({ t: 'fill', x: P.x + sh[0], y: P.y + sh[1], to, w0: curW() });
        S.editsKey = S.traceKey;
        clearSel();
        S.chain = null;
        schedule(0);
      } else if (S.model.chars) {
        let hit = null, ha = Infinity;
        for (const c of S.model.chars) {
          const b = charBoxMm(c.i);
          const a = b && (b[2] - b[0]) * (b[3] - b[1]);
          if (b && P.x >= b[0] && P.x <= b[2] && P.y >= b[1] && P.y <= b[3] && a < ha) (hit = c.i), (ha = a);
        }
        if (hit == null) return;
        if (e.altKey) return (el.bucketCol.value = (S.charStyles[hit] || {}).color || '#000000');
        setCharStyle(hit, { color: to });
      }
      return;
    }
    if (S.eyedrop && S.mode === 'image' && ctm && S.model) {
      const P = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const h = hitItem(S.model, P.x, P.y);
      e.preventDefault();
      if (h) {
        const to = h.c.toLowerCase();
        setDrop(false);
        if (!S.sels.every((q) => q.c.toLowerCase() === to)) editOp('col', { to });
      }
      return;
    }
    if (S.placeText && S.mode === 'image' && ctm && S.model) {
      const P = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const sh = S.model.editShift || [0, 0], pt = S.placeText;
      if (pt.move != null && S.edits[pt.move]) {
        const e0 = S.edits[pt.move], k0 = e0.w0 ? curW() / e0.w0 : 1;
        e0.x = (P.x + sh[0]) / k0;
        e0.y = (P.y + sh[1]) / k0;
      } else S.edits.push({ t: 'add', c: pt.c, rings: pt.rings, s: pt.s, sw: pt.sw || 0, text: pt.text, font: pt.font, x: P.x + sh[0], y: P.y + sh[1], w0: S.model.baseW || S.model.width });
      S.editsKey = S.traceKey;
      clearSel();
      S.selPt = null;
      S.chain = null;
      S.reselect = false;
      setPlace(false);
      schedule(0);
      e.preventDefault();
      return;
    }
    // 이미지 모드: 도형을 누르면 선택(Ctrl/Shift: 여러 개), 끌면 이동, 빈 곳을 끌면 영역 선택
    if (S.mode === 'image' && ctm && S.model && !S.cutMode && !S.space) {
      const P = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const hit = hitItem(S.model, P.x, P.y);
      const add = e.ctrlKey || e.metaKey || e.shiftKey;
      if (hit) {
        const k = S.sels.findIndex((q) => q.c === hit.c && q.i === hit.i);
        if (add) {
          const arr = S.sels.slice(), pts = S.selPts.slice();
          if (k >= 0) (arr.splice(k, 1), pts.splice(k, 1));
          else (arr.push(hit), pts.push([P.x, P.y]));
          setSels(arr, pts.length === arr.length ? pts : undefined);
          e.preventDefault();
          return;
        }
        if (k < 0) setSels([hit], [[P.x, P.y]]);
        mvDrag = { a: [P.x, P.y], x: e.clientX, y: e.clientY, ctm, moved: false, d: [0, 0] };
        el.view2d.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      startBox(e, ctm, add);
      return;
    }
    // 글자 모드: 선택 상자의 크기 점 · 회전 점
    const hEl = S.mode === 'text' && S.selChar != null && e.target.closest ? e.target.closest('[data-h]') : null;
    if (hEl && ctm) {
      const kind = hEl.getAttribute('data-h');
      if (kind.startsWith('size')) return; // click에서 처리
      const an = charAnchor(S.selChar);
      if (an) {
        const P = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
        const st = S.charStyles[S.selChar] || {};
        if (!S.vb2) S.vb2 = S.fit2.slice();
        const cb = an.cb;
        const corner = { nw: [cb[0], cb[1]], ne: [cb[2], cb[1]], sw: [cb[0], cb[3]], se: [cb[2], cb[3]] }[kind];
        const opp = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' }[kind];
        const F = kind === 'rot' ? null : { nw: [cb[0], cb[1]], ne: [cb[2], cb[1]], sw: [cb[0], cb[3]], se: [cb[2], cb[3]] }[opp];
        hd = { kind, i: S.selChar, x: e.clientX, y: e.clientY, a: ctm.a, P, st0: { s: st.s || 1, r: st.r || 0, dx: st.dx || 0, dy: st.dy || 0 }, an, corner, F, ang0: Math.atan2(P.y - an.C[1], P.x - an.C[0]) };
        el.view2d.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
    // 글자 모드: 글자를 누르면 선택 + 끌어 옮기기
    if (S.mode === 'text' && ctm && S.model && S.model.chars) {
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      let hit = null, ha = Infinity;
      for (const c of S.model.chars) {
        const b = charBoxMm(c.i);
        const a = (b[2] - b[0]) * (b[3] - b[1]);
        if (pt.x >= b[0] && pt.x <= b[2] && pt.y >= b[1] && pt.y <= b[3] && a < ha) {
          hit = c.i;
          ha = a;
        }
      }
      if (hit != null) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          selectChar(hit, true);
          e.preventDefault();
          return;
        }
        if (!selIdx().includes(hit)) selectChar(hit);
        if (!S.vb2) S.vb2 = S.fit2.slice();
        drag = { x: e.clientX, y: e.clientY, a: ctm.a, items: selIdx().map((i) => ({ i, dx: (S.charStyles[i] || {}).dx || 0, dy: (S.charStyles[i] || {}).dy || 0 })) };
        el.view2d.setPointerCapture(e.pointerId);
        return;
      }
      if (!S.space) return startBox(e, ctm, e.ctrlKey || e.metaKey || e.shiftKey);
    }
    pan = { x: e.clientX, y: e.clientY, b: (S.vb2 || S.fit2).slice(), a: ctm ? ctm.a : 1, id: e.pointerId };
    el.view2d.setPointerCapture(e.pointerId);
    el.view2d.classList.add('panning');
  });
  el.view2d.addEventListener('mousedown', (e) => e.button === 1 && e.preventDefault());
  el.view2d.addEventListener('pointerleave', () => el.view2d.querySelectorAll('path.bkhover').forEach((n) => n.remove()));
  el.view2d.addEventListener('pointermove', (e) => {
    if (S.bucket && !pan && !box) bucketHover(e);
    if (box) {
      const P = new DOMPoint(e.clientX, e.clientY).matrixTransform(box.ctm.inverse());
      box.b = [P.x, P.y];
      if (Math.hypot(e.clientX - box.x, e.clientY - box.y) >= 4) box.moved = true;
      const sv = el.view2d.querySelector('svg');
      if (sv && box.moved) {
        let r = sv.querySelector('rect.boxsel');
        if (!r) {
          r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          r.setAttribute('class', 'boxsel');
          Object.entries({ fill: 'rgba(29,95,214,.12)', stroke: '#1d5fd6', 'stroke-width': 1.2, 'stroke-dasharray': '4 3', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }).forEach(([k, v]) => r.setAttribute(k, v));
          sv.appendChild(r);
        }
        r.setAttribute('x', Math.min(box.a[0], box.b[0]));
        r.setAttribute('y', Math.min(box.a[1], box.b[1]));
        r.setAttribute('width', Math.abs(box.b[0] - box.a[0]));
        r.setAttribute('height', Math.abs(box.b[1] - box.a[1]));
      }
      return;
    }
    if (mvDrag) {
      const P = new DOMPoint(e.clientX, e.clientY).matrixTransform(mvDrag.ctm.inverse());
      if (Math.hypot(e.clientX - mvDrag.x, e.clientY - mvDrag.y) >= 4) mvDrag.moved = true;
      if (mvDrag.moved) {
        mvDrag.d = [P.x - mvDrag.a[0], P.y - mvDrag.a[1]];
        const g = el.view2d.querySelector('svg g.chui');
        if (g) g.setAttribute('transform', `translate(${mvDrag.d[0]} ${mvDrag.d[1]})`);
      }
      return;
    }
    if (cutDrag) {
      const P = new DOMPoint(e.clientX, e.clientY).matrixTransform(cutDrag.ctm.inverse());
      cutDrag.b = [P.x, P.y];
      const sv = el.view2d.querySelector('svg');
      let g = sv && sv.querySelector('g.cutline');
      if (sv && !g) {
        const NS = 'http://www.w3.org/2000/svg';
        g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'cutline');
        g.setAttribute('pointer-events', 'none');
        const pg = document.createElementNS(NS, 'polygon'), ln = document.createElementNS(NS, 'line');
        Object.entries({ fill: 'rgba(225,29,72,.35)', stroke: '#e11d48', 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }).forEach(([k, v]) => pg.setAttribute(k, v));
        Object.entries({ stroke: '#e11d48', 'stroke-width': 1, 'stroke-dasharray': '4 3', 'vector-effect': 'non-scaling-stroke' }).forEach(([k, v]) => ln.setAttribute(k, v));
        g.append(pg, ln);
        sv.appendChild(g);
      }
      if (g) {
        // 실제로 지워지는 범위(폭 w mm)를 그대로 보여 줌
        const [ax, ay] = cutDrag.a, [bx, by] = cutDrag.b, L = Math.hypot(bx - ax, by - ay) || 1;
        const w = Math.min(5, Math.max(0.05, parseFloat(el.edCutW.value) || 0.3)) / 2;
        const nx = (-(by - ay) / L) * w, ny = ((bx - ax) / L) * w;
        g.firstChild.setAttribute('points', `${ax + nx},${ay + ny} ${bx + nx},${by + ny} ${bx - nx},${by - ny} ${ax - nx},${ay - ny}`);
        Object.entries({ x1: ax, y1: ay, x2: bx, y2: by }).forEach(([k, v]) => g.lastChild.setAttribute(k, v));
      }
      return;
    }
    if (hd) {
      const P = { x: hd.P.x + (e.clientX - hd.x) / hd.a, y: hd.P.y + (e.clientY - hd.y) / hd.a };
      if (hd.kind === 'rot') {
        let r = hd.st0.r + ((Math.atan2(P.y - hd.an.C[1], P.x - hd.an.C[0]) - hd.ang0) * 180) / Math.PI;
        if (e.shiftKey) r = Math.round(r / 15) * 15;
        r = ((((r + 180) % 360) + 360) % 360) - 180;
        S.charStyles[hd.i] = { ...(S.charStyles[hd.i] || {}), r: Math.round(r * 10) / 10 };
      } else {
        const F = hd.F, c = hd.corner;
        const vx = c[0] - F[0], vy = c[1] - F[1];
        let k = ((P.x - F[0]) * vx + (P.y - F[1]) * vy) / (vx * vx + vy * vy);
        const s1 = Math.min(5, Math.max(0.1, hd.st0.s * k));
        k = s1 / hd.st0.s;
        const O = hd.an.O, f = (1 - k) / (S.model.xf.s * 100);
        S.charStyles[hd.i] = { ...(S.charStyles[hd.i] || {}), s: s1, dx: hd.st0.dx + (F[0] - O[0]) * f, dy: hd.st0.dy - (F[1] - O[1]) * f };
      }
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          el.charChips.dataset.sig = '';
          holdView();
          compute();
        });
      return;
    }
    if (drag) {
      const mx = (e.clientX - drag.x) / drag.a, my = (e.clientY - drag.y) / drag.a;
      for (const it of drag.items) S.charStyles[it.i] = { ...(S.charStyles[it.i] || {}), dx: it.dx + mmToEm(mx), dy: it.dy - mmToEm(my) };
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          el.charChips.dataset.sig = '';
          holdView();
          compute();
        });
      return;
    }
    if (!pan) return;
    const dx = (e.clientX - pan.x) / pan.a, dy = (e.clientY - pan.y) / pan.a;
    if (Math.hypot(dx, dy) * pan.a >= 3) pan.moved = true;
    if (!S.vb2 && Math.hypot(dx, dy) * pan.a < 3) return;
    S.vb2 = [pan.b[0] - dx, pan.b[1] - dy, pan.b[2], pan.b[3]];
    applyVb2();
  });
  const end = (e) => {
    if (box) {
      const b = box;
      box = null;
      const r = el.view2d.querySelector('svg rect.boxsel');
      if (r) r.remove();
      if (e && e.type === 'pointerup') {
        if (b.moved) boxSelect(b);
        else if (!b.add) S.mode === 'image' ? setSels([], []) : selectChar(null);
      }
      return;
    }
    if (mvDrag) {
      const m = mvDrag;
      mvDrag = null;
      if (e && e.type === 'pointerup' && m.moved && S.sels.length) {
        S.selPts = S.selPts.map((p) => [p[0] + m.d[0], p[1] + m.d[1]]);
        S.selPt = S.selPts[S.selPts.length - 1] || null;
        editOp('mv', { dx: m.d[0], dy: m.d[1] });
      } else {
        const g = el.view2d.querySelector('svg g.chui');
        if (g) g.removeAttribute('transform');
      }
      return;
    }
    if (cutDrag) {
      const c = cutDrag;
      cutDrag = null;
      const cg = el.view2d.querySelector('svg g.cutline');
      if (cg) cg.remove();
      const sh = (S.model && S.model.editShift) || [0, 0];
      if (e && e.type === 'pointerup' && Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]) > 0.3) {
        const whole = el.edScope.value === 'color';
        const q = S.sels.length === 1 ? S.sel : null;
        S.edits.push({ t: 'cut', w0: S.model.baseW || S.model.width, c: q ? q.c : null, i: q && !whole ? q.i : null, a: [c.a[0] + sh[0], c.a[1] + sh[1]], b: [c.b[0] + sh[0], c.b[1] + sh[1]], w: Math.min(5, Math.max(0.05, parseFloat(el.edCutW.value) || 0.3)) });
        S.editsKey = S.traceKey;
        clearSel();
        S.selPt = null;
        S.reselect = false;
        schedule(0);
      }
      return;
    }
    const was = pan;
    pan = null;
    if (was && !was.mid && !was.moved && e && e.type === 'pointerup' && S.mode === 'image' && S.model) pickAt(e);
    if (drag) drag.items.forEach((it) => setCharStyle(it.i, {})); // 0에 가까운 값 정리 + 저장
    if (hd) setCharStyle(hd.i, {});
    drag = null;
    hd = null;
    el.view2d.classList.remove('panning');
  };
  el.view2d.addEventListener('pointerup', end);
  el.view2d.addEventListener('pointercancel', end);
  el.view2d.addEventListener('dblclick', () => {
    S.vb2 = null;
    applyVb2();
  });
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
  camera.up.set(0, 0, 1); // Z가 위 (출력판 기준으로 돌아감)
  const controls = new OrbitControls(camera, renderer.domElement);
  const dims = new THREE.Group();
  scene.add(dims);
  const draw = () => {
    renderer.render(scene, camera);
    drawOverlay3d();
  };
  controls.addEventListener('change', () => {
    // 면 시점에서 돌리면 다시 원근 시점으로
    const t = G3;
    if (t && t.ortho && t.orthoDir) {
      const dir = t.camera.position.clone().sub(t.controls.target).normalize();
      if (dir.angleTo(t.orthoDir) > 0.01) leaveOrtho(t);
    }
    draw();
  });
  G3 = { renderer, scene, camera, group, controls, dims, draw };
  setupRingDrag(G3);
  setupCube(G3);

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
  G3.draw();
}

// ---------- 3D 뷰 큐브 · 치수 표시 ----------
const CUBE_FACES = [
  ['위', [0, 0, 1]],
  ['아래', [0, 0, -1]],
  ['앞', [0, -1, 0]],
  ['뒤', [0, 1, 0]],
  ['왼쪽', [-1, 0, 0]],
  ['오른쪽', [1, 0, 0]],
];
function setupCube(t) {
  try {
    const cr = new CSS3DRenderer();
    cr.setSize(84, 84);
    el.cube.appendChild(cr.domElement);
    const cs = new THREE.Scene();
    const cc = new THREE.OrthographicCamera(-42, 42, 42, -42, 1, 1000);
    for (const [name, n] of CUBE_FACES) {
      const d = document.createElement('div');
      d.className = 'face';
      d.dataset.ko = name;
      d.textContent = T(name);
      d.style.backfaceVisibility = 'hidden';
      const o = new CSS3DObject(d);
      const v = new THREE.Vector3(...n);
      o.position.copy(v).multiplyScalar(24);
      o.up.set(0, n[2] ? 1 : 0, n[2] ? 0 : 1);
      o.lookAt(v.clone().multiplyScalar(100));
      cs.add(o);
      d.addEventListener('click', () => viewFrom(v, true));
    }
    // 꼭지점 8개: 눌러서 모서리 방향(등각) 시점으로
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const d = document.createElement('div');
      d.className = 'vtx';
      d.title = T('꼭지점 시점');
      const o = new CSS3DSprite(d);
      const v = new THREE.Vector3(sx, sy, sz);
      o.position.copy(v).multiplyScalar(26);
      cs.add(o);
      d.addEventListener('click', () => viewFrom(v));
    }
    t.cube = { cr, cs, cc };
  } catch (e) {
    el.cube.classList.add('hide');
  }
}
function refreshCubeLabels() {
  el.cube.querySelectorAll('.face').forEach((d) => (d.textContent = T(d.dataset.ko)));
  el.cube.querySelectorAll('.vtx').forEach((d) => (d.title = T('꼭지점 시점')));
}
// 면 시점(앞·뒤·위·아래·좌·우)은 원근감 없이: 시야각을 아주 좁히고 그만큼 멀리서 봄 (보이는 크기는 그대로)
const ORTHO_FOV = 1;
const tanH = (deg) => Math.tan((deg * Math.PI) / 360);
function enterOrtho(t) {
  if (t.ortho) return;
  const cam = t.camera, d0 = cam.position.distanceTo(t.controls.target);
  t.ortho = { fov: cam.fov, near: cam.near, far: cam.far, d0 };
  const d = (d0 * tanH(cam.fov)) / tanH(ORTHO_FOV);
  const dir = cam.position.clone().sub(t.controls.target).normalize();
  cam.fov = ORTHO_FOV;
  cam.position.copy(t.controls.target).addScaledVector(dir, d);
  cam.near = Math.max(1, d - d0 * 4);
  cam.far = d + d0 * 4;
  cam.updateProjectionMatrix();
  t.orthoDir = dir.clone();
}
function leaveOrtho(t) {
  if (!t.ortho) return;
  const cam = t.camera, o = t.ortho;
  const d = cam.position.distanceTo(t.controls.target);
  const d1 = (d * tanH(ORTHO_FOV)) / tanH(o.fov);
  const dir = cam.position.clone().sub(t.controls.target).normalize();
  cam.fov = o.fov;
  cam.position.copy(t.controls.target).addScaledVector(dir, d1);
  cam.near = o.near;
  cam.far = o.far;
  cam.updateProjectionMatrix();
  t.ortho = null;
  t.orthoDir = null;
}
function viewFrom(n, ortho) {
  const t = G3;
  if (!t || t.failed) return;
  leaveOrtho(t);
  const dist = t.camera.position.distanceTo(t.controls.target);
  const v = n.clone().normalize();
  if (Math.abs(v.z) > 0.99) v.set(0, -0.003, Math.sign(v.z)).normalize();
  t.camera.position.copy(t.controls.target).addScaledVector(v, dist);
  t.camera.lookAt(t.controls.target);
  if (ortho) enterOrtho(t);
  t.controls.update();
  t.draw();
}
function drawOverlay3d() {
  const t = G3;
  if (!t || t.failed) return;
  if (t.cube) {
    const dir = t.camera.position.clone().sub(t.controls.target).normalize();
    t.cube.cc.position.copy(dir).multiplyScalar(200);
    t.cube.cc.up.copy(t.camera.up);
    t.cube.cc.lookAt(0, 0, 0);
    t.cube.cr.render(t.cube.cs, t.cube.cc);
  }
  const w = el.view3d.clientWidth, h = el.view3d.clientHeight;
  for (const L of S.dimLabels || []) {
    const v = L.p.clone().project(t.camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
    L.el.style.display = vis ? '' : 'none';
    if (vis) {
      L.el.style.left = ((v.x + 1) / 2) * w + 'px';
      L.el.style.top = ((1 - v.y) / 2) * h + 'px';
    }
  }
}
/** 도형 안쪽의 한 점 (가장 넓은 가로 구간의 가운데) */
function interiorPoint(shape) {
  const all = [shape.outer, ...shape.holes];
  let y0 = Infinity, y1 = -Infinity;
  for (const [, y] of shape.outer) {
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  let best = null;
  for (const f of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    const y = y0 + (y1 - y0) * f;
    const xs = [];
    for (const ring of all)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if ((a[1] - y) * (b[1] - y) < 0) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) if (!best || xs[i + 1] - xs[i] > best.w) best = { w: xs[i + 1] - xs[i], x: (xs[i] + xs[i + 1]) / 2, y };
  }
  return best ? [best.x, best.y] : shape.outer[0];
}
const inkFor = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? '#1c2230' : '#ffffff';
};
function buildDims3d(t, geos, bb, maxH, so) {
  for (const ch of [...t.dims.children]) {
    ch.geometry.dispose();
    t.dims.remove(ch);
  }
  el.dimLabels.innerHTML = '';
  S.dimLabels = [];
  if (!S.showDims || !geos.length) return;
  const [x0, y0, x1, y1] = bb;
  const off = Math.max(x1 - x0, y1 - y0) * 0.07;
  const pts = [];
  const seg = (a, b) => pts.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
  const label = (p, text, color, edit) => {
    const d = document.createElement('div');
    d.className = 'dl' + (color ? ' h' : '') + (edit ? ' edit' : '');
    d.textContent = text;
    if (edit) {
      d.title = T('눌러서 치수 바꾸기');
      d.addEventListener('click', () => {
        const r = d.getBoundingClientRect();
        openNumEditor(r.left + r.width / 2, r.top + r.height / 2, edit.v, edit.set);
      });
    }
    if (color) {
      d.style.background = color;
      d.style.color = inkFor(color);
      d.style.borderColor = inkFor(color) === '#ffffff' ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.35)';
    }
    el.dimLabels.appendChild(d);
    S.dimLabels.push({ p: new THREE.Vector3(...p), el: d });
  };
  const tk = off * 0.35;
  seg([x0, y0 - off, 0], [x1, y0 - off, 0]);
  seg([x0, y0 - off + tk, 0], [x0, y0 - off - tk, 0]);
  seg([x1, y0 - off + tk, 0], [x1, y0 - off - tk, 0]);
  const mw = S.model.width, mh = S.model.height;
  label([(x0 + x1) / 2, y0 - off * 1.8, 0], `${(x1 - x0).toFixed(1)} mm`, null, so.keycap && so.keycap.on ? null : { v: x1 - x0, set: (v) => setModelSize((mw + (v - (x1 - x0))) / mw) });
  seg([x0 - off, y0, 0], [x0 - off, y1, 0]);
  seg([x0 - off + tk, y0, 0], [x0 - off - tk, y0, 0]);
  seg([x0 - off + tk, y1, 0], [x0 - off - tk, y1, 0]);
  label([x0 - off * 1.8, (y0 + y1) / 2, 0], `${(y1 - y0).toFixed(1)} mm`, null, so.keycap && so.keycap.on ? null : { v: y1 - y0, set: (v) => setModelSize((mh + (v - (y1 - y0))) / mh) });
  seg([x1 + off, y1, 0], [x1 + off, y1, maxH]);
  seg([x1 + off - tk, y1, maxH], [x1 + off + tk, y1, maxH]);
  seg([x1 + off - tk, y1, 0], [x1 + off + tk, y1, 0]);
  label([x1 + off * 1.9, y1, maxH / 2], `${maxH.toFixed(1)} mm`, null, so.keycap && so.keycap.on ? null : {
    v: maxH,
    set: (v) => {
      el.thick.value = Math.max(0.2, Math.round(((parseFloat(el.thick.value) || 3) + v - maxH) * 100) / 100);
      on3dChange(false);
    },
  });
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const ln = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(S.prefs.dimColor), depthTest: false, transparent: true }));
  ln.renderOrder = 10;
  t.dims.add(ln);
  // 파트별 두께·높이 (색으로 구분)
  const baseTop = so.base.on ? Math.max(0.2, so.base.height || 1.5) : 0;
  const seen = new Set();
  for (const p of geos) {
    if (!p.shapes || !p.shapes.length) continue;
    const k = p.color + '|' + p.z0 + '|' + p.z1 + '|' + p.role;
    if (seen.has(k)) continue;
    seen.add(k);
    let big = p.shapes[0], ba = -1;
    for (const sh of p.shapes) {
      let a = 0;
      for (let i = 0, o = sh.outer; i < o.length; i++) a += o[i][0] * o[(i + 1) % o.length][1] - o[(i + 1) % o.length][0] * o[i][1];
      if (Math.abs(a) > ba) {
        ba = Math.abs(a);
        big = sh;
      }
    }
    const [px, py] = interiorPoint(big);
    const th = p.z1 - p.z0;
    let text, edit;
    const setNum = (e, v, lo) => {
      e.value = Math.max(lo, Math.round(v * 100) / 100);
      on3dChange(false);
    };
    // 색 파트 두께 → 그 색의 높이차로 맞춤
    const setColorH = (v) => {
      const L = S.model.layers[p.layer] || {};
      S.heightByColor.set(L.color, Math.round((v - so.thickness - (L.dz || 0)) * 100) / 100);
      el.colorHeights.dataset.sig = '';
      renderHeightChips();
      on3dChange(false);
    };
    if (p.role === 'kclegend') {
      const kc = so.keycap, flush = p.z0 < kc.h;
      text = flush ? `${T('깊이')} ${(kc.h - p.z0).toFixed(1)}` : `+${th.toFixed(1)}`;
      if (!flush) {
        const L = S.model.layers[p.layer] || {};
        edit = { v: th, set: (v) => (S.heightByColor.set(L.color, Math.round((v - kc.legendH - (L.dz || 0)) * 100) / 100), (el.colorHeights.dataset.sig = ''), renderHeightChips(), on3dChange(false)) };
      }
    }
    else if (p.role === 'base') (text = `${T('받침')} ${th.toFixed(1)}`), (edit = { v: th, set: (v) => setNum(el.baseH, v, 0.2) });
    else if (p.role === 'border') (text = `${T('턱')} +${th.toFixed(1)}`), (edit = { v: th, set: (v) => (el.borderFull.checked = false, syncBorderUi(), setNum(el.borderH, v, 0.2)) });
    else if (p.role === 'color' && so.textMode === 'engrave' && p.z0 === 0) {
      const dep = baseTop - p.z1;
      text = `${T('깊이')} ${dep.toFixed(1)}`;
      edit = { v: dep, set: setColorH };
    } else if (p.role === 'color') (text = p.z0 > 0 ? `+${th.toFixed(1)} (${p.z1.toFixed(1)})` : th.toFixed(1)), (edit = { v: th, set: setColorH });
    else (text = th.toFixed(1)), (edit = { v: th, set: (v) => setNum(el.thick, v, 0.2) });
    label([px, py, p.z1], text, p.role === 'color' || p.role === 'ring' ? p.color : null, edit);
  }
}

function render3dIfVisible() {
  if (S.view === 'sim') refreshSim();
  if (S.view === '3d') rebuild3d();
}

// ---------- 색상별 높이차 ----------
S.heightByColor = new Map(); // 색 → 높이차(mm). 같은 색은 다시 트레이싱해도 값 유지
function colorOffsets() {
  const m = S.model;
  if (!m) return [];
  return m.layers.map((l) => S.heightByColor.get(l.color) || 0);
}
function renderHeightChips() {
  const m = S.model;
  const box = el.colorHeights;
  const colors = m ? [...new Set(m.layers.map((l) => l.color))] : [];
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
function kcOpts() {
  const f = (e, d) => (isFinite(parseFloat(e.value)) ? parseFloat(e.value) : d);
  return { on: el.kcOn.checked, u: el.kcU.value, color: el.kcColor.value, h: f(el.kcH, 9), inset: f(el.kcInset, 2.8), wall: f(el.kcWall, 1.4), tol: f(el.kcTol, 0.1), stem: el.kcStem.value, mode: el.kcMode.value, depth: f(el.kcDepth, 0.5), legendH: f(el.kcDepth, 0.5), edgeType: el.kcEdge.value, edgeSize: f(el.kcEdgeSize, 0.8) };
}
/** 키캡 윗면 크기 안내 · 글자가 윗면보다 크면 경고 */
function updateKcInfo() {
  const k = kcOpts();
  el.kcOpts.classList.toggle('hide', !k.on);
  if (!k.on) return;
  const D = keycapDims(k);
  const fw = D.topW - 2 * D.bs, fd = D.topD - 2 * D.bs;
  const over = (S.model && S.model.width > fw - 0.8) || (S.model && S.model.height > fd - 0.8);
  el.kcInfo.innerHTML = `${T('몸체 {w} × {d} mm · 윗면 {tw} × {td} mm', { w: D.bw.toFixed(1), d: D.bd.toFixed(1), tw: fw.toFixed(1), td: fd.toFixed(1) })}` + (over ? `<br><b style="color:#c2410c">${T('글자가 윗면보다 커서 잘립니다. 너비(mm)를 줄이세요.')}</b>` : '');
}
function solidOpts() {
  const nv = (e, d, lo = 0) => Math.max(lo, parseFloat(e.value) || d);
  return {
    thickness: nv(el.thick, 3, 0.2),
    offsets: colorOffsets(),
    base: {
      on: el.baseOn.checked, shape: el.baseShape.value, margin: Math.max(0, parseFloat(el.baseMargin.value) || 0), height: nv(el.baseH, 1.5, 0.2), color: el.baseColor.value,
      fill: Math.max(0, parseFloat(el.baseFill.value) || 0), cutHoles: el.textMode.value === 'emboss_cut', stretch: el.baseStretch.checked,
      custom: S.baseCustom ? S.baseCustom.polys : null, customKey: S.baseCustom ? S.baseCustom.key : '',
    },
    textMode: el.textMode.value === 'emboss_cut' ? 'emboss' : el.textMode.value,
    border: { on: el.baseOn.checked && el.borderOn.checked, width: nv(el.borderW, 1.2, 0.4), height: nv(el.borderH, 1, 0.2), full: el.borderFull.checked },
    wall: { on: el.wallOn.checked, width: nv(el.wallW, 1.2, 0.4), height: nv(el.wallH, 2, 0.2), gap: Math.max(0, parseFloat(el.wallGap.value) || 0), color: el.wallColor.value },
    ring: { on: el.ringOn.checked, list: (ringFromInputs(), S.rings.map((r) => ({ ...r }))) },
    edge: { type: el.edgeType.value, size: nv(el.edgeSize, 0.6, 0.1), onColor: el.edgeColor.checked, onBase: el.edgeBase.checked },
    keycap: kcOpts(),
    mold: {
      on: el.mdOn.checked && el.mpOn.checked,
      out: el.mdOut.value,
      depth: nv(el.mdDepth, 4, 0.4), floor: nv(el.mdFloor, 2, 0.6),
      draft: Math.max(0, parseFloat(el.mdDraft.value) || 0), clearance: Math.max(0, parseFloat(el.mdClear.value) || 0),
      flange: nv(el.mdFlange, 5, 1), ribH: Math.max(0, parseFloat(el.mdRibH.value) || 0),
      color: el.mdColor.value,
      kind: el.mdKind.value,
      domeH: nv(el.mdDome, 10, 0.5), domeAuto: !el.mdDome.dataset.set, gap: nv(el.mdGap, 3.4, 0.2), pinD: Math.max(0, parseFloat(el.mdPin.value) || 0),
      rim: Math.max(0, parseFloat(el.mdRim.value) || 0), wall: nv(el.mpWall, 2, 0.4),
      pair: el.mdPair.value,
      sil: S.silModel,
      pattern: { pattern: el.mpKind.value, width: nv(el.mpW, 1.2, 0.2), pitch: nv(el.mpPitch, 5, 0.5), angle: parseFloat(el.mpAngle.value) || 0, spokes: parseInt(el.mpSpokes.value, 10) || 12 },
    },
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
    buildDims3d(t, [], null, 0, {});
    el.badge3d.textContent = '';
    resize3d();
    return;
  }
  const so = solidOpts();
  if (S.dragging) so.edge = { type: 'none' }; // 끄는 동안은 빠르게
  const geos = buildPartGeometries(m, so);
  S.ringInfos = (geos.info && geos.info.rings) || [];
  S.ringInfo = S.ringInfos[S.ringSel] || null;
  let maxH = 0;
  for (const g of geos) {
    maxH = Math.max(maxH, g.z1);
    t.group.add(new THREE.Mesh(g.geometry, new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.55, metalness: 0.05 })));
  }
  const inf = geos.info || {};
  const bb = inf.bbox || [0, 0, m.width, m.height];
  for (const g of geos) maxH = Math.max(maxH, g.z1);
  buildDims3d(t, geos, bb, maxH, so);
  el.badge3d.textContent = inf.size ? `${inf.size[0].toFixed(1)} × ${inf.size[1].toFixed(1)} × ${inf.size[2].toFixed(1)} mm · ${T('파트 {n}개', { n: geos.length })}` : '';
  if (el.mdInfo) {
    const mi = inf.mold;
    const W = { cavityOutOfPlate: '캐비티가 판 밖으로 나갑니다. 판 폭을 늘리거나 구배·깊이를 줄이세요.', cavityTooBig: '캐비티가 판을 덮었습니다. 판 폭을 늘리세요.', noRib: '무늬가 캐비티 안에 들어가지 않았습니다. 무늬 높이를 0으로 두거나 간격을 좁히세요.', empty: '틀을 만들 도형이 없습니다.', rimTooWide: '붙임 테두리가 너무 넓어 돔이 들어갈 자리가 없습니다. 테두리를 줄이세요.', rimClamped: '도형이 작아 붙임 테두리를 줄였습니다. 너비를 키우면 테두리를 넓게 쓸 수 있어요.', rimOverPattern: '붙임 테두리가 무늬 벽보다 넓습니다. 테두리에 구멍이 생겨 붙이기 어려우니 벽 폭을 키우거나 테두리를 줄이세요.', tooHigh: '돔이 너무 높아 누를 때 무늬가 찢어질 수 있습니다. 돔 높이를 줄이세요.' };
    if (!mi) el.mdInfo.textContent = '';
    else if (mi.warn) {
      el.mdInfo.textContent = T(W[mi.warn] || mi.warn) + (mi.stretch != null ? T(' (늘어남 {s}%)', { s: (mi.stretch * 100).toFixed(0) }) : '');
      el.mdInfo.style.color = '#c92a2a';
    } else if (mi.domeH != null) {
      if (mi.domeAuto && Math.abs(parseFloat(el.mdDome.value) - mi.domeH) > 0.01) el.mdDome.value = mi.domeH.toFixed(1);
      el.mdInfo.textContent = T('틀 {w} × {d} mm · 돔 {h}mm · 간격 {g}mm · 테두리 {r}mm · 늘어남 {s}%', {
        w: mi.size[0].toFixed(1), d: mi.size[1].toFixed(1), h: mi.domeH, g: mi.gap, r: mi.rim, s: (mi.stretch * 100).toFixed(0),
      });
      el.mdInfo.style.color = '';
    } else {
      el.mdInfo.textContent = T('몰드 {w} × {d} × {h} mm · 구배 {a}° · 여유 {c}mm', {
        w: mi.size[0].toFixed(1), d: mi.size[1].toFixed(1), h: mi.size[2].toFixed(1), a: mi.draft, c: mi.clearance,
      });
      el.mdInfo.style.color = '';
    }
  }
  const badRing = (inf.rings || []).find((r) => !r.attached);
  if (badRing) el.badge3d.textContent += ' · ' + T(badRing.type === 'hole' ? '⚠ 구멍이 가장자리에 걸림' : '⚠ 고리가 몸체에서 떨어져 있음');
  else if (inf.rings && inf.rings.length) el.badge3d.textContent += ' · ' + T('고리는 끌어서 옮길 수 있음');
  if (inf.loose) el.badge3d.textContent += ' · ' + T('⚠ 떨어져 나가는 조각 {n}개 (o·e 안쪽 등)', { n: inf.loose });
  // 모서리 다듬기: 실제로 깎을 수 있는 최대치에서 입력값도 멈춤
  if (inf.bevelMax != null && so.edge.type !== 'none') {
    const lim = Math.max(0.1, Math.floor(inf.bevelMax * 10 + 1e-6) / 10);
    el.edgeSize.max = lim;
    el.edgeSize.title = T('크기 (mm) · 최대 {m}', { m: lim.toFixed(1) });
    if ((parseFloat(el.edgeSize.value) || 0) > lim) el.edgeSize.value = lim.toFixed(1);
  }
  if (inf.depthClamped) el.badge3d.textContent += ' · ' + T('새김 깊이를 받침 두께에 맞춰 줄임');
  const size = Math.max(bb[2] - bb[0], bb[3] - bb[1], maxH);
  // 카메라 거리 기준: 화면이 가로로 넓으므로 가로로 긴 텍스트는 그만큼 가깝게 (한 글자와 긴 글이 비슷한 크기로 보이게)
  const A3 = Math.max(0.5, (el.view3d.clientWidth || 800) / (el.view3d.clientHeight || 500));
  const fitSize = S.mode === 'text' ? Math.max(bb[3] - bb[1], (bb[2] - bb[0]) / (A3 * 1.05), maxH) : size;
  const c = new THREE.Vector3((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, maxH / 2);
  const wasOrtho = !!t.ortho && !(S.dirty3d || !S.frameSize);
  if (t.ortho) leaveOrtho(t);
  if (S.dirty3d || !S.frameSize) t.controls.target.copy(c);
  else if (!S.dragging && !S.keepView && (fitSize > S.frameSize * 1.12 || fitSize < S.frameSize / 1.25)) {
    // 크기가 크게 바뀌면(받침 모양 변경 등) 보던 각도는 그대로 두고 거리만 비례해 맞춤
    const k = fitSize / S.frameSize;
    const off = t.camera.position.clone().sub(t.controls.target).multiplyScalar(k);
    t.controls.target.copy(c);
    t.camera.position.copy(c).add(off);
    S.frameSize = fitSize;
    t.camera.near = size / 100;
    t.camera.far = size * 50;
    t.camera.updateProjectionMatrix();
    t.controls.update();
  }
  if (S.dirty3d || !S.frameSize) {
    S.frameSize = fitSize;
    t.camera.position.set(c.x, c.y - fitSize * 1.85, c.z + fitSize * 2.2);
    t.camera.near = size / 100;
    t.camera.far = size * 50;
    t.camera.updateProjectionMatrix();
    t.controls.update();
  }
  S.dirty3d = false;
  if (wasOrtho) {
    t.camera.lookAt(t.controls.target);
    enterOrtho(t);
    t.controls.update();
  }
  resize3d();
}

function setView(v) {
  S.view = v;
  el.tab2d.classList.toggle('on', v === '2d');
  el.tab3d.classList.toggle('on', v === '3d');
  el.tabSim.classList.toggle('on', v === 'sim');
  el.tabPress.classList.toggle('on', v === 'press');
  el.view2d.classList.toggle('hide', v !== '2d');
  el.view3d.classList.toggle('hide', v !== '3d');
  el.viewSim.classList.toggle('hide', v !== 'sim');
  el.viewPress.classList.toggle('hide', v !== 'press');
  if (v === 'sim') requestAnimationFrame(refreshSim);
  else if (SIM) SIM.stop();
  if (v === 'press') requestAnimationFrame(refreshPress);
  else pressStop();
  el.modeView2d.classList.toggle('hide', v !== '2d');
  if (v === '3d') requestAnimationFrame(rebuild3d);
  updateEditBar();
}

// ---------- UI 연결 ----------
function setMode(m, silent) {
  if (S.mode !== m) (S.vb2 = null), (S.dirty3d = true);
  S.mode = m;
  if (m !== 'image') clearSel(), setCut(false);
  updateEditBar();
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
  el.keepRow.classList.toggle('hide', one);
  el.keepInner.disabled = !el.removeBg.checked;
}

el.modeImage.onclick = () => setMode('image');
el.modeText.onclick = () => setMode('text');
el.tab2d.onclick = () => setView('2d');
el.tab3d.onclick = () => setView('3d');
el.tabSim.onclick = () => setView('sim');
el.tabPress.onclick = () => setView('press');
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
// ---------- 목적별 시작 프리셋 ----------
const PRESETS = {
  keyring: { base: true, border: true, ring: true, view3d: true, rec: ['btn3mf', 'btnStl'], hint: '받침판·테두리·고리를 켰습니다. 위쪽 저장에서 노란 테두리 버튼(3MF는 색 나눔, STL은 한 덩어리)을 누르세요.' },
  print3d: { base: false, border: false, ring: false, view3d: true, rec: ['btn3mf', 'btnStl'], hint: '받침판 없이 도형만 만듭니다. 노란 테두리 버튼(3MF 또는 STL)으로 저장하세요.' },
  laser: { base: false, border: false, ring: false, view3d: false, rec: ['btnLaser', 'btnDxf'], hint: '레이저 가공 모드: 윤곽선만 저장합니다. 색마다 절단·새김을 정하고 ▶ 작업 미리보기로 순서와 시간을 확인하세요. (RDWorks는 DXF · 레이저, LightBurn은 둘 다)' },
  mold: { base: false, border: false, ring: false, mp: true, view3d: true, rec: ['btn3mf', 'btnStl'], hint: '몰드·패턴 모드입니다. 그림의 바깥 둘레만 벽으로 남기고 안쪽을 무늬로 채웁니다. 선 폭은 0.8mm 이상이어야 출력됩니다. 성형 틀은 암틀을 좌우로 뒤집어 덮습니다(굵은 핀 쪽이 맞물리는 방향). 같은 것을 두 장 만들어 평평한 테두리끼리 붙이면 입체가 됩니다.' },
  keycap: { base: false, border: false, ring: false, kc: true, view3d: true, rec: ['btn3mf', 'btnStl'], hint: '키캡(MX) 모드입니다. 글자·그림이 윗면에 올라갑니다. 3D 출력의 키캡 항목에서 크기·글자 방식을 바꾸세요. 스템 공차는 시험 출력으로 맞추세요.' },
};
function applyModeUi() {
  const m = el.preset.value || 'free';
  document.body.dataset.mode = m;
  if (m === 'laser' && S.view === '3d') setView('2d');
  if (m !== 'laser' && S.view === 'sim') setView('2d');
  if (S.view === 'press' && !(m === 'mold' && el.mdKind.value === 'press')) setView('2d');
}
function showPresetRec() {
  applyModeUi();
  const pr = PRESETS[el.preset.value];
  for (const id of ['btnFill', 'btnLaser', 'btnDxf', 'btnStl', 'btn3mf']) el[id].classList.toggle('rec', !!pr && pr.rec.includes(id));
}
el.preset.addEventListener('change', () => {
  const pr = PRESETS[el.preset.value];
  showPresetRec();
  // 패턴은 몰드 모드에서만 자동으로 켜고, 다른 모드로 가면 끈다 (자유 모드에서는 쓰던 대로 둠)
  if (pr || el.mpOn.checked) {
    const want = !!(pr && pr.mp);
    if (pr && el.mpOn.checked !== want) {
      el.mpOn.checked = want;
      el.mpOn.dispatchEvent(new Event('change'));
    }
  }
  if (!pr) return;
  S.flash = T(pr.hint);
  if (pr.mp && !S.img && S.mode === 'image') { // 몰드 모드인데 그림이 없으면 샘플로 시작
    const sp = SAMPLES[0];
    loadSample(sp);
    S.flash = T('{n} 샘플로 시작합니다. 위쪽 샘플 줄에서 다른 도형을 고르거나 내 그림을 열 수 있어요.', { n: sp.name });
  }
  el.kcOn.checked = !!pr.kc;
  if (pr.kc) {
    el.kcOn.dispatchEvent(new Event('change'));
  }
  el.baseOn.checked = pr.base;
  if (pr.base) {
    el.baseShape.value = 'outline';
    el.borderOn.checked = pr.border;
    el.borderFull.checked = true;
  } else el.borderOn.checked = false;
  el.ringOn.checked = pr.ring;
  if (pr.ring) {
    el.ringType.value = 'tab';
    el.ringPos.value = 'top';
  }
  on3dChange(pr.view3d);
  schedule(0);
});
const syncLabels = () => (rangeLabels.forEach((f) => f()), syncBorderUi(), showPresetRec());
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
[el.invert, el.removeBg, el.keepInner, el.res, el.align, el.axisSnap, el.optArcs, el.optParallel, el.optWidth, el.optAlign, el.optSym, el.upscale, el.denoise, el.engine].forEach((c) => c.addEventListener('change', () => schedule(0)));
el.text.addEventListener('input', () => schedule(250));
el.fontSel.addEventListener('change', () => schedule(0));
el.width.addEventListener('input', () => schedule(200));
el.tol.addEventListener('change', () => schedule(0));
/** '모두 채움'이면 폭·높이 칸은 자동이라 잠금 */
function syncBorderUi() {
  el.borderW.disabled = el.borderH.disabled = el.borderFull.checked;
  if (!el.baseOn.checked) el.ringOn.checked = false;
  el.ringOn.disabled = el.ringAdd.disabled = el.ringDel.disabled = !el.baseOn.checked;
}
// 3D 설정: 바꾸면 3D 미리보기로 보여줌
function on3dChange(showView) {
  const kcOn = el.kcOn.checked;
  document.body.classList.toggle('kc-on', kcOn);
  if (kcOn) (el.baseOn.checked = false), (el.ringOn.checked = false);
  el.baseOn.disabled = kcOn;
  el.edgeType.disabled = el.edgeSize.disabled = kcOn; // 키캡은 아래 키캡 항목의 '윗면 모서리'를 씀
  el.kcEdgeSize.classList.toggle('hide', el.kcEdge.value === 'none');
  const kk = kcOpts();
  const kcKey = kk.on + '|' + kk.u + '|' + kk.h;
  if (S.kcKey !== kcKey) (S.kcKey = kcKey), (S.dirty3d = true); // 키캡 크기가 바뀌면 화면을 다시 맞춤
  updateKcInfo();
  // 키링 고리는 받침판이 있을 때만
  if (!el.baseOn.checked) el.ringOn.checked = false;
  el.ringOn.disabled = el.ringAdd.disabled = el.ringDel.disabled = !el.baseOn.checked;
  el.baseOpts.classList.toggle('hide', !el.baseOn.checked);
  el.borderOpts.classList.toggle('hide', !el.borderOn.checked);
  el.wallOpts.classList.toggle('hide', !el.wallOn.checked);
  syncBorderUi();
  const sh = el.baseShape.value;
  const poly = !['outline', 'rect', 'square', 'circle', 'ellipse', 'custom'].includes(sh);
  el.baseFillRow.classList.toggle('hide', !(sh === 'outline' || sh === 'custom' || poly));
  el.baseFillLbl.classList.toggle('hide', sh !== 'outline');
  el.baseFill.classList.toggle('hide', sh !== 'outline');
  el.baseImgBtn.classList.toggle('hide', sh !== 'custom');
  el.baseStretchLbl.classList.toggle('hide', !(poly || sh === 'custom'));
  el.baseImgBtn.textContent = S.baseCustom ? '🖼 ' + S.baseCustom.name.slice(0, 14) : T('모양 이미지…');
  el.ringOpts.classList.toggle('hide', !el.ringOn.checked);
  el.edgeOpts.classList.toggle('hide', el.edgeType.value === 'none');
  if (showView && S.view !== '3d' && S.model && el.preset.value !== 'laser') {
    setView('3d');
    pushHist();
    return;
  }
  render3dIfVisible();
  autosave();
  pushHist();
}
[el.thick, el.baseMargin, el.baseH, el.baseFill, el.edgeSize, el.ringDx, el.ringDy, el.borderW, el.borderH, el.wallW, el.wallH, el.wallGap, el.wallColor, el.ringOuter, el.ringHole].forEach((e) => e.addEventListener('input', () => on3dChange(false)));
[el.baseOn, el.baseShape, el.baseColor, el.baseStretch, el.textMode, el.ringType, el.edgeType, el.edgeColor, el.edgeBase, el.borderOn, el.borderFull, el.wallOn, el.ringOn, el.ringPos, el.kcOn, el.kcU, el.kcMode, el.kcEdge, el.kcStem].forEach((e) => e.addEventListener('change', () => on3dChange(true)));
[el.kcColor, el.kcH, el.kcInset, el.kcWall, el.kcTol, el.kcDepth, el.kcEdgeSize].forEach((e) => e.addEventListener('input', () => on3dChange(false)));
// ---------- 샘플 도형 ----------
/** 샘플 하나를 SVG 파일처럼 불러온다 */
function loadSample(sp) {
  const svg = sampleSvg(sp);
  return loadFile(new File([svg], `${sp.name}.svg`, { type: 'image/svg+xml' }));
}
function buildSampleChips() {
  for (const sp of SAMPLES) {
    const b = document.createElement('button');
    b.className = 'samp';
    b.type = 'button';
    b.title = T('{n} 샘플로 시작', { n: sp.name });
    b.innerHTML = `<svg viewBox="0 0 ${sp.w} ${sp.h}" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${sp.d}"/></svg><span>${sp.name}</span>`;
    b.addEventListener('click', () => {
      if (S.mode !== 'image') el.modeImage.click();
      loadSample(sp);
    });
    el.sampleRow.appendChild(b);
  }
}
buildSampleChips();

// ---------- 성형 미리보기 ----------
const PV = { t: 0, play: false, raf: 0, prof: null, last: 0 };
function pressStop() {
  PV.play = false;
  if (PV.raf) cancelAnimationFrame(PV.raf), (PV.raf = 0);
  if (el.pressPlay) el.pressPlay.textContent = T('▶ 재생');
}
function pressSizeCanvas() {
  const r = el.viewPress.getBoundingClientRect();
  const d = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(300, r.width), h = Math.max(220, r.height - 42);
  if (el.pressCv.width !== Math.round(w * d) || el.pressCv.height !== Math.round(h * d)) {
    el.pressCv.width = Math.round(w * d);
    el.pressCv.height = Math.round(h * d);
    el.pressCv.style.width = w + 'px';
    el.pressCv.style.height = h + 'px';
  }
}
function pressDraw() {
  if (!PV.prof) return;
  pressSizeCanvas();
  drawPress(el.pressCv, PV.prof, PV.t);
  const i = stageAt(PV.t);
  el.pressStage.textContent = STAGES[i].name;
  el.pressPos.value = Math.round(PV.t * 1000);
}
function pressTick(now) {
  if (!PV.play) return;
  const dt = Math.min(0.05, (now - PV.last) / 1000);
  PV.last = now;
  PV.t += dt / 9; // 전체 9초
  if (PV.t >= 1) (PV.t = 1), pressStop();
  pressDraw();
  if (PV.play) PV.raf = requestAnimationFrame(pressTick);
}
/** 모델·설정이 바뀌면 단면을 다시 계산 */
function refreshPress() {
  const m = S.silModel || S.model;
  if (!m || !m.layers || !m.layers.length) {
    PV.prof = null;
    el.pressInfo.textContent = T('그림을 먼저 불러오세요.');
    pressSizeCanvas();
    el.pressCv.getContext('2d').clearRect(0, 0, el.pressCv.width, el.pressCv.height);
    return;
  }
  const so = solidOpts();
  PV.prof = pressProfile(m, { ...so.mold, thick: so.thickness });
  if (!PV.prof) {
    el.pressInfo.textContent = T('단면을 만들 수 없습니다. 테두리를 줄이거나 너비를 키우세요.');
    return;
  }
  const p = PV.prof;
  el.pressInfo.textContent = T('돔 {h}mm · 간격 {g}mm · 테두리 {r}mm · 본체 두께 {t}mm · 늘어남 {s}%', {
    h: p.domeH, g: p.gap, r: p.rim, t: p.thick, s: (p.stretch * 100).toFixed(0),
  });
  pressDraw();
}
el.pressPlay.onclick = () => {
  if (PV.play) return pressStop();
  if (PV.t >= 0.999) PV.t = 0;
  PV.play = true;
  el.pressPlay.textContent = T('⏸ 멈춤');
  PV.last = performance.now();
  PV.raf = requestAnimationFrame(pressTick);
};
el.pressRst.onclick = () => (pressStop(), (PV.t = 0), pressDraw());
el.pressPos.addEventListener('input', () => (pressStop(), (PV.t = parseInt(el.pressPos.value, 10) / 1000), pressDraw()));
window.addEventListener('resize', () => S.view === 'press' && pressDraw());

// ---------- 몰드 · 패턴 ----------
function updateMpUi() {
  el.mpOpts.classList.toggle('hide', !el.mpOn.checked);
  const k = el.mpKind.value;
  el.mpSpokesRow.style.display = k === 'web' || k === 'spokes' || k === 'rings' ? '' : 'none';
  el.mpAngle.parentElement.style.opacity = k === 'rings' ? 0.5 : 1;
}
[el.mpOn, el.mpKind, el.mpColor].forEach((e) => e.addEventListener('change', () => (updateMpUi(), schedule(0))));
[el.mpW, el.mpPitch, el.mpWall, el.mpAngle, el.mpSpokes].forEach((e) => e.addEventListener('input', () => schedule()));
function updateMdUi() {
  el.mdOpts.classList.toggle('hide', !el.mdOn.checked);
  const press = el.mdKind.value === 'press';
  document.body.classList.toggle('mold-press', press);
  document.body.classList.toggle('mold-cast', !press);
  // 기본값 따라가기 (직접 건드린 적 없을 때만): 간격 = 본체 두께 + 0.4, 테두리 = 무늬 벽 폭
  if (press && !el.mdGap.dataset.set) {
    const t = parseFloat(el.thick.value) || 3;
    el.mdGap.value = (Math.round((t + 0.4) * 10) / 10).toFixed(1);
  }
  if (press && !el.mdRim.dataset.set) {
    const w = parseFloat(el.mpWall.value) || 2;
    el.mdRim.value = (Math.round(w * 2) / 2).toFixed(1);
  }
  // 돔 높이 기본값은 도형 크기에 맞춰 (늘어남 5% 안팎이 되는 정도)
  if (press && !el.mdDome.dataset.set && S.model && S.model.width) {
    const r = Math.min(S.model.width, S.model.height) / 2;
    el.mdDome.value = Math.max(1, Math.round(r * 0.3 * 2) / 2).toFixed(1);
  }
}
el.mdGap.addEventListener('input', () => (el.mdGap.dataset.set = '1'));
el.mdRim.addEventListener('input', () => (el.mdRim.dataset.set = '1'));
el.mdDome.addEventListener('input', () => (el.mdDome.dataset.set = '1'));
el.mpWall.addEventListener('input', () => updateMdUi());
[el.mdOn, el.mdKind, el.mdOut, el.mdPair, el.mdColor].forEach((e) => e.addEventListener('change', () => (updateMdUi(), on3dChange(true), S.view === 'press' && refreshPress())));
[el.mdDepth, el.mdFloor, el.mdDraft, el.mdClear, el.mdFlange, el.mdRibH, el.mdDome, el.mdGap, el.mdPin, el.mdRim].forEach((e) => e.addEventListener('input', () => (on3dChange(false), S.view === 'press' && refreshPress())));
el.thick.addEventListener('input', () => updateMdUi());
updateMpUi();
updateMdUi();
el.kcOn.addEventListener('change', () => {
  if (!el.kcOn.checked) return;
  const D = keycapDims(kcOpts());
  const w = parseFloat(el.width.value) || 50;
  if (w > D.topW - 0.8) {
    el.width.value = Math.max(3, Math.floor((D.topW * 0.75) * 2) / 2);
    S.flash = T('글자 너비를 키캡 윗면에 맞게 줄였습니다. 필요하면 너비(mm)를 바꾸세요.');
    schedule(0);
  }
});

el.stepAuto.onclick = () => setAllOffsets((i) => i * 0.4);
el.stepZero.onclick = () => setAllOffsets(() => 0);

// 새김: 두께가 곧 파는 깊이 → 받침판이 얇으면 알맞게 맞춰 줌
el.textMode.addEventListener('change', () => {
  if (el.textMode.value !== 'engrave') return;
  const bh = parseFloat(el.baseH.value) || 1.5;
  if (bh < 2.5) el.baseH.value = 3;
  if ((parseFloat(el.thick.value) || 3) > (parseFloat(el.baseH.value) || 3) - 0.8) el.thick.value = 1;
}, true);
// 받침판 모양: 내 이미지(SVG·PNG)의 외곽
el.baseShape.addEventListener('change', () => {
  if (el.baseShape.value === 'custom' && !S.baseCustom) el.baseImgFile.click();
  if (needPlate() !== !!(S.model && S.model.plate)) schedule(0);
});
el.baseOn.addEventListener('change', () => {
  if (needPlate() !== !!(S.model && S.model.plate)) schedule(0);
});
const needPlate = () => S.mode === 'image' && el.baseOn.checked && el.baseShape.value === 'imgsil';
/** 불러온 이미지의 실루엣(투명하지 않은 곳, 없으면 가장자리 배경색이 아닌 곳) → 받침판 모양용 링 */
function silhouetteRings(imgd) {
  const { width: w, height: h, data: d } = imgd;
  const N = w * h;
  let transparent = false;
  for (let i = 3; i < d.length; i += 16) if (d[i] < 250) {
    transparent = true;
    break;
  }
  const bg = new Uint8Array(N);
  if (transparent) for (let i = 0; i < N; i++) bg[i] = d[i * 4 + 3] < 128 ? 1 : 0;
  else {
    // 네 모서리 평균색과 비슷하고 가장자리에서 이어진 곳만 배경 (그림 안쪽 흰 부분은 살림)
    const cs = [0, w - 1, (h - 1) * w, h * w - 1];
    const ref = [0, 1, 2].map((c) => cs.reduce((a, i) => a + d[i * 4 + c], 0) / 4);
    const near = (i) => Math.abs(d[i * 4] - ref[0]) + Math.abs(d[i * 4 + 1] - ref[1]) + Math.abs(d[i * 4 + 2] - ref[2]) < 60;
    const st = [];
    const push = (i) => {
      if (!bg[i] && near(i)) {
        bg[i] = 1;
        st.push(i);
      }
    };
    for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
    for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
    while (st.length) {
      const i = st.pop(), x = i % w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (i >= w) push(i - w);
      if (i < N - w) push(i + w);
    }
  }
  const md = new ImageData(w, h);
  for (let i = 0; i < N; i++) {
    const v = bg[i] ? 255 : 0;
    md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = v;
    md.data[i * 4 + 3] = 255;
  }
  const L = traceImage(md, {
    colors: 1, threshold: 128, invert: false, removeBg: false, tol: 0.6, minArea: 60, cornerAngle: 40, blur: 1,
    lineTol: 1, snapDeg: 3, arcs: true, parallel: false, equalWidth: false, align: false, symmetry: false, denoise: false,
  });
  return L.length ? L[0].rings : [];
}
el.baseImgBtn.onclick = () => el.baseImgFile.click();
el.baseImgFile.onchange = () => {
  const f = el.baseImgFile.files[0];
  el.baseImgFile.value = '';
  if (f) loadBaseShape(f);
};
async function loadBaseShape(file) {
  try {
    const img = await decodeImage(file);
    const up = S.upInfo;
    const imgd = await rasterize(img, 600, true);
    S.upInfo = up;
    const layers = traceImage(imgd, {
      colors: 1, threshold: otsuThreshold(imgd), invert: false, removeBg: true, tol: 0.6, minArea: 40, cornerAngle: 40, blur: 1,
      lineTol: 1, snapDeg: 3, arcs: true, parallel: false, equalWidth: false, align: false, symmetry: false, denoise: false,
    });
    const mm = makeModel(layers, 100, 0.05);
    const polys = mm.layers.flatMap((l) => l.items.map((it) => it.poly.map(([x, y]) => [+x.toFixed(3), +(-y).toFixed(3)])));
    if (!polys.length) throw new Error('empty');
    S.baseCustom = { name: file.name, polys, key: Date.now().toString(36) };
    el.baseShape.value = 'custom';
    el.baseOn.checked = true;
    on3dChange(true);
  } catch (e) {
    console.error(e);
    setMsg([T('모양 이미지를 읽지 못했습니다. 배경이 밝고 모양이 진한 SVG·PNG를 써 주세요.')]);
    if (!S.baseCustom) el.baseShape.value = 'outline';
    on3dChange(false);
  }
}

// ---------- 키링 고리·구멍 여러 개 ----------
const RING_DEF = { type: 'tab', pos: 'top', outer: 8, hole: 4, dx: 0, dy: 0 };
S.rings = [{ ...RING_DEF }];
S.ringSel = 0;
function ringFromInputs() {
  const r = S.rings[S.ringSel];
  if (!r) return;
  const nv = (e, d, lo) => Math.max(lo, parseFloat(e.value) || d);
  Object.assign(r, { type: el.ringType.value, pos: el.ringPos.value, outer: nv(el.ringOuter, 8, 3), hole: nv(el.ringHole, 4, 1), dx: parseFloat(el.ringDx.value) || 0, dy: parseFloat(el.ringDy.value) || 0 });
}
function ringToInputs() {
  S.ringSel = Math.min(Math.max(0, S.ringSel), S.rings.length - 1);
  const r = S.rings[S.ringSel];
  el.ringType.value = r.type;
  el.ringPos.value = r.pos;
  el.ringOuter.value = r.outer;
  el.ringHole.value = r.hole;
  el.ringDx.value = r.dx;
  el.ringDy.value = r.dy;
  renderRingSel();
}
function renderRingSel() {
  el.ringSel.innerHTML = '';
  S.rings.forEach((r, i) => el.ringSel.add(new Option(`${i + 1}·${T(r.type === "hole" ? "구멍" : "고리")}`, String(i))));
  el.ringSel.value = String(S.ringSel);
  el.ringDel.disabled = S.rings.length <= 1;
}
el.ringSel.onchange = () => {
  ringFromInputs();
  S.ringSel = parseInt(el.ringSel.value, 10) || 0;
  ringToInputs();
};
el.ringAdd.onclick = () => {
  ringFromInputs();
  const used = new Set(S.rings.map((r) => r.pos));
  const pos = ['top', 'bottom', 'left', 'right', 'topleft', 'topright', 'bottomleft', 'bottomright'].find((p) => !used.has(p)) || 'top';
  S.rings.push({ ...RING_DEF, type: el.ringType.value, pos, outer: parseFloat(el.ringOuter.value) || 8, hole: parseFloat(el.ringHole.value) || 4 });
  S.ringSel = S.rings.length - 1;
  el.ringOn.checked = true;
  ringToInputs();
  on3dChange(true);
};
el.ringDel.onclick = () => {
  if (S.rings.length <= 1) return;
  S.rings.splice(S.ringSel, 1);
  S.ringSel = Math.max(0, S.ringSel - 1);
  ringToInputs();
  on3dChange(true);
};
// 종류·위치를 바꾸면 이동값 초기화
el.ringType.addEventListener('change', () => {
  el.ringDx.value = 0;
  el.ringDy.value = 0;
  if (!el.ringOn.checked) el.ringOn.checked = true;
  ringFromInputs();
  renderRingSel();
}, true);
el.ringPos.addEventListener('change', () => {
  el.ringDx.value = 0;
  el.ringDy.value = 0;
}, true);
el.ringReset.onclick = () => {
  el.ringDx.value = 0;
  el.ringDy.value = 0;
  on3dChange(true);
};
renderRingSel();

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
  const nearRing = (p) => {
    if (!p) return false;
    const k = (S.ringInfos || []).findIndex((r) => Math.hypot(p.x - r.center[0], p.y - r.center[1]) <= (r.outer / 2) * 1.15);
    if (k < 0) return false;
    if (k !== S.ringSel) {
      ringFromInputs();
      S.ringSel = k;
      ringToInputs();
    }
    S.ringInfo = S.ringInfos[k];
    return true;
  };
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
  renderLocalFonts();
  el.localFontRow.classList.remove('hide');
  scanLocalKo();
};
/** 폰트 파일의 글자표(cmap)만 읽어 한글(가·한) 글자가 실제로 있는지 확인 — 파일 전체를 읽지 않아 빠름 */
async function fontHasHangul(blob) {
  const rd = async (o, n) => new DataView(await blob.slice(o, o + n).arrayBuffer());
  let h = await rd(0, 16);
  let base = 0;
  if (h.getUint32(0) === 0x74746366) base = h.getUint32(12); // 'ttcf': 첫 글꼴
  h = await rd(base, 12);
  const nt = h.getUint16(4);
  const dir = await rd(base + 12, nt * 16);
  let co = -1, cl = 0;
  for (let i = 0; i < nt; i++) if (dir.getUint32(i * 16) === 0x636d6170) (co = dir.getUint32(i * 16 + 8)), (cl = dir.getUint32(i * 16 + 12));
  if (co < 0) return false;
  const cm = await rd(co, Math.min(cl, 4 << 20));
  const n = cm.getUint16(2);
  const subs = [];
  for (let i = 0; i < n; i++) subs.push({ p: cm.getUint16(4 + i * 8), e: cm.getUint16(6 + i * 8), o: cm.getUint32(8 + i * 8) });
  const glyph = (o, c) => {
    const fmt = cm.getUint16(o);
    if (fmt === 4) {
      const seg = cm.getUint16(o + 6) / 2, ends = o + 14, starts = ends + seg * 2 + 2, deltas = starts + seg * 2, ranges = deltas + seg * 2;
      for (let i = 0; i < seg; i++) {
        if (cm.getUint16(ends + i * 2) < c) continue;
        const st = cm.getUint16(starts + i * 2);
        if (st > c) return 0;
        const ro = cm.getUint16(ranges + i * 2), dl = cm.getInt16(deltas + i * 2);
        if (!ro) return (c + dl) & 0xffff;
        const g = cm.getUint16(ranges + i * 2 + ro + (c - st) * 2);
        return g ? (g + dl) & 0xffff : 0;
      }
      return 0;
    }
    if (fmt === 12) {
      const ng = cm.getUint32(o + 12);
      for (let i = 0; i < ng; i++) {
        const a = cm.getUint32(o + 16 + i * 12), b = cm.getUint32(o + 20 + i * 12);
        if (c >= a && c <= b) return cm.getUint32(o + 24 + i * 12) + (c - a);
      }
      return 0;
    }
    return 0;
  };
  for (const sb of subs.sort((a, b) => (b.p === 3 && b.e === 10) - (a.p === 3 && a.e === 10) || (b.p === 3) - (a.p === 3))) {
    try {
      const f = cm.getUint16(sb.o);
      if (f !== 4 && f !== 12) continue;
      return !!(glyph(sb.o, 0xac00) && glyph(sb.o, 0xd55c));
    } catch (e) {}
  }
  return false;
}
// 확인 결과는 이 브라우저에 기억 (다음엔 바로 표시)
S.koCache = (() => {
  try {
    return JSON.parse(lsGet('svgforge.koFonts') || '{}');
  } catch (e) {
    return {};
  }
})();
let koScanSeq = 0;
async function scanLocalKo() {
  const my = ++koScanSeq;
  const list = S.localList || [];
  let done = 0, last = 0;
  for (const fd of list) {
    if (my !== koScanSeq) return;
    const key = fd.postscriptName || fd.fullName;
    if (!(key in S.koCache)) {
      try {
        S.koCache[key] = (await fontHasHangul(await fd.blob())) ? 1 : 0;
      } catch (e) {
        S.koCache[key] = KO_FONT_RE.test(fd.fullName + ' ' + fd.family) ? 1 : 0;
      }
    }
    done++;
    if (performance.now() - last > 400) {
      last = performance.now();
      el.localFontSel.options[0].textContent = T('폰트를 선택하세요… (한글 확인 중 {a}/{b})', { a: done, b: list.length });
    }
  }
  lsSet('svgforge.koFonts', JSON.stringify(S.koCache));
  renderLocalFonts();
}
// 설치 폰트 목록은 파일을 열어 보기 전엔 글자 범위를 알 수 없어 이름으로 한글 폰트를 추정
const KO_FONT_RE = /[가-힣]|malgun|gulim|batang|dotum|gungsuh|nanum|noto\s*(sans|serif)\s*(kr|cjk|korean)|source\s*han|pretendard|spoqa|apple\s*sd|applegothic|applemyungjo|kopub|ibm\s*plex\s*sans\s*kr|gowun|jua|do\s*hyeon|black\s*han|gmarket|cafe24|jalnan|maplestory|nexon|binggrae|s-core|suit\b|wanted|paperlogy|hancom|함초롬|hamchorom|hy[a-z가-힣]|hcr\s|yoon|sandoll|kbiz|seoul\s*(namsan|hangang)|d2coding|bm\s|baemin|school\s*safe|ownglyph|kcc|elice|kakao|lineseed.*kr|one\s*mobile|tmoney|dx|jeju|chosun/i;
function renderLocalFonts() {
  el.localFontSel.innerHTML = '';
  el.localFontSel.add(new Option(T('폰트를 선택하세요…'), ''));
  const gK = document.createElement('optgroup');
  gK.label = T('한글 지원 폰트');
  const gO = document.createElement('optgroup');
  gO.label = T('한글 없는 폰트 (영문 등)');
  const cur = el.localFontSel.value;
  S.localList.forEach((fd, i) => {
    const key = fd.postscriptName || fd.fullName;
    const ko = key in S.koCache ? !!S.koCache[key] : KO_FONT_RE.test(fd.fullName + ' ' + fd.family);
    const o = new Option((ko ? '[한] ' : '') + fd.fullName, String(i));
    if (ko) (o.style.color = '#1d5fd6'), (o.style.fontWeight = '600');
    (ko ? gK : gO).appendChild(o);
  });
  if (gK.children.length) el.localFontSel.appendChild(gK);
  if (gO.children.length) el.localFontSel.appendChild(gO);
  if (cur) el.localFontSel.value = cur;
}
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
  renderFontOptions();
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
  return list.filter((e) => e.id && e.type !== 'file' && e.id !== 'localFontSel' && e.id !== 'fontSel' && e.id !== 'ringSel' && !e.closest('#colorHeights') && !e.closest('#charEdit'));
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
    baseCustom: S.baseCustom || null,
    rings: (ringFromInputs(), S.rings),
    ringSel: S.ringSel,
    charStyles: S.charStyles,
    edits: S.edits,
    laserOps: S.laserOps,
  };
}
async function applyProject(p) {
  if (!p || p.app !== 'svg-forge' || !p.controls) throw new Error('bad project');
  resetHist();
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
  if (!('borderFull' in p.controls)) el.borderFull.checked = false; // 예전 프로젝트는 mm 값 그대로
  for (const e of controlEls()) {
    if (!(e.id in p.controls)) continue;
    const v = p.controls[e.id];
    if (e.type === 'checkbox') e.checked = !!v;
    else e.value = v;
  }
  if (p.controls.baseCut && !('textMode' in p.controls)) el.textMode.value = 'emboss_cut'; // 예전 프로젝트
  syncLabels();
  S.baseCustom = p.baseCustom || null;
  S.rings = Array.isArray(p.rings) && p.rings.length ? p.rings.map((r) => ({ ...RING_DEF, ...r })) : [{ ...RING_DEF, type: el.ringType.value, pos: el.ringPos.value, outer: parseFloat(el.ringOuter.value) || 8, hole: parseFloat(el.ringHole.value) || 4, dx: parseFloat(el.ringDx.value) || 0, dy: parseFloat(el.ringDy.value) || 0 }];
  S.ringSel = p.ringSel || 0;
  ringToInputs();
  S.charStyles = p.charStyles || {};
  S.edits = Array.isArray(p.edits) ? p.edits : [];
  S.chain = null;
  S.editsKey = '*';
  clearSel();
  S.laserOps = p.laserOps || {};
  S.prevText = el.text.value;
  S.selChar = null;
  el.charChips.dataset.sig = '';
  if (el.baseShape.value === 'custom' && !S.baseCustom) el.baseShape.value = 'outline';
  S.vb2 = null;
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
  if (!S.ready || !S.model || !S.prefs.autosave) return;
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

// ---------- 설정 ----------
const PREF_DEF = { dimColor: '#1d5fd6', dimSize: 1, bg2d: 'checker', bg3d: 'light', hints: true, autosave: true };
S.prefs = { ...PREF_DEF };
try {
  Object.assign(S.prefs, JSON.parse(lsGet('svgforge.prefs', '{}')));
} catch (e) {}
function applyPrefs() {
  const P = S.prefs;
  document.documentElement.style.setProperty('--dim', P.dimColor);
  document.documentElement.style.setProperty('--dim-fs', (11.5 * P.dimSize).toFixed(1) + 'px');
  el.view2d.dataset.bg = P.bg2d;
  el.view3d.dataset.bg = P.bg3d;
  setHints(P.hints);
  el.pDimColor.value = P.dimColor;
  el.pDimSize.value = String(P.dimSize);
  el.pBg2d.value = P.bg2d;
  el.pBg3d.value = P.bg3d;
  el.pHints.checked = P.hints;
  el.pAutosave.checked = P.autosave;
}
function prefsChanged() {
  S.prefs = { dimColor: el.pDimColor.value, dimSize: parseFloat(el.pDimSize.value) || 1, bg2d: el.pBg2d.value, bg3d: el.pBg3d.value, hints: el.pHints.checked, autosave: el.pAutosave.checked };
  lsSet('svgforge.prefs', JSON.stringify(S.prefs));
  applyPrefs();
  render2d();
  S.dirty3d = false;
  render3dIfVisible();
}
[el.pDimColor, el.pDimSize, el.pBg2d, el.pBg3d, el.pHints, el.pAutosave].forEach((e) => e.addEventListener('input', prefsChanged));
el.prefsBtn.onclick = () => (el.prefs.showModal ? el.prefs.showModal() : el.prefs.setAttribute('open', ''));
el.pResetPrefs.onclick = () => {
  S.prefs = { ...PREF_DEF };
  applyPrefs();
  prefsChanged();
};
// 작업 설정 처음값: 시작할 때의 화면 값을 기억해 두었다가 되돌림 (글자·이미지는 유지)
let ctlDefaults = null;
el.pResetCtl.onclick = () => {
  if (!ctlDefaults) return;
  for (const e of controlEls()) {
    if (e.id === 'text' || !(e.id in ctlDefaults)) continue;
    if (e.type === 'checkbox') e.checked = ctlDefaults[e.id];
    else e.value = ctlDefaults[e.id];
  }
  syncLabels();
  S.heightByColor = new Map();
  S.baseCustom = null;
  S.rings = [{ ...RING_DEF }];
  S.ringSel = 0;
  ringToInputs();
  S.charStyles = {};
  S.selChar = null;
  el.charChips.dataset.sig = '';
  el.colorHeights.dataset.sig = '';
  el.edgeSize.removeAttribute('max');
  syncColorUi();
  on3dChange(false);
  S.vb2 = null;
  S.dirty3d = true;
  S.flash = T('작업 설정을 처음 값으로 되돌렸습니다.');
  el.prefs.close && el.prefs.close();
  schedule(0);
};

// ---------- 치수 표시 · 처음으로 ----------
S.showDims = lsGet('svgforge.dims', '1') === '1';
el.dimsBtn.classList.toggle('on', S.showDims);
el.dimsBtn.onclick = () => {
  S.showDims = !S.showDims;
  lsSet('svgforge.dims', S.showDims ? '1' : '0');
  el.dimsBtn.classList.toggle('on', S.showDims);
  render2d();
  S.dirty3d = false;
  render3dIfVisible();
};
try { el.advImage.open = localStorage.getItem('svgforge.adv') === '1'; } catch (e) {}
el.advImage.addEventListener('toggle', () => lsSet('svgforge.adv', el.advImage.open ? '1' : '0'));
// ---------- 실행 취소 · 다시 실행 (설정값 기준, 이미지·폰트 파일은 제외) ----------
S.hist = [];
S.histI = -1;
S.baseCache = {};
let histTimer = 0;
function histSnap() {
  ringFromInputs();
  const controls = {};
  for (const e of controlEls()) controls[e.id] = e.type === 'checkbox' ? e.checked : e.value;
  if (S.baseCustom) S.baseCache[S.baseCustom.key] = S.baseCustom;
  return JSON.stringify({ controls, font: el.fontSel.value, mode: S.mode, hbc: [...S.heightByColor.entries()], baseKey: S.baseCustom ? S.baseCustom.key : null, rings: S.rings, ringSel: S.ringSel, charStyles: S.charStyles, v2mode: S.v2mode, edits: S.edits, editsKey: S.editsKey });
}
function updateUndoBtns() {
  el.undoBtn.disabled = S.histI <= 0;
  el.redoBtn.disabled = S.histI >= S.hist.length - 1;
}
function pushHist() {
  if (S.restoreAt && Date.now() - S.restoreAt < 1500) return;
  clearTimeout(histTimer);
  histTimer = setTimeout(() => {
    if (!S.model) return;
    const s = histSnap();
    if (S.hist[S.histI] === s) return;
    S.hist = S.hist.slice(0, S.histI + 1);
    S.hist.push(s);
    if (S.hist.length > 60) S.hist.shift();
    S.histI = S.hist.length - 1;
    updateUndoBtns();
  }, 450);
}
function resetHist() {
  S.hist = [];
  S.histI = -1;
  updateUndoBtns();
}
function restoreHist(i) {
  if (i < 0 || i >= S.hist.length) return;
  clearTimeout(histTimer);
  const p = JSON.parse(S.hist[i]);
  S.restoreAt = Date.now();
  for (const e of controlEls()) {
    if (!(e.id in p.controls)) continue;
    if (e.type === 'checkbox') e.checked = !!p.controls[e.id];
    else e.value = p.controls[e.id];
  }
  if (fontEntry(p.font)) el.fontSel.value = p.font;
  S.baseCustom = p.baseKey ? S.baseCache[p.baseKey] || null : null;
  S.rings = p.rings.map((r) => ({ ...RING_DEF, ...r }));
  S.ringSel = p.ringSel || 0;
  ringToInputs();
  S.charStyles = p.charStyles || {};
  S.edits = Array.isArray(p.edits) ? p.edits : [];
  S.chain = null;
  S.editsKey = p.editsKey || '*';
  clearSel();
  S.prevText = el.text.value;
  S.selChar = null;
  el.charChips.dataset.sig = '';
  S.heightByColor = new Map(p.hbc || []);
  el.colorHeights.dataset.sig = '';
  S.v2mode = p.v2mode === 'line' ? 'line' : 'fill';
  el.v2Fill.classList.toggle('on', S.v2mode === 'fill');
  el.v2Line.classList.toggle('on', S.v2mode === 'line');
  S.histI = i;
  syncLabels();
  syncColorUi();
  setMode(p.mode === 'text' ? 'text' : 'image', true);
  updateUndoBtns();
  on3dChange(false);
  schedule(0);
}
const undo = () => restoreHist(S.histI - 1);
const redo = () => restoreHist(S.histI + 1);
el.undoBtn.onclick = undo;
el.redoBtn.onclick = redo;
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k !== 'z' && k !== 'y') return;
  const a = document.activeElement;
  // 글자 입력칸에서는 그 칸 자체의 되돌리기를 그대로 둠
  if (a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /text|number/.test(a.type)))) return;
  e.preventDefault();
  if (k === 'y' || e.shiftKey) redo();
  else undo();
});
el.helpBtn.onclick = () => (el.help.showModal ? el.help.showModal() : el.help.setAttribute('open', ''));

el.homeBtn.onclick = () => {
  if (S.view === '3d') {
    S.dirty3d = true;
    rebuild3d();
  } else {
    S.vb2 = null;
    applyVb2();
  }
};

// ---------- 화면 언어 ----------
function refreshLang() {
  document.title = T('SVG Forge — 이미지·텍스트를 SVG · DXF · STL로');
  showPresetRec();
  el.view2d.dataset.drop = el.view3d.dataset.drop = T('여기에 놓으면 불러옵니다');
  if (el.langSel.value !== getLang()) el.langSel.value = getLang();
}
el.langSel.onchange = () => {
  setLang(el.langSel.value);
  refreshLang();
  syncLabels();
  if (S.localList.length) renderLocalFonts();
  renderFontOptions();
  refreshCubeLabels();
  renderRingSel();
  el.charChips.dataset.sig = '';
  el.colorHeights.dataset.sig = '';
  renderHeightChips();
  S.dirty3d = false;
  render3dIfVisible();
  if (el.text.value === '텍스트 입력' || el.text.value === 'Text') el.text.value = T('텍스트 입력');
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
el.btnFill.onclick = () => S.model && download(new Blob([toFillSvg(S.model)], { type: 'image/svg+xml' }), `${safeBase()}_fill.svg`);
// ---------- 레이저: 색상별 작업(절단·새김·제외) · 절단 폭 보정 ----------
S.laserOps = {};
let SIM = null;
function refreshSim() {
  if (!S.model || S.view !== 'sim') return;
  if (!SIM)
    SIM = createSim({ canvas: el.simCv, head: el.simHead, play: el.simPlay, rst: el.simRst, pos: el.simPos, time: el.simTime, spd: el.simSpd, cut: el.simCut, eng: el.simEng, trv: el.simTrv, info: el.simInfo, txtPlay: T('▶ 재생'), txtPause: T('⏸ 일시정지') });
  const lm = laserOut();
  SIM.setModel(lm, S.model.width, S.model.height, true);
}
const laserOut = () => laserModel(S.model, { kerf: Math.max(0, parseFloat(el.kerf.value) || 0), ops: S.laserOps });
function renderLaserRows() {
  const m = S.model;
  el.laserRows.innerHTML = '';
  if (!m) return;
  for (const l of m.layers) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<i class="sw" style="background:${l.color}"></i><span style="flex:0 0 64px">${l.color}</span>`;
    const sel = document.createElement('select');
    sel.className = 'grow';
    for (const [v, k] of [['cut', '절단 (윤곽선)'], ['engrave', '새김 (면 채움)'], ['skip', '저장 안 함']]) sel.add(new Option(T(k), v));
    sel.value = S.laserOps[l.color] || 'cut';
    sel.onchange = () => {
      S.laserOps[l.color] = sel.value;
      autosave();
    };
    row.append(sel);
    el.laserRows.append(row);
  }
}
el.laserOpsBtn.onclick = () => {
  renderLaserRows();
  el.laserDlg.showModal ? el.laserDlg.showModal() : el.laserDlg.setAttribute('open', '');
};
el.btnLaser.onclick = () => {
  if (!S.model) return;
  const lm = laserOut();
  download(new Blob([toLaserSvg(lm, { single: el.laserSingle.checked })], { type: 'image/svg+xml' }), `${safeBase()}_laser.svg`);
};
el.btnDxf.onclick = () => {
  if (!S.model) return;
  download(new Blob([toDxf(laserOut(), { single: el.laserSingle.checked })], { type: 'application/dxf' }), `${safeBase()}.dxf`);
};
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
window.__strokeOf = strokeOf; // 테스트용
Object.defineProperty(S, 'cam', { get: () => (G3 && !G3.failed ? G3.camera.position.toArray() : null) }); // 테스트용
Object.defineProperty(S, 'fov', { get: () => (G3 && !G3.failed ? G3.camera.fov : null) }); // 테스트용
Object.defineProperty(S, 'tgt', { get: () => (G3 && !G3.failed ? G3.controls.target.toArray() : null) }); // 테스트용
document.querySelectorAll('.appver').forEach((e) => (e.textContent = 'v' + VERSION));
enhanceColorInputs(document, () => (S.model ? [...new Set(S.model.layers.map((l) => l.color))] : []));
initLang();
applyLang();
ctlDefaults = {};
for (const e of controlEls()) ctlDefaults[e.id] = e.type === 'checkbox' ? e.checked : e.value;
if (getLang() !== 'ko' && el.text.value === '텍스트 입력') el.text.value = T('텍스트 입력');
applyPrefs();
refreshLang();
startCredit();
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
