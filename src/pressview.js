// 성형 미리보기: 단면으로 '데운 본체를 틀에 끼워 누르는' 과정을 보여 준다.
// 5단계 — ① 올리기 ② 덮기 ③ 누르기 ④ 틀 분리 ⑤ 두 장 붙이기

const C = {
  male: '#3b72d9', maleEdge: '#1d4fa8',
  female: '#c07a4a', femaleEdge: '#8e5527',
  part: '#17a673', partEdge: '#0b6b4f',
  bg: '#f7f9fb', grid: '#e4ebf2', ink: '#1c2230', sub: '#5d6678',
};

export const STAGES = [
  { to: 0.16, name: '① 본체를 수틀에 올립니다', tip: '평평하게 출력한 본체를 뜨거운 물이나 열풍기로 데웁니다' },
  { to: 0.42, name: '② 암틀을 덮습니다', tip: '암틀은 좌우로 뒤집어 덮습니다 — 굵은 핀이 있는 쪽이 맞물리는 방향' },
  { to: 0.60, name: '③ 눌러서 성형합니다', tip: '두 틀 사이 간격만큼만 눌립니다. 무늬가 벌어지며 곡면을 따라갑니다' },
  { to: 0.76, name: '④ 식힌 뒤 틀을 뺍니다', tip: '식기 전에 빼면 모양이 돌아갑니다' },
  { to: 1.00, name: '⑤ 두 장을 붙입니다', tip: '같은 것을 두 장 만들어 평평한 테두리끼리 붙이면 입체가 됩니다' },
];

export function stageAt(t) {
  for (let i = 0; i < STAGES.length; i++) if (t <= STAGES[i].to) return i;
  return STAGES.length - 1;
}
const ease = (u) => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
const seg = (t, a, b) => ease((t - a) / (b - a));

/** 격자 샘플 → 닫힌 다각형. top[i] 위쪽 면, bottom 은 값 또는 배열 */
function solid(xs, top, bottom) {
  const pts = [];
  for (let i = 0; i < xs.length; i++) pts.push([xs[i], top[i]]);
  for (let i = xs.length - 1; i >= 0; i--) pts.push([xs[i], typeof bottom === 'number' ? bottom : bottom[i]]);
  return pts;
}
/** 실루엣 범위만 잘라낸 격자 */
function clipRange(xs, zs, x0, x1) {
  const ox = [], oz = [];
  for (let i = 0; i < xs.length; i++) if (xs[i] >= x0 - 1e-6 && xs[i] <= x1 + 1e-6) (ox.push(xs[i]), oz.push(zs[i]));
  return [ox, oz];
}

