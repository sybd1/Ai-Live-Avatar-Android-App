import { useEffect,useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Body,Button,Card,Check,ErrorText,Field,Screen,Title,openOfficial } from '@/components/mvp';
import { post,request } from '@/lib/api';
import type {Program} from '@/lib/types';
type Place={label:string;longitude:number;latitude:number};
export default function Route(){
 const {id,occ}=useLocalSearchParams<{id:string;occ:string}>();const [p,setP]=useState<Program|null>(null);const [query,setQuery]=useState('');const [consent,setConsent]=useState(false);const [places,setPlaces]=useState<Place[]>([]);const [origin,setOrigin]=useState<Place|null>(null);const [steps,setSteps]=useState<string[]>([]);const [seconds,setSeconds]=useState<number|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{request<Program>(`/programs/${id}`).then(setP).catch(e=>setError(e.message));return()=>{setOrigin(null);setPlaces([]);};},[id]);
 const o=p?.occurrences.find(o=>o.id===occ);
 async function search(){setBusy(true);setError('');setSteps([]);try{setPlaces((await post<{items:Place[]}>('/locations/search',{query})).items);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function route(mode:string){if(!p||!origin)return;setBusy(true);setError('');try{const r=await post<{steps:string[];estimatedSeconds:number|null}>(`/programs/${id}/routes`,{occurrenceId:occ,expectedVersionId:p.versionId,originCoordinates:{longitude:origin.longitude,latitude:origin.latitude},mode,locationConsent:consent});setSteps(r.steps);setSeconds(r.estimatedSeconds);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Screen><Title>찾아오는 방법</Title><Body>공식 활동 장소: {o?.address??'확인 필요'}</Body><Body>층·호실·출입구·무장애 경로는 별도 공식 안내가 없으면 확인 필요예요.</Body>
  {o?.address&&<><Button title="공식 주소 복사" secondary onPress={()=>void Clipboard.setStringAsync(o.address!)}/><Button title="공식 지도에서 장소 찾기" secondary onPress={()=>void openOfficial(`https://map.kakao.com/link/search/${encodeURIComponent(o.address!)}`)}/></>}
  <Check label="출발 주소를 카카오 지도 서비스에 전송해 경로를 찾겠어요" checked={consent} onChange={setConsent}/><Field label="출발 주소 직접 입력" value={query} onChangeText={v=>{setQuery(v);setOrigin(null);setSteps([]);}} maxLength={100}/>
  <Button title="출발 주소 검색" onPress={search} disabled={!consent||!query.trim()||busy}/>{places.map((x,i)=><Button key={i} title={`${origin===x?'선택됨 · ':''}${x.label}`} secondary onPress={()=>setOrigin(x)}/>)}
  <Button title="대중교통 경로" onPress={()=>route('publicTransit')} disabled={!origin||!consent||busy}/><Button title="도보 경로" secondary onPress={()=>route('walk')} disabled={!origin||!consent||busy}/>
  <ErrorText error={error}/>{seconds!==null&&<Body>조회 시점 예상 이동: 약 {Math.ceil(seconds/60)}분 · 실제 도착 시각을 보장하지 않아요.</Body>}{steps.map((s,i)=><Card key={i}><Body>{i+1}. {s}</Body></Card>)}
  <Body>출발지는 프로필이나 대화 AI로 보내지 않아요. 현재 위치 자동 조회는 이 MVP에서 연결 전이며 직접 입력할 수 있어요.</Body>
 </Screen>;
}
