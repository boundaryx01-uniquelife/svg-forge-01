// 3D 출력용 입체 구성: 색 레이어 + 받침판 + 테두리 턱 + 키링 고리
// 좌표: mm, Y 위쪽 (3D 기준). 도형 연산은 Clipper(정수 좌표, 1µm 단위).
import ClipperLib from 'clipper-lib';
import { ShapeUtils, Vector2 } from 'three';

const SC = 1000; // mm → µm
const CT = ClipperLib.ClipType;
const PT = ClipperLib.PolyType;
const PF = ClipperLib.PolyFillType;

const toPath = (poly, H) => poly.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round((H - y) * SC) }));

function clip(type, subj, clp, fill = PF.pftNonZero) {
  const c = new ClipperLib.Clipper();
  if (subj.length) c.AddPaths(subj, PT.ptSubject, true);
  if (clp && clp.length) c.AddPaths(clp, PT.ptClip, true);
  const out = new ClipperLib.Paths();
  c.Execute(type, out, fill, fill);
  return out;
}
const union = (paths, fill = PF.pftNonZero) => clip(CT.ctUnion, paths, [], fill);
const diff = (a, b) => (b.length ? clip(CT.ctDifference, a, b) : a);

function offset(paths, deltaMm) {
  if (!paths.length || !deltaMm) return paths;
  const co = new ClipperLib.ClipperOffset(2, 0.01 * SC);
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, deltaMm * SC);
  return out;
}

/** 닿아 있는 조각 이음매(폭 0 틈·겹친 모서리)를 없앰: 2µm 키웠다 줄이기 (모서리는 각지게 유지) */
function heal(paths) {
  if (!paths.length) return paths;
  const run = (ps, d) => {
    const co = new ClipperLib.ClipperOffset(4, 0.01 * SC);
    co.AddPaths(ps, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    const out = new ClipperLib.Paths();
    co.Execute(out, d);
    return out;
  };
  return run(run(paths, 2), -2);
}

function circle(cx, cy, r, tol = 0.01) {
  const n = Math.max(24, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - tol / Math.max(r, 1e-3)))));
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    p.push({ X: Math.round((cx + r * Math.cos(a)) * SC), Y: Math.round((cy + r * Math.sin(a)) * SC) });
  }
  return [p];
}

function bbox(paths) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of paths) for (const q of p) {
    if (q.X < x0) x0 = q.X;
    if (q.Y < y0) y0 = q.Y;
    if (q.X > x1) x1 = q.X;
    if (q.Y > y1) y1 = q.Y;
  }
  return [x0 / SC, y0 / SC, x1 / SC, y1 / SC];
}

/** 경로들 → [{outer, holes}] (섬은 따로 outer로) — mm 좌표 [[x,y],...] */
function toShapes(paths) {
  const c = new ClipperLib.Clipper();
  c.StrictlySimple = true; // 구멍이 외곽에 한 점으로 닿는 경우 등 → 삼각분할이 깨지지 않게 분리
  c.AddPaths(paths, PT.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(CT.ctUnion, tree, PF.pftNonZero, PF.pftNonZero);
  const shapes = [];
  const conv = (ct) => ct.map((q) => [q.X / SC, q.Y / SC]);
  const walk = (node) => {
    for (const ch of node.Childs()) {
      if (!ch.IsHole()) {
        const s = { outer: conv(ch.Contour()), holes: [] };
        for (const h of ch.Childs()) {
          s.holes.push(conv(h.Contour()));
          walk(h); // 구멍 안의 섬
        }
        shapes.push(s);
      }
    }
  };
  walk(tree);
  return shapes;
}

/** 외곽선만 (구멍 메움) */
function outersOnly(paths) {
  return union(toShapes(paths).map((s) => s.outer.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }))));
}

