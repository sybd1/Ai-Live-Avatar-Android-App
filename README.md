# 한 걸음 · AI Live Avatar Android App

**[온라인 앱 다운로드](https://ai-live-avatar-android-app.vercel.app)** · **[Android APK 바로 받기](https://github.com/sybd1/Ai-Live-Avatar-Android-App/releases/latest/download/one_step_service-online.apk)**

온라인 APK는 PC·USB·개인 API 키 입력 없이 시연 서버에 접속합니다. Android ARM64 휴대폰에서 설치한 뒤 기본 서버 주소를 유지하세요. 가상 사용자 전용이며 공용 무료 시연 한도가 적용됩니다.

고립·은둔 청년이 지원 프로그램의 일정과 준비물을 확인하고, 첫 참여 전에 AI 아바타와 대화를 연습하는 Android MVP입니다. 현재는 **가상 사용자 전용 시연**입니다. 실제 개인 사연·이름·연락처는 입력하지 않습니다.

## 프로젝트 구성

| 폴더 | 역할 |
| --- | --- |
| `mobile/` | React Native · Expo · TypeScript Android 앱 |
| `server/` | Java 21 · Spring Boot API, Gemini Live 중계, 공식 정보 조회 |
| `data/` | 공식 출처와 확인 상태를 기록한 초기 공고 |
| `stt-worker/` | 선택적으로 사용하는 로컬 Whisper 음성 인식 서버 |
| `scripts/` | Windows 설치·실행·빌드 도구 |

공고 선택 → 일정·준비물·경로 확인 → 선택적 사전 상태 체크 → 장면별 음성 연습 → 쉬기 또는 종료 → 선택적 사후 체크·개인 그래프 순서로 사용합니다. 상태 체크는 이용자의 직접 응답이며 AI 진단이나 관리자 조회 기능은 없습니다.

## 새 PC에서 시작하기

```powershell
git clone https://github.com/sybd1/Ai-Live-Avatar-Android-App.git one_step_service
cd one_step_service
Copy-Item .env.example .env
```

이 저장소에는 소스가 포함됩니다. API 키, 개인 기록, DB, 개발 도구, APK, 서버 JAR는 포함하지 않습니다. 소스 ZIP이나 clone을 받았다면 실행 파일을 먼저 빌드해야 합니다.

필수 도구는 Git, PowerShell 7, Node.js 24, JDK 21, PostgreSQL, Android SDK입니다. [설치 링크와 단계별 명령](docs/NEW_PC_ANDROID_SETUP.md)을 확인합니다. `.env`에 본인의 Gemini 키와 DB 설정을 입력하며 키는 서버에서만 사용합니다.

서버는 `server/`에서 `mvnw.cmd test package`로 빌드합니다. 결과는 `server/target/one_step_service-0.0.1-SNAPSHOT.jar`입니다. DB와 `.env`를 준비한 후 `scripts/start-services.ps1`로 실행합니다.

앱은 `mobile/`에서 `npm ci`, `npm run avatar:build`, `npm run typecheck`, `npm test`, `npx expo prebuild --platform android --no-install` 순서로 준비합니다. 전체 Android SDK를 설정한 뒤 프로젝트 루트에서 다음 명령으로 휴대폰용 APK를 빌드합니다.

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/build-apk.ps1 -Architectures arm64-v8a -ApiBaseUrl http://127.0.0.1:8080
```

APK를 `artifacts/one_step_service-phone.apk`로 복사하면 `휴대폰실행.bat`에서 설치할 수 있습니다. 에뮬레이터는 x86_64 APK를 별도로 빌드합니다. [모바일 개발 안내](mobile/README.md).

## 로컬 시연과 온라인 배포

온라인 APK의 기본 서버는 `https://ai-live-avatar-android-app.vercel.app`입니다. 로컬 개발용 APK는 PC 서버와 USB 포트 전달을 사용합니다.

Java 서버는 Vercel, 공식 공고·사용량 카운터는 무료 Neon PostgreSQL에 연결했습니다. 공개 HTTPS와 Android Origin의 실시간 음성, 공식 근거 안내, 쉬기·종료, 세션 격리 검사를 통과했습니다. 웹페이지는 앱 다운로드 안내이며 브라우저용 앱은 제공하지 않습니다. [온라인 배포 구성과 제한](docs/ONLINE_DEPLOYMENT.md).

## 최근 수정과 남은 확인

- 재생 대기열을 보존하고 Android 반향 제거 패치가 포함되도록 `expo-audio`를 소스에서 빌드합니다.
- 위기 표현은 일반 연습 대사와 분리해 검토된 안내문·음성으로 전달합니다. 안내 재생이 끝난 뒤 도움 화면으로 이동하며, 이용자가 쉬기·종료를 누르면 즉시 중단합니다.
- 앱 테스트 18개, 서버 도메인·음성 테스트 18개, TypeScript 검사를 통과했습니다. 실제 음성 API에서 위기 안내 전체 WAV와 연결 유지를 확인했습니다. 휴대폰에서의 최종 청취 확인은 남아 있습니다.
- 내부 기본 제한은 AI 요청 하루 100회, Live 입력·출력 합계 하루 600초, 별도 TTS 월 10,000자입니다. 공급자 한도와 별개이며 자동 유료 전환하지 않습니다. 무음 전송도 Live 사용량에 포함됩니다.
- API 한도와 무관하게 재생되는 오프라인 위기 안내 음성과 자동 모델 대체는 남은 과제입니다. Vercel 무료 연결은 최대 5분이며, 연결이 끝나면 이용자가 다시 시작해야 합니다.

공식 공고는 승인된 ‘따뜻한 집’ 1건입니다. 시간·준비물 등 확인되지 않은 항목은 ‘확인 필요’로 표시합니다. [공고 근거](data/warm-home-source.md), [남은 기능](docs/FEATURE_BACKLOG.md).

개인 상태 기록은 단말에 저장하며 AI·서버에 보내지 않습니다. 현재 Gemini 무료 계정에서는 가상 시연만 진행합니다. [Gemini 약관](https://ai.google.dev/gemini-api/terms), [외부 자산 고지](THIRD_PARTY_NOTICES.md).
