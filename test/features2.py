# 받침 모양·새김/관통·구멍 고리·치수·뷰큐브·한자 대체·2D 확대 확인
import time, pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(0.9); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
res={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':1366,'height':657},locale='ko-KR'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.goto(URL); time.sleep(0.8)
    pg.click('#modeText'); pg.fill('#text','김철수 金哲洙'); wait(pg)
    res['hanja_msg']=pg.inner_text('#msg'); res['status']=pg.inner_text('#status')
    pg.screenshot(path=str(OUT/'f2_text2d.png'))
    res['vb']=pg.evaluate("()=>document.querySelector('#view2d svg').getAttribute('viewBox')")
    pg.mouse.move(700,350); pg.mouse.wheel(0,-400); time.sleep(0.3)
    res['vb_zoom']=pg.evaluate("()=>document.querySelector('#view2d svg').getAttribute('viewBox')")
    pg.click('#homeBtn'); res['vb_home']=pg.evaluate("()=>document.querySelector('#view2d svg').getAttribute('viewBox')")
    res['font_groups']=pg.evaluate("()=>[...fontSel.querySelectorAll('optgroup')].map(g=>g.label+':'+g.children.length)")
    pg.check('#baseOn'); time.sleep(1.2)
    for shape in ['star','heart','cloud','hexagon','shield']:
        pg.select_option('#baseShape',shape); time.sleep(1.0)
        res['badge_'+shape]=pg.inner_text('#badge3d')
    pg.screenshot(path=str(OUT/'f2_star3d.png'))
    pg.select_option('#baseShape','rect'); pg.select_option('#textMode','engrave'); time.sleep(1.2)
    res['engrave']=pg.inner_text('#badge3d'); res['engrave_labels']=pg.evaluate("()=>[...document.querySelectorAll('#dimLabels .dl')].map(d=>d.textContent)")
    pg.screenshot(path=str(OUT/'f2_engrave.png'))
    pg.select_option('#textMode','through'); time.sleep(1.2); res['through']=pg.inner_text('#badge3d')
    pg.screenshot(path=str(OUT/'f2_through.png'))
    pg.select_option('#textMode','emboss'); pg.fill('#baseMargin','6'); pg.dispatch_event('#baseMargin','input')
    pg.check('#ringOn'); pg.select_option('#ringType','hole'); time.sleep(1.2); res['hole']=pg.inner_text('#badge3d')
    pg.screenshot(path=str(OUT/'f2_hole.png'))
    # 뷰 큐브: 위 누르기
    faces=pg.locator('#cube .face'); res['cube_faces']=faces.count()
    pg.locator('#cube .face', has_text='위').click(force=True); time.sleep(0.5)
    pg.screenshot(path=str(OUT/'f2_top.png'))
    res['cam_top']=pg.evaluate("()=>1")
    with pg.expect_download() as d: pg.click('#btn3mf')
    d.value.save_as(OUT/'f2_hole.3mf')
    with pg.expect_download() as d: pg.click('#btnStl')
    d.value.save_as(OUT/'f2_hole.stl')
    pg.select_option('#langSel','en'); time.sleep(0.8); res['en_cube']=pg.evaluate("()=>[...document.querySelectorAll('#cube .face')].map(f=>f.textContent).join(',')")
    pg.screenshot(path=str(OUT/'f2_en3d.png'))
    res['fit']=pg.evaluate("()=>[...document.querySelectorAll('.panel')].map(p=>[p.id,p.scrollHeight,p.clientHeight])")
    res['errors']=errs
    b.close()
for k,v in res.items(): print(k,'=>',v)
