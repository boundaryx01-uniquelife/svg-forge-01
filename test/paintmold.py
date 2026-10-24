# 몰드에서 칠한 색은 무늬에 먹히지 않고, 트레이싱으로 갈린 색은 무늬가 깔린다.
# (무늬 범위 기본값 '칠한 곳만 남기고')
from playwright.sync_api import sync_playwright
import time, json

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1400,'height':880}, locale='ko-KR')
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); time.sleep(2.5)
    chips = pg.eval_on_selector_all('#sampleRow .samp','els=>els.map(e=>e.querySelector("span").textContent)')
    pick = lambda n: pg.eval_on_selector_all('#sampleRow .samp', f'els=>els[{chips.index(n)}].click()')
    lay  = lambda: pg.evaluate("()=>window.__svgforge.model.layers.map(l=>l.color)")
    r = {}

    # 1) 박쥐: 트레이싱 회색 날개 → 무늬가 깔려야 (회색 레이어가 남지 않음)
    pg.select_option('#preset','mold'); time.sleep(2.5)
    pick('박쥐'); time.sleep(4)
    r['박쥐_기본'] = {'범위': pg.eval_on_selector('#mpKeep','e=>e.value'), '레이어': lay()}
    pg.select_option('#mpKeep','color'); time.sleep(3.5)
    r['박쥐_색마다'] = lay()
    pg.select_option('#mpKeep','painted'); time.sleep(3)

    # 2) 유령 눈을 빨강으로 칠하면 기본값에서도 제 색으로 남아야
    pick('유령'); time.sleep(4)
    # 왼쪽 눈 구멍 한가운데를 칠한다 (모델에서 눈 위치를 읽어 좌표를 만든다)
    pg.evaluate("""()=>{
      const S=window.__svgforge, m=S.silModel||S.model;   // 무늬를 켜면 집는 대상은 실루엣
      const holes=m.layers.flatMap(l=>l.items).filter(it=>it.hole);
      const c=holes.map(it=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
        for(const q of it.poly){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}
        return {c:[(x0+x1)/2,(y0+y1)/2], a:(x1-x0)*(y1-y0)};});
      c.sort((a,b)=>b.a-a.a);                              // 가장 큰 구멍 = 눈
      window.__eye=c[0].c;
      window.__edit({t:'fill',x:window.__eye[0],y:window.__eye[1],to:'#e03131',w0:m.width});
    }"""); time.sleep(4)
    r['유령_눈칠'] = {'눈': pg.evaluate("()=>window.__eye"), '레이어': lay()}
    r['빨강_남음'] = '#e03131' in lay()
    pg.select_option('#mpKeep','none'); time.sleep(3.5)
    r['전체_면_빨강'] = '#e03131' in lay()
    r['errors'] = errs
    ok = {
        '트레이싱 색엔 무늬가 깔림': '#9a9a9a' not in r['박쥐_기본']['레이어'],
        "'색마다 따로' 면 제 색으로": '#9a9a9a' in r['박쥐_색마다'],
        '칠한 색은 기본값에서도 남음': r['빨강_남음'],
        "'전체' 면 칠한 색에도 무늬": not r['전체_면_빨강'],
        '콘솔 오류 없음': not errs,
    }
    r['판정'] = ok
    print(json.dumps(r, ensure_ascii=False, indent=1))
    b.close()
    import sys; sys.exit(0 if all(ok.values()) else 1)
