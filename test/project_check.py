# 프로젝트 저장→새로 열기→불러오기 동일성, TTC 폰트, 자동저장 이어하기, 언어 전환(한글 잔존) 검사
import time, json, pathlib, re
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path('/home/claude/svg-forge'); OUT = ROOT/'test/out'; OUT.mkdir(exist_ok=True)
URL = 'file://' + str(ROOT/'dist/svg-forge.html')
TTC = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'

def wait(page):
    time.sleep(1.0)
    page.wait_for_function("()=>{const s=document.getElementById('status').innerText;return s.trim()!=='' && !/처리 중|Processing/.test(s)}", timeout=60000)
def sig(page):
    return page.evaluate("()=>{const m=__svgforge.model; return m? JSON.stringify([m.width.toFixed(3),m.height.toFixed(3),m.ringCount,m.nodeCount,m.layers.map(l=>l.color)]):null}")
def svg(page):
    with page.expect_download() as d: page.click('#btnFill')
    p = OUT/'tmp.svg'; d.value.save_as(p); return p.read_text()
def m3f(page):
    return page.evaluate("()=>document.getElementById('badge3d').textContent")

res = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width':1366,'height':657}, locale='ko-KR')
    page = ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL); time.sleep(0.8)
    # 1) 이미지 프로젝트: 다색 + 설정 변경 + 높이 + 받침 + 고리 이동
    page.set_input_files('#file', str(ROOT/'test/in/multi.png')); wait(page)
    page.select_option('#colors','3'); wait(page)
    page.fill('#width','72'); page.select_option('#res','1200'); wait(page)
    page.evaluate("()=>{document.querySelectorAll('#colorHeights input').forEach((e,i)=>{e.value=(i*0.6-0.4).toFixed(1); e.dispatchEvent(new Event('input'))})}")
    page.check('#baseOn'); page.check('#ringOn'); page.fill('#ringDx','3.5'); page.dispatch_event('#ringDx','input')
    page.select_option('#edgeType','fillet'); time.sleep(1.5)
    s1 = sig(page); v1 = svg(page); b1 = m3f(page)
    with page.expect_download() as d: page.click('#projSave')
    proj = OUT/'multi.svgforge'; d.value.save_as(proj)
    res['proj_kb'] = round(proj.stat().st_size/1024,1)
    time.sleep(1.5)  # 자동 저장
    # 새 창에서 파일 불러오기
    page2 = ctx.new_page(); page2.on('pageerror', lambda e: errs.append(str(e)))
    page2.goto(URL); time.sleep(1.2)
    res['resume_button'] = page2.locator('.resume').count()
    page2.set_input_files('#projFile', str(proj)); wait(page2); time.sleep(1.5)
    res['img_same_model'] = sig(page2)==s1
    res['img_same_svg'] = svg(page2)==v1
    res['img_same_3d'] = (m3f(page2)==b1, b1, m3f(page2))
    res['vals'] = page2.evaluate("()=>[width.value,res.value,colors.value,ringDx.value,edgeType.value,baseOn.checked,[...document.querySelectorAll('#colorHeights input')].map(e=>e.value).join(',')]")
    page2.close()
    # 이어서 하기 (자동 저장)
    page3 = ctx.new_page(); page3.goto(URL); time.sleep(1.2)
    page3.click('.resume'); wait(page3); time.sleep(1)
    res['resume_same'] = sig(page3)==s1
    page3.close()
    # 2) TTC 폰트 + 글자 프로젝트
    page.click('#modeText'); page.fill('#text','你好 ABC'); 
    page.set_input_files('#fontFile', TTC); wait(page)
    res['fonts'] = page.evaluate("()=>[...fontSel.options].map(o=>o.text)")
    res['font_msg'] = page.inner_text('#msg')
    s2 = sig(page); v2 = svg(page)
    page.click('#fontDefault')
    with page.expect_download() as d: page.click('#projSave')
    proj2 = OUT/'text.svgforge'; d.value.save_as(proj2)
    # 폰트 기억 삭제된 새 환경(다른 컨텍스트)에서 파일로 복원 → 폰트 파일 내장 확인
    ctx2 = b.new_context(viewport={'width':1366,'height':657}, locale='en-US')
    pg = ctx2.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); time.sleep(1)
    pg.set_input_files('#projFile', str(proj2)); wait(pg); time.sleep(0.5)
    res['text_same'] = (sig(pg)==s2, svg(pg)==v2)
    # 3) 언어: 영어 화면에 남은 한글
    left = pg.evaluate("""()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
      while((n=w.nextNode())){const p=n.parentElement; if(p.closest('script,style,textarea,#colorHeights'))continue; if(p.closest('.hide')) {} if(/[가-힣]/.test(n.nodeValue)) out.push(n.nodeValue.trim())}
      document.querySelectorAll('[title],[placeholder],[aria-label]').forEach(e=>['title','placeholder','aria-label'].forEach(a=>{const v=e.getAttribute(a); if(v&&/[가-힣]/.test(v)) out.push(a+':'+v)})); return out}""")
    res['en_korean_left'] = [x for x in left if x not in ('한국어',)]
    pg.screenshot(path=str(OUT/'shot_en.png'))
    # 기억된 폰트/기본 폰트: 원래 컨텍스트에서 새로 열기
    page4 = ctx.new_page(); page4.goto(URL); time.sleep(1.2)
    res['remembered_default'] = page4.evaluate("()=>[fontSel.selectedOptions[0].text, fontSel.options.length]")
    page4.select_option('#langSel','en'); time.sleep(0.8)
    page4.screenshot(path=str(OUT/'shot_en_ko_ctx.png'))
    res['fit'] = page4.evaluate("()=>[...document.querySelectorAll('.panel')].map(p=>[p.id,p.scrollHeight,p.clientHeight]).concat([['header',document.querySelector('header').scrollWidth,document.querySelector('header').clientWidth]])")
    page4.select_option('#langSel','ko'); time.sleep(0.5)
    res['back_ko'] = page4.inner_text('#modeImage')
    res['errors'] = errs
    b.close()
for k,v in res.items(): print(k, '=>', v)
