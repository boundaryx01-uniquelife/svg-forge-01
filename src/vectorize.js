// 벡터화 파이프라인 v3
//   분석(analyzeChain) → 전역 정규화(regularize) → 출력(emitChain)
// 윤곽 조각(chain)은 닫힌 고리(단색 윤곽) 또는 양 끝이 고정된 열린 사슬(다색 경계)이다.
// 같은 사슬을 한 번만 출력해 양쪽 색이 공유하므로 색 사이에 틈·겹침이 생기지 않는다.
import { fitCubic, fitLine, intersectLines, lineStats, spanToCmds } from './contour.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => {
  const l = len(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l] : [0, 0];
};
const DEG = Math.PI / 180;
const angBetween = (u, v) => Math.acos(Math.max(-1, Math.min(1, dot(norm(u), norm(v)))));

// ---------- 재샘플 / 스무딩 ----------

export function resample(poly, closed, step) {
  const n = poly.length;
  const segs = closed ? n : n - 1;
  const cum = [0];
  for (let i = 0; i < segs; i++) cum.push(cum[i] + len(sub(poly[(i + 1) % n], poly[i])));
  const L = cum[segs];
  if (!(L > 1e-9)) return { pts: poly.slice(0, 1), ds: step };
  const m = closed ? Math.max(8, Math.round(L / step)) : Math.max(1, Math.round(L / step));
  const ds = L / m;
  const out = [];
  let i = 0;
  const count = closed ? m : m + 1;
  for (let k = 0; k < count; k++) {
    const target = Math.min(L, k * ds);
    while (i < segs - 1 && cum[i + 1] < target) i++;
    const a = poly[i], b = poly[(i + 1) % n];
    const sl = cum[i + 1] - cum[i];
    const t = sl > 1e-12 ? (target - cum[i]) / sl : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  if (!closed) out[out.length - 1] = poly[n - 1].slice();
  return { pts: out, ds };
}

function smooth(p, closed, iters) {
  let a = p;
  const n = p.length;
  if (n < 3) return p;
  for (let it = 0; it < iters; it++) {
    const b = new Array(n);
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) {
        b[i] = a[i];
        continue;
      }
      const q = a[(i - 1 + n) % n], r = a[i], s = a[(i + 1) % n];
      b[i] = [(q[0] + 2 * r[0] + s[0]) / 4, (q[1] + 2 * r[1] + s[1]) / 4];
    }
    a = b;
  }
  return a;
}

function makeAt(p, closed) {
  const n = p.length;
  return closed ? (i) => p[((i % n) + n) % n] : (i) => p[i < 0 ? 0 : i >= n ? n - 1 : i];
}

function turnAt(at, i, k) {
  const u = norm(sub(at(i), at(i - k))), v = norm(sub(at(i + k), at(i)));
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
}

function detectCorners(at, n, closed, ds, angleDeg) {
  const k1 = Math.max(2, Math.round(2.0 / ds));
  const k2 = k1 * 2;
  if (n < k2 * 2 + 2) return [];
  const thr = angleDeg * DEG;
  const lo = closed ? 0 : k2, hi = closed ? n : n - k2;
  const a1 = new Float32Array(n);
  const cand = new Uint8Array(n);
  for (let i = lo; i < hi; i++) {
    a1[i] = turnAt(at, i, k1);
    if (a1[i] < thr) continue;
    const a2 = turnAt(at, i, k2);
    if (a1[i] / Math.max(a2, 1e-6) > 0.72) cand[i] = 1;
  }
  const corners = [];
  for (let i = lo; i < hi; i++) {
    if (!cand[i]) continue;
    let isMax = true;
    for (let j = -k1; j <= k1 && isMax; j++) {
      if (!j) continue;
      const q = closed ? (i + j + n) % n : i + j;
      if (q < 0 || q >= n) continue;
      if (cand[q] && (a1[q] > a1[i] || (a1[q] === a1[i] && q < i))) isMax = false;
    }
    if (isMax) corners.push(i);
  }
  return corners;
}

// ---------- 직선 구간 ----------

