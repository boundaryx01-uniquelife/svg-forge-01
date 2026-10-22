// 성형 틀: 수틀·암틀이 닫힌 메시인지 · 돔 높이와 간격이 실제로 반영되는지
import ClipperLib from 'clipper-lib';
import { buildPressMold, smoothSil, toPathH, union } from '../src/mold.js';
import { makeModel } from '../src/geom.js';

function ghostRings() {
  const r = []; const W = 60, H = 80, cx = W / 2;
  r.push(['M', cx, 0]);
  for (let a = -90; a <= 90; a += 6) { const t = (a * Math.PI) / 180; r.push(['L', cx + 30 * Math.sin(t), 30 - 30 * Math.cos(t)]); }
  r.push(['L', W, H - 10]);
  for (let i = 0; i <= 6; i++) { const x = W - (i * W) / 6; r.push(['L', x, H - (i % 2 ? 0 : 12)]); }
  r.push(['L', 0, 30]); r.push(['L', cx, 0]);
  return [r];
}
const model = makeModel([{ color: '#222', rings: ghostRings() }], 60, 0.05);

function openEdges(geom) {
  const p = geom.getAttribute('position').array;
  const key = (i) => [p[3 * i], p[3 * i + 1], p[3 * i + 2]].map((v) => v.toFixed(3)).join(',');
  const E = new Map();
  for (let t = 0; t < p.length / 9; t++) for (let e = 0; e < 3; e++) {
    const a = key(3 * t + e), b = key(3 * t + ((e + 1) % 3));
    const k = a < b ? a + '|' + b : b + '|' + a;
    E.set(k, (E.get(k) || 0) + 1);
  }
  let o = 0; for (const v of E.values()) if (v % 2 === 1) o++;
  return o;
}
const box = (g) => { g.computeBoundingBox(); const b = g.boundingBox; return { w: b.max.x - b.min.x, d: b.max.y - b.min.y, h: b.max.z - b.min.z, x0: b.min.x }; };

let bad = 0;
const check = (l, c, e = '') => { if (!c) bad++; console.log(`${c ? 'OK ' : '✗  '} ${l}${e ? '  ' + e : ''}`); };

const r = buildPressMold(model, { domeH: 12, gap: 3.4, flange: 6, floor: 2.5, out: 'both', gapX: 90 });
console.log(`돔 ${r.info.domeH}mm · 밑면반지름 ${r.info.r0.toFixed(1)}mm · 층 ${r.info.steps} · 늘어남 ${(r.info.stretch * 100).toFixed(1)}%`);
check('두 짝이 나옴', r.parts.length === 2, `${r.parts.length}개`);
const male = r.parts.find((p) => p.name.includes('수틀')), female = r.parts.find((p) => p.name.includes('암틀'));
const bm = box(male.geom), bf = box(female.geom);
console.log(`수틀 ${bm.w.toFixed(1)} × ${bm.d.toFixed(1)} × ${bm.h.toFixed(1)} mm · 삼각형 ${(male.geom.getAttribute('position').count / 3) | 0}`);
console.log(`암틀 ${bf.w.toFixed(1)} × ${bf.d.toFixed(1)} × ${bf.h.toFixed(1)} mm · 삼각형 ${(female.geom.getAttribute('position').count / 3) | 0}`);
check('수틀 메시 닫힘', openEdges(male.geom) === 0, `열린 모서리 ${openEdges(male.geom)}`);
check('암틀 메시 닫힘', openEdges(female.geom) === 0, `열린 모서리 ${openEdges(female.geom)}`);
check('수틀 높이 = 바닥 + 돔', Math.abs(bm.h - (2.5 + 12)) < 0.3, `${bm.h.toFixed(2)}`);
check('암틀이 수틀보다 간격만큼 높음', bf.h > bm.h + 3.0 && bf.h < bm.h + 3.8, `수틀 ${bm.h.toFixed(1)} / 암틀 ${bf.h.toFixed(1)}`);
check('암틀이 옆에 배치됨', bf.x0 > 80, `x최소 ${bf.x0.toFixed(1)}`);
check('경고 없음', !r.info.warn, String(r.info.warn));

