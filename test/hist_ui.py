# 변경 이력 창: 버전 글씨를 누르면 열리고, CHANGELOG 가 끼워져 있는지
from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1400,'height':880}, locale='ko-KR')
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html')
    time.sleep(2)
    r={'버전글씨': pg.inner_text('#appVer')}
    pg.click('#appVer'); time.sleep(1)
    r['창열림']=pg.is_visible('#hist')
    r['제목']=pg.inner_text('#hist h3')
    r['항목수']=pg.evaluate("()=>document.querySelectorAll('#hist .histbody li').length")
    r['소제목']=pg.evaluate("()=>[...document.querySelectorAll('#hist .histbody h4')].slice(0,6).map(e=>e.textContent)")
    
    pg.click('#hist button[value=ok]'); time.sleep(0.6)
    r['닫힘']=not pg.is_visible('#hist')
    r['WORKLOG안내']='WORKLOG' in pg.inner_text('#hist')
    r['항목충분']=r['항목수']>=20
    r['errors']=errs
    print(json.dumps(r, ensure_ascii=False, indent=1))
    b.close()
