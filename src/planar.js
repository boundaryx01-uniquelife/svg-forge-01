// 다색 이미지의 경계 그래프: 색 영역 사이 경계를 "사슬"로 한 번만 만들고 양쪽 색이 공유한다.
//  - 격자 꼭짓점(픽셀 모서리)에서 3색 이상이 만나면 교차점(junction)
//  - 교차점 사이 경계 = 열린 사슬, 교차점 없는 경계 = 닫힌 사슬
//  - 각 경계 변의 위치는 흐린 색 마스크 차이의 0점으로 서브픽셀 보정

import { gaussBlur } from './contour.js';

/** 4-연결 영역 중 면적이 minArea 미만인 조각을 가장 많이 맞닿은 이웃 색으로 흡수 */
export function cleanLabels(label, w, h, minArea) {
  if (!(minArea > 0)) return label;
  const N = w * h;
  for (let pass = 0; pass < 3; pass++) {
    const comp = new Int32Array(N).fill(-1);
    const queue = new Int32Array(N);
    let changed = 0;
    for (let s = 0; s < N; s++) {
      if (comp[s] >= 0) continue;
      const L = label[s];
      let qh = 0, qt = 0;
      queue[qt++] = s;
      comp[s] = s;
      const nb = new Map();
      while (qh < qt) {
        const i = queue[qh++];
        const x = i % w, y = (i - x) / w;
        const cand = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (const j of cand) {
          if (j < 0) continue;
          if (label[j] === L) {
            if (comp[j] < 0) {
              comp[j] = s;
              queue[qt++] = j;
            }
          } else nb.set(label[j], (nb.get(label[j]) || 0) + 1);
        }
      }
      if (qt < minArea && nb.size) {
        let best = -1, bv = -1;
        for (const [k, v] of nb) if (v > bv) { bv = v; best = k; }
        for (let q = 0; q < qt; q++) label[queue[q]] = best;
        changed++;
      }
    }
    if (!changed) break;
  }
  return label;
}

/**
 * label: Int32Array (w×h), outLabels: 출력할 라벨 집합(Set)
 * 반환: { chains: [{pts, closed, labels:[a,b]}], rings: Map(label → [[{chain, rev}...], ...]) }
 */
