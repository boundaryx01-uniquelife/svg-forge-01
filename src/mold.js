// 몰드·패턴 모드: 실루엣 → 외곽 벽 + 내부 패턴
// 좌표: 모델과 같은 mm 공간(Y 뒤집지 않음). 도형 연산은 Clipper(1µm 정수).
//
// 흐름:  실루엣 ─┬─ 바깥 띠(벽)
//                └─ 안쪽 영역 ∩ 패턴  →  둘을 union (겹침 overlap 만큼 물려서 붙임)
//
// 패턴은 전부 "닫힌 폴리곤 목록"으로만 만든다. 직선 계열은 선을 그려 오프셋하지 않고
// 처음부터 가느다란 사각형을 늘어놓는다 → 오프셋에서 생기는 모서리·자기교차 문제가 없음.
import ClipperLib from 'clipper-lib';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildItems, closeRing } from './geom.js';
import { beveledSolid } from './solid.js';

const SC = 1000; // mm → µm
const CT = ClipperLib.ClipType;
const PT = ClipperLib.PolyType;
const PF = ClipperLib.PolyFillType;

const toPath = (poly) => poly.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }));
// 3D 파트는 solid.js 와 같은 좌표(Y 뒤집기)를 써야 본체와 몰드가 같은 방향으로 놓인다
const toPathH = (poly, H) => poly.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round((H - y) * SC) }));
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

/* ───────────────────────── 음각 몰드 ─────────────────────────
 * 판에 도형을 파낸 형틀. 석고·비누·초콜릿을 부어 굳히는 용도.
 *
 * 빼기 구배는 캐비티를 얇은 층으로 쌓아 만든다(층마다 조금씩 넓힘).
 * 층 두께를 프린터 레이어(0.2mm)보다 얇게 잡으므로 출력물에서는 계단이 보이지 않고,
 * 전용 메셔 없이 검증된 압출 경로만 쓰므로 오목한 도형에서도 깨지지 않는다.
 */

const treeShapes = (paths) => {
  const c = new ClipperLib.Clipper();
  c.StrictlySimple = true;
  c.AddPaths(paths, PT.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(CT.ctUnion, tree, PF.pftNonZero, PF.pftNonZero);
  const out = [];
  const walk = (node, into) => {
    for (const ch of node.Childs()) {
      if (ch.IsHole()) into.holes.push(ch.Contour());
      else {
        const s = { outer: ch.Contour(), holes: [] };
        out.push(s);
        walk(ch, s);
        continue;
      }
      walk(ch, into);
    }
  };
  walk(tree, { holes: [] });
  return out;
};

/** 교집합에서 생기는 실오라기 조각·자기교차 정리 (삼각분할이 깨져 메시에 구멍이 생김) */
function clean(paths, minArea = 0.02) {
  if (!paths.length) return paths;
  const s = ClipperLib.Clipper.SimplifyPolygons(paths, PF.pftNonZero);
  return s.filter((p) => p.length >= 3 && Math.abs(ClipperLib.Clipper.Area(p)) / (SC * SC) >= minArea);
}

/** Clipper paths → 압출 지오메트리 (z0..z1)
 *  solid.js 의 beveledSolid 를 씀: 자체 삼각분할 + T자 이음 보정이라
 *  격자·삼각 무늬처럼 구멍이 많은 도형에서도 닫힌 메시가 나온다. */
function extrude(paths, z0, z1) {
  if (!paths.length || z1 - z0 <= 0.001) return null;
  const pos = beveledSolid(paths, z0, z1, { type: 'chamfer', size: 0.001 });
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

const rectPath = (x0, y0, x1, y1) =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }));

/**
 * 음각 몰드 파트 만들기.
 * o: { clearance, depth, draft, floor, flange, ribs, ribH, color, shiftX }
 * 반환: { parts, info }
 */
