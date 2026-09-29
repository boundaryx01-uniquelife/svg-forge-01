import { marchingSquares, polyArea, vectorizeLoop } from '../src/contour.js';
// 링(도넛) 필드
const w=80,h=80,f=new Float32Array(w*h);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const r=Math.hypot(x+0.5-40,y+0.5-40); f[y*w+x]= Math.min(30-r, r-12);}
const loops=marchingSquares(f,w,h);
console.log('loops',loops.length, loops.map(l=>[l.length, polyArea(l).toFixed(1)]));
for(const l of loops){ const c=vectorizeLoop(l,{tol:0.4,cornerAngle:40,smooth:1}); console.log(c.length, JSON.stringify(c.slice(0,3)).slice(0,200)); }
