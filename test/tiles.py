from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    r={'btns':pg.evaluate("()=>document.querySelectorAll('button.swbtn').length")}
    # 도형 선택 → 편집바 색 타일로 변경
    bb=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const r=s.getBoundingClientRect();const vb=s.viewBox.baseVal;const sc=Math.min(r.width/vb.width,r.height/vb.height);const ox=r.left+(r.width-vb.width*sc)/2,oy=r.top+(r.height-vb.height*sc)/2;const m=s.querySelector('path').getBBox();return [ox+(m.x+m.width*0.78-vb.x)*sc,oy+(m.y+m.height*0.28-vb.y)*sc]}")
    pg.mouse.click(bb[0],bb[1]); time.sleep(.6)
    pg.click('#edColor + button.swbtn'); time.sleep(.3)
    r['tiles']=pg.evaluate("()=>document.querySelectorAll('.tilepop .tile').length")
    pg.screenshot(path='/tmp/claude-0/tl.png')
    pg.click('.tilepop .tile:nth-child(6)'); time.sleep(1.5)
    r['status']=pg.inner_text('#status').split('\n')[0]; r['colors']=pg.inner_text('#status')[-60:]
    pg.click('#tab3d') ; time.sleep(1)
    pg.check('#baseOn'); pg.click('#baseColor + button.swbtn'); pg.click('.tilepop .tile:nth-child(13)'); time.sleep(.5)
    r['base']=pg.input_value('#baseColor'); r['errs']=errs
    print(json.dumps(r,ensure_ascii=False)); b.close()
