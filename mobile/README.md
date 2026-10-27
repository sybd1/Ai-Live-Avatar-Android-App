# one_step_service Android 소스

React Native 0.88 / Expo SDK 58 / TypeScript / Expo Audio / WebView 기반 Android 앱이다. 소스 clone 후 서버와 APK를 빌드해 시연한다.

## 개발 준비

- Node.js 24, Android 소스 빌드용 JDK 21과 전체 Android SDK가 필요하다.
- 저장소 루트의 .env는 서버용이다. Gemini·카카오 비밀키를 EXPO_PUBLIC_ 변수나 앱 소스에 넣지 않는다.
- JavaScript 의존성은 npm ci로 고정한다. npm run prepare:assets는 고정된 CC0 아바타 원본을 받고 해시를 확인한다.
- npm run typecheck, npm test로 검사한다.
- 최초 네이티브 프로젝트는 npx expo prebuild --platform android로 생성한다. 루트 scripts/build-apk.ps1은 아바타 번들과 Android AEC 수정을 재현 적용한 뒤 APK를 빌드한다.
- Android SDK는 기본적으로 루트 .tools/android-sdk를 사용한다. 일반 실행 ZIP의 도구는 USB용이므로 Android 소스 빌드에는 platforms·build-tools·NDK 등의 추가 설치가 필요하다.
- 프로젝트의 Android 반향 제거 수정은 네이티브 빌드가 필요하다. Expo Go를 정식 검증 환경으로 삼지 않는다.

## 실행 연결

최신 앱 기본 주소는 http://127.0.0.1:8080이다. USB 실행 스크립트가 이 포트를 PC 서버로 연결한다. 다른 HTTPS 서버를 쓸 때는 앱 첫 화면에서 설정한다. 로컬 HTTP 예외는 127.0.0.1과 에뮬레이터의 10.0.2.2에만 허용한다.

마이크는 명시적인 연습 시작 후 켜지고 앱 전환·쉬기·종료 시 멈춘다. Live 가상 대사는 PCM 스트리밍, 실제 정책 안내는 서버 근거 확인 후 별도 음성이다.

상태 기록은 기기에 저장하며 앱 삭제 시 사라진다. 서명이 다른 APK 설치에 실패하면 자동으로 앱을 삭제하지 않는다. 개발 빌드로 바꿀 때 기록 보존 여부와 서명을 먼저 확인한다.

공통 실행 안내는 [루트 README](../README.md), 미해결 과제는 [FEATURE_BACKLOG.md](../docs/FEATURE_BACKLOG.md)를 따른다.
