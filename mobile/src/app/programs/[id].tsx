import { useEffect,useState } from 'react';
import { router,useLocalSearchParams } from 'expo-router';
import { Body,Button,Card,ErrorText,Screen,Title,openOfficial } from '@/components/mvp';
import { request } from '@/lib/api';
import type { Program } from '@/lib/types';
export default function Detail(){
 const {id}=useLocalSearchParams<{id:string}>();const [p,setP]=useState<Program|null>(null);const [occ,setOcc]=useState('');const [error,setError]=useState('');
 useEffect(()=>{let live=true;request<Program>(`/programs/${id}`).then(p=>{if(live){setP(p);setOcc(p.occurrences[0]?.id??'');}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[id]);
 const o=p?.occurrences.find(o=>o.id===occ);
 return <Screen><Title>{p?.title??'공고 확인 중'}</Title><ErrorText error={error}/>{p&&<>
  {p.synthetic&&<Card><Body>가상 시연 공고예요. 실제 모집 정보가 아니에요.</Body></Card>}
  <Body>{p.organizer} · {p.region??'지역 확인 필요'}</Body><Body>연령 조건: {p.minAge??'확인 필요'} ~ {p.maxAge??'확인 필요'}</Body>
  <Body>모집: {p.applicationStart??'확인 필요'} ~ {p.applicationEnd??'확인 필요'}</Body>
  <Body>공식 자료 확인: {new Date(p.verifiedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}{Date.now()-Date.parse(p.verifiedAt)>86400000?' · 갱신 지연':''}</Body>
  {!p.synthetic&&<Button title="공식 안내 보기" secondary onPress={()=>void openOfficial(p.officialUrl)}/>}
  <Body>회차 선택</Body>{p.occurrences.map(x=><Button key={x.id} title={`${x.id===occ?'선택됨 · ':''}${x.title}`} secondary onPress={()=>setOcc(x.id)}/>)}
  {o&&<><Title>참여 미리보기</Title><Body>시각·순서는 공식 자료에서 확인한 범위만 표시해요. 출발지 이동 시간은 별도 예상 정보예요.</Body>
   {o.timeline.map(step=><Card key={step.id}><Body>{step.orderIndex===null?'프로그램 구성 · ':`${step.orderIndex}. `}{step.title}</Body><Body>{step.time??'정확한 시각 확인 필요'}</Body>
    {step.factIds.map(fid=>{const f=p.facts.find(f=>f.id===fid);return f?<Card key={fid}><Body>근거: {f.quote}</Body><Body>{f.locator}</Body>{!p.synthetic&&<Button title="공식 근거 보기" secondary onPress={()=>void openOfficial(f.sourceUrl)}/>}</Card>:<Body key={fid}>근거 확인 필요</Body>;})}</Card>)}
   <Title>준비물</Title>{o.preparations.length===0&&<Body>공식 준비물 확인 필요</Body>}{o.preparations.map((x,i)=><Preparation key={`${occ}-${i}`} label={x.label} kind={x.kind}/>)}
   <Title>확인 필요</Title>{o.unknowns.map(x=><Body key={x}>· {x}</Body>)}
   <Body>활동 장소: {o.address??'확인 필요'}</Body><Button title="찾아오는 방법" secondary onPress={()=>router.push({pathname:'/route',params:{id:p.id,occ}})}/>
   <Button title="이 프로그램에서 연습하기" onPress={()=>router.push({pathname:'/practice/setup',params:{id:p.id,occ}})}/>
  </>}
 </>}</Screen>;
}
function Preparation({label,kind}:{label:string;kind:string}){const [checked,setChecked]=useState(false);return <Card><Body>{kind==='required'?'공식 필수':kind==='optional'?'공식 권장':'확인 필요'} · {label}</Body>{kind!=='unknown'&&<Button title={checked?'준비 확인됨':'준비했어요'} secondary onPress={()=>setChecked(!checked)}/>}</Card>;}
