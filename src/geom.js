// 기하 유틸: 링(닫힌 윤곽) 표현과 변환
// ring = [['M',x,y], ['L',x,y], ['Q',cx,cy,x,y], ['C',c1x,c1y,c2x,c2y,x,y], ...]  (암묵적으로 닫힘)

export const endPt = (c) => [c[c.length - 2], c[c.length - 1]];

/** 마지막 점이 시작점과 다르면 직선으로 명시적으로 닫는다 */
export function closeRing(ring, eps = 1e-6) {
  const s = ring[0];
  const e = endPt(ring[ring.length - 1]);
  if (Math.hypot(e[0] - s[1], e[1] - s[2]) > eps) ring.push(['L', s[1], s[2]]);
  return ring;
}

export function transformRing(ring, s, tx, ty) {
  return ring.map((c) => {
    if (c[0] === 'A') return ['A', (c[1] - tx) * s, (c[2] - ty) * s, c[3] * s, c[4], (c[5] - tx) * s, (c[6] - ty) * s];
    const o = [c[0]];
    for (let i = 1; i < c.length; i += 2) {
      o.push((c[i] - tx) * s, (c[i + 1] - ty) * s);
    }
    return o;
  });
}

/** 원호 명령의 회전각(라디안, 부호 없음) */
export function arcSweep(from, c) {
  const a0 = Math.atan2(from[1] - c[2], from[0] - c[1]);
  const a1 = Math.atan2(c[6] - c[2], c[5] - c[1]);
  let d = (a1 - a0) * c[4];
  while (d <= 1e-9) d += 2 * Math.PI;
  while (d > 2 * Math.PI + 1e-9) d -= 2 * Math.PI;
  return d;
}

/** 곡선을 허용오차(tol) 이내의 직선 다각형으로 변환. 마지막(시작점 중복) 점은 제외 */
export function flattenRing(ring, tol = 0.05) {
  let px = ring[0][1];
  let py = ring[0][2];
  const pts = [[px, py]];
  for (let i = 1; i < ring.length; i++) {
    const c = ring[i];
    if (c[0] === 'L') {
      px = c[1];
      py = c[2];
      pts.push([px, py]);
    } else if (c[0] === 'Q') {
      const cx = c[1], cy = c[2], x = c[3], y = c[4];
      const dev = Math.hypot(px - 2 * cx + x, py - 2 * cy + y);
      const n = Math.max(1, Math.ceil(Math.sqrt(dev / (4 * tol))));
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        pts.push([u * u * px + 2 * u * t * cx + t * t * x, u * u * py + 2 * u * t * cy + t * t * y]);
      }
      px = x;
      py = y;
    } else if (c[0] === 'A') {
      const cx = c[1], cy = c[2], r = c[3], dir = c[4];
      const sw = arcSweep([px, py], c);
      const a0 = Math.atan2(py - cy, px - cx);
      const step = r > tol ? 2 * Math.acos(Math.max(-1, 1 - tol / r)) : Math.PI / 4;
      const n = Math.max(1, Math.ceil(sw / Math.max(1e-3, step)));
      for (let k = 1; k < n; k++) {
        const a = a0 + (dir * sw * k) / n;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      px = c[5];
      py = c[6];
      pts.push([px, py]);
    } else if (c[0] === 'C') {
      const x1 = c[1], y1 = c[2], x2 = c[3], y2 = c[4], x = c[5], y = c[6];
      const m = Math.max(
        Math.hypot(px - 2 * x1 + x2, py - 2 * y1 + y2),
        Math.hypot(x1 - 2 * x2 + x, y1 - 2 * y2 + y)
      );
      const n = Math.max(1, Math.ceil(Math.sqrt((0.75 * m) / tol)));
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, cc = 3 * u * t * t, d = t * t * t;
        pts.push([a * px + b * x1 + cc * x2 + d * x, a * py + b * y1 + cc * y2 + d * y]);
      }
      px = x;
      py = y;
    }
  }
  // 연속 중복점 제거 + 닫힘 중복 제거
  const out = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || Math.abs(l[0] - p[0]) > 1e-7 || Math.abs(l[1] - p[1]) > 1e-7) out.push(p);
  }
  while (out.length > 1) {
    const f = out[0], l = out[out.length - 1];
    if (Math.abs(f[0] - l[0]) <= 1e-7 && Math.abs(f[1] - l[1]) <= 1e-7) out.pop();
    else break;
  }
  return out;
}

export function signedArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function polyBBox(p) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of p) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/** 링의 진행 방향을 뒤집는다 (명시적으로 닫힌 링 전제) */
export function reverseRing(ring) {
  const n = ring.length;
  const ends = ring.map(endPt);
  const out = [['M', ends[n - 1][0], ends[n - 1][1]]];
  for (let i = n - 1; i >= 1; i--) {
    const c = ring[i];
    const to = ends[i - 1];
    if (c[0] === 'L') out.push(['L', to[0], to[1]]);
    else if (c[0] === 'Q') out.push(['Q', c[1], c[2], to[0], to[1]]);
    else if (c[0] === 'A') out.push(['A', c[1], c[2], c[3], -c[4], to[0], to[1]]);
    else out.push(['C', c[3], c[4], c[1], c[2], to[0], to[1]]);
  }
  return out;
}