/** 수직선 x에서 도형의 가장 위 y (없으면 null) */
function topAtX(paths, x) {
  let best = null;
  for (const p of paths) for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const ax = a.X / SC, bx = b.X / SC;
    if ((ax - x) * (bx - x) > 0 || ax === bx) continue;
    const t = (x - ax) / (bx - ax);
    const y = (a.Y + (b.Y - a.Y) * t) / SC;
    if (best === null || y > best) best = y;
  }
  return best;
}
function extremeAlong(paths, d) {
  let best = null, bv = -Infinity;
  for (const p of paths) for (const q of p) {
    const v = (q.X / SC) * d[0] + (q.Y / SC) * d[1];
    if (v > bv) {
      bv = v;
      best = [q.X / SC, q.Y / SC];
    }
  }
  return best;
}
function sideAtY(paths, y, sign) {
  let best = null;
  for (const p of paths) for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const ay = a.Y / SC, by = b.Y / SC;
    if ((ay - y) * (by - y) > 0 || ay === by) continue;
    const t = (y - ay) / (by - ay);
    const x = (a.X + (b.X - a.X) * t) / SC;
    if (best === null || x * sign > best * sign) best = x;
  }
  return best;
}

// ---------- 받침판 모양 ----------
const area = (paths) => paths.reduce((a, p) => a + ClipperLib.Clipper.Area(p), 0) / (SC * SC);
const regular = (n, rot) => Array.from({ length: n }, (_, i) => {
  const a = rot + (2 * Math.PI * i) / n;
  return [Math.cos(a), Math.sin(a)];
});
const U = 10000; // 단위 도형 정수 배율
const toU = (poly) => poly.map(([x, y]) => ({ X: Math.round(x * U), Y: Math.round(y * U) }));
const circU = (cx, cy, r, n = 72) => toU(regular(n, 0).map(([x, y]) => [cx + x * r, cy + y * r]));
const unitCache = new Map();
/** 모양 → 단위 도형(정수 U 배율, 중심 0, 반지름 약 1, Y 위) */
function unitShape(kind, custom) {
  if (kind === 'custom') {
    if (!custom || !custom.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of custom) for (const [x, y] of p) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = 2 / Math.max(x1 - x0, y1 - y0, 1e-9);
    return outersOnly(union(custom.map((p) => toU(p.map(([x, y]) => [(x - cx) * k, (y - cy) * k]))), PF.pftEvenOdd)); // 실루엣만
  }
  if (unitCache.has(kind)) return unitCache.get(kind);
  let paths;
  switch (kind) {
    case 'ellipse': paths = [circU(0, 0, 1, 144)]; break;
    case 'triangle': paths = [toU(regular(3, Math.PI / 2))]; break;
    case 'pentagon': paths = [toU(regular(5, Math.PI / 2))]; break;
    case 'hexagon': paths = [toU(regular(6, 0))]; break;
    case 'octagon': paths = [toU(regular(8, Math.PI / 8))]; break;
    case 'star': paths = [toU(regular(10, Math.PI / 2).map(([x, y], i) => (i % 2 ? [x * 0.5, y * 0.5] : [x, y])))]; break;
    case 'heart': {
      const pts = [];
      for (let i = 0; i < 160; i++) {
        const t = (2 * Math.PI * i) / 160;
        pts.push([(16 * Math.sin(t) ** 3) / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 2) / 17]);
      }
      paths = [toU(pts)];
      break;
    }
    case 'cloud': {
      const cs = [circU(0, -0.05, 0.62), circU(-0.55, -0.12, 0.42), circU(0.55, -0.12, 0.42), circU(-0.25, 0.28, 0.45), circU(0.28, 0.3, 0.5), circU(-0.8, -0.3, 0.28), circU(0.82, -0.3, 0.28)];
      paths = union(cs.concat([toU([[-0.85, -0.58], [0.85, -0.58], [0.85, -0.2], [-0.85, -0.2]])]));
      break;
    }
    case 'flower': {
      const cs = [circU(0, 0, 0.78)];
      for (let i = 0; i < 10; i++) {
        const a = (2 * Math.PI * i) / 10 + Math.PI / 2;
        cs.push(circU(0.78 * Math.cos(a), 0.78 * Math.sin(a), 0.24));
      }
      paths = union(cs);
      break;
    }
    case 'shield': {
      const side = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24; // (0.85,0.15) → 제어점 (0.85,-0.55) → (0,-1)
        side.push([(1 - t) ** 2 * 0.85 + 2 * (1 - t) * t * 0.85, (1 - t) ** 2 * 0.15 + 2 * (1 - t) * t * -0.55 + t * t * -1]);
      }
      const pts = [[-0.85, 0.85], [0.85, 0.85]].concat(side, side.slice(0, -1).reverse().map(([x, y]) => [-x, y]));
      paths = [toU(pts)];
      break;
    }
    default: return null;
  }
  unitCache.set(kind, paths);
  return paths;
}
const place = (unit, s, ax, cx, cy) => unit.map((p) => p.map((q) => ({ X: Math.round(((q.X / U) * s * ax + cx) * SC), Y: Math.round(((q.Y / U) * s + cy) * SC) })));
const fitCache = new Map();
/** content(여백 포함 도형)를 모두 덮는 가장 작은 모양 (필요하면 세로 위치도 조정) */
function fitShape(unit, content, stretch, key) {
  const ck = key + '|' + stretch + '|' + content.length + '|' + area(content).toFixed(3) + '|' + bbox(content).map((v) => v.toFixed(3)).join(',');
  if (fitCache.has(ck)) return fitCache.get(ck);
  const [x0, y0, x1, y1] = bbox(content);
  const bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const [u0, v0, u1, v1] = bbox(unit).map((v) => (v * SC) / U);
  const ax = stretch ? bw / Math.max(bh, 1e-6) / ((u1 - u0) / Math.max(v1 - v0, 1e-6)) : 1;
  const simple = ClipperLib.Clipper.CleanPolygons(content, 0.02 * SC);
  const covers = (s, dy) => area(diff(simple, place(unit, s, ax, cx, cy + dy * s))) < 0.02;
  let best = null;
  const diag = Math.hypot(bw, bh) + 1;
  for (let f = -0.45; f <= 0.451; f += 0.05) {
    let hi = diag / Math.min(1, ax);
    let k = 0;
    while (!covers(hi, f) && k++ < 8) hi *= 2;
    if (!covers(hi, f)) continue;
    let lo = 0;
    if (best) {
      if (!covers(best.s * 0.999, f)) continue;
      hi = best.s;
    }
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (covers(mid, f)) hi = mid;
      else lo = mid;
    }
    best = { s: hi, f };
  }
  const out = best ? place(unit, best.s, ax, cx, cy + best.f * best.s) : content;
  if (fitCache.size > 40) fitCache.clear();
  fitCache.set(ck, out);
  return out;
}

