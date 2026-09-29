// 입력 → 색상별 링(레이어) 변환: 이미지 트레이싱, 텍스트 윤곽선
import { gaussBlur, marchingSquares, polyArea } from './contour.js';
import { analyzeChain, regularize, emitChain, reverseCmds, symmetrizeLoops } from './vectorize.js';
import { cleanLabels, buildBoundaryGraph } from './planar.js';

const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** 알파를 흰색 위에 합성한 RGBA(불투명) 복사본 */
function compositeOnWhite(imgd) {
  const src = imgd.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3] / 255;
    out[i] = src[i] * a + 255 * (1 - a);
    out[i + 1] = src[i + 1] * a + 255 * (1 - a);
    out[i + 2] = src[i + 2] * a + 255 * (1 - a);
    out[i + 3] = 255;
  }
  return { width: imgd.width, height: imgd.height, data: out };
}

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Otsu 자동 임계값 (불투명 픽셀 기준) */
export function otsuThreshold(imgd) {
  const hist = new Float64Array(256);
  let total = 0;
  const d = imgd.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    hist[Math.round(lum(d[i], d[i + 1], d[i + 2]))]++;
    total++;
  }
  if (!total) return 128;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = -1, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    // 두 무리의 평균 사이 중간값 = 가장자리 50% 지점 (흑백 이미지에서 윤곽이 줄어들지 않음)
    if (v > best) {
      best = v;
      thr = (mB + mF) / 2;
    }
  }
  return Math.max(1, Math.min(254, Math.round(thr)));
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** k-means++ 색상 양자화 (결정적). 밝기 순으로 정렬해 반환 */
function kmeansPalette(imgd, k) {
  const d = imgd.data;
  const n = imgd.width * imgd.height;
  const step = Math.max(1, Math.floor(n / 30000));
  const pts = [];
  for (let p = 0; p < n; p += step) pts.push([d[p * 4], d[p * 4 + 1], d[p * 4 + 2]]);
  const rnd = mulberry32(12345);
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const centers = [pts[Math.floor(rnd() * pts.length)].slice()];
  const dmin = pts.map((p) => dist2(p, centers[0]));
  while (centers.length < k) {
    let sum = 0;
    for (const v of dmin) sum += v;
    if (sum === 0) break;
    let r = rnd() * sum;
    let idx = 0;
    for (; idx < pts.length - 1; idx++) {
      r -= dmin[idx];
      if (r <= 0) break;
    }
    const c = pts[idx].slice();
    centers.push(c);
    for (let i = 0; i < pts.length; i++) dmin[i] = Math.min(dmin[i], dist2(pts[i], c));
  }
  for (let it = 0; it < 12; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dd = dist2(p, centers[c]);
        if (dd < bd) {
          bd = dd;
          bi = c;
        }
      }
      const a = acc[bi];
      a[0] += p[0];
      a[1] += p[1];
      a[2] += p[2];
      a[3]++;
    }
    for (let c = 0; c < centers.length; c++) {
      if (acc[c][3]) centers[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
    }
  }
  centers.sort((a, b) => lum(...a) - lum(...b));
  return centers.map((c) => ({ r: Math.round(c[0]), g: Math.round(c[1]), b: Math.round(c[2]), a: 255 }));
}

function nearestIndex(pal, r, g, b) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const dd = (pal[i].r - r) ** 2 + (pal[i].g - g) ** 2 + (pal[i].b - b) ** 2;
    if (dd < bd) {
      bd = dd;
      bi = i;
    }
  }
  return bi;
}

function assembleRing(parts, emitted, revCache) {
  const out = [];
  for (const p of parts) {
    let c = emitted[p.chain];
    if (!c) continue;
    if (p.rev) {
      if (!revCache.has(p.chain)) revCache.set(p.chain, reverseCmds(c));
      c = revCache.get(p.chain);
    }
    const src = out.length ? c.slice(1) : c;
    for (const x of src) out.push(x.slice());
  }
  return out;
}

/**
 * 이미지 → 색상 레이어(링 목록). 좌표 단위는 픽셀. 반환 배열에 .stats(보정 통계)가 붙는다.
 * opts: { colors, threshold, invert, removeBg, tol, minArea, cornerAngle, blur, lineTol, snapDeg,
 *         arcs, parallel, equalWidth, align, symmetry }
 */
