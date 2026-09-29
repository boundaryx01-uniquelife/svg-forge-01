// 3D 출력용 입체 구성: 색 레이어 + 받침판 + 테두리 턱 + 키링 고리
// 좌표: mm, Y 위쪽 (3D 기준). 도형 연산은 Clipper(정수 좌표, 1µm 단위).
import ClipperLib from 'clipper-lib';

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
  let layerPaths = model.layers.map((l) => union(l.items.map((it) => toPath(it.poly, H)), PF.pftEvenOdd));
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

  // 키링 고리
  let holeDisk = null;
  let ringPart = null;
  if (ring.on) {
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
    const disk = circle(c[0], c[1], R);
    holeDisk = circle(c[0], c[1], r);
    info.ring = { center: c, outer: 2 * R, hole: 2 * r };
    if (basePaths) basePaths = diff(union(basePaths.concat(disk)), holeDisk);
    else {
      const rp = diff(diff(disk, holeDisk), all);
      if (rp.length) ringPart = rp;
    }
    layerPaths = layerPaths.map((lp) => diff(lp, holeDisk));
  }

  const parts = [];
  if (basePaths) {
    parts.push({ name: '받침판', color: base.color || '#ffffff', shapes: toShapes(basePaths), z0: 0, z1: z0, role: 'base' });
    if (border.on) {
      const w = Math.max(0.4, border.width || 1.2);
      let rim = diff(basePaths, offset(basePaths, -w));
      rim = diff(rim, union(layerPaths.flat()));
      if (rim.length) parts.push({ name: '테두리', color: base.color || '#ffffff', shapes: toShapes(rim), z0, z1: z0 + Math.max(0.2, border.height || 1), role: 'border' });
    }
  }
  model.layers.forEach((l, i) => {
    if (!layerPaths[i].length) return;
    parts.push({ name: `색 ${i + 1} ${l.color}`, color: l.color, shapes: toShapes(layerPaths[i]), z0, z1: z0 + thickness + i * step, role: 'color' });
  });
  if (ringPart) {
    const c0 = model.layers[0] ? model.layers[0].color : '#000000';
    parts.push({ name: '키링 고리', color: c0, shapes: toShapes(ringPart), z0: 0, z1: thickness, role: 'ring' });
  }
  const bb = bbox(parts.flatMap((p) => p.shapes.map((s) => s.outer.map(([x, y]) => ({ X: x * SC, Y: y * SC })))));
  info.size = [bb[2] - bb[0], bb[3] - bb[1], Math.max(...parts.map((p) => p.z1))];
  info.bbox = bb;
  return { parts, info };
}
