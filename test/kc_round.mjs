// 키캡 모서리 R: 몸체 세로 모서리 · 부품(스템·글자) 위아래 모서리
// 키캡 모서리 R: 메시가 닫히는지 · R 을 올리면 실제로 깎이는지
import { buildKeycap, keycapDims } from '../src/keycap.js';
import { makeModel } from '../src/geom.js';
import { partGeometry } from '../src/mesh.js';
const rect=(a,b,c,d)=>[['M',a,b],['L',c,b],['L',c,d],['L',a,d],['L',a,b]];
const m = makeModel([{color:'#000000',rings:[rect(2,2,12,12)]}], 14, 0.05);
function openEdges(g){const p=g.getAttribute('position').array;const key=i=>[p[3*i],p[3*i+1],p[3*i+2]].map(v=>v.toFixed(3)).join(',');const E=new Map();
 for(let t=0;t<p.length/9;t++)for(let e=0;e<3;e++){const a=key(3*t+e),b=key(3*t+((e+1)%3));const k=a<b?a+'|'+b:b+'|'+a;E.set(k,(E.get(k)||0)+1);}
 let o=0;for(const v of E.values())if(v%2===1)o++;return o;}
const vol=(g)=>{const p=g.getAttribute('position').array;let v=0;
 for(let t=0;t<p.length/9;t++){const i=9*t;v+=(p[i]*(p[i+4]*p[i+8]-p[i+5]*p[i+7])-p[i+1]*(p[i+3]*p[i+8]-p[i+5]*p[i+6])+p[i+2]*(p[i+3]*p[i+7]-p[i+4]*p[i+6]))/6;}return Math.abs(v);};
for (const r of [0, 0.2, 0.5, 1.0]) {
  const { parts, info } = buildKeycap(m, { keycap:{ on:true, u:'1', h:9, inset:2.8, wall:1.4, tol:0.1, stem:'std', mode:'emboss', depth:0.5, legendH:0.6, edgeType:'fillet', edgeSize:0.8, partR:r, partRType:'fillet' }, step:0 });
  const out = [];
  for (const pt of parts) { const g = partGeometry(pt); if(!g) continue;
    out.push(`${pt.name}: 열린모서리 ${openEdges(g)} 부피 ${vol(g).toFixed(2)}`); }
  console.log(`R=${r} 슬롯R=${info.slotR ?? '-'}`);
  for (const l of out) console.log('   ' + l);
}

// ── 검사 ──
let bad = 0;
const check = (l, c, e = '') => { if (!c) bad++; console.log(`${c ? 'OK ' : '✗  '} ${l}${e ? '  ' + e : ''}`); };
const mk = (over) => buildKeycap(m, { keycap: { on:true, u:'1', h:9, inset:2.8, wall:1.4, tol:0.1, stem:'std', mode:'emboss', depth:0.5, legendH:0.6, edgeType:'fillet', edgeSize:0.8, partR:0, partRType:'fillet', bodyR:1.4, ...over }, step:0 });
const volOf = (r, role) => { const p = r.parts.find((x) => x.role === role); const g = partGeometry(p); return { v: vol(g), open: openEdges(g) }; };

console.log('\n── 부품 R (스템·글자) ──');
const s0 = volOf(mk({}), 'kcstem'), s5 = volOf(mk({ partR: 0.5 }), 'kcstem');
check('부품 R 을 주면 스템이 깎임', s5.v < s0.v - 0.5, `${s0.v.toFixed(2)} → ${s5.v.toFixed(2)}`);
check('스템 메시가 닫힘', s0.open === 0 && s5.open === 0, `${s0.open}/${s5.open}`);
const g0 = volOf(mk({}), 'kclegend'), g3 = volOf(mk({ partR: 0.25 }), 'kclegend');
check('글자도 깎임', g3.v < g0.v, `${g0.v.toFixed(2)} → ${g3.v.toFixed(2)}`);
const g9 = volOf(mk({ partR: 2 }), 'kclegend');
check('글자 두께보다 큰 R 은 두께만큼만 (0.6mm 글자가 사라지지 않음)', g9.v > g0.v * 0.9 && g9.open === 0, `${g9.v.toFixed(2)}`);
check('십자 슬롯 R 은 슬롯 폭의 1/3 까지', mk({ partR: 2 }).info.slotR <= 0.49, `${mk({ partR: 2 }).info.slotR}`);

console.log('\n── 몸체 세로 모서리 R ──');
const bv = [0.3, 1.4, 3].map((r) => ({ r, ...volOf(mk({ bodyR: r }), 'kcbody') }));
for (const x of bv) console.log(`   R ${x.r} → 부피 ${x.v.toFixed(2)} 열린모서리 ${x.open}`);
check('R 을 키우면 몸체가 깎임', bv[0].v > bv[1].v && bv[1].v > bv[2].v, bv.map((x) => x.v.toFixed(1)).join(' > '));
check('몸체 메시가 전부 닫힘', bv.every((x) => x.open === 0));
check('윗면보다 큰 R 은 윗면 1/3 까지로 묶임', keycapDims({ u:'1', h:9, inset:2.8, bodyR:99 }).bodyR <= 4.2, `${keycapDims({ u:'1', h:9, inset:2.8, bodyR:99 }).bodyR.toFixed(2)}`);
check('기본값은 예전과 같음 (1.4)', Math.abs(keycapDims({ u:'1', h:9, inset:2.8 }).bodyR - 1.4) < 1e-9);

console.log(bad ? `\n실패 ${bad}건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
