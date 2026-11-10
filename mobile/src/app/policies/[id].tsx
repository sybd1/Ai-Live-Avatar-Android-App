import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, ErrorText, Screen, Title, openOfficial } from '@/components/mvp';
import { request } from '@/lib/api';
import type { YouthPolicy } from '@/lib/types';
import { ageText } from '@/lib/youth-policy';
export default function PolicyDetail() {
  const {id}=useLocalSearchParams<{id:string}>();const [p,setP]=useState<YouthPolicy|null>(null);const [error,setError]=useState('');
  useEffect(()=>{let live=true;request<YouthPolicy>(`/youth-policies/${encodeURIComponent(id)}`).then(r=>{if(live)setP(r);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[id]);
  const section=(label:string,value:string|null)=>value?<Card key={label}><Body>{label}</Body><Body>{value}</Body></Card>:null;
  return <Screen><Title>{p?.title??'정책 확인 중'}</Title><ErrorText error={error}/>{p&&<>
    <Card><Body>온통청년에 등록된 내용이에요. 지원 대상인지 여부는 판단하지 않으며, 신청 전 기관 공식 안내를 확인해 주세요.</Body></Card>
    <Body>{p.organizer??'기관 확인 필요'}{p.region?` · ${p.region}`:''}{p.category?` · ${p.category}`:''}</Body>
    <Body>신청 기간: {p.applyPeriod??'확인 필요'}</Body><Body>사업 기간: {p.businessPeriod??'확인 필요'}</Body><Body>연령: {ageText(p)}</Body>
    {section('정책 설명',p.summary)}{section('지원 내용',p.support)}{section('추가 자격 조건',p.conditions)}{section('참여 제한 대상',p.excluded)}
    {section('신청 방법',p.applyMethod)}{section('심사 방법',p.screening)}{section('제출 서류',p.documents)}{section('기타',p.etc)}
    <Button title="온통청년에서 원문 보기" onPress={()=>void openOfficial(p.officialUrl)}/>
    {p.applyUrl&&<Button title="신청 사이트 열기" secondary onPress={()=>void openOfficial(p.applyUrl!)}/>}
    {p.referenceUrl&&p.referenceUrl!==p.applyUrl&&<Button title="참고 사이트 열기" secondary onPress={()=>void openOfficial(p.referenceUrl!)}/>}
    <Body>출처: {p.source} · 최종 수정 {p.updatedAt??'확인 필요'} · 조회 {new Date(p.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</Body>
  </>}</Screen>;
}
