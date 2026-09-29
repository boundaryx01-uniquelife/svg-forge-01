import io, time, numpy as np, cairosvg
from PIL import Image
from playwright.sync_api import sync_playwright
FLAT = """() => { const out=[]; for (const L of window.__svgforge.layers) for (const r of L.rings) {
  const pts=[]; let px=0,py=0;
  for (const c of r) {
    if (c[0]==='M'||c[0]==='L'){ px=c[1]; py=c[2]; pts.push([px,py]); }
    else if (c[0]==='Q'){ for(let k=1;k<=16;k++){const t=k/16,u=1-t; pts.push([u*u*px+2*u*t*c[1]+t*t*c[3], u*u*py+2*u*t*c[2]+t*t*c[4]]);} px=c[3]; py=c[4]; }
    else if (c[0]==='C'){ for(let k=1;k<=24;k++){const t=k/24,u=1-t; pts.push([u*u*u*px+3*u*u*t*c[1]+3*u*t*t*c[3]+t*t*t*c[5], u*u*u*py+3*u*u*t*c[2]+3*u*t*t*c[4]+t*t*t*c[6]]);} px=c[5]; py=c[6]; }
    else if (c[0]==='A'){ const cx=c[1],cy=c[2],R=c[3],dir=c[4]; let a0=Math.atan2(py-cy,px-cx), a1=Math.atan2(c[6]-cy,c[5]-cx); let d=(a1-a0)*dir; while(d<=1e-9)d+=2*Math.PI; for(let k=1;k<=48;k++){const a=a0+dir*d*k/48; pts.push([cx+R*Math.cos(a), cy+R*Math.sin(a)]);} px=c[5]; py=c[6]; }
  } out.push(pts);} return out; }"""
def run(img, engine, colors='1'):
    with sync_playwright() as p:
        b=p.chromium.launch(); page=b.new_page(viewport={'width':1366,'height':657})
        page.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(0.3)
        page.select_option('#engine',engine)
        page.set_input_files('#file',img); time.sleep(0.3)
        page.wait_for_function("()=>document.getElementById('status').innerText.includes('도형')",timeout=60000); time.sleep(0.5)
        st=page.inner_text('#status').replace('\n',' '); polys=page.evaluate(FLAT); b.close()
    return st, polys
def err(polys, truth_svg, W, H, S=4):
    d=' '.join('M'+' L'.join(f'{x:.3f} {y:.3f}' for x,y in pl)+' Z' for pl in polys if len(pl)>2)
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="#fff"/><path fill-rule="evenodd" fill="#000" d="{d}"/></svg>'
    R=np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=W*S))).convert('L'))<128
    T=np.array(Image.open(io.BytesIO(cairosvg.svg2png(url=truth_svg,output_width=W*S))).convert('L'))<128
    per=(np.abs(np.diff(T.astype(int),axis=0)).sum()+np.abs(np.diff(T.astype(int),axis=1)).sum())
    return (R^T).sum()/per/S
for eng in ['forge','potrace']:
    st,pl=run('/home/claude/svg-forge/test/in/truth_800.png', eng)
    print(eng.ljust(8),'truth: edge err px', round(err(pl,'/home/claude/svg-forge/test/in/truth.svg',800,600),3),'|',st[:90])
