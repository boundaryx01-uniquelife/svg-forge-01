# 자유 모드에서 기능을 켜면 모드가 자동으로 바뀌는지.
# 중요: 모드가 바뀌면서 사용자가 켜 둔 다른 항목이 초기화되면 안 된다.
from playwright.sync_api import sync_playwright
import time, json

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1366, 'height': 820}, locale='ko-KR')
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/svg-forge/dist/svg-forge.html')
    pg.set_input_files('#file', 'in/logo.png')
    time.sleep(3)
    mode = lambda: pg.evaluate("()=>document.body.dataset.mode")
    pre = lambda: pg.eval_on_selector('#preset', 'e=>e.value')
    r = {'처음_모드': mode()}

    def free():
        pg.select_option('#preset', '')
        time.sleep(1.5)
        for cb in ['#mpOn', '#kcOn', '#ringOn', '#baseOn']:
            if pg.is_checked(cb):
                pg.uncheck(cb); time.sleep(0.8)
        time.sleep(1)

    # ── 패턴 채우기 → 몰드 ──
    free()
    r['자유_확인'] = (pre(), mode())
    pg.check('#mpOn'); time.sleep(2.5)
    r['패턴켬'] = (pre(), mode())
    r['패턴켬_안내'] = '몰드' in pg.inner_text('#msg')

    # ── 키캡 ──
    free()
    pg.check('#kcOn'); time.sleep(2.5)
    r['키캡켬'] = (pre(), mode())

    # ── 키링 고리 (받침판이 켜져 있어야 고를 수 있음) ──
    free()
    pg.check('#baseOn'); time.sleep(1.8)
    r['고리_켜기전'] = (pre(), mode())
    pg.check('#ringOn'); time.sleep(2.5)
    r['고리켬'] = (pre(), mode())

    # ── 다른 항목이 초기화되지 않아야 ──
    free()
    pg.check('#baseOn'); time.sleep(1.5)       # 받침판을 먼저 켜 두고
    pg.fill('#width', '70'); time.sleep(2)
    pg.check('#mpOn'); time.sleep(2.5)
    r['전환후_받침판유지'] = pg.is_checked('#baseOn')
    r['전환후_너비유지'] = pg.input_value('#width')
    r['전환후_모드'] = mode()

    # ── 이미 모드가 정해져 있으면 바꾸지 않아야 ──
    # 다른 모드에서는 이 체크박스들이 아예 숨겨져 있어 눌릴 일이 없다 → 코드로 강제 발생시켜 확인
    pg.select_option('#preset', 'keyring'); time.sleep(2.5)
    before = (pre(), mode())
    pg.evaluate("()=>{const e=document.querySelector('#mpOn');e.checked=true;e.dispatchEvent(new Event('change'))}")
    time.sleep(2.5)
    r['키링에서_패턴강제'] = {'전': before, '후': (pre(), mode()), '유지됨': pre() == 'keyring'}
    pg.evaluate("()=>{const e=document.querySelector('#mpOn');e.checked=false;e.dispatchEvent(new Event('change'))}")
    time.sleep(1.5)

    # ── 끌 때는 모드가 바뀌지 않아야 ──
    free()
    pg.check('#mpOn'); time.sleep(2.5)
    pg.uncheck('#mpOn'); time.sleep(2)
    r['패턴끔_모드'] = (pre(), mode())   # 몰드에 그대로 머물러야 (제멋대로 자유로 돌아가면 안 됨)

    r['errors'] = errs
    print(json.dumps(r, ensure_ascii=False, indent=1))
    b.close()
