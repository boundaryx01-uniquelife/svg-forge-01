from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/multi.png'); time.sleep(3.5)
    cols=lambda: pg.inner_text('#status').split('\n')[1:-1]
    r={'before':cols(),'n':pg.inner_text('#status').split('\n')[0]}
    pg.screenshot(path='/tmp/claude-0/sc0.png')
    # 첫 path 중앙 클릭
    pt=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const ps=[...s.querySelectorAll('path')];return ps.map(p=>{const r=p.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,p.getAttribute('fill')]})}")
    r['paths']=pt[:6]
    print(json.dumps(r,ensure_ascii=False)); b.close()
