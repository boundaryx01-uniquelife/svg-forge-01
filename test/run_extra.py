import time, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); URL='file://'+str(ROOT/'dist/svg-forge.html')
def settle(page, t=25000):
    time.sleep(0.4)
    page.wait_for_function("()=>{const s=document.getElementById('status');return !s.innerText.includes('처리 중')}",timeout=t)
logs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=b.new_page(viewport={'width':1400,'height':900})
    page.on('pageerror',lambda e:logs.append('PAGEERROR '+str(e)))
    page.on('console',lambda m: m.type=='error' and logs.append('ERR '+m.text))
    page.goto(URL); time.sleep(0.4)
    for name,colors in [('photo.jpg','6'),('photo.jpg','1'),('tiny.png','1'),('noviewbox.svg','1')]:
        page.select_option('#colors',colors)
        t0=time.time(); page.set_input_files('#file',str(ROOT/'test/in'/name)); settle(page)
        print(f'{name:14s} colors={colors}: {time.time()-t0:.2f}s  ->', page.inner_text('#status').replace('\n',' | ')[:120], '|', page.inner_text('#msg').replace('\n',' / ')[:160])
    # 텍스트: 폰트에 없는 글자
    page.click('#modeText'); page.fill('#text','鐵 😀 가A'); settle(page)
    print('missing glyph msg:', page.inner_text('#msg'))
    # 빈 텍스트
    page.fill('#text',''); settle(page); print('empty text ->', page.inner_text('#view2d')[:40], 'btnFill disabled:', page.is_disabled('#btnFill'))
    # 윤곽선 미리보기 & 3D 두께 변경
    page.fill('#text','A'); settle(page); page.click('#v2Line'); time.sleep(0.3); page.screenshot(path=str(ROOT/'test/out/shot_line.png'))
    page.click('#tab3d'); time.sleep(0.8); page.fill('#thick','8'); time.sleep(0.5); print('3D badge:', page.inner_text('#badge3d'))
    b.close()
print('\n'.join(logs) or 'no page errors')
