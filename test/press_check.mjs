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

console.log(bad ? `\n실패 ${bad}건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