/**
 * model: makeModel 결과 (mm, Y 아래 방향)
 * o: { thickness, step,
 *      base: { on, shape: 'outline'|'rect'|'circle', margin, height, color },
 *      border: { on, width, height },
 *      ring: { on, pos: 'top'|'topleft'|'topright'|'left'|'right', outer, hole } }
 * 반환: { parts: [{ name, color, shapes, z0, z1 }], info }
 */
export function buildParts(model, o) {
  const H = model.height;
  const thickness = Math.max(0.2, o.thickness || 3);
  const step = Math.max(0, o.step || 0);
  const base = o.base || {};
  const border = o.border || {};
  const ring = o.ring || {};
  let layerPaths = model.layers.map((l) => heal(union(l.items.map((it) => toPath(it.poly, H)), PF.pftEvenOdd)));
  const all = union(layerPaths.flat());
  const info = {};
  if (!all.length) return { parts: [], info };

  const z0 = base.on ? Math.max(0.2, base.height || 1.5) : 0;
  let basePaths = null;
  if (base.on) {
    const m = Math.max(0, base.margin || 0);
    const [x0, y0, x1, y1] = bbox(all);
    if (base.shape === 'rect') {
      const r = Math.min(3, Math.max(0.5, m));
      const rx0 = x0 - m + r, ry0 = y0 - m + r, rx1 = x1 + m - r, ry1 = y1 + m - r;
      const rect = [[{ X: rx0 * SC, Y: ry0 * SC }, { X: rx1 * SC, Y: ry0 * SC }, { X: rx1 * SC, Y: ry1 * SC }, { X: rx0 * SC, Y: ry1 * SC }].map((q) => ({ X: Math.round(q.X), Y: Math.round(q.Y) }))];
      basePaths = offset(rect, r);
    } else if (base.shape === 'square') {
      basePaths = [[[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]].map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }))];
    } else if (unitShape(base.shape, base.custom)) {
      const content = m > 0 ? offset(outersOnly(all), m) : outersOnly(all);
      const unit = unitShape(base.shape, base.custom);
      basePaths = fitShape(unit, content, base.shape === 'ellipse' || !!base.stretch, base.shape + (base.shape === 'custom' ? ':' + (base.customKey || '') : ''));
    } else if (base.shape === 'circle') {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      let rr = 0;
      for (const p of all) for (const q of p) rr = Math.max(rr, Math.hypot(q.X / SC - cx, q.Y / SC - cy));
      basePaths = circle(cx, cy, rr + m);
    } else {
      // 외곽 따라: 여백만큼 키운 뒤, '메움' 반경으로 닫힘 연산(키웠다 줄이기) → 글자 사이·u 안쪽 같은 오목한 홈을 매끈하게 메움
      const k = Math.max(0, base.fill == null ? 3 : base.fill);
      basePaths = outersOnly(all);
      if (m + k > 0) basePaths = offset(basePaths, m + k);
      if (k > 0) basePaths = outersOnly(offset(basePaths, -k));
    }
    // 글자 안 구멍(o·e 등의 안쪽 공간)을 받침판에서도 뚫기
    if (base.cutHoles) {
      const counters = diff(outersOnly(all), all).filter((p) => Math.abs(ClipperLib.Clipper.Area(p)) > 0.5 * SC * SC);
      if (counters.length) basePaths = diff(basePaths, counters);
    }
  }

  const textMode = base.on ? o.textMode || 'emboss' : 'emboss';
  // 키링 고리 (type 'hole': 몸체에 구멍만 뚫기)
  let holeDisk = null;
  let ringPart = null;
  if (ring.on && ring.type === 'hole') {
    const R = Math.max(0.5, (ring.hole || 4) / 2);
    const wall = Math.max(0.8, ((ring.outer || 8) - (ring.hole || 4)) / 2);
    const target = basePaths || all;
    const [x0, y0, x1, y1] = bbox(target);
    const inset = R + wall;
    let c;
    if (ring.pos === 'left' || ring.pos === 'right') {
      const y = (y0 + y1) / 2;
      const sgn = ring.pos === 'left' ? -1 : 1;
      const xe = sideAtY(target, y, sgn);
      c = [(xe === null ? (sgn < 0 ? x0 : x1) : xe) - sgn * inset, y];
    } else if (ring.pos === 'topleft' || ring.pos === 'topright') {
      const d = ring.pos === 'topleft' ? [-Math.SQRT1_2, Math.SQRT1_2] : [Math.SQRT1_2, Math.SQRT1_2];
      const p = extremeAlong(target, d);
      c = [p[0] - d[0] * inset * 1.25, p[1] - d[1] * inset * 1.25];
    } else {
      const x = (x0 + x1) / 2;
      const yt = topAtX(target, x);
      c = [x, (yt === null ? y1 : yt) - inset];
    }
    const auto = c.slice();
    c = [c[0] + (ring.dx || 0), c[1] + (ring.dy || 0)];
    holeDisk = circle(c[0], c[1], R);
    const out = area(diff(circle(c[0], c[1], R + wall * 0.6), offset(target, 0.01)));
    info.ring = { type: 'hole', center: c, auto, outer: 2 * (R + wall), hole: 2 * R, attached: out < 0.05, touchArea: 0, z: base.on ? z0 : thickness };
    if (basePaths) basePaths = diff(basePaths, holeDisk);
    layerPaths = layerPaths.map((lp) => diff(lp, holeDisk));
  } else if (ring.on) {
    const R = Math.max(1, (ring.outer || 8) / 2);
    const r = Math.min(R - 0.6, Math.max(0.5, (ring.hole || 4) / 2));
    const target = basePaths || all;
    const [x0, y0, x1, y1] = bbox(target);
    const gap = r + (R - r) * 0.5; // 고리 중심 ~ 도형 가장자리 거리 (겹침 = (R-r)/2)
    let c;
    if (ring.pos === 'left' || ring.pos === 'right') {
      const y = (y0 + y1) / 2;
      const sgn = ring.pos === 'left' ? -1 : 1;
      const xe = sideAtY(target, y, sgn);
      c = [(xe === null ? (sgn < 0 ? x0 : x1) : xe) + sgn * gap, y];
    } else if (ring.pos === 'topleft' || ring.pos === 'topright') {
      const d = ring.pos === 'topleft' ? [-Math.SQRT1_2, Math.SQRT1_2] : [Math.SQRT1_2, Math.SQRT1_2];
      const p = extremeAlong(target, d);
      c = [p[0] + d[0] * gap, p[1] + d[1] * gap];
    } else {
      const x = (x0 + x1) / 2;
      const yt = topAtX(target, x);
      c = [x, (yt === null ? y1 : yt) + gap];
    }
    const auto = c.slice();
    c = [c[0] + (ring.dx || 0), c[1] + (ring.dy || 0)];
    const disk = circle(c[0], c[1], R);
    holeDisk = circle(c[0], c[1], r);
    // 고리 몸통(구멍 제외)이 도형과 겹치는 면적 → 0이면 떨어져 있음
    const touch = clip(CT.ctIntersection, diff(disk, holeDisk), offset(target, 0.05));
    const touchArea = touch.reduce((a, p) => a + Math.abs(ClipperLib.Clipper.Area(p)), 0) / (SC * SC);
    info.ring = { center: c, auto, outer: 2 * R, hole: 2 * r, attached: touchArea > 0.3, touchArea, z: base.on ? z0 : thickness };
    if (basePaths) basePaths = diff(union(basePaths.concat(disk)), holeDisk);
    else {
      const rp = diff(diff(disk, holeDisk), all);
      if (rp.length) ringPart = rp;
    }
    layerPaths = layerPaths.map((lp) => diff(lp, holeDisk));
  }

  const edge = o.edge || {};
  const bev = (flag) => (edge.type && edge.type !== 'none' && flag && edge.size > 0 ? { type: edge.type, size: edge.size } : null);
  const parts = [];
  const add = (name, color, paths, z0_, z1_, role, bevel) => {
    if (!paths.length) return;
    parts.push({ name, color, paths, shapes: toShapes(paths), z0: z0_, z1: z1_, role, bevel });
  };
  const allText = union(layerPaths.flat());
  if (basePaths && textMode === 'through') {
    basePaths = diff(basePaths, allText);
    const pieces = toShapes(basePaths).length;
    if (pieces > 1) info.loose = pieces - 1; // 글자 안쪽(o·e)처럼 떨어져 나가는 조각
  }
  if (basePaths) {
    const hasBorder = border.on;
    const baseTop = textMode === 'engrave' ? diff(basePaths, allText) : basePaths;
    // 테두리 턱이 있으면 받침판 윗면 대신 턱 윗면을 다듬음
    add('받침판', base.color || '#ffffff', baseTop, 0, z0, 'base', hasBorder ? null : bev(edge.onBase));
    if (hasBorder) {
      const w = Math.max(0.4, border.width || 1.2);
      let rim = diff(basePaths, offset(basePaths, -w));
      rim = diff(rim, union(layerPaths.flat()));
      add('테두리', base.color || '#ffffff', rim, z0, z0 + Math.max(0.2, border.height || 1), 'border', bev(edge.onBase));
    }
  }
  model.layers.forEach((l, i) => {
    // 색별 높이차: offsets[i]가 있으면 그 값(음수 가능), 없으면 계단식 step. 최소 두께 0.2mm
    const off = o.offsets && o.offsets[i] != null ? o.offsets[i] : i * step;
    const h = Math.max(0.2, thickness + off);
    if (textMode === 'through') return;
    if (textMode === 'engrave') {
      // 새김: 두께(+색별 높이차) = 파는 깊이. 파인 바닥은 글자 색으로 (다색 출력 시 홈 바닥이 그 색)
      const floor = Math.max(0.2, z0 - h);
      if (z0 - h < 0.2) info.depthClamped = true;
      add(`색 ${i + 1} ${l.color}`, l.color, clip(CT.ctIntersection, layerPaths[i], basePaths), 0, floor, 'color', null);
      return;
    }
    add(`색 ${i + 1} ${l.color}`, l.color, layerPaths[i], z0, z0 + h, 'color', bev(edge.onColor));
  });
  if (ringPart) {
    const c0 = model.layers[0] ? model.layers[0].color : '#000000';
    add('키링 고리', c0, ringPart, 0, thickness, 'ring', bev(edge.onColor));
  }
  // 모서리 다듬기가 실제로 먹는 최대치 (입력 칸 제한용)
  const bevParts = parts.filter((p) => p.bevel);
  if (bevParts.length) info.bevelMax = Math.max(...bevParts.map((p) => bevelLimit(p.paths, p.z1 - p.z0)));
  const bb = bbox(parts.flatMap((p) => p.shapes.map((s) => s.outer.map(([x, y]) => ({ X: x * SC, Y: y * SC })))));
  info.size = [bb[2] - bb[0], bb[3] - bb[1], Math.max(...parts.map((p) => p.z1))];
  info.bbox = bb;
  return { parts, info };
}

