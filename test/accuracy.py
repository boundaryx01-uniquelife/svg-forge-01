import io, time, pathlib, numpy as np, cairosvg
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
def settle(page):
    time.sleep(0.6)
    page.wait_for_function("()=>{const s=document.getElementById('status');return s.innerText.trim()!=='' && !s.innerText.includes('처리 중')}",timeout=30000)
def trace(html, img, name):
    with sync_playwright() as p:
        b=p.chromium.launch(); page=b.new_page(viewport={'width':1400,'height':900})
        errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
        page.goto('file://'+str(ROOT/html)); time.sleep(0.3)
        page.set_input_files('#file',str(img)); settle(page)
        st=page.inner_text('#status').replace('\n',' | ')
        with page.expect_download() as d: page.click('#btnFill')
        d.value.save_as(OUT/name)
        page.screenshot(path=str(OUT/(name+'.png')))
        b.close()
    return st, errs
BIG=3200
truth=np.array(Image.open(io.BytesIO(cairosvg.svg2png(url=str(ROOT/'test/in/truth.svg'),output_width=BIG))).convert('L'))<128
ys,xs=np.where(truth); T=truth[ys.min():ys.max()+1, xs.min():xs.max()+1]
per=(np.abs(np.diff(T.astype(int),axis=0)).sum()+np.abs(np.diff(T.astype(int),axis=1)).sum())
for html,tag in [('test/old.html','old'),('dist/svg-forge.html','new')]:
    st,errs=trace(html, ROOT/'test/in/truth_800.png', f'acc_{tag}.svg')
    H,W=T.shape
    R=np.array(Image.open(io.BytesIO(cairosvg.svg2png(url=str(OUT/f'acc_{tag}.svg'),output_width=W,output_height=H,background_color='white'))).convert('L'))<128
    xor=(R^T).sum()
    # 평균 가장자리 오차(입력 800px 기준 픽셀) = XOR면적/둘레 → 고해상도 px → 입력 px로 환산
    err=xor/per*(800/BIG)
    print(f'{tag}: {st}')
    print(f'   평균 가장자리 오차 = {err:.3f} px (입력 800px 기준), errors={errs}')
st,errs=trace('dist/svg-forge.html', ROOT/'test/in/user_uniquelife.png','user_new.svg'); print('user new:',st,errs)
st,errs=trace('test/old.html', ROOT/'test/in/user_uniquelife.png','user_old.svg'); print('user old:',st,errs)
