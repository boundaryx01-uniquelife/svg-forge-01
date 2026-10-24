// 몰드·패턴 실루엣: 여러 색 레이어 · 채운 구멍 · 배경색 안쪽 면
import { applyPattern } from '../src/mold.js';
import { makeModel, buildItems } from '../src/geom.js';

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
  // 구멍이었을 때처럼 둘레에 벽이 둘러져야 한다 (칠하면 테두리가 사라지던 문제)
  const ring = (() => {
    const poly = red.items[0].poly;                       // 실제 원반 위치·크기를 모델에서 읽는다
    let cx = 0, cy = 0; for (const q of poly) (cx += q[0], cy += q[1]);
    cx /= poly.length; cy /= poly.length;
    let rr = 0; for (const q of poly) rr = Math.max(rr, Math.hypot(q[0] - cx, q[1] - cy));
    const rs = rr + 1;                                    // 원반 바로 바깥 (벽 2mm 의 한가운데)
    let on = 0, n = 0;
    for (let k = 0; k < 72; k++) {
      const t = (2 * Math.PI * k) / 72, x = cx + rs * Math.cos(t), y = cy + rs * Math.sin(t);
      n++;
      let ins = false; for (const it of r.model.layers[0].items) if (pip(it.poly, x, y)) ins = !ins;
      if (ins) on++;
    }
    return Math.round((100 * on) / n);
  })();
  console.log(`칠한 눈 바로 바깥이 무늬 색으로 덮인 비율: ${ring}%`);
  check('칠한 색 둘레에 벽이 둘러짐', ring > 85, `${ring}%`);
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

// ── 5. 바탕(무늬 깔리는 색)은 칠하다가 넓이 순위가 뒤집혀도 바뀌면 안 된다 ──
{
  // 검정 몸통 위에 '몸통 남은 넓이보다 큰' 파랑을 칠한 상황
  const m = makeModel([
    { color: '#000000', rings: [rect(5, 5, 95, 95)] },
    { color: '#29b6f6', rings: [rect(5, 5, 95, 60)] },          // 4500 > 남은 검정 3500
  ], 100, 0.05);
  const noBase = applyPattern(m, P);                              // 예전 동작 (넓이로 매번 다시 뽑음)
  const fixed = applyPattern(m, { ...P, baseColor: '#000000' });  // 트레이싱 바탕색 고정
  const blueOf = (r) => r.model.layers.find((l) => l.color === '#29b6f6');
  console.log(`바탕 고정 — 안 넘기면 바탕 ${noBase.info.base} / 넘기면 ${fixed.info.base}`);
  check('바탕이 트레이싱 때 색으로 고정됨', fixed.info.base === '#000000', `${fixed.info.base}`);
  check('칠한 파랑이 사라지지 않음', !!blueOf(fixed), blueOf(fixed) ? `조각 ${blueOf(fixed).items.length}개` : '없음');
  const up = cover(fixed.model, 50, 30, 8), lo = cover(fixed.model, 50, 80, 8);
  console.log(`  칠한 파랑 쪽: ${JSON.stringify(up)} · 남은 몸통 쪽: ${JSON.stringify(lo)}`);
  check('칠한 쪽은 파랑 그대로', (up['#29b6f6'] || 0) > 90, `${up['#29b6f6'] || 0}%`);
  check('남은 몸통 쪽에 무늬가 깔림', (lo['#1b1b1b'] || 0) > 15 && (lo['#e8e2d0'] || 0) > 15, `무늬 ${lo['#1b1b1b'] || 0}% 채움 ${lo['#e8e2d0'] || 0}%`);
  // 그 색을 통째로 칠해 없앴으면 가장 넓은 색으로 떨어져야 한다 (빈 화면이 되면 안 됨)
  const gone = applyPattern(makeModel([{ color: '#29b6f6', rings: [rect(5, 5, 95, 95)] }], 100, 0.05), { ...P, baseColor: '#000000' });
  check('바탕색이 없어지면 가장 넓은 색으로', gone.info.base === '#29b6f6', `${gone.info.base}`);
}

