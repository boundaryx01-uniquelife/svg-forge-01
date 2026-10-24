# 조각 배치: 무늬를 깐 뒤 떨어진 조각을 끌어 옮긴다 (편집과 따로 도는지)
from playwright.sync_api import sync_playwright
import time, json

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1500,'height':900}, locale='ko-KR')
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(2.5)
    chips = pg.eval_on_selector_all('#sampleRow .samp','e=>e.map(x=>x.querySelector("span").textContent)')
    pg.eval_on_selector_all('#sampleRow .samp', f'e=>e[{chips.index("박쥐")}].click()'); time.sleep(4)
    pg.select_option('#preset','mold'); time.sleep(4); pg.click('#tab2d'); time.sleep(2)
    r = {'바_처음': pg.is_visible('#arrBar')}
    # ✂ 나누기: 무늬를 잠깐 끄고 끊기 모드로 바꿔 준다
    pg.click('#arrBtn'); time.sleep(3)
    r['한덩어리_안내'] = pg.inner_text('#arrInfo')
    pg.click('#arrSplit'); time.sleep(3)
    r['나누기'] = {'무늬꺼짐': not pg.is_checked('#mpOn'), '끊기켬': pg.eval_on_selector('#edCut','e=>e.classList.contains("on")')}
    pg.check('#mpOn'); time.sleep(3.5)
    # 날개를 몸통에서 끊는다 (✂ 끊기와 같은 편집)
    pg.evaluate("""()=>{const m=__svgforge.silModel||__svgforge.model, w0=m.baseW||m.width;
      for (const x of [29,61]) __svgforge.edits.push({t:'cut',w0,c:null,i:null,a:[x,-2],b:[x,m.height+2],w:0.8});
      __svgforge.editsKey=__svgforge.traceKey; window.__edit({t:'minw',v:0});}"""); time.sleep(5)

    pg.click('#arrBtn'); time.sleep(3.5)
    r['조각수'] = pg.evaluate("()=>__svgforge.groups.length")
    r['배치중_편집바숨김'] = not pg.is_visible('#editbar')
    before = pg.evaluate("()=>__svgforge.groups.map(g=>[+g.c[0].toFixed(1),+g.c[1].toFixed(1)])")

    # 가장 왼쪽 조각을 아래로 끌어 내린다
    box = pg.locator('#view2d').bounding_box()
    pt = pg.evaluate("""()=>{const sv=document.querySelector('#view2d svg'), m=sv.getScreenCTM();
      const g=__svgforge.groups.slice().sort((a,b)=>a.c[0]-b.c[0])[0];
      const q=new DOMPoint(g.c[0],g.c[1]).matrixTransform(m); return {x:q.x,y:q.y,c:g.c};}""")
    pg.mouse.move(pt['x'], pt['y']); pg.mouse.down()
    pg.mouse.move(pt['x'], pt['y']+120, steps=8); time.sleep(0.3)
    r['끄는중_미리보기'] = pg.eval_on_selector_all('#view2d svg path.arrhi','e=>e.length') == 1
    pg.mouse.up(); time.sleep(4)
    r['기록'] = pg.evaluate("()=>__svgforge.layout.length")
    r['끈뒤_크기'] = pg.evaluate("()=>[+__svgforge.model.width.toFixed(1),+__svgforge.model.height.toFixed(1)]")
    after = pg.evaluate("()=>__svgforge.groups.map(g=>[+g.c[0].toFixed(1),+g.c[1].toFixed(1)])")
    r['움직임'] = {'전': before, '후': after}

    # 같은 조각을 또 끌면 기록이 늘지 않고 더해져야
    pt2 = pg.evaluate("""()=>{const sv=document.querySelector('#view2d svg'), m=sv.getScreenCTM();
      const g=__svgforge.groups.slice().sort((a,b)=>a.c[0]-b.c[0])[0];
      const q=new DOMPoint(g.c[0],g.c[1]).matrixTransform(m); return {x:q.x,y:q.y};}""")
    pg.mouse.move(pt2['x'], pt2['y']); pg.mouse.down(); pg.mouse.move(pt2['x']+40, pt2['y'], steps=6); pg.mouse.up(); time.sleep(4)
    r['두번째_기록'] = pg.evaluate("()=>__svgforge.layout.length")

    # 되돌리기(Ctrl+Z)로 배치도 복구되는지
    pg.keyboard.press('Control+z'); time.sleep(4)
    r['undo_기록'] = pg.evaluate("()=>__svgforge.layout.length")

    # 처음 자리
    pg.click('#arrReset'); time.sleep(3.5)
    r['초기화'] = pg.evaluate("()=>[__svgforge.layout.length, +__svgforge.model.width.toFixed(1)]")
    # 무늬를 끄면 배치 도구도 꺼지고 바가 숨는다
    pg.uncheck('#mpOn'); time.sleep(3)
    r['무늬끔'] = {'arrange': pg.evaluate("()=>__svgforge.arrange"), '바': pg.is_visible('#arrBar')}
    r['errors'] = errs
    ok = {
      '한 덩어리면 나누라고 안내': '나누기' in r['한덩어리_안내'],
      '✂ 나누기가 무늬를 끄고 끊기를 켬': r['나누기']['무늬꺼짐'] and r['나누기']['끊기켬'],
      '조각이 여러 개로 잡힘': r['조각수'] >= 3,
      '배치 중 편집바 숨김': r['배치중_편집바숨김'],
      '끄는 중 미리보기': r['끄는중_미리보기'],
      '끌면 기록 1건': r['기록'] == 1,
      '같은 조각 또 끌어도 1건': r['두번째_기록'] == 1,
      '되돌리기로 복구': r['undo_기록'] == 1,
      '처음 자리로': r['초기화'][0] == 0,
      '무늬 끄면 배치도 꺼짐': not r['무늬끔']['arrange'] and not r['무늬끔']['바'],
      '콘솔 오류 없음': not errs,
    }
    r['판정'] = ok
    print(json.dumps(r, ensure_ascii=False, indent=1)); b.close()
    import sys; sys.exit(0 if all(ok.values()) else 1)