// ---------- 모따기·모깎기: 윗모서리를 층층이 안쪽으로 줄여 쌓은 하나의 닫힌 메시 ----------

/** 정수 경로 → 윤곽 트리 (공선점 보존: 벽과 뚜껑의 꼭짓점이 정확히 일치해야 닫힌 메시가 됨) */
function treeShapes(paths, fill) {
  const c = new ClipperLib.Clipper();
  c.PreserveCollinear = false; // 벽·뚜껑 모두 같은 규칙으로 일직선 점 제거 → 꼭짓점 일치
  c.AddPaths(paths, PT.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(CT.ctUnion, tree, fill, fill);
  const out = [];
  const walk = (node) => {
    for (const ch of node.Childs()) {
      if (!ch.IsHole()) {
        const s = { outer: ch.Contour(), holes: [] };
        for (const h of ch.Childs()) {
          s.holes.push(h.Contour());
          walk(h);
        }
        out.push(s);
      }
    }
  };
  walk(tree);
  return out;
}
function allContours(paths) {
  const out = [];
  for (const s of treeShapes(paths, PF.pftNonZero)) {
    out.push(s.outer);
    for (const h of s.holes) out.push(h);
  }
  return out;
}

/**
 * paths: 정수 경로(파트 영역), z0~z1, bevel: {type:'chamfer'|'fillet', size}
 * 반환: 삼각형 좌표 배열 Float32Array (비색인, 법선은 바깥쪽)
 */
export function beveledSolid(paths, z0, z1, bevel) {
  if (!bevel || bevel.size <= 0.01) return beveledOne(paths, z0, z1, bevel || { type: 'chamfer', size: 0.001 });
  // 조각(글자 획 등)마다 깎을 수 있는 최대치까지만: 넘치면 더 변하지 않고 높이도 그대로
  const parts = [];
  let total = 0;
  for (const comp of components(paths)) {
    const sz = Math.min(bevel.size, maxInset(comp) * 0.97);
    const pos = beveledOne(comp, z0, z1, { type: bevel.type, size: Math.max(0.001, sz) });
    parts.push(pos);
    total += pos.length;
  }
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
/** 서로 떨어진 조각별 경로 (구멍 포함) */
function components(paths) {
  return treeShapes(paths, PF.pftNonZero).map((s) => [s.outer, ...s.holes]);
}
const insetCache = new Map();
/** 안쪽으로 줄여서 사라지기 직전 거리 (mm) = 깎을 수 있는 최대치 */
function maxInset(comp) {
  const [x0, y0, x1, y1] = bbox(comp);
  const key = comp.length + '|' + area(comp).toFixed(4) + '|' + [x0, y0, x1, y1].map((v) => v.toFixed(3)).join(',');
  if (insetCache.has(key)) return insetCache.get(key);
  let lo = 0, hi = Math.min(x1 - x0, y1 - y0) / 2 + 0.01;
  for (let i = 0; i < 13; i++) {
    const mid = (lo + hi) / 2;
    if (area(offset(comp, -mid)) > 1e-4) lo = mid;
    else hi = mid;
  }
  if (insetCache.size > 3000) insetCache.clear();
  insetCache.set(key, lo);
  return lo;
}
/** 파트 모서리 다듬기의 실제 최대치 (이보다 크게 해도 변화 없음) */
export function bevelLimit(paths, h) {
  let m = 0;
  for (const comp of components(paths)) m = Math.max(m, maxInset(comp) * 0.97);
  return Math.min(m, h * 0.95);
}

function beveledOne(paths, z0, z1, bevel) {
  const h = z1 - z0;
  const sz = Math.min(bevel.size, h * 0.95);
  const zb = z1 - sz;
  const N = Math.max(2, Math.min(24, Math.ceil(sz / 0.08)));
  // 층: [윗면 z, 안쪽 거리 d]
  const levels = [{ z: zb, d: 0 }];
  for (let k = 1; k <= N; k++) {
    const tm = (sz * (k - 0.5)) / N;
    const d = bevel.type === 'chamfer' ? tm : sz - Math.sqrt(Math.max(0, sz * sz - tm * tm));
    const zt = zb + (sz * k) / N;
    const last = levels[levels.length - 1];
    if (d - last.d < 0.02) last.z = zt; // 변화가 너무 작으면 앞 층에 합침
    else levels.push({ z: zt, d });
  }
  // 층별 영역 (0층은 원래 영역을 공선점 보존 형태로 정리)
  const A = [];
  for (const L of levels) {
    const reg = L.d === 0 ? union(allContours(paths)) : offset(paths, -L.d);
    const cont = allContours(reg);
    if (!cont.length) break;
    A.push({ z: L.z, cont });
  }
  if (!A.length) return new Float32Array(0);
  A[A.length - 1].z = z1;

  // 정점표(정수 X,Y + 높이) — 같은 좌표는 같은 번호
  const verts = [];
  const vmap = new Map();
  const vid = (q, z) => {
    const k = q.X + ',' + q.Y + ',' + z;
    let i = vmap.get(k);
    if (i === undefined) {
      i = verts.length;
      verts.push([q.X, q.Y, z]);
      vmap.set(k, i);
    }
    return i;
  };
  const T = [];
  const area2 = (a, b, c) => (b.X - a.X) * (c.Y - a.Y) - (b.Y - a.Y) * (c.X - a.X);
  const cap = (contours, z, up) => {
    for (const s of treeShapes(contours, PF.pftEvenOdd)) {
      const outer = s.outer.map((q) => new Vector2(q.X, q.Y));
      const holes = s.holes.map((hh) => hh.map((q) => new Vector2(q.X, q.Y)));
      const pts = s.outer.concat(...s.holes);
      const faces = ShapeUtils.triangulateShape(outer, holes);
      for (const [i, j, k] of faces) {
        let a = pts[i], b = pts[j], c = pts[k];
        const ar = area2(a, b, c);
        if (ar === 0) continue;
        if (ar > 0 !== up) [b, c] = [c, b];
        T.push([vid(a, z), vid(b, z), vid(c, z)]);
      }
    }
  };
  cap(A[0].cont, z0, false);
  let zPrev = z0;
  for (let k = 0; k < A.length; k++) {
    const { z, cont } = A[k];
    for (const c of cont) {
      const n = c.length;
      for (let i = 0; i < n; i++) {
        const p = c[i], q = c[(i + 1) % n];
        const a = vid(p, zPrev), b = vid(q, zPrev), cc = vid(q, z), d = vid(p, z);
        T.push([a, b, cc], [a, cc, d]);
      }
    }
    const nextCont = k + 1 < A.length ? A[k + 1].cont : [];
    cap(cont.concat(nextCont), z, true);
    zPrev = z;
  }
  repairTJunctions(T, verts);
  const out = new Float32Array(T.length * 9);
  let o = 0;
  for (const t of T) for (const i of t) {
    const v = verts[i];
    out[o++] = v[0] / SC;
    out[o++] = v[1] / SC;
    out[o++] = v[2];
  }
  return out;
}

/** 열린 모서리 위에 다른 정점이 놓인 경우(T자 이음) 삼각형을 나눠 닫는다 (정수 좌표로 정확히 판정) */
function repairTJunctions(T, verts) {
  for (let pass = 0; pass < 4; pass++) {
    const cnt = new Map();
    const key = (a, b) => (a < b ? a + ':' + b : b + ':' + a);
    for (const t of T) for (let e = 0; e < 3; e++) {
      const k = key(t[e], t[(e + 1) % 3]);
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    const open = new Set();
    for (const t of T) for (let e = 0; e < 3; e++) if (cnt.get(key(t[e], t[(e + 1) % 3])) === 1) {
      open.add(t[e]);
      open.add(t[(e + 1) % 3]);
    }
    if (!open.size) return;
    const openList = [...open];
    let changed = false;
    for (let ti = 0; ti < T.length; ti++) {
      const t = T[ti];
      for (let e = 0; e < 3; e++) {
        const a = t[e], b = t[(e + 1) % 3], c = t[(e + 2) % 3];
        if (cnt.get(key(a, b)) !== 1) continue;
        const A = verts[a], B = verts[b];
        const on = [];
        for (const w of openList) {
          if (w === a || w === b) continue;
          const W = verts[w];
          // 같은 선분 위 (정수 외적 0, 사이에 있음). 높이도 선형으로 맞아야 함
          const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
          const wx = W[0] - A[0], wy = W[1] - A[1], wz = W[2] - A[2];
          if (dx * wy - dy * wx !== 0) continue;
          const L2 = dx * dx + dy * dy;
          let tt;
          if (L2 > 0) tt = (wx * dx + wy * dy) / L2;
          else if (dz !== 0) tt = wz / dz;
          else continue;
          if (!(tt > 1e-9 && tt < 1 - 1e-9)) continue;
          if (Math.abs(A[2] + dz * tt - W[2]) > 1e-9) continue;
          if (L2 === 0 && (wx !== 0 || wy !== 0)) continue;
          on.push([tt, w]);
        }
        if (!on.length) continue;
        on.sort((p, q) => p[0] - q[0]);
        const chain = [a, ...on.map((x) => x[1]), b];
        const fan = [];
        for (let i = 0; i + 1 < chain.length; i++) fan.push([chain[i], chain[i + 1], c]);
        T.splice(ti, 1, ...fan);
        ti += fan.length - 1;
        changed = true;
        break;
      }
    }
    if (!changed) return;
  }
}
