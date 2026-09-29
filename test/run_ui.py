import sys, json, time, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path('/home/claude/svg-forge')
URL = 'file://' + str(ROOT / 'dist/svg-forge.html')
OUT = ROOT / 'test/out'
OUT.mkdir(exist_ok=True, parents=True)

def wait_done(page, timeout=30000):
    time.sleep(0.9)
    page.wait_for_function("() => { const s=document.getElementById('status'); return s && s.innerText.trim() !== '' && !s.innerText.includes('처리 중'); }", timeout=timeout)

def save_dl(page, btn, name):
    with page.expect_download(timeout=30000) as d:
        page.click(btn)
    p = OUT / name
    d.value.save_as(p)
    return p

def run():
    logs = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        page = b.new_page(viewport={'width': 1400, 'height': 900})
        page.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
        page.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        page.goto(URL)
        time.sleep(0.5)
        page.screenshot(path=str(OUT / 'shot_empty.png'))

        # --- 1) 흑백 로고 ---
        page.set_input_files('#file', str(ROOT / 'test/in/logo.png'))
        wait_done(page)
        page.fill('#width', '60')
        wait_done(page)
        print('logo status:', page.inner_text('#status').replace('\n', ' | '))
        page.screenshot(path=str(OUT / 'shot_logo_2d.png'))
        save_dl(page, '#btnFill', 'logo_makerlab.svg')
        save_dl(page, '#btnLaser', 'logo_laser.svg')
        save_dl(page, '#btnDxf', 'logo.dxf')
        save_dl(page, '#btnStl', 'logo.stl')
        page.click('#tab3d')
        time.sleep(1.0)
        page.screenshot(path=str(OUT / 'shot_logo_3d.png'))
        page.click('#tab2d')

        # --- 2) 3색 ---
        page.set_input_files('#file', str(ROOT / 'test/in/multi.png'))
        wait_done(page)
        page.select_option('#colors', '4')
        wait_done(page)
        print('multi status:', page.inner_text('#status').replace('\n', ' | '))
        page.screenshot(path=str(OUT / 'shot_multi_2d.png'))
        save_dl(page, '#btnFill', 'multi_makerlab.svg')
        page.fill('#step', '1')
        save_dl(page, '#btnStl', 'multi.stl')
        save_dl(page, '#btnDxf', 'multi.dxf')

        # --- 3) 투명 PNG ---
        page.select_option('#colors', '1')
        page.set_input_files('#file', str(ROOT / 'test/in/transparent.png'))
        wait_done(page)
        print('transparent status:', page.inner_text('#status').replace('\n', ' | '))
        save_dl(page, '#btnFill', 'transparent_makerlab.svg')

        # --- 4) SVG 입력 ---
        page.set_input_files('#file', str(ROOT / 'test/in/lines.svg'))
        wait_done(page)
        print('svg-in status:', page.inner_text('#status').replace('\n', ' | '))
        save_dl(page, '#btnFill', 'lines_makerlab.svg')

        # --- 5) 텍스트 ---
        page.click('#modeText')
        page.fill('#text', '김철수\n열쇠고리 ABC 123')
        wait_done(page)
        print('text status:', page.inner_text('#status').replace('\n', ' | '), '| msg:', page.inner_text('#msg'))
        page.screenshot(path=str(OUT / 'shot_text_2d.png'))
        save_dl(page, '#btnFill', 'text_makerlab.svg')
        save_dl(page, '#btnDxf', 'text.dxf')
        save_dl(page, '#btnStl', 'text.stl')
        page.click('#tab3d')
        time.sleep(1.0)
        page.screenshot(path=str(OUT / 'shot_text_3d.png'))
        b.close()
    print('--- console ---')
    for l in logs:
        print(l)

run()
