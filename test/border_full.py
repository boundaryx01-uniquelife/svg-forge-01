# 테두리 턱 '모두 채움': 기본 켜짐, 내용물 높이까지, 끄면 mm 값
import time, pathlib, json
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(0.9); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); time.sleep(0.8)
    pg.click('#modeText'); pg.fill('#text','ABC'); wait(pg)
    pg.check('#baseOn'); pg.check('#borderOn'); pg.click('#tab3d'); time.sleep(1.5)
    r={}
    r['default_full']=pg.evaluate("()=>[document.getElementById('borderFull').checked,document.getElementById('borderW').disabled]")
    r['badge']=pg.inner_text('#badge3d')
    pg.screenshot(path=str(OUT/'border_full.png'))
    pg.uncheck('#borderFull'); time.sleep(1.2)
    r['off']=[pg.evaluate("()=>document.getElementById('borderW').disabled"),pg.inner_text('#badge3d')]
    r['err']=errs
    print(r)
