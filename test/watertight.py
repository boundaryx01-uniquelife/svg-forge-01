# 내보낸 STL 이 정말 닫혀 있는지 (슬라이서가 '모델 복구' 를 띄우지 않는지).
# 층마다 닫힌 솔리드를 쌓아 합치면 경계가 내부 면으로 남는다 — 그 회귀를 막는다.
# 치수도 같이 본다 (맞닿은 자리를 2µm 넓히는 보정이 크기를 흔들지 않아야 한다).
from playwright.sync_api import sync_playwright
import time, os, json, sys, trimesh

OUT = os.environ.get('WT_OUT', '/tmp/wt_out')
os.makedirs(OUT, exist_ok=True)
APP = 'file:///home/claude/svg-forge/dist/svg-forge.html'
bad = 0
def check(label, ok, extra=''):
    global bad
    if not ok: bad += 1
    print(f"{'OK ' if ok else '✗  '} {label}{'  ' + extra if extra else ''}")

def look(path):
    m = trimesh.load(path, force='mesh')
    bodies = m.split(only_watertight=False)
    return {'tri': len(m.faces), 'wt': bool(m.is_watertight),
            'broken': int(len(trimesh.repair.broken_faces(m))),
            'bodies': len(bodies), 'closed': sum(1 for x in bodies if x.is_watertight),
            'size': [round(float(v), 3) for v in m.extents]}

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1500, 'height': 900}, locale='ko-KR')
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(APP); time.sleep(2.5)

    def save(name):
        with pg.expect_download() as d:
            pg.click('#btnStl')
        f = os.path.join(OUT, name); d.value.save_as(f); return f

    cases = {}
    # 키캡 — 기본값과 안쪽 R 최대
    pg.click('#modeText'); time.sleep(1); pg.fill('#text', 'A'); time.sleep(2)
    pg.select_option('#preset', 'keycap'); time.sleep(4)
    cases['키캡 기본값'] = look(save('kc_default.stl'))
    pg.fill('#kcInnerR', '2.1'); time.sleep(3.5)
    cases['키캡 안쪽R 2.1'] = look(save('kc_innerR_max.stl'))

    # 몰드 — 본체 · 주조 · 성형
    pg.click('#modeImage'); time.sleep(1)
    chips = pg.eval_on_selector_all('#sampleRow .samp', 'e=>e.map(x=>x.querySelector("span").textContent)')
    pg.eval_on_selector_all('#sampleRow .samp', f'e=>e[{chips.index("유령")}].click()'); time.sleep(3)
    pg.select_option('#preset', 'mold'); time.sleep(4)
    cases['무늬 본체'] = look(save('mold_body.stl'))
    pg.check('#mdOn'); time.sleep(4)
    pg.select_option('#mdKind', 'cast'); time.sleep(4)
    cases['주조 몰드'] = look(save('mold_cast.stl'))
    pg.select_option('#mdKind', 'press'); time.sleep(4)
    cases['성형 틀'] = look(save('mold_press.stl'))
    pg.uncheck('#mdOn'); time.sleep(3)
    for kind in ['grid', 'tri', 'rings']:
        pg.select_option('#mpKind', kind); time.sleep(3.5)
        cases[f'무늬 {kind}'] = look(save(f'mold_{kind}.stl'))

    # 치수 — 50mm 사각형이 정확히 50.000 으로 나가야 (2µm 보정이 크기를 흔들면 안 됨)
    pg.click('#projNew'); time.sleep(1)
    try: pg.click('dialog button:has-text("확인")', timeout=1500)
    except Exception: pass
    time.sleep(2)
    pg.click('#modeText'); time.sleep(1); pg.fill('#text', '口'); time.sleep(2)
    pg.fill('#width', '50'); time.sleep(3)
    sq = look(save('square.stl'))
    cases['너비 50mm 글자'] = sq
    errors = errs
    b.close()

print(json.dumps(cases, ensure_ascii=False, indent=1))
for name, r in cases.items():
    check(f'{name} — 닫힌 메시', r['wt'] and r['broken'] == 0, f"broken {r['broken']} · 바디 {r['bodies']} (닫힘 {r['closed']})")
check('무늬 본체가 한 덩어리', cases['무늬 본체']['bodies'] == 1, f"{cases['무늬 본체']['bodies']}개")
check('성형 틀은 판·수틀·암틀 3덩어리', cases['성형 틀']['bodies'] == 3, f"{cases['성형 틀']['bodies']}개")
check('너비 50mm 가 그대로', abs(cases['너비 50mm 글자']['size'][0] - 50) < 0.01, f"{cases['너비 50mm 글자']['size'][0]}mm")
check('콘솔 오류 없음', not errors, str(errors[:2]))
print('\n실패 %d건' % bad if bad else '\n전부 통과')
sys.exit(1 if bad else 0)
