from playwright.sync_api import sync_playwright
import time, json, re
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR',accept_downloads=True)
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    st=lambda: pg.inner_text('#status').split('\n')[0]
    def scr(fx,fy):
        bb=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const r=s.getBoundingClientRect();const vb=s.viewBox.baseVal;return [r.left,r.top,r.width,r.height,vb.x,vb.y,vb.width,vb.height]}")
        sc=min(bb[2]/bb[6],bb[3]/bb[7]); ox=bb[0]+(bb[2]-bb[6]*sc)/2; oy=bb[1]+(bb[3]-bb[7]*sc)/2
        m=pg.evaluate("()=>{const m=document.querySelector('#view2d svg path').getBBox();return [m.x,m.y,m.width,m.height]}")
        return ox+(m[0]+m[2]*fx-bb[4])*sc, oy+(m[1]+m[3]*fy-bb[5])*sc
    def path_d(): return pg.evaluate("()=>document.querySelector('#view2d svg path').getAttribute('d').length")
    def edits():
        with pg.expect_download() as d: pg.click('#projSave')
        d.value.save_as('/tmp/claude-0/m.svgforge'); return json.load(open('/tmp/claude-0/m.svgforge')).get('edits')
    r={'orig':st()}
    x,y=scr(0.79,0.3); pg.mouse.click(x,y); time.sleep(.4)
    # 별 +  → 도넛 쪽으로 크게 겹치게(큰 값)
    pg.fill('#edStep','3'); 
    for i in range(2): pg.click('#edPlus'); time.sleep(.6)
    time.sleep(.6); r['grow_status']=st(); r['edits_after_grow']=edits()
    pg.click('#edMinus'); time.sleep(.8); pg.click('#edMinus'); time.sleep(1)
    e=edits(); r['edits_after_shrink']=e; r['restored']=st()
    # 이동: 별 끌기
    x,y=scr(0.79,0.3); pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x-120,y+40,steps=6); pg.mouse.up(); time.sleep(1.2)
    r['mv_edits']=edits(); r['after_move']=st()
    pg.keyboard.press('Control+z'); time.sleep(1.2); r['undo_move']=len(edits() or [])
    r['errs']=errs; print(json.dumps(r,ensure_ascii=False,indent=1)); pg.screenshot(path='/tmp/claude-0/em.png'); b.close()
