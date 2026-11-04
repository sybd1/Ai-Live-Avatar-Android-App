import { useEffect,useState } from 'react';
import { router } from 'expo-router';
import { Body,Button,Check,ErrorText,Field,Screen,Title } from '@/components/mvp';
import { request } from '@/lib/api';
import type { Profile } from '@/lib/types';
export default function Preferences(){
 const [p,setP]=useState<Profile>({version:0,interests:[],modes:[],concerns:[],age:null,region:null});const [error,setError]=useState('');const [busy,setBusy]=useState(true);
 useEffect(()=>{request<Profile>('/profile').then(setP).catch(e=>setError(e.message)).finally(()=>setBusy(false));},[]);
 const toggle=(field:'interests'|'modes'|'concerns',v:string,on:boolean)=>setP(p=>({...p,[field]:on?[...p[field],v]:p[field].filter(x=>x!==v)}));
 async function save(){setBusy(true);try{await request('/profile',{method:'PUT',body:JSON.stringify(p)});router.back();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Screen><Title>원하는 것만 선택해요</Title><Body>모든 입력은 선택이에요. 고립 기간·성격·질환을 추정하지 않아요.</Body>
  <Body>관심 활동</Body>{['요리','산책','문화','일경험'].map(v=><Check key={v} label={v} checked={p.interests.includes(v)} onChange={on=>toggle('interests',v,on)}/>)}
  <Body>참여 방식</Body>{['온라인','오프라인'].map(v=><Check key={v} label={v} checked={p.modes.includes(v)} onChange={on=>toggle('modes',v,on)}/>)}
  <Body>연습하고 싶은 상황</Body>{['첫 인사','자기소개','도움 요청'].map(v=><Check key={v} label={v} checked={p.concerns.includes(v)} onChange={on=>toggle('concerns',v,on)}/>)}
  <Field label="나이 (선택)" keyboardType="numeric" maxLength={2} value={p.age?.toString()??''} onChangeText={v=>setP(p=>({...p,age:v&&/^\d+$/.test(v)?Number(v):null}))}/>
  <Check label="서울 거주 (선택)" checked={p.region==='서울'} onChange={on=>setP(p=>({...p,region:on?'서울':null}))}/>
  <Button title="확인한 선호로 목록 보기" onPress={save} disabled={busy}/><Button title="건너뛰기" secondary onPress={()=>router.back()}/><ErrorText error={error}/>
 </Screen>;
}
