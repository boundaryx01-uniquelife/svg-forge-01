from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/small_text.png'); time.sleep(3.5)
    pg.select_option('#preset','print3d'); time.sleep(1.5); pg.click('#tab2d'); time.sleep(.5)
    pg.fill('#width','20'); pg.keyboard.press('Tab'); time.sleep(2.5)
    msg=lambda: pg.inner_text('#msg')
    r={'thinBtn':pg.is_visible('#thinBtn'),'marks':pg.evaluate("()=>!!document.querySelector('#view2d path.thinmark')"),'msg':[l for l in msg().split('\n') if '가는' in l or '빨간' in l]}
    pg.screenshot(path='/tmp/claude-0/th1.png')
    pg.click('#msg [data-act=fixthin]'); time.sleep(3)
    r['after']=[l for l in msg().split('\n') if '가는' in l]; r['marks2']=pg.evaluate("()=>document.querySelector('#view2d path.thinmark')?.getAttribute('d').length||0")
    pg.screenshot(path='/tmp/claude-0/th2.png')
    pg.keyboard.press('Control+z'); time.sleep(2); r['undo']=[l for l in msg().split('\n') if '가는' in l]
    # 텍스트 모드 획 폭
    pg.click('#modeText'); pg.fill('#text','ABC 가나'); time.sleep(2)
    r['est']=pg.inner_text('#txtSwEst'); r['tmsg']=[l for l in msg().split('\n') if '가는' in l or '빨간' in l]
    pg.fill('#txtSw','1.2'); time.sleep(2.5); r['est2']=pg.inner_text('#txtSwEst'); pg.screenshot(path='/tmp/claude-0/th3.png')
    r['errs']=errs
    print(json.dumps(r,ensure_ascii=False,indent=0)); b.close()
