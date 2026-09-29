import { readFileSync } from 'fs';
import { traceImage } from '../src/trace.js';
import { estimateHardEdges } from '../src/trace.js';
const sets={transparent:[500,500],logo:[800,600],truth_800:[800,600],user_uniquelife:[1150,443]};
for(const [n,[w,h]] of Object.entries(sets)){
  const d=new Uint8ClampedArray(readFileSync(`/tmp/claude-0/${n}.bin`));
  const img={width:w,height:h,data:d};
  const hard=estimateHardEdges?estimateHardEdges(img):'-';
  const row=[n,'aa-ratio',hard];
  for(const tol of [0.4,0.8]){ const L=traceImage(img,{colors:1,threshold:128,invert:false,removeBg:true,tol,minArea:12,cornerAngle:40,blur:0}); row.push(`tol${tol}:`+L[0].rings.reduce((s,r)=>s+r.length,0)); }
  console.log(row.join(' '));
}
