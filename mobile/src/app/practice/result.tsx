import {useEffect,useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {Body,Button,Card,Check,ErrorText,Screen,Title} from '@/components/mvp';
import {post,request,requestId} from '@/lib/api';
import type {Practice,Program,Profile} from '@/lib/types';
type Candidate={field:'interests'|'modes'|'concerns';value:string;evidence:string};
export default function Result(){
 const {id}=useLocalSearchParams<{id:string}>();const [context,setContext]=useState<{program:Program;practice:Practice}&{occurrenceId?:string}>(null!);const [items,setItems]=useState<Candidate[]>([]);const [selected,setSelected]=useState<number[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [checked,setChecked]=useState(false);
 useEffect(()=>{post(`/practices/${id}/end`,{requestId:requestId()}).then(()=>request<{program:Program;practice:Practice}>(`/practices/${id}/context`)).then(setContext).catch(e=>setError(e.message));},[id]);
 async function extract(){setBusy(true);setError('');try{const r=await post<{candidates:Candidate[]}>(`/practices/${id}/preference-candidates`,{});setItems(r.candidates);setChecked(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function save(){setBusy(true);setError('');try{const p=await request<Profile>('/profile');const result={...p,interests:[...p.interests],modes:[...p.modes],concerns:[...p.concerns]};selected.forEach(i=>{const x=items[i];if(!result[x.field].includes(x.value))result[x.field].push(x.value);});await request('/profile',{method:'PUT',body:JSON.stringify(result)});router.replace('/programs');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function skip(){try{await request(`/practices/${id}/preference-candidates`,{method:'DELETE'});router.replace('/programs');}catch(e){setError((e as Error).message);}}
 return <Screen><Title>오늘 살펴본 한 걸음</Title><Body>연습을 마쳤어요. 신청하거나 외출해야 완료되는 것은 아니에요. 원할 때 다음 행동을 선택할 수 있어요.</Body>
  <Card><Body>연습한 프로그램: {context?.program.title??'확인 중'}</Body><Body>다시 쓸 수 있는 문장: “안녕하세요.” / “처음이라 어떻게 하면 되는지 알려주세요.”</Body></Card>
  <Button title="내 상태 기록·전후 그래프 보기" secondary onPress={()=>router.push('/history')}/>
  <Button title="대화에서 선호 후보 확인" secondary onPress={extract} disabled={busy}/><Body>추천 분석에 별도 동의한 경우만 이용할 수 있어요. 확인하지 않은 후보는 추천에 반영하지 않아요.</Body>
  {items.map((x,i)=><Card key={`${x.field}-${x.value}-${i}`}><Check label={`${x.value} · 다음 추천에 사용`} checked={selected.includes(i)} onChange={on=>setSelected(on?[...selected,i]:selected.filter(v=>v!==i))}/><Body>내가 말한 근거: {x.evidence}</Body></Card>)}
  {checked&&!items.length&&<Body>명확하게 표현한 선호 후보가 없어요. 직접 관심을 선택할 수도 있어요.</Body>}
  {selected.length>0&&<Button title="선택한 선호만 확인 · 재추천" onPress={save} disabled={busy}/>}
  <Button title="선호 분석 건너뛰고 목록으로" secondary onPress={skip}/>
  {context&&<Button title="같은 프로그램에서 다시 연습" secondary onPress={()=>router.replace({pathname:'/programs/[id]',params:{id:context.program.id}})}/>}
  <ErrorText error={error}/>
 </Screen>;
}
