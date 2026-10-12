from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    st=lambda: pg.inner_text('#status').split('\n')[0]
    def scr(fx,fy):
        bb=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const r=s.getBoundingClientRect();const vb=s.viewBox.baseVal;return [r.left,r.top,r.width,r.height,vb.x,vb.y,vb.width,vb.height]}")
        sc=min(bb[2]/bb[6],bb[3]/bb[7]); ox=bb[0]+(bb[2]-bb[6]*sc)/2; oy=bb[1]+(bb[3]-bb[7]*sc)/2
        m=pg.evaluate("()=>{const m=document.querySelector('#view2d svg path').getBBox();return [m.x,m.y,m.width,m.height]}")
        return ox+(m[0]+m[2]*fx-bb[4])*sc, oy+(m[1]+m[3]*fy-bb[5])*sc
    def drag(a,b_):
        x0,y0=scr(*a); x1,y1=scr(*b_); pg.mouse.move(x0,y0); pg.mouse.down(); pg.mouse.move((x0+x1)/2,(y0+y1)/2); pg.mouse.move(x1,y1); pg.mouse.up(); time.sleep(1.2)
    r={'orig':st(), 'cut_visible':pg.is_visible('#edCut')}
    pg.click('#edCut')
    drag((0.50,0.3),(1.0,0.3))   # 별 가로로 자르기 (별 전체를 가로지름)
    r['star_cut']=st(); pg.screenshot(path='/tmp/claude-0/c2.png',clip={'x':700,'y':140,'width':260,'height':250})
    drag((-0.02,0.28),(0.2,0.28)) # 도넛 왼쪽 띠를 가로질러
    r['ring_cut']=st()
    pg.keyboard.press('Escape'); r['cut_off']=pg.evaluate("()=>document.querySelector('#edCut').classList.contains('on')")
    pg.keyboard.press('Control+z'); time.sleep(1.2); r['undo']=st()
    pg.screenshot(path='/tmp/claude-0/c1.png'); r['errs']=errs
    print(json.dumps(r,ensure_ascii=False,indent=1)); b.close()