// 돔을 너무 높이면 늘어남 경고
const hi = buildPressMold(model, { domeH: 26, gap: 3.4, flange: 6, out: 'maleOnly' });
check('돔이 너무 높으면 경고', hi.info.warn === 'tooHigh', `늘어남 ${(hi.info.stretch * 100).toFixed(1)}%`);
check('낮은 돔은 경고 없음', !buildPressMold(model, { domeH: 6, gap: 3.4, out: 'maleOnly' }).info.warn);

// 한 짝만
const only = buildPressMold(model, { domeH: 10, gap: 3, out: 'maleOnly' });
check('수틀만 출력', only.parts.length === 1 && only.parts[0].name.includes('수틀'));

// 핀 없이도 닫힘
const np = buildPressMold(model, { domeH: 10, gap: 3, out: 'both', gapX: 90 });
check('핀 없이 수틀 닫힘', openEdges(np.parts[0].geom) === 0);
check('핀 없이 암틀 닫힘', openEdges(np.parts[1].geom) === 0);

// ── 솟은 기둥·송곳이 없어야 (정렬 핀 제거) ──
console.log('');
{
  const pr = buildPressMold(model, { domeH: 12, gap: 3.4, flange: 6, floor: 2.5, out: 'both', gapX: 0 });
  const M = pr.parts[0].geom, F = pr.parts[1].geom;
  // 돔은 안쪽(테두리 안)에만 있어야 한다. 플랜지 위로 솟은 점이 있으면 기둥이다
  M.computeBoundingBox();
  const bb = M.boundingBox;
  const p = M.getAttribute('position').array;
  let tall = 0;
  for (let i = 0; i < p.length / 3; i++) {
    const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
    const onFlange = x < bb.min.x + 5 || x > bb.max.x - 5 || y < bb.min.y + 5 || y > bb.max.y - 5;
    if (onFlange && z > 2.5 + 0.3) tall++;           // 바닥(floor 2.5) 위로 솟음
  }
  console.log(`플랜지 위로 솟은 점 ${tall}개`);
  check('플랜지에 기둥이 없음', tall === 0, `${tall}개`);

  // ── 맞춤 모서리: 판 한 귀퉁이가 잘려 있고, 암틀은 반대쪽이어야 (뒤집으면 맞음) ──
  const corner = (g, z0, z1) => {
    const q = g.getAttribute('position').array;
    g.computeBoundingBox(); const B = g.boundingBox;
    const near = (x, y) => {
      let m = 1e9;
      for (let i = 0; i < q.length / 3; i++) { const z = q[3 * i + 2];
        if (z > z0 && z < z1) m = Math.min(m, Math.hypot(q[3 * i] - x, q[3 * i + 1] - y)); }
      return m;
    };
    return { LL: near(B.min.x, B.min.y), LR: near(B.max.x, B.min.y), UL: near(B.min.x, B.max.y), UR: near(B.max.x, B.max.y) };
  };
  const cm = corner(M, -0.05, 0.05), cf = corner(F, -0.05, 0.05);   // 바닥면 꼭짓점
  const far = (c) => Object.entries(c).sort((u, v) => v[1] - u[1])[0];
  const [mName, mD] = far(cm), [fName, fD] = far(cf);
  console.log(`잘린 귀퉁이 — 수틀 ${mName} (${mD.toFixed(1)}mm) · 암틀 ${fName} (${fD.toFixed(1)}mm) · 표시크기 ${pr.info.key}mm`);
  check('수틀 한 귀퉁이가 잘려 있음', mD > 1.5, `${mD.toFixed(1)}mm`);
  check('암틀은 좌우 반대쪽 귀퉁이', fName === { LL: 'LR', LR: 'LL', UL: 'UR', UR: 'UL' }[mName], `${mName} ↔ ${fName}`);
}

