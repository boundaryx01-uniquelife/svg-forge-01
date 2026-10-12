from playwright.sync_api import sync_playwright
import time, json, re
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR',accept_downloads=True)
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    def size(): return re.search(r'([\d.]+) × ([\d.]+) mm',pg.inner_text('#status')).groups()
    def click_shape(fx,fy):
        bb=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const r=s.getBoundingClientRect();const vb=s.viewBox.baseVal;return [r.left,r.top,r.width,r.height,vb.x,vb.y,vb.width,vb.height]}")
        sc=min(bb[2]/bb[6],bb[3]/bb[7]); ox=bb[0]+(bb[2]-bb[6]*sc)/2; oy=bb[1]+(bb[3]-bb[7]*sc)/2
        m=pg.evaluate("()=>{const m=document.querySelector('#view2d svg path').getBBox();return [m.x,m.y,m.width,m.height]}")
        pg.mouse.click(ox+(m[0]+m[2]*fx-bb[4])*sc, oy+(m[1]+m[3]*fy-bb[5])*sc)
    r={'orig':size()}
    click_shape(0.79,0.3); time.sleep(.3)
    for i in range(5): pg.click('#edPlus'); time.sleep(.5)
    time.sleep(1); r['star+1mm']=size(); r['still_selected']=pg.is_visible('#edDel')
    # 색 바꾸기 → 새 색 레이어
    pg.fill('#edColor','#ff0000'); pg.dispatch_event('#edColor','change'); time.sleep(1.2)
    r['colors']=pg.evaluate("()=>[...document.querySelectorAll('#status .sw')].length")
    r['status']=pg.inner_text('#status')
    # 프로젝트 저장 → 다시 열기
    with pg.expect_download() as d: pg.click('#projSave')
    path='/tmp/claude-0/edit.svgforge'; d.value.save_as(path)
    saved=json.load(open(path)); r['saved_edits']=saved.get('edits')
    pg.set_input_files('#file','in/multi.png'); time.sleep(2.5); r['other']=size()
    pg.set_input_files('#projFile',path); time.sleep(3.5); r['reloaded']=size(); r['reloaded_status']=pg.inner_text('#status')
    # 너비 변경해도 편집 유지
    pg.fill('#width','80'); pg.dispatch_event('#width','change'); time.sleep(1.5); r['w80']=size()
    # 이미지 설정 바꾸면 초기화 안내
    pg.select_option('#colors','2'); time.sleep(3); r['after_colors']=pg.inner_text('#msg')[:60]
    r['errs']=errs
    print(json.dumps(r,ensure_ascii=False,indent=1)); b.close()
