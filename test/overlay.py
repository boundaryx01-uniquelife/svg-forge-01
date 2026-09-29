import io, re, sys, cairosvg, numpy as np
from PIL import Image
src_path, svg_path, out_path, crop = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv)>4 else None
src=Image.open(src_path).convert('RGBA')
a=np.array(src.convert('L')); rgba=np.array(src)
# 잉크 영역 bbox (흰 배경 제외)
ink=(a<235)&(rgba[...,3]>20)
ys,xs=np.where(ink); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
S=4
base=src.crop((x0,y0,x1,y1)).resize(((x1-x0)*S,(y1-y0)*S),Image.LANCZOS).convert('RGB')
base=Image.blend(Image.new('RGB',base.size,'white'),base,0.45)
svg=open(svg_path).read()
svg=re.sub(r'stroke-width="[^"]+"','stroke-width="0.02"',svg)
svg=re.sub(r'stroke="#[0-9a-fA-F]+"','stroke="#000000"',svg)
ov=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=base.width,output_height=base.height))).convert('RGBA')
base.paste(ov,(0,0),ov)
if crop:
    cx0,cy0,cx1,cy1=[int(v) for v in crop.split(',')]; base=base.crop((cx0,cy0,cx1,cy1))
base.save(out_path); print(base.size)
