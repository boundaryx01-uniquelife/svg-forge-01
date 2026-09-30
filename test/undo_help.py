# 실행 취소/다시 실행, 도움말 창, 프리셋
import time, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(1.0); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
r={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); time.sleep(0.8)
    pg.click('#modeText'); pg.fill('#text','ABC'); wait(pg); time.sleep(0.8)
    pg.fill('#width','60'); pg.dispatch_event('#width','input'); wait(pg); time.sleep(0.8)
    pg.check('#baseOn'); time.sleep(1.5)
    pg.fill('#thick','6'); pg.dispatch_event('#thick','input'); time.sleep(1.5)
    r['before']=pg.evaluate("()=>[document.getElementById('width').value,document.getElementById('baseOn').checked,document.getElementById('thick').value,document.getElementById('undoBtn').disabled]")
    pg.click('#undoBtn'); time.sleep(1.5)
    r['undo1']=pg.evaluate("()=>[document.getElementById('width').value,document.getElementById('baseOn').checked,document.getElementById('thick').value]")
    pg.keyboard.press('Control+z'); time.sleep(1.5)
    r['undo2']=pg.evaluate("()=>[document.getElementById('width').value,document.getElementById('baseOn').checked,document.getElementById('thick').value]")
    pg.keyboard.press('Control+y'); time.sleep(1.5)
    r['redo1']=pg.evaluate("()=>[document.getElementById('width').value,document.getElementById('baseOn').checked,document.getElementById('thick').value,document.getElementById('redoBtn').disabled]")
    pg.click('#helpBtn'); time.sleep(0.4)
    r['help_open']=pg.evaluate("()=>document.getElementById('help').open")
    pg.screenshot(path=str(OUT/'help.png'))
    pg.click('#help button.pri'); time.sleep(0.3)
    pg.select_option('#preset','laser'); time.sleep(1.5)
    r['laser']=pg.evaluate("()=>[document.getElementById('baseOn').checked,document.querySelectorAll('.exports .btn.rec').length]")
    r['errors']=errs
    print(r)
ok = (r['before'][3]==False and r['undo1'][2]!='6' and r['undo2'][1]==False and r['redo1'][1]==True and r['help_open'] and r['laser']==[False,2] and not errs)
print('OK' if ok else 'FAIL')
