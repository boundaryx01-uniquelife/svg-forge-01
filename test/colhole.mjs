// 재현: col op 의 대상이 '구멍' 아이템일 때
import { applyEdits } from '/home/claude/svg-forge/src/edit.js';
import { makeModel } from '/home/claude/svg-forge/src/geom.js';
const rect = (x0, y0, x1, y1) => [['M', x0, y0], ['L', x1, y0], ['L', x1, y1], ['L', x0, y1], ['L', x0, y0]];
const pa = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return Math.abs(a) / 2; };
const ar = (m, c) => { let a = 0; for (const l of m.layers) { if (c && l.color !== c) continue; for (const it of l.items) a += (it.hole ? -1 : 1) * pa(it.poly); } return Math.round(a * 100) / 100; };
const dump = (m) => m.layers.map((l) => `${l.color}[${l.items.map((it) => (it.hole ? 'H' : 'S') + Math.round(pa(it.poly))).join(' ')}] = ${ar(m, l.color)}`).join('\n   ');
const A = '#c9362b', B = '#152741';

console.log('## R1: 구멍 하나 → B  (겹침 발생)');
{
  const m = makeModel([{ color: A, rings: [rect(0, 0, 100, 60), rect(30, 20, 70, 40)] }], 100, 0.02);
  console.log('  전:', dump(m), '\n   전체 합', ar(m));
  const hi = m.layers[0].items.findIndex((it) => it.hole);
  applyEdits(m, [{ t: 'col', c: A, is: [hi], to: B, w0: 100 }], 0.02);
  console.log('  후:', dump(m), '\n   전체 합', ar(m), ' ← 판 전체는 6000. 800 이 두 색에 중복 계산');
}

console.log('\n## R2: 구멍 속 같은 색 섬이 있을 때 구멍만 → B  (섬이 구멍으로 뒤집힘)');
{
  const m = makeModel([{ color: A, rings: [rect(0, 0, 100, 60), rect(20, 15, 80, 45), rect(35, 25, 65, 35)] }], 100, 0.02);
  console.log('  전:', dump(m));
  const hi = m.layers[0].items.findIndex((it) => it.hole);
  applyEdits(m, [{ t: 'col', c: A, is: [hi], to: B, w0: 100 }], 0.02);
  console.log('  후:', dump(m));
  console.log('  기대: A = 6000-1800+300 = 4500 그대로,  B = 1800-300 = 1500');
  console.log('  실제: A =', ar(m, A), ' B =', ar(m, B), ' (섬 300 이 A 에서 사라지고 B 가 덮음)');
}

console.log('\n## R3: 같은 구멍을 fill(스포이드) 로 바꾸면? (정상 경로 비교)');
{
  const m = makeModel([{ color: A, rings: [rect(0, 0, 100, 60), rect(20, 15, 80, 45), rect(35, 25, 65, 35)] }], 100, 0.02);
  applyEdits(m, [{ t: 'fill', x: 25, y: 30, to: B, w0: 100 }], 0.02);
  console.log('  후:', dump(m), '  ← A 4500 / B 1500 로 올바름');
}

console.log('\n## R4: 다른 색 섬이 구멍에 있을 때 구멍만 → 그 섬 색으로');
{
  const m = makeModel([
    { color: A, rings: [rect(0, 0, 100, 60), rect(20, 15, 80, 45)] },
    { color: B, rings: [rect(35, 25, 65, 35)] },
  ], 100, 0.02);
  console.log('  전:', dump(m));
  const hi = m.layers[0].items.findIndex((it) => it.hole);
  applyEdits(m, [{ t: 'col', c: A, is: [hi], to: B, w0: 100 }], 0.02);
  console.log('  후:', dump(m));
  console.log('  기대 A 4200(구멍 메워지지 않음) / B 1800 ;  실제 A', ar(m, A), '/ B', ar(m, B), ' 합', ar(m));
}
