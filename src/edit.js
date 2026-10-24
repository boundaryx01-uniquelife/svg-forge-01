// 미리보기 도형 편집: 삭제 · 구멍 채우기 · 두께(오프셋) · 색 바꾸기/합치기
// 편집은 '작업 목록(edits)'으로 기록해 두고, 모델(mm)을 만들 때마다 같은 순서로 다시 적용 → 너비 변경·저장·실행취소와 호환
import ClipperLib from 'clipper-lib';
import { buildItems, closeRing, transformRing } from './geom.js';

const SC = 1000; // mm → µm

const toPaths = (items) => items.map((it) => it.poly.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) })));

function offsetRings(items, d) {
  const src = toPaths(items);
  const c = new ClipperLib.Clipper();
  c.AddPaths(src, ClipperLib.PolyType.ptSubject, true);
  const u = new ClipperLib.Paths();
  c.Execute(ClipperLib.ClipType.ctUnion, u, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const co = new ClipperLib.ClipperOffset(2, 0.01 * SC);
  co.AddPaths(u, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, d * SC);
  return out
    .filter((p) => p.length >= 3)
    .map((p) => {
      const r = p.map((q, i) => [i ? 'L' : 'M', q.X / SC, q.Y / SC]);
      return closeRing(r);
    });
}

const polyArea = (p) => {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]);
  return Math.abs(a) / 2;
};