// ── 틀 면이 매끈한지: 구멍·가는 돌기가 틀에 남으면 안 된다 ──
console.log('');
{
  // 네모 몸통 + 눈 구멍 2개 + 위로 뻗은 0.8mm 송곳
  const body = [['M', 10, 20], ['L', 50, 20], ['L', 50, 60], ['L', 10, 60], ['L', 10, 20]];
  const eye = (cx) => [['M', cx - 4, 30], ['L', cx + 4, 30], ['L', cx + 4, 38], ['L', cx - 4, 38], ['L', cx - 4, 30]];
  const spike = [['M', 29.6, 20], ['L', 30.4, 20], ['L', 30.4, 4], ['L', 29.6, 4], ['L', 29.6, 20]];
  const m2 = makeModel([{ color: '#222', rings: [body, eye(22), eye(38), spike] }], 60, 0.05);

  // 틀에 쓰이는 실루엣을 직접 본다 (메시 꼭짓점 수로는 면의 구멍을 가늠할 수 없다)
  const SCL = 1000;
  const raw = union(m2.layers.flatMap((l) => l.items.map((it) => toPathH(it.poly, m2.height))), ClipperLib.PolyFillType.pftEvenOdd);
  const sm = smoothSil(raw, 1.0);
  const area = (ps) => ps.reduce((t, q) => t + ClipperLib.Clipper.Area(q), 0) / (SCL * SCL);
  const neg = (ps) => ps.filter((q) => ClipperLib.Clipper.Area(q) < 0).length;   // 구멍 = 반대 방향 고리
  const bb = (ps) => { let a = 1e9, b = -1e9; for (const q of ps) for (const pt of q) (pt.Y / SCL < a && (a = pt.Y / SCL), pt.Y / SCL > b && (b = pt.Y / SCL)); return b - a; };
  console.log(`실루엣 — 그대로: 넓이 ${area(raw).toFixed(0)}mm² 구멍 ${neg(raw)}개 세로 ${bb(raw).toFixed(1)}mm / 매끈: 넓이 ${area(sm).toFixed(0)}mm² 구멍 ${neg(sm)}개 세로 ${bb(sm).toFixed(1)}mm`);
  check('눈 구멍이 메워짐', neg(raw) > 0 && neg(sm) === 0, `${neg(raw)} → ${neg(sm)}`);
  check('가는 송곳이 사라짐 (세로가 송곳 길이만큼 줄어듦)', bb(raw) - bb(sm) > 15, `${bb(raw).toFixed(1)} → ${bb(sm).toFixed(1)}mm`);
  check('몸통은 그대로 남음', area(sm) > 3300, `${area(sm).toFixed(0)}mm²`);

  const mold = buildPressMold(m2, { domeH: 8, gap: 3.4, flange: 6, floor: 2.5, out: 'maleOnly' });
  check('매끈 처리 반지름이 잡힘', mold.info.smoothR >= 0.6, `${mold.info.smoothR}mm`);
  check('매끈 틀도 메시가 닫힘', openEdges(mold.parts[0].geom) === 0, `열린 모서리 ${openEdges(mold.parts[0].geom)}`);
  const off = buildPressMold(m2, { domeH: 8, gap: 3.4, out: 'maleOnly', smooth: false });
  check('끄면 예전처럼 원래 실루엣', !off.info.smoothR, `${off.info.smoothR}`);
}

