# 이미지를 열면 색 수가 자동으로 잡히는지
import time, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge')
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(1.2); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); time.sleep(0.8)
    for f in ['multi.png','logo.png','user_uniquelife.png','photo.jpg','small_text.png','transparent.png','truth_800.png','lines.svg']:
        pg.set_input_files('#file',str(ROOT/'test/in'/f)); wait(pg)
        print(f, '->', pg.input_value('#colors'), '색', '|', pg.inner_text('#status').replace('\n',' ')[:70])
    print(errs)