/** 겹친 도형이 있으면(겹친 부분이 구멍으로 읽히는 문제) 한 레이어를 합집합으로 합침. 겹침이 없으면 그대로 */
function fixOverlap(L, tol) {
  const items = L.items;
  if (items.length < 2) return L;
  let sum = 0;
  for (const it of items) sum += (it.hole ? -1 : 1) * polyArea(it.poly);
  const c = new ClipperLib.Clipper();
  c.AddPaths(toPaths(items), ClipperLib.PolyType.ptSubject, true);
  const u = new ClipperLib.Paths();
  c.Execute(ClipperLib.ClipType.ctUnion, u, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  let ua = 0;
  for (const q of u) ua += Math.abs(ClipperLib.Clipper.Area(q)) / (SC * SC) * (ClipperLib.Clipper.Orientation(q) ? 1 : -1);
  if (Math.abs(ua - sum) < Math.max(0.01, sum * 1e-4)) return L;
  const rings = u.filter((q) => q.length >= 3).map((q) => closeRing(q.map((pt, k) => [k ? 'L' : 'M', pt.X / SC, pt.Y / SC])));
  return { ...L, items: buildItems(rings, tol) };
}

/** 사용자가 직접 칠한 자리를 '영역'으로 기억해 둔다.
 *  색만으로는 모자란다 — 바탕색과 같은 색으로 칠하면 몸통에 합쳐져 구분할 수 없고,
 *  몰드·패턴에서 그 자리가 무늬에 덮여 사라진다. */
function markPainted(model, color, rings, tol) {
  const its = buildItems(rings, tol);
  if (!its.length) return;
  (model.painted || (model.painted = [])).push({ color, polys: its.map((x) => x.poly) });
}

/** 구멍 안의 빈 곳 = 그 구멍 − (모든 색의 칠해진 면). 구멍 속에 떠 있는 다른 도형은 남긴다 */
function emptyInside(model, it) {
  const filled = new ClipperLib.Paths();
  const U = new ClipperLib.Clipper();
  for (const l of model.layers) {
    const one = new ClipperLib.Paths();
    const cl = new ClipperLib.Clipper();
    cl.AddPaths(toPaths(l.items), ClipperLib.PolyType.ptSubject, true);
    cl.Execute(ClipperLib.ClipType.ctUnion, one, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
    U.AddPaths(one, ClipperLib.PolyType.ptSubject, true);
  }
  U.Execute(ClipperLib.ClipType.ctUnion, filled, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out = new ClipperLib.Paths();
  const D = new ClipperLib.Clipper();
  D.AddPaths(toPaths([it]), ClipperLib.PolyType.ptSubject, true);
  D.AddPaths(filled, ClipperLib.PolyType.ptClip, true);
  D.Execute(ClipperLib.ClipType.ctDifference, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out.filter((p) => p.length >= 3).map((p) => closeRing(p.map((q, i) => [i ? 'L' : 'M', q.X / SC, q.Y / SC])));
}

/** 두 묶음을 '영역'으로 합쳐 링으로 돌려준다.
 *  링만 모아 buildItems 로 중첩을 다시 계산하면, 다른 색 도형 위에 얹혀 있던
 *  테두리가 그 도형의 구멍으로 뒤집힌다(색을 합쳤는데 구멍이 뚫리는 문제). */
function unionRings(aItems, bItems) {
  const c = new ClipperLib.Clipper();
  if (aItems.length) c.AddPaths(toPaths(aItems), ClipperLib.PolyType.ptSubject, true);
  if (bItems.length) c.AddPaths(toPaths(bItems), ClipperLib.PolyType.ptClip, true);
  const out = new ClipperLib.Paths();
  c.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out.filter((p) => p.length >= 3).map((p) => closeRing(p.map((q, i) => [i ? 'L' : 'M', q.X / SC, q.Y / SC])));
}

/** i번 도형 + 그 안의 직접 구멍들의 번호 */
export function groupOf(items, i) {
  const g = [i];
  if (!items[i].hole) items.forEach((it, j) => it.hole && it.parent === i && g.push(j));
  return g;
}

/** 선분 a→b 를 따라 폭 w(mm)만큼 도려내 연결된 부분을 끊음 (e.c 없으면 모든 색, e.i 없으면 그 색 전체) */
function cutLine(model, e, tol) {
  const [ax, ay] = e.a, [bx, by] = e.b;
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1e-6 || !(e.w > 0)) return;
  const nx = (-(by - ay) / len) * (e.w / 2), ny = ((bx - ax) / len) * (e.w / 2);
  const strip = [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]].map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }));
  model.layers.forEach((L, li) => {
    if (e.c && L.color !== e.c) return;
    const all = L.items;
    let sel;
    if (e.i == null || !e.c) sel = all.map((_, j) => j);
    else if (e.i >= 0 && e.i < all.length) sel = groupOf(all, e.i);
    else return;
    const selSet = new Set(sel);
    // 도형(바깥 + 안의 구멍) 묶음마다: 선분에 닿는 것만 도려내고 나머지는 그대로 (곡선·원호 유지)
    const used = new Set();
    let rings = [];
    let changed = false;
    for (const j of sel) {
      if (used.has(j)) continue;
      const grp = all[j].hole && selSet.has(all[j].parent) ? null : groupOf(all, j);
      if (!grp) continue;
      grp.forEach((g) => used.add(g));
      const run = (type, subj, clip) => {
        const c = new ClipperLib.Clipper();
        c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
        c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
        const o = new ClipperLib.Paths();
        c.Execute(type, o, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
        return o;
      };
      const subj = toPaths(grp.map((g) => all[g]));
      const u = run(ClipperLib.ClipType.ctUnion, subj, []);
      if (!run(ClipperLib.ClipType.ctIntersection, u, [strip]).length) {
        rings = rings.concat(grp.map((g) => all[g].ring));
        continue;
      }
      changed = true;
      const out = run(ClipperLib.ClipType.ctDifference, u, [strip]);
      rings = rings.concat(out.filter((q) => q.length >= 3).map((q) => closeRing(q.map((pt, k) => [k ? 'L' : 'M', pt.X / SC, pt.Y / SC]))));
    }
    if (!changed) return;
    // 선택 범위 밖(다른 도형)은 그대로 합침
    const rest = all.filter((_, j) => !used.has(j)).map((it) => it.ring);
    model.layers[li] = { ...L, items: buildItems(rest.concat(rings), tol) };
  });
}
/** 다른 색 층에서 rings가 덮는 부분을 도려냄 */
function knock(model, color, rings, tol) {
  const sub = buildItems(rings, tol).map((it) => it.poly.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) })));
  if (!sub.length) return;
  for (let li = 0; li < model.layers.length; li++) {
    const L = model.layers[li];
    if (L.color === color || !L.items.length) continue;
    const c = new ClipperLib.Clipper();
    c.AddPaths(toPaths(L.items), ClipperLib.PolyType.ptSubject, true);
    c.AddPaths(sub, ClipperLib.PolyType.ptClip, true);
    const out = new ClipperLib.Paths();
    c.Execute(ClipperLib.ClipType.ctDifference, out, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftNonZero);
    const rs = out.filter((p) => p.length >= 3).map((p) => closeRing(p.map((q, i) => [i ? 'L' : 'M', q.X / SC, q.Y / SC])));
    model.layers[li] = { ...L, items: buildItems(rs, tol) };
  }
}
/** 획 폭 재기 (mm): 그림으로 그려 거리 변환 → 획 가운데 선(능선)의 폭을 모음. { typ: 보통 폭, min: 가장 가는 곳(하위 10%) } */
export function strokeOf(rings, tol = 0.05) {
  const items = buildItems(rings, tol);
  if (!items.length) return { typ: 0, min: 0 };
  const c = new ClipperLib.Clipper();
  c.AddPaths(toPaths(items), ClipperLib.PolyType.ptSubject, true);
  const u = new ClipperLib.Paths();
  c.Execute(ClipperLib.ClipType.ctUnion, u, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of u) for (const q of p) (q.X < x0 && (x0 = q.X), q.X > x1 && (x1 = q.X), q.Y < y0 && (y0 = q.Y), q.Y > y1 && (y1 = q.Y));
  if (!isFinite(x0)) return { typ: 0, min: 0 };
  const Wmm = (x1 - x0) / SC, Hmm = (y1 - y0) / SC;
  const res = Math.max(4, Math.min(40, 1600 / Math.max(Wmm, Hmm, 0.1))); // px/mm
  const W = Math.ceil(Wmm * res) + 4, H = Math.ceil(Hmm * res) + 4;
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.beginPath();
  for (const p of u) p.forEach((q, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, ((q.X - x0) / SC) * res + 2, ((q.Y - y0) / SC) * res + 2));
  ctx.fill('nonzero');
  const img = ctx.getImageData(0, 0, W, H).data;
  // 안쪽 픽셀 → 바깥까지 거리 (Felzenszwalb 제곱 거리 변환)
  const INF = 1e12, f = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) f[i] = img[i * 4 + 3] > 127 ? INF : 0;
  const n = Math.max(W, H), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), g = new Float64Array(n);
  const pass = (len, get, set) => {
    for (let q = 0; q < len; q++) g[q] = get(q);
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < len; q++) {
      let sx = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (sx <= z[k]) {
        k--;
        sx = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = sx;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + g[v[k]];
    }
    for (let q = 0; q < len; q++) set(q, d[q]);
  };
  for (let x = 0; x < W; x++) pass(H, (y) => f[y * W + x], (y, val) => (f[y * W + x] = val));
  for (let y = 0; y < H; y++) pass(W, (x) => f[y * W + x], (x, val) => (f[y * W + x] = val));
  const widths = [];
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, dv = f[i];
      if (dv < 2.25) continue; // 1.5px 미만은 가장자리 잡음
      let top = true;
      for (let dy = -1; dy <= 1 && top; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && f[i + dy * W + dx] > dv) { top = false; break; }
      if (top) widths.push((2 * Math.sqrt(dv) - 0.5) / res);
    }
  if (!widths.length) return { typ: 1 / res, min: 1 / res };
  widths.sort((a, b) => a - b);
  return { typ: widths[Math.floor(widths.length / 2)], min: widths[Math.floor(widths.length * 0.1)] };
}
/** 고리들을 d(mm)만큼 굵게(+)·가늘게(−) — 글자 획 폭 맞추기 */
export function growRings(rings, d, tol = 0.05) {
  if (!d) return rings;
  return offsetRings(buildItems(rings, tol), d);
}
/** 한 색 층에서 폭이 m보다 가는 부분만 모자란 만큼 키운 고리들 (굵은 도형·모서리는 그대로) */
function minWidthRings(items, m) {
  const r = m / 2;
  const src = toPaths(items);
  const U = new ClipperLib.Clipper();
  U.AddPaths(src, ClipperLib.PolyType.ptSubject, true);
  const base = new ClipperLib.Paths();
  U.Execute(ClipperLib.ClipType.ctUnion, base, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
  const off = (ps, d) => {
    const co = new ClipperLib.ClipperOffset(2, 0.01 * SC);
    co.AddPaths(ps, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    const o = new ClipperLib.Paths();
    co.Execute(o, d * SC);
    return o;
  };
  const open = off(off(base, -r), r + 0.03);
  const D = new ClipperLib.Clipper();
  D.AddPaths(base, ClipperLib.PolyType.ptSubject, true);
  D.AddPaths(open, ClipperLib.PolyType.ptClip, true);
  const thin = new ClipperLib.Paths();
  D.Execute(ClipperLib.ClipType.ctDifference, thin, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const grown = [];
  for (const p of thin) {
    const A = Math.abs(ClipperLib.Clipper.Area(p)) / (SC * SC);
    if (A < 0.5 * r * r) continue;
    let P = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) P += Math.hypot(p[i].X - p[j].X, p[i].Y - p[j].Y) / SC;
    const w = P > 0 ? (2 * A) / P : m;
    const d = Math.min(r, Math.max(0.02, (m - w) / 2 + 0.02));
    for (const q of off([p], d)) grown.push(q);
  }
  if (!grown.length) return null;
  const F = new ClipperLib.Clipper();
  F.AddPaths(base, ClipperLib.PolyType.ptSubject, true);
  F.AddPaths(grown, ClipperLib.PolyType.ptClip, true);
  const out = new ClipperLib.Paths();
  F.Execute(ClipperLib.ClipType.ctUnion, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return { rings: out.filter((p) => p.length >= 3).map((p) => closeRing(p.map((q, i) => [i ? 'L' : 'M', q.X / SC, q.Y / SC]))), grown };
}
/** model(mm)에 편집 목록을 순서대로 적용 (model을 직접 고침) */
export function applyEdits(model, edits, tol) {
  const bw = model.width;
  model.baseW = bw;
  model.addBoxes = [];
  for (let e of edits || []) {
    const eOrig = e;
    const k = e.w0 ? bw / e.w0 : 1; // 만든 때의 너비 대비 지금 너비 (너비를 바꿔도 편집이 그림과 같이 따라가게)
    if (e.t === 'cut' && k !== 1) e = { ...e, a: [e.a[0] * k, e.a[1] * k], b: [e.b[0] * k, e.b[1] * k], w: e.w * k };
    else if (e.t === 'mv' && k !== 1) e = { ...e, dx: e.dx * k, dy: e.dy * k };
    else if (e.t === 'off' && k !== 1) e = { ...e, d: e.d * k };
    if (e.t === 'add') {
      // 글자: 100단위 글자 좌표(y 아래쪽) → mm, 중심을 (x,y)에 맞춤. 너비를 바꾸면 같은 비율로 따라감
      const sc = (e.s / 100) * k;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const r of e.rings) for (const c of r) for (let i = 1; i + 1 < c.length; i += 2) (x0 = Math.min(x0, c[i]), x1 = Math.max(x1, c[i]), y0 = Math.min(y0, c[i + 1]), y1 = Math.max(y1, c[i + 1]));
      if (!isFinite(x0)) continue;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      let nr = e.rings.map((r) => transformRing(transformRing(r, sc, mx, my), 1, -e.x * k, -e.y * k));
      // 획 폭 맞추기: 정한 폭(mm, 너비와 상관없는 출력 기준)이 되도록 굵게/가늘게
      if (e.sw > 0) {
        const cur = strokeOf(nr, tol).min;
        const d = (e.sw + 0.05 - cur) / 2; // 최소 획 폭: 가는 글자만 굵게 (굵은 글자는 그대로)
        if (d > 0.005) nr = growRings(nr, d, tol);
      }
      {
        let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
        for (const it of buildItems(nr, tol)) for (const [x, y] of it.poly) (x < a0 && (a0 = x), x > a1 && (a1 = x), y < b0 && (b0 = y), y > b1 && (b1 = y));
        (model.addBoxes || (model.addBoxes = [])).push({ idx: edits.indexOf(eOrig), box: [a0, b0, a1, b1] });
      }
      let L = model.layers.find((l) => l.color === e.c);
      if (!L) model.layers.push((L = { color: e.c, items: [] }));
      const li = model.layers.indexOf(L);
      model.layers[li] = { ...L, items: buildItems(unionRings(L.items, buildItems(nr, tol)), tol) };
      knock(model, e.c, nr, tol);
      continue;
    }
    if (e.t === 'cut') {
      cutLine(model, e, tol);
      continue;
    }
    if (e.t === 'fill') {
      // 페인트 통: 누른 점의 면을 칠함. 도형이면 색을 바꾸고, 빈 구멍이면 그 빈 곳(안의 다른 도형 제외)을 새 색으로 채움
      const px = e.x * k, py = e.y * k;
      const h = hitItem(model, px, py);
      if (!h) continue;
      const L = model.layers.find((l) => l.color === h.c);
      const it = L.items[h.i];
      if (!it.hole) {
        if (h.c === e.to) continue;
        e = { t: 'col', c: h.c, is: [h.i], to: e.to };
      } else {
        const rs = emptyInside(model, it);
        if (!rs.length) continue;
        markPainted(model, e.to, rs, tol);
        let T0 = model.layers.find((l) => l.color === e.to);
        if (!T0) model.layers.push((T0 = { color: e.to, items: [] }));
        const ti = model.layers.indexOf(T0);
        model.layers[ti] = { ...T0, items: buildItems(unionRings(T0.items, buildItems(rs, tol)), tol) };
        continue;
      }
    }
    if (e.t === 'minw') {
      // 가는 부분 보정 (출력용 최소 폭 m mm — 노즐 기준이라 너비와 상관없이 그대로). 늘어난 부분은 다른 색에서 도려냄
      const targets = e.c ? model.layers.filter((l) => l.color === e.c) : model.layers.slice();
      for (const T0 of targets) {
        const li = model.layers.indexOf(T0);
        const res = minWidthRings(T0.items, e.m || 0.8);
        if (!res) continue;
        model.layers[li] = { ...T0, items: buildItems(res.rings, tol) };
        knock(model, T0.color, res.grown.map((p) => closeRing(p.map((q, i) => [i ? 'L' : 'M', q.X / SC, q.Y / SC]))), tol);
      }
      continue;
    }
    const li = model.layers.findIndex((l) => l.color === e.c);
    if (li < 0) continue;
    const L = model.layers[li];
    const all = L.items;
    const whole = e.i == null && !e.is;
    const idx = whole ? all.map((_, j) => j) : (e.is || [e.i]).filter((j) => j >= 0 && j < all.length);
    if (!idx.length) continue;
    const selSet = new Set();
    for (const j of idx) for (const g of groupOf(all, j)) selSet.add(g);
    const sel = [...selSet];
    const keep = all.filter((_, j) => !selSet.has(j));
    const picked = sel.map((j) => all[j]);
    let rings = keep.map((it) => it.ring);
    // 구멍만 따로 고른 경우(부모는 안 골랐을 때). 색 바꾸기에서는 '빈 곳을 새 색으로 채우기'가 되어야 한다
    const idxSet = new Set(idx);
    const soloHoles = whole ? [] : idx.filter((j) => all[j].hole && !idxSet.has(all[j].parent));
    if (e.t === 'del') {
      // 구멍을 지우면 메워짐, 바깥 도형을 지우면 그 안의 구멍도 같이
    } else if (e.t === 'holes') {
      const holes = new Set(whole ? all.map((it, j) => (it.hole ? j : -1)).filter((j) => j >= 0) : sel.filter((j) => all[j].hole));
      rings = all.filter((_, j) => !holes.has(j)).map((it) => it.ring);
    } else if (e.t === 'off') {
      if (!e.d) continue;
      // 구멍의 두께 +는 구멍이 줄어드는 쪽(도형이 두꺼워짐) → 구멍을 반대로 오프셋
      const hs = whole ? [] : idx.filter((j) => all[j].hole);
      const outer = whole ? picked : sel.filter((j) => !hs.includes(j)).map((j) => all[j]);
      const hset = new Set(hs);
      rings = all.filter((_, j) => !selSet.has(j) && !hset.has(j)).map((it) => it.ring);
      if (outer.length) rings = rings.concat(offsetRings(outer, e.d));
      for (const j of hs) rings = rings.concat(offsetRings([all[j]], -e.d));
    } else if (e.t === 'col') {
      if (e.to === e.c) continue;
      // 빈 곳은 레이어를 건드리기 전에 재야 한다 (모든 색의 칠해진 면을 기준으로 삼으므로)
      const holeSet = new Set(soloHoles);
      const fillRings = [];
      for (const j of soloHoles) fillRings.push(...emptyInside(model, all[j]));
      // 고른 구멍은 원래 색에 그대로 남긴다 (빼면 원래 색이 그 구멍을 메워 두 색이 겹친다)
      if (holeSet.size) rings = all.filter((_, j) => !selSet.has(j) || holeSet.has(j)).map((it) => it.ring);
      const move = sel.filter((j) => !holeSet.has(j)).map((j) => all[j]);
      if (move.length) markPainted(model, e.to, move.map((it) => it.ring), tol);
      if (fillRings.length) markPainted(model, e.to, fillRings, tol);
      model.layers[li] = { ...L, items: buildItems(rings, tol) };
      let T = model.layers.find((l) => l.color === e.to);
      if (!T) {
        T = { color: e.to, items: [] };
        model.layers.push(T);
      }
      let add = move;
      if (fillRings.length) add = add.concat(buildItems(fillRings, tol));
      if (!add.length) continue;
      T.items = buildItems(unionRings(T.items, add), tol);
      model.layers[model.layers.indexOf(T)] = T;
      continue;
    } else if (e.t === 'mv') {
      if (!e.dx && !e.dy) continue;
      rings = rings.concat(picked.map((it) => transformRing(it.ring, 1, -e.dx, -e.dy)));
    } else continue;
    model.layers[li] = fixOverlap({ ...L, items: buildItems(rings, tol) }, tol);
    // 옮기거나 키운 도형이 다른 색 위에 겹치면 그 부분은 위(나중 것)가 차지 — 3D에서 겹침이 생기지 않게
    if (e.t === 'mv') knock(model, e.c, picked.map((it) => transformRing(it.ring, 1, -e.dx, -e.dy)), tol);
    else if (e.t === 'off' && e.d > 0) knock(model, e.c, model.layers[li].items.map((it) => it.ring), tol);
  }
  model.layers = model.layers.filter((l) => l.items.length);
  let rc = 0, nc = 0;
  for (const l of model.layers) {
    rc += l.items.length;
    for (const it of l.items) nc += it.ring.length;
  }
  model.ringCount = rc;
  model.nodeCount = nc;
  model.editShift = [0, 0];
  // 도형을 지우거나 굵게 하면 전체 범위가 달라짐 → 내용에 딱 맞게 원점으로 다시 맞춤 (3MF·SVG 크기가 맞게)
  if ((edits || []).length && model.layers.length) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const all = model.layers.flatMap((l) => l.items).concat(model.plate || []);
    for (const it of all)
      for (const [x, y] of it.poly) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    if (isFinite(x0)) {
      if (Math.abs(x0) > 1e-9 || Math.abs(y0) > 1e-9)
        for (const it of all) {
          it.ring = transformRing(it.ring, 1, x0, y0);
          it.poly = it.poly.map(([x, y]) => [x - x0, y - y0]);
        }
      model.width = x1 - x0;
      model.height = y1 - y0;
      model.editShift = [x0, y0];
      for (const a of model.addBoxes) a.box = [a.box[0] - x0, a.box[1] - y0, a.box[2] - x0, a.box[3] - y0];
    }
  }
  return model;
}

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const area = (p) => {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]);
  return Math.abs(a) / 2;
};