function findRuns(at, from, to, ds, lineTol) {
  if (!(lineTol > 0) || to - from < 4) return [];
  const minLen = Math.max(10, 8 * lineTol);
  const minPts = Math.max(6, Math.round(minLen / ds));
  const sagTol = Math.max(0.15, 0.45 * lineTol);
  const maxTurn = 3 * DEG;
  const slice = (a, b) => {
    const r = [];
    for (let k = a; k <= b; k++) r.push(at(k));
    return r;
  };
  const ok = (a, b) => {
    const st = lineStats(slice(a, b));
    return st.maxDev <= lineTol && st.sag <= sagTol ? st : null;
  };
  const runs = [];
  let a = from;
  while (a + minPts <= to) {
    let st = ok(a, a + minPts);
    if (!st) {
      a += 2;
      continue;
    }
    let good = a + minPts, step = minPts;
    while (good < to) {
      const nb = Math.min(to, good + step);
      const s2 = ok(a, nb);
      if (s2) {
        good = nb;
        st = s2;
        step *= 2;
      } else if (step > 1) step = Math.max(1, step >> 1);
      else break;
    }
    const turn = st.length > 0 ? (8 * st.sag) / st.length : 0;
    if (st.length >= minLen && turn <= maxTurn) {
      runs.push({ a, b: good, c: st.c, dir: st.dir });
      a = good + 1;
    } else a += 2;
  }
  const merged = [];
  for (const r of runs) {
    const pr = merged[merged.length - 1];
    if (pr && r.a - pr.b <= 4 && Math.abs(dot(pr.dir, r.dir)) > Math.cos(2 * DEG)) {
      const st = ok(pr.a, r.b);
      if (st) {
        pr.b = r.b;
        pr.c = st.c;
        pr.dir = st.dir;
        continue;
      }
    }
    merged.push({ ...r });
  }
  const perp = (q, c, d) => Math.abs(cross(d, sub(q, c)));
  const endTol = Math.max(0.2, 0.3 * lineTol);
  const out = [];
  for (const r of merged) {
    if (dot(r.dir, sub(at(r.b), at(r.a))) < 0) r.dir = mul(r.dir, -1);
    while (r.b - r.a > minPts && perp(at(r.b), r.c, r.dir) > endTol) r.b--;
    while (r.b - r.a > minPts && perp(at(r.a), r.c, r.dir) > endTol) r.a++;
    if (perp(at(r.a), r.c, r.dir) <= endTol * 2 && perp(at(r.b), r.c, r.dir) <= endTol * 2) {
      r.at = at;
      r.c0 = r.c.slice();
      r.dir0 = r.dir.slice();
      out.push(r);
    }
  }
  return out;
}

const projectOn = (pt, r) => add(r.c, mul(r.dir, dot(sub(pt, r.c), r.dir)));

// ---------- 원 / 원호 ----------

/** 대수적 원 적합(Kasa) + 기하 보정(가우스-뉴턴 몇 회) */
export function fitCircle(P) {
  let mx = 0, my = 0;
  for (const q of P) {
    mx += q[0];
    my += q[1];
  }
  mx /= P.length;
  my /= P.length;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const q of P) {
    const u = q[0] - mx, v = q[1] - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-12) return null;
  const b1 = 0.5 * (suuu + suvv), b2 = 0.5 * (svvv + svuu);
  let cx = (b1 * svv - b2 * suv) / det + mx;
  let cy = (suu * b2 - suv * b1) / det + my;
  let r = 0;
  for (let it = 0; it < 8; it++) {
    // r = 평균 거리, 중심은 잔차 기울기로 이동
    let sr = 0;
    const d = P.map((q) => Math.hypot(q[0] - cx, q[1] - cy));
    for (const v of d) sr += v;
    r = sr / P.length;
    let gx = 0, gy = 0;
    for (let i = 0; i < P.length; i++) {
      if (d[i] < 1e-9) continue;
      const e = d[i] - r;
      gx += (e * (P[i][0] - cx)) / d[i];
      gy += (e * (P[i][1] - cy)) / d[i];
    }
    cx += gx / P.length;
    cy += gy / P.length;
  }
  let maxDev = 0;
  for (const q of P) maxDev = Math.max(maxDev, Math.abs(Math.hypot(q[0] - cx, q[1] - cy) - r));
  return { c: [cx, cy], r, maxDev };
}

