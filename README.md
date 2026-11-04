# 한 걸음 · AI Live Avatar Android App

**[온라인 앱 다운로드](https://ai-live-avatar-android-app.vercel.app)** · **[Android APK 바로 받기](https://github.com/sybd1/Ai-Live-Avatar-Android-App/releases/latest/download/one_step_service-online.apk)**

보건 복지부 "2023년 고립 은둔 청년 실태조사", 2023.12.13.에 따르면 청년들은 주로 "OTT 등 동영상 시청(23.2%), 온라인 활동(15.6%)등의 돈을 덜 들이면서 시간 소요가 가능한 온라인 활동에 의존하는 경우가 대부분이었다.

이 통계를 토대로 PC환경에 익숙할 고립 은둔 청년들을 위하여 PC 화면 레이아웃의 웹을 준비하려고 했으나, 모바일 레이아웃으로 준비했다. 이왕하는 김에 직접 어플로도 만들었다.

아마 청년들은 하루종일 집에서 PC보다 휴대폰을 하고 있을 가능성을 고려했다.

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

- **Android 1.0.1**: 음성은 Android `AudioTrack` 전용 스레드에서 재생합니다. WebView는 아바타 입 모양만 처리하며 화면 지연·오류가 음성 재생을 중단하지 않습니다.
- 시작할 때 350ms를 버퍼링합니다. 스피커 재생 중과 종료 후 250ms는 마이크에서 서버로 보내는 소리를 무음으로 바꿔 반향이 다음 발화로 인식되지 않게 합니다. 답변이 끝난 뒤 말하면 자동으로 대화가 이어집니다. 쉬기·종료 버튼은 언제든 즉시 작동합니다.
- Live의 자동 발화 중단을 끕니다. 연결·한도 오류가 나면 이미 받은 음성을 재생한 뒤 안내합니다. 오류 이후 아직 서버에서 받지 못한 문장까지 복구하는 기능은 없습니다.
- 공식 안내와 위기 안내도 같은 Android 재생기를 사용합니다. 위기 안내는 재생을 마친 뒤 도움 화면으로 이동합니다.
- 이번 수정은 TypeScript 검사와 APK·서버 배포 빌드로 확인합니다. 사용자 요청에 따라 대화 테스트·휴대폰 청취 테스트·AI API 호출은 진행하지 않습니다. 이전 버전의 테스트 결과를 이번 버전의 통과 결과로 표시하지 않습니다.
- 내부 기본 제한은 AI 요청 하루 100회, Live 입력·출력 합계 하루 600초, 별도 TTS 월 10,000자입니다. 무음 전송도 Live 사용량에 포함됩니다. 유료 전환은 없습니다.
- 오프라인 위기 안내 음성과 자동 모델 대체는 남은 과제입니다. Vercel 무료 연결은 최대 5분이며, 연결이 끝나면 이용자가 다시 시작해야 합니다.

공식 공고는 승인된 ‘따뜻한 집’ 1건입니다. 시간·준비물 등 확인되지 않은 항목은 ‘확인 필요’로 표시합니다. [공고 근거](data/warm-home-source.md), [남은 기능](docs/FEATURE_BACKLOG.md).

개인 상태 기록은 단말에 저장하며 AI·서버에 보내지 않습니다. 현재 Gemini 무료 계정에서는 가상 시연만 진행합니다. [Gemini 약관](https://ai.google.dev/gemini-api/terms), [외부 자산 고지](THIRD_PARTY_NOTICES.md).
