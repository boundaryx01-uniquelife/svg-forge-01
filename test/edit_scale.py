from playwright.sync_api import sync_playwright
import time, json
from PIL import Image, ImageChops
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    pg.fill('#width','40'); pg.keyboard.press('Tab'); time.sleep(1.5)
    def scr(fx,fy):
        bb=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const r=s.getBoundingClientRect();const vb=s.viewBox.baseVal;return [r.left,r.top,r.width,r.height,vb.x,vb.y,vb.width,vb.height]}")
        sc=min(bb[2]/bb[6],bb[3]/bb[7]); ox=bb[0]+(bb[2]-bb[6]*sc)/2; oy=bb[1]+(bb[3]-bb[7]*sc)/2
        m=pg.evaluate("()=>{const m=document.querySelector('#view2d svg path').getBBox();return [m.x,m.y,m.width,m.height]}")
        return ox+(m[0]+m[2]*fx-bb[4])*sc, oy+(m[1]+m[3]*fy-bb[5])*sc
    pg.click('#edText'); pg.fill('#tdText','12'); pg.fill('#tdSize','5'); pg.click('#textDlg button[value=ok]'); time.sleep(.8)
    x,y=scr(0.9,0.9); pg.mouse.click(x,y); time.sleep(1.5)
    # 별을 이동(글자와 겹치게)
    x,y=scr(0.78,0.28); pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x-10,y+40); pg.mouse.move(x-20,y+90); pg.mouse.up(); time.sleep(1.5)
    shot=lambda n:pg.locator('#view2d').screenshot(path=n)
    shot('/tmp/claude-0/w40.png')
    pg.fill('#width','20'); pg.keyboard.press('Tab'); time.sleep(2.5)
    shot('/tmp/claude-0/w20.png')
    a=Image.open('/tmp/claude-0/w40.png').convert('L'); c=Image.open('/tmp/claude-0/w20.png').convert('L')
    d=ImageChops.difference(a,c).point(lambda v:255 if v>60 else 0)
    print('diff pixels',sum(1 for v in d.getdata() if v), 'of', a.size[0]*a.size[1], errs)
    b.close()
