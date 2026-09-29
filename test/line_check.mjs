import { readFileSync } from 'fs';
import { traceImage } from '../src/trace.js';
const sets={user800:[800,308],truth_800:[800,600],transparent:[500,500],logo:[800,600]};
for(const [n,[w,h]] of Object.entries(sets)){
  const d=new Uint8ClampedArray(readFileSync(`/tmp/claude-0/${n}.bin`));
  for(const lineTol of [0,1]){
    const t0=Date.now();
    const L=traceImage({width:w,height:h,data:d},{colors:1,threshold:128,invert:false,removeBg:true,tol:n==='transparent'?0.8:0.4,minArea:12,cornerAngle:40,blur:0,lineTol,snapDeg:3});
    const cmds=L[0].rings.flat(); const cnt={}; cmds.forEach(c=>cnt[c[0]]=(cnt[c[0]]||0)+1);
    // 수직선 중 정확히 수직인 L 수
    let vert=0; for(const r of L[0].rings){ for(let i=1;i<r.length;i++){ const a=r[i-1], b=r[i]; if(b[0]==='L'){ const ax=a[a.length-2], bx=b[1]; const ay=a[a.length-1], by=b[2]; if(Math.abs(ax-bx)<1e-9 && Math.abs(ay-by)>15) vert++; } } }
    console.log(n.padEnd(12),'lineTol',lineTol, JSON.stringify(cnt), 'exact vertical L(>15px):',vert, (Date.now()-t0)+'ms');
  }
}
