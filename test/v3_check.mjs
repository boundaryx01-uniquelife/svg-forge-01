import { readFileSync, writeFileSync } from 'fs';
import { traceImage } from '../src/trace.js';
import { makeModel } from '../src/geom.js';
import { toFillSvg, toDxf, toLaserSvg } from '../src/export.js';
const sets={user800:[800,308,1],truth_800:[800,600,1],transparent:[500,500,1],logo:[800,600,1],touching:[800,500,6],multi:[600,400,4]};
const only=process.argv[2];
for(const [n,[w,h,colors]] of Object.entries(sets)){
  if(only && n!==only) continue;
  const d=new Uint8ClampedArray(readFileSync(`/tmp/claude-0/${n}.bin`));
  const t0=Date.now();
  const L=traceImage({width:w,height:h,data:d},{colors,threshold:128,invert:false,removeBg:true,tol:n==='transparent'?0.8:0.4,minArea:12,cornerAngle:40,blur:0,lineTol:1,snapDeg:3,arcs:true,parallel:true,equalWidth:true,align:true,symmetry:false});
  const ms=Date.now()-t0;
  const cnt={}; L.forEach(l=>l.rings.flat().forEach(c=>cnt[c[0]]=(cnt[c[0]]||0)+1));
  const m=makeModel(L,50,0.05);
  writeFileSync(`test/out/v3_${n}.svg`,toFillSvg(m)); writeFileSync(`test/out/v3_${n}.dxf`,toDxf(m)); writeFileSync(`test/out/v3_${n}_laser.svg`,toLaserSvg(m,{strokeWidth:0.03}));
  console.log(n.padEnd(12), ms+'ms', 'layers',L.length, JSON.stringify(cnt), JSON.stringify(L.stats));
}
