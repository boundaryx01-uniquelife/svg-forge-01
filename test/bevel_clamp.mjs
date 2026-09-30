// 모서리 다듬기 값을 최대치보다 크게 해도 글자 높이가 그대로이고 결과가 더 변하지 않는지
import { readFileSync } from 'fs';
import { buildParts } from '../src/solid.js';
import { partGeometry } from '../src/mesh.js';
const model = JSON.parse(readFileSync(process.argv[2]));
let prev = null;
for (const size of [0.3, 0.6, 1, 2, 5]) {
  for (const type of ['chamfer', 'fillet']) {
    const { parts, info } = buildParts(model, { thickness: 3, base: { on: true, shape: 'rect', margin: 2, height: 1.5 }, edge: { type, size, onColor: true, onBase: true } });
    const col = parts.find((p) => p.role === 'color');
    const g = partGeometry(col);
    const pos = g.getAttribute('position').array;
    let zmax = 0; for (let i = 2; i < pos.length; i += 3) zmax = Math.max(zmax, pos[i]);
    const key = (i) => [pos[3*i],pos[3*i+1],pos[3*i+2]].map(v=>v.toFixed(4)).join(',');
    const E = new Map(); for (let t = 0; t < pos.length / 3; t += 3) for (let e = 0; e < 3; e++) { const a = key(t+e), b = key(t+(e+1)%3); const k = a < b ? a+'|'+b : b+'|'+a; E.set(k, (E.get(k)||0)+1); }
    const bad = [...E.values()].filter((v) => v !== 2).length;
    console.log(type.padEnd(8), 'size', size, 'bevelMax', info.bevelMax.toFixed(2), 'text zmax', zmax.toFixed(3), 'tris', pos.length / 9, 'open edges', bad);
  }
}
