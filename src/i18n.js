// 화면 언어 (한국어 / English)
// 한국어 원문을 열쇠로 쓴다: 화면 요소는 원문을 기억해 두고 언어를 바꿀 때 번역문으로 교체,
// 코드에서 만드는 문구는 T('원문 {변수}', {변수}) 로 번역한다.
import { lsGet, lsSet } from './store.js';

const EN = {
  // 상단
  '이미지': 'Image',
  '글자': 'Text',
  '저장': 'Save',
  'MakerLab·3D용: 닫힌 채움 경로만, 선·글꼴 없음, mm 단위': 'For MakerLab/3D: closed filled paths only, no strokes or fonts, mm units',
  '레이저용: 채움 없이 0.1mm 윤곽선, 색상=레이어 (LightBurn)': 'For laser: 0.1 mm outlines without fill, color = layer (LightBurn)',
  'SVG · 레이저': 'SVG · Laser',
  'DXF R12, 단위 mm, 색상별 레이어 (RDWorks·LightBurn)': 'DXF R12, mm units, one layer per color (RDWorks/LightBurn)',
  '레이저 SVG·DXF에서 모든 색을 한 레이어(CUT)로 합칩니다': 'Merge all colors into one layer (CUT) in laser SVG/DXF',
  '한 레이어': 'One layer',
  "바이너리 STL, 오른쪽 '3D 출력'의 두께로 압출 (모든 파트 한 파일)": "Binary STL extruded with the '3D output' settings (all parts in one file)",
  '3MF: 색·받침판·고리가 각각 파트로 나뉨 (Bambu Studio·OrcaSlicer 필라멘트 지정용)': '3MF: colors, base and ring as separate parts (assign filaments in Bambu Studio/OrcaSlicer)',
  '프로젝트': 'Project',
  '열기': 'Open',
  '프로젝트 파일(.svgforge) 열기 — 저장했던 작업을 그대로 이어서 수정': 'Open a project file (.svgforge) and continue editing',
  '지금 작업(설정·이미지·글자·폰트·높이·고리 위치)을 .svgforge 파일로 저장': 'Save this work (settings, image, text, font, heights, ring position) as a .svgforge file',
  '화면 언어': 'Language',
  // 입력
  '이미지를 화면 아무 곳에나 끌어다 놓거나 Ctrl+V로 붙여넣어도 됩니다': 'You can also drop an image anywhere or paste it with Ctrl+V',
  '이미지 열기…': 'Open image…',
  '끌어놓기 · 붙여넣기(Ctrl+V) 가능': 'Drop or paste (Ctrl+V)',
  '색·영역': 'Colors & regions',
  '색 수': 'Colors',
  '1색 (흑백, 임계값)': '1 color (B/W, threshold)',
  '2색': '2 colors', '3색': '3 colors', '4색': '4 colors', '5색': '5 colors', '6색': '6 colors', '8색': '8 colors',
  '임계값': 'Threshold',
  '자동 임계값(Otsu)': 'Automatic threshold (Otsu)',
  '자동': 'Auto',
  '밝은 부분을 도형으로 (반전)': 'Use bright areas as shapes (invert)',
  '배경색(모서리 색) 제거': 'Remove background (corner color)',
  '선 품질': 'Line quality',
  'Potrace: 널리 쓰이는 오픈소스 트레이서(GPL-2.0). 흑백 전용, 디자인 보정은 적용되지 않음': 'Potrace: widely used open-source tracer (GPL-2.0). B/W only, design corrections not applied',
  '엔진': 'Engine',
  'SVG Forge (기본)': 'SVG Forge (default)',
  'Potrace (GPL, 흑백)': 'Potrace (GPL, B/W)',
  '작을수록 원본에 가깝고, 클수록 노드가 적고 매끈합니다': 'Smaller = closer to the source; larger = fewer nodes, smoother',
  '곡선 허용오차': 'Curve tolerance',
  '이보다 크게 꺾이는 곳을 뾰족한 모서리로 만듭니다. 작을수록 모서리가 많아집니다': 'Turns sharper than this become corners. Smaller = more corners',
  '모서리 각도': 'Corner angle',
  '이 편차(px) 안에서 곧게 뻗은 부분을 정확한 직선으로 바꿉니다. 0이면 끔': 'Nearly straight runs within this deviation (px) become exact lines. 0 = off',
  '직선 인식': 'Line detection',
  '디자인 보정': 'Design corrections',
  '3° 이내로 기운 직선을 정확히 수평·수직으로': 'Snap lines within 3° to exact horizontal/vertical',
  '수평·수직': 'H/V snap',
  '원과 원호를 정확한 원으로 (DXF는 호로 저장)': 'Make circles and arcs exact (arcs in DXF)',
  '원·호': 'Arcs',
  '거의 평행한 직선들의 각도를 하나로': 'Unify angles of nearly parallel lines',
  '평행': 'Parallel',
  '비슷한 두께의 획을 같은 두께로': 'Make similar stroke widths equal',
  '같은 두께': 'Eq. width',
  '거의 일직선인 선(기준선 등)을 한 줄로': 'Align nearly collinear lines (baselines etc.)',
  '일직선 정렬': 'Align lines',
  '그림 전체가 좌우 대칭에 가까우면 완전한 대칭으로 (흑백 모드)': 'Make a nearly symmetric drawing exactly symmetric (B/W mode)',
  '좌우 대칭': 'Symmetry',
  '정리': 'Cleanup',
  '이 면적(px²)보다 작은 조각을 지웁니다': 'Remove pieces smaller than this area (px²)',
  '노이즈 제거': 'Despeckle',
  'JPG 잡티·거친 가장자리를 다듬습니다': 'Smooth JPG noise and rough edges',
  '번짐 완화': 'Smoothing',
  '작거나 흐린 이미지를 AI로 선명하게 키운 뒤 트레이싱합니다 (처음 한 번은 몇 초 걸림)': 'Enlarge small or blurry images with AI before tracing (first run takes a few seconds)',
  'AI 업스케일': 'AI upscale',
  '끔': 'Off',
  '×4 (작은 이미지)': '×4 (small images)',
  '가장자리는 유지하고 JPG 잡티·얼룩만 지웁니다': 'Remove JPG noise while keeping edges',
  '잡티 제거 (가장자리 보존)': 'Denoise (edge-preserving)',
  '트레이싱할 때의 이미지 크기. 높을수록 정밀하지만 느립니다': 'Image size used for tracing. Higher = more precise but slower',
  '해상도': 'Resolution',
  '낮음 (500px, 빠름)': 'Low (500px, fast)',
  '보통 (800px)': 'Normal (800px)',
  '높음 (1200px)': 'High (1200px)',
  '매우 높음 (1600px)': 'Very high (1600px)',
  // 글자
  '글자를 입력하세요 (여러 줄 가능)': 'Type your text (multiple lines OK)',
  '폰트': 'Font',
  'Noto Sans KR Bold (내장)': 'Noto Sans KR Bold (built-in)',
  '폰트 파일…': 'Font file…',
  '설치된 폰트…': 'Installed fonts…',
  '설치된 폰트': 'Installed fonts',
  '기본으로': 'Set default',
  '지금 선택한 폰트를 다음에 열 때도 기본으로 선택': 'Use the selected font by default next time',
  '목록에서 빼기': 'Remove',
  '기억해 둔 폰트를 이 브라우저에서 지웁니다': 'Forget this font in this browser',
  '폰트 파일(.ttf .otf .woff .ttc)을 화면에 끌어다 놓아도 됩니다. 불러온 폰트는 이 브라우저에 기억됩니다.': 'You can also drop font files (.ttf .otf .woff .ttc) onto the page. Loaded fonts are remembered in this browser.',
  '배치': 'Layout',
  '정렬': 'Align',
  '가운데': 'Center',
  '왼쪽': 'Left',
  '오른쪽': 'Right',
  '줄 간격': 'Line spacing',
  // 미리보기
  '채움': 'Fill',
  '윤곽선': 'Outline',
  '미리보기가 여기에 나타납니다.': 'The preview appears here.',
  // 출력
  '크기': 'Size',
  '너비 (mm)': 'Width (mm)',
  '높이': 'H',
  'DXF·STL은 곡선을 직선으로 나눌 때 이 오차 이내로 맞춥니다': 'DXF/STL curves are split into lines within this tolerance',
  '곡선 정밀도': 'Curve precision',
  '3D 출력 (STL·3MF)': '3D output (STL/3MF)',
  '글자·색 기본 두께 (mm)': 'Base thickness of text/colors (mm)',
  '두께 (mm)': 'Thickness (mm)',
  '기본 두께 (mm)': 'Base thickness (mm)',
  '색마다 기본 두께에 더할 높이 (mm). 음수면 낮아짐 (최소 0.2mm)': 'Height added per color (mm). Negative lowers it (min 0.2 mm)',
  '색별 높이 ±mm': 'Color height ±mm',
  '밝기 순서대로 계단식 높이차를 채움 (0, +0.4, +0.8 …)': 'Fill stepped heights in brightness order (0, +0.4, +0.8 …)',
  '계단': 'Steps',
  '색별 높이차를 모두 0으로': 'Reset all color heights to 0',
  '0으로': '0',
  '윗모서리 다듬기': 'Finish the top edges',
  '모서리': 'Edges',
  '그대로': 'Sharp',
  '모따기': 'Chamfer',
  '모깎기': 'Fillet',
  '크기 (mm)': 'Size (mm)',
  '글자·색': 'Text/colors',
  '받침·턱': 'Base/rim',
  '받침판': 'Base plate',
  '모양': 'Shape',
  '외곽 따라': 'Outline',
  '둥근 사각형': 'Rounded rect',
  '원': 'Circle',
  '받침판 색 (3MF 필라멘트 구분용)': 'Base color (for 3MF filament)',
  '여백 · 두께 (mm)': 'Margin · thickness (mm)',
  '여백·두께': 'Margin·thick.',
  '여백 (mm)': 'Margin (mm)',
  '외곽 따라: 글자 사이·u 안쪽처럼 오목한 홈을 이 반경(mm)까지 메워 매끈하게': 'Outline: fill concave notches (between letters, inside u) up to this radius (mm)',
  '외곽 메움': 'Fill notches',
  '메움 반경 (mm), 0이면 메우지 않음': 'Fill radius (mm), 0 = off',
  'o·e·a처럼 글자 안쪽 공간을 받침판에서도 뚫습니다': 'Cut letter counters (o, e, a) through the base as well',
  '글자 안쪽(o·e) 뚫기': 'Cut counters (o, e)',
  '테두리 턱': 'Raised rim',
  '턱 폭 · 받침판 위 높이 (mm)': 'Rim width · height above base (mm)',
  '폭·높이': 'Width·height',
  '폭 (mm)': 'Width (mm)',
  '높이 (mm)': 'Height (mm)',
  '키링 고리': 'Key ring',
  '위치': 'Position',
  '위': 'Top',
  '왼쪽 위': 'Top left',
  '오른쪽 위': 'Top right',
  '고리 바깥 지름 · 구멍 지름 (mm)': 'Ring outer diameter · hole diameter (mm)',
  '외경·구멍': 'Outer·hole',
  '바깥 지름 (mm)': 'Outer diameter (mm)',
  '구멍 지름 (mm)': 'Hole diameter (mm)',
  '자동 위치에서 옮긴 거리 (mm). 3D 화면에서 고리를 마우스로 끌어도 됩니다': 'Offset from the automatic position (mm). You can also drag the ring in the 3D view',
  '이동': 'Move',
  '가로 이동 (mm, +오른쪽)': 'Horizontal offset (mm, + right)',
  '세로 이동 (mm, +위)': 'Vertical offset (mm, + up)',
  '자동 위치로': 'Back to automatic position',
  // 코드에서 만드는 문구
  '이미지를 열 수 없습니다. PNG/JPG/WebP/SVG 파일인지 확인해 주세요.': 'Cannot open the image. Please use PNG/JPG/WebP/SVG.',
  '계단형(각진 픽셀) 가장자리를 감지해 곡선 허용오차를 0.80으로 자동 설정했습니다.': 'Hard pixel edges detected: curve tolerance set to 0.80 automatically.',
  'AI 업스케일 중… {p}%': 'AI upscaling… {p}%',
  '처리 중…': 'Processing…',
  '이미지 열기': 'Open an image',
  '클릭해서 파일 선택 · 끌어다 놓기 · Ctrl+V 붙여넣기': 'Click to choose a file · drop · paste with Ctrl+V',
  '지난 작업 이어서 하기': 'Continue last work',
  '글자를 입력하면 여기에 미리보기가 나타납니다.': 'Type some text to see the preview here.',
  '선택한 폰트에 없는 글자: {chars} — 다른 폰트를 선택해 주세요.': 'Characters missing in this font: {chars} — please choose another font.',
  '처리 중 오류가 발생했습니다: ': 'An error occurred: ',
  '추출된 도형이 없습니다.': 'No shapes were found.',
  ' 임계값·색 수를 바꿔 보세요.': ' Try changing the threshold or number of colors.',
  'Potrace 엔진은 흑백 전용이라 다색에는 기본 엔진을 썼습니다.': 'Potrace is B/W only, so the default engine was used for multiple colors.',
  'Potrace 엔진: 디자인 보정(직선·원호·평행 등)은 적용되지 않습니다. GPL-2.0 라이선스.': 'Potrace engine: design corrections (lines, arcs, parallel…) are not applied. GPL-2.0 license.',
  '이미지가 이미 충분히 커서 AI 업스케일 효과가 작습니다. 작거나 흐린 이미지에 쓰세요.': 'The image is already large, so AI upscaling helps little. Use it for small or blurry images.',
  '색이 {n}개입니다. MakerLab 도구에는 4색 이하를 권장합니다 (색 수를 줄여 보세요).': '{n} colors. MakerLab tools work best with 4 or fewer (try fewer colors).',
  "도형 조각이 {n}개로 많습니다. '노이즈 제거'나 '곡선 단순화'를 올리면 가벼워집니다.": "{n} pieces is a lot. Raise 'Despeckle' or 'Curve tolerance' to lighten it.",
  '도형 {n}개': 'shapes: {n}',
  '노드 {n}': 'nodes: {n}',
  '수평·수직 {n}': 'H/V {n}',
  '평행 {n}': 'parallel {n}',
  '두께 {n}': 'width {n}',
  '정렬 {n}': 'aligned {n}',
  '원호 {n}': 'arcs {n}',
  '엔진: Potrace': 'Engine: Potrace',
  '디자인 보정으로 맞춘 항목 수': 'Number of items fixed by design corrections',
  '보정: {list}': 'Fixed: {list}',
  '표시할 도형이 없습니다.': 'Nothing to show.',
  '이 브라우저에서는 3D 미리보기(WebGL)를 쓸 수 없습니다. STL 저장은 정상 동작합니다.': '3D preview (WebGL) is not available in this browser. STL export still works.',
  '색 {i} {c}: 기본 두께에 더할 높이 (mm, 음수 가능)': 'Color {i} {c}: height added to the base thickness (mm, may be negative)',
  '파트 {n}개': 'parts: {n}',
  '⚠ 고리가 몸체에서 떨어져 있음': '⚠ ring is detached from the body',
  '고리는 끌어서 옮길 수 있음': 'drag the ring to move it',
  '폰트를 읽을 수 없습니다. .ttf / .otf / .woff / .ttc 파일인지 확인해 주세요.': 'Cannot read the font. Please use .ttf / .otf / .woff / .ttc.',
  '설치된 폰트 접근이 허용되지 않았습니다. 폰트 파일을 직접 불러와 주세요.': 'Access to installed fonts was not allowed. Please load a font file instead.',
  '폰트를 선택하세요…': 'Choose a font…',
  '이 폰트는 불러올 수 없습니다. 폰트 파일을 직접 선택해 주세요.': 'This font cannot be loaded. Please choose the font file directly.',
  '3MF 저장: 필라멘트 {n}개 — {list}': '3MF saved: {n} filaments — {list}',
  '{n}번': '#{n}',
  '폰트 {n}개를 불러왔습니다: {names}': 'Loaded {n} font(s): {names}',
  '기본 폰트: {name}': 'Default font: {name}',
  '프로젝트를 저장했습니다: {name}': 'Project saved: {name}',
  '프로젝트를 불러왔습니다: {name}': 'Project loaded: {name}',
  '프로젝트 파일을 읽을 수 없습니다.': 'Cannot read the project file.',
  '프로젝트에 쓰인 폰트({name})가 없어 기본 폰트로 표시합니다.': 'The project font ({name}) is not available; showing the default font.',
  '저장: {t}': 'saved {t}',
  '여기에 놓으면 불러옵니다': 'Drop to open',
  'SVG Forge — 이미지·글자를 SVG · DXF · STL로': 'SVG Forge — images & text to SVG · DXF · STL',
  '기본 폰트로 정했습니다: {name}': 'Default font set: {name}',
  '내장 폰트는 뺄 수 없습니다.': 'The built-in font cannot be removed.',
  '목록에서 뺐습니다: {name}': 'Removed: {name}',
};

