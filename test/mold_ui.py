# 몰드·패턴 모드: 모드 전환 → 패턴 적용 → 무늬 바꿔보기 → STL 저장까지
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
    st = lambda: pg.inner_text('#status').split('\n')[0]
    r = {'원본': st()}

    # 몰드 모드로
    pg.select_option('#preset', 'mold')
    time.sleep(2.5)
    r['모드색'] = pg.evaluate("()=>getComputedStyle(document.body).getPropertyValue('--pri').trim()")
    r['패턴켜짐'] = pg.is_checked('#mpOn')
    r['패널보임'] = pg.is_visible('#mpOpts')
    r['편집도구숨김'] = not pg.is_visible('#editbar')
    r['거미줄'] = st()
    r['안내'] = pg.inner_text('#mpInfo')

    # 무늬 바꿔 보기
    for kind in ['grid', 'tri', 'rings', 'hatch', 'spokes']:
        pg.select_option('#mpKind', kind)
        time.sleep(1.6)
        r[kind] = st()

    # 줄 수 칸은 격자류에서 숨겨져야
    pg.select_option('#mpKind', 'grid'); time.sleep(1.2)
    r['격자_줄수숨김'] = not pg.is_visible('#mpSpokesRow')
    pg.select_option('#mpKind', 'web'); time.sleep(1.6)
    r['거미줄_줄수보임'] = pg.is_visible('#mpSpokesRow')

    # 선 폭을 0.3으로 → 가는 부분 경고가 떠야 함
    pg.fill('#mpW', '0.3'); time.sleep(2.0)
    r['가는선경고'] = '출력이 잘 안' in pg.inner_text('#msg')
    pg.fill('#mpW', '1.2'); time.sleep(1.8)

    # 벽 폭을 아주 크게 → 안쪽이 없다는 안내
    pg.fill('#mpWall', '30'); time.sleep(2.0)
    r['벽과다안내'] = pg.inner_text('#mpInfo')[:30]
    pg.fill('#mpWall', '2'); time.sleep(1.8)

    pg.screenshot(path='/tmp/claude-0/mold_ui.png')

    # 3D 전환 + STL 저장
    pg.click('#tab3d'); time.sleep(3)
    pg.screenshot(path='/tmp/claude-0/mold_3d.png')
    with pg.expect_download(timeout=30000) as dl:
        pg.click('#btnStl')
    f = dl.value
    path = '/tmp/claude-0/mold.stl'
    f.save_as(path)
    import os
    r['STL_KB'] = round(os.path.getsize(path) / 1024)

    # 자유 모드: 패턴은 쓰던 대로 두되, 패널이 보여야 끌 수 있음
    pg.click('#tab2d'); time.sleep(1)
    pg.select_option('#preset', ''); time.sleep(2)
    r['자유_패널보임'] = pg.is_visible('#mpOpts')
    r['자유_패턴유지'] = pg.is_checked('#mpOn')
    # 패턴을 끄면 원래 도형과 편집 도구가 돌아와야
    pg.uncheck('#mpOn'); time.sleep(2)
    r['끈뒤_도형'] = st()
    r['끈뒤_편집도구'] = pg.is_visible('#editbar')

    # 다른 모드(키캡)로 가면 패턴이 자동으로 꺼져야
    pg.check('#mpOn'); time.sleep(1.8)
    pg.select_option('#preset', 'keycap'); time.sleep(2.5)
    r['키캡전환_패턴꺼짐'] = not pg.is_checked('#mpOn')

    # ── 음각 몰드 ──
    pg.select_option('#preset', 'mold'); time.sleep(2.5)
    pg.check('#mdOn'); time.sleep(1)
    r['몰드패널'] = pg.is_visible('#mdOpts')
    pg.click('#tab3d'); time.sleep(3.5)
    r['나란히_파트'] = pg.inner_text('#badge3d') if pg.query_selector('#badge3d') else ''
    pg.screenshot(path='/tmp/claude-0/mold_set.png')
    with pg.expect_download(timeout=40000) as dl:
        pg.click('#btnStl')
    import os
    dl.value.save_as('/tmp/claude-0/mold_set.stl')
    r['세트STL_KB'] = round(os.path.getsize('/tmp/claude-0/mold_set.stl') / 1024)
    # 몰드만
    pg.select_option('#mdOut', 'mold'); time.sleep(3)
    pg.screenshot(path='/tmp/claude-0/mold_only.png')
    with pg.expect_download(timeout=40000) as dl2:
        pg.click('#btnStl')
    dl2.value.save_as('/tmp/claude-0/mold_only.stl')
    r['몰드만STL_KB'] = round(os.path.getsize('/tmp/claude-0/mold_only.stl') / 1024)
    r['몰드만_더작음'] = r['몰드만STL_KB'] < r['세트STL_KB']

    r['errors'] = errs
    print(json.dumps(r, ensure_ascii=False, indent=1))
    b.close()
