# 글자 선택 상자: 크기 점·회전 점·크기 표시, 3D 면 시점 직교(원근 없음)
import time, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(0.9); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
res={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); time.sleep(0.8)
    pg.click('#modeText'); pg.fill('#text','ABC'); wait(pg)
    pg.locator('.chchip').nth(1).click(); time.sleep(0.5)
    res['handles']=pg.evaluate("()=>[...document.querySelectorAll('#view2d .chhandle')].map(h=>h.getAttribute('data-h'))")
    res['label']=pg.evaluate("()=>document.querySelector('#view2d .chsize').textContent")
    ctr=lambda sel:pg.evaluate("(s)=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}",sel)
    # 크기: se 점을 오른쪽 아래로 끌기
    x,y=ctr('#view2d .chhandle.h-se'); st0=pg.evaluate("()=>JSON.stringify(__svgforge.charStyles)")
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x+60,y+40,steps=6); pg.mouse.up(); wait(pg)
    st1=pg.evaluate("()=>__svgforge.charStyles[1]"); res['scale']=(st0,st1)
    res['scale_ok']=bool(st1 and st1.get('s',1)>1.1)
    # 크기 고정점(nw) 이 안 움직였는지: 상자 좌상단 비교는 생략, 회전
    x,y=ctr('#view2d .chhandle.rot'); c=ctr('#view2d .chhandle.h-nw')
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x+80,y+30,steps=8); pg.mouse.up(); wait(pg)
    st2=pg.evaluate("()=>__svgforge.charStyles[1]"); res['rot']=st2
    res['rot_ok']=bool(st2 and abs(st2.get('r',0))>5)
    res['rot_panel']=pg.evaluate("()=>document.getElementById('chRotVal').textContent")
    pg.screenshot(path=str(OUT/'handles_2d.png'))
    # 회전 슬라이더
    pg.fill('#chRot','45'); pg.dispatch_event('#chRot','input'); wait(pg)
    res['rot45']=pg.evaluate("()=>__svgforge.charStyles[1].r")
    # 크기 라벨 클릭 → 숫자 입력
    pg.click('#view2d .chsize'); time.sleep(0.3)
    res['editor']=pg.evaluate("()=>!!document.querySelector('input.numedit')")
    pg.keyboard.press('Escape'); time.sleep(0.2)
    # 3D 면 시점 직교
    pg.click('#tab3d'); time.sleep(1.3)
    res['fov_persp']=pg.evaluate("()=>__svgforge.fov")
    face=pg.evaluate("()=>{const d=[...document.querySelectorAll('#cube .face')].map(d=>{const r=d.getBoundingClientRect();return [d.textContent,r.x+r.width/2,r.y+r.height/2,document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===d]});return d}")
    vis=[f for f in face if f[3]]; res['faces_visible']=[f[0] for f in vis]
    pg.mouse.click(vis[0][1],vis[0][2]); time.sleep(0.8)
    res['fov_ortho']=pg.evaluate("()=>__svgforge.fov"); pg.screenshot(path=str(OUT/'handles_ortho.png'))
    # 옵션 변경 후에도 유지
    pg.evaluate("()=>{const e=document.getElementById('width');e.value=70;e.dispatchEvent(new Event('input',{bubbles:true}))}"); wait(pg); time.sleep(0.8)
    res['fov_after_edit']=pg.evaluate("()=>__svgforge.fov")
    # 돌리면 원근으로 복귀
    bx=pg.evaluate("()=>{const r=document.querySelector('#view3d').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}")
    res['cam_before']=pg.evaluate("()=>__svgforge.cam"); pg.mouse.move(bx[0]-250,bx[1]+120); pg.mouse.down(); pg.mouse.move(bx[0]-150,bx[1]+20,steps=10); pg.mouse.up(); time.sleep(0.5)
    res['cam_after']=pg.evaluate("()=>__svgforge.cam"); res['fov_after_orbit']=pg.evaluate("()=>__svgforge.fov")
    res['errors']=errs
    print(res); b.close()
