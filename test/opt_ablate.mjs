import { readFileSync, writeFileSync } from 'fs';
import { traceImage } from '../src/trace.js';
import { makeModel } from '../src/geom.js';
import { toFillSvg } from '../src/export.js';
const d=new Uint8ClampedArray(readFileSync('/tmp/claude-0/truth_800.bin'));
const base={colors:1,threshold:128,invert:false,removeBg:true,tol:0.4,minArea:12,cornerAngle:40,blur:0,lineTol:1,snapDeg:3,arcs:true,parallel:true,equalWidth:true,align:true,symmetry:false};
const variants={all:{},noArcs:{arcs:false},noPar:{parallel:false},noWidth:{equalWidth:false},noAlign:{align:false},none:{arcs:false,parallel:false,equalWidth:false,align:false,snapDeg:0},noLine:{lineTol:0,arcs:false,parallel:false,equalWidth:false,align:false,snapDeg:0}};
for(const [k,v] of Object.entries(variants)){
  const L=traceImage({width:800,height:600,data:d},{...base,...v});
  writeFileSync(`test/out/ab_${k}.svg`,toFillSvg(makeModel(L,50,0.05)));
}
