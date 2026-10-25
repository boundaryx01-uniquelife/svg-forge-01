# 키보드만으로 화면 전체를 돌 수 있는지 (버전 글씨에서 탭이 막히던 문제)
from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1280,'height':800}, locale='ko-KR')
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(2.5)
    seen=[]; stuck=0
    for i in range(60):
        pg.keyboard.press('Tab')
        cur=pg.evaluate("""()=>{const a=document.activeElement; if(!a) return 'none';
          if (a.id) return a.id;
          const sibs=[...(a.parentElement?a.parentElement.children:[])];
          return a.tagName+':'+sibs.indexOf(a)+':'+(a.textContent||'').trim().slice(0,8);}""")
        if seen and cur==seen[-1] and cur!='BODY': stuck+=1   # BODY = 브라우저 바깥으로 나간 것
        seen.append(cur)
    uniq=[]
    for s in seen:
        if not uniq or uniq[-1]!=s: uniq.append(s)
    # 변경 이력은 Enter 로 열려야 한다
    pg.evaluate("()=>document.querySelector('#appVer').focus()")
    pg.keyboard.press('Enter'); time.sleep(0.6)
    opened=pg.evaluate("()=>document.querySelector('#hist').open")
    pg.keyboard.press('Escape'); time.sleep(0.4)
    r={'거친_칸수':len(uniq), '연속정지':stuck, '처음10칸':uniq[:10],
       'Enter로_변경이력_열림':opened, '닫힘': not pg.evaluate("()=>document.querySelector('#hist').open"), 'errors':errs}
    ok={'탭이 막히지 않음': len(uniq)>=20 and stuck==0, 'Enter 로 변경 이력 열림': opened,
        'Esc 로 닫힘': r['닫힘'], '콘솔 오류 없음': not errs}
    r['판정']=ok
    print(json.dumps(r,ensure_ascii=False,indent=1)); b.close()
    import sys; sys.exit(0 if all(ok.values()) else 1)
