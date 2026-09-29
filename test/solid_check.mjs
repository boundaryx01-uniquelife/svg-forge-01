import { readFileSync, writeFileSync } from 'fs';
import { parseFont, textToLayers } from '../src/trace.js';
import { traceImage } from '../src/imagetrace.js';
import { makeModel } from '../src/geom.js';
import { build3mfBlob, buildStlBlob, buildPartGeometries } from '../src/mesh.js';
const fb=readFileSync('assets/NotoSansKR-Bold-subset.otf'); const font=parseFont(fb.buffer.slice(fb.byteOffset,fb.byteOffset+fb.length));
const cases=[];
cases.push(['keychain_text', makeModel(textToLayers(font,'발명왕',{}),50,0.05), {thickness:2,step:0,base:{on:true,shape:'outline',margin:2,height:1.5,color:'#ffffff'},border:{on:true,width:1,height:0.8},ring:{on:true,pos:'left',outer:8,hole:4}}]);
cases.push(['sign_rect', makeModel(textToLayers(font,'동래발명\nSVG Forge',{}),80,0.05), {thickness:1.2,step:0,base:{on:true,shape:'rect',margin:4,height:2,color:'#f4f4f4'},border:{on:true,width:1.5,height:1.2},ring:{on:true,pos:'top',outer:9,hole:4.5}}]);
const d=new Uint8ClampedArray(readFileSync('/tmp/claude-0/touching.bin'));
const L=traceImage({width:800,height:500,data:d},{colors:6,threshold:128,removeBg:true,tol:0.4,minArea:12,cornerAngle:40,blur:0});
cases.push(['multi_circle', makeModel(L,60,0.05), {thickness:1.5,step:0.4,base:{on:true,shape:'circle',margin:3,height:1.2,color:'#ffffff'},border:{on:false},ring:{on:true,pos:'topright',outer:8,hole:4}}]);
cases.push(['multi_noring_nobase', makeModel(L,60,0.05), {thickness:2,step:0,base:{on:false},border:{on:false},ring:{on:true,pos:'top',outer:8,hole:4}}]);
for(const [name,m,o] of cases){
  const t0=Date.now();
  const parts=buildPartGeometries(m,o);
  const b=await build3mfBlob(m,o,name);
  writeFileSync(`test/out/${name}.3mf`, Buffer.from(await b.arrayBuffer()));
  const s=buildStlBlob(m,o); writeFileSync(`test/out/${name}.stl`, Buffer.from(await s.arrayBuffer()));
  console.log(name.padEnd(20), (Date.now()-t0)+'ms', 'parts', parts.map(p=>p.name+'('+p.z1.toFixed(1)+')').join(', '), '| size', parts.info.size.map(v=>v.toFixed(1)).join('×'), '| ring', JSON.stringify(parts.info.ring&&{c:parts.info.ring.center.map(v=>+v.toFixed(2)),hole:parts.info.ring.hole}), '| filaments', JSON.stringify(b.filaments), (b.size/1024).toFixed(0)+'KB');
}
