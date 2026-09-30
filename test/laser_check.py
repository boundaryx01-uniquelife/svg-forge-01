# 레이저: 절단 폭 보정 크기, 색상별 새김/제외, DXF 감사
import time, pathlib, re, ezdxf
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); OUT=ROOT/'test/out'
URL='file://'+str(ROOT/'dist/svg-forge.html')
def wait(pg):
    time.sleep(1.2); pg.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}",timeout=60000)
def dl(pg,sel,name):
    with pg.expect_download() as d: pg.click(sel)
    d.value.save_as(str(OUT/name)); return (OUT/name).read_text(errors='ignore')
r={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR',accept_downloads=True).new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); time.sleep(0.8)
    pg.set_input_files('#file',str(ROOT/'test/in/multi.png')); wait(pg)
    pg.select_option('#colors','4'); wait(pg)
    s0=dl(pg,'#btnLaser','l0.svg'); d0=dl(pg,'#btnDxf','l0.dxf')
    pg.fill('#kerf','0.2'); pg.dispatch_event('#kerf','input')
    s1=dl(pg,'#btnLaser','l1.svg'); d1=dl(pg,'#btnDxf','l1.dxf')
    # 색상별 작업: 첫 색 새김, 마지막 색 제외
    pg.click('#laserOpsBtn'); time.sleep(0.3)
    sels=pg.locator('#laserRows select'); n=sels.count()
    sels.nth(0).select_option('engrave'); sels.nth(n-1).select_option('skip')
    pg.click('#laserDlg button.pri'); time.sleep(0.3)
    s2=dl(pg,'#btnLaser','l2.svg'); d2=dl(pg,'#btnDxf','l2.dxf')
    r['errors']=errs; r['n']=n
def bbox_dxf(path):
    doc=ezdxf.readfile(str(path)); xs=[];ys=[]
    for e in doc.modelspace():
        if e.dxftype()=='POLYLINE':
            for v in e.vertices: xs.append(v.dxf.location.x); ys.append(v.dxf.location.y)
    return (max(xs)-min(xs), max(ys)-min(ys)), sorted({e.dxf.layer for e in doc.modelspace()})
b0,l0=bbox_dxf(OUT/'l0.dxf'); b1,l1=bbox_dxf(OUT/'l1.dxf'); b2,l2=bbox_dxf(OUT/'l2.dxf')
print('kerf 0   ', [round(v,3) for v in b0], l0)
print('kerf 0.2 ', [round(v,3) for v in b1], l1)
print('ops      ', [round(v,3) for v in b2], l2)
print('svg engrave fill:', 'fill-rule="evenodd" stroke="none"' in s2, '| skip removed layers:', s2.count('<path'), 'of', s0.count('<path'))
print('audit', len(ezdxf.readfile(str(OUT/'l1.dxf')).audit().errors), len(ezdxf.readfile(str(OUT/'l2.dxf')).audit().errors))
grew = b1[0]-b0[0]
ok = abs(b1[0]-50.2)<0.02 and abs(b1[1]-19.48)<0.02 and any(x.startswith('ENGRAVE') for x in l2) and s2.count('<path')==s0.count('<path')-1 and not r['errors']
print(r['errors'], 'OK' if ok else 'FAIL')