export function buildMold(model, o = {}) {
  const clearance = Math.max(0, o.clearance ?? 0.2);
  const depth = Math.max(0.4, o.depth ?? 4);
  const draft = Math.min(20, Math.max(0, o.draft ?? 5));   // °
  const floor = Math.max(0.6, o.floor ?? 2);
  const flange = Math.max(1, o.flange ?? 5);
  const ribH = Math.max(0, o.ribH ?? 0.8);
  const color = o.color || '#9aa7b0';
  const dx = o.shiftX || 0;
  const info = { depth, draft, clearance, steps: 1, warn: null };

  // 실루엣(= 지금 모델 전체) → 여유만큼 넓힌 캐비티 바닥
  const H = model.height;
  const sil = union(model.layers.flatMap((l) => l.items.map((it) => toPathH(it.poly, H))), PF.pftEvenOdd);
  if (!sil.length) return { parts: [], info: { ...info, warn: 'empty' } };
  const cavBase = clearance ? offset(sil, clearance) : sil;

  const [bx0, by0, bx1, by1] = bboxOf(cavBase);
  const plate = [rectPath(bx0 - flange, by0 - flange, bx1 + flange, by1 + flange)];
  const top = floor + depth;

  // 구배: 위로 갈수록 tan(draft)*높이 만큼 넓어짐. 층은 0.15mm 이하(프린터 레이어보다 얇게)
  const grow = Math.tan((draft * Math.PI) / 180) * depth;
  const steps = draft > 0 ? Math.min(60, Math.max(2, Math.ceil(depth / 0.15))) : 1;
  info.steps = steps;

  const geos = [];
  const push = (g) => g && geos.push(g);
  push(extrude(plate, 0, floor)); // 바닥판
  for (let k = 0; k < steps; k++) {
    const z0 = floor + (depth * k) / steps;
    const z1 = floor + (depth * (k + 1)) / steps;
    const d = grow * ((k + 0.5) / steps);          // 이 층에서의 캐비티 확장량
    const cav = d > 0.001 ? offset(cavBase, d) : cavBase;
    const ring = clean(diff(plate, cav), 0.001);     // 판 − 캐비티
    if (!ring.length) { info.warn = 'cavityTooBig'; break; }
    if (k === steps - 1 && diff(cav, plate).length) info.warn = 'cavityOutOfPlate'; // 캐비티가 판 밖으로
    push(extrude(ring, z0, z1));
  }

  // 무늬 리브: 캐비티 바닥에 얕게 솟아 주조물 표면에 무늬가 찍히게
  if (ribH > 0.01 && o.ribs && o.ribs.length) {
    const inner = offset(cavBase, -Math.max(0.4, grow + 0.3)); // 기울어진 벽에 닿지 않게
    const r = clean(inter(o.ribs, inner));
    if (r.length) push(extrude(r, floor, floor + ribH));
    else info.warn = info.warn || 'noRib';
  }

  if (!geos.length) return { parts: [], info: { ...info, warn: 'empty' } };
  let geom = geos.length === 1 ? geos[0] : mergeGeometries(geos);
  geos.forEach((g) => g !== geom && g.dispose());
  if (dx) geom.translate(dx, 0, 0);
  geom.computeVertexNormals();
  info.size = [bx1 - bx0 + flange * 2, by1 - by0 + flange * 2, top];
  info.bbox = [bx0 - flange + dx, by0 - flange, bx1 + flange + dx, by1 + flange];
  return { parts: [{ name: '몰드', color, geom, z0: 0, z1: top, role: 'mold' }], info };
}

/** 패턴 폴리곤만 따로 (몰드 리브용) */
export function patternFor(model, o = {}) {
  const H = model.height;
  const sil = union(model.layers.flatMap((l) => l.items.map((it) => toPathH(it.poly, H))), PF.pftEvenOdd);
  if (!sil.length) return [];
  const pp = patternPaths(o.pattern || 'web', bboxOf(sil), {
    width: o.width, pitch: o.pitch, angle: o.angle, spokes: o.spokes,
  });
  return inter(pp, sil);
}

/* ───────────────────────── 성형 틀 (눌러 볼록하게) ─────────────────────────
 * 평평하게 출력한 본체를 데워서 틀 사이에 끼우고 눌러 돔 모양으로 바꾼다.
 * (원본 영상 방식: 본체 PLA, 틀은 열에 강한 PETG)
 *
 *   수틀 ── 볼록한 돔 (구면). 본체를 이 위에 올림
 *   암틀 ── 같은 돔을 '간격'만큼 넓힌 오목한 그릇. 뒤집어서 눌러 덮음
 *   간격 = 본체 두께 + 여유. 안 주면 눌려 뭉개진다.
 *
 * 돔도 캐비티와 같은 방식(얇은 층 쌓기)으로 만든다.
 */

/** 구면 돔: 밑면 반지름 r0, 높이 H 일 때 높이 t 에서 안쪽으로 들어간 거리 */
function domeInset(t, r0, H) {
  if (H <= 0.001) return 0;
  const R = (r0 * r0 + H * H) / (2 * H);      // 구 반지름
  const q = R * R - (t - H + R) * (t - H + R);
  return r0 - (q > 0 ? Math.sqrt(q) : 0);
}

/** 평평한 판이 돔이 되며 늘어나는 비율 (가장자리 기준) */
function domeStretch(r0, H) {
  if (H <= 0.001) return 0;
  const R = (r0 * r0 + H * H) / (2 * H);
  return (R * Math.asin(Math.min(1, r0 / R))) / r0 - 1;
}

/**
 * 성형 틀 한 쌍.
 * o: { domeH, gap, flange, floor, pin, pinD, colorM, colorF, out, shiftX, gapX }
 */
