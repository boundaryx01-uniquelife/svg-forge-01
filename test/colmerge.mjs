// 색 합치기(col)·같은 색으로(fill): 영역이 보존되는지
// 다른 색 도형 위에 얹힌 테두리를 그 색으로 바꾸면, 합쳐져야지 구멍이 되면 안 된다
import { applyEdits } from '../src/edit.js';
import { makeModel } from '../src/geom.js';

const rect = (x0, y0, x1, y1) => [['M', x0, y0], ['L', x1, y0], ['L', x1, y1], ['L', x0, y1], ['L', x0, y0]];
const area = (m, color) => {
  let a = 0;
  for (const l of m.layers) {
    if (color && l.color !== color) continue;
    for (const it of l.items) {
      let s = 0;
      for (let i = 0, j = it.poly.length - 1; i < it.poly.length; j = i++) s += (it.poly[j][0] - it.poly[i][0]) * (it.poly[j][1] + it.poly[i][1]);
      a += (it.hole ? -1 : 1) * Math.abs(s) / 2;
    }
  }
  return Math.round(a * 100) / 100;
};
let bad = 0;
const check = (label, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`${cond ? 'OK ' : '✗  '} ${label}${extra ? '  ' + extra : ''}`);
};
const RED = '#c9362b', NAVY = '#152741';
const build = (layers) => makeModel(layers, 100, 0.02); // 가로 100mm

// ── 1. 빨강 판 위에 얹힌 네이비 테두리를 빨강으로 ──
{
  const m = build([
    { color: RED, rings: [rect(0, 0, 100, 40)] },
    { color: NAVY, rings: [rect(20, 10, 40, 30), rect(22, 12, 38, 28)] }, // 바깥+안쪽 = 테두리
  ]);
  const red0 = area(m, RED), navy0 = area(m, NAVY);
  applyEdits(m, [{ t: 'col', c: NAVY, is: [0], to: RED, w0: 100 }], 0.02);
  const red1 = area(m, RED), navy1 = area(m, NAVY);
  console.log(`판 위 테두리 → 빨강 : 빨강 ${red0} → ${red1} · 네이비 ${navy0} → ${navy1}`);
  check('빨강 판에 구멍이 생기지 않음', Math.abs(red1 - red0) < 0.5, `기대 ${red0}, 실제 ${red1}`);
  check('네이비가 비워짐', navy1 < 0.5, `${navy1}`);
}

// ── 2. 빨강 판을 둘러싼 네이비 테두리를 빨강으로 ──
{
  const m = build([
    { color: NAVY, rings: [rect(0, 0, 100, 40), rect(3, 3, 97, 37)] },
    { color: RED, rings: [rect(3, 3, 97, 37)] },
  ]);
  const want = 100 * 40;
  applyEdits(m, [{ t: 'col', c: NAVY, is: [0], to: RED, w0: 100 }], 0.02);
  const red1 = area(m, RED);
  console.log(`둘러싼 테두리 → 빨강 : 빨강 ${red1} (기대 ${want})`);
  check('테두리와 판이 하나로 메워짐', Math.abs(red1 - want) < 1, `${red1}`);
}

// ── 3. 구멍이 있는 도형 위의 테두리 (구멍이 메워지면 안 됨) ──
{
  const m = build([
    { color: RED, rings: [rect(0, 0, 100, 40), rect(60, 10, 80, 30)] },   // 오른쪽에 구멍
    { color: NAVY, rings: [rect(10, 10, 30, 30), rect(12, 12, 28, 28)] },
  ]);
  const red0 = area(m, RED);
  applyEdits(m, [{ t: 'col', c: NAVY, is: [0], to: RED, w0: 100 }], 0.02);
  const red1 = area(m, RED);
  console.log(`구멍 있는 판 위 테두리 → 빨강 : 빨강 ${red0} → ${red1}`);
  check('원래 구멍이 그대로 남음', Math.abs(red1 - red0) < 0.5, `기대 ${red0}, 실제 ${red1}`);
}

// ── 4. 떨어져 있는 테두리 (단순 합산) ──
{
  const m = build([
    { color: RED, rings: [rect(0, 0, 40, 40)] },
    { color: NAVY, rings: [rect(60, 0, 100, 40), rect(65, 5, 95, 35)] },
  ]);
  const red0 = area(m, RED), navy0 = area(m, NAVY);
  applyEdits(m, [{ t: 'col', c: NAVY, is: [0], to: RED, w0: 100 }], 0.02);
  const red1 = area(m, RED);
  console.log(`떨어진 테두리 → 빨강 : 빨강 ${red0} + 네이비 ${navy0} = ${red1}`);
  check('떨어져 있으면 면적이 더해짐', Math.abs(red1 - (red0 + navy0)) < 0.5, `기대 ${red0 + navy0}, 실제 ${red1}`);
}

// ── 5. 같은 색으로(fill) 경로도 같은지 ──
{
  const m = build([
    { color: RED, rings: [rect(0, 0, 100, 40)] },
    { color: NAVY, rings: [rect(20, 10, 40, 30), rect(22, 12, 38, 28)] },
  ]);
  const red0 = area(m, RED);
  applyEdits(m, [{ t: 'fill', x: 21, y: 11, to: RED, w0: 100 }], 0.02); // 테두리 띠 위를 찍음
  const red1 = area(m, RED);
  console.log(`fill 로 테두리 → 빨강 : 빨강 ${red0} → ${red1}`);
  check('fill 경로도 구멍을 만들지 않음', red1 >= red0 - 0.5, `기대 ≥${red0}, 실제 ${red1}`);
}

console.log(bad ? `\n실패 ${bad}건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
