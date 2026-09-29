import { arcSweep, flattenRing } from './geom.js';
// 내보내기: SVG(채움/레이저), DXF R12
const f = (v, p = 3) => {
  let s = v.toFixed(p);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
};

/** 원호 명령 → 3차 베지어 조각들 (90° 이하 조각은 오차 약 0.03%) */
function arcToCubics(from, c) {
  const cx = c[1], cy = c[2], r = c[3], dir = c[4];
  const sw = arcSweep(from, c);
  const k = Math.max(1, Math.ceil(sw / (Math.PI / 2 + 1e-9)));
  const a0 = Math.atan2(from[1] - cy, from[0] - cx);
  const seg = (dir * sw) / k;
  const h = (4 / 3) * Math.tan(seg / 4) * r;
  const out = [];
  for (let i = 0; i < k; i++) {
    const t0 = a0 + seg * i, t1 = t0 + seg;
    const p0 = [cx + r * Math.cos(t0), cy + r * Math.sin(t0)];
    const p3 = i === k - 1 ? [c[5], c[6]] : [cx + r * Math.cos(t1), cy + r * Math.sin(t1)];
    const c1 = [p0[0] - h * Math.sin(t0), p0[1] + h * Math.cos(t0)];
    const c2 = [p3[0] + h * Math.sin(t1), p3[1] - h * Math.cos(t1)];
    out.push([c1, c2, p3]);
  }
  return out;
}

export function ringToPath(ring, p = 3, closed = true) {
  let d = '';
  let cur = [0, 0];
  for (const c of ring) {
    if (c[0] === 'M') d += `M${f(c[1], p)} ${f(c[2], p)}`;
    else if (c[0] === 'L') d += `L${f(c[1], p)} ${f(c[2], p)}`;
    else if (c[0] === 'Q') d += `Q${f(c[1], p)} ${f(c[2], p)} ${f(c[3], p)} ${f(c[4], p)}`;
    else if (c[0] === 'A') {
      for (const [c1, c2, p3] of arcToCubics(cur, c)) d += `C${f(c1[0], p)} ${f(c1[1], p)} ${f(c2[0], p)} ${f(c2[1], p)} ${f(p3[0], p)} ${f(p3[1], p)}`;
    } else d += `C${f(c[1], p)} ${f(c[2], p)} ${f(c[3], p)} ${f(c[4], p)} ${f(c[5], p)} ${f(c[6], p)}`;
    cur = [c[c.length - 2], c[c.length - 1]];
  }
  return closed ? d + 'Z' : d;
}

/** 선분 식별 키 (방향 무관). 두 색이 공유하는 경계는 같은 키를 가진다 */
function segKey(from, c) {
  const r = (v) => Math.round(v * 1e4);
  let pts;
  if (c[0] === 'L') pts = [from, [c[1], c[2]]];
  else if (c[0] === 'Q') pts = [from, [c[1], c[2]], [c[3], c[4]]];
  else if (c[0] === 'C') pts = [from, [c[1], c[2]], [c[3], c[4]], [c[5], c[6]]];
  else pts = [from, [c[1], c[2]], [c[5], c[6]]];
  const f = pts.map((q) => r(q[0]) + ',' + r(q[1])).join(';');
  const b = pts.slice().reverse().map((q) => r(q[0]) + ',' + r(q[1])).join(';');
  return c[0] + (f < b ? f : b);
}

/**
 * 레이저용 경로: 여러 색이 공유하는 경계선은 한 번만 (이중 절단 방지).
 * 반환: [{ name, color, paths: [{ cmds, closed }] }]
 */
export function laserLayers(model, single) {
  const seen = new Set();
  const groups = single
    ? [{ name: 'CUT', color: '#000000', src: model.layers }]
    : model.layers.map((l, i) => ({ name: `LAYER${i + 1}_${l.color.slice(1).toUpperCase()}`, color: l.color, src: [l] }));
  for (const g of groups) {
    g.paths = [];
    for (const l of g.src) {
      for (const it of l.items) {
        const ring = it.ring;
        const pieces = [];
        let cur = null;
        let from = [ring[0][1], ring[0][2]];
        let dropped = false;
        for (let i = 1; i < ring.length; i++) {
          const c = ring[i];
          const k = segKey(from, c);
          if (seen.has(k)) {
            dropped = true;
            if (cur) pieces.push(cur);
            cur = null;
          } else {
            seen.add(k);
            if (!cur) cur = [['M', from[0], from[1]]];
            cur.push(c);
          }
          from = [c[c.length - 2], c[c.length - 1]];
        }
        if (cur) pieces.push(cur);
        if (!dropped && pieces.length === 1) {
          g.paths.push({ cmds: pieces[0], closed: true });
          continue;
        }
        // 링 시작점에서 끊긴 경우 마지막 조각과 첫 조각을 이어 붙임
        if (pieces.length > 1 && ring[1]) {
          const first = pieces[0], last = pieces[pieces.length - 1];
          const le = last[last.length - 1];
          if (first[0][1] === le[le.length - 2] && first[0][2] === le[le.length - 1] && first !== last) {
            pieces[pieces.length - 1] = last.concat(first.slice(1));
            pieces.shift();
          }
        }
        for (const pc of pieces) g.paths.push({ cmds: pc, closed: false });
      }
    }
  }
  return groups;
}

const head = (model, p, xmlDecl) => {
  const W = f(model.width, p);
  const H = f(model.height, p);
  return (
    (xmlDecl ? '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' : '') +
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">\n`
  );
};