/** 가장자리 보존 잡티 제거 (5×5 바이래터럴, RGB) */
export function bilateral(imgd, sigmaS = 1.6, sigmaR = 28) {
  const { width: w, height: h, data: d } = imgd;
  const out = new Uint8ClampedArray(d.length);
  const R = 2;
  const ws = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) ws.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / (2 * sigmaS * sigmaS))]);
  const inv = 1 / (2 * sigmaR * sigmaR);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r0 = d[i], g0 = d[i + 1], b0 = d[i + 2];
      let sr = 0, sg = 0, sb = 0, sw = 0;
      for (const [dx, dy, gs] of ws) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = (yy * w + xx) * 4;
        const dr = d[j] - r0, dg = d[j + 1] - g0, db = d[j + 2] - b0;
        const wt = gs * Math.exp(-(dr * dr + dg * dg + db * db) * inv);
        sr += d[j] * wt;
        sg += d[j + 1] * wt;
        sb += d[j + 2] * wt;
        sw += wt;
      }
      out[i] = sr / sw;
      out[i + 1] = sg / sw;
      out[i + 2] = sb / sw;
      out[i + 3] = d[i + 3];
    }
  }
  return { width: w, height: h, data: out };
}

export function traceImage(imgd, opts) {
  if (opts.denoise) imgd = bilateral(bilateral(imgd));
  const {
    colors, threshold, invert, removeBg, tol, minArea, cornerAngle, blur,
    lineTol = 1, snapDeg = 3, arcs = true, parallel = true, equalWidth = true, align = true, symmetry = false,
  } = opts;
  const w = imgd.width, h = imgd.height, d = imgd.data;
  const N = w * h;
  const vo = { tol, cornerAngle, smooth: 1, lineTol, arcs };
  const ro = { snapDeg, parallel, equalWidth, align, lineTol };
  const layers = [];
  let stats = {};

  if (colors <= 1) {
    // 흑백: 밝기 자체를 스칼라장으로 사용 → 안티앨리어싱된 가장자리의 서브픽셀 위치를 그대로 살림
    const f = new Float32Array(N);
    const BG = -128;
    for (let i = 0; i < N; i++) {
      const a = d[i * 4 + 3] / 255;
      const l = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      const v = invert ? l - threshold : threshold - l;
      f[i] = a * v + (1 - a) * BG;
    }
    const field = gaussBlur(f, w, h, 0.6 + blur * 0.6);
    let loops = marchingSquares(field, w, h).filter((lp) => Math.abs(polyArea(lp)) >= minArea);
    if (symmetry) {
      const sy = symmetrizeLoops(loops);
      loops = sy.loops;
      stats.symAxis = sy.axis;
    }
    const chains = loops.map((lp) => analyzeChain(lp, true, vo));
    const sampler = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 0;
      return field[yi * w + xi] > 0 ? 1 : 0;
    };
    stats = { ...stats, ...regularize(chains, ro, sampler, (L) => L === 1) };
    const rings = chains.map((ch) => emitChain(ch, vo)).filter((r) => r.length > 2);
    if (rings.length) layers.push({ color: '#000000', rings });
    layers.stats = stats;
    return layers;
  }

  // 다색: 색 분류 → 작은 조각 정리 → 경계 그래프(공유 경계) → 분석·정규화·출력
  let work = compositeOnWhite(imgd);
  if (blur > 0) {
    const sg = blur * 0.6;
    const ch = [0, 1, 2].map((c) => {
      const a = new Float32Array(N);
      for (let i = 0; i < N; i++) a[i] = work.data[i * 4 + c];
      return gaussBlur(a, w, h, sg);
    });
    const nd = new Uint8ClampedArray(work.data.length);
    for (let i = 0; i < N; i++) {
      nd[i * 4] = ch[0][i];
      nd[i * 4 + 1] = ch[1][i];
      nd[i * 4 + 2] = ch[2][i];
      nd[i * 4 + 3] = 255;
    }
    work = { width: w, height: h, data: nd };
  }
  const pal = kmeansPalette(work, colors);
  const label = new Int32Array(N);
  for (let i = 0; i < N; i++) label[i] = nearestIndex(pal, work.data[i * 4], work.data[i * 4 + 1], work.data[i * 4 + 2]);
  // 안티앨리어싱 혼합색 픽셀: 이웃한 두 색의 혼합으로 설명되면 둘 중 가까운 색으로 (가는 띠 모양 오분류 방지)
  {
    const wd = work.data;
    const src = label.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const L = src[i];
        const r = wd[i * 4], g = wd[i * 4 + 1], b = wd[i * 4 + 2];
        const d0 = Math.hypot(r - pal[L].r, g - pal[L].g, b - pal[L].b);
        if (d0 < 12) continue;
        const nb = new Set();
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          nb.add(src[yy * w + xx]);
        }
        if (nb.size < 2) continue;
        const arr = [...nb];
        let best = null, bd = d0 * 0.6;
        for (let u = 0; u < arr.length; u++) for (let v = u + 1; v < arr.length; v++) {
          const A = pal[arr[u]], B = pal[arr[v]];
          const dx = B.r - A.r, dy = B.g - A.g, dz = B.b - A.b;
          const L2 = dx * dx + dy * dy + dz * dz;
          if (L2 < 400) continue;
          let t = ((r - A.r) * dx + (g - A.g) * dy + (b - A.b) * dz) / L2;
          t = Math.max(0, Math.min(1, t));
          const dd = Math.hypot(r - (A.r + dx * t), g - (A.g + dy * t), b - (A.b + dz * t));
          if (dd < bd) {
            bd = dd;
            best = t < 0.5 ? arr[u] : arr[v];
          }
        }
        if (best !== null) label[i] = best;
      }
    }
  }
  cleanLabels(label, w, h, Math.max(1, minArea));
  const drop = new Set();
  if (removeBg) {
    const corners = [0, w - 1, (h - 1) * w, (h - 1) * w + (w - 1)];
    const votes = new Map();
    for (const p of corners) votes.set(label[p], (votes.get(label[p]) || 0) + 1);
    let best = -1, bv = 0;
    for (const [k, v] of votes) if (v > bv) { bv = v; best = k; }
    if (best >= 0 && bv >= 2) drop.add(best);
  }
  const present = new Set();
  for (let i = 0; i < N; i++) present.add(label[i]);
  const outLabels = new Set([...present].filter((k) => !drop.has(k)));
  const { chains, rings } = buildBoundaryGraph(label, w, h, outLabels, work.data, pal);
  const usedIdx = new Set();
  for (const loops of rings.values()) for (const parts of loops) for (const p of parts) usedIdx.add(p.chain);
  const analyzed = new Map();
  for (const ci of usedIdx) analyzed.set(ci, analyzeChain(chains[ci].pts, chains[ci].closed, vo));
  const sampler = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return -2;
    const L = label[yi * w + xi];
    return drop.has(L) ? -1 : L;
  };
  stats = regularize([...analyzed.values()], ro, sampler, (L) => L >= 0);
  const emitted = [];
  for (const [ci, ch] of analyzed) emitted[ci] = emitChain(ch, vo);
  const revCache = new Map();
  // 밝기 순(어두운 색 먼저)으로 레이어 정렬
  const order = [...outLabels].sort((a, b) => lum(pal[a].r, pal[a].g, pal[a].b) - lum(pal[b].r, pal[b].g, pal[b].b));
  for (const K of order) {
    const rs = (rings.get(K) || []).map((parts) => assembleRing(parts, emitted, revCache)).filter((r) => r.length > 2);
    if (rs.length) layers.push({ color: hex(pal[K].r, pal[K].g, pal[K].b), rings: rs });
  }
  stats.chains = usedIdx.size;
  layers.stats = stats;
  return layers;
}

/** 가장자리 픽셀 중 "양옆 색의 중간색"인 픽셀(안티앨리어싱) 비율. 낮으면 계단형(하드 엣지) 이미지 */
export function estimateHardEdges(imgd) {
  const w = imgd.width, h = imgd.height, d = imgd.data;
  const col = (i) => {
    const a = d[i * 4 + 3] / 255;
    return [d[i * 4] * a + 255 * (1 - a), d[i * 4 + 1] * a + 255 * (1 - a), d[i * 4 + 2] * a + 255 * (1 - a)];
  };
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  let edge = 0, mid = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      for (const [a, b] of [[i - 1, i + 1], [i - w, i + w]]) {
        const A = col(a), B = col(b);
        const dAB = dist(A, B);
        if (dAB < 80) continue;
        const C = col(i);
        edge++;
        if (Math.min(dist(C, A), dist(C, B)) > 0.15 * dAB) mid++;
      }
    }
  }
  return edge ? mid / edge : 1;
}
