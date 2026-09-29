import { readFileSync, writeFileSync } from 'fs';
import { traceImage } from '../src/trace.js';
import { makeModel } from '../src/geom.js';
import { toFillSvg, toLaserSvg } from '../src/export.js';
const d=new Uint8ClampedArray(readFileSync('/tmp/claude-0/user800.bin'));
for(const lineTol of [0,1]){
  const L=traceImage({width:800,height:308,data:d},{colors:1,threshold:128,invert:false,removeBg:true,tol:0.4,minArea:12,cornerAngle:40,blur:0,lineTol,snapDeg:3});
  const m=makeModel(L,50,0.05);
  writeFileSync(`test/out/line_${lineTol}.svg`,toFillSvg(m));
  writeFileSync(`test/out/line_${lineTol}_laser.svg`,toLaserSvg(m,{strokeWidth:0.03}));
}
