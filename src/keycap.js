// MX 호환 키캡: 속이 빈 테이퍼 몸체 + 십자 스템 + 윗면 글자(돋을/새김/상감)
// 좌표: mm, Y 위쪽 (solid.js와 같음). 몸체 중심 = 글자 모델 중심
import * as THREE from 'three';
import ClipperLib from 'clipper-lib';
import { geo2d, beveledSolid, loftSolid } from './solid.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const { union, diff, offset, toShapes, toPath, heal, clip, CT, PF, SC } = geo2d;
const pathOf = (pts) => pts.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }));

/** 둥근 사각형 윤곽 (반시계, Y 위쪽) */
function rrect(cx, cy, hw, hd, r, n = 6) {
  r = Math.max(0.05, Math.min(r, hw - 0.01, hd - 0.01));
  const pts = [];
  const corners = [[cx + hw - r, cy + hd - r, 0], [cx - hw + r, cy + hd - r, 90], [cx - hw + r, cy - hd + r, 180], [cx + hw - r, cy - hd + r, 270]];
  for (const [x, y, a0] of corners)
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    }
  return pts;
}

export const KEY_SIZES = { '1': 1, '1.25': 1.25, '1.5': 1.5, '1.75': 1.75, '2': 2, '2.25': 2.25, '2.75': 2.75, '6.25': 6.25 };

/** 키캡 치수 계산 (UI 안내·테스트에도 씀). k.edgeType/edgeSize: 윗모서리 모따기·모깎기 */
export function keycapDims(k) {
  const u = Math.max(1, parseFloat(k.u) || 1);
  const bw = 19.05 * u - 0.95, bd = 18.1;
  const inset = Math.min(Math.max(0, k.inset == null ? 2.8 : k.inset), 6);
  const H = Math.max(4, k.h || 9);
  const wall = Math.min(3, Math.max(0.8, k.wall || 1.4));
  const mode = k.mode || 'emboss';
  const depth = mode === 'emboss' ? 0 : Math.min(2, Math.max(0.2, k.depth || 0.4));
  const bevType = k.edgeType === 'chamfer' || k.edgeType === 'fillet' ? k.edgeType : 'none';
  const topW = bw - 2 * inset, topD = bd - 2 * inset;
  const bs = bevType === 'none' ? 0 : Math.min(Math.max(0.1, k.edgeSize || 0.6), 2.5, Math.max(0.1, Math.min(topW, topD) / 2 - 1.5), H * 0.4);
  const topT = Math.max(1.4, depth + 1.0, bs + 0.8);
  // 몸체 네 세로 모서리 R (평면에서 본 둥글기). 윗면이 좁아지므로 윗면 짧은 변의 1/3 까지만
  const bodyR = Math.min(Math.max(0.2, k.bodyR == null ? 1.4 : k.bodyR), Math.max(0.2, Math.min(topW, topD) / 3));
  // 안쪽 필렛: 천장과 만나는 오목한 모서리를 둥글게 — 스템이 잘 안 부러지고, 뒤집어 출력해도 서포트가 필요 없다
  // (천장 쪽이 가장 두껍고 위로 갈수록 얇아지므로 층마다 재료가 줄기만 한다)
  const zi = H - topT;
  const innerR = Math.min(Math.max(0, k.innerR == null ? 0.8 : k.innerR), 2.5, Math.max(0, zi - 0.6), wall * 1.5);
  return { u, bw, bd, inset, H, wall, mode, depth, topT, topW, topD, zT: H - depth, zi, bevType, bs, bodyR, innerR };
}

function meshFrom(tris) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris), 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((tris.length / 3) * 2), 2));
  return g;
}

const sArea = (p) => {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]);
  return a / 2; // 반시계 > 0
};
const ccw = (p) => (sArea(p) < 0 ? p.slice().reverse() : p);
const cw = (p) => (sArea(p) > 0 ? p.slice().reverse() : p);

