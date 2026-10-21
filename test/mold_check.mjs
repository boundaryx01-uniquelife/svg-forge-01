// 몰드·패턴: 패턴 6종이 실루엣 안에 제대로 들어가는지 (면적·링 수·최소 폭)
import { applyPattern, PATTERNS, patternPaths } from '../src/mold.js';
import { printabilityReport } from '../src/solid.js';
import { makeModel } from '../src/geom.js';

const SC = 1000;

/** 간단한 유령 비슷한 실루엣 (머리 반원 + 몸통 + 아래 물결) — mm 기준 60 × 80 */
function ghostRings() {
  const r = [];
  const W = 60, H = 80, cx = W / 2;
  r.push(['M', cx, 0]);
  for (let a = -90; a <= 90; a += 6) {
    const t = (a * Math.PI) / 180;
    r.push(['L', cx + 30 * Math.sin(t), 30 - 30 * Math.cos(t)]);
  }
  r.push(['L', W, H - 10]);
  for (let i = 0; i <= 6; i++) { // 밑단 물결
    const x = W - (i * W) / 6;
    r.push(['L', x, H - (i % 2 ? 0 : 12)]);
  }
  r.push(['L', 0, 30]);
  r.push(['L', cx, 0]);
  // 눈 두 개 (구멍)
  const eye = (ex, ey) => {
    const e = [];
    for (let a = 0; a <= 360; a += 15) {
      const t = (a * Math.PI) / 180;
      e.push([a ? 'L' : 'M', ex + 5 * Math.cos(t), ey + 6 * Math.sin(t)]);
    }
    return e;
  };
  return [r, eye(cx - 11, 26), eye(cx + 11, 26)];
}

const model = makeModel([{ color: '#222222', rings: ghostRings() }], 60, 0.05);
const area = (m) => {
  let a = 0;
  for (const l of m.layers) for (const it of l.items) {
    let s = 0;
    for (let i = 0, j = it.poly.length - 1; i < it.poly.length; j = i++)
      s += (it.poly[j][0] - it.poly[i][0]) * (it.poly[j][1] + it.poly[i][1]);
    a += (it.hole ? -1 : 1) * Math.abs(s) / 2;
  }
  return a;
};

const base = area(model);
console.log(`실루엣: ${model.width.toFixed(1)} × ${model.height.toFixed(1)} mm · 면적 ${base.toFixed(0)} mm² · 링 ${model.ringCount}`);
console.log('');

let bad = 0;
for (const p of PATTERNS) {
  const { model: m, info } = applyPattern(model, { pattern: p.id, width: 1.2, pitch: 5, wall: 2, spokes: 12 });
  const a = area(m);
  const rep = printabilityReport(m, { minWidth: 0.8 });
  const fill = ((a / base) * 100).toFixed(0);
  const flag = [];
  if (info.empty) flag.push('비었음');
  if (a >= base * 0.995) flag.push('속이 안 뚫림');
  if (a < base * 0.1) flag.push('너무 적음');
  if (rep.thin) flag.push(`가는부분 ${rep.thin}`);
  if (flag.length) bad++;
  console.log(
    `${p.name.padEnd(7)} 링 ${String(m.ringCount).padStart(3)} · 채움 ${fill.padStart(3)}% · ` +
    `면적 ${a.toFixed(0).padStart(5)} mm²  ${flag.length ? '⚠ ' + flag.join(', ') : 'OK'}`,
  );
}

// 선 폭이 좁아지면 가는 부분 경고가 떠야 정상
const thinOne = applyPattern(model, { pattern: 'grid', width: 0.4, pitch: 5, wall: 2 });
const repThin = printabilityReport(thinOne.model, { minWidth: 0.8 });
console.log(`\n선 폭 0.4mm → 가는 부분 ${repThin.thin}개 (0이면 검사기 미작동)`);
if (!repThin.thin) bad++;

// 패턴이 벽과 붙어 있는지: 조각(최상위 외곽 링) 수가 적어야 함 = 다 이어져 있음
const web = applyPattern(model, { pattern: 'web', width: 1.2, pitch: 5, wall: 2, spokes: 12 });
const outers = web.model.layers[0].items.filter((it) => !it.hole).length;
console.log(`거미줄 바깥 조각 ${outers}개 (1이면 전부 이어짐 — 떨어져 나간 패턴 없음)`);
if (outers > 2) bad++;

console.log(bad ? `\n실패 ${bad}건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
