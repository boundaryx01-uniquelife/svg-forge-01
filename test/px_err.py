import io, sys, numpy as np, cairosvg
from PIL import Image
S=4
T=np.array(Image.open(io.BytesIO(cairosvg.svg2png(url='test/in/truth.svg',output_width=800*S))).convert('L'))<128
per=(np.abs(np.diff(T.astype(int),axis=0)).sum()+np.abs(np.diff(T.astype(int),axis=1)).sum())
for k in sys.argv[1:]:
    R=np.array(Image.open(io.BytesIO(cairosvg.svg2png(url=f'test/out/px_{k}.svg',output_width=800*S))).convert('L'))<128
    print(k.ljust(8), 'edge err px =', round((R^T).sum()/per/S*S/ S,3) if False else round((R^T).sum()/per,3))