/** 바깥 윤곽(z, 안쪽으로 off) — 위쪽 모서리 다듬기(bev) 포함 */
function ringAt(cx, cy, D, z, off) {
  const { bw, bd, inset, H, bs, bevType } = D;
  const t = Math.min(1, Math.max(0, z / H));
  let ex = 0;
  if (bs > 0 && z > H - bs) {
    const q = z - (H - bs);
    ex = bevType === 'chamfer' ? q : bs - Math.sqrt(Math.max(0, bs * bs - q * q));
  }
  const rb = D.bodyR, rt = Math.max(0.2, D.bodyR - 0.4);   // 아래가 조금 더 둥글다 (기본 1.4 / 1.0)
  return rrect(cx, cy, bw / 2 - inset * t - off - ex, bd / 2 - inset * t - off - ex, Math.max(0.2, rb + (rt - rb) * t - off - ex), 6);
}

/** 속 빈 몸체 닫힌 메시. legend: 윗면에 파낼 글자 트리(새김·상감), 없으면 평평한 윗면 */
function bodyMesh(cx, cy, D, legendTree) {
  const { wall, H, zi, zT, bs, bevType } = D;
  const T = [];
  const P = (p, z) => [p[0], p[1], z];
  const tri = (a, b, c) => T.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => (tri(a, b, c), tri(a, c, d));
  // 바깥 벽 z 목록: 기울기 구간 + 윗모서리 다듬기 구간
  const zs = [0];
  const nBase = Math.max(6, Math.round(18 * ((H - bs) / H)));
  for (let k = 1; k <= nBase; k++) zs.push(((H - bs) * k) / nBase);
  if (bs > 0) {
    const nb = bevType === 'chamfer' ? 1 : 8;
    for (let k = 1; k <= nb; k++) zs.push(H - bs + (bevType === 'chamfer' ? bs : bs * Math.sin((k * Math.PI) / 2 / nb)));
  } else zs[zs.length - 1] = H;
  zs[zs.length - 1] = H;
  const n = ringAt(cx, cy, D, 0, 0).length;
  let prev = ringAt(cx, cy, D, 0, 0);
  for (let k = 1; k < zs.length; k++) {
    const cur = ringAt(cx, cy, D, zs[k], 0);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      quad(P(prev[i], zs[k - 1]), P(prev[j], zs[k - 1]), P(cur[j], zs[k]), P(cur[i], zs[k]));
    }
    prev = cur;
  }
  const topR = prev; // z = H 윤곽
  // 위로 향하는 면 (윤곽 + 구멍들, 높이 z)
  const capUp = (contour, holes, z) => {
    const c = contour.map((q) => new THREE.Vector2(q[0], q[1]));
    const hs = holes.map((h) => h.map((q) => new THREE.Vector2(q[0], q[1])));
    const faces = THREE.ShapeUtils.triangulateShape(c, hs);
    const flat = c.concat(...hs);
    for (const f of faces) {
      const a = flat[f[0]], b = flat[f[1]], d = flat[f[2]];
      const cr = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
      const [i0, i1, i2] = cr >= 0 ? [f[0], f[1], f[2]] : [f[0], f[2], f[1]];
      tri([flat[i0].x, flat[i0].y, z], [flat[i1].x, flat[i1].y, z], [flat[i2].x, flat[i2].y, z]);
    }
  };
  // 세로 벽: 폐곡선 poly(반시계)의 H ↔ zT. into=true: 폴리곤 안쪽을 향함(파인 홈 벽), false: 바깥을 향함(섬 벽)
  const wallLoop = (poly, into) => {
    const m = poly.length;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      const A = P(poly[i], H), B = P(poly[j], H), C = P(poly[j], zT), Dd = P(poly[i], zT);
      if (into) (tri(A, C, Dd), tri(A, B, C));
      else (tri(A, Dd, C), tri(A, C, B));
    }
  };
  if (!legendTree) {
    const c0 = [cx, cy, H];
    for (let i = 0; i < n; i++) tri(c0, P(topR[i], H), P(topR[(i + 1) % n], H));
  } else {
    // 윗면(H) = 윤곽 − 홈들, 홈 바닥(zT) = 홈 − 섬들, 섬 윗면(H) = 섬 − 안쪽 홈들 …
    // 같은 선 위에 놓인 꼭짓점(글자 밑변 등)이 삼각분할에서 면적 0 조각을 만들지 않도록 8µm 안팎으로 아주 조금 흩뜨림 (좌표 값에서 정해지므로 벽·면이 같은 값을 씀)
    const jit = (q) => {
      let h = Math.imul(q.X, 73856093) ^ Math.imul(q.Y, 19349663);
      h ^= h >>> 13;
      h = Math.imul(h, 0x5bd1e995);
      h ^= h >>> 15;
      return [(q.X + (h & 15) - 7.5) / SC, (q.Y + ((h >>> 4) & 15) - 7.5) / SC];
    };
    const conv = (node) => node.Contour().map(jit);
    const level = (poly, kids, z, isPocket) => {
      // poly: 이 영역의 윤곽, kids: 안쪽 하위 영역(노드)들
      const holes = kids.map((k) => cw(conv(k)));
      capUp(ccw(poly), holes, z);
      for (const k of kids) {
        const kp = ccw(conv(k));
        wallLoop(kp, !isPocket ? true : false); // 윗면 영역 안의 홈: 안쪽을 향함 / 홈 안의 섬: 바깥을 향함
        level(kp, k.Childs(), isPocket ? H : zT, !isPocket);
      }
    };
    level(topR, legendTree.Childs(), H, false);
  }
  // 바닥 테두리 (아래를 봄)
  const o0 = ringAt(cx, cy, D, 0, 0), i0 = ringAt(cx, cy, D, 0, wall);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    quad(P(o0[i], 0), P(i0[i], 0), P(i0[j], 0), P(o0[j], 0));
  }
  // 안쪽 벽 (구멍 쪽을 봄) 0 → zi.
  // 천장 가까이에서는 안쪽 모따기(innerR)만큼 45° 로 비스듬히 채워 오목한 모서리를 없앤다.
  // 둥글게(사분원) 하면 천장 바로 아래에서 면이 수평에 가까워져 세워서 뽑을 때 서포트가 필요하다.
  const fr = D.innerR;
  const zTop = Math.max(0.1, zi - fr);
  const nzi = Math.max(4, Math.round(18 * (zTop / H)));
  let pv = i0, pz = 0;
  const step = (zb, extra) => {
    const cu = ringAt(cx, cy, D, zb, wall + extra);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      quad(P(pv[j], pz), P(pv[i], pz), P(cu[i], zb), P(cu[j], zb));
    }
    (pv = cu), (pz = zb);
  };
  for (let k = 1; k <= nzi; k++) step((k / nzi) * zTop, 0);
  if (fr > 0.05) {
    // 1/4 원 단면. d=0(벽 쪽)에서는 벽에, d=fr(천장)에서는 천장에 접한다
    const nf = 2;                       // 45° 직선이라 잘게 나눌 이유가 없다
    for (let k = 1; k <= nf; k++) {
      const zb = zTop + (fr * k) / nf;
      step(zb, zb - zTop);              // 모따기: 높이만큼 안으로
    }
  }
  const ci = [cx, cy, pz];
  for (let i = 0; i < n; i++) tri(ci, P(pv[(i + 1) % n], pz), P(pv[i], pz));
  return meshFrom(T);
}

