// 조각 배치 — 무늬까지 다 깐 '뒤'에 떨어져 있는 덩어리를 끌어다 놓는 단계.
// 편집(edits)과 따로 돈다: 무늬를 다시 깔지 않고 좌표만 옮기므로
// 선택·이동·끊기 같은 도형 편집 도구와 서로 간섭하지 않는다.
import ClipperLib from 'clipper-lib';
import { transformRing } from './geom.js';

const SC = 1000;
const PF = ClipperLib.PolyFillType;
const toPath = (poly) => poly.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }));

/** 서로 닿아 있는 것끼리 묶는다 → [{ items, box, c }] (면적 큰 것부터) */
export function groupsOf(model) {
  const all = [];
  for (const l of model.layers) for (let i = 0; i < l.items.length; i++) all.push({ color: l.color, li: model.layers.indexOf(l), i, it: l.items[i] });
  if (!all.length) return [];
  // 전부 합쳐 바깥 윤곽만 뽑으면 그게 '덩어리' 하나하나다
  const c = new ClipperLib.Clipper();
  c.AddPaths(all.map((a) => toPath(a.it.poly)), ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, PF.pftNonZero, PF.pftNonZero);
  const outers = [];
  for (let n = tree.GetFirst(); n; n = n.GetNext()) if (!n.IsHole()) outers.push(n.Contour().map((q) => [q.X / SC, q.Y / SC]));
  if (outers.length <= 1) {
    const g = mk(all);
    return g ? [g] : [];
  }
  const boxes = outers.map(bbox);
  const buckets = outers.map(() => []);
  for (const a of all) {
    const b = bbox(a.it.poly);
    const px = (b[0] + b[2]) / 2, py = (b[1] + b[3]) / 2;
    let best = -1, ba = Infinity;
    for (let k = 0; k < outers.length; k++) {
      const q = boxes[k];
      if (px < q[0] - 0.01 || px > q[2] + 0.01 || py < q[1] - 0.01 || py > q[3] + 0.01) continue;
      if (!inPoly(px, py, outers[k])) continue;
      const area = (q[2] - q[0]) * (q[3] - q[1]);
      if (area < ba) (ba = area), (best = k);
    }
    if (best < 0) {                       // 가운데 점이 구멍에 걸린 드문 경우 → 상자가 겹치는 가장 작은 덩어리로
      for (let k = 0; k < outers.length; k++) {
        const q = boxes[k];
        if (b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]) continue;
        const area = (q[2] - q[0]) * (q[3] - q[1]);
        if (area < ba) (ba = area), (best = k);
      }
    }
    buckets[best < 0 ? 0 : best].push(a);
  }
  return buckets.map(mk).filter(Boolean).sort((a, b) => b.area - a.area);
}

function mk(items) {
  if (!items.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const a of items) for (const [x, y] of a.it.poly) (x < x0 && (x0 = x), x > x1 && (x1 = x), y < y0 && (y0 = y), y > y1 && (y1 = y));
  return { items, box: [x0, y0, x1, y1], c: [(x0 + x1) / 2, (y0 + y1) / 2], area: (x1 - x0) * (y1 - y0) };
}
function bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) (x < x0 && (x0 = x), x > x1 && (x1 = x), y < y0 && (y0 = y), y > y1 && (y1 = y));
  return [x0, y0, x1, y1];
}
function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** 어느 덩어리를 눌렀는지 (작은 것 우선) */
export function groupAt(groups, x, y) {
  let best = -1, ba = Infinity;
  for (let k = 0; k < groups.length; k++) {
    const b = groups[k].box;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    if (groups[k].area < ba) (ba = groups[k].area), (best = k);
  }
  return best;
}

/** 저장된 배치를 찾아 쓴다 — 너비를 바꿔도 따라가도록 '처음 너비' 로 나눠 적는다 */
const refW = (model) => model.baseW || model.width || 1;
const keyOf = (c, w) => [c[0] / w, c[1] / w];

