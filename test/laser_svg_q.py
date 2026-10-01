import time, pathlib, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path('/home/claude/svg-forge'); URL='file://'+str(ROOT/'dist/svg-forge.html')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_context(viewport={'width':1366,'height':657},locale='ko-KR',accept_downloads=True).new_page()
    pg.goto(URL); time.sleep(0.8)
    pg.click('#modeText'); pg.fill('#text','ABC가'); time.sleep(2.5)
    pg.wait_for_function("()=>!document.getElementById('btnLaser').disabled",timeout=30000)
    with pg.expect_download() as d: pg.click('#btnLaser')
    path=d.value.path(); svg=open(path,encoding='utf-8').read()
    cmds=set(re.findall(r'[A-Za-z]',re.sub(r'<[^>]*?\sd="([^"]*)"[^>]*>',lambda m:' '+m.group(1)+' ',svg.split('<svg',1)[1].split('>',1)[1])))
    print('commands:',sorted(cmds), 'bytes',len(svg), svg[:200].replace('\n',' '))
    print('btn labels:',pg.evaluate("()=>[btnLaser.textContent,btnDxf.textContent]"))
    b.close()