/** 3D/MakerLab용: 색상별로 닫힌 채움 경로 1개(복합 경로). 선(stroke) 없음, 글자·곡선 모두 패스 */
export function toFillSvg(model, { p = 3, xmlDecl = true } = {}) {
  let s = head(model, p, xmlDecl);
  model.layers.forEach((l, i) => {
    const d = l.items.map((it) => ringToPath(it.ring, p)).join(' ');
    s += `  <path id="color${i + 1}" fill="${l.color}" fill-rule="evenodd" stroke="none" style="fill:${l.color};fill-rule:evenodd;stroke:none" d="${d}"/>\n`;
  });
  return s + '</svg>\n';
}

/** 레이저용: 채움 없이 윤곽선만(헤어라인). 색상 = 레이어 */
export function toLaserSvg(model, { p = 3, xmlDecl = true, single = false, strokeWidth = 0.1 } = {}) {
  let s = head(model, p, xmlDecl);
  laserLayers(model, single).forEach((g, i) => {
    const d = g.paths.map((pt) => ringToPath(pt.cmds, p, pt.closed)).join(' ');
    s += `  <path id="${single ? 'cut' : 'layer' + (i + 1)}" fill="none" stroke="${g.color}" stroke-width="${strokeWidth}" d="${d}"/>\n`;
  });
  return s + '</svg>\n';
}

// AutoCAD 기본 색상 번호(ACI) 근사
const ACI = [
  [1, 255, 0, 0],
  [2, 255, 255, 0],
  [3, 0, 255, 0],
  [4, 0, 255, 255],
  [5, 0, 0, 255],
  [6, 255, 0, 255],
  [7, 0, 0, 0],
  [8, 128, 128, 128],
  [9, 192, 192, 192],
];
function nearestAci(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  let best = 7, bd = Infinity;
  for (const [n, R, G, B] of ACI) {
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

/**
 * 링 → DXF 꼭짓점 [x, y, bulge]. 원호는 bulge(= tan(각/4))로 정확히, 베지어는 허용오차로 분할.
 * 좌표는 Y 아래 방향 그대로 (출력 시 뒤집으므로 bulge 부호도 반대로)
 */
export function ringToDxfVertices(ring, tol, closed = true) {
  const V = [];
  let cur = [ring[0][1], ring[0][2]];
  const start = cur;
  for (let i = 1; i < ring.length; i++) {
    const c = ring[i];
    const to = [c[c.length - 2], c[c.length - 1]];
    if (c[0] === 'A') {
      const sw = arcSweep(cur, c);
      V.push([cur[0], cur[1], -c[4] * Math.tan(sw / 4)]);
    } else if (c[0] === 'L') {
      V.push([cur[0], cur[1], 0]);
    } else {
      const pts = flattenRing([['M', cur[0], cur[1]], c], tol);
      // flattenRing은 닫힘 중복을 지우므로 끝점 이전까지 사용
      for (const q of pts) if (Math.hypot(q[0] - to[0], q[1] - to[1]) > 1e-9) V.push([q[0], q[1], 0]);
    }
    cur = to;
  }
  // 마지막 점이 시작점과 같으면 제거 (닫힌 폴리라인)
  if (!closed || Math.hypot(cur[0] - start[0], cur[1] - start[1]) > 1e-7) V.push([cur[0], cur[1], 0]);
  // 연속 중복 제거
  const out = [];
  for (const v of V) {
    const l = out[out.length - 1];
    if (l && Math.hypot(l[0] - v[0], l[1] - v[1]) < 1e-7) {
      if (v[2]) l[2] = v[2];
      continue;
    }
    out.push(v);
  }
  return out;
}

/** DXF R12 (ASCII, POLYLINE). 단위 mm, Y축 위쪽 기준(뒤집어 출력). RDWorks/LightBurn 호환 */
export function toDxf(model, { single = false } = {}) {
  const NL = '\r\n';
  const H = model.height;
  const g = [];
  const add = (code, val) => g.push(String(code), String(val));
  const layerDefs = laserLayers(model, single).map((g) => ({ name: g.name, aci: single ? 7 : nearestAci(g.color), paths: g.paths }));

  add(0, 'SECTION'); add(2, 'HEADER');
  add(9, '$ACADVER'); add(1, 'AC1009');
  add(0, 'ENDSEC');

  add(0, 'SECTION'); add(2, 'TABLES');
  add(0, 'TABLE'); add(2, 'LTYPE'); add(70, 1);
  add(0, 'LTYPE'); add(2, 'CONTINUOUS'); add(70, 0); add(3, 'Solid line'); add(72, 65); add(73, 0); add(40, '0.0');
  add(0, 'ENDTAB');
  add(0, 'TABLE'); add(2, 'LAYER'); add(70, layerDefs.length + 1);
  add(0, 'LAYER'); add(2, '0'); add(70, 0); add(62, 7); add(6, 'CONTINUOUS');
  for (const L of layerDefs) {
    add(0, 'LAYER'); add(2, L.name); add(70, 0); add(62, L.aci); add(6, 'CONTINUOUS');
  }
  add(0, 'ENDTAB');
  add(0, 'ENDSEC');

  add(0, 'SECTION'); add(2, 'ENTITIES');
  for (const L of layerDefs) {
    for (const pt of L.paths) {
      add(0, 'POLYLINE'); add(8, L.name); add(66, 1); add(70, pt.closed ? 1 : 0);
      for (const v of ringToDxfVertices(pt.cmds, model.tol, pt.closed)) {
        add(0, 'VERTEX'); add(8, L.name);
        add(10, v[0].toFixed(4)); add(20, (H - v[1]).toFixed(4)); add(30, '0.0');
        if (v[2]) add(42, v[2].toFixed(8));
      }
      add(0, 'SEQEND'); add(8, L.name);
    }
  }
  add(0, 'ENDSEC');
  add(0, 'EOF');
  return g.join(NL) + NL;
}
