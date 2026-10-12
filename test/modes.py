from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    vis=lambda ids:{i:pg.is_visible(i) for i in ids}
    ids=['#tab3d','#tabSim','#btnLaser','#btnStl','#baseOn','#kcOn','#kerf','#thick']
    r={}
    for m in ['laser','keycap','keyring','print3d','']:
        pg.select_option('#preset',m); time.sleep(1.5); r[m or 'free']=vis(ids)
    pg.select_option('#preset','laser'); time.sleep(1.5)
    pg.click('#tabSim'); time.sleep(1.5)
    r['info']=pg.inner_text('#simInfo'); r['time']=pg.inner_text('#simTime')
    pg.click('#simPlay'); time.sleep(2.5)
    pg.screenshot(path='/tmp/claude-0/s1.png')
    r['time2']=pg.inner_text('#simTime'); r['errs']=errs
    print(json.dumps(r,ensure_ascii=False)); b.close()
