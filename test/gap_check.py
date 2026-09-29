import re, io, sys, numpy as np, cairosvg
from PIL import Image
def layer_alphas(path, W=3000):
    s=open(path).read()
    head=re.search(r'<svg[^>]*>',s).group(0)
    paths=re.findall(r'<path [^>]*/>',s)
    out=[]
    for p in paths:
        svg=head+p+'</svg>'
        im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=W))).convert('RGBA')
        out.append(np.array(im)[...,3].astype(np.int32))
    return out
for f in sys.argv[1:]:
    A=layer_alphas(f); S=sum(A); covered=S>0
    # 경계 안쪽(여러 레이어가 만나는 곳)만: 합이 0<S인 픽셀 중 두 레이어 이상 닿은 픽셀
    multi=(sum((a>0).astype(int) for a in A)>=2)
    gap=((S<200)&multi).sum(); over=((S>310)&multi).sum()
    print(f.split('/')[-1], 'layers',len(A),'shared-edge px',multi.sum(),'gap px',gap,'overlap px',over)
