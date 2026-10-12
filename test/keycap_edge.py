from playwright.sync_api import sync_playwright
import time, json, struct
def check(path):
    d=open(path,'rb').read(); n=struct.unpack('<I',d[80:84])[0]; E={}; vol=0
    def k(v): return tuple(round(x,3) for x in v)
    for i in range(n):
        o=84+i*50; v=[struct.unpack('<3f',d[o+12+j*12:o+24+j*12]) for j in range(3)]
        a,b,c=v; vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
        ks=[k(x) for x in v]
        for q in range(3): E[(ks[q],ks[(q+1)%3])]=E.get((ks[q],ks[(q+1)%3]),0)+1
    return n, round(vol,1)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR',accept_downloads=True)
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(1)
    pg.click('#modeText'); pg.fill('#text','B8'); time.sleep(1.5)
    pg.select_option('#preset','keycap'); time.sleep(2)
    r={}
    for mode in ['emboss','engrave','inlay']:
        for et in ['none','chamfer','fillet']:
            pg.select_option('#kcMode',mode); pg.select_option('#kcEdge',et); time.sleep(1.2)
            with pg.expect_download() as d: pg.click('#btnStl')
            path=f'/tmp/claude-0/ke_{mode}_{et}.stl'; d.value.save_as(path); r[f'{mode}/{et}']=check(path)
    pg.select_option('#kcMode','emboss'); pg.select_option('#kcEdge','fillet'); time.sleep(1.5); pg.click('#homeBtn'); time.sleep(1)
    pg.screenshot(path='/tmp/claude-0/ke1.png',clip={'x':310,'y':95,'width':780,'height':600})
    pg.select_option('#kcMode','engrave'); time.sleep(1.5)
    pg.screenshot(path='/tmp/claude-0/ke2.png',clip={'x':310,'y':95,'width':780,'height':600})
    r['errs']=errs; print(json.dumps(r,ensure_ascii=False,indent=1)); b.close()
