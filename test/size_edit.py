# 글자 치수: 가로·세로 따로 입력 (패널·상자 숫자), 안내 문구 모드별
import time, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(0.9); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
res={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); time.sleep(0.8)
    pg.click('#modeText'); pg.fill('#text','텍스트 입력'); wait(pg)
    pg.locator('.chchip').nth(1).click(); time.sleep(0.5)
    wh=lambda:pg.evaluate("()=>[document.getElementById('chW').value,document.getElementById('chH').value]")
    res['start']=wh()
    pg.fill('#chH','20'); pg.dispatch_event('#chH','change'); wait(pg); time.sleep(0.4)
    res['after_h']=wh(); res['st']=pg.evaluate("()=>__svgforge.charStyles[1]")
    # 상자의 가로 숫자 클릭 → 입력
    pg.click('#view2d tspan[data-h=sizew]'); time.sleep(0.3)
    res['editor']=pg.evaluate("()=>!!document.querySelector('input.numedit')")
    pg.fill('input.numedit','15'); pg.keyboard.press('Enter'); wait(pg); time.sleep(0.4)
    res['after_w']=wh(); res['st2']=pg.evaluate("()=>__svgforge.charStyles[1]")
    res['msgs']=pg.evaluate("()=>[...document.querySelectorAll('#msg .note')].map(n=>n.textContent)")
    pg.screenshot(path=str(OUT/'size_edit.png'))
    res['errors']=errs; print(res); b.close()
