// 텍스트 → 윤곽 (폰트) + 이미지 트레이싱 재수출
import opentype from 'opentype.js';
import { closeRing } from './geom.js';
export * from './imagetrace.js';

// ---------- 텍스트 ----------

export function parseFont(arrayBuffer) {
  return opentype.parse(arrayBuffer);
}

/** 폰트에 없는 글자 목록 */
export function missingGlyphs(font, text, fallbacks) {
  const miss = new Set();
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    if (font.charToGlyphIndex(ch) === 0 && !(fallbacks && fallbacks.some((f) => f && f.charToGlyphIndex(ch)))) miss.add(ch);
  }
  return [...miss];
}

/** 글자마다 쓸 폰트: 선택 폰트에 없으면 대체 폰트(한글·한자 등)에서 */
export function pickFont(font, fallbacks, ch) {
  if (font.charToGlyphIndex(ch) || /\s/.test(ch) || !fallbacks) return font;
  return fallbacks.find((f) => f && f.charToGlyphIndex(ch)) || font;
}

/** 한 줄을 글리프 단위로 배치 (GSUB 합자 등 고급 기능은 쓰지 않음 → 어떤 폰트도 안전하게 처리)
 *  st(i): 글자별 모양 {s: 크기 배율, dx, dy: 이동(em), color, dz} — i는 전체 글자 번호 */
function layoutLine(font, chars, i0, size, fallbacks, st) {
  const glyphs = [];
  let x = 0;
  let prev = null;
  let prevFont = null;
  chars.forEach((ch, k) => {
    const f = pickFont(font, fallbacks, ch);
    const sty = st(i0 + k);
    const sc = sty.s || 1;
    const scale = (size * sc) / f.unitsPerEm;
    const g = f.charToGlyph(ch);
    if (prev && prevFont === f && sc === 1) {
      try {
        x += (f.getKerningValue(prev, g) || 0) * scale;
      } catch (e) {}
    }
    glyphs.push({ g, x, i: i0 + k, sty, ch });
    x += (g.advanceWidth || 0) * scale;
    prev = g;
    prevFont = f;
  });
  return { glyphs, width: x };
}

const NO_STYLE = {};
/** 텍스트 → 레이어 (글자별 색·높이차가 같으면 같은 레이어). 좌표 단위는 em 기준 100
 *  반환 배열에 .chars = [{i, ch, box:[x0,y0,x1,y1]}] (글자 선택·끌기용), .plain = 글자별 모양 없는 배치의 범위 */
export function textToLayers(font, text, { align = 'center', lineHeight = 1.2 } = {}, fallbacks = null, styles = null) {
  const size = 100;
  const all = [...text.replace(/\r/g, '')];
  const st = (i) => (styles && styles[i]) || NO_STYLE;
  const lines = [];
  let cur = [], i0 = 0;
  all.forEach((ch, i) => {
    if (ch === '\n') {
      lines.push({ chars: cur, i0 });
      cur = [];
      i0 = i + 1;
    } else cur.push(ch);
  });
  lines.push({ chars: cur, i0 });
  const laid = lines.map((l) => layoutLine(font, l.chars, l.i0, size, fallbacks, st));
  const plainW = Math.max(...lines.map((l) => layoutLine(font, l.chars, l.i0, size, fallbacks, () => NO_STYLE).width), 1);
  const maxW = Math.max(...laid.map((l) => l.width), 1);
  const groups = new Map();
  const chars = [];
  laid.forEach((ln, li) => {
    if (!ln.glyphs.length) return;
    let x0 = 0;
    if (align === 'center') x0 = (maxW - ln.width) / 2;
    else if (align === 'right') x0 = maxW - ln.width;
    const y = size + li * size * lineHeight;
    for (const { g, x, i, sty, ch } of ln.glyphs) {
      const sc = sty.s || 1;
      const gx = x0 + x + (sty.dx || 0) * size, gy = y - (sty.dy || 0) * size;
      const path = g.getPath(gx, gy, size * sc); // getPath는 글리프가 속한 폰트의 unitsPerEm으로 크기를 맞춤
      // 가로·세로 따로 늘이기 (글자 기준점 기준)
      if ((sty.sx && sty.sx !== 1) || (sty.sy && sty.sy !== 1)) {
        const fx = sty.sx || 1, fy = sty.sy || 1;
        for (const c of path.commands) {
          if (c.x !== undefined) (c.x = gx + (c.x - gx) * fx), (c.y = gy + (c.y - gy) * fy);
          if (c.x1 !== undefined) (c.x1 = gx + (c.x1 - gx) * fx), (c.y1 = gy + (c.y1 - gy) * fy);
          if (c.x2 !== undefined) (c.x2 = gx + (c.x2 - gx) * fx), (c.y2 = gy + (c.y2 - gy) * fy);
        }
      }
      // 회전(도, 시계 방향): 글자 범위의 중심 기준
      let rc = null;
      if (sty.r) {
        const b0 = path.getBoundingBox();
        if (isFinite(b0.x1) && b0.x2 > b0.x1) {
          rc = [(b0.x1 + b0.x2) / 2, (b0.y1 + b0.y2) / 2];
          const a = (sty.r * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
          const rot = (o, kx, ky) => {
            const x = o[kx] - rc[0], y = o[ky] - rc[1];
            o[kx] = rc[0] + ca * x - sa * y;
            o[ky] = rc[1] + sa * x + ca * y;
          };
          for (const c of path.commands) {
            if (c.x !== undefined) rot(c, 'x', 'y');
            if (c.x1 !== undefined) rot(c, 'x1', 'y1');
            if (c.x2 !== undefined) rot(c, 'x2', 'y2');
          }
        }
      }
      const key = (sty.color || '#000000') + '|' + (sty.dz || 0);
      if (!groups.has(key)) groups.set(key, { color: sty.color || '#000000', dz: sty.dz || 0, rings: [] });
      const rings = groups.get(key).rings;
      let cur = null;
      const flush = () => {
        if (cur && cur.length > 2) rings.push(closeRing(cur));
        cur = null;
      };
      for (const c of path.commands) {
        if (c.type === 'M') {
          flush();
          cur = [['M', c.x, c.y]];
        } else if (!cur) {
          continue;
        } else if (c.type === 'L') cur.push(['L', c.x, c.y]);
        else if (c.type === 'Q') cur.push(['Q', c.x1, c.y1, c.x, c.y]);
        else if (c.type === 'C') cur.push(['C', c.x1, c.y1, c.x2, c.y2, c.x, c.y]);
        else if (c.type === 'Z') flush();
      }
      flush();
      if (!/\s/.test(ch)) {
        const bb = path.getBoundingBox();
        if (isFinite(bb.x1) && bb.x2 > bb.x1) chars.push({ i, ch, box: [bb.x1, bb.y1, bb.x2, bb.y2], o: [gx, gy], c: rc || [(bb.x1 + bb.x2) / 2, (bb.y1 + bb.y2) / 2] });
      }
    }
  });
  const out = [...groups.values()].filter((g) => g.rings.length).sort((a, b) => (a.color === '#000000' && !a.dz ? -1 : 0) - (b.color === '#000000' && !b.dz ? -1 : 0));
  out.chars = chars;
  out.plainWidth = plainW;
  return out;
}
