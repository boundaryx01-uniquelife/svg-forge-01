from playwright.sync_api import sync_playwright
import time, json
def info(pg): return pg.evaluate("()=>{const m=window.__S&&0;return document.querySelector('#status').innerText}")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    r={}
    def st(): return pg.inner_text('#status').split('\n')[0]
    def click_shape(fx,fy):
        # 미리보기 svg 안의 상대 위치를 화면 좌표로 클릭
        bb=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const r=s.getBoundingClientRect();const vb=s.viewBox.baseVal;return [r.left,r.top,r.width,r.height,vb.x,vb.y,vb.width,vb.height]}")
        # preserveAspectRatio meet
        sc=min(bb[2]/bb[6],bb[3]/bb[7]); ox=bb[0]+(bb[2]-bb[6]*sc)/2; oy=bb[1]+(bb[3]-bb[7]*sc)/2
        m=pg.evaluate("()=>{const m=document.querySelector('#view2d svg path').getBBox();return [m.x,m.y,m.width,m.height]}")
        x=ox+(m[0]+m[2]*fx-bb[4])*sc; y=oy+(m[1]+m[3]*fy-bb[5])*sc
        pg.mouse.click(x,y)
    r['hint']=pg.inner_text('#edInfo'); r['before']=st()
    click_shape(0.79,0.3); time.sleep(.3)
    r['bar']=pg.is_visible('#edDel'); r['info']=pg.inner_text('#edInfo')
    pg.screenshot(path='/tmp/claude-0/e1.png')
    # 두께 +
    pg.click('#edPlus'); time.sleep(1); r['plus']=st(); r['bar_after_plus']=pg.is_visible('#edDel')
    pg.click('#edMinus'); pg.click('#edMinus'); time.sleep(1); r['minus']=st()
    # 삭제 (Delete 키)
    pg.keyboard.press('Delete'); time.sleep(1); r['del_key']=st()
    click_shape(0.08,0.28); time.sleep(.3); pg.keyboard.press('Delete'); time.sleep(1); r['del2']=st()
    # undo
    for i in range(2):
        pg.keyboard.press('Control+z'); time.sleep(1.2)
    r['undo2']=st()
    pg.screenshot(path='/tmp/claude-0/e2.png')
    # 색 전체 삭제 범위
    click_shape(0.08,0.28); time.sleep(.3); pg.select_option('#edScope','color'); r['holes_btn_dis']=pg.is_disabled('#edHoles')
    pg.click('#edHoles'); time.sleep(1); r['holes']=st()
    # 저장/복원 호환: 프로젝트 직렬화
    pg.set_input_files('#file','in/multi.png'); time.sleep(3); r['newimg']=st()
    r['errs']=errs
    print(json.dumps(r,ensure_ascii=False,indent=1)); b.close()
