from playwright.sync_api import sync_playwright
import time
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':657},locale='ko-KR')
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/multi.png'); time.sleep(3)
    r={}
    r['ring_dis']=pg.is_disabled('#ringOn')
    pg.check('#baseOn'); r['ring_en']=not pg.is_disabled('#ringOn')
    pg.check('#ringOn'); pg.uncheck('#baseOn'); r['ring_off']=(not pg.is_checked('#ringOn'), pg.is_disabled('#ringOn'))
    pg.click('#tab2d'); time.sleep(1)
    r['msg']=pg.evaluate("""()=>{const m=document.querySelector('#msg').getBoundingClientRect(),v=document.querySelector('#view2d').getBoundingClientRect();return [m.top>=v.bottom, [...document.querySelectorAll('#msg .note')].map(n=>Math.round(n.getBoundingClientRect().width))]}""")
    print(r); pg.screenshot(path='/tmp/claude-0/s.png'); b.close()
