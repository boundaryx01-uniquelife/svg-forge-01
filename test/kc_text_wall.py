from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(1)
    pg.click('#modeText') if pg.query_selector('#modeText') else pg.click('text=텍스트')
    time.sleep(1); pg.fill('#text','A') if pg.query_selector('#text') else None
    r={'kcVisible':pg.is_visible('#kcOn'),'wallVisible':pg.is_visible('#wallOn')}
    pg.click('#tab3d'); time.sleep(2)
    pg.check('#kcOn'); time.sleep(3)
    r['kc_text']=pg.inner_text('#kcInfo')[:120]; r['status']=pg.inner_text('#status').split('\n')[0]
    pg.screenshot(path='/tmp/claude-0/k1.png')
    pg.uncheck('#kcOn'); time.sleep(1)
    pg.check('#wallOn'); time.sleep(3); r['wall']=pg.inner_text('#status').split('\n')[0]
    pg.screenshot(path='/tmp/claude-0/k2.png'); r['errs']=errs
    print(json.dumps(r,ensure_ascii=False,indent=1)); b.close()
