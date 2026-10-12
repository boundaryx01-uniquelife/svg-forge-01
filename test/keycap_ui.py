from playwright.sync_api import sync_playwright
import time, json, struct, zipfile, re
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR',accept_downloads=True)
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(1)
    pg.click('#modeText'); pg.fill('#text','A'); time.sleep(1.5)
    pg.select_option('#preset','keycap'); time.sleep(2.5)
    r={'kc_checked':pg.is_checked('#kcOn'),'base_disabled':pg.is_disabled('#baseOn'),'width':pg.input_value('#width'),'info':pg.inner_text('#kcInfo'),'view3d':pg.is_visible('#view3d')}
    pg.screenshot(path='/tmp/claude-0/k1.png')
    for mode in ['emboss','engrave','inlay']:
        pg.select_option('#kcMode',mode); time.sleep(1.5)
        with pg.expect_download() as d: pg.click('#btnStl')
        path=f'/tmp/claude-0/k_{mode}.stl'; d.value.save_as(path)
        data=open(path,'rb').read(); r[mode+'_tris']=struct.unpack('<I',data[80:84])[0]
    with pg.expect_download() as d: pg.click('#btn3mf')
    d.value.save_as('/tmp/claude-0/k.3mf'); z=zipfile.ZipFile('/tmp/claude-0/k.3mf'); m=z.read('3D/3dmodel.model').decode()
    r['3mf_objs']=re.findall(r'<object id="\d+" type="model" name="([^"]+)"',m)
    pg.select_option('#kcU','6.25'); time.sleep(1.5); r['info625']=pg.inner_text('#kcInfo')
    pg.screenshot(path='/tmp/claude-0/k2.png')
    pg.select_option('#preset','print3d'); time.sleep(1.5); r['off_after_preset']=not pg.is_checked('#kcOn')
    r['errs']=errs
    print(json.dumps(r,ensure_ascii=False,indent=1)); b.close()
