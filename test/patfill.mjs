// 몰드·패턴 실루엣: 여러 색 레이어 · 채운 구멍 · 배경색 안쪽 면
import { applyPattern } from '../src/mold.js';
import { makeModel } from '../src/geom.js';

const circle = (cx, cy, r, n = 64) => { const o = []; for (let i = 0; i < n; i++) { const t = (2 * Math.PI * i) / n; o.push([i ? 'L' : 'M', cx + r * Math.cos(t), cy + r * Math.sin(t)]); } o.push(['L', cx + r, cy]); return o; };
const rect = (a, b, c, d) => [['M', a, b], ['L', c, b], ['L', c, d], ['L', a, d], ['L', a, b]];
const pip = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
/** 원 안을 격자로 찍어 색별 덮인 비율(%) */
function cover(m, cx, cy, r) {
  const cnt = {}; let tot = 0;
  for (let i = 0; i < 60; i++) for (let j = 0; j < 60; j++) {
    const x = cx - r + (2 * r * i) / 59, y = cy - r + (2 * r * j) / 59;
    if (Math.hypot(x - cx, y - cy) > r) continue;
    tot++;
    for (const l of m.layers) { let ins = false; for (const it of l.items) if (pip(it.poly, x, y)) ins = !ins; if (ins) cnt[l.color] = (cnt[l.color] || 0) + 1; }
  }
  const o = { tot: 0 }; for (const [k, v] of Object.entries(cnt)) (o[k] = Math.round((100 * v) / tot), (o.tot += v));
  o.덮임 = Math.round((100 * o.tot) / tot); delete o.tot; return o;
}
let bad = 0;
const check = (l, c, e = '') => { if (!c) bad++; console.log(`${c ? 'OK ' : '✗  '} ${l}${e ? '  ' + e : ''}`); };
const P = { pattern: 'grid', width: 1.2, pitch: 5, wall: 2, color: '#1b1b1b', fill: true, fillColor: '#e8e2d0' };
const body = rect(5, 5, 95, 95);

// ── 1. 구멍은 구멍으로 남는다 ──
{
  const m = makeModel([{ color: '#000000', rings: [body, circle(30, 30, 8), circle(70, 30, 8)] }], 100, 0.05);
  const r = applyPattern(m, P);
  const L = cover(r.model, 30, 30, 6);
  console.log('구멍 그대로 — 눈 안쪽:', JSON.stringify(L));
  check('구멍 안은 거의 비어 있음', L.덮임 < 15, `${L.덮임}%`);
}

// ── 2. 채우기로 칠한 색은 무늬에 먹히지 않고 제 색으로 남는다 ──
{
  const m = makeModel([
    { color: '#000000', rings: [body, circle(30, 30, 8), circle(70, 30, 8)] },
    { color: '#e03131', rings: [circle(30, 30, 8)] },            // 눈을 빨강으로 채움
  ], 100, 0.05);
  const r = applyPattern(m, P);
  const L = cover(r.model, 30, 30, 6), R = cover(r.model, 70, 30, 6), B = cover(r.model, 50, 60, 6);
  console.log('빨강 눈 —  왼눈:', JSON.stringify(L), ' 오른눈:', JSON.stringify(R), ' 몸통:', JSON.stringify(B));
  check('칠한 눈이 빨강으로 꽉 참', L['#e03131'] > 90, `빨강 ${L['#e03131'] || 0}%`);
  check('칠한 눈 위에 무늬가 겹치지 않음', (L['#1b1b1b'] || 0) < 8, `무늬 ${L['#1b1b1b'] || 0}%`);
  check('칠한 눈에 채움색이 끼어들지 않음', (L['#e8e2d0'] || 0) < 8, `채움 ${L['#e8e2d0'] || 0}%`);
  check('안 채운 눈은 그대로 비어 있음', R.덮임 < 15, `${R.덮임}%`);
  check('몸통은 무늬 + 채움 그대로', B.덮임 > 90 && B['#1b1b1b'] > 20, `${B.덮임}% · 무늬 ${B['#1b1b1b']}%`);
  const red = r.model.layers.find((l) => l.color === '#e03131');
  check('빨강이 제 레이어로 남음', !!red, red ? `조각 ${red.items.length}개` : '없음');
  // 벽 폭만 한 찌꺼기 덩어리가 박히면 안 된다 (경계에 남는 미세 구멍 → 그 둘레로 벽이 생김)
  const pat = r.model.layers[0];
  const lump = pat.items.filter((it) => {
    if (it.hole) return false;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of it.poly) (x0 = Math.min(x0, q[0]), x1 = Math.max(x1, q[0]), y0 = Math.min(y0, q[1]), y1 = Math.max(y1, q[1]));
    return Math.hypot((x0 + x1) / 2 - 30, (y0 + y1) / 2 - 30) < 10 && x1 - x0 < 6 && y1 - y0 < 6;
  }).length;
  check('칠한 자리에 찌꺼기 덩어리가 없음', lump === 0, `${lump}개`);
}

// ── 2-1. 가장자리 실오라기 색(안티에일리어싱)은 바탕에 합쳐 무늬를 깐다 ──
{
  const m = makeModel([
    { color: '#000000', rings: [body, circle(30, 30, 8), circle(70, 30, 8)] },
    { color: '#888888', rings: [rect(5, 5, 95, 5.4)] },          // 0.4mm — 안티에일리어싱 수준
  ], 100, 0.05);
  const r = applyPattern(m, P);
  const grey = r.model.layers.find((l) => l.color === '#888888');
  console.log('실오라기 색 — 남은 레이어:', r.model.layers.map((l) => l.color).join(', '));
  check('작은 색 조각은 바탕에 합쳐짐', !grey, grey ? '남음' : '합쳐짐');
}

// ── 3. 배경색과 같은 '안쪽 면'은 구멍으로 본다 (색 수를 늘리면 눈이 흰 면이 된다) ──
{
  const m = makeModel([
    { color: '#000000', rings: [body, circle(30, 30, 8), circle(70, 30, 8)] },
    { color: '#ffffff', rings: [circle(30, 30, 8), circle(70, 30, 8)] },   // 흰 눈 = 배경색
  ], 100, 0.05);
  const noBg = applyPattern(m, P);
  const withBg = applyPattern(m, { ...P, bgColor: '#ffffff' });
  const a = cover(noBg.model, 30, 30, 6), b = cover(withBg.model, 30, 30, 6);
  console.log('흰 눈 — 배경색 모름:', JSON.stringify(a), ' 배경색 알림:', JSON.stringify(b));
  check('배경색을 알려 주면 눈이 구멍으로 남음', b.덮임 < 15, `${b.덮임}%`);
  check('배경색을 모르면 메워짐 (예전 동작)', a.덮임 > 80, `${a.덮임}%`);
}

// ── 4. 색이 여러 겹 겹쳐도 실루엣이 누더기가 되면 안 된다 ──
{
  const m = makeModel([
    { color: '#000000', rings: [body] },
    { color: '#c9362b', rings: [rect(20, 20, 60, 60)] },     // 몸통 위에 겹침
    { color: '#1e3cdc', rings: [rect(40, 40, 80, 80)] },
  ], 100, 0.05);
  const r = applyPattern(m, P);
  for (const [x, y] of [[30, 30], [50, 50], [70, 70], [10, 90]]) {
    const c = cover(r.model, x, y, 4);
    check(`(${x},${y}) 가 비지 않음`, c.덮임 > 85, `${c.덮임}%`);
  }
}

console.log(bad ? `\n실패 ${bad}건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
