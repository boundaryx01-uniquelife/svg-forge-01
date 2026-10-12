from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    st=lambda: pg.inner_text('#status').split('\n')[0]
    r={'orig':st()}
    pg.click('#edText'); pg.fill('#tdText','AB 한글'); pg.fill('#tdSize','10'); pg.fill('#tdColor','#ff0000') if False else pg.evaluate("()=>{const c=document.querySelector('#tdColor');c.value='#ff0000';c.dispatchEvent(new Event('input'))}")
    pg.click('#textDlg button[value=ok]'); time.sleep(1)
    r['placing']=pg.evaluate("()=>document.querySelector('#edText').classList.contains('on')")
    bb=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const r=s.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height*0.85]}")
    pg.mouse.click(bb[0],bb[1]); time.sleep(1.5)
    r['after']=st(); r['placed_off']=not pg.evaluate("()=>document.querySelector('#edText').classList.contains('on')")
    pg.screenshot(path='/tmp/claude-0/t1.png')
    pg.keyboard.press('Control+z'); time.sleep(1.2); r['undo']=st(); r['errs']=errs
    print(json.dumps(r,ensure_ascii=False,indent=1)); b.close()
