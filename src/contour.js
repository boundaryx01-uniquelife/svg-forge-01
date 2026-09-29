// 정밀 벡터화 엔진
// 1) 스칼라장(밝기/마스크)에서 marching squares로 서브픽셀 윤곽 추출 (안티앨리어싱 정보 활용 → 계단 현상 없음)
// 2) 등간격 재샘플 + 스케일 비교로 진짜 모서리만 검출, 양쪽 직선의 교점으로 뾰족한 모서리 복원
// 3) 모서리 사이 구간을 Schneider 알고리즘으로 3차 베지어 피팅 (직선 구간은 L)

// ---------- 스칼라장 유틸 ----------

/** 분리형 가우시안 블러 (Float32Array, w×h) */
export function gaussBlur(src, w, h, sigma) {
  if (!(sigma > 0)) return src;
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) s += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i;
        a += src[row + xx] * k[i + r];
      }
      tmp[row + x] = a;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i;
        a += tmp[yy * w + x] * k[i + r];
      }
      out[y * w + x] = a;
    }
  }
  return out;
}

// ---------- marching squares ----------

/**
 * field: Float32Array (w×h), 값 > 0 이 안쪽. 픽셀 (x,y)의 값은 좌표 (x+0.5, y+0.5)에 위치.
 * 반환: 닫힌 다각형 목록 [[x,y],...] (이미지 좌표)
 */
export function marchingSquares(field, w, h, outside = -1) {
  // 바깥쪽 1칸 패딩
  const W = w + 2, H = h + 2;
  const v = new Float32Array(W * H).fill(outside);
  for (let y = 0; y < h; y++) v.set(field.subarray(y * w, y * w + w), (y + 1) * W + 1);

  const next = new Map();
  const pts = new Map();
  const hId = (x, y) => (y * W + x) * 2; // (x,y)-(x+1,y)
  const vId = (x, y) => (y * W + x) * 2 + 1; // (x,y)-(x,y+1)
  // 격자점 (x,y)의 이미지 좌표 = (x - 0.5, y - 0.5)
  const edgePoint = (id) => {
    let p = pts.get(id);
    if (p) return p;
    const cell = id >> 1;
    const x = cell % W, y = (cell - x) / W;
    let a, b;
    if ((id & 1) === 0) {
      a = v[y * W + x];
      b = v[y * W + x + 1];
      const t = a / (a - b);
      p = [x + t - 0.5, y - 0.5];
    } else {
      a = v[y * W + x];
      b = v[(y + 1) * W + x];
      const t = a / (a - b);
      p = [x - 0.5, y + t - 0.5];
    }
    pts.set(id, p);
    return p;
  };
  // 세그먼트 추가: 방향은 보간점이 아닌 "변의 중점"으로 판정 (교차점이 코너에 거의 붙어도 퇴화하지 않음)
  // 잘려 나가는 코너(cx,cy: 격자 좌표)가 inside면 cross<0, 아니면 cross>0
  const mid = (id) => {
    const cell = id >> 1;
    const x = cell % W, y = (cell - x) / W;
    return (id & 1) === 0 ? [x + 0.5, y] : [x, y + 0.5];
  };
  const addSeg = (e1, e2, cx, cy, cIn) => {
    const p = mid(e1), q = mid(e2);
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const cr = dx * (cy - p[1]) - dy * (cx - p[0]);
    if (cIn ? cr < 0 : cr > 0) next.set(e1, e2);
    else next.set(e2, e1);
    edgePoint(e1);
    edgePoint(e2);
  };

  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const a = v[y * W + x], b = v[y * W + x + 1], c = v[(y + 1) * W + x + 1], d = v[(y + 1) * W + x];
      const tl = a > 0, tr = b > 0, br = c > 0, bl = d > 0;
      const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const T = hId(x, y), B = hId(x, y + 1), L = vId(x, y), R = vId(x + 1, y);
      // 코너 좌표(격자 좌표)
      const X0 = x, Y0 = y, X1 = x + 1, Y1 = y + 1;
      if (code === 5 || code === 10) {
        const center = (a + b + c + d) / 4 > 0;
        if ((code === 5) === center) {
          // tl, br 을 잘라냄
          addSeg(T, L, X0, Y0, tl);
          addSeg(R, B, X1, Y1, br);
        } else {
          // tr, bl 을 잘라냄
          addSeg(T, R, X1, Y0, tr);
          addSeg(B, L, X0, Y1, bl);
        }
        continue;
      }
      const eT = tl !== tr, eR = tr !== br, eB = bl !== br, eL = tl !== bl;
      if (eT && eL) addSeg(T, L, X0, Y0, tl);
      else if (eT && eR) addSeg(T, R, X1, Y0, tr);
      else if (eR && eB) addSeg(R, B, X1, Y1, br);
      else if (eB && eL) addSeg(B, L, X0, Y1, bl);
      else if (eT && eB) addSeg(T, B, X0, Y0, tl);
      else if (eL && eR) addSeg(L, R, X0, Y0, tl);
    }
  }

  const loops = [];
  for (const start of next.keys()) {
    if (!next.has(start)) continue;
    const loop = [];
    let e = start;
    let guard = 0;
    while (next.has(e) && guard++ < 1e7) {
      loop.push(pts.get(e));
      const n = next.get(e);
      next.delete(e);
      e = n;
      if (e === start) break;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

// ---------- 벡터 유틸 ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => {
  const l = len(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l] : [0, 0];
};

export function polyArea(p) {
  let s = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[i], r = p[(i + 1) % n];
    s += q[0] * r[1] - r[0] * q[1];
  }
  return s / 2;
}