export function buildBoundaryGraph(label, w, h, outLabels, rgb, pal) {
  const W = w + 2, H = h + 2, PAD = -2;
  const LP = new Int32Array(W * H).fill(PAD);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) LP[(y + 1) * W + x + 1] = label[y * w + x];
  const lab = (px, py) => (px < 0 || py < 0 || px >= W || py >= H ? PAD : LP[py * W + px]);

  // 서브픽셀 보정: 픽셀 색을 두 팔레트 색 사이의 혼합 비율로 보고 경계 위치 추정
  //  e = 0.5 + cov_a(Q) - cov_b(P)  (P 중심 0, Q 중심 1 기준)
  const mixT = (px, py, a, b) => {
    const x = px - 1, y = py - 1;
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    const i = (y * w + x) * 4;
    const ca = pal[a], cb = pal[b];
    if (!ca || !cb) return null;
    const dx = cb.r - ca.r, dy = cb.g - ca.g, dz = cb.b - ca.b;
    const L2 = dx * dx + dy * dy + dz * dz;
    if (L2 < 400) return null;
    const t = ((rgb[i] - ca.r) * dx + (rgb[i + 1] - ca.g) * dy + (rgb[i + 2] - ca.b) * dz) / L2;
    return Math.max(0, Math.min(1, t));
  };

  const VW = W + 1;
  const hId = (vx, vy) => (vy * VW + vx) * 2; // (vx,vy)-(vx+1,vy): 위 픽셀 (vx,vy-1), 아래 픽셀 (vx,vy)
  const vId = (vx, vy) => (vy * VW + vx) * 2 + 1; // (vx,vy)-(vx,vy+1): 왼 픽셀 (vx-1,vy), 오른 픽셀 (vx,vy)
  const sidePixels = (id) => {
    const v = id >> 1, vx = v % VW, vy = (v - vx) / VW;
    return id & 1 ? [vx - 1, vy, vx, vy] : [vx, vy - 1, vx, vy];
  };
  const sideVerts = (id) => {
    const v = id >> 1, vx = v % VW, vy = (v - vx) / VW;
    return id & 1 ? [v, (vy + 1) * VW + vx] : [v, vy * VW + vx + 1];
  };
  const isB = (id) => {
    const [ax, ay, bx, by] = sidePixels(id);
    return lab(ax, ay) !== lab(bx, by);
  };
  // 경계 변의 서브픽셀 위치 (이미지 좌표: 픽셀 중심 = 정수+0.5, 패딩 보정 -1)
  const crossPt = new Map();
  const crossing = (id) => {
    let p = crossPt.get(id);
    if (p) return p;
    const [ax, ay, bx, by] = sidePixels(id);
    const a = lab(ax, ay), b = lab(bx, by);
    let t = 0.5;
    if (a >= 0 && b >= 0) {
      const tP = mixT(ax, ay, a, b), tQ = mixT(bx, by, a, b);
      if (tP !== null && tQ !== null) t = Math.min(0.98, Math.max(0.02, 0.5 + (1 - tQ) - tP));
    }
    p = [ax + 0.5 + (bx - ax) * t - 1, ay + 0.5 + (by - ay) * t - 1];
    crossPt.set(id, p);
    return p;
  };

  // 꼭짓점별 경계 변 목록
  const incident = (v) => {
    const vx = v % VW, vy = (v - vx) / VW;
    const out = [];
    if (vx > 0) out.push(hId(vx - 1, vy));
    if (vx < W) out.push(hId(vx, vy));
    if (vy > 0) out.push(vId(vx, vy - 1));
    if (vy < H) out.push(vId(vx, vy));
    return out.filter((id) => {
      const [ax, ay, bx, by] = sidePixels(id);
      return ax >= -1 && ay >= -1 && bx <= W && by <= H && isB(id);
    });
  };

  // 경계 변 전체 수집
  const bSides = [];
  for (let vy = 0; vy <= H; vy++) {
    for (let vx = 0; vx <= W; vx++) {
      if (vx < W && vy > 0 && vy < H && isB(hId(vx, vy))) bSides.push(hId(vx, vy));
      if (vy < H && vx > 0 && vx < W && isB(vId(vx, vy))) bSides.push(vId(vx, vy));
    }
  }
  const degCache = new Map();
  const degree = (v) => {
    let d = degCache.get(v);
    if (d === undefined) {
      d = incident(v).length;
      degCache.set(v, d);
    }
    return d;
  };
  const isJunction = (v) => degree(v) !== 2;
  const junctionPos = new Map();
  const jPos = (v) => {
    let p = junctionPos.get(v);
    if (p) return p;
    const ids = incident(v);
    let sx = 0, sy = 0;
    for (const id of ids) {
      const q = crossing(id);
      sx += q[0];
      sy += q[1];
    }
    p = [sx / ids.length, sy / ids.length];
    junctionPos.set(v, p);
    return p;
  };

  // 사슬 만들기
  const sideChain = new Map(); // side → {ci, pos, from}
  const chains = [];
  const walk = (startV, firstSide) => {
    const sides = [];
    const verts = [startV];
    let v = startV, s = firstSide;
    for (let guard = 0; guard < 1e7; guard++) {
      sides.push(s);
      const [a, b] = sideVerts(s);
      const u = a === v ? b : a;
      verts.push(u);
      if (isJunction(u) || u === startV) break;
      const nx = incident(u).find((id) => id !== s);
      if (nx === undefined || sideChain.has(nx)) break;
      v = u;
      s = nx;
      sideChain.set(s, null);
    }
    return { sides, verts };
  };
  const register = (sides, verts, closed) => {
    const ci = chains.length;
    sides.forEach((s, i) => sideChain.set(s, { ci, pos: i, from: verts[i] }));
    const [ax, ay, bx, by] = sidePixels(sides[0]);
    const la = lab(ax, ay), lb = lab(bx, by);
    const pts = sides.map(crossing);
    if (!closed) {
      pts.unshift(jPos(verts[0]));
      pts.push(jPos(verts[verts.length - 1]));
    }
    chains.push({ pts, closed, labels: [la, lb], verts, sides });
  };
  for (const s of bSides) {
    if (sideChain.get(s)) continue;
    const [a, b] = sideVerts(s);
    if (isJunction(a)) {
      sideChain.set(s, null);
      const { sides, verts } = walk(a, s);
      register(sides, verts, false);
    } else if (isJunction(b)) {
      sideChain.set(s, null);
      const { sides, verts } = walk(b, s);
      register(sides, verts, false);
    }
  }
  // 남은 변: 교차점 없는 닫힌 고리 (양쪽 모두 비교차점)
  for (const s of bSides) {
    if (sideChain.get(s)) continue;
    const [a] = sideVerts(s);
    sideChain.set(s, null);
    const { sides, verts } = walk(a, s);
    register(sides, verts, verts[verts.length - 1] === verts[0]);
  }
  // 한쪽 끝이 교차점인 사슬은 위에서 이미 처리됨. 열린 사슬 중 교차점에서 시작하지 못한 경우(드묾) 대비
  for (const s of bSides) if (!sideChain.get(s)) {
    const [a] = sideVerts(s);
    const { sides, verts } = walk(a, s);
    register(sides, verts, false);
  }

  // 색 영역별 고리: 픽셀 둘레를 일정한 회전 방향으로, 대각선 접촉은 분리(4-연결)
  const rings = new Map();
  for (const K of outLabels) {
    const out = new Map(); // from vertex → [{side, to, owner}]
    const addD = (side, from, to, owner) => {
      if (!out.has(from)) out.set(from, []);
      out.get(from).push({ side, from, to, owner });
    };
    for (let py = 1; py < H - 1; py++) {
      for (let px = 1; px < W - 1; px++) {
        if (LP[py * W + px] !== K) continue;
        const own = py * W + px;
        const V = (x, y) => y * VW + x;
        if (lab(px, py - 1) !== K) addD(hId(px, py), V(px + 1, py), V(px, py), own); // 위
        if (lab(px - 1, py) !== K) addD(vId(px, py), V(px, py), V(px, py + 1), own); // 왼
        if (lab(px, py + 1) !== K) addD(hId(px, py + 1), V(px, py + 1), V(px + 1, py + 1), own); // 아래
        if (lab(px + 1, py) !== K) addD(vId(px + 1, py), V(px + 1, py + 1), V(px + 1, py), own); // 오른
      }
    }
    const used = new Set();
    const loops = [];
    for (const [, list] of out) {
      for (const d0 of list) {
        if (used.has(d0.side)) continue;
        const seq = [];
        let d = d0;
        for (let guard = 0; guard < 1e7; guard++) {
          used.add(d.side);
          seq.push(d);
          const cands = (out.get(d.to) || []).filter((e) => !used.has(e.side) || e === d0);
          if (!cands.length) break;
          let nx = cands.find((e) => e.owner === d.owner) || cands[0];
          if (nx === d0) break;
          if (used.has(nx.side)) break;
          d = nx;
        }
        // 사슬 단위로 묶기: 교차점에서 시작하도록 회전
        const start = seq.findIndex((e) => isJunction(e.from));
        const parts = [];
        if (start < 0) {
          // 교차점 없는 고리 = 닫힌 사슬 하나 전체
          const info = sideChain.get(seq[0].side);
          parts.push({ chain: info.ci, rev: info.from !== seq[0].from });
        } else {
          const rot = seq.slice(start).concat(seq.slice(0, start));
          let i = 0;
          while (i < rot.length) {
            const info = sideChain.get(rot[i].side);
            const ch = chains[info.ci];
            const rev = info.from !== rot[i].from;
            parts.push({ chain: info.ci, rev });
            i += ch.sides.length;
          }
        }
        loops.push(parts);
      }
    }
    rings.set(K, loops);
  }
  return { chains, rings };
}
