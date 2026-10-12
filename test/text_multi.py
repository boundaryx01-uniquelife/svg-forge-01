from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(1)
    pg.click('#modeText'); pg.fill('#text','ABCD'); time.sleep(1.5)
    chips=pg.query_selector_all('#charChips .chchip'); r={'chips':len(chips)}
    chips[0].click(); time.sleep(.5); pg.query_selector_all('#charChips .chchip')[2].click(modifiers=['Control']); time.sleep(.5)
    r['sel']=pg.evaluate("()=>[...document.querySelectorAll('#charChips .chchip.sel')].map(e=>e.textContent)")
    pg.fill('#chDz','1'); time.sleep(1); pg.evaluate("()=>{const c=document.querySelector('#chColor');c.value='#ff0000';c.dispatchEvent(new Event('input'))}"); time.sleep(1.2)
    r['mod']=pg.evaluate("()=>[...document.querySelectorAll('#charChips .chchip.mod')].map(e=>e.textContent)")
    pg.keyboard.press('Escape')
    bb=pg.evaluate("()=>{const r=document.querySelector('#view2d svg').getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]}")
    pg.mouse.move(bb[0]+5,bb[1]+5); pg.mouse.down(); pg.mouse.move((bb[0]+bb[2])/2,(bb[1]+bb[3])/2); pg.mouse.move(bb[2]-5,bb[3]-5); pg.mouse.up(); time.sleep(.6)
    r['box']=pg.evaluate("()=>[...document.querySelectorAll('#charChips .chchip.sel')].map(e=>e.textContent)")
    pg.screenshot(path='/tmp/claude-0/tm.png'); r['errs']=errs
    print(json.dumps(r,ensure_ascii=False)); b.close()
