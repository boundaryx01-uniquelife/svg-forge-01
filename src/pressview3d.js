// 성형 미리보기 (3D): 실제 본체 메시를 돔으로 변형해 누르는 과정을 보여 준다.
// 2D 단면과 달리 무늬가 벌어지는 모습과 늘어나는 자리가 그대로 보인다.
import * as THREE from 'three';
import { domeZ } from './mold.js';

const C = { male: 0x8fa6b8, female: 0xb8a68f };

export const STAGES = [
  { to: 0.16, name: '① 본체를 수틀에 올립니다', tip: '평평하게 출력한 본체를 뜨거운 물이나 열풍기로 데웁니다' },
  { to: 0.42, name: '② 암틀을 덮습니다', tip: '암틀은 좌우로 뒤집어 덮습니다 — 잘린 귀퉁이끼리 맞추면 방향이 맞습니다' },
  { to: 0.60, name: '③ 눌러서 성형합니다', tip: '무늬가 벌어지며 곡면을 따라갑니다. 붉은 자리가 많이 늘어나는 곳입니다' },
  { to: 0.76, name: '④ 식힌 뒤 틀을 뺍니다', tip: '식기 전에 빼면 모양이 돌아갑니다' },
  { to: 1.00, name: '⑤ 두 장을 붙입니다', tip: '같은 것을 두 장 만들어 평평한 테두리끼리 붙이면 입체가 됩니다' },
];

export function stageAt(t) {
  for (let i = 0; i < STAGES.length; i++) if (t <= STAGES[i].to) return i;
  return STAGES.length - 1;
}
const ease = (u) => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
const seg = (t, a, b) => ease((t - a) / (b - a));

/* ───────── 안쪽 거리장 ─────────
 * 꼭짓점마다 '테두리 안쪽으로 얼마나 들어와 있는지'를 알아야 돔 높이를 구한다.
 * 다각형 거리 계산을 꼭짓점마다 하면 느리므로, 한 번 래스터로 거리장을 만들고 쌍선형으로 읽는다.
 */
