from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    st=lambda: pg.inner_text('#status').split('\n')[0]
    info=lambda: pg.inner_text('#edInfo')
    def scr(fx,fy):
        bb=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const r=s.getBoundingClientRect();const vb=s.viewBox.baseVal;return [r.left,r.top,r.width,r.height,vb.x,vb.y,vb.width,vb.height]}")
        sc=min(bb[2]/bb[6],bb[3]/bb[7]); ox=bb[0]+(bb[2]-bb[6]*sc)/2; oy=bb[1]+(bb[3]-bb[7]*sc)/2
        m=pg.evaluate("()=>{const m=document.querySelector('#view2d svg path').getBBox();return [m.x,m.y,m.width,m.height]}")
        return ox+(m[0]+m[2]*fx-bb[4])*sc, oy+(m[1]+m[3]*fy-bb[5])*sc
    r={'orig':st()}
    # 별(오른쪽 위)과 글자 클릭 → Ctrl 추가
    x,y=scr(0.78,0.28); pg.mouse.click(x,y); time.sleep(.5); r['one']=info()
    x,y=scr(0.25,0.82); pg.keyboard.down('Control'); pg.mouse.click(x,y); pg.keyboard.up('Control'); time.sleep(.5); r['two']=info()
    pg.click('#edPlus'); time.sleep(1.5); r['plus']=st(); r['after_plus']=info()
    pg.click('#edMinus'); time.sleep(1.5); r['minus']=st()
    pg.keyboard.press('Control+z'); pg.keyboard.press('Control+z'); time.sleep(1.2); r['undo2']=st()
    # 영역 선택: 전체 드래그
    x0,y0=scr(-0.1,-0.1); x1,y1=scr(1.1,1.1)
    pg.mouse.move(x0,y0); pg.mouse.down(); pg.mouse.move((x0+x1)/2,(y0+y1)/2); pg.mouse.move(x1,y1); pg.mouse.up(); time.sleep(.6); r['box']=info()
    pg.keyboard.press('Delete'); time.sleep(1.5); r['del_all']=st()
    pg.keyboard.press('Control+z'); time.sleep(1.2); r['undo']=st()
    # 부분 영역(별+도넛 위쪽)
    x0,y0=scr(-0.05,-0.05); x1,y1=scr(1.05,0.55)
    pg.mouse.move(x0,y0); pg.mouse.down(); pg.mouse.move(x1,y1); pg.mouse.up(); time.sleep(.6); r['box_top']=info()
    # 이동(그룹 끌기)
    sx,sy=scr(0.78,0.28)
    pg.mouse.move(sx,sy); pg.mouse.down(); pg.mouse.move(sx+30,sy+40); pg.mouse.move(sx+60,sy+80); pg.mouse.up(); time.sleep(1.5); r['moved']=st(); r['after_move']=info()
    pg.screenshot(path='/tmp/claude-0/ms1.png')
    r['errs']=errs
    print(json.dumps(r,ensure_ascii=False,indent=1)); b.close()
