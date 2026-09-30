# 글자별 크기·높이·색·이동, 치수 클릭 수정, 치수 퀵버튼, 고리 여러 개(아래), 이미지 모양 받침, 프로젝트 저장
import time, pathlib, json
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(0.9); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
M="()=>{const m=__svgforge.model;return [m.width.toFixed(2),m.height.toFixed(2),m.layers.map(l=>l.color+':'+(l.dz||0)).join(',')]}"
res={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR')
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.goto(URL); time.sleep(0.8)
    pg.click('#modeText'); pg.fill('#text','ABCD'); wait(pg)
    res['plain']=pg.evaluate(M)
    pg.locator('.chchip').nth(1).click(); time.sleep(0.3)
    pg.fill('#chScale','200'); pg.dispatch_event('#chScale','input'); wait(pg)
    res['B_x2']=pg.evaluate(M)
    pg.fill('#chDz','1.5'); pg.dispatch_event('#chDz','input'); pg.fill('#chColor','#d62828'); pg.dispatch_event('#chColor','input'); wait(pg)
    res['B_dz_color']=pg.evaluate(M)
    # 2D에서 C 끌기
    box=pg.evaluate("()=>{const b=document.querySelector('#view2d svg').getBoundingClientRect();return [b.x,b.y,b.width,b.height]}")
    cb=pg.evaluate("()=>{const sv=document.querySelector('#view2d svg');const m=__svgforge.model;const c=m.chars.find(c=>c.i===2);const s=m.xf.s;const x=((c.box[0]+c.box[2])/2-m.xf.x0)*s,y=((c.box[1]+c.box[3])/2-m.xf.y0)*s;const pt=new DOMPoint(x,y).matrixTransform(sv.getScreenCTM());return [pt.x,pt.y]}")
    pg.mouse.move(cb[0],cb[1]); pg.mouse.down(); pg.mouse.move(cb[0]+10,cb[1]-40,steps=5); pg.mouse.move(cb[0]+20,cb[1]-80,steps=5); pg.mouse.up(); wait(pg)
    res['C_drag']=pg.evaluate("()=>JSON.stringify(__svgforge.charStyles)")
    pg.keyboard.press('ArrowRight'); wait(pg)
    res['chips']=pg.evaluate("()=>[...document.querySelectorAll('.chchip')].map(c=>c.textContent+(c.classList.contains('mod')?'*':'')+(c.classList.contains('sel')?'<':'')).join(' ')")
    pg.screenshot(path=str(OUT/'f3_chars2d.png'))
    # 2D 치수 클릭 → 너비 80
    pg.locator('#view2d svg text.edit').first.click(); time.sleep(0.2)
    pg.keyboard.press('Control+A'); pg.keyboard.type('80'); pg.keyboard.press('Enter'); wait(pg)
    res['dim_edit_w']=pg.evaluate("()=>__svgforge.model.width.toFixed(2)")
    # 3D
    pg.click('#tab3d'); time.sleep(1.2)
    pg.screenshot(path=str(OUT/'f3_chars3d.png'))
    lab=pg.locator('#dimLabels .dl.h')
    res['labels']=pg.evaluate("()=>[...document.querySelectorAll('#dimLabels .dl')].map(d=>d.textContent)")
    lab.first.click(); time.sleep(0.2); pg.keyboard.press('Control+A'); pg.keyboard.type('5'); pg.keyboard.press('Enter'); time.sleep(1.2)
    res['labels_after']=pg.evaluate("()=>[...document.querySelectorAll('#dimLabels .dl')].map(d=>d.textContent)")
    pg.keyboard.press('d'); time.sleep(0.6); res['dims_off']=pg.evaluate("()=>document.querySelectorAll('#dimLabels .dl').length")
    pg.keyboard.press('d'); time.sleep(0.6)
    # 고리 여러 개
    pg.check('#baseOn'); pg.check('#ringOn'); time.sleep(0.8)
    pg.click('#ringAdd'); time.sleep(0.8); pg.select_option('#ringType','hole'); time.sleep(0.8)
    pg.click('#ringAdd'); time.sleep(1)
    res['rings']=pg.evaluate("()=>JSON.stringify(__svgforge.rings.map(r=>r.type+':'+r.pos))")
    res['ring_badge']=pg.inner_text('#badge3d')
    pg.screenshot(path=str(OUT/'f3_rings.png'))
    with pg.expect_download() as d: pg.click('#projSave')
    d.value.save_as(OUT/'f3.svgforge')
    with pg.expect_download() as d: pg.click('#btnStl')
    d.value.save_as(OUT/'f3.stl')
    with pg.expect_download() as d: pg.click('#btn3mf')
    d.value.save_as(OUT/'f3.3mf')
    s1=pg.evaluate(M)
    pg2=ctx.new_page(); pg2.goto(URL); time.sleep(0.8); pg2.set_input_files('#projFile',str(OUT/'f3.svgforge')); wait(pg2)
    res['proj_same']=(pg2.evaluate(M)==s1, pg2.evaluate("()=>JSON.stringify(__svgforge.rings.map(r=>r.type+':'+r.pos))"))
    pg2.close()
    # 이미지 모양 받침
    pg.click('#modeImage'); pg.set_input_files('#file',str(ROOT/'test/in/logo.png')); wait(pg)
    pg.select_option('#baseShape','imgsil'); wait(pg); time.sleep(1)
    res['imgsil']=(pg.evaluate("()=>!!__svgforge.model.plate"), pg.inner_text('#badge3d'))
    pg.click('#tab2d'); time.sleep(0.5); pg.screenshot(path=str(OUT/'f3_imgsil2d.png'))
    pg.click('#tab3d'); time.sleep(1); pg.screenshot(path=str(OUT/'f3_imgsil3d.png'))
    pg.uncheck('#baseOn'); wait(pg); time.sleep(1); res['imgsil_off']=(pg.evaluate("()=>!!__svgforge.model.plate"), pg.inner_text('#badge3d'))
    res['fit']=pg.evaluate("()=>[...document.querySelectorAll('.panel')].map(p=>[p.id,p.scrollHeight,p.clientHeight])")
    res['errors']=errs
    b.close()
for k,v in res.items(): print(k,'=>',v)
