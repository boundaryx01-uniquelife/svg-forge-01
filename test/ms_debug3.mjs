import { readFileSync } from 'fs';
import * as C from '../src/contour.js';
import { traceImage } from '../src/trace.js';
const d=new Uint8ClampedArray(readFileSync('/tmp/claude-0/rgba.bin'));
const L=traceImage({width:800,height:600,data:d},{colors:1,threshold:128,invert:false,removeBg:true,tol:0.4,minArea:12,cornerAngle:40,blur:0});
console.log(L[0].rings.map(r=>r.map(c=>c[0]).join('')));
const hole=L[0].rings[3]; console.log(JSON.stringify(hole.map(c=>c.map(v=>typeof v==='number'?+v.toFixed(1):v))));