/** (x,y)mm 에 있는 가장 작은 도형(또는 구멍) → {c, i} */
/** 도형 안쪽(구멍 제외)의 한 점 — 다중 선택 후 다시 찾을 때 씀 */
export function innerPoint(model, c, i) {
  const l = model.layers.find((x) => x.color === c);
  const it = l && l.items[i];
  if (!it) return null;
  const polys = [it.poly].concat(it.hole ? [] : l.items.filter((o) => o.hole && o.parent === i).map((o) => o.poly));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of it.poly) (x < x0 && (x0 = x), x > x1 && (x1 = x), y < y0 && (y0 = y), y > y1 && (y1 = y));
  let best = null, bw = -1;
  for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9]) {
    const y = y0 + (y1 - y0) * f, xs = [];
    for (const p of polys) for (let a = 0, b = p.length - 1; a < p.length; b = a++) if (p[a][1] > y !== p[b][1] > y) xs.push(p[b][0] + ((y - p[b][1]) * (p[a][0] - p[b][0])) / (p[a][1] - p[b][1]));
    xs.sort((u, v) => u - v);
    for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > bw) (bw = xs[k + 1] - xs[k]), (best = [(xs[k] + xs[k + 1]) / 2, y]);
    if (bw > (x1 - x0) * 0.2) break;
  }
  return best;
}
export function hitItem(model, x, y) {
  let best = null, ba = Infinity, bestHole = false;
  for (const l of model.layers)
    l.items.forEach((it, i) => {
      if (!inPoly(x, y, it.poly)) return;
      const a = area(it.poly);
      // 가장 작은 면. 넓이가 거의 같으면(다른 색 섬이 구멍을 꼭 채운 경우) 빈 구멍보다 칠해진 면을 고름
      const tie = Math.abs(a - ba) <= ba * 0.01;
      if ((a < ba && !tie) || (tie && bestHole && !it.hole) || (tie && bestHole === it.hole && a < ba)) {
        ba = a;
        best = { c: l.color, i };
        bestHole = !!it.hole;
      }
    });
  return best;
}
