// 레이저 작업 미리보기: 새김(채움 줄긋기) → 절단(안쪽 먼저) 순서로 레이저 머리가 움직이는 모습을 재생
import { flattenRing } from './geom.js';

const TRAVEL = 300; // mm/s 이동 속도(레이저 꺼짐)
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const inPoly = (x, y, p) => {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  return c;
};
const bbox = (p) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of p) (x < x0 && (x0 = x), x > x1 && (x1 = x), y < y0 && (y0 = y), y > y1 && (y1 = y));
  return [x0, y0, x1, y1];
};

/** 작업 계획: 선분 목록 (kind 0 이동 · 1 절단 · 2 새김) */
export function buildPlan(lm, speeds) {
  const strokes = []; // {pts, kind, color}
  const layers = lm.layers || [];
  // 1) 새김: 줄 간격으로 채움
  for (const l of layers) {
    if (l.op !== 'engrave') continue;
    const polys = l.items.map((it) => flattenRing(it.ring, 0.01)).filter((p) => p.length > 2);
    if (!polys.length) continue;
    let y0 = 1e9, y1 = -1e9;
    for (const p of polys) for (const q of p) (q[1] < y0 && (y0 = q[1]), q[1] > y1 && (y1 = q[1]));
    const sp = Math.max(0.25, (y1 - y0) / 350);
    let row = 0;
    for (let y = y0 + sp / 2; y < y1; y += sp, row++) {
      const xs = [];
      for (const p of polys) for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (p[i][1] > y !== p[j][1] > y) xs.push(p[j][0] + ((y - p[j][1]) * (p[i][0] - p[j][0])) / (p[i][1] - p[j][1]));
      xs.sort((a, b) => a - b);
      const segs = [];
      for (let k = 0; k + 1 < xs.length; k += 2) segs.push([[xs[k], y], [xs[k + 1], y]]);
      if (row % 2) segs.reverse().forEach((s) => s.reverse());
      for (const s of segs) strokes.push({ pts: s, kind: 2, color: l.color, w: sp });
    }
  }
  // 2) 절단: 다른 윤곽을 품고 있지 않은 것(안쪽)부터, 가까운 순
  const rings = [];
  for (const l of layers) {
    if (l.op === 'engrave') continue;
    for (const it of l.items) {
      const p = flattenRing(it.ring, 0.01);
      if (p.length > 2) rings.push({ pts: p, bb: bbox(p), color: l.color });
    }
  }
  const remain = rings.slice();
  const holds = (A, B) => A !== B && A.bb[0] <= B.bb[0] && A.bb[1] <= B.bb[1] && A.bb[2] >= B.bb[2] && A.bb[3] >= B.bb[3] && inPoly(B.pts[0][0], B.pts[0][1], A.pts);
  let head = strokes.length ? strokes[strokes.length - 1].pts[1] : [0, 0];
  if (remain.length > 400) {
    remain.sort((a, b) => (a.bb[2] - a.bb[0]) * (a.bb[3] - a.bb[1]) - (b.bb[2] - b.bb[0]) * (b.bb[3] - b.bb[1]));
    for (const r of remain) strokes.push({ pts: r.pts.concat([r.pts[0]]), kind: 1, color: r.color });
  } else {
    while (remain.length) {
      let free = remain.filter((r) => !remain.some((o) => holds(r, o)));
      if (!free.length) free = remain; // 서로 품는 경우(똑같은 윤곽 두 개 등)
      let best = null, bd = 1e18, bi = 0;
      for (const r of free) {
        for (let i = 0; i < r.pts.length; i += Math.max(1, Math.floor(r.pts.length / 40))) {
          const d = dist(head, r.pts[i]);
          if (d < bd) (bd = d), (best = r), (bi = i);
        }
      }
      const rp = best.pts.slice(bi).concat(best.pts.slice(0, bi), [best.pts[bi]]);
      strokes.push({ pts: rp, kind: 1, color: best.color });
      head = rp[rp.length - 1];
      remain.splice(remain.indexOf(best), 1);
    }
  }
  // 선분으로 펼치며 이동 삽입 + 누적 시간
  const S = { x0: [], y0: [], x1: [], y1: [], kind: [], col: [], w: [], t: [] };
  const colors = [];
  let pos = [0, 0], t = 0, cutLen = 0, engLen = 0, trvLen = 0;
  const push = (a, b, kind, color, w) => {
    const d = dist(a, b);
    if (d < 1e-9) return;
    const v = kind === 0 ? TRAVEL : kind === 1 ? speeds.cut : speeds.eng;
    t += d / v;
    if (kind === 0) trvLen += d;
    else if (kind === 1) cutLen += d;
    else engLen += d;
    let ci = colors.indexOf(color);
    if (ci < 0) ci = colors.push(color) - 1;
    S.x0.push(a[0]), S.y0.push(a[1]), S.x1.push(b[0]), S.y1.push(b[1]), S.kind.push(kind), S.col.push(ci), S.w.push(w || 0), S.t.push(t);
  };
  for (const st of strokes) {
    if (dist(pos, st.pts[0]) > 0.02) push(pos, st.pts[0], 0, '#888');
    for (let i = 0; i + 1 < st.pts.length; i++) push(st.pts[i], st.pts[i + 1], st.kind, st.color, st.w);
    pos = st.pts[st.pts.length - 1];
  }
  return { S, colors, total: t, n: S.t.length, cutLen, engLen, trvLen, layers };
}