/**
 * 반환: { parts, info } — buildParts와 같은 모양
 * k: { u, h, inset, wall, color, mode, depth, legendH, stemLen, tol, edgeType, edgeSize, partR, partRType }
 */
export function buildKeycap(model, o) {
  const k = { ...o.keycap };
  const D = keycapDims(k);
  const W = model.width, Hm = model.height;
  const cx = D.bw / 2, cy = D.bd / 2; // 키캡은 항상 같은 자리 (그림 너비를 바꿔도 키캡이 움직이지 않음)
  const sx = Math.round((cx - W / 2) * SC), sy = Math.round((cy - Hm / 2) * SC);
  const color = k.color || '#f2f2f2';
  const parts = [];
  const info = { rings: [], keycap: D };
  // 글자 도형 → 평평한 윗면 안으로 자르기 (윗모서리 다듬기만큼 좁아짐)
  const flat = ringAt(cx, cy, D, D.H, 0.4);
  const topFace = [pathOf(flat)];
  let layerPaths = model.layers.map((l) => heal(union(l.items.map((it) => toPath(it.poly, Hm)), PF.pftEvenOdd)).map((p) => p.map((q) => ({ X: q.X + sx, Y: q.Y + sy }))));
  if (model.fromText && layerPaths.length > 1) for (let i = 0; i < layerPaths.length - 1; i++) layerPaths[i] = diff(layerPaths[i], union(layerPaths.slice(i + 1).flat()));
  const area = (ps) => ps.reduce((s, p) => s + Math.abs(ClipperAreaAbs(p)), 0);
  const before = area(union(layerPaths.flat()));
  layerPaths = layerPaths.map((lp) => clip(CT.ctIntersection, lp, topFace));
  const legendAll = union(layerPaths.flat());
  if (before > 0 && area(legendAll) < before * 0.98) info.legendClipped = true;
  info.topSize = [D.topW - 2 * D.bs, D.topD - 2 * D.bs];

  let tree = null;
  if (D.mode !== 'emboss' && legendAll.length) {
    const c = new ClipperLib.Clipper();
    c.StrictlySimple = true;
    c.AddPaths(legendAll, ClipperLib.PolyType.ptSubject, true);
    tree = new ClipperLib.PolyTree();
    c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  }
  const body = bodyMesh(cx, cy, D, tree);
  parts.push({ name: '키캡 몸체', color, geom: body, shapes: [], z0: 0, z1: D.H, role: 'kcbody' });
  // 모서리 R: 스템·글자·윤곽 벽의 위아래 모서리를 둥글게(또는 비스듬히) 깎는다.
  // 키캡 몸체 윗모서리는 따로 '윗모서리' 값이 맡는다.
  const rSize = Math.max(0, Math.min(2, k.partR == null ? 0 : k.partR));
  const rBevel = rSize > 0.01 ? { type: k.partRType === 'chamfer' ? 'chamfer' : 'fillet', size: rSize } : null;
  const add = (name, col, paths, z0, z1, role, layer, label = true) => {
    if (!paths.length) return;
    const sh = toShapes(paths);
    if (!sh.length) return;
    // 조각이 얇으면 그 두께가 허락하는 만큼만 (0.6mm 글자에 R 1mm 를 줄 수는 없다)
    const sz = rBevel ? Math.min(rSize, Math.abs(z1 - z0) * 0.45) : 0;
    const bevel = sz > 0.02 ? { type: rBevel.type, size: sz } : null;
    parts.push({ name, color: col, paths, shapes: label ? sh : [], z0, z1, role, layer, bevel });
  };
  // 글자 — 색상별 높이(±mm)가 돋을 높이·상감 높이에 반영됨
  const lh = Math.min(2, Math.max(0.2, k.legendH || 0.6));
  const step = Math.max(0, o.step || 0);
  model.layers.forEach((l, i) => {
    if (!layerPaths[i].length) return;
    const off = (o.offsets && o.offsets[i] != null ? o.offsets[i] : i * step) + (l.dz || 0);
    if (D.mode === 'emboss') add(`글자 ${i + 1} ${l.color}`, l.color, layerPaths[i], D.H, D.H + Math.max(0.2, lh + off), 'kclegend', i);
    else if (D.mode === 'inlay') add(`글자 ${i + 1} ${l.color}`, l.color, layerPaths[i], D.zT, D.H + Math.max(-(D.depth - 0.2), off), 'kclegend', i);
  });
  // 윤곽 벽: 글자·그림 둘레에 담 (윗면 안에서만, 윗면 위로 솟음)
  if (o.wall && o.wall.on && legendAll.length) {
    const g = Math.max(0, o.wall.gap || 0), w = Math.max(0.4, o.wall.width || 1.2);
    const wp = clip(CT.ctIntersection, diff(offset(legendAll, g + w), offset(legendAll, g)), topFace);
    add('윤곽 벽', o.wall.color || '#ffffff', wp, D.H, D.H + Math.max(0.2, o.wall.height || 2), 'outwall', undefined, false);
  }
  // 십자 스템 (MX): 바깥 Ø5.5, 구멍 4.1 × 1.35 (+공차)
  const tol = Math.min(0.5, Math.max(0, k.tol == null ? 0.1 : k.tol));
  const L = 4.1 + tol, Wd = 1.35 + tol;
  const cross = union([[pathOf([[cx - L / 2, cy - Wd / 2], [cx + L / 2, cy - Wd / 2], [cx + L / 2, cy + Wd / 2], [cx - L / 2, cy + Wd / 2]])], [pathOf([[cx - Wd / 2, cy - L / 2], [cx + Wd / 2, cy - L / 2], [cx + Wd / 2, cy + L / 2], [cx - Wd / 2, cy + L / 2]])]].flat());
  // 십자 슬롯 모서리 R — 평면에서 둥글게. 슬롯이 좁아지지 않게 폭의 1/3 까지만
  let slot = cross;
  if (rSize > 0.01) {
    const rr = Math.min(rSize, Wd / 3);
    const co = new ClipperLib.ClipperOffset(2, 0.05 * SC);
    const grow = new ClipperLib.Paths(), back = new ClipperLib.Paths();
    co.AddPaths(cross, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    co.Execute(grow, rr * SC);
    const co2 = new ClipperLib.ClipperOffset(2, 0.05 * SC);
    co2.AddPaths(grow, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    co2.Execute(back, -rr * SC);
    if (back.length) slot = back;          // 닫힘 연산 = 안쪽(오목) 모서리를 둥글게
    info.slotR = Math.round(rr * 100) / 100;
  }
  const stemLen = k.stem === 'floor' ? D.zi : Math.min(D.zi - 0.5, 4.6); // 바닥까지 닿게 / 기본 4.6mm
  const stemOuter = geo2d.circle(cx, cy, 2.75);
  add('스템', color, diff(stemOuter, slot), D.zi - stemLen, D.zi + 0.3, 'kcstem', undefined, false);
  // 스템 뿌리 — 천장과 만나는 자리를 45° 로 넓혀 붙는 힘을 키운다.
  // 사분원으로 하면 천장 가까이에서 면이 수평에 가까워져, 세워서 뽑을 때 서포트가 필요하다.
  // 45° 경사는 세워서 뽑든 뒤집어 뽑든 제 살로 받친다 (오버행 한계가 보통 45°).
  const fr = D.innerR;
  if (fr > 0.05 && stemLen > fr + 0.3) {
    // 층마다 닫힌 솔리드를 만들어 합치면 경계가 내부 면으로 남아 메시가 닫히지 않는다
    // → 단면만 쌓아 loftSolid 로 한 덩어리로 만든다
    const N = Math.max(4, Math.ceil(fr / 0.12));
    const slabs = [];
    for (let i = 0; i < N; i++) {
      const za = D.zi - fr + (fr * i) / N, zb = D.zi - fr + (fr * (i + 1)) / N;
      const d = (za + zb) / 2 - (D.zi - fr);                      // 0(아래) → fr(천장)
      const w = d;                                                // 45° 경사 (사분원이 아니라)
      if (w < 0.015) continue;
      const band = diff(geo2d.circle(cx, cy, 2.75 + w), stemOuter);
      if (!band.length) continue;
      slabs.push({ z0: za, z1: zb, paths: band });
    }
    const pos = slabs.length ? loftSolid(slabs) : new Float32Array(0);
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
      g.computeVertexNormals();
      parts.push({ name: '스템 뿌리', color, geom: g, shapes: [], z0: D.zi - fr, z1: D.zi, role: 'kcstem' });
      info.stemFillet = Math.round(fr * 100) / 100;
    }
  }
  const zmax = Math.max(...parts.map((p) => p.z1));
  info.size = [D.bw, D.bd, zmax];
  info.bbox = [cx - D.bw / 2, cy - D.bd / 2, cx + D.bw / 2, cy + D.bd / 2];
  return { parts, info };
}

function ClipperAreaAbs(p) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j].X - p[i].X) * (p[j].Y + p[i].Y);
  return a / 2 / (SC * SC);
}
