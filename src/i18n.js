// 화면 언어 (한국어 / English)
// 한국어 원문을 열쇠로 쓴다: 화면 요소는 원문을 기억해 두고 언어를 바꿀 때 번역문으로 교체,
// 코드에서 만드는 문구는 T('원문 {변수}', {변수}) 로 번역한다.
import { lsGet, lsSet } from './store.js';

const EN = {
  // 상단
  '이미지': 'Image',
  '텍스트': 'Text',
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
  '지금 작업(설정·이미지·텍스트·폰트·높이·고리 위치)을 .svgforge 파일로 저장': 'Save this work (settings, image, text, font, heights, ring position) as a .svgforge file',
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
  '텍스트를 입력하세요 (여러 줄 가능)': 'Type your text (multiple lines OK)',
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
  '텍스트·색 기본 두께 (mm)': 'Base thickness of text/colors (mm)',
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
  '텍스트·색': 'Text/colors',
  '받침·턱': 'Base/rim',
  '받침판': 'Base plate',
  '모양': 'Shape',
  '외곽 따라': 'Outline',
  '둥근 사각형': 'Rounded rect',
  '원': 'Circle',
  '받침판 색 (3MF 필라멘트 구분용)': 'Base color (for 3MF filament)',
  '여백 · 두께 (mm)': 'Margin · thickness (mm)',
  '여백·두께': 'Margin·H',
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
  '텍스트를 입력하면 여기에 미리보기가 나타납니다.': 'Type some text to see the preview here.',
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
  'SVG Forge — 이미지·텍스트를 SVG · DXF · STL로': 'SVG Forge — images & text to SVG · DXF · STL',
  '기본 폰트로 정했습니다: {name}': 'Default font set: {name}',
  '내장 폰트는 뺄 수 없습니다.': 'The built-in font cannot be removed.',
  '목록에서 뺐습니다: {name}': 'Removed: {name}',
  '각진 사각형': 'Square',
  '타원': 'Ellipse',
  '삼각형': 'Triangle',
  '오각형': 'Pentagon',
  '육각형': 'Hexagon',
  '팔각형': 'Octagon',
  '별': 'Star',
  '하트': 'Heart',
  '구름': 'Cloud',
  '꽃': 'Flower',
  '방패': 'Shield',
  '내 이미지 (SVG·PNG)…': 'My image (SVG/PNG)…',
  'SVG·PNG 그림의 외곽을 받침판 모양으로 씁니다': 'Use the outline of an SVG/PNG picture as the base shape',
  '모양 이미지…': 'Shape image…',
  '모양을 글자 가로세로 비율에 맞게 늘입니다': 'Stretch the shape to the content aspect ratio',
  '늘여 맞춤': 'Stretch',
  '받침판 위 텍스트·그림을 어떻게 만들지': 'How the text/picture is made on the base',
  '돌출 (볼록)': 'Raised',
  '돌출 + 안쪽(o·e) 뚫기': 'Raised + cut counters (o, e)',
  '새김 (두께 = 깊이)': 'Engraved (thickness = depth)',
  '관통 (뚫기)': 'Cut through',
  '고리: 몸체 밖에 고리를 붙임 · 구멍: 몸체 안에 구멍만 뚫음': 'Loop: attach a loop outside · Hole: just drill a hole inside the body',
  '바깥 고리': 'Outer loop',
  '구멍 뚫기': 'Hole',
  '크기·높이 치수를 화면에 표시 (높이는 색별로)': 'Show size and height dimensions (heights per color)',
  '치수': 'Dims',
  '처음 보기로 (확대·회전 되돌리기)': 'Back to the initial view (reset zoom/rotation)',
  '⌂ 처음으로': '⌂ Home',
  '면을 누르면 그 방향에서 봅니다': 'Click a face to view from that side',
  '아래': 'Bottom',
  '앞': 'Front',
  '뒤': 'Back',
  '받침': 'Base',
  '턱': 'Rim',
  '깊이': 'Depth',
  '⚠ 구멍이 가장자리에 걸림': '⚠ hole overlaps the edge',
  '⚠ 떨어져 나가는 조각 {n}개 (o·e 안쪽 등)': '⚠ {n} loose piece(s) (inside o, e…)',
  '새김 깊이를 받침 두께에 맞춰 줄임': 'engrave depth limited by base thickness',
  '모양 이미지를 읽지 못했습니다. 배경이 밝고 모양이 진한 SVG·PNG를 써 주세요.': 'Could not read the shape image. Use an SVG/PNG with a dark shape on a light background.',
  '한글 지원 폰트': 'Fonts with Korean',
  '한글 없는 폰트 (영문 등)': 'Fonts without Korean',
  '확인 중…': 'Checking…',
  '한글 폰트 (이름으로 추정)': 'Korean fonts (guessed by name)',
  '기타 폰트': 'Other fonts',
  '이 폰트에 없는 글자는 다른 폰트로 채웠습니다: {chars}': 'Characters missing in this font were taken from another font: {chars}',
  '설정 (치수 색·배경·도움말 등)': 'Settings (dimension color, backgrounds, hints…)',
  '설정': 'Settings',
  '치수 색': 'Dim color',
  '치수 글자 크기': 'Dimension text size',
  '작은 글씨': 'Small text',
  '보통 글씨': 'Normal text',
  '큰 글씨': 'Large text',
  '2D 배경': '2D background',
  '3D 배경': '3D background',
  '체크무늬': 'Checker',
  '흰색': 'White',
  '회색': 'Gray',
  '밝게': 'Light',
  '어둡게': 'Dark',
  '마우스를 올리면 영어 용어도 표시': 'Show English terms on hover (Korean UI)',
  '마지막 작업 자동 저장': 'Autosave last work',
  '왼쪽·오른쪽 설정을 처음 값으로 (텍스트·이미지는 그대로)': 'Reset all left/right settings (keeps text and image)',
  '작업 설정 처음값으로': 'Reset work settings',
  '이 창 기본값': 'Defaults',
  '닫기': 'Close',
  '크기 (mm) · 최대 {m}': 'Size (mm) · max {m}',
  '작업 설정을 처음 값으로 되돌렸습니다.': 'Work settings were reset.',
  '텍스트 입력': 'Text',
  '모두 채움': 'Fill all',
  '내용물이 없는 받침판 위를 전부 내용물 높이까지 채웁니다. 끄면 폭·높이를 mm로 직접 정합니다.': 'Fills every empty area of the base up to the content height. Turn off to set width/height in mm.',
  '꼭지점 시점': 'Corner view',
  '불러온 이미지 모양 그대로': 'Same shape as the loaded image',
  '편집할 고리·구멍 선택': 'Choose the ring/hole to edit',
  '편집할 고리': 'Ring to edit',
  '고리·구멍 하나 더 만들기': 'Add another ring/hole',
  '선택한 고리·구멍 지우기': 'Delete the selected ring/hole',
  '종류·위치': 'Type·pos.',
  '고리': 'Loop',
  '구멍': 'Hole',
  '왼쪽 아래': 'Bottom left',
  '오른쪽 아래': 'Bottom right',
  '치수 보이기·숨기기 (단축키 D). 치수 숫자를 누르면 바로 고칠 수 있음': 'Show/hide dimensions (key D). Click a number to change it',
  '📏 치수': '📏 Dims',
  '처음 보기로 (확대·회전 되돌리기, 단축키 H)': 'Back to the initial view (key H)',
  '글자별 조절': 'Per-character',
  '글자를 고르거나 미리보기에서 글자를 눌러 끌면 옮겨집니다 (방향키로 미세 이동).': 'Pick a character, or click and drag it in the preview (arrow keys nudge).',
  '기본 두께에 더할 높이 (mm, 음수 가능)': 'Height added to the base thickness (mm, may be negative)',
  '높이 ±mm': 'Height ±mm',
  '글자 색 (3MF에서 필라멘트 구분)': 'Character color (3MF filament)',
  '이 글자를 처음대로': 'Reset this character',
  '가로 · 세로 이동 (mm, +오른쪽 · +위)': 'Move X · Y (mm, + right · + up)',
  '이동 mm': 'Move mm',
  '가로 (mm, +오른쪽)': 'X (mm, + right)',
  '세로 (mm, +위)': 'Y (mm, + up)',
  '모든 글자 처음대로': 'Reset all characters',
  '눌러서 치수 바꾸기': 'Click to change',
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

// 한국어 화면에서 마우스를 올리면 영어 용어도 보여 줌 (버튼·항목 이름 → 사전의 영어)
let hintsOn = true;
export function setHints(on) {
  hintsOn = !!on;
  applyHints();
}
export function applyHints(root = document) {
  const d = DICTS.en;
  for (const e of root.querySelectorAll('button, label, h2, .hlabel, option')) {
    if (e.closest('#colorHeights,#cube')) continue;
    if (e.dataset.hintBase == null) e.dataset.hintBase = e.dataset.koTitle != null ? '' : e.getAttribute('title') || '';
    const base = e.dataset.koTitle != null ? translateStr(e.dataset.koTitle) : e.dataset.hintBase;
    const own = (origOwnText(e) || '').trim().replace(/\s+/g, ' ');
    const en = lang === 'ko' && hintsOn && own && d[own] && d[own] !== own ? d[own] : '';
    const t = [base, en && 'EN: ' + en].filter(Boolean).join('\n');
    if (t) e.setAttribute('title', t);
    else if (e.hasAttribute('title')) e.removeAttribute('title');
  }
}
function origOwnText(e) {
  let s = '';
  for (const n of e.childNodes) if (n.nodeType === 3) s += origText.get(n) ?? n.nodeValue;
  return s;
}

export function setLang(l) {
  lang = DICTS[l] || l === 'ko' ? l : 'ko';
  lsSet('svgforge.lang', lang);
  applyLang();
  applyHints();
}

export function initLang() {
  const saved = lsGet('svgforge.lang');
  const nav = (navigator.language || 'ko').toLowerCase();
  lang = saved || (nav.startsWith('ko') ? 'ko' : 'en');
  if (lang !== 'ko' && !DICTS[lang]) lang = 'ko';
  return lang;
}
