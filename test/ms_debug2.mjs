import { readFileSync } from 'fs';
import { marchingSquares, polyArea, vectorizeLoop } from '../src/contour.js';
const buf=readFileSync('/tmp/claude-0/field.bin'); const f=new Float32Array(buf.buffer, buf.byteOffset, buf.length/4);
const w=800,h=600;
const loops=marchingSquares(f,w,h);
for(const l of loops){ const A=polyArea(l); if(Math.abs(A)<12) continue;
  const xs=l.map(p=>p[0]), ys=l.map(p=>p[1]);
  const c=vectorizeLoop(l,{tol:0.4,cornerAngle:40,smooth:1});
  console.log('loop n',l.length,'area',A.toFixed(0),'bbox',Math.min(...xs).toFixed(1),Math.min(...ys).toFixed(1),Math.max(...xs).toFixed(1),Math.max(...ys).toFixed(1),'cmds',c.length, c.map(x=>x[0]).join(''));
}
import { makeModel } from '../src/geom.js';
import { toFillSvg } from '../src/export.js';
const rings=loops.filter(l=>Math.abs(polyArea(l))>=12).map(l=>vectorizeLoop(l,{tol:0.4,cornerAngle:40,smooth:1}));
const hole=rings[3];
console.log('hole raw', JSON.stringify(hole.map(c=>c.map(v=>typeof v==='number'?+v.toFixed(1):v))));
const m=makeModel([{color:'#000000',rings}],50,0.05);
for(const it of m.layers[0].items) console.log(it.hole, it.ring.map(c=>c[0]).join(''));
