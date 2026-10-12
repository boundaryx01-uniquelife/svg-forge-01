from playwright.sync_api import sync_playwright
import time
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    pg.click('#edCut'); pg.fill('#edCutW','2')
    pg.mouse.move(675,277); pg.mouse.down(); pg.mouse.move(800,277,steps=4); pg.mouse.move(935,290,steps=4)
    print(pg.evaluate("()=>!!document.querySelector('svg g.cutline polygon')"))
    pg.screenshot(path='/tmp/claude-0/cp.png',clip={'x':650,'y':140,'width':320,'height':250}); pg.mouse.up(); time.sleep(1)
    print(pg.evaluate("()=>!!document.querySelector('svg g.cutline')"), errs); b.close()
