# SVG Forge 설치형 (Windows)

웹 버전과 똑같은 화면을 **설치 파일(.exe)** 로 쓰는 버전입니다. 인터넷 없이 동작합니다.

## 만드는 법 (GitHub에서 자동으로)
1. 저장소의 **Actions** 탭 → **Build desktop app** → **Run workflow**
2. 3~5분 뒤 실행 화면 아래 **Artifacts → SVG-Forge-Windows** 를 내려받아 압축을 풉니다.
3. 안에 두 가지가 있습니다.
   - `SVG-Forge-…-win.exe` 설치 파일 (시작 메뉴·바탕화면 바로가기 생성)
   - `SVG-Forge-…-portable.exe` 설치 없이 바로 실행

처음 실행할 때 Windows가 "알 수 없는 게시자" 경고를 띄울 수 있습니다 (코드 서명을 하지 않았기 때문). **추가 정보 → 실행**을 누르세요.

## 내 컴퓨터에서 직접 만들기 (선택)
```
npm ci && node build.mjs --no-potrace
mkdir -p desktop/app && cp dist/svg-forge-nogpl.html desktop/app/index.html
cd desktop && npm install && npm run dist
```
결과물은 `desktop/dist/` 에 생깁니다. (`npm start` 로 설치 없이 실행해 볼 수도 있습니다.)
