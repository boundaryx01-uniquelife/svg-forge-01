// 입체 파트 → 3D 지오메트리, STL / 3MF 내보내기
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildParts, beveledSolid } from './solid.js';

/** 파트(도형+높이) → 지오메트리 */
export function partGeometry(part) {
  if (part.bevel && part.paths) {
    const pos = beveledSolid(part.paths, part.z0, part.z1, part.bevel);
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    return g;
  }
  const h = Math.max(0.01, part.z1 - part.z0);
  const geos = [];
  for (const s of part.shapes) {
    if (s.outer.length < 3) continue;
    const shape = new THREE.Shape(s.outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hl of s.holes) if (hl.length >= 3) shape.holes.push(new THREE.Path(hl.map(([x, y]) => new THREE.Vector2(x, y))));
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 1, steps: 1 });
    if (part.z0) g.translate(0, 0, part.z0);
    geos.push(g);
  }
  if (!geos.length) return null;
  const g = geos.length === 1 ? geos[0] : mergeGeometries(geos);
  geos.forEach((x) => x !== g && x.dispose());
  return g;
}

/** 모델 + 3D 옵션 → [{name, color, geometry, z1, role}] */
export function buildPartGeometries(model, opts) {
  const { parts, info } = buildParts(model, opts);
  const out = [];
  for (const p of parts) {
    const g = partGeometry(p);
    if (g) out.push({ name: p.name, color: p.color, geometry: g, z1: p.z1, role: p.role });
  }
  out.info = info;
  return out;
}

/** 바이너리 STL Blob (단위 mm, 모든 파트를 한 파일로) */
export function buildStlBlob(model, opts) {
  const parts = buildPartGeometries(model, opts);
  if (!parts.length) return null;
  const merged = parts.length === 1 ? parts[0].geometry : mergeGeometries(parts.map((l) => l.geometry));
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  const dv = new STLExporter().parse(mesh, { binary: true });
  parts.forEach((l) => l.geometry.dispose());
  merged.dispose();
  return new Blob([dv], { type: 'model/stl' });
}

// ---------- 3MF ----------

const xmlEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const num = (v) => {
  const s = v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
};

/** 지오메트리 → 정점 공유 메시 {verts: Float32Array, tris: Uint32Array} */
function indexedMesh(geometry) {
  const g = geometry.clone();
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-4);
  const pos = m.getAttribute('position').array;
  let idx = m.getIndex();
  idx = idx ? idx.array : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
  // 면적 0 삼각형 제거
  const tris = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    if (a === b || b === c || a === c) continue;
    tris.push(a, b, c);
  }
  g.dispose();
  m.dispose();
  return { verts: pos, tris: Uint32Array.from(tris) };
}

/** 3MF 문서 파일들 {경로: 문자열}. 파트마다 개별 객체 + 이를 묶은 조립 객체 1개 */
export function build3mfFiles(model, opts, title = 'SVG Forge') {
  const parts = buildPartGeometries(model, opts);
  if (!parts.length) return null;
  const colors = parts.map((p) => p.color.toUpperCase());
  // 같은 색 = 같은 필라멘트(압출기) 번호
  const extruderOf = new Map();
  for (const c of colors) if (!extruderOf.has(c)) extruderOf.set(c, extruderOf.size + 1);

  const objs = [];
  let body = '';
  parts.forEach((p, i) => {
    const id = i + 2;
    const { verts, tris } = indexedMesh(p.geometry);
    const vs = [];
    for (let k = 0; k < verts.length; k += 3) vs.push(`<vertex x="${num(verts[k])}" y="${num(verts[k + 1])}" z="${num(verts[k + 2])}"/>`);
    const ts = [];
    for (let k = 0; k < tris.length; k += 3) ts.push(`<triangle v1="${tris[k]}" v2="${tris[k + 1]}" v3="${tris[k + 2]}"/>`);
    body += `  <object id="${id}" type="model" name="${xmlEsc(p.name)}" pid="1" pindex="${i}">\n   <mesh>\n    <vertices>${vs.join('')}</vertices>\n    <triangles>${ts.join('')}</triangles>\n   </mesh>\n  </object>\n`;
    objs.push({ id, name: p.name, extruder: extruderOf.get(colors[i]) });
    p.geometry.dispose();
  });
  const asmId = parts.length + 2;
  const mats = colors.map((c, i) => `<base name="${xmlEsc(parts[i].name)}" displaycolor="${c}FF"/>`).join('');
  const comps = objs.map((o) => `<component objectid="${o.id}"/>`).join('');
  const modelXml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n' +
    ` <metadata name="Title">${xmlEsc(title)}</metadata>\n <metadata name="Application">SVG Forge</metadata>\n` +
    ' <resources>\n' +
    `  <basematerials id="1">${mats}</basematerials>\n` +
    body +
    `  <object id="${asmId}" type="model" name="${xmlEsc(title)}"><components>${comps}</components></object>\n` +
    ' </resources>\n' +
    ` <build><item objectid="${asmId}"/></build>\n` +
    '</model>\n';
  // Bambu Studio / OrcaSlicer: 파트별 필라멘트 번호
  const cfg =
    '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n' +
    `  <object id="${asmId}">\n    <metadata key="name" value="${xmlEsc(title)}"/>\n    <metadata key="extruder" value="1"/>\n` +
    objs.map((o) => `    <part id="${o.id}" subtype="normal_part">\n      <metadata key="name" value="${xmlEsc(o.name)}"/>\n      <metadata key="extruder" value="${o.extruder}"/>\n    </part>\n`).join('') +
    '  </object>\n</config>\n';
  const ct =
    '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n' +
    ' <Default Extension="config" ContentType="text/xml"/>\n</Types>\n';
  const rels =
    '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    ' <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n';
  return {
    files: { '[Content_Types].xml': ct, '_rels/.rels': rels, '3D/3dmodel.model': modelXml, 'Metadata/model_settings.config': cfg },
    filaments: [...extruderOf.entries()].map(([color, n]) => ({ n, color })),
  };
}

// ---------- ZIP (deflate, 브라우저 내장 압축) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
async function deflateRaw(data) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const res = new Response(new Blob([data]).stream().pipeThrough(cs));
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    return null;
  }
}

export async function zipFiles(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = typeof content === 'string' ? enc.encode(content) : content;
    const nameB = enc.encode(name);
    const crc = crc32(data);
    const comp = await deflateRaw(data);
    const method = comp ? 8 : 0;
    const payload = comp || data;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8 이름
    lh.setUint16(8, method, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, payload.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, nameB.length, true);
    chunks.push(new Uint8Array(lh.buffer), nameB, payload);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, method, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, payload.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, nameB.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nameB);
    offset += 30 + nameB.length + payload.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'model/3mf' });
}

export async function build3mfBlob(model, opts, title) {
  const r = build3mfFiles(model, opts, title);
  if (!r) return null;
  const blob = await zipFiles(r.files);
  blob.filaments = r.filaments;
  return blob;
}