/** 두 끝점 A,B를 반드시 지나는 원호 적합. dir=+1: atan2 각이 증가하는 방향 */
function fitArcThrough(P, A, B) {
  const AB = sub(B, A);
  const d = len(AB);
  if (d < 1e-6) return null;
  const m = mul(add(A, B), 0.5);
  const u = [-AB[1] / d, AB[0] / d];
  const k = fitCircle(P);
  if (!k || !isFinite(k.r)) return null;
  let s = dot(sub(k.c, m), u);
  const F = (s) => {
    const c = add(m, mul(u, s));
    const r = len(sub(A, c));
    let e = 0;
    for (const q of P) {
      const t = len(sub(q, c)) - r;
      e += t * t;
    }
    return e;
  };
  // 1차원 최소화 (황금분할)
  let span = Math.max(d, Math.abs(s) * 0.5 + d);
  let lo = s - span, hi = s + span;
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo);
  let f1 = F(x1), f2 = F(x2);
  for (let it = 0; it < 60; it++) {
    if (f1 < f2) {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - g * (hi - lo);
      f1 = F(x1);
    } else {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + g * (hi - lo);
      f2 = F(x2);
    }
  }
  s = (lo + hi) / 2;
  const c = add(m, mul(u, s));
  const r = len(sub(A, c));
  let maxDev = 0;
  for (const q of P) maxDev = Math.max(maxDev, Math.abs(len(sub(q, c)) - r));
  // 방향: 중간점이 놓인 쪽
  const ang = (q) => Math.atan2(q[1] - c[1], q[0] - c[0]);
  const a0 = ang(A), a1 = ang(B), am = ang(P[Math.floor(P.length / 2)]);
  const ccwSweep = (from, to) => {
    let x = to - from;
    while (x < 0) x += 2 * Math.PI;
    while (x >= 2 * Math.PI) x -= 2 * Math.PI;
    return x;
  };
  const sPos = ccwSweep(a0, a1);
  const dir = ccwSweep(a0, am) <= sPos ? 1 : -1;
  const sweep = dir > 0 ? sPos : 2 * Math.PI - sPos;
  return { c, r, dir, sweep, maxDev };
}

const arcTangent = (c, pt, dir) => norm(mul([-(pt[1] - c[1]), pt[0] - c[0]], dir));

