from playwright.sync_api import sync_playwright
import time
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); 
    for (w,h) in [(1366,657),(1280,720),(1920,1000)]:
        pg=b.new_page(viewport={'width':w,'height':h},locale='ko-KR')
        pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(.8)
        pg.click('#modeText'); pg.fill('#text','A'); time.sleep(1)
        pg.select_option('#preset','keycap'); time.sleep(2)
        pg.check('#borderOn') if False else None
        r=pg.evaluate("()=>{const o=document.querySelector('#panelOut');const wide=[...o.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>o.getBoundingClientRect().right-4&&e.offsetParent).map(e=>e.id||e.tagName).slice(0,6);return [o.scrollWidth,o.clientWidth,wide]}")
        print((w,h),r)
        if w==1366: pg.screenshot(path='/tmp/claude-0/pw.png',clip={'x':1090,'y':50,'width':276,'height':600})
        pg.close()
    b.close()
