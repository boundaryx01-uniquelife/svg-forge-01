// 몰드·패턴 모드: 실루엣 → 외곽 벽 + 내부 패턴
// 좌표: 모델과 같은 mm 공간(Y 뒤집지 않음). 도형 연산은 Clipper(1µm 정수).
//
// 흐름:  실루엣 ─┬─ 바깥 띠(벽)
//                └─ 안쪽 영역 ∩ 패턴  →  둘을 union (겹침 overlap 만큼 물려서 붙임)
//
// 패턴은 전부 "닫힌 폴리곤 목록"으로만 만든다. 직선 계열은 선을 그려 오프셋하지 않고
// 처음부터 가느다란 사각형을 늘어놓는다 → 오프셋에서 생기는 모서리·자기교차 문제가 없음.
import ClipperLib from 'clipper-lib';
import { buildItems, closeRing } from './geom.js';

const SC = 1000; // mm → µm
const CT = ClipperLib.ClipType;
const PT = ClipperLib.PolyType;
const PF = ClipperLib.PolyFillType;

const toPath = (poly) => poly.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }));
const toRing = (path) => closeRing(path.map((q, i) => [i ? 'L' : 'M', q.X / SC, q.Y / SC]));

function clip(type, subj, clp, fill = PF.pftNonZero) {
  const c = new ClipperLib.Clipper();
  if (subj && subj.length) c.AddPaths(subj, PT.ptSubject, true);
  if (clp && clp.length) c.AddPaths(clp, PT.ptClip, true);
  const out = new ClipperLib.Paths();
  c.Execute(type, out, fill, fill);
  return out;
}
const union = (paths, fill = PF.pftNonZero) => clip(CT.ctUnion, paths, [], fill);
const diff = (a, b) => (b && b.length ? clip(CT.ctDifference, a, b) : a);
const inter = (a, b) => (a.length && b.length ? clip(CT.ctIntersection, a, b) : []);

function offset(paths, deltaMm) {
  if (!paths.length || !deltaMm) return paths;
  const co = new ClipperLib.ClipperOffset(2, 0.01 * SC);
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, deltaMm * SC);
  return out;
}

const bboxOf = (paths) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of paths) for (const q of p) {
    const x = q.X / SC, y = q.Y / SC;
    if (x < x0) x0 = x; if (y < y0) y0 = y;
    if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
};

/* ───────────────────────── 패턴 원시 도형 ───────────────────────── */

/** 중심 c, 각도 a(rad)로 회전한 길이 len · 폭 w 짜리 막대 하나 */
function bar(cx, cy, a, len, w) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const hx = (len / 2) * ca, hy = (len / 2) * sa;      // 길이 방향 절반
  const nx = (w / 2) * -sa, ny = (w / 2) * ca;         // 폭 방향 절반
  return [
    [cx - hx + nx, cy - hy + ny],
    [cx + hx + nx, cy + hy + ny],
    [cx + hx - nx, cy + hy - ny],
    [cx - hx - nx, cy - hy - ny],
  ];
}

/** 한 방향 빗금: bbox를 덮도록 각도 a로 간격 pitch, 폭 w 막대를 늘어놓음 */
function hatchBars(bb, a, pitch, w) {
  const [x0, y0, x1, y1] = bb;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const len = Math.hypot(x1 - x0, y1 - y0) * 1.2 + pitch * 2; // 회전해도 덮이도록 여유
  const n = Math.ceil(len / pitch) + 2;
  const nx = -Math.sin(a), ny = Math.cos(a); // 막대를 밀어낼 수직 방향
  const out = [];
  for (let i = -n; i <= n; i++) {
    const d = i * pitch;
    out.push(bar(cx + nx * d, cy + ny * d, a, len, w));
  }
  return out;
}

