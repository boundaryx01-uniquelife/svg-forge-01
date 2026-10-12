from playwright.sync_api import sync_playwright
import time
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    vb=lambda: pg.evaluate("()=>document.querySelector('#view2d svg').getAttribute('viewBox')")
    pg.click('#edCut'); v0=vb()
    pg.mouse.move(600,300); pg.mouse.down(button='middle'); pg.mouse.move(700,350,steps=5); pg.mouse.up(button='middle'); time.sleep(.3)
    v1=vb()
    n=pg.evaluate("()=>JSON.stringify(1)")
    pg.mouse.move(600,300); pg.mouse.down(); pg.mouse.move(650,300,steps=3); pg.mouse.up(); time.sleep(.8)
    print(v0,'->',v1,'moved',v0!=v1,'cutmode still on',pg.evaluate("()=>document.querySelector('#edCut').classList.contains('on')"),errs); b.close()
