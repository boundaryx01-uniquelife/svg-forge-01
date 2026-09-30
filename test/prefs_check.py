# 설정 창·영어 툴팁·모서리 최대치 멈춤·기본 글자
import time, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(0.9); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
res={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1366,'height':657},locale='ko-KR'); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); time.sleep(0.8)
    res['default_text']=pg.input_value('#text')
    res['hints']=pg.evaluate("()=>['modeImage','btnLaser','edgeType'].map(id=>document.getElementById(id).title).concat([document.querySelector('label[for=tres]').title, document.querySelector('#edgeType option[value=chamfer]').title])")
    pg.click('#modeText'); wait(pg)
    pg.select_option('#edgeType','fillet'); time.sleep(1.2)
    pg.fill('#edgeSize','9'); pg.dispatch_event('#edgeSize','input'); time.sleep(1.5)
    res['edge_after_9']=(pg.input_value('#edgeSize'), pg.get_attribute('#edgeSize','max'), pg.inner_text('#badge3d'))
    pg.click('#prefsBtn'); time.sleep(0.3)
    pg.fill('#pDimColor','#e0205a'); pg.dispatch_event('#pDimColor','input')
    pg.select_option('#pBg3d','dark'); pg.select_option('#pDimSize','1.3'); time.sleep(0.8)
    pg.screenshot(path=str(OUT/'prefs_dialog.png'))
    pg.click('#prefs button[value=close]'); time.sleep(0.8)
    pg.screenshot(path=str(OUT/'prefs_after.png'))
    pg.click('#prefsBtn'); pg.click('#pResetCtl'); time.sleep(1.5)
    res['after_reset']=(pg.input_value('#edgeType'), pg.input_value('#edgeSize'), pg.input_value('#text'))
    pg2=b.new_page(viewport={'width':1366,'height':657},locale='en-US'); pg2.goto(URL); time.sleep(0.8)
    res['en_default_text']=pg2.input_value('#text'); res['en_hint']=pg2.get_attribute('#modeImage','title')
    res['prefs_persist']=pg2.evaluate("()=>getComputedStyle(document.documentElement).getPropertyValue('--dim')")
    res['errors']=errs
    b.close()
for k,v in res.items(): print(k,'=>',v)
