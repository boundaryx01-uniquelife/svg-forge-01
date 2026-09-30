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

/** 한 줄을 글리프 단위로 배치 (GSUB 합자 등 고급 기능은 쓰지 않음 → 어떤 폰트도 안전하게 처리) */
function layoutLine(font, line, size, fallbacks) {
  const glyphs = [];
  let x = 0;
  let prev = null;
  let prevFont = null;
  for (const ch of line) {
    const f = pickFont(font, fallbacks, ch);
    const scale = size / f.unitsPerEm;
    const g = f.charToGlyph(ch);
    if (prev && prevFont === f) {
      try {
        x += (f.getKerningValue(prev, g) || 0) * scale;
      } catch (e) {}
    }
    glyphs.push({ g, x });
    x += (g.advanceWidth || 0) * scale;
    prev = g;
    prevFont = f;
  }
  return { glyphs, width: x };
}

/** 텍스트 → 링 목록 (단일 검정 레이어). 좌표 단위는 em 기준 100 */
export function textToLayers(font, text, { align = 'center', lineHeight = 1.2 } = {}, fallbacks = null) {
  const size = 100;
  const lines = text.replace(/\r/g, '').split('\n').map((l) => layoutLine(font, l, size, fallbacks));
  const maxW = Math.max(...lines.map((l) => l.width), 1);
  const rings = [];
  lines.forEach((ln, li) => {
    if (!ln.glyphs.length) return;
    let x0 = 0;
    if (align === 'center') x0 = (maxW - ln.width) / 2;
    else if (align === 'right') x0 = maxW - ln.width;
    const y = size + li * size * lineHeight;
    for (const { g, x } of ln.glyphs) {
      const path = g.getPath(x0 + x, y, size); // getPath는 글리프가 속한 폰트의 unitsPerEm으로 크기를 맞춤
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
    }
  });
  return rings.length ? [{ color: '#000000', rings }] : [];
}

