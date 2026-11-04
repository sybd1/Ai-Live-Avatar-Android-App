# 외부 구성요소와 배포 범위

프로젝트 자체 코드의 이용 조건은 팀이 별도로 정한다. 아래 고지는 외부 구성요소에 대한 것으로 프로젝트 전체의 라이선스를 새로 부여하지 않는다.

| 구성요소 | 사용권·고지 |
| --- | --- |
| Expo 기본 템플릿 | 0BSD. 원문: `mobile/LICENSE` |
| Talking Avatar 0.1.3 | MIT. 원문: `mobile/assets/avatar/SDK-LICENSE.txt` |
| mpfb.glb | 고정된 TalkingHead 출처의 CC0 자산. 출처·해시: `mobile/assets/avatar/provenance.json`, `assets.lock.json` |
| Three.js | MIT. 웹 번들의 라이선스 주석 유지 |
| Expo·React Native 및 Android 의존성 | 패키지와 네이티브 라이브러리의 기존 라이선스 유지 |
| Spring Boot·PostgreSQL JDBC 등 | 배포 JAR 안의 의존성·라이선스 고지 유지 |
| 설치 도구 | PowerShell·Temurin Java·PostgreSQL·Android Platform Tools는 공식 배포처에서 별도 다운로드. 버전·체크섬은 `distribution/tools.lock.json` |

실행 ZIP에는 Java·DB·Android SDK 자체를 재배포하지 않는다. 처음 설정에서 공식 배포물을 프로젝트 폴더에 받으며 Android 도구는 사용자의 약관 동의 후 설치한다. [Android 약관](https://developer.android.com/studio/terms), [Temurin](https://adoptium.net/), [PostgreSQL](https://www.postgresql.org/about/licence/), [PowerShell](https://github.com/PowerShell/PowerShell).

공식 공고의 날짜·주소·인용·출처는 `data/warm-home-source.md`에서 확인한다. 외부 PDF·멘토 제공 자료·참가 신청서·API 키·개인 기록·녹음 파일은 이 저장소와 실행 ZIP의 배포 대상에 넣지 않는다.