function pointInPoly(pt, poly) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 다각형들의 포함 관계(깊이, 직접 부모)를 계산 */
export function nestRings(polys) {
  const n = polys.length;
  const bb = polys.map(polyBBox);
  const ar = polys.map((p) => Math.abs(signedArea(p)));
  const parent = new Array(n).fill(-1);
  const depth = new Array(n).fill(0);
  const eps = 1e-6;
  for (let i = 0; i < n; i++) {
    const p = polys[i];
    const samples = [p[0], p[Math.floor(p.length / 3)], p[Math.floor((2 * p.length) / 3)]];
    let best = -1, bestArea = Infinity, d = 0;
    for (let j = 0; j < n; j++) {
      if (i === j || ar[j] <= ar[i]) continue;
      const a = bb[j], b = bb[i];
      if (a[0] > b[0] + eps || a[1] > b[1] + eps || a[2] < b[2] - eps || a[3] < b[3] - eps) continue;
      let inside = 0;
      for (const s of samples) if (pointInPoly(s, polys[j])) inside++;
      if (inside * 2 > samples.length) {
        d++;
        if (ar[j] < bestArea) {
          bestArea = ar[j];
          best = j;
        }
      }
    }
    parent[i] = best;
    depth[i] = d;
  }
  return { parent, depth };
}

/**
 * 한 색 레이어의 링들을 정리: 포함 관계로 바깥/구멍 판정,
 * 바깥은 한 방향, 구멍은 반대 방향으로 통일 (nonzero/evenodd 어느 쪽으로 읽어도 동일 결과)
 */
export function buildItems(rings, tol) {
  const rr = [];
  const polys = [];
  for (const r of rings) {
    if (!r || r.length < 2) continue;
    const cr = closeRing(r.slice());
    const p = flattenRing(cr, tol);
    if (p.length < 3) continue;
    if (Math.abs(signedArea(p)) < 1e-8) continue;
    rr.push(cr);
    polys.push(p);
  }
  const { parent, depth } = nestRings(polys);
  const items = [];
  for (let i = 0; i < rr.length; i++) {
    const hole = depth[i] % 2 === 1;
    let ring = rr[i];
    let poly = polys[i];
    const a = signedArea(poly);
    if ((hole && a > 0) || (!hole && a < 0)) {
      ring = reverseRing(ring);
      poly = poly.slice().reverse();
    }
    items.push({ ring, poly, hole, parent: parent[i] });
  }
  return items;
}

/** 소스 좌표의 레이어들을 너비(mm)에 맞춰 스케일하고 모델로 만든다 */
/** refWidth: 이 폭(원래 단위)을 widthMm로 맞춤 (글자별 크기·이동이 있어도 나머지 글자 크기가 흔들리지 않게). 없으면 실제 폭
 *  layer.plate: 받침판 모양용 — 범위 계산엔 넣고 model.plate로 따로 둠 */
export function makeModel(layers, widthMm, tol, refWidth) {
  const bbox = (ftol) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const l of layers) {
      for (const r of l.rings) {
        if (!r || r.length < 2) continue;
        for (const [x, y] of flattenRing(closeRing(r.slice()), ftol)) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    }
    return [x0, y0, x1, y1];
  };
  // 1차: 대략적인 범위 → 2차: 최종 단위(mm) 허용오차의 1/10로 곡선 극값까지 정확히
  let [x0, y0, x1, y1] = bbox(0.3);
  if (isFinite(x0) && x1 - x0 > 0) [x0, y0, x1, y1] = bbox(((x1 - x0) / widthMm) * tol * 0.1);
  if (!isFinite(x0) || x1 - x0 <= 0) {
    return { width: widthMm, height: 0, tol, layers: [], ringCount: 0, nodeCount: 0 };
  }
  const s = widthMm / (refWidth || x1 - x0);
  const out = [];
  let plate = null;
  let ringCount = 0;
  let nodeCount = 0;
  for (const l of layers) {
    const scaled = l.rings.filter((r) => r && r.length >= 2).map((r) => transformRing(closeRing(r.slice()), s, x0, y0));
    const items = buildItems(scaled, tol);
    if (!items.length) continue;
    if (l.plate) {
      plate = items;
      continue;
    }
    ringCount += items.length;
    for (const it of items) nodeCount += it.ring.length;
    out.push(l.dz ? { color: l.color, items, dz: l.dz } : { color: l.color, items });
  }
  return { width: (x1 - x0) * s, height: (y1 - y0) * s, tol, layers: out, ringCount, nodeCount, plate, xf: { s, x0, y0 } };
}