/**
 * 배치를 모델에 입힌다. moves = [{u, v, dx, dy, w0}]
 * 조각마다 '옮기기 전 자리'를 it.lay 에 적어 둔다 — 다음에 또 끌 때 같은 기록에 더하려고.
 * 옮긴 뒤 내용에 딱 맞게 원점을 다시 맞춘다 (applyEdits 끝과 같은 방식 — 저장 파일 크기가 맞게)
 */
export function applyLayout(model, moves) {
  if (!model.layers.length) return model;
  const groups = groupsOf(model);
  const W = refW(model);
  const used = new Set();
  let any = false;
  for (const g of groups) {
    const c0 = g.c.slice();                       // 옮기기 전 자리
    const [u, v] = keyOf(c0, W);
    let hit = -1, hd = 0.2 * 0.2;                 // 너비의 20% 안쪽이면 같은 조각으로 본다
    for (let k = 0; k < (moves || []).length; k++) {
      if (used.has(k)) continue;
      const d = (moves[k].u - u) ** 2 + (moves[k].v - v) ** 2;
      if (d < hd) (hd = d), (hit = k);
    }
    const tag = { i: hit, c: c0, n: groups.length };
    for (const a of g.items) a.it.lay = tag;
    if (hit < 0) continue;
    used.add(hit);
    const mv = moves[hit];
    const s = mv.w0 ? W / mv.w0 : 1;              // 너비를 바꾸면 옮긴 거리도 같은 비율로
    const dx = mv.dx * s, dy = mv.dy * s;
    if (!dx && !dy) continue;
    any = true;
    for (const a of g.items) {
      a.it.ring = transformRing(a.it.ring, 1, -dx, -dy);
      a.it.poly = a.it.poly.map(([x, y]) => [x + dx, y + dy]);
    }
  }
  if (any) refit(model);
  return model;
}

/** 내용에 딱 맞게 원점·크기 다시 맞춤 */
export function refit(model) {
  const all = model.layers.flatMap((l) => l.items).concat(model.plate || []);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of all) for (const [x, y] of it.poly) (x < x0 && (x0 = x), x > x1 && (x1 = x), y < y0 && (y0 = y), y > y1 && (y1 = y));
  if (!isFinite(x0)) return model;
  if (Math.abs(x0) > 1e-9 || Math.abs(y0) > 1e-9)
    for (const it of all) {
      it.ring = transformRing(it.ring, 1, x0, y0);
      it.poly = it.poly.map(([x, y]) => [x - x0, y - y0]);
    }
  model.width = x1 - x0;
  model.height = y1 - y0;
  return model;
}

/** 이 덩어리를 (dx,dy) 만큼 더 옮긴다 → 배치 기록을 고쳐 돌려준다 */
export function addMove(layout, model, group, dx, dy) {
  const tag = group.items[0] && group.items[0].it.lay;
  const W = refW(model);
  const out = layout.slice();
  if (tag && tag.i >= 0 && out[tag.i]) {
    const q = out[tag.i], s = q.w0 ? W / q.w0 : 1;
    out[tag.i] = { ...q, dx: q.dx + dx / s, dy: q.dy + dy / s };
    return out;
  }
  const c0 = (tag && tag.c) || group.c;
  const [u, v] = keyOf(c0, W);
  out.push({ u, v, dx, dy, w0: W });
  return out;
}

/** 겹치지 않게 가로로 벌려 놓는다 (지금 화면의 덩어리 기준) */
export function spreadMoves(layout, model, groups, gap = 4) {
  if (groups.length < 2) return layout;
  let out = layout;
  const byX = groups.slice().sort((a, b) => a.box[0] - b.box[0]);
  let x = 0;
  for (const g of byX) {
    out = addMove(out, model, g, x - g.box[0], -g.box[1]);
    x += g.box[2] - g.box[0] + gap;
  }
  return out;
}
