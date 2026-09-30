# 한 글자와 긴 글이 화면에서 비슷한 비중으로 보이는지
import time, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(0.9); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
FR="""()=>{const v=document.getElementById('view2d').getBoundingClientRect();const g=[...document.querySelectorAll('#view2d svg path')].map(p=>p.getBoundingClientRect());
 const x0=Math.min(...g.map(r=>r.left)),x1=Math.max(...g.map(r=>r.right)),y0=Math.min(...g.map(r=>r.top)),y1=Math.max(...g.map(r=>r.bottom));
 return [((x1-x0)/v.width).toFixed(2),((y1-y0)/v.height).toFixed(2)]}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); time.sleep(0.8); pg.click('#modeText')
    for i,t in enumerate(['가','가나','가나다라마바사아자차','ABCDEFGHIJKLMNOPQRSTUVWXYZ']):
        pg.fill('#text',t); wait(pg)
        f2=pg.evaluate(FR)
        pg.click('#tab3d'); time.sleep(1.4); pg.screenshot(path=str(OUT/f'fit3d_{i}.png')); pg.click('#tab2d'); time.sleep(0.4)
        print(repr(t), '2D 가로/세로 점유', f2)
    print(errs)
