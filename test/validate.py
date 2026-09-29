import re, io, sys, math
import numpy as np
from PIL import Image
import cairosvg, ezdxf, trimesh
import xml.etree.ElementTree as ET

OUT = '/home/claude/svg-forge/test/out/'
IN = '/home/claude/svg-forge/test/in/'
ok = True
def check(cond, msg):
    global ok
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: ok = False

# ---------- SVG 구조 검사 ----------
def svg_struct(path, expect_fill=True):
    tree = ET.parse(path); root = tree.getroot()
    tags = {e.tag.split('}')[1] for e in root.iter()}
    check(tags <= {'svg', 'path'}, f'{path.split("/")[-1]}: 요소는 svg/path만 ({tags})')
    for e in root.iter():
        if e.tag.endswith('path'):
            d = e.get('d')
            check(d.count('M') == d.count('Z'), f'  path {e.get("id")}: M/Z 개수 일치 (M={d.count("M")}, Z={d.count("Z")})')
            check(e.get('stroke') == 'none' and e.get('fill') not in (None, 'none'), f'  path {e.get("id")}: 채움만, 선 없음')
            check(not re.search(r'[^MLQCZ0-9.\-\s]', d), f'  path {e.get("id")}: 허용 명령만 사용')
    w, h = root.get('width'), root.get('height'); vb = root.get('viewBox')
    print('  size:', w, h, 'viewBox:', vb)
    return root

root = svg_struct(OUT + 'logo_makerlab.svg')

# ---------- 래스터 비교 (IoU) ----------
src = np.array(Image.open(IN + 'logo.png').convert('L')) < 128
ys, xs = np.where(src)
crop = src[ys.min():ys.max()+1, xs.min():xs.max()+1]
H, W = crop.shape
png = cairosvg.svg2png(url=OUT + 'logo_makerlab.svg', output_width=W, output_height=H, background_color='white')
r = np.array(Image.open(io.BytesIO(png)).convert('L')) < 128
inter = (r & crop).sum(); union = (r | crop).sum()
iou = inter / union
check(iou > 0.97, f'logo SVG vs 원본 IoU = {iou:.4f}')

# ---------- DXF ----------
SVGH=float(ET.parse(OUT+'logo_makerlab.svg').getroot().get('height')[:-2])
for name, ew, eh in [('logo.dxf', 60.0, SVGH)]:
    doc = ezdxf.readfile(OUT + name)
    aud = doc.audit()
    check(len(aud.errors) == 0, f'{name}: ezdxf audit 오류 {len(aud.errors)}개')
    msp = doc.modelspace()
    pls = list(msp.query('POLYLINE'))
    check(len(pls) == 18, f'{name}: 폴리라인 {len(pls)}개 (기대 18)')
    check(all(p.is_closed for p in pls), f'{name}: 모두 닫힘')
    pts = np.array([[v.dxf.location.x, v.dxf.location.y] for p in pls for v in p.vertices])
    print('  dxf bbox', pts.min(0).round(3), pts.max(0).round(3), 'layers', [l.dxf.name for l in doc.layers])
    check(abs(pts.max(0)[0] - ew) < 0.05 and abs(pts.max(0)[1] - eh) < 0.05 and pts.min(0).min() > -0.01, f'{name}: 크기 {ew}x{eh}mm, 원점 0,0 (Y위쪽)')

# ---------- STL ----------
m = trimesh.load(OUT + 'logo.stl')
check(m.is_watertight, 'logo.stl: watertight')
check(m.is_winding_consistent, 'logo.stl: 법선 방향 일관')
b = m.bounds
print('  logo stl bounds', b.round(3).tolist(), 'volume', round(m.volume, 2))
check(abs(b[1][0] - 60) < 0.05 and abs(b[1][1] - SVGH) < 0.05 and abs(b[1][2] - 3) < 1e-6 and abs(b[0][2]) < 1e-6, f'logo.stl: 60 x {SVGH} x 3 mm')
area_px = crop.sum(); scale = 60.0 / W
exp_vol = area_px * scale * scale * 3
check(abs(m.volume - exp_vol) / exp_vol < 0.05, f'logo.stl: 부피 {m.volume:.1f} ≈ 기대 {exp_vol:.1f} (오차 {abs(m.volume-exp_vol)/exp_vol*100:.1f}%)')
# 거울상/상하반전 여부: 질량중심 비율을 원본과 비교
cx_src = np.where(crop)[1].mean() / W
cy_src = 1 - np.where(crop)[0].mean() / H   # STL은 Y위쪽
cm = m.center_mass
check(abs(cm[0]/60 - cx_src) < 0.02 and abs(cm[1]/SVGH - cy_src) < 0.02, f'logo.stl: 방향 일치 (STL {cm[0]/60:.3f},{cm[1]/SVGH:.3f} vs 원본 {cx_src:.3f},{cy_src:.3f})')

# 3색 STL (step=1 → 높이 3,4,5)
m2 = trimesh.load(OUT + 'multi.stl')
print('multi stl bounds', m2.bounds.round(3).tolist(), 'watertight', m2.is_watertight)
check(abs(m2.bounds[1][2] - 5) < 1e-6, 'multi.stl: 색상별 높이차 적용 (최대 높이 5mm)')
check(m2.is_watertight, 'multi.stl: watertight')

# 투명 PNG (링 모양) STL 아닌 SVG만
root = svg_struct(OUT + 'transparent_makerlab.svg')
root = svg_struct(OUT + 'lines_makerlab.svg')
root = svg_struct(OUT + 'multi_makerlab.svg')
root = svg_struct(OUT + 'text_makerlab.svg')

# 텍스트 STL / DXF
mt = trimesh.load(OUT + 'text.stl')
print('text stl bounds', mt.bounds.round(3).tolist(), 'watertight', mt.is_watertight, 'bodies', len(mt.split(only_watertight=False)))
check(mt.is_watertight, 'text.stl: watertight')
doc = ezdxf.readfile(OUT + 'text.dxf'); aud = doc.audit()
check(len(aud.errors) == 0, f'text.dxf: audit 오류 {len(aud.errors)}개')
# 텍스트 SVG 렌더 저장
cairosvg.svg2png(url=OUT + 'text_makerlab.svg', write_to=OUT + 'text_render.png', output_width=900, background_color='white')
cairosvg.svg2png(url=OUT + 'multi_makerlab.svg', write_to=OUT + 'multi_render.png', output_width=900, background_color='white')
print('ALL OK' if ok else 'SOME FAILED')
