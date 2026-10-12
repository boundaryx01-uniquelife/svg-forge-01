from playwright.sync_api import sync_playwright
import time, json
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader']); pg=b.new_page(viewport={'width':1366,'height':760},locale='ko-KR')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html'); pg.set_input_files('#file','in/logo.png'); time.sleep(3)
    cols=lambda: pg.inner_text('#status').split('\n')
    def scr(x,y):
        return pg.evaluate(f"()=>{{const s=document.querySelector('#view2d svg');const p=new DOMPoint({x},{y}).matrixTransform(s.getScreenCTM());return [p.x,p.y]}}")
    r={'bar':pg.is_visible('#bucketBar')}
    # 모델 좌표: 도넛 링, 도넛 구멍(흰), 별
    m=pg.evaluate("()=>{const m=__svgforge.model;return m.layers[0].items.map(it=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const [x,y] of it.poly){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}return [it.hole,x0,y0,x1,y1]})}")
    big=[q for q in m if not q[0]]; big.sort(key=lambda q:-(q[3]-q[1])*(q[4]-q[2]))
    donut=big[0] if (big[0][3]-big[0][1])<(big[0][4]-big[0][2])*1.5 else big[1]
    pg.click('#bucketBtn'); pg.click('#bucketCol + button.swbtn'); pg.click('.tilepop .tile:nth-child(14)'); time.sleep(.3)
    r['on']=pg.evaluate("()=>document.querySelector('#bucketBtn').classList.contains('on')")
    # 도넛 링 칠하기 (왼쪽 가장자리 안쪽)
    x,y=scr(donut[1]+(donut[3]-donut[1])*0.07,(donut[2]+donut[4])/2); pg.mouse.click(x,y); time.sleep(1.5); r['ring']=cols()[3:6]
    # 도넛 구멍(링과 가운데 점 사이) 칠하기
    pg.click('#bucketCol + button.swbtn'); pg.click('.tilepop .tile:nth-child(8)'); time.sleep(.2)
    x,y=scr(donut[1]+(donut[3]-donut[1])*0.33,(donut[2]+donut[4])/2); pg.mouse.click(x,y); time.sleep(1.5); r['hole']=cols()[3:7]
    pg.screenshot(path='/tmp/claude-0/bk.png')
    pg.keyboard.press('Control+z'); time.sleep(1.2); r['undo']=cols()[3:7]
    # 텍스트 모드
    pg.click('#modeText'); pg.fill('#text','AB'); time.sleep(2)
    r['tbar']=pg.is_visible('#bucketBar')
    c=pg.evaluate("()=>{const s=document.querySelector('#view2d svg');const m=__svgforge.model;const ch=m.chars[0];const {s:k,x0,y0}=m.xf;const p=new DOMPoint((ch.box[0]+ch.box[2])/2*1,0);return null}")
    bb=pg.evaluate("()=>{const r=document.querySelector('#view2d svg').getBoundingClientRect();return [r.left+r.width*0.38,r.top+r.height*0.5]}")
    if not pg.evaluate("()=>document.querySelector('#bucketBtn').classList.contains('on')"): pg.click('#bucketBtn')
    pg.mouse.click(bb[0],bb[1]); time.sleep(1.5); r['tcols']=pg.inner_text('#status').split('\n')[3:6]
    r['errs']=errs
    print(json.dumps(r,ensure_ascii=False)); b.close()