/** 닫힌 다각형을 호 길이 기준 등간격(step)으로 재샘플 */
function resampleClosed(poly, step) {
  const n = poly.length;
  let per = 0;
  for (let i = 0; i < n; i++) per += len(sub(poly[(i + 1) % n], poly[i]));
  const m = Math.max(8, Math.round(per / step));
  const ds = per / m;
  const out = [];
  let i = 0, acc = 0;
  let segLen = len(sub(poly[1 % n], poly[0]));
  for (let k = 0; k < m; k++) {
    const target = k * ds;
    while (acc + segLen < target && i < n) {
      acc += segLen;
      i++;
      segLen = len(sub(poly[(i + 1) % n], poly[i % n]));
    }
    const a = poly[i % n], b = poly[(i + 1) % n];
    const t = segLen > 1e-12 ? (target - acc) / segLen : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return { pts: out, ds };
}

/** 가벼운 스무딩(양 끝 고정 아님, 닫힌 곡선) — 픽셀 노이즈 제거용 */
function smoothClosed(p, iters) {
  let a = p;
  const n = p.length;
  for (let it = 0; it < iters; it++) {
    const b = new Array(n);
    for (let i = 0; i < n; i++) {
      const q = a[(i - 1 + n) % n], r = a[i], s = a[(i + 1) % n];
      b[i] = [(q[0] + 2 * r[0] + s[0]) / 4, (q[1] + 2 * r[1] + s[1]) / 4];
    }
    a = b;
  }
  return a;
}

const turnAngle = (p, i, k) => {
  const n = p.length;
  const a = p[(i - k + n) % n], b = p[i], c = p[(i + k) % n];
  const u = norm(sub(b, a)), v = norm(sub(c, b));
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
};

/** 스케일 비교 모서리 검출: 작은 창/큰 창에서의 꺾임각 비율로 곡선과 모서리를 구분 */
function detectCorners(p, ds, angleDeg) {
  const n = p.length;
  const k1 = Math.max(2, Math.round(2.0 / ds));
  const k2 = k1 * 2;
  if (n < k2 * 2 + 2) return [];
  const thr = (angleDeg * Math.PI) / 180;
  const a1 = new Float32Array(n);
  const cand = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    a1[i] = turnAngle(p, i, k1);
    if (a1[i] < thr) continue;
    const a2 = turnAngle(p, i, k2);
    // 진짜 모서리: 창을 넓혀도 꺾임각이 거의 그대로. 곡선: 창에 비례해 커짐
    if (a1[i] / Math.max(a2, 1e-6) > 0.72) cand[i] = 1;
  }
  const corners = [];
  for (let i = 0; i < n; i++) {
    if (!cand[i]) continue;
    let isMax = true;
    for (let j = -k1; j <= k1 && isMax; j++) {
      if (!j) continue;
      const q = (i + j + n) % n;
      if (cand[q] && (a1[q] > a1[i] || (a1[q] === a1[i] && q < i))) isMax = false;
    }
    if (isMax) corners.push(i);
  }
  return corners;
}

