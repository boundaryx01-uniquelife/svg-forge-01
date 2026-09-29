// Potrace 출력 경로(상대 좌표, 0.1px 단위, Y 뒤집힘) → 내부 링 형식 (이미지 픽셀 좌표)
export function potracePathsToRings(paths, height) {
  const rings = [];
  const X = (x) => x * 0.1;
  const Y = (y) => height - y * 0.1;
  for (const d of paths) {
    const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0;
    let cur = null;
    const num = () => parseFloat(tok[i++]);
    const flush = () => {
      if (cur && cur.length > 2) rings.push(cur);
      cur = null;
    };
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase();
      switch (cmd.toUpperCase()) {
        case 'M': {
          flush();
          const x = num(), y = num();
          cx = rel ? cx + x : x;
          cy = rel ? cy + y : y;
          sx = cx;
          sy = cy;
          cur = [['M', X(cx), Y(cy)]];
          cmd = rel ? 'l' : 'L';
          break;
        }
        case 'L': {
          const x = num(), y = num();
          cx = rel ? cx + x : x;
          cy = rel ? cy + y : y;
          cur.push(['L', X(cx), Y(cy)]);
          break;
        }
        case 'C': {
          const v = [num(), num(), num(), num(), num(), num()];
          const b = rel ? [cx, cy, cx, cy, cx, cy] : [0, 0, 0, 0, 0, 0];
          const p = v.map((t, k) => t + b[k]);
          cur.push(['C', X(p[0]), Y(p[1]), X(p[2]), Y(p[3]), X(p[4]), Y(p[5])]);
          cx = p[4];
          cy = p[5];
          break;
        }
        case 'Z': {
          cx = sx;
          cy = sy;
          flush();
          cmd = '';
          break;
        }
        default:
          i++;
      }
    }
    flush();
  }
  return rings;
}
