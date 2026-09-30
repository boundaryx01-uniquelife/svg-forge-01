import { readFileSync } from 'fs';
import { buildParts } from '../src/solid.js';
import { partGeometry } from '../src/mesh.js';
const model = JSON.parse(readFileSync(process.argv[2]));
const ringOn = process.argv[3] !== 'noring';
const { parts } = buildParts(model, { thickness: 1, base: { on: true, shape: 'rect', margin: 6, height: 3 }, ring: { on: ringOn, type: 'hole', pos: 'top', outer: 8, hole: 4 } });
for (const p of parts) {
  // 각 도형: 외곽과 구멍이 서로 닿는지
  p.shapes.forEach((s, i) => {
    const pts = new Map();
    for (const r of [s.outer, ...s.holes]) for (const [x, y] of r) { const k = x + ',' + y; pts.set(k, (pts.get(k) || 0) + 1); }
    const dup = [...pts.values()].filter((v) => v > 1).length;
    if (dup) console.log(p.role, 'shape', i, 'dup verts', dup, 'holes', s.holes.length);
  });
  const g = partGeometry(p);
  // 열린 모서리 세기
  const pos = g.getAttribute('position').array; const key = (i) => [pos[3*i],pos[3*i+1],pos[3*i+2]].map(v=>v.toFixed(4)).join(',');
  const idx = g.index ? g.index.array : Array.from({length: pos.length/3}, (_, i) => i);
  const E = new Map();
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = key(idx[t+e]), b = key(idx[t+(e+1)%3]); const k = a < b ? a+'|'+b : b+'|'+a; E.set(k, (E.get(k)||0)+1); }
  const open = [...E.values()].filter((v) => v !== 2).length;
  console.log(p.role, p.name, 'shapes', p.shapes.length, 'bad edges', open);
}