function distanceField(paths, box, px = 1 / 3) {
  const [x0, y0, x1, y1] = box;
  const pad = 2;
  const w = Math.max(8, Math.min(512, Math.ceil((x1 - x0) / px) + pad * 2));
  const h = Math.max(8, Math.min(512, Math.ceil((y1 - y0) / px) + pad * 2));
  const sx = (x1 - x0) / (w - pad * 2), sy = (y1 - y0) / (h - pad * 2);
  // 안/밖 판정 (짝홀) — paths 는 [[x,y], ...] 목록
  const inside = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const y = y0 + (j - pad) * sy;
    for (let i = 0; i < w; i++) {
      const x = x0 + (i - pad) * sx;
      let c = false;
      for (const poly of paths) {
        for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
          const [xi, yi] = poly[a], [xj, yj] = poly[b];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
      }
      if (c) inside[j * w + i] = 1;
    }
  }
  // 제곱 거리 변환 (Felzenszwalb, 축마다 1차원)
  const INF = 1e12;
  const f = new Float64Array(w * h);
  for (let k = 0; k < w * h; k++) f[k] = inside[k] ? INF : 0;
  const d1 = (src, n) => {
    const out = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (src[q] + q * q - (src[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (src[q] + q * q - (src[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      out[q] = (q - v[k]) * (q - v[k]) + src[v[k]];
    }
    return out;
  };
  const col = new Float64Array(h), row = new Float64Array(w);
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < h; j++) col[j] = f[j * w + i];
    const o = d1(col, h);
    for (let j = 0; j < h; j++) f[j * w + i] = o[j];
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) row[i] = f[j * w + i];
    const o = d1(row, w);
    for (let i = 0; i < w; i++) f[j * w + i] = Math.sqrt(o[i]);
  }
  const scale = (sx + sy) / 2;                       // 픽셀 → mm
  return {
    at(x, y) {
      const u = (x - x0) / sx + pad, v = (y - y0) / sy + pad;
      const i = Math.floor(u), j = Math.floor(v);
      if (i < 0 || j < 0 || i >= w - 1 || j >= h - 1) return 0;
      const fu = u - i, fv = v - j;
      const a = f[j * w + i], b = f[j * w + i + 1], c = f[(j + 1) * w + i], d = f[(j + 1) * w + i + 1];
      return (a * (1 - fu) * (1 - fv) + b * fu * (1 - fv) + c * (1 - fu) * fv + d * fu * fv) * scale;
    },
  };
}

/** Clipper paths(µm) → [[x,y],…] 목록 (mm) */
export function toPolys(paths, SC = 1000) {
  return paths.map((p) => p.map((q) => [q.X / SC, q.Y / SC]));
}

/* ───────── 성형 미리보기 뷰 ───────── */

export function makePressView(container) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return { failed: true, setScene() {}, setTime() {}, resize() {}, dispose() {} };
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  container.insertBefore(renderer.domElement, container.firstChild);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.15));
  const dl = new THREE.DirectionalLight(0xffffff, 1.5);
  dl.position.set(-1, -1.4, 2);
  scene.add(dl);
  const root = new THREE.Group();
  scene.add(root);

  let body = [];          // { mesh, base: Float32Array, stretch: Float32Array }
  let male = null, female = null, shadow = null;
  let P = null;           // { r0, domeH, gap, thick, floor, rim, field, cx, cy, box }
  let showStretch = true;
  let yaw = -0.5, pitch = 0.42, dist = 1, target = new THREE.Vector3();

  const clearGroup = () => {
    for (const ch of [...root.children]) {
      root.remove(ch);
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) ch.material.dispose();
    }
    body = []; male = female = shadow = null;
  };

  /** parts: { body:[{color,geometry}], male, female }, dome: pressDome 결과, opts */
  function setScene(parts, dome, opts) {
    clearGroup();
    if (!parts || !dome) { P = null; return; }
    const polys = toPolys(dome.fp);
    const [bx0, by0, bx1, by1] = dome.fpBox;
    P = {
      r0: dome.r0, domeH: dome.domeH, gap: opts.gap, thick: opts.thick, floor: opts.floor,
      rim: dome.useRim, stretch: dome.stretch,
      field: distanceField(polys, [bx0, by0, bx1, by1]),
      cx: (dome.silBox[0] + dome.silBox[2]) / 2, cy: (dome.silBox[1] + dome.silBox[3]) / 2,
      box: dome.silBox,
    };
    for (const p of parts.body) {
      const g = p.geometry.clone();
      const pos = g.getAttribute('position');
      const base = new Float32Array(pos.array);                 // 평평한 원래 자리
      const n = pos.count;
      const st = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const d = P.field.at(base[3 * i], base[3 * i + 1]);
        // 가장자리일수록 많이 늘어난다 (돔 꼭대기는 거의 그대로)
        st[i] = Math.max(0, 1 - Math.min(1, d / Math.max(0.001, P.r0)));
      }
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.62, metalness: 0.03,
        vertexColors: true, side: THREE.DoubleSide,
      }));
      m.userData.baseColor = new THREE.Color(p.color);
      root.add(m);
      body.push({ mesh: m, base, stretch: st });
    }
    const mk = (geom, col, flip) => {
      if (!geom) return null;
      const g = geom.clone();
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.75, metalness: 0.02, transparent: true, opacity: 1, side: THREE.DoubleSide });
      const wrap = new THREE.Group();
      if (flip) {
        // 암틀은 '좌우로 뒤집어 덮는' 물건 — Y축 180° 로 돌리면 좌우 반전과 위아래 뒤집기가 한 번에 된다
        g.translate(-P.cx, -P.cy, 0);
        wrap.rotation.y = Math.PI;
        wrap.position.set(P.cx, P.cy, 0);
      }
      const m = new THREE.Mesh(g, mat);
      wrap.add(m);
      root.add(wrap);
      wrap.userData.mesh = m;
      return wrap;
    };
    male = mk(parts.male, C.male, false);
    female = mk(parts.female, C.female, true);
    // ⑤ 에서 맞붙일 두 번째 장
    shadow = body.length ? (() => {
      const g = new THREE.Group();
      for (const b of body) {
        const m = new THREE.Mesh(b.mesh.geometry, b.mesh.material);
        g.add(m);
      }
      g.visible = false;
      root.add(g);
      return g;
    })() : null;
    frame();
  }

  function frame() {
    if (!P) return;
    const bb = new THREE.Box3();
    for (const b of body) bb.expandByObject(b.mesh);
    for (const g of [male, female]) if (g) bb.expandByObject(g);
    if (bb.isEmpty()) {
      const [x0, y0, x1, y1] = P.box;
      target.set((x0 + x1) / 2, (y0 + y1) / 2, P.floor + P.domeH / 2);
      dist = Math.max(x1 - x0, y1 - y0) * 2.4;
      return;
    }
    const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    target.set(c.x, c.y, P.floor + P.domeH * 0.6);
    dist = Math.max(sz.x, sz.y, sz.z * 1.6) * 2.1;
  }

  /** 본체 꼭짓점을 돔 위로 올린다. amt 0=평평, 1=완전히 성형 */
  function warp(amt, lift) {
    if (!P) return;
    const { field, r0, domeH, cx, cy } = P;
    for (const b of body) {
      const pos = b.mesh.geometry.getAttribute('position');
      const arr = pos.array, base = b.base;
      const col = b.mesh.geometry.getAttribute('color');
      const cBase = b.mesh.userData.baseColor;
      for (let i = 0; i < pos.count; i++) {
        const x = base[3 * i], y = base[3 * i + 1], z = base[3 * i + 2];
        const d = field.at(x, y);
        const h = domeZ(d, r0, domeH) * amt;
        // 돔을 따라가며 바깥으로 조금 밀린다 (늘어난 만큼)
        const k = 1 + P.stretch * amt * b.stretch[i] * 0.5;
        arr[3 * i] = cx + (x - cx) * k;
        arr[3 * i + 1] = cy + (y - cy) * k;
        arr[3 * i + 2] = z + h + lift;
        const s = showStretch ? Math.min(0.8, (P.stretch * b.stretch[i]) / 0.3) * amt : 0;
        col.array[3 * i] = cBase.r + (1 - cBase.r) * s;
        col.array[3 * i + 1] = cBase.g * (1 - s * 0.75);
        col.array[3 * i + 2] = cBase.b * (1 - s * 0.75);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      b.mesh.geometry.computeVertexNormals();
    }
  }

  function setTime(t) {
    if (!P) return;
    const st = stageAt(t);
    const close = seg(t, STAGES[0].to, STAGES[1].to);      // 암틀 내려옴
    const press = seg(t, STAGES[1].to - 0.04, STAGES[2].to); // 눌림
    const open = seg(t, STAGES[2].to, STAGES[3].to);        // 틀 빠짐
    const join = st === 4 ? seg(t, STAGES[3].to, 0.95) : 0;

    const up = P.floor + P.domeH + P.gap + 10;
    if (male) {
      male.visible = st < 4;
      male.position.set(0, 0, open * -up * 0.9);
    }
    if (female) {
      female.visible = st < 4;
      // 뒤집힌 암틀의 캐비티 천장이 (수틀 꼭대기 + 간격) 에 닿는 높이
      const zClosed = 2 * P.floor + P.domeH + P.gap;
      female.position.set(P.cx, P.cy, zClosed + (1 - close + open) * up);
      // 덮고 있는 동안에는 반투명 — 안에서 무슨 일이 일어나는지 보이게
      // 덮고 있는 동안에는 유리처럼 비치게 — 안에서 무슨 일이 벌어지는지 보여야 한다.
      // 양면으로 그리면 두 겹을 통과해 잘 안 비치므로 앞면만 그린다
      const closed = st === 1 || st === 2;
      const fm = female.userData.mesh.material;
      const op = closed ? 0.18 : 1;
      if (fm.opacity !== op) {
        fm.opacity = op;
        fm.depthWrite = !closed;
        fm.side = closed ? THREE.FrontSide : THREE.DoubleSide;
        fm.needsUpdate = true;
      }
    }
    // ①~④: 본체가 수틀 위에 얹혔다가 눌려 돔을 따라간다
    const lift = st < 4 ? P.floor + (1 - press) * P.domeH : 0;
    warp(st < 4 ? press : 1, st < 4 ? lift : 0);

    for (const b of body) b.mesh.visible = true;
    if (shadow) {
      shadow.visible = st === 4;
      if (st === 4) {
        // 같은 장을 뒤집어 테두리끼리 맞댐
        shadow.scale.set(1, 1, -1);
        shadow.position.set(0, 0, -(1 - join) * (P.domeH * 2 + 14));
      }
    }
    return { stage: st, info: STAGES[st] };
  }

  function setStretchOn(on) {
    showStretch = !!on;
  }

  function render() {
    if (!P) return;
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
    }
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    camera.position.set(
      target.x + dist * cp * Math.sin(yaw),
      target.y - dist * cp * Math.cos(yaw),
      target.z + dist * sp,
    );
    camera.up.set(0, 0, 1);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  // 끌어서 돌리기 · 휠로 확대
  let drag = null;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!drag) return;
    yaw += (e.clientX - drag.x) * 0.01;
    pitch = Math.max(-1.45, Math.min(1.45, pitch - (e.clientY - drag.y) * 0.008));
    drag = { x: e.clientX, y: e.clientY };
    render();
  });
  const stop = () => (drag = null);
  renderer.domElement.addEventListener('pointerup', stop);
  renderer.domElement.addEventListener('pointercancel', stop);
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    dist = Math.max(5, Math.min(5000, dist * (e.deltaY > 0 ? 1.12 : 1 / 1.12)));
    render();
  }, { passive: false });

  return {
    setScene, setTime, setStretchOn, render,
    home() { (yaw = -0.5), (pitch = 0.42), frame(), render(); },
    dispose() { clearGroup(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
