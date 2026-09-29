# SVG Forge

이미지·글자를 **MakerWorld MakerLab**, **레이저 커팅(LightBurn·RDWorks)**, **3D 프린팅**에 바로 쓸 수 있는 SVG · DXF · STL로 변환하는 도구입니다.
빌드 결과는 **HTML 파일 하나**이며, 설치·인터넷 없이 브라우저(크롬·엣지)에서 동작합니다. 파일은 브라우저 밖으로 나가지 않습니다.

## 주요 기능
- **이미지 트레이싱**: 서브픽셀 윤곽 → 모서리 복원 → 직선·원호·베지어 피팅
- **디자인 보정**: 수평·수직 맞춤, 평행, 같은 두께, 일직선 정렬, 원·호 인식, 좌우 대칭(선택)
- **다색**: 색 경계를 공유해 색 사이 틈·겹침 0
- **글자**: 한글 폰트 내장(Noto Sans KR), 폰트 파일(.ttf/.otf/.woff/.ttc)·설치 폰트(Chrome/Edge) 사용, 끌어다 놓기, 불러온 폰트 기억·기본 폰트 지정
- **전처리**: AI 업스케일(×2/×4, 오프라인), 가장자리 보존 잡티 제거
- **출력**
  - SVG (MakerLab·3D용 채움 경로)
  - SVG (레이저 윤곽선, 공유 경계는 한 번만)
  - DXF R12 (원호는 bulge 호, 단위 mm)
  - STL (두께·색별 높이차)
  - 3MF (색·받침판·고리가 각각 파트, Bambu Studio·OrcaSlicer 필라멘트 번호 지정)
- **3D 구성**: 받침판(외곽 따라/둥근 사각형/원, 외곽 메움, 글자 안쪽 뚫기), 테두리 턱, 키링 고리(위치·외경·구멍, 3D 화면에서 끌어 옮기기)
- **색별 높이**: 색마다 높이차(± mm) 개별 지정, 계단 자동 채움
- **모서리**: 윗모서리 모따기·모깎기 (글자·색 / 받침·턱 선택)
- **프로젝트**: `.svgforge` 파일로 저장·열기(이미지·폰트 포함), 마지막 작업 자동 저장 → '지난 작업 이어서 하기'
- **화면 언어**: 한국어 / English
- 무거운 계산은 백그라운드(Web Worker)에서 실행

## 빌드
```bash
npm ci
npm run build          # dist/svg-forge.html (Potrace 포함) + dist/svg-forge-nogpl.html
npm run build:nogpl    # 배포용만
```

## 배포 (Netlify)
`netlify.toml`에 설정되어 있습니다. GPL 제외 빌드가 `index.html`로 올라갑니다.

## 구조
| 파일 | 역할 |
|---|---|
| `src/app.js`, `src/template.html` | 화면 |
| `src/imagetrace.js` | 이미지 → 색 레이어 |
| `src/contour.js` | 서브픽셀 윤곽, 베지어 피팅 |
| `src/vectorize.js` | 모서리·직선·원호 분석, 전역 정규화, 출력 |
| `src/planar.js` | 다색 공유 경계 그래프 |
| `src/geom.js`, `src/export.js` | mm 모델, SVG/DXF 내보내기 |
| `src/solid.js`, `src/mesh.js` | 받침판·테두리·고리 도형 연산(Clipper), STL/3MF 내보내기 |
| `src/worker.js`, `src/upscale.js`, `src/potrace_entry.js` | 백그라운드 계산, AI 업스케일, Potrace(선택) |
| `test/` | 브라우저 자동 테스트·파일 검증 스크립트 |

## 사용한 오픈소스와 라이선스
| 구성요소 | 라이선스 | 비고 |
|---|---|---|
| Noto Sans CJK KR (부분 글꼴, `assets/`) | SIL OFL 1.1 | |
| opentype.js, three.js, UpscalerJS / ESRGAN-slim | MIT | |
| TensorFlow.js | Apache-2.0 | |
| clipper-lib | Boost (BSL-1.0) | 도형 연산 |
| imagetracerjs | Unlicense | 초기 버전에서 사용 |
| **Potrace** (esm-potrace-wasm) | **GPL-2.0** | `svg-forge.html`에만 포함. 공개 배포에는 `svg-forge-nogpl.html` 사용 권장 |
