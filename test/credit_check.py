import time, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'; URL='file://'+str(ROOT/'dist/svg-forge.html')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); time.sleep(1.2)
    r={}
    r['text']=pg.evaluate("()=>document.getElementById('credit').textContent")
    pg.evaluate("()=>document.getElementById('credit').remove()"); time.sleep(0.5)
    r['after_remove']=pg.evaluate("()=>document.getElementById('credit')?.textContent")
    pg.evaluate("()=>{const c=document.getElementById('credit');c.style.display='none';c.textContent='x'}"); time.sleep(0.5)
    r['after_hide']=pg.evaluate("()=>[document.getElementById('credit').textContent,getComputedStyle(document.getElementById('credit')).display]")
    pg.click('#helpBtn'); time.sleep(0.4); r['help']=pg.evaluate("()=>document.getElementById('aboutCredit')?.textContent")
    pg.keyboard.press('Escape')
    pg.click('#modeText'); time.sleep(2.5)
    r['overflow']=pg.evaluate("()=>[document.documentElement.scrollHeight,innerHeight,document.documentElement.scrollWidth,innerWidth]")
    pg.screenshot(path=str(OUT/'credit.png')); r['errors']=errs; print(r); b.close()