const DICTS = { en: EN };
let lang = 'ko';

export function getLang() {
  return lang;
}

/** 번역 + {변수} 치환 */
export function T(ko, vars) {
  let s = lang !== 'ko' && DICTS[lang] && DICTS[lang][ko] != null ? DICTS[lang][ko] : ko;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return s;
}

// 화면 요소 원문 기억
const origText = new WeakMap();
const ATTRS = ['title', 'placeholder', 'aria-label'];

function translateStr(orig) {
  if (lang === 'ko') return orig;
  const d = DICTS[lang] || {};
  const key = orig.trim();
  if (d[key] == null) return orig;
  return orig.replace(key, d[key]);
}

/** 문서(또는 일부)의 정적 문구를 현재 언어로 */
export function applyLang(root = document.body, skip = []) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || p.closest('script,style,textarea,svg,#status,#msg,#badge3d,#colorHeights')) return NodeFilter.FILTER_REJECT;
      if (skip.some((s) => p.closest(s))) return NodeFilter.FILTER_REJECT;
      return /[가-힣]/.test(origText.get(n) ?? n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let n;
  while ((n = walker.nextNode())) {
    if (!origText.has(n)) origText.set(n, n.nodeValue);
    n.nodeValue = translateStr(origText.get(n));
  }
  for (const e of root.querySelectorAll('[title],[placeholder],[aria-label]')) {
    for (const a of ATTRS) {
      if (!e.hasAttribute(a)) continue;
      const key = 'ko' + a.replace(/-\w/g, (m) => m[1].toUpperCase()).replace(/^./, (c) => c.toUpperCase());
      if (e.dataset[key] == null) {
        const v = e.getAttribute(a);
        if (!/[가-힣]/.test(v)) continue;
        e.dataset[key] = v;
      }
      e.setAttribute(a, translateStr(e.dataset[key]));
    }
  }
  document.documentElement.lang = lang;
}

export function setLang(l) {
  lang = DICTS[l] || l === 'ko' ? l : 'ko';
  lsSet('svgforge.lang', lang);
  applyLang();
}

export function initLang() {
  const saved = lsGet('svgforge.lang');
  const nav = (navigator.language || 'ko').toLowerCase();
  lang = saved || (nav.startsWith('ko') ? 'ko' : 'en');
  if (lang !== 'ko' && !DICTS[lang]) lang = 'ko';
  return lang;
}
