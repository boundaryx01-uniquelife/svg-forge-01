from playwright.sync_api import sync_playwright
import time, json, zipfile, re
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR',accept_downloads=True)
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(1)
    pg.click('#modeText'); pg.fill('#text','A'); time.sleep(1.5)
    pg.select_option('#preset','keycap'); time.sleep(2.5)
    def zr(name):
        with pg.expect_download() as d: pg.click('#btn3mf')
        d.value.save_as('/tmp/claude-0/kh.3mf'); m=zipfile.ZipFile('/tmp/claude-0/kh.3mf').read('3D/3dmodel.model').decode()
        out={}
        for mm in re.finditer(r'<object id="\d+" type="model" name="([^"]+)"[^>]*>\s*<mesh>\s*<vertices>(.*?)</vertices>',m,re.S):
            zs=[float(z) for z in re.findall(r'z="([-\d.]+)"',mm.group(2))]; out[mm.group(1)]=(min(zs),max(zs))
        return out
    r={'base':zr('x')}
    inp=pg.query_selector('#colorHeights input'); inp.fill('0.4'); inp.dispatch_event('input'); time.sleep(1.5)
    r['legend_plus0.4']=zr('x')
    pg.select_option('#kcStem','floor'); time.sleep(1.5); r['stem_floor']=zr('x').get('스템')
    r['errs']=errs; print(json.dumps(r,ensure_ascii=False,indent=1)); b.close()
