// 음각 몰드: 메시가 닫혀 있는지 · 구배가 실제로 들어갔는지 · 크기가 맞는지
import { buildMold, patternFor } from '../src/mold.js';
import { makeModel } from '../src/geom.js';

function ghostRings() {
  const r = []; const W = 60, H = 80, cx = W / 2;
  r.push(['M', cx, 0]);
  for (let a = -90; a <= 90; a += 6) { const t = (a * Math.PI) / 180; r.push(['L', cx + 30 * Math.sin(t), 30 - 30 * Math.cos(t)]); }
  r.push(['L', W, H - 10]);
  for (let i = 0; i <= 6; i++) { const x = W - (i * W) / 6; r.push(['L', x, H - (i % 2 ? 0 : 12)]); }
  r.push(['L', 0, 30]); r.push(['L', cx, 0]);
  const eye = (ex, ey) => { const e = []; for (let a = 0; a <= 360; a += 15) { const t = (a * Math.PI) / 180; e.push([a ? 'L' : 'M', ex + 5 * Math.cos(t), ey + 6 * Math.sin(t)]); } return e; };
  return [r, eye(cx - 11, 26), eye(cx + 11, 26)];
}
const model = makeModel([{ color: '#222', rings: ghostRings() }], 60, 0.05);

/** 열린 모서리 수 (0이면 완전히 닫힌 메시) */
function openEdges(geom) {
  const p = geom.getAttribute('position').array;
  const key = (i) => [p[3 * i], p[3 * i + 1], p[3 * i + 2]].map((v) => v.toFixed(3)).join(',');
  const E = new Map();
  for (let t = 0; t < p.length / 9; t++) {
    for (let e = 0; e < 3; e++) {
      const a = key(3 * t + e), b = key(3 * t + ((e + 1) % 3));
      const k = a < b ? a + '|' + b : b + '|' + a;
      E.set(k, (E.get(k) || 0) + 1);
    }
  }
  let open = 0;
  for (const v of E.values()) if (v !== 2) open++;   // 4개 공유(내부 면)도 샌 것으로 본다
  return open;
}
const bbox = (g) => { g.computeBoundingBox(); const b = g.boundingBox; return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]; };

let bad = 0;
const check = (label, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`${cond ? 'OK ' : '✗  '} ${label}${extra ? '  ' + extra : ''}`);
};

// 1) 구배 없음
let r = buildMold(model, { draft: 0, depth: 4, floor: 2, flange: 5, clearance: 0.2, ribH: 0 });
let g = r.parts[0].geom;
let sz = bbox(g);
console.log(`구배 0° : 삼각형 ${(g.getAttribute('position').count / 3) | 0} · 층 ${r.info.steps} · 크기 ${sz.map((v) => v.toFixed(1)).join(' × ')} mm`);
check('구배 0° 메시가 닫힘', openEdges(g) === 0, `열린 모서리 ${openEdges(g)}`);
check('바깥 크기 = 도형 + 여유 + 플랜지 양쪽', Math.abs(sz[0] - (60 + 0.4 + 10)) < 0.6, `가로 ${sz[0].toFixed(2)}mm (기대 ≈70.4)`);
check('높이 = 바닥 + 깊이', Math.abs(sz[2] - 6) < 0.01, `${sz[2].toFixed(2)}mm`);

// 2) 구배 있음 — 층이 쪼개지고 여전히 닫혀 있어야
r = buildMold(model, { draft: 6, depth: 4, floor: 2, flange: 5, clearance: 0.2, ribH: 0 });
g = r.parts[0].geom;
console.log(`\n구배 6° : 삼각형 ${(g.getAttribute('position').count / 3) | 0} · 층 ${r.info.steps}`);
check('구배를 주면 층이 여러 개', r.info.steps > 10, `${r.info.steps}층`);
check('층 두께 < 0.2mm (프린터 레이어보다 얇음)', 4 / r.info.steps < 0.2, `${(4 / r.info.steps).toFixed(3)}mm`);
check('구배 6° 메시가 닫힘', openEdges(g) === 0, `열린 모서리 ${openEdges(g)}`);
check('경고 없음', !r.info.warn, String(r.info.warn));

// 3) 무늬 리브 포함
const ribs = patternFor(model, { pattern: 'web', width: 1.2, pitch: 5, spokes: 12 });
check('무늬 폴리곤 생성됨', ribs.length > 0, `${ribs.length}개`);
r = buildMold(model, { draft: 6, depth: 4, floor: 2, flange: 5, clearance: 0.2, ribs, ribH: 0.8 });
g = r.parts[0].geom;
console.log(`\n리브 포함 : 삼각형 ${(g.getAttribute('position').count / 3) | 0}`);
check('리브 포함 메시가 닫힘', openEdges(g) === 0, `열린 모서리 ${openEdges(g)}`);
check('리브 경고 없음', r.info.warn !== 'noRib');

// 4) 캐비티가 판보다 커지면 경고
r = buildMold(model, { draft: 19, depth: 20, floor: 2, flange: 1, clearance: 0.2, ribH: 0 });
check('캐비티가 판을 넘으면 경고', r.info.warn === 'cavityTooBig' || r.info.warn === 'cavityOutOfPlate', String(r.info.warn));

// 6) 무늬 6종 전부 닫힌 메시인지 (격자·삼각은 구멍이 많아 삼각분할이 잘 깨짐)
console.log('');
for (const kind of ['web', 'grid', 'hatch', 'tri', 'rings', 'spokes']) {
  const rb = patternFor(model, { pattern: kind, width: 1.2, pitch: 5, spokes: 12 });
  const mm = buildMold(model, { draft: 5, depth: 4, floor: 2, flange: 5, clearance: 0.2, ribs: rb, ribH: 0.8 });
  const oe = openEdges(mm.parts[0].geom);
  check(`${kind} 리브 몰드 닫힘`, oe === 0, `열린 모서리 ${oe}`);
}

// 5) 나란히 배치
r = buildMold(model, { draft: 5, depth: 4, floor: 2, flange: 5, clearance: 0.2, ribH: 0, shiftX: 100 });
r.parts[0].geom.computeBoundingBox();
check('shiftX 로 옆에 배치됨', r.parts[0].geom.boundingBox.min.x > 90, `x최소 ${r.parts[0].geom.boundingBox.min.x.toFixed(1)}`);

console.log(bad ? `\n실패 ${bad}건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
