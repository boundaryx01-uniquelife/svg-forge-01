// 키캡을 '세워서'(윗면이 위) 뽑을 때 서포트가 필요한 자리를 잰다 — 합격/불합격이 아니라 측정 보고.
//   · 아래를 보는 면의 각도 분포 (45° 미만이면 서포트 필요)
//   · 허공에서 시작하는 '섬' (기울기로는 못 고친다 — 바닥까지 닿게 하거나 서포트)
//   · 속 천장 브리지 길이, 속벽 기울기
// STEM=floor 로 스템을 바닥까지 닿게 한 경우와 견줄 수 있다.
//   node kc_overhang.mjs   ·   STEM=floor node kc_overhang.mjs
import { buildKeycap, keycapDims } from '../src/keycap.js';
import { partGeometry } from '../src/mesh.js';
import { makeModel } from '../src/geom.js';
const rect=(a,b,c,d)=>[['M',a,b],['L',c,b],['L',c,d],['L',a,d],['L',a,b]];
const m=makeModel([{color:'#000',rings:[rect(0,0,6,6)]}],6,0.05);
const kc={on:true,u:'1',h:9,inset:2.8,wall:1.4,tol:0.1,stem:process.env.STEM||'std',mode:'emboss',depth:0.5,legendH:0.6,
          edgeType:'fillet',edgeSize:0.8,partR:0,partRType:'fillet',bodyR:1.4,innerR:0.8};
const D=keycapDims({keycap:kc});
console.log('치수', JSON.stringify({몸체:[D.bw,D.bd],윗면:[D.topW,D.topD],속천장z:D.zi,벽:kc.wall}, null, 0));
const { parts } = buildKeycap(m,{keycap:kc, step:0});
// 파트별 z 범위 + 바닥(z=0) 닿는 면적 + 아래를 보는 면의 각도 분포
const tri=(g)=>{const p=g.getAttribute('position').array;const o=[];for(let t=0;t<p.length/9;t++){const i=9*t;
 o.push([[p[i],p[i+1],p[i+2]],[p[i+3],p[i+4],p[i+5]],[p[i+6],p[i+7],p[i+8]]]);}return o;};
for(const pt of parts){
  const g=partGeometry(pt); if(!g) continue;
  const T=tri(g); let z0=1e9,z1=-1e9, bed=0, over=[], flat=0;
  for(const [a,b,c] of T){
    for(const v of [a,b,c]){z0=Math.min(z0,v[2]);z1=Math.max(z1,v[2]);}
    const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    const L=Math.hypot(...n); if(!L) continue;
    const nz=n[2]/L, area=L/2;
    if (nz < -0.001) {                     // 아래를 보는 면
      const ang=Math.acos(Math.min(1,-nz))*180/Math.PI;   // 0=완전 수평(최악), 90=수직
      over.push([ang,area]);
      if (Math.abs(a[2]-b[2])<1e-6 && Math.abs(b[2]-c[2])<1e-6 && a[2]-z0<1e-6) bed+=area;
      if (ang < 45) flat+=area;
    }
  }
  const tot=over.reduce((s,[,a])=>s+a,0);
  console.log(`${pt.name.padEnd(10)} z ${z0.toFixed(2)}~${z1.toFixed(2)}  바닥접지 ${bed.toFixed(1)}mm²  아래보는면 ${tot.toFixed(1)}mm² (45° 미만=서포트필요 ${flat.toFixed(1)}mm²)`);
}
// 속 공간 폭 (천장 쪽 다리 길이 = 브리지 길이)
const innerTop=D.topW-2*kc.wall, innerBot=D.bw-2*kc.wall;
console.log(`속 공간 폭: 바닥 ${innerBot.toFixed(1)}mm → 천장 ${innerTop.toFixed(1)}mm  (천장 브리지 길이 ${innerTop.toFixed(1)}mm)`);
const taper=Math.atan(((innerBot-innerTop)/2)/D.zi)*180/Math.PI;
console.log(`속벽 기울기 ${taper.toFixed(1)}° (수직 기준) — 45° 미만이면 서포트 불필요`);
console.log(`45° 로 ${innerTop.toFixed(1)}mm 를 덮으려면 높이 ${(innerTop/2).toFixed(2)}mm 필요 · 천장 위 남은 높이 ${(kc.h-D.zi).toFixed(2)}mm`);
