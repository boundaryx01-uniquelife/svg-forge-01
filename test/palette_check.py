# 색 고르기 팝업: 16/32/64/128 개수, 선택 반영, 모델 색 표시
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
    pg.click('#modeText'); pg.fill('#text','AB'); wait(pg)
    pg.check('#baseOn'); time.sleep(1.0)
    pg.click('#baseColor'); time.sleep(0.3)
    counts={}
    for n in ['16','32','64','128']:
        pg.select_option('.palpop select',n); time.sleep(0.2)
        counts[n]=pg.locator('.palpop .palgrid').last.locator('.palsw').count()
        if n=='128': pg.screenshot(path=str(OUT/'palette128.png'))
        if n=='32': pg.screenshot(path=str(OUT/'palette32.png'))
    r['counts']=counts
    pg.select_option('.palpop select','16'); time.sleep(0.2)
    pg.locator('.palpop .palgrid').last.locator('.palsw').nth(7).click(); time.sleep(0.8)   # 주황
    r['picked']=pg.input_value('#baseColor')
    r['popup_closed']=pg.locator('.palpop').count()==0
    # 글자별 색
    pg.locator('.chchip').nth(0).click(); time.sleep(0.3)
    pg.click('#chColor'); time.sleep(0.3)
    r['model_colors_row']=pg.locator('.palpop .pallab').count()
    pg.locator('.palpop .palsw').last.click(); time.sleep(1.0)
    r['charStyles']=pg.evaluate("()=>JSON.stringify(__svgforge.charStyles)")
    # 설정창 치수 색 (대화상자 안)
    pg.click('#prefsBtn'); time.sleep(0.3)
    pg.click('#pDimColor'); time.sleep(0.3)
    r['in_dialog']=pg.evaluate("()=>!!document.querySelector('#prefs .palpop')")
    pg.locator('.palpop .palgrid').last.locator('.palsw').nth(13).click(); time.sleep(0.4)
    r['dimcolor']=pg.input_value('#pDimColor')
    r['errors']=errs
    print(r)
ok = r['counts']=={'16':16,'32':32,'64':64,'128':128} and r['picked']=='#f77f00' and r['popup_closed'] and r['in_dialog'] and r['dimcolor']=='#1d4ed8' and 'color' in r['charStyles'] and not errs
print('OK' if ok else 'FAIL')
