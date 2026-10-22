# 새 작업 버튼: 작업을 비우고 첫 화면으로 · 새로고침해도 안 돌아와야
from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    c = b.new_context(viewport={'width':1366,'height':820}, locale='ko-KR')
    pg = c.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())      # 확인 창 수락
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html')
    pg.set_input_files('#file','in/logo.png'); time.sleep(3.5)
    r={'불러온뒤_상태': pg.inner_text('#status').split('\n')[0],
       '자동저장켜짐': pg.evaluate("()=>window.__svgforge.prefs.autosave")}
    time.sleep(2)   # 자동 저장(1.2초 지연) 기다림

    # 새로고침하면 작업이 되살아나는지 (지금 동작 확인)
    pg.reload(); time.sleep(4)
    r['새로고침_이어서하기버튼'] = pg.is_visible('.btn.resume')

    # 새 작업
    pg.click('#projNew'); time.sleep(4)
    r['새작업후_모델'] = pg.evaluate("()=>!!window.__svgforge.model")
    r['새작업후_이미지'] = pg.evaluate("()=>!!window.__svgforge.img")
    r['새작업후_편집내역'] = pg.evaluate("()=>window.__svgforge.edits.length")
    r['새작업후_상태'] = pg.inner_text('#status').split('\n')[0][:40]

    # 다시 새로고침해도 안 돌아와야
    pg.reload(); time.sleep(4)
    r['다시새로고침_모델'] = pg.evaluate("()=>!!window.__svgforge.model")
    r['다시새로고침_이어서하기없음'] = not pg.is_visible('.btn.resume')

    # 설정(창 기본값)은 남아 있어야
    r['설정유지_자동저장'] = pg.evaluate("()=>window.__svgforge.prefs.autosave")

    # 빈 화면에서 눌러도 확인 창 없이 조용히 넘어가야
    pg.click('#projNew'); time.sleep(3)
    r['빈화면에서_눌러도_정상'] = pg.evaluate("()=>!!document.querySelector('#projNew')")
    r['errors']=errs
    print(json.dumps(r, ensure_ascii=False, indent=1))
    b.close()
