// DXF: 단위 정보가 들어 있는지, 레이어 색 번호가 겹치지 않는지.
// 단위가 없으면 RDWorks·LightBurn 이 제 설정대로 가정하고(인치면 80mm→2032mm),
// 색이 겹치면 새김으로 지정한 자리가 절단으로 타서 작품이 두 동강 난다.
import { toDxf } from '../src/export.js';
import { makeModel } from '../src/geom.js';

let bad = 0;
const check = (l, c, e = '') => { if (!c) bad++; console.log(`${c ? 'OK ' : '✗  '} ${l}${e ? '  ' + e : ''}`); };
const rect = (a, b, c, d) => [['M', a, b], ['L', c, b], ['L', c, d], ['L', a, d], ['L', a, b]];
const circle = (cx, cy, r, n = 48) => { const o = []; for (let i = 0; i < n; i++) { const t = (2 * Math.PI * i) / n; o.push([i ? 'L' : 'M', cx + r * Math.cos(t), cy + r * Math.sin(t)]); } o.push(['L', cx + r, cy]); return o; };

const hdr = (d, name) => {
  const t = d.split(/\r\n/);
  const i = t.indexOf(name);
  return i < 0 ? null : t.slice(i + 1, i + 7).filter((_, k) => k % 2 === 1);
};
const layers = (d) => {
  const t = d.split(/\r\n/);
  const out = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== 'LAYER' || t[i - 1] !== '0') continue;
    const name = t[i + 2];
    const j = t.indexOf('62', i);
    out.push({ name, aci: parseInt(t[j + 1], 10) });
  }
  return out.filter((l) => l.name !== '0');
};

// 1) 단위
{
  const m = makeModel([{ color: '#1b1b1b', rings: [rect(5, 5, 85, 45)] }], 80, 0.05);
  const d = toDxf(m);
  check('$INSUNITS = 4 (mm)', hdr(d, '$INSUNITS')?.[0] === '4', String(hdr(d, '$INSUNITS')));
  check('$MEASUREMENT = 1 (미터법)', hdr(d, '$MEASUREMENT')?.[0] === '1', String(hdr(d, '$MEASUREMENT')));
  check('$LUNITS 있음', !!hdr(d, '$LUNITS'));
  const mn = hdr(d, '$EXTMIN'), mx = hdr(d, '$EXTMAX');
  check('$EXTMIN/$EXTMAX 있음', !!mn && !!mx, `${mn} ~ ${mx}`);
  const w = parseFloat(mx[0]) - parseFloat(mn[0]);
  check('도면 범위가 실제 너비와 맞음', Math.abs(w - 80) < 0.2, `${w.toFixed(2)}mm`);
}

// 2) 색이 가까워도 레이어 번호가 겹치지 않아야
{
  const m = makeModel([
    { color: '#ff0000', rings: [rect(2, 2, 30, 30)] },
    { color: '#ff3333', rings: [circle(45, 15, 8)] },
    { color: '#cc2222', rings: [rect(60, 2, 90, 30)] },
  ], 90, 0.05);
  const L = layers(toDxf(m));
  const acis = L.map((x) => x.aci);
  console.log('   레이어:', L.map((x) => `${x.name}=${x.aci}`).join(' '));
  check('레이어가 3개 다 나옴', L.length === 3, `${L.length}개`);
  check('색 번호가 서로 다름', new Set(acis).size === acis.length, acis.join(','));
  check('색 번호가 1~255', acis.every((a) => a >= 1 && a <= 255), acis.join(','));
}

// 3) 무채색 팔레트 (트레이싱 결과에서 가장 흔한 경우)
{
  const cols = ['#9a9a9a', '#4a4a4a', '#858585', '#2f9e44', '#1971c2'];
  const m = makeModel(cols.map((c, i) => ({ color: c, rings: [rect(2 + i * 18, 2, 16 + i * 18, 30)] })), 92, 0.05);
  const acis = layers(toDxf(m)).map((x) => x.aci);
  console.log('   무채색 5가지 →', acis.join(','));
  check('무채색 5가지도 전부 다른 번호', new Set(acis).size === acis.length, acis.join(','));
}

console.log(bad ? `\n실패 ${bad}건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
