from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(1)
    pg.click('#modeText'); pg.fill('#text','ABC 가나'); time.sleep(2)
    msg=lambda: [l for l in pg.inner_text('#msg').split('\n') if '가는' in l or '빨간' in l]
    r={'t_before':msg()}
    pg.fill('#txtSw','1'); time.sleep(2.5); r['t_after']=msg()
    pg.click('#modeImage'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    pg.select_option('#preset','keyring'); time.sleep(2); pg.click('#tab2d'); time.sleep(1)
    pg.click('#edText'); pg.fill('#tdText','10'); pg.fill('#tdSize','6'); time.sleep(1.2)
    r['est']=pg.inner_text('#tdEst'); r['print']=pg.is_checked('#tdPrint')
    pg.click('#textDlg button[value=ok]'); time.sleep(.8)
    bb=pg.evaluate("()=>{const r=document.querySelector('#view2d svg').getBoundingClientRect();return [r.left+r.width*0.8,r.top+r.height*0.8]}")
    pg.mouse.click(bb[0],bb[1]); time.sleep(2)
    r['placed']=pg.inner_text('#status').split('\n')[0]
    # 글자 획 위 클릭: 놓은 자리 근처를 훑어서 선택
    hit=False
    c=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const m=s.getScreenCTM();const b=__svgforge.model.addBoxes[0].box;const p=new DOMPoint((b[0]+b[2])/2,(b[1]+b[3])/2).matrixTransform(m);const q=new DOMPoint(b[2],b[3]).matrixTransform(m);return [p.x,p.y,q.x-p.x]}")
    for dx in range(-int(c[2]),int(c[2]),3):
        pg.mouse.click(c[0]+dx,c[1]); time.sleep(.2)
        if pg.is_visible('#edTextEdit'): hit=True; break
    r['editVisible']=hit
    if hit:
        pg.click('#edTextEdit'); time.sleep(.6)
        r['dlgSize']=pg.input_value('#tdSize'); r['dlgText']=pg.input_value('#tdText')
        pg.fill('#tdSize','12'); pg.fill('#tdText','25'); pg.click('#textDlg button[value=ok]'); time.sleep(2.5)
        r['edited']=pg.inner_text('#status').split('\n')[0]
        pg.screenshot(path='/tmp/claude-0/te.png')
    r['errs']=errs
    print(json.dumps(r,ensure_ascii=False,indent=0)); b.close()