/** 원호를 90° 이하 조각으로 나눠 A 명령으로 추가. A = ['A', cx, cy, r, dir, x, y] */
function pushArc(cmds, c, r, dir, from, to, sweep) {
  const k = Math.max(1, Math.ceil(sweep / (Math.PI / 2 + 1e-9)));
  const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
  for (let i = 1; i <= k; i++) {
    if (i === k) cmds.push(['A', c[0], c[1], r, dir, to[0], to[1]]);
    else {
      const a = a0 + (dir * sweep * i) / k;
      cmds.push(['A', c[0], c[1], r, dir, c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
    }
  }
}

// ---------- 분석 ----------

/**
 * pts: 윤곽 점열, closed: 닫힘 여부 (열린 사슬은 양 끝 고정)
 * o: { tol, cornerAngle, smooth, lineTol, arcs }
 */
export function analyzeChain(pts, closed, o) {
  const step = 0.5;
  let { pts: p, ds } = resample(pts, closed, step);
  if (o.smooth > 0 && p.length > 4) p = smooth(p, closed, o.smooth);
  const n = p.length;
  const at = makeAt(p, closed);
  const ch = { closed, p, n, ds, at, pseudo: false, spans: [], circle: null };
  if (n < 2 || (closed && n < 4)) {
    ch.degenerate = true;
    return ch;
  }
  // 모서리 없는 닫힌 윤곽이 원에 맞으면 완전한 원 (직선 인식보다 먼저)
  if (o.arcs && closed && n >= 16) {
    const k = fitCircle(p);
    if (k && k.r > 1.5 && k.maxDev <= Math.max(o.tol, 0.3) && k.maxDev <= 0.06 * k.r) {
      ch.circle = k;
      ch.corners = [0];
      return ch;
    }
  }
  let corners = detectCorners(at, n, closed, ds, o.cornerAngle);
  if (closed && !corners.length) {
    let s = 0, best = -1;
    const k = Math.max(2, Math.round(2 / ds));
    for (let i = 0; i < n; i += 2) {
      const a = turnAt(at, i, k);
      if (a > best) {
        best = a;
        s = i;
      }
    }
    corners = [s];
    ch.pseudo = true;
  }
  if (!closed) corners = [0, ...corners.filter((c) => c > 0 && c < n - 1), n - 1];
  ch.corners = corners;
  const skip = ch.pseudo ? 0 : Math.max(1, Math.round(1.25 / ds));
  ch.skip = skip;
  const slack = skip + Math.max(2, Math.round(1.5 / ds));
  const nSpans = closed ? corners.length : corners.length - 1;
  for (let ci = 0; ci < nSpans; ci++) {
    const i = corners[ci];
    let j = corners[(ci + 1) % corners.length];
    if (closed && j <= i) j += n;
    const sFrom = !closed && ci === 0 ? i : i + skip;
    const sTo = !closed && ci === nSpans - 1 ? j : j - skip;
    const runs = findRuns(at, sFrom, sTo, ds, o.lineTol);
    const first = runs[0], last = runs[runs.length - 1];
    ch.spans.push({
      i,
      j,
      runs,
      startRun: !ch.pseudo && first && first.a - i <= slack ? first : null,
      endRun: !ch.pseudo && last && j - last.b <= slack ? last : null,
    });
  }
  return ch;
}

// ---------- 전역 정규화 ----------

function runPtsDev(r, c, dir) {
  let mx = 0;
  for (let k = r.a; k <= r.b; k++) mx = Math.max(mx, Math.abs(cross(dir, sub(r.at(k), c))));
  return mx;
}
function runLength(r) {
  return Math.abs(dot(sub(r.at(r.b), r.at(r.a)), r.dir));
}

/**
 * chains의 모든 직선을 모아 평행·같은 두께·일직선(기준선) 정렬.
 * o: { snapDeg, parallel, equalWidth, align, lineTol }
 * sampler(x,y) → 라벨(잉크 여부 판정용, 없으면 두께 맞춤 생략). isInk(label) → bool
 */
export function regularize(chains, o, sampler, isInk) {
  const runs = [];
  for (const ch of chains) for (const sp of ch.spans || []) for (const r of sp.runs) runs.push(r);
  if (!runs.length) return { runs: 0 };
  const lim = o.lineTol * 1.5;
  for (const r of runs) r.L = runLength(r);
  const stats = { runs: runs.length, snapped: 0, parallel: 0, width: 0, aligned: 0 };

  // 1) 각도 군집 (수평·수직 우선)
  const angOf = (d) => {
    let a = Math.atan2(d[1], d[0]);
    if (a < 0) a += Math.PI;
    if (a >= Math.PI) a -= Math.PI;
    return a;
  };
  const angDiff = (a, b) => {
    let x = Math.abs(a - b) % Math.PI;
    return Math.min(x, Math.PI - x);
  };
  const clusters = [];
  if (o.snapDeg > 0) {
    clusters.push({ ang: 0, axis: true, tol: o.snapDeg * DEG, members: [] });
    clusters.push({ ang: Math.PI / 2, axis: true, tol: o.snapDeg * DEG, members: [] });
  }
  const parTol = 1.5 * DEG;
  const sorted = runs.slice().sort((a, b) => b.L - a.L);
  for (const r of sorted) {
    const a = angOf(r.dir);
    let best = null, bd = Infinity;
    for (const cl of clusters) {
      const d = angDiff(a, cl.ang);
      const t = cl.axis ? cl.tol : parTol;
      if (d <= t && d < bd && (cl.axis || o.parallel)) {
        bd = d;
        best = cl;
      }
    }
    if (!best) {
      best = { ang: a, axis: false, members: [], sw: 0, sx: 0, sy: 0 };
      clusters.push(best);
    }
    best.members.push(r);
    if (!best.axis) {
      // 길이 가중 원형 평균 (2θ)
      best.sw += r.L;
      best.sx += r.L * Math.cos(2 * a);
      best.sy += r.L * Math.sin(2 * a);
      best.ang = Math.atan2(best.sy, best.sx) / 2;
      if (best.ang < 0) best.ang += Math.PI;
    }
  }
  for (const cl of clusters) {
    const d0 = [Math.cos(cl.ang), Math.sin(cl.ang)];
    if (cl.axis) {
      d0[0] = Math.round(d0[0]);
      d0[1] = Math.round(d0[1]);
    }
    cl.d0 = d0;
    cl.n0 = [-d0[1], d0[0]];
    const kept = [];
    for (const r of cl.members) {
      let nd = dot(d0, r.dir) < 0 ? mul(d0, -1) : d0.slice();
      if (cl.members.length === 1 && !cl.axis) {
        kept.push(r);
        continue;
      }
      if (runPtsDev(r, r.c, nd) <= o.lineTol) {
        if (angDiff(angOf(nd), angOf(r.dir)) > 1e-9) cl.axis ? stats.snapped++ : stats.parallel++;
        r.dir = nd;
        kept.push(r);
      }
    }
    cl.members = kept;
  }

  // 2) 같은 두께: 마주 보는 평행선 쌍
  if (o.equalWidth && sampler) {
    for (const cl of clusters) {
      const M = cl.members;
      if (M.length < 2) continue;
      const info = M.map((r) => {
        const s0 = dot(r.at(r.a), cl.d0), s1 = dot(r.at(r.b), cl.d0);
        return { r, off: dot(r.c, cl.n0), lo: Math.min(s0, s1), hi: Math.max(s0, s1), fwd: dot(r.dir, cl.d0) > 0 };
      });
      const best = new Map();
      for (const A of info) {
        let bb = null, bw = Infinity;
        for (const B of info) {
          if (A === B || A.fwd === B.fwd) continue;
          const w = Math.abs(A.off - B.off);
          if (w < 0.8 || w >= bw) continue;
          const ov = Math.min(A.hi, B.hi) - Math.max(A.lo, B.lo);
          if (ov < 0.5 * Math.min(A.hi - A.lo, B.hi - B.lo)) continue;
          bw = w;
          bb = B;
        }
        if (bb) best.set(A, { B: bb, w: bw });
      }
      const pairs = [];
      for (const [A, { B, w }] of best) {
        const back = best.get(B);
        if (!back || back.B !== A || A.off > B.off) continue; // 서로 최선 + 한 번만
        // 잉크 판정: 두 선 사이 = 같은 라벨(잉크), 바깥 = 다른 라벨
        const lo = Math.max(A.lo, B.lo), hi = Math.min(A.hi, B.hi);
        let L = null, good = true;
        for (const f of [0.25, 0.5, 0.75]) {
          const s = lo + (hi - lo) * f;
          const base = add(mul(cl.d0, s), mul(cl.n0, 0));
          const mid = add(base, mul(cl.n0, (A.off + B.off) / 2));
          const outA = add(base, mul(cl.n0, A.off - Math.min(1.5, w / 3)));
          const outB = add(base, mul(cl.n0, B.off + Math.min(1.5, w / 3)));
          const lm = sampler(mid[0], mid[1]);
          if (L === null) L = lm;
          if (lm !== L || sampler(outA[0], outA[1]) === L || sampler(outB[0], outB[1]) === L) good = false;
        }
        if (good && isInk(L)) pairs.push({ A, B, w, wt: hi - lo, L });
      }
      pairs.sort((p, q) => q.wt - p.wt);
      const used = new Set();
      for (const p of pairs) {
        if (used.has(p)) continue;
        const grp = pairs.filter((q) => !used.has(q) && q.L === p.L && Math.abs(q.w - p.w) <= Math.max(0.75, 0.08 * p.w));
        if (grp.length < 2) continue;
        let sw = 0, s = 0;
        for (const q of grp) {
          sw += q.wt;
          s += q.w * q.wt;
        }
        const target = s / sw;
        for (const q of grp) {
          used.add(q);
          const dlt = (target - q.w) / 2; // A.off < B.off: A는 -, B는 + 방향으로
          const cA = add(q.A.r.c, mul(cl.n0, -dlt)), cB = add(q.B.r.c, mul(cl.n0, dlt));
          if (runPtsDev(q.A.r, cA, q.A.r.dir) <= lim && runPtsDev(q.B.r, cB, q.B.r.dir) <= lim) {
            q.A.r.c = cA;
            q.B.r.c = cB;
            if (Math.abs(dlt) > 1e-6) stats.width++;
          }
        }
      }
    }
  }

  // 3) 일직선·기준선 정렬 (같은 방향 직선의 위치를 모음)
  if (o.align) {
    const tolA = Math.max(0.6, 0.8 * o.lineTol);
    for (const cl of clusters) {
      const M = cl.members.slice().sort((a, b) => b.L - a.L);
      const done = new Set();
      for (const r of M) {
        if (done.has(r)) continue;
        const o0 = dot(r.c, cl.n0);
        const grp = M.filter((q) => !done.has(q) && Math.abs(dot(q.c, cl.n0) - o0) <= tolA);
        if (grp.length < 2) {
          done.add(r);
          continue;
        }
        let sw = 0, s = 0;
        for (const q of grp) {
          sw += q.L;
          s += q.L * dot(q.c, cl.n0);
        }
        const target = s / sw;
        for (const q of grp) {
          done.add(q);
          const nc = add(q.c, mul(cl.n0, target - dot(q.c, cl.n0)));
          if (runPtsDev(q, nc, q.dir) <= lim) {
            if (len(sub(nc, q.c)) > 1e-6) stats.aligned++;
            q.c = nc;
          }
        }
      }
    }
  }
  return stats;
}

// ---------- 출력 ----------

function curvePiece(cur, pts, end, t1, t2, c1, c2, o, cmds) {
  if (len(sub(end, cur)) < 1e-6 && pts.length < 2) return;
  const P = [cur, ...pts, end];
  if (o.arcs && P.length >= 5 && len(sub(end, cur)) > 1e-3) {
    const arc = fitArcThrough(P, cur, end);
    if (arc && arc.maxDev <= o.tol && arc.sweep >= 15 * DEG && arc.sweep <= 350 * DEG && arc.r < 2e4 && arc.r > 0.75) {
      const okA = !c1 || angBetween(arcTangent(arc.c, cur, arc.dir), t1) <= 3 * DEG;
      const okB = !c2 || angBetween(arcTangent(arc.c, end, arc.dir), mul(t2, -1)) <= 3 * DEG;
      if (okA && okB) {
        pushArc(cmds, arc.c, arc.r, arc.dir, cur, end, arc.sweep);
        return;
      }
    }
  }
  if (P.length === 2) {
    const u = norm(sub(end, cur));
    if (dot(u, t1) > 0.9995 && dot(mul(u, -1), t2) > 0.9995) {
      cmds.push(['L', end[0], end[1]]);
      return;
    }
  }
  spanToCmds(P, t1, t2, o.tol, cmds);
}

/** 분석된 사슬 → 명령 목록 (M으로 시작). 닫힌 사슬은 시작점으로 되돌아옴 */
export function emitChain(ch, o) {
  const { at, n, closed } = ch;
  if (ch.degenerate) {
    const cm = [['M', ch.p[0][0], ch.p[0][1]]];
    for (let i = 1; i < ch.p.length; i++) cm.push(['L', ch.p[i][0], ch.p[i][1]]);
    return cm;
  }
  if (ch.circle) {
    const { c, r } = ch.circle;
    let area = 0;
    for (let i = 0; i < n; i++) area += cross(at(i), at(i + 1));
    const dir = area > 0 ? 1 : -1;
    const a0 = Math.atan2(at(0)[1] - c[1], at(0)[0] - c[0]);
    const s = [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)];
    const cm = [['M', s[0], s[1]]];
    pushArc(cm, c, r, dir, s, s, 2 * Math.PI);
    return cm;
  }
  const corners = ch.corners;
  const nC = corners.length;
  const skip = ch.skip;
  const spans = ch.spans;
  const nS = spans.length;
  const cPos = [], tOut = [], tIn = [], smoothC = [];
  for (let ci = 0; ci < nC; ci++) {
    const i = corners[ci];
    let pos = at(i);
    let dOut = null, dIn = null;
    const inSpan = closed ? spans[(ci - 1 + nS) % nS] : ci > 0 ? spans[ci - 1] : null;
    const outSpan = closed ? spans[ci] : ci < nS ? spans[ci] : null;
    const inRun = inSpan ? inSpan.endRun : null;
    const outRun = outSpan ? outSpan.startRun : null;
    const fixed = !closed && (ci === 0 || ci === nC - 1);
    const m = Math.max(2, Math.round(3 / ch.ds));
    if (ch.pseudo) {
      dOut = norm(sub(at(i + 1), at(i - 1)));
      dIn = mul(dOut, -1);
      smoothC.push(true);
    } else if (fixed) {
      dOut = norm(sub(at(Math.min(n - 1, i + m)), at(i)));
      dIn = norm(sub(at(Math.max(0, i - m)), at(i)));
      smoothC.push(false);
    } else {
      smoothC.push(false);
      const prev = corners[(ci - 1 + nC) % nC];
      const next = corners[(ci + 1) % nC];
      const gapPrev = closed ? ((i - prev + n) % n) || n : i - prev;
      const gapNext = closed ? ((next - i + n) % n) || n : next - i;
      const reach = Math.max(skip + 2, Math.round(6 / ch.ds));
      const mPrev = Math.min(reach, Math.floor(gapPrev / 2));
      const mNext = Math.min(reach, Math.floor(gapNext / 2));
      dOut = norm(sub(at(i + Math.max(2, mNext)), at(i)));
      dIn = norm(sub(at(i - Math.max(2, mPrev)), at(i)));
      if (mPrev > skip + 1 && mNext > skip + 1) {
        const A = [], B = [];
        for (let j = skip; j <= mPrev; j++) A.push(at(i - j));
        for (let j = skip; j <= mNext; j++) B.push(at(i + j));
        const la = fitLine(A), lb = fitLine(B);
        const X = intersectLines(la.c, la.dir, lb.c, lb.dir);
        if (X && len(sub(X, pos)) < 3) {
          pos = X;
          dOut = dot(lb.dir, dOut) < 0 ? mul(lb.dir, -1) : lb.dir;
          dIn = dot(la.dir, dIn) < 0 ? mul(la.dir, -1) : la.dir;
        }
      }
      if (inRun && outRun) {
        const X = intersectLines(inRun.c, inRun.dir, outRun.c, outRun.dir);
        if (X && len(sub(X, at(i))) < 4) pos = X;
        else pos = projectOn(pos, outRun);
      } else if (inRun) pos = projectOn(pos, inRun);
      else if (outRun) pos = projectOn(pos, outRun);
    }
    if (outRun) dOut = outRun.dir;
    if (inRun) dIn = mul(inRun.dir, -1);
    cPos.push(pos);
    tOut.push(dOut);
    tIn.push(dIn);
  }

  const cmds = [['M', cPos[0][0], cPos[0][1]]];
  for (let si = 0; si < nS; si++) {
    const sp = spans[si];
    const ci = si, ni = (si + 1) % nC;
    let cur = cPos[ci];
    let curT = tOut[ci];
    let curSmooth = smoothC[ci];
    const fixedStart = !closed && si === 0, fixedEnd = !closed && si === nS - 1;
    let k = fixedStart ? sp.i + 1 : sp.i + skip;
    const endK = fixedEnd ? sp.j - 1 : sp.j - skip;
    for (const r of sp.runs) {
      const S = r === sp.startRun ? cPos[ci] : projectOn(at(r.a), r);
      const E = r === sp.endRun ? cPos[ni] : projectOn(at(r.b), r);
      if (r !== sp.startRun) {
        const pts = [];
        for (let q = k; q < r.a; q++) pts.push(at(q));
        curvePiece(cur, pts, S, curT, mul(r.dir, -1), curSmooth, true, o, cmds);
      }
      cmds.push(['L', E[0], E[1]]);
      cur = E;
      curT = r.dir;
      curSmooth = true;
      k = r.b + 1;
    }
    if (!sp.endRun) {
      const pts = [];
      for (let q = k; q <= endK; q++) pts.push(at(q));
      curvePiece(cur, pts, cPos[ni], curT, tIn[ni], curSmooth, smoothC[ni], o, cmds);
    }
  }
  const last = cmds[cmds.length - 1];
  const endP = closed ? cPos[0] : cPos[nC - 1];
  if (last[0] !== 'M') {
    last[last.length - 2] = endP[0];
    last[last.length - 1] = endP[1];
  } else cmds.push(['L', endP[0], endP[1]]);
  return cmds;
}

/** 열린 명령 목록을 반대 방향으로 */
export function reverseCmds(cmds) {
  const ends = cmds.map((c) => [c[c.length - 2], c[c.length - 1]]);
  const n = cmds.length;
  const out = [['M', ends[n - 1][0], ends[n - 1][1]]];
  for (let i = n - 1; i >= 1; i--) {
    const c = cmds[i];
    const to = ends[i - 1];
    if (c[0] === 'L' || c[0] === 'M') out.push(['L', to[0], to[1]]);
    else if (c[0] === 'Q') out.push(['Q', c[1], c[2], to[0], to[1]]);
    else if (c[0] === 'C') out.push(['C', c[3], c[4], c[1], c[2], to[0], to[1]]);
    else if (c[0] === 'A') out.push(['A', c[1], c[2], c[3], -c[4], to[0], to[1]]);
  }
  return out;
}

// ---------- 대칭 ----------

/**
 * 전체 그림의 세로축 좌우 대칭 보정. 축은 자동 탐색, 대칭이 아니면 아무것도 하지 않음.
 * loops: 닫힌 점열 목록 (이미지 좌표). 반환: { loops, axis|null }
 */
export function symmetrizeLoops(loops, tolPx = 1.5) {
  if (!loops.length) return { loops, axis: null };
  let x0 = Infinity, x1 = -Infinity;
  for (const lp of loops) for (const q of lp) {
    if (q[0] < x0) x0 = q[0];
    if (q[0] > x1) x1 = q[0];
  }
  const R = loops.map((lp) => resample(lp, true, 0.75).pts);
  const all = R.flat();
  // 격자 해시로 최근접점
  const cell = 2;
  const grid = new Map();
  const key = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
  all.forEach((q, i) => {
    const k = key(q[0], q[1]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  const nearest = (x, y, maxD) => {
    let bi = -1, bd = maxD * maxD;
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell), rr = Math.ceil(maxD / cell);
    for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) {
      const l = grid.get(gx + a + ',' + (gy + b));
      if (!l) continue;
      for (const i of l) {
        const d = (all[i][0] - x) ** 2 + (all[i][1] - y) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
    }
    return bi < 0 ? null : { i: bi, d: Math.sqrt(bd) };
  };
  const score = (ax) => {
    let s = 0, cnt = 0, miss = 0;
    for (let i = 0; i < all.length; i += 3) {
      const q = all[i];
      const nb = nearest(2 * ax - q[0], q[1], tolPx * 3);
      if (!nb) miss++;
      else s += nb.d;
      cnt++;
    }
    return { mean: cnt ? s / Math.max(1, cnt - miss) : Infinity, miss: miss / Math.max(1, cnt) };
  };
  const mid = (x0 + x1) / 2;
  let bestAx = mid, best = score(mid);
  const W = x1 - x0;
  for (let d = -0.02 * W; d <= 0.02 * W; d += Math.max(0.25, W / 800)) {
    const sc = score(mid + d);
    if (sc.miss < best.miss - 1e-9 || (Math.abs(sc.miss - best.miss) < 1e-9 && sc.mean < best.mean)) {
      best = sc;
      bestAx = mid + d;
    }
  }
  if (best.miss > 0.02 || best.mean > tolPx) return { loops, axis: null };
  const ax = bestAx;
  // 점별로 거울상 최근접점과 평균 (2회)
  let cur = R;
  for (let it = 0; it < 2; it++) {
    const flat = cur.flat();
    grid.clear();
    all.length = 0;
    flat.forEach((q) => all.push(q));
    all.forEach((q, i) => {
      const k = key(q[0], q[1]);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    });
    cur = cur.map((lp) =>
      lp.map((q) => {
        const nb = nearest(2 * ax - q[0], q[1], tolPx * 3);
        if (!nb) return q;
        const m = all[nb.i];
        return [(q[0] + (2 * ax - m[0])) / 2, (q[1] + m[1]) / 2];
      })
    );
  }
  return { loops: cur, axis: ax };
}