/** 점들에 대한 최소제곱 직선: 중심점과 방향 */
export function fitLine(points) {
  let mx = 0, my = 0;
  for (const q of points) {
    mx += q[0];
    my += q[1];
  }
  mx /= points.length;
  my /= points.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const q of points) {
    const dx = q[0] - mx, dy = q[1] - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dir = [Math.cos(th), Math.sin(th)];
  // 직선 적합도(잔차 RMS)
  let res = 0;
  for (const q of points) {
    const d = (q[0] - mx) * -dir[1] + (q[1] - my) * dir[0];
    res += d * d;
  }
  return { c: [mx, my], dir, rms: Math.sqrt(res / points.length) };
}

export function intersectLines(c1, d1, c2, d2) {
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-6) return null;
  const t = ((c2[0] - c1[0]) * d2[1] - (c2[1] - c1[1]) * d2[0]) / den;
  return [c1[0] + d1[0] * t, c1[1] + d1[1] * t];
}

// ---------- Schneider 베지어 피팅 ----------

function bez(b, t) {
  const u = 1 - t;
  const a = u * u * u, c = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
  return [a * b[0][0] + c * b[1][0] + d * b[2][0] + e * b[3][0], a * b[0][1] + c * b[1][1] + d * b[2][1] + e * b[3][1]];
}
function bezD1(b, t) {
  const u = 1 - t;
  return [
    3 * (u * u * (b[1][0] - b[0][0]) + 2 * u * t * (b[2][0] - b[1][0]) + t * t * (b[3][0] - b[2][0])),
    3 * (u * u * (b[1][1] - b[0][1]) + 2 * u * t * (b[2][1] - b[1][1]) + t * t * (b[3][1] - b[2][1])),
  ];
}
function bezD2(b, t) {
  const u = 1 - t;
  return [
    6 * (u * (b[2][0] - 2 * b[1][0] + b[0][0]) + t * (b[3][0] - 2 * b[2][0] + b[1][0])),
    6 * (u * (b[2][1] - 2 * b[1][1] + b[0][1]) + t * (b[3][1] - 2 * b[2][1] + b[1][1])),
  ];
}

function chordParam(P) {
  const u = [0];
  for (let i = 1; i < P.length; i++) u.push(u[i - 1] + len(sub(P[i], P[i - 1])));
  const L = u[u.length - 1] || 1;
  return u.map((x) => x / L);
}

