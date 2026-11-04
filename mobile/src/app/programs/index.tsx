import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Screen, Title } from '@/components/mvp';
import { clearSession, request } from '@/lib/api';
import type { Program } from '@/lib/types';
type Result = { recommendationMode: string; items: { program: Program; reasons: string[]; eligibility: string; barrierComparable: boolean }[]; nextCursor: number | null };
export default function Programs() {
  const [data,setData]=useState<Result|null>(null); const [search,setSearch]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const load=useCallback(async (query='')=>{setBusy(true);setError('');try{setData(await request<Result>(`/programs?search=${encodeURIComponent(query)}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}},[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  async function end(){try{await request('/sessions/current',{method:'DELETE'});}catch{}finally{clearSession();router.replace('/');}}
  return <Screen><Title>프로그램 둘러보기</Title><Body>{data?.recommendationMode==='personalized'?'확인한 관심·참여 방식으로 정렬했어요.':'공고에서 확인한 참여 절차 부담을 기준으로 안내해요. 합격 가능성을 뜻하지 않아요.'}</Body>
    <Button title="관심·참여 방식 선택" secondary onPress={()=>router.push('/preferences')} />
    <Button title="내 상태 기록·그래프" secondary onPress={()=>router.push('/history')} />
    <Field label="공고 제목·기관 검색" value={search} onChangeText={setSearch} maxLength={100}/><Button title={busy?'조회 중…':'목록 확인'} onPress={()=>load(search)} disabled={busy}/><ErrorText error={error}/>
    {data?.items.length===0&&<Card><Body>현재 조건에서 확인된 모집 프로그램이 없어요. 공식 공고가 아직 등록되지 않았을 수도 있어요.</Body><Button title="검색 초기화" secondary onPress={()=>{setSearch('');void load();}}/></Card>}
    {data?.items.map(({program:p,reasons,barrierComparable})=><Card key={p.id}><Body>{p.synthetic?'[가상 시연 공고] ':''}{p.title}</Body><Body>{p.organizer} · 참여 조건 확인 필요</Body>
      {reasons.map((r,i)=><Body key={i}>{r}</Body>)}{!barrierComparable&&<Body>장벽 비교에 필요한 정보 확인 필요</Body>}
      <Body>모집 마감: {p.applicationEnd??'확인 필요'}{p.applicationEnd?.length===10?' · 마감 시각 확인 필요':''}</Body>
      <Body>자료 확인: {new Date(p.verifiedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</Body>
      <Button title="참여 미리보기" onPress={()=>router.push({pathname:'/programs/[id]',params:{id:p.id}})}/></Card>)}
    <Button title="오늘은 여기까지 · 세션 자료 지우기" secondary onPress={end}/>
  </Screen>;
}
