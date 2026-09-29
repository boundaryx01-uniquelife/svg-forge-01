// 폰트 파일 도우미: TTC(여러 폰트가 한 파일에 묶인 컬렉션)를 개별 폰트로 분리
// Windows의 굴림·바탕·돋움 등은 .ttc라서 그대로는 opentype.js가 읽지 못한다.

export function isCollection(buf) {
  return buf.byteLength >= 12 && new DataView(buf).getUint32(0) === 0x74746366; // 'ttcf'
}

const align4 = (n) => (n + 3) & ~3;

function extractSfnt(buf, off) {
  const dv = new DataView(buf);
  const numTables = dv.getUint16(off + 4);
  const headLen = 12 + 16 * numTables;
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const r = off + 12 + 16 * i;
    tables.push({ tag: dv.getUint32(r), sum: dv.getUint32(r + 4), offset: dv.getUint32(r + 8), length: dv.getUint32(r + 12) });
  }
  const total = headLen + tables.reduce((a, t) => a + align4(t.length), 0);
  const out = new ArrayBuffer(total);
  const o = new DataView(out);
  const u8 = new Uint8Array(out);
  const src = new Uint8Array(buf);
  u8.set(src.subarray(off, off + 12), 0);
  let pos = headLen;
  tables.forEach((t, i) => {
    const r = 12 + 16 * i;
    o.setUint32(r, t.tag);
    o.setUint32(r + 4, t.sum);
    o.setUint32(r + 8, pos);
    o.setUint32(r + 12, t.length);
    u8.set(src.subarray(t.offset, t.offset + t.length), pos);
    pos += align4(t.length);
  });
  return out;
}

/** TTC → 개별 폰트 ArrayBuffer 목록 */
export function splitCollection(buf) {
  const dv = new DataView(buf);
  const n = dv.getUint32(8);
  const out = [];
  for (let i = 0; i < n; i++) out.push(extractSfnt(buf, dv.getUint32(12 + 4 * i)));
  return out;
}

/** 이름표 (opentype.js 2.x는 플랫폼별: names.windows / names.macintosh / names.unicode) */
function nameRec(font, key) {
  const nm = font.names || {};
  for (const plat of ['windows', 'unicode', 'macintosh']) if (nm[plat] && nm[plat][key]) return nm[plat][key];
  return nm[key] || null; // 1.x 호환
}
const pickLang = (rec) => rec && (rec.ko || rec['ko-KR'] || rec.en || Object.values(rec)[0]);

/** 폰트의 표시 이름 (한국어 이름이 있으면 우선) */
export function fontDisplayName(font, fallback) {
  const full = pickLang(nameRec(font, 'fullName'));
  if (full) return full;
  const fam = pickLang(nameRec(font, 'fontFamily'));
  const sub = pickLang(nameRec(font, 'fontSubfamily'));
  return fam ? fam + (sub && !/regular/i.test(sub) ? ' ' + sub : '') : fallback;
}
export function fontPostscript(font) {
  const rec = nameRec(font, 'postScriptName');
  return rec ? rec.en || Object.values(rec)[0] : '';
}