const dark = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#222';
  const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return r * 0.3 + g * 0.6 + b * 0.1 > 200 ? '#444' : hex;
};
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createSim(ui) {
  const cv = ui.canvas, ctx = cv.getContext('2d');
  let lm = null, plan = null, W = 1, H = 1, k = 1, ox = 0, oy = 0;
  let t = 0, drawn = 0, playing = false, last = 0, raf = 0;
  const speeds = () => ({ cut: Math.max(1, parseFloat(ui.cut.value) || 10), eng: Math.max(1, parseFloat(ui.eng.value) || 150) });

  function fit() {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(10, Math.round(r.width * dpr));
    cv.height = Math.max(10, Math.round(r.height * dpr));
    const m = 28 * dpr;
    k = Math.min((cv.width - 2 * m) / W, (cv.height - 2 * m) / H);
    ox = (cv.width - W * k) / 2;
    oy = (cv.height - H * k) / 2;
  }
  const X = (x) => ox + x * k, Y = (y) => oy + y * k;
  function base() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fbf8f1';
    ctx.fillRect(ox - 8, oy - 8, W * k + 16, H * k + 16);
    ctx.strokeStyle = '#d8d2c4';
    ctx.strokeRect(ox - 8, oy - 8, W * k + 16, H * k + 16);
    if (!lm) return;
    // 계획선(아직 안 한 일): 연한 점선
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120,120,120,.45)';
    ctx.beginPath();
    for (const l of lm.layers)
      for (const it of l.items) {
        const p = flattenRing(it.ring, 0.01);
        p.forEach((q, i) => (i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))));
        ctx.closePath();
      }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function seg(i, f) {
    const S = plan.S, kind = S.kind[i];
    const x0 = S.x0[i], y0 = S.y0[i], x1 = x0 + (S.x1[i] - x0) * f, y1 = y0 + (S.y1[i] - y0) * f;
    if (kind === 0) {
      if (!ui.trv.checked) return;
      ctx.strokeStyle = 'rgba(80,120,220,.35)';
      ctx.lineWidth = 1;
    } else if (kind === 1) {
      ctx.strokeStyle = dark(plan.colors[S.col[i]]);
      ctx.lineWidth = Math.min(3, Math.max(1.5, 0.15 * k));
    } else {
      ctx.strokeStyle = dark(plan.colors[S.col[i]]);
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(1, (S.w[i] || 0.3) * k * 1.05);
    }
    ctx.beginPath();
    ctx.moveTo(X(x0), Y(y0));
    ctx.lineTo(X(x1), Y(y1));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function draw() {
    if (!plan) return;
    const T = plan.S.t;
    // t 이전에 끝난 선분 수
    let lo = 0, hi = plan.n;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      T[m] <= t ? (lo = m + 1) : (hi = m);
    }
    if (lo < drawn) (base(), (drawn = 0));
    ctx.lineCap = 'round';
    for (let i = drawn; i < lo; i++) seg(i, 1);
    drawn = lo;
    // 지금 움직이는 선분과 머리 위치
    // (부분 선분은 지우지 않고 겹쳐 그림: 같은 선 위라 문제없음)
    let hx = 0, hy = 0;
    if (lo < plan.n) {
      const t0 = lo ? T[lo - 1] : 0, f = (t - t0) / Math.max(1e-9, T[lo] - t0);
      seg(lo, Math.min(1, Math.max(0, f)));
      hx = plan.S.x0[lo] + (plan.S.x1[lo] - plan.S.x0[lo]) * f;
      hy = plan.S.y0[lo] + (plan.S.y1[lo] - plan.S.y0[lo]) * f;
    } else if (plan.n) (hx = plan.S.x1[plan.n - 1]), (hy = plan.S.y1[plan.n - 1]);
    const dpr = window.devicePixelRatio || 1;
    ui.head.style.display = plan.n ? 'block' : 'none';
    ui.head.style.transform = `translate(${X(hx) / dpr - 6}px,${Y(hy) / dpr - 6}px)`;
    ui.time.textContent = `${fmt(t)} / ${fmt(plan.total)}`;
    if (!ui.dragging) ui.pos.value = plan.total ? Math.round((t / plan.total) * 1000) : 0;
  }
  function redraw() {
    base();
    drawn = 0;
    draw();
  }
  function frame(now) {
    raf = 0;
    if (!playing) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t = Math.min(plan.total, t + dt * (parseFloat(ui.spd.value) || 40));
    draw();
    if (t >= plan.total) return setPlaying(false);
    raf = requestAnimationFrame(frame);
  }
  function setPlaying(on) {
    playing = on && !!plan && plan.total > 0;
    ui.play.textContent = playing ? ui.txtPause : ui.txtPlay;
    if (playing) {
      if (t >= plan.total) (t = 0), redraw();
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    }
  }
  ui.play.onclick = () => setPlaying(!playing);
  ui.rst.onclick = () => (setPlaying(false), (t = 0), redraw());
  ui.pos.oninput = () => {
    if (!plan) return;
    ui.dragging = true;
    t = (ui.pos.value / 1000) * plan.total;
    redraw();
    ui.dragging = false;
  };
  const rebuild = () => lm && (setModel(lm, W, H, true));
  [ui.cut, ui.eng].forEach((e) => e.addEventListener('change', rebuild));
  ui.trv.addEventListener('change', redraw);
  function setModel(m, w, h, keep) {
    lm = m;
    W = Math.max(1, w);
    H = Math.max(1, h);
    const frac = keep && plan && plan.total ? t / plan.total : 0;
    setPlaying(false);
    plan = buildPlan(lm, speeds());
    t = frac * plan.total;
    fit();
    redraw();
    ui.info.textContent = plan.n ? `절단 ${plan.cutLen.toFixed(0)} mm · 새김 ${plan.engLen.toFixed(0)} mm · 이동 ${plan.trvLen.toFixed(0)} mm` : '';
  }
  new ResizeObserver(() => {
    if (cv.offsetParent) (fit(), redraw());
  }).observe(cv);
  return { setModel, resize: () => (fit(), redraw()), stop: () => setPlaying(false) };
}
