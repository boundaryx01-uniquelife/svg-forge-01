// 2D 모델 → 3D 압출(extrude) 지오메트리, STL 내보내기
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** 색상 레이어별 압출 지오메트리. 높이 = thickness + 레이어순번 * step */
export function buildLayerGeometries(model, { thickness = 3, step = 0 } = {}) {
  const H = model.height;
  const out = [];
  model.layers.forEach((layer, li) => {
    const h = Math.max(0.01, thickness + li * step);
    const geos = [];
    layer.items.forEach((it, idx) => {
      if (it.hole) return;
      const shape = new THREE.Shape(it.poly.map(([x, y]) => new THREE.Vector2(x, H - y)));
      for (let j = 0; j < layer.items.length; j++) {
        const hi = layer.items[j];
        if (hi.hole && hi.parent === idx) {
          shape.holes.push(new THREE.Path(hi.poly.map(([x, y]) => new THREE.Vector2(x, H - y))));
        }
      }
      geos.push(new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 1, steps: 1 }));
    });
    if (geos.length) {
      const g = geos.length === 1 ? geos[0] : mergeGeometries(geos);
      geos.forEach((x) => x !== g && x.dispose());
      out.push({ color: layer.color, geometry: g, height: h });
    }
  });
  return out;
}

/** 바이너리 STL Blob (단위 mm) */
export function buildStlBlob(model, opts) {
  const layers = buildLayerGeometries(model, opts);
  if (!layers.length) return null;
  const merged = layers.length === 1 ? layers[0].geometry : mergeGeometries(layers.map((l) => l.geometry));
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  const dv = new STLExporter().parse(mesh, { binary: true });
  layers.forEach((l) => l.geometry.dispose());
  merged.dispose();
  return new Blob([dv], { type: 'model/stl' });
}
