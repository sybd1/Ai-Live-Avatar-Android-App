# 임시 아바타 자산

| 자산 | 출처·사용권 | 적용 |
| --- | --- | --- |
| Talking Avatar SDK 0.1.3 | https://github.com/interviewflowai/talking-avatar · MIT | 오픈소스 얼굴·립싱크, 유료 Realistic Avatars는 미사용 |
| viseme-model.bin | 설치한 SDK의 dist/viseme-model.bin | SDK 패키지와 라이선스 고지 함께 보관 |
| mpfb.glb | https://github.com/met4citizen/TalkingHead · README의 해당 모델 사용권 CC0 | 임시 모델, 정확한 Git 트리 식별자는 provenance.json |
| Three.js | https://github.com/mrdoob/three.js · MIT | 번들 내 라이선스 고지 유지 |

모델 바이너리의 입 모양 데이터는 확인했다. `viseme_sil`은 없으며 SDK 매핑에서 비활성화하고 다른 입 모양을 0으로 되돌린 중립 상태를 사용한다. 나머지 표준 viseme은 포함되어 있다. 이는 실기기 시각 검증을 대체하지 않는다.

모델·텍스처·립싱크는 기기에서 처리한다. 사용자 카메라·얼굴·사용자 음성을 아바타 SDK에 보내지 않고 AI 출력 음성만 전달한다. 가상 대사는 실시간 스트리밍, 정책 안내는 서버 근거 확인 후 별도 음성이다. SDK 라이선스 원문은 SDK-LICENSE.txt, 모델 출처는 provenance.json에 기록했다. 소스에서 모델을 준비할 때는 `npm run prepare:assets`로 고정된 출처와 체크섬을 확인한다.

SDK 0.1.3의 모바일 렌더링 설정은 `mobile/scripts/avatar-mobile-profile.mjs`에서 번들 생성 중 적용한다. 프레임 상한(대기 8/음성 24), 픽셀 비율 1, 안티앨리어싱 비활성화, 텍스처 비등방성 상한 2를 적용하며 원본 설치 파일과 라이선스 고지는 유지한다. SDK 버전이나 변경 지점이 달라지면 빌드를 중단해 재검토한다.