/** 정n각형 (반지름 r, 첫 꼭짓점 각도 a0) */
function ngon(cx, cy, r, sides, a0 = -Math.PI / 2) {
  const p = [];
  for (let i = 0; i < sides; i++) {
    const t = a0 + (i * 2 * Math.PI) / sides;
    p.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return p;
}

/** 동심 n각형 고리들 (바깥 − 안쪽). rMin 안쪽은 비워 둠 — 안 그러면 중심에 덩어리가 생김 */
function ringBands(cx, cy, rMax, pitch, w, sides, a0, rMin = 0) {
  const out = [];
  for (let r = rMax; r > Math.max(w, rMin); r -= pitch) {
    const o = union([toPath(ngon(cx, cy, r, sides, a0))]);
    const i = union([toPath(ngon(cx, cy, r - w, sides, a0))]);
    for (const p of diff(o, i)) out.push(p);
  }
  return out; // 이미 Clipper path
}

/* ───────────────────────── 패턴 생성기 ─────────────────────────
 * 모두 같은 모양: pattern(kind, bbox, opts) → Clipper paths
 * opts: { width, pitch, angle, spokes, center }
 */
export const PATTERNS = [
  { id: 'grid', name: '격자' },
  { id: 'hatch', name: '빗금' },
  { id: 'tri', name: '삼각 격자' },
  { id: 'rings', name: '동심원' },
  { id: 'spokes', name: '방사선' },
  { id: 'web', name: '거미줄' },
];

export function patternPaths(kind, bb, o = {}) {
  const w = Math.max(0.1, o.width ?? 1.0);
  const pitch = Math.max(w + 0.1, o.pitch ?? 4);
  const a = ((o.angle ?? 0) * Math.PI) / 180;
  const [x0, y0, x1, y1] = bb;
  const cx = o.center ? o.center[0] : (x0 + x1) / 2;
  const cy = o.center ? o.center[1] : (y0 + y1) / 2;
  const rMax = Math.hypot(x1 - x0, y1 - y0) / 2 + pitch;
  const nSp = Math.max(3, Math.round(o.spokes ?? 12));
  const polys = [];
  const push = (arr) => { for (const p of arr) polys.push(toPath(p)); };

  switch (kind) {
    case 'hatch':
      push(hatchBars(bb, a, pitch, w));
      break;
    case 'grid':
      push(hatchBars(bb, a, pitch, w));
      push(hatchBars(bb, a + Math.PI / 2, pitch, w));
      break;
    case 'tri':
      for (let k = 0; k < 3; k++) push(hatchBars(bb, a + (k * Math.PI) / 3, pitch, w));
      break;
    case 'rings':
      return union(ringBands(cx, cy, rMax, pitch, w, Math.max(16, nSp * 2), a, pitch));
    case 'spokes':
      for (let i = 0; i < nSp; i++) {
        const t = a + (i * Math.PI) / nSp; // 막대는 양방향이므로 180°만 돌면 됨
        polys.push(toPath(bar(cx, cy, t, rMax * 2, w)));
      }
      break;
    case 'web': {
      // 거미줄 = 방사선 + 꼭짓점이 방사선에 맞물린 동심 다각형
      for (let i = 0; i < nSp; i++) {
        const t = a + (i * Math.PI) / nSp;
        polys.push(toPath(bar(cx, cy, t, rMax * 2, w)));
      }
      const bands = ringBands(cx, cy, rMax, pitch, w, nSp * 2, a - Math.PI / 2, pitch * 1.5);
      return union([...polys, ...bands]);
    }
    default:
      push(hatchBars(bb, a, pitch, w));
  }
  return union(polys);
}

/* ───────────────────────── 본체 조립 ───────────────────────── */

/**
 * 실루엣에 외곽 벽 + 내부 패턴을 적용한 모델을 돌려준다.
 * o: { pattern, width, pitch, angle, spokes, wall, overlap, color, center }
 * 반환: { model, info } — info.empty 면 패턴이 하나도 안 남은 것(간격이 너무 넓거나 도형이 작음)
 */
export function applyPattern(model, o = {}) {
  const wall = Math.max(0.4, o.wall ?? 1.6);
  const lw = Math.max(0.1, o.width ?? 1.0);
  const overlap = Math.max(0, o.overlap ?? 0.25);
  const info = { wall, lineWidth: lw, empty: false, noInner: false };

  // 1) 실루엣 = 모든 색 레이어의 합집합 (구멍은 EvenOdd 로 살림)
  const sil = union(
    model.layers.flatMap((l) => l.items.map((it) => toPath(it.poly))),
    PF.pftEvenOdd,
  );
  if (!sil.length) return { model, info: { ...info, empty: true } };

  // 2) 안쪽 영역 = 실루엣을 벽 두께만큼 안으로
  const innerCore = offset(sil, -wall);
  // 패턴이 벽에 물리도록 overlap 만큼 되돌려 확장한 영역에 클립
  const innerClip = innerCore.length ? offset(sil, -(wall - overlap)) : [];
  if (!innerCore.length) info.noInner = true; // 벽만으로 꽉 참 (도형이 얇음)

  // 3) 벽 띠 = 실루엣 − 안쪽
  const band = innerCore.length ? diff(sil, innerCore) : sil;

  // 4) 패턴 → 안쪽 영역과 교집합
  let pat = [];
  if (innerClip.length) {
    const pp = patternPaths(o.pattern || 'web', bboxOf(sil), {
      width: lw, pitch: o.pitch, angle: o.angle, spokes: o.spokes, center: o.center,
    });
    pat = inter(pp, innerClip);
    if (!pat.length) info.empty = true;
  }

  // 5) 벽 ∪ 패턴
  const merged = union([...band, ...pat]);
  const rings = merged.filter((p) => p.length >= 3).map(toRing);
  const items = buildItems(rings, model.tol);

  const color = o.color || (model.layers[0] && model.layers[0].color) || '#000000';
  const out = {
    ...model,
    layers: [{ color, items }],
    ringCount: items.length,
    nodeCount: items.reduce((n, it) => n + it.ring.length, 0),
    moldPattern: true,
  };
  return { model: out, info };
}