function generateBezier(P, u, t1, t2) {
  const p0 = P[0], p3 = P[P.length - 1];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < P.length; i++) {
    const t = u[i], s = 1 - t;
    const b1 = 3 * t * s * s, b2 = 3 * t * t * s;
    const A1 = mul(t1, b1), A2 = mul(t2, b2);
    c00 += dot(A1, A1);
    c01 += dot(A1, A2);
    c11 += dot(A2, A2);
    const b0 = s * s * s, b3 = t * t * t;
    const tmp = sub(P[i], add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    x0 += dot(A1, tmp);
    x1 += dot(A2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let al = 0, ar = 0;
  if (Math.abs(det) > 1e-12) {
    al = (x0 * c11 - x1 * c01) / det;
    ar = (c00 * x1 - c01 * x0) / det;
  }
  const segLen = len(sub(p3, p0));
  const eps = 1e-6 * segLen;
  if (al < eps || ar < eps || al > segLen * 3 || ar > segLen * 3) {
    al = ar = segLen / 3;
  }
  return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3];
}

function reparam(b, P, u) {
  return u.map((t, i) => {
    const d = sub(bez(b, t), P[i]);
    const d1 = bezD1(b, t), d2 = bezD2(b, t);
    const num = dot(d, d1);
    const den = dot(d1, d1) + dot(d, d2);
    if (Math.abs(den) < 1e-12) return t;
    const nt = t - num / den;
    return nt < 0 ? 0 : nt > 1 ? 1 : nt;
  });
}

function maxError(b, P, u) {
  let mx = 0, idx = Math.floor(P.length / 2);
  for (let i = 1; i < P.length - 1; i++) {
    const d = sub(bez(b, u[i]), P[i]);
    const e = dot(d, d);
    if (e > mx) {
      mx = e;
      idx = i;
    }
  }
  return { mx, idx };
}

/** P(점열)를 오차 tol 이내의 3차 베지어 목록으로 피팅. t1: 시작 접선(진행방향), t2: 끝 접선(역방향) */
export function fitCubic(P, t1, t2, tol, out, depth = 0) {
  const err2 = tol * tol;
  if (P.length === 2) {
    const d = len(sub(P[1], P[0])) / 3;
    out.push([P[0], add(P[0], mul(t1, d)), add(P[1], mul(t2, d)), P[1]]);
    return;
  }
  let u = chordParam(P);
  let b = generateBezier(P, u, t1, t2);
  let { mx, idx } = maxError(b, P, u);
  if (mx < err2) {
    out.push(b);
    return;
  }
  if (mx < err2 * 16) {
    for (let it = 0; it < 6; it++) {
      u = reparam(b, P, u);
      b = generateBezier(P, u, t1, t2);
      ({ mx, idx } = maxError(b, P, u));
      if (mx < err2) {
        out.push(b);
        return;
      }
    }
  }
  if (depth > 40 || P.length < 4) {
    out.push(b);
    return;
  }
  idx = Math.max(1, Math.min(P.length - 2, idx));
  let tc = norm(sub(P[idx - 1], P[idx + 1]));
  if (!len(tc)) tc = norm(sub(P[idx - 1], P[idx]));
  fitCubic(P.slice(0, idx + 1), t1, tc, tol, out, depth + 1);
  fitCubic(P.slice(idx), mul(tc, -1), t2, tol, out, depth + 1);
}

/** 한 구간(열린 점열)을 ring 명령으로. 직선이면 L, 아니면 C 목록 */
export function spanToCmds(P, t1, t2, tol, cmds) {
  const a = P[0], b = P[P.length - 1];
  const ab = sub(b, a);
  const L = len(ab);
  if (L > 1e-9) {
    const nrm = [-ab[1] / L, ab[0] / L];
    let dev = 0;
    for (const q of P) dev = Math.max(dev, Math.abs(dot(sub(q, a), nrm)));
    if (dev <= tol * 0.6) {
      cmds.push(['L', b[0], b[1]]);
      return;
    }
  }
  const out = [];
  fitCubic(P, t1, t2, tol, out);
  for (const c of out) cmds.push(['C', c[1][0], c[1][1], c[2][0], c[2][1], c[3][0], c[3][1]]);
}

// ---------- 직선 인식 ----------

/** 점들을 직선에 맞추고, 최대 편차와 휨(2차 곡선 성분의 처짐)을 측정 */
export function lineStats(pts) {
  const L = fitLine(pts);
  const dir = L.dir, c = L.c;
  let maxDev = 0;
  // 지역 좌표 (s: 직선 방향, r: 수직 편차)
  let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, R0 = 0, R1 = 0, R2 = 0;
  let smin = Infinity, smax = -Infinity;
  for (const q of pts) {
    const dx = q[0] - c[0], dy = q[1] - c[1];
    const sv = dx * dir[0] + dy * dir[1];
    const r = -dx * dir[1] + dy * dir[0];
    if (Math.abs(r) > maxDev) maxDev = Math.abs(r);
    if (sv < smin) smin = sv;
    if (sv > smax) smax = sv;
    const s2 = sv * sv;
    S0 += 1; S1 += sv; S2 += s2; S3 += s2 * sv; S4 += s2 * s2;
    R0 += r; R1 += r * sv; R2 += r * s2;
  }
  // r = A s^2 + B s + C 최소제곱 → A (크라메르)
  const m = [
    [S4, S3, S2],
    [S3, S2, S1],
    [S2, S1, S0],
  ];
  const det3 = (M) =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det3(m);
  let A = 0;
  if (Math.abs(D) > 1e-12) {
    A = det3([
      [R2, S3, S2],
      [R1, S2, S1],
      [R0, S1, S0],
    ]) / D;
  }
  const length = smax - smin;
  const sag = Math.abs(A) * (length / 2) * (length / 2);
  return { c, dir, maxDev, sag, length };
}

/**
 * p[from..to] (인덱스는 순환) 안에서 거의 곧은 구간을 찾는다.
 * lineTol: 허용 편차(px), 원·완만한 곡선은 휨(sag)과 총 회전각으로 걸러낸다.
 */
function findRuns(at, from, to, ds, lineTol, snapDeg) {
  if (!(lineTol > 0) || to - from < 4) return [];
  const minLen = Math.max(10, 8 * lineTol);
  const minPts = Math.max(6, Math.round(minLen / ds));
  const sagTol = Math.max(0.15, 0.45 * lineTol);
  const maxTurn = (3 * Math.PI) / 180; // 구간 전체의 회전각이 3° 넘으면 곡선
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
    } else {
      a += 2;
    }
  }
  // 이어진 같은 직선 병합
  const merged = [];
  for (const r of runs) {
    const pr = merged[merged.length - 1];
    if (pr && r.a - pr.b <= 4) {
      const cosang = Math.abs(dot(pr.dir, r.dir));
      if (cosang > Math.cos((2 * Math.PI) / 180)) {
        const st = ok(pr.a, r.b);
        if (st) {
          pr.b = r.b;
          pr.c = st.c;
          pr.dir = st.dir;
          continue;
        }
      }
    }
    merged.push({ ...r });
  }
  // 진행 방향 정리 + 수평·수직 맞춤 + 끝 다듬기
  const snap = (snapDeg * Math.PI) / 180;
  const perp = (q, c, d) => Math.abs(-(q[0] - c[0]) * d[1] + (q[1] - c[1]) * d[0]);
  const endTol = Math.max(0.2, 0.3 * lineTol);
  const out = [];
  for (const r of merged) {
    const fwd = sub(at(r.b), at(r.a));
    if (dot(r.dir, fwd) < 0) r.dir = mul(r.dir, -1);
    if (snap > 0) {
      const ang = Math.atan2(r.dir[1], r.dir[0]);
      const q = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
      if (Math.abs(ang - q) <= snap) {
        // 맞춘 뒤에도 모든 점이 허용편차 안이면 채택 (기울어진 긴 선을 억지로 세우지 않음)
        const d = [Math.round(Math.cos(q)), Math.round(Math.sin(q))];
        let mx = 0;
        for (let k = r.a; k <= r.b; k++) mx = Math.max(mx, perp(at(k), r.c, d));
        if (mx <= lineTol) r.dir = d;
      }
    }
    // 끝점이 실제 윤곽에 붙도록 양 끝을 다듬음 (직선-곡선 이음부의 단차 방지)
    while (r.b - r.a > minPts && perp(at(r.b), r.c, r.dir) > endTol) r.b--;
    while (r.b - r.a > minPts && perp(at(r.a), r.c, r.dir) > endTol) r.a++;
    if (perp(at(r.a), r.c, r.dir) <= endTol * 2 && perp(at(r.b), r.c, r.dir) <= endTol * 2) out.push(r);
  }
  return out;
}

