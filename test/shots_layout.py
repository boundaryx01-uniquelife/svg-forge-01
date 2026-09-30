import time
from playwright.sync_api import sync_playwright
U='file:///home/claude/svg-forge/dist/svg-forge.html'
with sync_playwright() as p:
    b=p.chromium.launch()
    for (w,h) in [(1920,1000),(1366,657),(1280,720),(1024,700)]:
        page=b.new_page(viewport={'width':w,'height':h})
        errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
        page.goto(U); time.sleep(0.4)
        if (w,h)==(1366,657): page.screenshot(path='test/out/lay_empty.png')
        page.set_input_files('#file','/home/claude/svg-forge/test/in/user_uniquelife.png'); time.sleep(1.5)
        # 스크롤 필요 여부: 문서 및 패널
        info=page.evaluate("""()=>{const d=document.scrollingElement; const r={doc:[d.scrollHeight,d.clientHeight,d.scrollWidth,d.clientWidth]};
          for(const id of ['panelIn','panelOut']){const e=document.getElementById(id); r[id]=[e.scrollHeight,e.clientHeight];}
          const vis=[...document.querySelectorAll('#btnFill,#btnLaser,#btnDxf,#btnStl,#thick,#colorHeights,#preset,#width')].map(e=>{const b=e.getBoundingClientRect();return e.id+':'+(b.bottom<=innerHeight&&b.right<=innerWidth&&b.width>0?'ok':'HIDDEN')});
          r.vis=vis.join(' '); return r;}""")
        print((w,h), info, errs)
        page.screenshot(path=f'test/out/lay_{w}x{h}.png')
        page.click('#modeText'); time.sleep(0.8)
        info=page.evaluate("()=>{const e=document.getElementById('panelIn');return [e.scrollHeight,e.clientHeight]}")
        print('   text mode panelIn', info)
        if (w,h)==(1366,657): page.screenshot(path='test/out/lay_text.png')
        page.close()
    b.close()