export function buildPressMold(model, o = {}) {
  const H = model.height;
  const flange = Math.max(2, o.flange ?? 6);
  const floor = Math.max(0.8, o.floor ?? 2.5);
  const gap = Math.max(0.2, o.gap ?? 3.4);          // 본체 두께 + 여유
  const pinD = Math.max(0, o.pinD ?? 4);
  const info = { warn: null };

  const fp = union(model.layers.flatMap((l) => l.items.map((it) => toPathH(it.poly, H))), PF.pftEvenOdd);
  if (!fp.length) return { parts: [], info: { warn: 'empty' } };
  const [fx0, fy0, fx1, fy1] = bboxOf(fp);
  const r0 = Math.min(fx1 - fx0, fy1 - fy0) / 2;    // 짧은 쪽 기준 (돔이 가장자리를 넘지 않게)
  const domeH = Math.max(0.5, Math.min(o.domeH ?? Math.round(r0 * 0.45 * 2) / 2, r0 * 0.95));
  info.domeH = domeH;
  info.r0 = r0;
  info.stretch = domeStretch(r0, domeH);
  if (info.stretch > 0.22) info.warn = 'tooHigh';

  const plate = [rectPath(fx0 - flange, fy0 - flange, fx1 + flange, fy1 + flange)];
  const steps = Math.min(80, Math.max(6, Math.ceil(domeH / 0.15)));
  info.steps = steps;

  // 정렬 핀 자리 (플랜지 네 귀퉁이). 한 개만 굵게 해서 한 방향으로만 맞물리게 한다
  const pins = [];
  if (pinD > 0.5) {
    const m = flange / 2;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], i) => {
      const cx = sx < 0 ? fx0 - m : fx1 + m, cy = sy < 0 ? fy0 - m : fy1 + m;
      const rr = (i === 0 ? pinD * 1.5 : pinD) / 2;
      const c = [];
      for (let k = 0; k < 24; k++) { const t = (k * Math.PI) / 12; c.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]); }
      pins.push(toPath(c));
    });
  }
  const pinH = Math.min(8, Math.max(3, gap + 2.5));
  // 암틀은 뒤집어 덮으므로 좌우 대칭으로 만들어야 수틀과 맞는다 (비대칭 도형에서 중요)
  const midX = Math.round(((fx0 + fx1) / 2) * SC) * 2;
  const mirX = (paths) => paths.map((p) => p.map((q) => ({ X: midX - q.X, Y: q.Y })).reverse());

  const parts = [];
  const mk = (geos, name, color, z1) => {
    const g2 = geos.filter(Boolean);
    if (!g2.length) return;
    let g = g2.length === 1 ? g2[0] : mergeGeometries(g2);
    g2.forEach((x) => x !== g && x.dispose());
    g.computeVertexNormals();
    parts.push({ name, color, geom: g, z0: 0, z1, role: 'mold' });
  };

  const want = o.out || 'both';

  // ── 수틀 (볼록) ──
  if (want !== 'femaleOnly') {
    const G = [extrude(plate, 0, floor)];
    for (let k = 0; k < steps; k++) {
      const t0 = (domeH * k) / steps, t1 = (domeH * (k + 1)) / steps;
      const lay = clean(offset(fp, -domeInset((t0 + t1) / 2, r0, domeH)), 0.02);
      if (!lay.length) break;
      G.push(extrude(lay, floor + t0, floor + t1));
    }
    if (pins.length) G.push(extrude(pins, floor, floor + pinH));
    mk(G, '수틀 (볼록)', o.colorM || '#8fa6b8', floor + domeH);
  }

  // ── 암틀 (오목) ──
  if (want !== 'maleOnly') {
    const dx = want === 'both' ? (o.gapX ?? 0) : 0;
    const top = floor + domeH + gap;
    const fpM = mirX(fp);                                   // 뒤집어 덮을 것이므로 좌우 반전
    const holes = pins.length ? offset(mirX(pins), 0.3) : []; // 핀 구멍 = 핀 + 여유 0.3mm
    const cut = (paths) => (holes.length ? clean(diff(paths, holes), 0.001) : paths);
    const G = [extrude(cut(plate), 0, floor)];
    for (let k = 0; k < steps + 2; k++) {
      const h0 = ((domeH + gap) * k) / (steps + 2), h1 = ((domeH + gap) * (k + 1)) / (steps + 2);
      const hm = (h0 + h1) / 2;
      // 뒤집어 덮으면 암틀 캐비티 높이 h 가 수틀 높이 (domeH - h) 와 맞닿는다.
      // h 가 domeH 를 넘는 구간(윗 gap 만큼)은 곧은 벽 — 가장자리에서 본체 두께를 받아 준다.
      const t = Math.max(0, domeH - hm);
      const cav = offset(fpM, -domeInset(t, r0, domeH) + gap);
      const ring = clean(diff(plate, cav), 0.001);
      if (!ring.length) { info.warn = info.warn || 'cavityOutOfPlate'; break; }
      G.push(extrude(cut(ring), floor + h0, floor + h1));       // 핀 구멍은 전층을 관통해야 핀이 들어간다
    }
    const g = G.filter(Boolean);
    if (dx) g.forEach((x) => x.translate(dx, 0, 0));
    mk(g, '암틀 (오목)', o.colorF || '#b8a68f', top);
  }

  info.size = [fx1 - fx0 + flange * 2, fy1 - fy0 + flange * 2, floor + domeH + gap];
  info.bbox = [fx0 - flange, fy0 - flange, fx1 + flange + (want === 'both' ? (o.gapX ?? 0) : 0), fy1 + flange];
  info.gap = gap;
  return { parts, info };
}
