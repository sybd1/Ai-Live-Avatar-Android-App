# 아바타 응답 없음·CPU 사용량 점검

검사일: 2026.10.25. 이 PC의 프로젝트 에뮬레이터와 가상 사용자만 사용했다.

## 확인한 정지 지점

Android가 실제로 기록한 오류는 `Input dispatching timed out`이다. 터치에 약 5초간 응답하지 못했다.

- 앱 메인 스레드: `HardwareRenderer.syncAndDrawFrame`에서 렌더링 완료를 기다림.
- 렌더링 스레드: Chromium의 `WebViewFunctor.drawGl` 경로에서 대기.
- 당시 그래픽 모드: CPU로 그리는 SwiftShader 시험 설정.

이는 화면 렌더링 경로가 막힌 증거다. CPU 사용률 숫자 하나만으로 전체 원인을 확정하지 않는다. 오류 이후 앱이 종료된 상태의 낮은 CPU 측정값도 오류 순간의 부하로 해석하지 않는다. Gemini 모델은 원격 API에서 동작하며, 로컬 Whisper는 음성 인식 요청 때 별도로 CPU를 사용한다.

[Android ANR 진단](https://developer.android.com/topic/performance/anrs/diagnose-and-fix-anrs)은 입력 타임아웃과 렌더링 대기의 구분을 설명한다.

## 적용한 변경

| 부분 | 변경 |
| --- | --- |
| 에뮬레이터 | 호스트 GPU의 OpenGL 사용, Vulkan 비활성화. SwiftShader를 기본값으로 확정하지 않음 |
| 가상 화면 | 720×1280 / 280dpi. 이전 1080×1920 / 420dpi와 논리적 화면 크기는 유지 |
| 3D 렌더링 | 픽셀 비율 최대 1, 안티앨리어싱 끔, 텍스처 비등방성 최대 2 |
| 프레임 | 대기 중 최대 8fps, 음성 준비·재생 중 최대 24fps. 숨겨진 문서는 렌더링 생략 |
| 대화 화면 | WebView를 스크롤 영역 밖에 고정. Android 하드웨어 레이어 사용 |
| 입력·중단 | 키보드 표시·쉬기 상태에서 3D 뷰 해제. 키보드 위로 멈춤·종료 버튼 배치 |
| 자원 해제 | 뷰 종료 시 SDK 정리 요청. 중복 중단 타이머 제거. 오류가 녹음·생성 상태를 덮어쓰지 않도록 보완 |

SDK 0.1.3은 프레임·픽셀 비율 옵션이 없어 `mobile/scripts/avatar-mobile-profile.mjs`에서 번들 생성 중 모바일 프로파일을 적용한다. 설치된 원본 패키지를 직접 수정하지 않는다. SDK 버전과 변경 지점이 다르면 빌드를 중단해 검토하도록 했다. SDK와 Three.js 라이선스 고지는 유지한다.

Vulkan 비활성화는 Chrome 그래픽 호환성 문제에 대한 [Android 공식 안내](https://developer.android.com/studio/run/emulator-troubleshooting)를 참고했다. 이 설정이 모든 기기의 그래픽 문제를 해결한다는 뜻은 아니다.

## 이 PC의 짧은 CPU 측정

측정 대상은 `firststep_api36`의 QEMU 프로세스다. 논리 CPU 12개 전체를 100%로 계산하며, 각 표본은 약 3초다. Windows 작업 관리자와 같은 전체 CPU 기준으로 읽는다. Android ANR 보고서의 프로세스별 CPU 수치와 분모가 다르다.

| 상태 | 측정 CPU |
| --- | --- |
| 시작 화면 | 약 1.4% |
| 공고 화면 스크롤 | 약 6.9~7.5% |
| 3D 아바타 대기·스크롤 후 | 약 3.9~4.6% |
| 3D 음성 재생을 포함한 구간 | 약 6.6~8.3% |
| 멈춤 후 3D 뷰 해제 | 약 1.0~1.1% |

재현 명령:

```powershell
.\scripts\measure-demo-performance.ps1 -Phase avatar-idle -Samples 3 -Seconds 3
```

원시 표본은 `.tools/performance-measurements.jsonl`에 있다. 수정 전 같은 조건의 연속 CPU 표본은 없으므로 감소율을 산출하지 않는다. 콜드 부팅·초기 모델 로딩·음성 인식·다른 프로그램 부하에 따른 순간 최대값을 보장하는 검사도 아니다.

## 확인한 시나리오

- 공식 근거 링크에서 Chrome 활동이 열린 것을 확인한 뒤 앱 복귀, 상하 스크롤 5회 왕복.
- 3D 아바타가 표시된 상태에서 대화 영역 8회 왕복 스크롤.
- 실제 Gemini TTS 예시를 3D 아바타로 재생하고 Android AAudio 시작 확인.
- 재생 중 멈춤, 아바타 해제 후 CPU 측정, 직접 재개.
- 최종 APK의 키보드 표시 시 아바타 해제, 키보드 상단 734px보다 위에 멈춤 버튼 하단 603px·종료 버튼 하단 713px가 있는 것을 확인.
- 키보드를 닫은 뒤 아바타 재표시, 연습 종료·결과 화면 이동.
- 위 검사 동안 새 ANR 기록 0건.

새 APK를 설치하고 타입 검사·모바일 중단 세대 테스트 3개와 비밀값 미포함 검사를 통과했다. APK 정보는 `artifacts/apk-verification.json`, 키보드 배치 판정은 `.tools/performance-keyboard-check.json`에 있다. 실제 휴대전화·장시간 사용·다른 GPU의 안정성은 별도 검증 대상이다.