function fill(ctx, pts, color, edge, X, Z) {
  if (pts.length < 2) return;
  ctx.beginPath();
  pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * 한 장면 그리기.
 * p: pressProfile() 결과, t: 0~1 진행
 */
export function drawPress(cv, p, t, opts = {}) {
  const ctx = cv.getContext('2d');
  const W = cv.width, Hh = cv.height;
  ctx.clearRect(0, 0, W, Hh);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, Hh);
  if (!p) return;

  const stage = stageAt(t);
  const joining = stage === 4;
  const padX = 30, padY = 30;
  const spanX = p.plateX[1] - p.plateX[0];
  const spanZ = joining ? (p.domeH + p.thick) * 2 + 12 : p.floor + p.domeH + p.gap + 7 + (p.domeH + p.gap + 8) + 4;
  const s = Math.min((W - padX * 2) / spanX, (Hh - padY * 2 - 40) / spanZ);
  const cx = (p.plateX[0] + p.plateX[1]) / 2;
  const X = (x) => W / 2 + (x - cx) * s;
  const baseY = Hh - padY - 24;
  const Z = (z) => baseY - z * s;

  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX / 2, baseY + 0.5);
  ctx.lineTo(W - padX / 2, baseY + 0.5);
  ctx.stroke();

  const [px, pzMale] = clipRange(p.xs, p.maleZ, p.silX[0], p.silX[1]);

  if (!joining) {
    const close = seg(t, STAGES[0].to, STAGES[1].to);
    const open = seg(t, STAGES[2].to, STAGES[3].to);
    const lift = Math.max(0, 1 - close + open) * (p.domeH + p.gap + 8);
    const form = seg(t, STAGES[1].to - 0.06, STAGES[2].to);

    // 수틀 (바닥부터 윗면까지 꽉 찬 덩어리)
    fill(ctx, solid(p.xs, p.maleZ, 0), C.male, C.maleEdge, X, Z);

    // 본체: 평평한 판이 돔 꼭대기에 얹힌 상태 → 눌려서 돔 면을 따라감
    const apex = p.floor + p.domeH;
    const top = pzMale.map((z) => apex + (z - apex) * form + p.thick);
    const bot = top.map((z) => z - p.thick);
    fill(ctx, solid(px, top, bot), C.part, C.partEdge, X, Z);

    // 암틀 (안쪽면 위로 덩어리) — 들어 올린 높이만큼 이동
    const fz = p.femaleZ.map((z) => z + lift);
    const topZ = p.floor + p.domeH + p.gap + 7 + lift;
    fill(ctx, solid(p.xs, p.xs.map(() => topZ), fz), C.female, C.femaleEdge, X, Z);

    if (stage === 2) {
      const i = Math.round(p.xs.length / 2);
      const mx = p.xs[i], mz = p.maleZ[i];
      ctx.strokeStyle = C.ink;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(X(mx), Z(mz));
      ctx.lineTo(X(mx), Z(mz + p.gap));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.ink;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`간격 ${p.gap}mm = 본체 두께 + 여유`, X(mx) + 8, Z(mz + p.gap / 2) + 4);
    }
  } else {
    // ⑤ 성형된 두 장을 테두리끼리 맞붙이기
    const u = seg(t, STAGES[3].to, 0.93);
    const rel = pzMale.map((z) => z - p.floor);             // 테두리를 0 으로
    const rise = (1 - u) * (p.domeH + p.thick + 10);
    const mid = 2;
    const loTop = rel.map((z) => mid - z - p.thick), loBot = rel.map(() => mid - 0);
    const hiBot = rel.map(() => mid + rise), hiTop = rel.map((z) => mid + z + p.thick + rise);
    fill(ctx, solid(px, loBot, loTop), C.part, C.partEdge, X, (z) => Z(z + p.domeH + 4));
    fill(ctx, solid(px, hiTop, hiBot), C.part, C.partEdge, X, (z) => Z(z + p.domeH + 4));
    if (u > 0.8) {
      // 맞붙은 자리 (두 장이 만나는 선)
      const zy = Z(p.domeH + 4 + mid);
      ctx.strokeStyle = 'rgba(11,107,79,.9)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(p.silX[0]), zy);
      ctx.lineTo(X(p.silX[1]), zy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.ink;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`평평한 테두리 ${p.rim}mm 끼리 맞붙는 자리`, W / 2, Hh - 40);
    }
  }

  const st = STAGES[stage];
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(st.name, padX / 2, 24);
  ctx.fillStyle = C.sub;
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.fillText(st.tip, padX / 2, 43);

  if (!opts.noLegend) {
    const items = joining ? [['성형된 본체 두 장', C.part]] : [['수틀', C.male], ['본체', C.part], ['암틀', C.female]];
    let lx = padX / 2;
    ctx.font = '12px system-ui, sans-serif';
    for (const [name, col] of items) {
      ctx.fillStyle = col;
      ctx.fillRect(lx, Hh - 18, 10, 10);
      ctx.fillStyle = C.sub;
      ctx.fillText(name, lx + 14, Hh - 9);
      lx += 14 + ctx.measureText(name).width + 14;
    }
  }
}