const projectOn = (pt, r) => {
  const t = dot(sub(pt, r.c), r.dir);
  return add(r.c, mul(r.dir, t));
};

/** 곡선 조각: cur → end, 중간 점들 pts. 거의 겹치면 생략 */
function curvePiece(cur, pts, end, t1, t2, tol, cmds) {
  if (len(sub(end, cur)) < 1e-6 && pts.length < 2) return;
  const P = [cur, ...pts, end];
  if (P.length === 2) {
    const d = len(sub(end, cur));
    // 짧은 연결: 접선을 살린 작은 곡선 (직선에 거의 평행하면 직선)
    if (d < 1e-6) return;
    const u = norm(sub(end, cur));
    if (dot(u, t1) > 0.9995 && dot(mul(u, -1), t2) > 0.9995) {
      cmds.push(['L', end[0], end[1]]);
      return;
    }
  }
  spanToCmds(P, t1, t2, tol, cmds);
}

/**
 * 윤곽 다각형 → 매끈한 링(모서리는 뾰족, 곧은 부분은 정확한 직선, 곡선은 베지어)
 * opts: { tol: 피팅 허용오차(px), cornerAngle: 모서리 최소 꺾임각(도), smooth, lineTol: 직선 인식 허용편차(px, 0=끄기), snapDeg: 수평·수직 맞춤 각도 }
 */
