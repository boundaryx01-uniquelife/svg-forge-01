import { readFileSync } from 'fs';
import { marchingSquares, polyArea } from '../src/contour.js';
const d=new Uint8ClampedArray(readFileSync('/tmp/claude-0/rgba.bin'));
const w=800,h=600,f=new Float32Array(w*h);
for(let i=0;i<w*h;i++){const a=d[i*4+3]/255;const l=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];f[i]=a*(128-l)+(1-a)*-128;}
const loops=marchingSquares(f,w,h).filter(l=>Math.abs(polyArea(l))>=12);
const hole=loops[3];
console.log('n',hole.length);
// 원본 점 간격/점프 확인
let maxJ=0,at=0; for(let i=0;i<hole.length;i++){const a=hole[i],b=hole[(i+1)%hole.length];const j=Math.hypot(a[0]-b[0],a[1]-b[1]); if(j>maxJ){maxJ=j;at=i;}}
console.log('max jump',maxJ.toFixed(2),'at',at, hole[at], hole[(at+1)%hole.length]);
const dup=new Map(); hole.forEach((p,i)=>{const k=p[0].toFixed(3)+','+p[1].toFixed(3); if(dup.has(k)) console.log('dup point',k,dup.get(k),i); dup.set(k,i);});