// ── 좌우 비대칭 도형: 암틀이 좌우 반전되어 있어야 뒤집어 덮었을 때 맞는다 ──
{
  const skew = [[['M', 0, 0], ['L', 70, 0], ['L', 56, 60], ['L', 0, 70], ['L', 0, 0]]];
  const mdl = makeModel([{ color: '#222', rings: skew }], 70, 0.05);
  const GAP = 3.4, DOME = 10, FLOOR = 2.5;
  const pr = buildPressMold(mdl, { domeH: DOME, gap: GAP, flange: 6, floor: FLOOR, out: 'both', gapX: 0 });
  const M = pr.parts[0].geom, F = pr.parts[1].geom;
  M.computeBoundingBox(); F.computeBoundingBox();
  const fTop = F.boundingBox.max.z;
  const midX = (M.boundingBox.min.x + M.boundingBox.max.x) / 2;
  const yMid = (M.boundingBox.min.y + M.boundingBox.max.y) / 2;
  // y 평면으로 삼각형을 잘라 단면 선분을 얻고, 거기서 높이 z 의 x 범위를 구한다 (정확)
  const segs = (g, y0) => {
    const p = g.getAttribute('position').array, out = [];
    for (let t = 0; t < p.length / 9; t++) {
      const V = [0, 1, 2].map((i) => [p[9 * t + 3 * i], p[9 * t + 3 * i + 1], p[9 * t + 3 * i + 2]]);
      const pts = [];
      for (let i = 0; i < 3; i++) {
        const a2 = V[i], b2 = V[(i + 1) % 3];
        if ((a2[1] - y0) * (b2[1] - y0) < 0) { const u = (y0 - a2[1]) / (b2[1] - a2[1]); pts.push([a2[0] + u * (b2[0] - a2[0]), a2[2] + u * (b2[2] - a2[2])]); }
      }
      if (pts.length === 2) out.push(pts);
    }
    return out;
  };
  // 높이 z 에서 재료 경계가 지나는 x 값들 (정렬)
  const crossX = (sg, z) => {
    const xs = [];
    for (const [P1, P2] of sg) {
      if ((P1[1] - z) * (P2[1] - z) < 0) { const u = (z - P1[1]) / (P2[1] - P1[1]); xs.push(P1[0] + u * (P2[0] - P1[0])); }
    }
    xs.sort((a2, b2) => a2 - b2);
    // 0.5mm 안쪽으로 붙은 값은 하나로
    return xs.filter((v, i) => i === 0 || v - xs[i - 1] > 0.5);
  };
  // 수틀: 바깥 두 점 = 돔 / 암틀: 가운데 두 점 = 캐비티 (바깥 두 점은 판 테두리)
  const domeSpan = (sg, z) => { const x = crossX(sg, z); return x.length >= 2 ? [x[0], x[x.length - 1]] : null; };
  const cavSpan = (sg, z) => { const x = crossX(sg, z); return x.length >= 4 ? [x[1], x[x.length - 2]] : null; };
  const zz = FLOOR + DOME * 0.5;
  const sm = domeSpan(segs(M, yMid), zz);
  const sf = cavSpan(segs(F, yMid), fTop - (zz - FLOOR) - GAP);
  const mir = sf ? [2 * midX - sf[1], 2 * midX - sf[0]] : null;
  console.log(`\n비대칭 도형 · 돔 중간 단면 x범위`);
  console.log(`  수틀         ${sm ? sm.map((v) => v.toFixed(1)).join(' ~ ') : '-'}`);
  console.log(`  암틀(뒤집음) ${mir ? mir.map((v) => v.toFixed(1)).join(' ~ ') : '-'}`);
  check('암틀을 뒤집으면 수틀과 같은 쪽을 본다', !!(sm && mir) && Math.abs((mir[0] + mir[1]) / 2 - (sm[0] + sm[1]) / 2) < 4,
    sm && mir ? `중심차 ${Math.abs((mir[0] + mir[1]) / 2 - (sm[0] + sm[1]) / 2).toFixed(1)}mm` : '단면 없음');
  check('암틀 단면이 수틀보다 간격만큼 넓음', mir && (mir[1] - mir[0]) > (sm[1] - sm[0]) && (mir[1] - mir[0]) - (sm[1] - sm[0]) < GAP * 4,
    mir ? `수틀 ${(sm[1] - sm[0]).toFixed(1)} / 암틀 ${(mir[1] - mir[0]).toFixed(1)}mm` : '');
}

console.log(bad ? `\n실패 ${bad}건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