// ── 6. 색 면 안에 든 색 면에도 테두리가 생겨야 한다 ──
{
  const m = makeModel([
    { color: '#000000', rings: [rect(5, 5, 95, 95)] },
    // 큰 색 면에 구멍이 있고, 그 구멍을 다른 색으로 칠한 모양 (레이어끼리 겹치지 않음)
    { color: '#dc1e1e', rings: [rect(20, 20, 80, 80), circle(50, 50, 10)] },
    { color: '#e53935', rings: [circle(50, 50, 10)] },
  ], 100, 0.05);
  const r = applyPattern(m, { ...P, baseColor: '#000000' });
  const inner = r.model.layers.find((l) => l.color === '#e53935');
  const poly = inner.items[0].poly;
  let cx = 0, cy = 0; for (const q of poly) (cx += q[0], cy += q[1]);
  cx /= poly.length; cy /= poly.length;
  let rr = 0; for (const q of poly) rr = Math.max(rr, Math.hypot(q[0] - cx, q[1] - cy));
  const ringAt = (d) => {
    let on = 0;
    for (let k = 0; k < 72; k++) {
      const t = (2 * Math.PI * k) / 72, x = cx + (rr + d) * Math.cos(t), y = cy + (rr + d) * Math.sin(t);
      let ins = false; for (const it of r.model.layers[0].items) if (pip(it.poly, x, y)) ins = !ins;
      if (ins) on++;
    }
    return Math.round((100 * on) / 72);
  };
  console.log(`색 면 안의 색 면 — 바깥 0.5mm ${ringAt(0.5)}% · 1mm ${ringAt(1)}% 가 무늬 색`);
  check('안쪽 색 면에도 테두리가 생김', ringAt(0.5) > 85 && ringAt(1) > 85, `${ringAt(0.5)}% / ${ringAt(1)}%`);
  const red = r.model.layers.find((l) => l.color === '#dc1e1e');
  check('바깥 색 면도 남음', !!red, red ? `조각 ${red.items.length}개` : '없음');
}

// ── 7. 바탕색과 같은 색으로 칠한 자리도 남아야 한다 (칠한 영역을 기억) ──
{
  const m = makeModel([{ color: '#000000', rings: [rect(5, 5, 95, 95), circle(30, 30, 8), circle(70, 30, 8)] }], 100, 0.05);
  // 왼쪽 눈을 '바탕색과 같은' 검정으로 칠한 상태 — 기하만 보면 몸통과 구분이 안 된다
  m.layers = [{ color: '#000000', items: buildItems([rect(5, 5, 95, 95), circle(70, 30, 8)], m.tol) }];
  m.painted = [{ color: '#000000', polys: buildItems([circle(30, 30, 8)], m.tol).map((x) => x.poly) }];
  const r = applyPattern(m, { ...P, baseColor: '#000000' });
  const L = cover(r.model, 30, 30, 6), R = cover(r.model, 70, 30, 6), B = cover(r.model, 50, 70, 6);
  console.log(`바탕색으로 칠한 눈: ${JSON.stringify(L)} · 안 칠한 눈: ${JSON.stringify(R)} · 몸통: ${JSON.stringify(B)}`);
  check('바탕색으로 칠해도 제 영역으로 남음', (L['#000000'] || 0) > 90, `검정 ${L['#000000'] || 0}%`);
  check('그 위에 무늬가 덮이지 않음', (L['#1b1b1b'] || 0) < 8, `무늬 ${L['#1b1b1b'] || 0}%`);
  check('안 칠한 눈은 그대로 구멍', R.덮임 < 15, `${R.덮임}%`);
  check('몸통은 무늬 그대로', (B['#1b1b1b'] || 0) > 20, `무늬 ${B['#1b1b1b'] || 0}%`);
  // 칠한 기록이 낡았으면(그 색이 이제 없으면) 조용히 버려야 한다
  const stale = applyPattern({ ...m, painted: [{ color: '#ff00ff', polys: m.painted[0].polys }] }, { ...P, baseColor: '#000000' });
  const S2 = cover(stale.model, 30, 30, 6);
  check('낡은 칠 기록은 버려짐', (S2['#ff00ff'] || 0) === 0, `${S2['#ff00ff'] || 0}%`);
}

console.log(bad ? `\n실패 ${bad}건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
