import { readFileSync, writeFileSync } from 'fs';
import { parseFont, textToLayers } from '../src/trace.js';
import { makeModel } from '../src/geom.js';
import { buildParts } from '../src/solid.js';
const fb=readFileSync('assets/NotoSansKR-Bold-subset.otf'); const font=parseFont(fb.buffer.slice(fb.byteOffset,fb.byteOffset+fb.length));
const m=makeModel(textToLayers(font,'unique',{}),50,0.05);
const variants=JSON.parse(process.argv[2]||'{"now":{}}');
for (const [k,extra] of Object.entries(variants)){
  const {parts}=buildParts(m,{thickness:2,base:{on:true,shape:'outline',margin:2,height:1.5,color:'#ccc',...extra},border:{on:true,width:1,height:0.8},ring:{on:false}});
  // 위에서 본 평면도 SVG (받침·테두리·글자)
  const all=parts.flatMap(p=>p.shapes.map(s=>({p,s})));
  const xs=all.flatMap(o=>o.s.outer.map(q=>q[0])), ys=all.flatMap(o=>o.s.outer.map(q=>q[1]));
  const x0=Math.min(...xs)-1,x1=Math.max(...xs)+1,y0=Math.min(...ys)-1,y1=Math.max(...ys)+1;
  const col={base:'#d0d0d0',border:'#8a8a8a',color:'#222'};
  const path=(s)=>[s.outer,...s.holes].map(r=>'M'+r.map(([x,y])=>`${(x-x0).toFixed(3)} ${(y1-y).toFixed(3)}`).join('L')+'Z').join(' ');
  const body=parts.map(p=>`<path fill="${col[p.role]||'#222'}" fill-rule="evenodd" d="${p.shapes.map(path).join(' ')}"/>`).join('');
  writeFileSync(`test/out/basefill_${k}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x1-x0} ${y1-y0}" width="${(x1-x0)*20}" height="${(y1-y0)*20}"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`);
}
