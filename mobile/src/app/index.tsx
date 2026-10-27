import { useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, Check, ErrorText, Field, Screen, Title } from '@/components/mvp';
import { configureServer, getBaseUrl, request, startSession } from '@/lib/api';
export default function Welcome() {
  const [server,setServer]=useState(getBaseUrl()); const [synthetic,setSynthetic]=useState(false);
  const [voice,setVoice]=useState(false); const [preference,setPreference]=useState(false);
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function enter() { setBusy(true);setError(''); try {configureServer(server);await request('/capabilities');await startSession(voice,preference);router.push('/programs');}catch(e){setError((e as Error).message);}finally{setBusy(false);} }
  return <Screen><Title>내 속도로, 한 걸음</Title><Body>참여하고 싶은 프로그램을 살펴보고, 가기 전에 알아보고 연습해요. 둘러보기만 해도 괜찮아요.</Body>
    <Card><Body>가상 사용자 전용 MVP 시연이에요. 실제 개인 사연·이름·연락처를 입력하지 마세요. 실제 정보와 가상 연습을 구분해서 표시해요.</Body></Card>
    <Field label="시연 서버 주소" value={server} onChangeText={setServer} keyboardType="url" />
    <Body>에뮬레이터: http://10.0.2.2:8080 / USB와 adb reverse 사용 시: http://127.0.0.1:8080. 공개 운영에는 HTTPS가 필요해요.</Body>
    <Check label="가상 인물로 시연하며 개인정보를 입력하지 않겠어요" checked={synthetic} onChange={setSynthetic} />
    <Check label="녹음·음성 인식 처리에 동의해요 (선택)" checked={voice} onChange={setVoice} />
    <Body>음성 연습은 우리 서버를 통해 Gemini Live로 음성을 전송해요. 대체 경로에서는 우리 음성 인식 서버가 인식한 발화를 Gemini로 보내요. 발화마다 전송 버튼을 누르지 않아요. 무료 Gemini의 데이터 이용 조건이 적용돼요. 가상 대사만 말해 주세요.</Body>
    <Check label="대화에서 관심·선호 후보를 추출해 확인하겠어요 (선택)" checked={preference} onChange={setPreference} />
    <Body>분석을 거절해도 둘러보기·연습을 이용할 수 있어요. 대화·선호는 세션에서만 처리해요. 별도로 저장을 선택한 전후 상태 응답은 이 휴대폰에 남으며 기록 화면에서 삭제할 수 있어요. AI·서버에는 보내지 않아요.</Body>
    <Button title="이 기기의 내 상태 기록·그래프" secondary onPress={()=>router.push('/history')} />
    <Button title={busy?'연결 확인 중…':'프로그램 둘러보기'} onPress={enter} disabled={!synthetic||busy} /><ErrorText error={error} />
    <Button title="Gemini 데이터 조건 보기" secondary onPress={()=>void import('@/components/mvp').then(m=>m.openOfficial('https://ai.google.dev/gemini-api/terms'))} />
    <Button title="도움 안내" secondary onPress={()=>router.push('/help')} />
  </Screen>;
}
