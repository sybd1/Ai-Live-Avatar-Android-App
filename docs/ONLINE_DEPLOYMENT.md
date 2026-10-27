# 온라인 Android 시연 배포

2026-10-27 배포 확인. 서버·다운로드 페이지: https://ai-live-avatar-android-app.vercel.app

Android 설치 파일은 [GitHub Releases](https://github.com/sybd1/Ai-Live-Avatar-Android-App/releases/latest)에서 `one_step_service-online.apk`를 받습니다.

## 구성

Android APK는 GitHub Releases에서 배포하고, 앱의 HTTPS 요청과 실시간 음성 연결은 Vercel의 Java 서버가 받습니다. 공고와 사용량 카운터는 Neon PostgreSQL에 저장합니다. 앱의 개인 상태 기록은 기기에 남으며 서버로 옮기지 않습니다.

- Vercel 프로젝트: `nmixx/ai-live-avatar-android-app`
- DB: `one-step-service-db`, Neon `free_v3`, Singapore
- 서버 빌드: 루트 `Dockerfile`, Java 21, Maven Wrapper
- API: `/api/v1`, 실시간 음성: `/api/v1/practices/{id}/live`
- 배포 환경: 가상 사용자 전용, Gemini 무료 시연, API 키는 서버 비밀 환경 변수

## 설정과 빌드

Vercel Container Runtime을 사용합니다. `PORT`와 `SERVER_PORT`는 `8080`, 바인드 주소는 `0.0.0.0`입니다. `DATABASE_URL`은 JDBC URL이며 인증서와 호스트를 검증하는 TLS 옵션을 사용합니다. DB 사용자·비밀번호와 Gemini·카카오 키는 소스나 APK에 넣지 않습니다.

온라인 APK는 `scripts/build-apk.ps1 -Architectures arm64-v8a -ApiBaseUrl https://서버주소`로 빌드합니다. 서버 주소에는 실제 배포·연결 검사를 통과한 HTTPS 주소를 지정합니다.

## 시연 범위와 제한

- 공개 HTTPS, 공식 공고 조회, 세션 간 접근 차단, Android Origin의 Live 스트리밍, 공식 근거·WAV 안내, 쉬기·종료를 확인했습니다. APK는 온라인 주소 포함·ARM64·서버 비밀값 미포함 검사를 통과했습니다. 휴대폰 스피커의 최종 청취 확인은 별도입니다.
- 현재 대화 세션과 임시 음성은 서버 메모리에 있습니다. 서버 재시작·새 인스턴스 배정으로 세션이 만료되면 앱에서 새 시연 세션을 시작해야 합니다. 다중 인스턴스 간 세션 공유는 구현되지 않았습니다.
- Vercel Hobby의 연결 실행 시간은 최대 300초입니다. Live 연결이 종료되면 현재 앱은 일시정지하며 이용자가 다시 시작해야 합니다. 무중단 장시간 대화를 보장하지 않습니다.
- Gemini 자체 할당량과 앱의 일일 600초 Live 제한은 별개입니다. 무음 전송도 집계됩니다. 유료 플랜이나 다른 유료 모델로 자동 전환하지 않습니다.
- 기본 공개 API는 가상 사용자 시연용입니다. 실제 이용자 운영에 필요한 계정·접근 정책과 장기 보관 기능은 별도 범위입니다.

근거: [Vercel Container Runtime](https://vercel.com/docs/functions/runtimes/container), [WebSocket 연결](https://vercel.com/docs/functions/websockets), [실행 시간 제한](https://vercel.com/docs/functions/configuring-functions/duration).
