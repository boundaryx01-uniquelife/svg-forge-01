# 글자별 조절 중 화면 유지, 큐브 꼭지점 8개, '텍스트' 표기
import time, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(0.9); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
VB="()=>document.querySelector('#view2d svg').getAttribute('viewBox').split(' ').map(Number)"
res={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR').new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); time.sleep(0.8)
    res['labels']=pg.evaluate("()=>[document.getElementById('modeText').textContent, document.querySelector('#paneText h2').textContent, document.getElementById('text').value]")
    pg.click('#modeText'); pg.fill('#text','ABCD'); wait(pg)
    # 2D: 확대(휠) 후 글자 크기 변경 → 확대 배율 유지
    bx=pg.evaluate("()=>{const r=document.querySelector('#view2d svg').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}")
    pg.mouse.move(*bx); pg.mouse.wheel(0,-400); time.sleep(0.4)
    v0=pg.evaluate(VB)
    pg.locator('.chchip').nth(1).click(); time.sleep(0.3)
    pg.fill('#chScale','220'); pg.dispatch_event('#chScale','input'); wait(pg)
    v1=pg.evaluate(VB)
    res['vb2_same_zoom']=(abs(v0[2]-v1[2])<1e-3 and abs(v0[3]-v1[3])<1e-3, v0, v1)
    # 3D: 꼭지점 클릭 → 카메라 방향, 글자 크기 변경 후에도 유지
    pg.click('#tab3d'); time.sleep(1.2)
    res['vtx_count']=pg.evaluate("()=>document.querySelectorAll('#cube .vtx').length")
    # 화면상 보이는 점 중 하나를 클릭
    pts=pg.evaluate("()=>[...document.querySelectorAll('#cube .vtx')].map(d=>{const r=d.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===d]})")
    vis=[q for q in pts if q[2]]
    res['vtx_visible']=len(vis)
    c0=pg.evaluate("()=>__svgforge.cam")
    pg.mouse.click(vis[0][0],vis[0][1]); time.sleep(0.6)
    c1=pg.evaluate("()=>__svgforge.cam")
    res['vtx_moved']=(c0,c1)
    pg.screenshot(path=str(OUT/'f4_vtx.png'))
    pg.fill('#chScale','120'); pg.dispatch_event('#chScale','input'); wait(pg); time.sleep(0.6)
    c2=pg.evaluate("()=>__svgforge.cam")
    res['cam_kept']=(max(abs(a-b) for a,b in zip(c1,c2))<1e-6, c1, c2)
    # 홈 버튼은 여전히 초기 화면으로
    pg.click('#homeBtn'); time.sleep(0.8)
    c3=pg.evaluate("()=>__svgforge.cam")
    res['home_resets']=max(abs(a-b) for a,b in zip(c2,c3))>1e-3
    res['errors']=errs
print(res)
ok=any(abs(x)>1 for x in res['vtx_moved'][0]) and res['vb2_same_zoom'][0] and res['vtx_count']==8 and res['vtx_moved'][0]!=res['vtx_moved'][1] and res['cam_kept'][0] and res['home_resets'] and not errs and res['labels'][0]=='텍스트'
print('OK' if ok else 'FAIL')