export function vectorizeLoop(poly, { tol = 0.5, cornerAngle = 40, smooth = 1, lineTol = 1, snapDeg = 3 } = {}) {
  const step = 0.5;
  let { pts: p, ds } = resampleClosed(poly, step);
  if (smooth > 0) p = smoothClosed(p, smooth);
  const n = p.length;
  const at = (i) => p[((i % n) + n) % n];
  let corners = detectCorners(p, ds, cornerAngle);
  let pseudo = false;
  if (!corners.length) {
    // 모서리 없는 닫힌 곡선: 가장 많이 휜 곳을 이음매로 (직선 구간이 이음매에 걸리지 않게)
    let s = 0, best = -1;
    const k = Math.max(2, Math.round(2 / ds));
    for (let i = 0; i < n; i += 2) {
      const a = turnAngle(p, i, k);
      if (a > best) {
        best = a;
        s = i;
      }
    }
    corners = [s];
    pseudo = true;
  }
  const nC = corners.length;
  const skip = pseudo ? 0 : Math.max(1, Math.round(1.25 / ds)); // 둥글어진 모서리 부분 제외
  const slack = skip + Math.max(2, Math.round(1.5 / ds));

  // 구간별 직선 찾기
  const spans = [];
  for (let ci = 0; ci < nC; ci++) {
    const i = corners[ci];
    let j = corners[(ci + 1) % nC];
    if (j <= i) j += n;
    const runs = findRuns(at, i + skip, j - skip, ds, lineTol, snapDeg);
    const first = runs[0], last = runs[runs.length - 1];
    spans.push({
      i,
      j,
      runs,
      startRun: !pseudo && first && first.a - i <= slack ? first : null,
      endRun: !pseudo && last && j - last.b <= slack ? last : null,
    });
  }

  // 모서리 위치/접선
  const cPos = [], tOut = [], tIn = [];
  for (let ci = 0; ci < nC; ci++) {
    const i = corners[ci];
    let pos = at(i);
    let dOut, dIn;
    if (pseudo) {
      dOut = norm(sub(at(i + 1), at(i - 1)));
      dIn = mul(dOut, -1);
    } else {
      const prev = corners[(ci - 1 + nC) % nC];
      const next = corners[(ci + 1) % nC];
      const gapPrev = ((i - prev + n) % n) || n;
      const gapNext = ((next - i + n) % n) || n;
      const reach = Math.max(skip + 2, Math.round(6 / ds));
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
          let o = lb.dir;
          if (dot(o, dOut) < 0) o = mul(o, -1);
          let q = la.dir;
          if (dot(q, dIn) < 0) q = mul(q, -1);
          dOut = o;
          dIn = q;
        }
      }
      // 인접 직선이 있으면 그 직선 위(또는 두 직선의 교점)로 정확히 맞춤
      const inRun = spans[(ci - 1 + nC) % nC].endRun;
      const outRun = spans[ci].startRun;
      if (inRun && outRun) {
        const X = intersectLines(inRun.c, inRun.dir, outRun.c, outRun.dir);
        if (X && len(sub(X, at(i))) < 4) pos = X;
        else pos = projectOn(pos, outRun);
      } else if (inRun) pos = projectOn(pos, inRun);
      else if (outRun) pos = projectOn(pos, outRun);
      if (outRun) dOut = outRun.dir;
      if (inRun) dIn = mul(inRun.dir, -1);
    }
    cPos.push(pos);
    tOut.push(dOut);
    tIn.push(dIn);
  }

  const cmds = [['M', cPos[0][0], cPos[0][1]]];
  for (let ci = 0; ci < nC; ci++) {
    const sp = spans[ci];
    const ni = (ci + 1) % nC;
    let cur = cPos[ci];
    let curT = tOut[ci];
    let k = sp.i + skip;
    const endK = sp.j - skip;
    for (const r of sp.runs) {
      const S = r === sp.startRun ? cPos[ci] : projectOn(at(r.a), r);
      const E = r === sp.endRun ? cPos[ni] : projectOn(at(r.b), r);
      if (r !== sp.startRun) {
        const pts = [];
        for (let q = k; q < r.a; q++) pts.push(at(q));
        curvePiece(cur, pts, S, curT, mul(r.dir, -1), tol, cmds);
      }
      cmds.push(['L', E[0], E[1]]);
      cur = E;
      curT = r.dir;
      k = r.b + 1;
    }
    if (!sp.endRun) {
      const pts = [];
      for (let q = k; q <= endK; q++) pts.push(at(q));
      curvePiece(cur, pts, cPos[ni], curT, tIn[ni], tol, cmds);
    }
  }
  // 마지막 끝점과 시작점 일치 보정
  const last = cmds[cmds.length - 1];
  if (last[0] !== 'M') {
    last[last.length - 2] = cPos[0][0];
    last[last.length - 1] = cPos[0][1];
  }
  return cmds;
}

/** 스칼라장 → 링 목록 */
export function fieldToRings(field, w, h, { minArea = 8, tol = 0.5, cornerAngle = 40, smooth = 1, lineTol = 1, snapDeg = 3 } = {}) {
  const loops = marchingSquares(field, w, h);
  const rings = [];
  for (const lp of loops) {
    if (Math.abs(polyArea(lp)) < minArea) continue;
    const r = vectorizeLoop(lp, { tol, cornerAngle, smooth, lineTol, snapDeg });
    if (r.length > 2) rings.push(r);
  }
  return rings;
}
