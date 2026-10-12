// 미리보기 도형 편집: 삭제 · 구멍 채우기 · 두께(오프셋) · 색 바꾸기/합치기
// 편집은 '작업 목록(edits)'으로 기록해 두고, 모델(mm)을 만들 때마다 같은 순서로 다시 적용 → 너비 변경·저장·실행취소와 호환
import ClipperLib from 'clipper-lib';
import { buildItems, closeRing, transformRing } from './geom.js';

const SC = 1000; // mm → µm

const toPaths = (items) => items.map((it) => it.poly.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) })));

function offsetRings(items, d) {
  const src = toPaths(items);
  const c = new ClipperLib.Clipper();
  c.AddPaths(src, ClipperLib.PolyType.ptSubject, true);
  const u = new ClipperLib.Paths();
  c.Execute(ClipperLib.ClipType.ctUnion, u, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const co = new ClipperLib.ClipperOffset(2, 0.01 * SC);
  co.AddPaths(u, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, d * SC);
  return out
    .filter((p) => p.length >= 3)
    .map((p) => {
      const r = p.map((q, i) => [i ? 'L' : 'M', q.X / SC, q.Y / SC]);
      return closeRing(r);
    });
}

const polyArea = (p) => {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]);
  return Math.abs(a) / 2;
};

