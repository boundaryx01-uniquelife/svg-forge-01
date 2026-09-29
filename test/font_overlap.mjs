import { readFileSync, writeFileSync } from 'fs';
import opentype from 'opentype.js';
import { textToLayers } from '../src/trace.js';
import { makeModel } from '../src/geom.js';
import { toFillSvg } from '../src/export.js';
const cases=[['/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf','ABEHKMRWX&@ag'],['/usr/share/fonts/truetype/fonts-japanese-gothic.ttf','ABEHKM 日本語東京'],['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','ABEHKM@&']];
cases.forEach(([f,t],i)=>{
  const b=readFileSync(f); const font=opentype.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));
  const layers=textToLayers(font,t,{});
  const m=makeModel(layers,100,0.05);
  writeFileSync(`test/out/fo_${i}_ours.svg`,toFillSvg(m));
  // 기준: 폰트 원래 경로를 nonzero로 (같은 bbox로 맞춤)
  const p=new opentype.Path(); {let x=0,prev=null; for(const ch of t){const g=font.charToGlyph(ch); if(prev) x+=font.getKerningValue(prev,g)*100/font.unitsPerEm; p.extend(g.getPath(x,100,100)); x+=g.advanceWidth*100/font.unitsPerEm; prev=g;}} const bb=p.getBoundingBox();
  const s=100/(bb.x2-bb.x1); const H=(bb.y2-bb.y1)*s;
  writeFileSync(`test/out/fo_${i}_ref.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="${H}mm" viewBox="0 0 100 ${H}"><path fill-rule="nonzero" transform="scale(${s}) translate(${-bb.x1} ${-bb.y1})" d="${p.toPathData(4)}"/></svg>`);
  console.log(i, f.split('/').pop(), 'ours H', m.height.toFixed(3), 'ref H', H.toFixed(3));
});
