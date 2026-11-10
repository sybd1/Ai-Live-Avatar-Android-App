import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, ErrorText, Field, Screen, Title } from '@/components/mvp';
import { request } from '@/lib/api';
import type { YouthPolicySummary } from '@/lib/types';
import { ageText } from '@/lib/youth-policy';
type Result = { items: YouthPolicySummary[]; total: number; nextPage: number | null; fetchedAt: string };
export default function Policies() {
  const [items,setItems]=useState<YouthPolicySummary[]>([]);const [result,setResult]=useState<Result|null>(null);const [search,setSearch]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const load=useCallback(async (query:string,page=1)=>{setBusy(true);setError('');try{const r=await request<Result>(`/youth-policies?search=${encodeURIComponent(query.trim())}&page=${page}`);setResult(r);setItems(prev=>page===1?r.items:[...prev,...r.items]);}catch(e){setError((e as Error).message);}finally{setBusy(false);}},[]);
  useEffect(()=>{void load('');},[load]);
  return <Screen><Title>청년정책 찾아보기</Title><Body>온통청년에 등록된 청년정책을 그대로 보여드려요. 자격·마감은 기관 공식 안내에서 다시 확인해 주세요. 이 목록은 연습용 프로그램 추천과 별개예요.</Body>
    <Field label="정책 이름 검색" value={search} onChangeText={setSearch} maxLength={50}/><Button title={busy?'조회 중…':'정책 검색'} onPress={()=>{setItems([]);void load(search);}} disabled={busy}/><ErrorText error={error}/>
    {result&&<Body>전체 {result.total.toLocaleString('ko-KR')}건 · 조회 {new Date(result.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</Body>}
    {result&&items.length===0&&<Card><Body>검색 결과가 없어요. 다른 단어로 찾아볼 수 있어요.</Body></Card>}
    {items.map(p=><Card key={p.id}><Body>{p.title}</Body><Body>{p.organizer??'기관 확인 필요'}{p.category?` · ${p.category}`:''}</Body>
      <Body>신청 기간: {p.applyPeriod??'확인 필요'} · 연령: {ageText(p)}</Body>
      <Button title="자세히 보기" secondary onPress={()=>router.push({pathname:'/policies/[id]',params:{id:p.id}})}/></Card>)}
    {result?.nextPage&&<Button title={busy?'조회 중…':'더 보기'} secondary disabled={busy} onPress={()=>void load(search,result.nextPage!)}/>}
    <Body>출처: 온통청년(youthcenter.go.kr) 청년정책 Open API</Body>
  </Screen>;
}