/** 겹친 도형이 있으면(겹친 부분이 구멍으로 읽히는 문제) 한 레이어를 합집합으로 합침. 겹침이 없으면 그대로 */
function fixOverlap(L, tol) {
  const items = L.items;
  if (items.length < 2) return L;
  let sum = 0;
  for (const it of items) sum += (it.hole ? -1 : 1) * polyArea(it.poly);
  const c = new ClipperLib.Clipper();
  c.AddPaths(toPaths(items), ClipperLib.PolyType.ptSubject, true);
  const u = new ClipperLib.Paths();
  c.Execute(ClipperLib.ClipType.ctUnion, u, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  let ua = 0;
  for (const q of u) ua += Math.abs(ClipperLib.Clipper.Area(q)) / (SC * SC) * (ClipperLib.Clipper.Orientation(q) ? 1 : -1);
  if (Math.abs(ua - sum) < Math.max(0.01, sum * 1e-4)) return L;
  const rings = u.filter((q) => q.length >= 3).map((q) => closeRing(q.map((pt, k) => [k ? 'L' : 'M', pt.X / SC, pt.Y / SC])));
  return { ...L, items: buildItems(rings, tol) };
}

/** i번 도형 + 그 안의 직접 구멍들의 번호 */
export function groupOf(items, i) {
  const g = [i];
  if (!items[i].hole) items.forEach((it, j) => it.hole && it.parent === i && g.push(j));
  return g;
}

/** 선분 a→b 를 따라 폭 w(mm)만큼 도려내 연결된 부분을 끊음 (e.c 없으면 모든 색, e.i 없으면 그 색 전체) */
function cutLine(model, e, tol) {
  const [ax, ay] = e.a, [bx, by] = e.b;
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1e-6 || !(e.w > 0)) return;
  const nx = (-(by - ay) / len) * (e.w / 2), ny = ((bx - ax) / len) * (e.w / 2);
  const strip = [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]].map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) }));
  model.layers.forEach((L, li) => {
    if (e.c && L.color !== e.c) return;
    const all = L.items;
    let sel;
    if (e.i == null || !e.c) sel = all.map((_, j) => j);
    else if (e.i >= 0 && e.i < all.length) sel = groupOf(all, e.i);
    else return;
    const selSet = new Set(sel);
    // 도형(바깥 + 안의 구멍) 묶음마다: 선분에 닿는 것만 도려내고 나머지는 그대로 (곡선·원호 유지)
    const used = new Set();
    let rings = [];
    let changed = false;
    for (const j of sel) {
      if (used.has(j)) continue;
      const grp = all[j].hole && selSet.has(all[j].parent) ? null : groupOf(all, j);
      if (!grp) continue;
      grp.forEach((g) => used.add(g));
      const run = (type, subj, clip) => {
        const c = new ClipperLib.Clipper();
        c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
        c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
        const o = new ClipperLib.Paths();
        c.Execute(type, o, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
        return o;
      };
      const subj = toPaths(grp.map((g) => all[g]));
      const u = run(ClipperLib.ClipType.ctUnion, subj, []);
      if (!run(ClipperLib.ClipType.ctIntersection, u, [strip]).length) {
        rings = rings.concat(grp.map((g) => all[g].ring));
        continue;
      }
      changed = true;
      const out = run(ClipperLib.ClipType.ctDifference, u, [strip]);
      rings = rings.concat(out.filter((q) => q.length >= 3).map((q) => closeRing(q.map((pt, k) => [k ? 'L' : 'M', pt.X / SC, pt.Y / SC]))));
    }
    if (!changed) return;
    // 선택 범위 밖(다른 도형)은 그대로 합침
    const rest = all.filter((_, j) => !used.has(j)).map((it) => it.ring);
    model.layers[li] = { ...L, items: buildItems(rest.concat(rings), tol) };
  });
}
/** model(mm)에 편집 목록을 순서대로 적용 (model을 직접 고침) */
export function applyEdits(model, edits, tol) {
  for (const e of edits || []) {
    if (e.t === 'cut') {
      cutLine(model, e, tol);
      continue;
    }
    const li = model.layers.findIndex((l) => l.color === e.c);
    if (li < 0) continue;
    const L = model.layers[li];
    const all = L.items;
    let sel; // 대상 번호들
    if (e.i == null) sel = all.map((_, j) => j);
    else if (e.i >= 0 && e.i < all.length) sel = groupOf(all, e.i);
    else continue;
    const selSet = new Set(sel);
    const keep = all.filter((_, j) => !selSet.has(j));
    const picked = sel.map((j) => all[j]);
    let rings = keep.map((it) => it.ring);
    if (e.t === 'del') {
      // 구멍을 지우면 메워짐, 바깥 도형을 지우면 그 안의 구멍도 같이
      if (e.i != null && all[e.i].hole) rings = all.filter((_, j) => j !== e.i).map((it) => it.ring);
    } else if (e.t === 'holes') {
      const holes = new Set(e.i == null ? all.map((it, j) => (it.hole ? j : -1)).filter((j) => j >= 0) : sel.filter((j) => all[j].hole));
      rings = all.filter((_, j) => !holes.has(j)).map((it) => it.ring);
    } else if (e.t === 'off') {
      if (!e.d) continue;
      if (e.i != null && all[e.i].hole) {
        // 구멍의 두께 +는 구멍이 줄어드는 쪽(도형이 두꺼워짐) → 구멍을 반대로 오프셋
        const nr = offsetRings([all[e.i]], -e.d);
        rings = all.filter((_, j) => j !== e.i).map((it) => it.ring).concat(nr);
      } else rings = rings.concat(offsetRings(picked, e.d));
    } else if (e.t === 'col') {
      if (e.to === e.c) continue;
      const rs = picked.map((it) => it.ring);
      model.layers[li] = { ...L, items: buildItems(rings, tol) };
      let T = model.layers.find((l) => l.color === e.to);
      if (!T) {
        T = { color: e.to, items: [] };
        model.layers.push(T);
      }
      T.items = buildItems(T.items.map((it) => it.ring).concat(rs), tol);
      model.layers[model.layers.indexOf(T)] = fixOverlap(T, tol);
      continue;
    } else if (e.t === 'mv') {
      if (!e.dx && !e.dy) continue;
      rings = rings.concat(picked.map((it) => transformRing(it.ring, 1, -e.dx, -e.dy)));
    } else continue;
    model.layers[li] = fixOverlap({ ...L, items: buildItems(rings, tol) }, tol);
  }
  model.layers = model.layers.filter((l) => l.items.length);
  let rc = 0, nc = 0;
  for (const l of model.layers) {
    rc += l.items.length;
    for (const it of l.items) nc += it.ring.length;
  }
  model.ringCount = rc;
  model.nodeCount = nc;
  model.editShift = [0, 0];
  // 도형을 지우거나 굵게 하면 전체 범위가 달라짐 → 내용에 딱 맞게 원점으로 다시 맞춤 (3MF·SVG 크기가 맞게)
  if ((edits || []).length && model.layers.length) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const all = model.layers.flatMap((l) => l.items).concat(model.plate || []);
    for (const it of all)
      for (const [x, y] of it.poly) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    if (isFinite(x0)) {
      if (Math.abs(x0) > 1e-9 || Math.abs(y0) > 1e-9)
        for (const it of all) {
          it.ring = transformRing(it.ring, 1, x0, y0);
          it.poly = it.poly.map(([x, y]) => [x - x0, y - y0]);
        }
      model.width = x1 - x0;
      model.height = y1 - y0;
      model.editShift = [x0, y0];
    }
  }
  return model;
}

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const area = (p) => {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]);
  return Math.abs(a) / 2;
};

/** (x,y)mm 에 있는 가장 작은 도형(또는 구멍) → {c, i} */
export function hitItem(model, x, y) {
  let best = null, ba = Infinity;
  for (const l of model.layers)
    l.items.forEach((it, i) => {
      if (!inPoly(x, y, it.poly)) return;
      const a = area(it.poly);
      if (a < ba) {
        ba = a;
        best = { c: l.color, i };
      }
    });
  return best;
}
