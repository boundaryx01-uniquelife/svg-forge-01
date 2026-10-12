// MX 호환 키캡: 속이 빈 테이퍼 몸체 + 십자 스템 + 윗면 글자(돋을/새김/상감)
// 좌표: mm, Y 위쪽 (solid.js와 같음). 몸체 중심 = 글자 모델 중심
import * as THREE from 'three';
import { geo2d } from './solid.js';

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

/** 키캡 치수 계산 (UI 안내·테스트에도 씀) */
export function keycapDims(k) {
  const u = Math.max(1, parseFloat(k.u) || 1);
  const bw = 19.05 * u - 0.95, bd = 18.1;
  const inset = Math.min(Math.max(0, k.inset == null ? 2.8 : k.inset), 6);
  const H = Math.max(4, k.h || 9);
  const wall = Math.min(3, Math.max(0.8, k.wall || 1.4));
  const mode = k.mode || 'emboss';
  const depth = mode === 'emboss' ? 0 : Math.min(2, Math.max(0.2, k.depth || 0.4));
  const topT = Math.max(1.4, depth + 1.0);
  return { u, bw, bd, inset, H, wall, mode, depth, topT, topW: bw - 2 * inset, topD: bd - 2 * inset, zT: H - depth, zi: H - topT };
}

function meshFrom(tris) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tris), 3));
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((tris.length / 3) * 2), 2));
  return g;
}

/** 속 빈 몸체 닫힌 메시 */
function bodyMesh(cx, cy, D, nz = 20) {
  const { bw, bd, inset, wall, zT, zi } = D;
  const rb = 1.4, rt = 1.0;
  const ring = (z, off) => {
    const t = Math.min(1, Math.max(0, z / zT));
    return rrect(cx, cy, bw / 2 - inset * t - off, bd / 2 - inset * t - off, rb + (rt - rb) * t - off, 6);
  };
  const T = [];
  const P = (p, z) => [p[0], p[1], z];
  const tri = (a, b, c) => T.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => (tri(a, b, c), tri(a, c, d)); // a,b,c,d 순서가 면의 앞쪽 기준 반시계
  const n = ring(0, 0).length;
  // 바깥 벽
  let prev = ring(0, 0);
  for (let k = 1; k <= nz; k++) {
    const z0 = ((k - 1) / nz) * zT, z1 = (k / nz) * zT;
    const cur = ring(z1, 0);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      quad(P(prev[i], z0), P(prev[j], z0), P(cur[j], z1), P(cur[i], z1));
    }
    prev = cur;
  }
  // 윗면 (z = zT, 위를 봄)
  const topR = ring(zT, 0);
  const c0 = [cx, cy, zT];
  for (let i = 0; i < n; i++) tri(c0, P(topR[i], zT), P(topR[(i + 1) % n], zT));
  // 바닥 테두리 (아래를 봄)
  const o0 = ring(0, 0), i0 = ring(0, wall);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    quad(P(o0[i], 0), P(i0[i], 0), P(i0[j], 0), P(o0[j], 0));
  }
  // 안쪽 벽 (구멍 쪽을 봄) 0 → zi
  const nzi = Math.max(2, Math.round((nz * zi) / zT));
  let pv = i0;
  for (let k = 1; k <= nzi; k++) {
    const za = ((k - 1) / nzi) * zi, zb = (k / nzi) * zi;
    const cu = ring(zb, wall);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      quad(P(pv[j], za), P(pv[i], za), P(cu[i], zb), P(cu[j], zb));
    }
    pv = cu;
  }
  // 안쪽 천장 (아래를 봄)
  const ci = [cx, cy, zi];
  for (let i = 0; i < n; i++) tri(ci, P(pv[(i + 1) % n], zi), P(pv[i], zi));
  return meshFrom(T);
}

