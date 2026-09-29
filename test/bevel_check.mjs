import { readFileSync, writeFileSync } from 'fs';
import { parseFont, textToLayers } from '../src/trace.js';
import { traceImage } from '../src/imagetrace.js';
import { makeModel } from '../src/geom.js';
import { build3mfBlob, buildPartGeometries } from '../src/mesh.js';
const fb=readFileSync('assets/NotoSansKR-Bold-subset.otf'); const font=parseFont(fb.buffer.slice(fb.byteOffset,fb.byteOffset+fb.length));
const text=makeModel(textToLayers(font,'unique 발명',{}),60,0.05);
const d=new Uint8ClampedArray(readFileSync('/tmp/claude-0/touching.bin'));
const multi=makeModel(traceImage({width:800,height:500,data:d},{colors:6,threshold:128,removeBg:true,tol:0.4,minArea:12,cornerAngle:40,blur:0}),60,0.05);
const cases=[
 ['fillet_text', text, {thickness:3,base:{on:true,shape:'outline',margin:2,height:1.5,fill:3},border:{on:false},ring:{on:true,pos:'left',outer:8,hole:4},edge:{type:'fillet',size:0.8,onColor:true,onBase:true}}],
 ['chamfer_text_border', text, {thickness:3,base:{on:true,shape:'rect',margin:3,height:2},border:{on:true,width:1.5,height:1.2},ring:{on:true,pos:'top',outer:9,hole:4,dx:6,dy:-1},edge:{type:'chamfer',size:0.6,onColor:true,onBase:true}}],
 ['fillet_multi', multi, {thickness:2,step:0.4,base:{on:true,shape:'circle',margin:3,height:1.2},border:{on:false},ring:{on:false},edge:{type:'fillet',size:0.6,onColor:true,onBase:true}}],
 ['ring_detached', text, {thickness:3,base:{on:false},border:{on:false},ring:{on:true,pos:'top',outer:8,hole:4,dy:12},edge:{type:'none'}}],
];
for (const [name,m,o] of cases){
  const t0=Date.now();
  const parts=buildPartGeometries(m,o);
  const b=await build3mfBlob(m,o,name);
  writeFileSync(`test/out/${name}.3mf`, Buffer.from(await b.arrayBuffer()));
  console.log(name.padEnd(22),(Date.now()-t0)+'ms','parts',parts.length,'size',parts.info.size.map(v=>v.toFixed(2)).join('×'),'ring',parts.info.ring?JSON.stringify({c:parts.info.ring.center.map(v=>+v.toFixed(2)),auto:parts.info.ring.auto.map(v=>+v.toFixed(2)),attached:parts.info.ring.attached}):'-',(b.size/1024).toFixed(0)+'KB');
}
