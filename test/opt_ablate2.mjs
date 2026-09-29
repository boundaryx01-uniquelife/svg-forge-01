import { readFileSync, writeFileSync } from 'fs';
import { traceImage } from '../src/trace.js';
import { ringToPath } from '../src/export.js';
const d=new Uint8ClampedArray(readFileSync('/tmp/claude-0/truth_800.bin'));
const base={colors:1,threshold:128,invert:false,removeBg:true,tol:0.4,minArea:12,cornerAngle:40,blur:0,lineTol:1,snapDeg:3,arcs:true,parallel:true,equalWidth:true,align:true,symmetry:false};
const variants={all:{},noArcs:{arcs:false},noPar:{parallel:false},noAlign:{align:false},none:{arcs:false,parallel:false,equalWidth:false,align:false,snapDeg:0},noLine:{lineTol:0,arcs:false,parallel:false,equalWidth:false,align:false,snapDeg:0}};
for(const [k,v] of Object.entries(variants)){
  const L=traceImage({width:800,height:600,data:d},{...base,...v});
  const dd=L[0].rings.map(r=>ringToPath(r,4)).join(' ');
  writeFileSync(`test/out/px_${k}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#fff"/><path fill="#000" fill-rule="evenodd" d="${dd}"/></svg>`);
}