/**
 * 반환: { parts, info } — buildParts와 같은 모양
 * k: { u, h, inset, wall, color, mode: 'emboss'|'engrave'|'inlay', depth, legendH, stemLen, tol }
 */
export function buildKeycap(model, o) {
  const k = o.keycap;
  const D = keycapDims(k);
  const W = model.width, Hm = model.height;
  const cx = W / 2, cy = Hm / 2;
  const color = k.color || '#f2f2f2';
  const parts = [];
  const info = { rings: [], keycap: D };
  // 글자 도형 → 윗면 안으로 자르기
  const topFace = [pathOf(rrect(cx, cy, D.topW / 2 - 0.4, D.topD / 2 - 0.4, 0.8, 5))];
  let layerPaths = model.layers.map((l) => heal(union(l.items.map((it) => toPath(it.poly, Hm)), PF.pftEvenOdd)));
  if (model.fromText && layerPaths.length > 1) for (let i = 0; i < layerPaths.length - 1; i++) layerPaths[i] = diff(layerPaths[i], union(layerPaths.slice(i + 1).flat()));
  const area = (ps) => ps.reduce((s, p) => s + Math.abs(ClipperAreaAbs(p)), 0);
  const before = area(union(layerPaths.flat()));
  layerPaths = layerPaths.map((lp) => clip(CT.ctIntersection, lp, topFace));
  const legendAll = union(layerPaths.flat());
  if (before > 0 && area(legendAll) < before * 0.98) info.legendClipped = true;
  info.topSize = [D.topW, D.topD];

  const body = bodyMesh(cx, cy, D);
  parts.push({ name: '키캡 몸체', color, geom: body, shapes: [], z0: 0, z1: D.zT, role: 'kcbody' });
  const add = (name, col, paths, z0, z1, role, layer, label = true) => {
    if (!paths.length) return;
    const sh = toShapes(paths);
    if (!sh.length) return;
    parts.push({ name, color: col, paths, shapes: label ? sh : [], z0, z1, role, layer });
  };
  // 윗층 (새김·상감: 글자 자리를 비운 판)
  const outline = [pathOf(rrect(cx, cy, D.bw / 2 - D.inset, D.bd / 2 - D.inset, 1.0, 6))];
  if (D.mode !== 'emboss') add('키캡 윗층', color, diff(outline, legendAll), D.zT, D.H, 'kctop', undefined, false);
  // 글자
  const lh = Math.min(2, Math.max(0.2, k.legendH || 0.6));
  model.layers.forEach((l, i) => {
    if (!layerPaths[i].length) return;
    if (D.mode === 'emboss') add(`글자 ${i + 1} ${l.color}`, l.color, layerPaths[i], D.H, D.H + lh, 'kclegend', i);
    else if (D.mode === 'inlay') add(`글자 ${i + 1} ${l.color}`, l.color, layerPaths[i], D.zT, D.H, 'kclegend', i);
  });
  // 십자 스템 (MX): 바깥 Ø5.5, 구멍 4.1 × 1.35 (+공차)
  const tol = Math.min(0.5, Math.max(0, k.tol == null ? 0.1 : k.tol));
  const L = 4.1 + tol, Wd = 1.35 + tol;
  const cross = union([[pathOf([[cx - L / 2, cy - Wd / 2], [cx + L / 2, cy - Wd / 2], [cx + L / 2, cy + Wd / 2], [cx - L / 2, cy + Wd / 2]])], [pathOf([[cx - Wd / 2, cy - L / 2], [cx + Wd / 2, cy - L / 2], [cx + Wd / 2, cy + L / 2], [cx - Wd / 2, cy + L / 2]])]].flat());
  const stemLen = Math.min(D.zi - 0.5, Math.max(2, k.stemLen || 4.6));
  const stemOuter = geo2d.circle(cx, cy, 2.75);
  add('스템', color, diff(stemOuter, cross), D.zi - stemLen, D.zi + 0.3, 'kcstem', undefined, false);
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
