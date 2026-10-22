// 성형 틀: 수틀·암틀이 닫힌 메시인지 · 돔 높이와 간격이 실제로 반영되는지
import { buildPressMold } from '../src/mold.js';
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

const r = buildPressMold(model, { domeH: 12, gap: 3.4, flange: 6, floor: 2.5, pinD: 4, out: 'both', gapX: 90 });
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
const hi = buildPressMold(model, { domeH: 26, gap: 3.4, flange: 6, pinD: 0, out: 'maleOnly' });
check('돔이 너무 높으면 경고', hi.info.warn === 'tooHigh', `늘어남 ${(hi.info.stretch * 100).toFixed(1)}%`);
check('낮은 돔은 경고 없음', !buildPressMold(model, { domeH: 6, gap: 3.4, pinD: 0, out: 'maleOnly' }).info.warn);

// 한 짝만
const only = buildPressMold(model, { domeH: 10, gap: 3, pinD: 4, out: 'maleOnly' });
check('수틀만 출력', only.parts.length === 1 && only.parts[0].name.includes('수틀'));

// 핀 없이도 닫힘
const np = buildPressMold(model, { domeH: 10, gap: 3, pinD: 0, out: 'both', gapX: 90 });
check('핀 없이 수틀 닫힘', openEdges(np.parts[0].geom) === 0);
check('핀 없이 암틀 닫힘', openEdges(np.parts[1].geom) === 0);

// ── 핀이 실제로 들어가는지: 핀 자리에서 암틀이 전층 뚫려 있어야 ──
function nearZ(geom, px, py, rad) {
  const p = geom.getAttribute('position').array; let lo = 1e9, hi = -1e9, n = 0;
  for (let i = 0; i < p.length / 3; i++) {
    const x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
    if (Math.hypot(x - px, y - py) < rad) { lo = Math.min(lo, z); hi = Math.max(hi, z); n++; }
  }
  return n ? { lo, hi, n } : null;
}
console.log('');
{
  const pr = buildPressMold(model, { domeH: 12, gap: 3.4, flange: 6, floor: 2.5, pinD: 4, out: 'both', gapX: 0 });
  const M = pr.parts[0].geom, F = pr.parts[1].geom;
  // 수틀에서 바닥 위로 솟은 핀 찾기
  const pm = M.getAttribute('position').array;
  let px = null, py = null;
  for (let i = 0; i < pm.length / 3; i++) {
    const x = pm[3 * i], y = pm[3 * i + 1], z = pm[3 * i + 2];
    if (z > 2.6 && z < 10 && (px === null || x < px)) { px = x; py = y; }
  }
  const mp = nearZ(M, px, py, 3.5), fp2 = nearZ(F, px, py, 3.5);
  F.computeBoundingBox();
  const fTop = F.boundingBox.max.z;
  console.log(`핀 자리 (${px.toFixed(1)}, ${py.toFixed(1)}) · 수틀 핀 z ${mp.lo.toFixed(1)}~${mp.hi.toFixed(1)} · 암틀 z ${fp2.lo.toFixed(1)}~${fp2.hi.toFixed(1)} (전체 ${fTop.toFixed(1)})`);
  check('핀 구멍이 암틀 전층을 관통', fp2.hi > fTop - 0.3, `구멍 끝 ${fp2.hi.toFixed(1)} / 윗면 ${fTop.toFixed(1)}`);
  check('핀 높이가 간격보다 큼 (헛돌지 않게)', mp.hi - 2.5 > 3.4, `핀 ${(mp.hi - 2.5).toFixed(1)}mm / 간격 3.4mm`);

  // ── 암틀이 좌우 반전되어 있는지 (뒤집어 덮어야 맞음) ──
  const cx = (x) => { let s2 = 0, n = 0; const p = x.getAttribute('position').array;
    for (let i = 0; i < p.length / 3; i++) if (p[3 * i + 2] > 3) { s2 += p[3 * i]; n++; } return n ? s2 / n : 0; };
  // 비대칭 도형(유령 밑단 물결)이므로 반전되면 돔 단면이 달라진다 — 같은 높이에서 x 분포 비교
  const span = (g, z0, z1) => { const p = g.getAttribute('position').array; let a = 1e9, b = -1e9;
    for (let i = 0; i < p.length / 3; i++) { const z = p[3 * i + 2]; if (z > z0 && z < z1) { a = Math.min(a, p[3 * i]); b = Math.max(b, p[3 * i]); } } return [a, b]; };
  const sM = span(M, 8, 9), sF = span(F, 8, 9);
  console.log(`z=8~9 에서 x범위 — 수틀 ${sM.map((v) => v.toFixed(1)).join('~')} · 암틀 ${sF.map((v) => v.toFixed(1)).join('~')}`);
  check('두 짝 x 범위가 겹침 (크게 어긋나지 않음)', Math.abs((sM[0] + sM[1]) / 2 - (sF[0] + sF[1]) / 2) < 3,
    `중심 ${((sM[0] + sM[1]) / 2).toFixed(1)} vs ${((sF[0] + sF[1]) / 2).toFixed(1)}`);
}

// ── 좌우 비대칭 도형: 암틀이 좌우 반전되어 있어야 뒤집어 덮었을 때 맞는다 ──
{
  const skew = [[['M', 0, 0], ['L', 70, 0], ['L', 56, 60], ['L', 0, 70], ['L', 0, 0]]];
  const mdl = makeModel([{ color: '#222', rings: skew }], 70, 0.05);
  const GAP = 3.4, DOME = 10, FLOOR = 2.5;
  const pr = buildPressMold(mdl, { domeH: DOME, gap: GAP, flange: 6, floor: FLOOR, pinD: 0, out: 'both', gapX: 0 });
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
