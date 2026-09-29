import { readFileSync } from 'fs';
import { traceImage } from '../src/trace.js';
const d=new Uint8ClampedArray(readFileSync('/tmp/claude-0/multi.bin'));
for(const tol of [0.4,0.8]) for (const minArea of [12]) {
  const L=traceImage({width:600,height:400,data:d},{colors:4,threshold:128,invert:false,removeBg:true,tol,minArea,cornerAngle:40,blur:0,lineTol:1,snapDeg:3,arcs:true,parallel:true,equalWidth:true,align:true});
  const cnt={}; L.forEach(l=>l.rings.flat().forEach(c=>cnt[c[0]]=(cnt[c[0]]||0)+1));
  console.log(tol, L.map(l=>l.color).join(','), JSON.stringify(cnt));
}
