import { buildParts } from '../src/solid.js';
import ClipperLib from 'clipper-lib';
// 가짜 모델: 가로로 긴 글자 두 덩어리 (Y 아래 방향 mm)
const rect = (x0,y0,x1,y1)=>({poly:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]});
const model = { width:60, height:20, layers:[{color:'#000000', items:[rect(0,0,25,20), rect(35,0,60,20)]}] };
const t0=Date.now();
for (const shape of ['outline','rect','square','circle','ellipse','triangle','pentagon','hexagon','octagon','star','heart','cloud','flower','shield']) {
  for (const stretch of [false,true]) {
    const t=Date.now();
    const {parts, info} = buildParts(model, {thickness:3, base:{on:true, shape, margin:2, height:1.5, stretch}});
    const base = parts.find(p=>p.role==='base');
    // 글자 전부가 받침 위에 있는지
    const SC=1000; const H=20;
    const text=[model.layers[0].items.map(it=>it.poly.map(([x,y])=>({X:Math.round(x*SC),Y:Math.round((H-y)*SC)})))].flat();
    const c=new ClipperLib.Clipper(); c.AddPaths(text,0,true); c.AddPaths(base.paths,1,true); const out=new ClipperLib.Paths(); c.Execute(2,out,1,1);
    const miss=out.reduce((a,p)=>a+Math.abs(ClipperLib.Clipper.Area(p)),0)/1e6;
    console.log(shape.padEnd(9), stretch?'stretch':'uniform', 'size', info.size.map(v=>v.toFixed(1)).join('×'), 'uncovered', miss.toFixed(3), (Date.now()-t)+'ms');
  }
}
for (const tm of ['engrave','through']) { const {parts,info}=buildParts(model,{thickness:3,textMode:tm,base:{on:true,shape:'rect',margin:2,height:2}}); console.log(tm, parts.map(p=>p.role+':'+p.z0+'-'+p.z1.toFixed(2)).join(' '), JSON.stringify({c:info.depthClamped,l:info.loose})); }
const r=buildParts(model,{thickness:3,base:{on:true,shape:'rect',margin:4,height:2},ring:{on:true,type:'hole',pos:'top',outer:8,hole:4}}); console.log('hole', JSON.stringify(r.info.ring));
console.log('total',Date.now()-t0,'ms');
