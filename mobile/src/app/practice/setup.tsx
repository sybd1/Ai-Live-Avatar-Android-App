import {useEffect,useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {Body,Button,Card,Check,ErrorText,Screen,Title} from '@/components/mvp';
import {post,request} from '@/lib/api';
import type {Program,Practice,Capabilities} from '@/lib/types';
export default function Setup(){
 const {id,occ}=useLocalSearchParams<{id:string;occ:string}>();const [program,setProgram]=useState<Program|null>(null);const [caps,setCaps]=useState<Capabilities|null>(null);const [scene,setScene]=useState('greeting');const [mode,setMode]=useState('short');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{Promise.all([request<Program>(`/programs/${id}`),request<Capabilities>('/capabilities')]).then(([p,c])=>{setProgram(p);setCaps(c);}).catch(e=>setError(e.message));},[id]);
 const [aiConsent,setAiConsent]=useState(false);
 async function start(){if(!program)return;setBusy(true);setError('');try{const p=await post<Practice>('/practices',{programId:id,occurrenceId:occ,expectedVersionId:program.versionId,sceneTemplateId:scene,difficulty:mode,aiConsent});router.replace({pathname:'/practice/check-in',params:{id:p.practiceId,stage:'pre',title:program.title}});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Screen><Title>미리 연습해 볼까요?</Title><Body>{program?.title}</Body><Card><Body>AI 아바타와 하는 가상 연습이에요. 실제 직원·참여자의 반응이나 프로그램 진행을 그대로 재현하지 않아요. 언제든 멈출 수 있어요.</Body><Body>현재는 가상 사용자 전용 시연이에요. 실제 개인 사연은 입력하지 마세요.</Body></Card>
  <Body>연습할 장면</Body>{[['greeting','첫 인사'],['introduction','자기소개'],['asking-help','도움 요청']].map(([v,label])=><Button key={v} title={`${scene===v?'선택됨 · ':''}${label}`} secondary onPress={()=>setScene(v)}/>)}
  <Body>내가 고르는 방식</Body>{[['watch','먼저 지켜보기'],['short','짧게 답하기'],['free','자유 대화']].map(([v,label])=><Button key={v} title={`${mode===v?'선택됨 · ':''}${label}`} secondary onPress={()=>setMode(v)}/>)}
  {caps&&!caps.text&&<Body>대화 AI 연결 필요 · 연결 전에는 실제 AI 대화를 진행할 수 없어요.</Body>}{caps&&!caps.stt&&!caps.live&&<Body>음성 인식 연결 필요 · 텍스트로 연습할 수 있어요.</Body>}
  <Body>일정·장소가 미확인이면 범용 가상 장면만 연습해요. 마이크 권한은 말하기를 선택할 때 요청해요.</Body>
  <Check label="가상 입력·답변을 Gemini로 전송해 연습하는 데 동의해요" checked={aiConsent} onChange={setAiConsent}/>
  <Body>다음 화면의 상태 체크는 선택이에요. 연습 시작 후에는 말할 때마다 녹음·전송 버튼을 누르지 않아도 돼요.</Body>
  <Button title="다음 · 연습 전 상태 체크" onPress={start} disabled={!program||busy||!aiConsent}/><ErrorText error={error}/>
 </Screen>;
}
