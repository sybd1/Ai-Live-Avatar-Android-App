import {useState} from 'react';
import {Alert,View} from 'react-native';
import {Svg,Line,Circle,Text as SvgText} from 'react-native-svg';
import {Body,Button,Card,ErrorText,Screen,Title} from '@/components/mvp';
import {deleteCheckIns,measures,readCheckIns,type CheckIn,type Measure} from '@/lib/check-ins';

export default function History(){
 const [error,setError]=useState('');const [rows,setRows]=useState<CheckIn[]>(()=>{try{return readCheckIns();}catch(e){setTimeout(()=>setError((e as Error).message),0);return [];}});const [measure,setMeasure]=useState<Measure>('anxiety');const [page,setPage]=useState(0);const [deleting,setDeleting]=useState(false);
 function remove(id?:string){if(deleting)return;Alert.alert('기록 삭제',id?'이 연습의 상태 기록을 삭제할까요?':'이 기기에 저장된 상태 기록을 모두 삭제할까요?',[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:async()=>{setDeleting(true);try{await deleteCheckIns(id);setRows(readCheckIns());setPage(0);setError('');}catch(e){setError((e as Error).message);}finally{setDeleting(false);}}}]);}
 const recent=rows.slice(-12);const x=(i:number)=>36+i*260/Math.max(1,recent.length-1);const y=(n:number)=>180-n*15;const label=measures.find(m=>m.key===measure)!.label;
 return <Screen><Title>내 상태 기록</Title><Body>직접 응답한 현재 느낌의 기록이에요. 진단 결과나 치료 효과가 아니며, 관리자·AI에게 공유하지 않아요. 앱 삭제 시 기록도 사라져요.</Body>
  <Body>자존감은 높을수록 긍정적인 방향이고, 나머지 항목은 높을수록 그 느낌이 강해요. 합산 점수는 만들지 않아요.</Body>
  <ErrorText error={error}/>{measures.map(m=><Button key={m.key} title={`${measure===m.key?'선택됨 · ':''}${m.label}`} secondary onPress={()=>setMeasure(m.key)}/>)}
  <Card><Body>{label} · 최근 {recent.length}회 · 연습 전: 세이지 / 연습 후: 청록</Body><Body>가로축: 연습 날짜 순서 · 세로축: 0~10점. 미응답은 점을 표시하거나 연결하지 않아요.</Body>
   <View accessible accessibilityLabel={`${label}의 전후 변화 그래프. 아래에 같은 수치를 문자로 제공합니다.`}><Svg width="100%" height={220} viewBox="0 0 330 220">
    {[0,5,10].map(n=><ViewlessGrid key={n} n={n} y={y(n)}/>)}
    {(['pre','post'] as const).map(stage=>recent.map((r,i)=>{const value=r[stage]?.scores[measure];if(value===null||value===undefined)return null;const prior=i?recent[i-1][stage]?.scores[measure]:null;const color=stage==='pre'?'#78958A':'#42665D';return <GPoint key={`${stage}-${r.practiceId}`} x={x(i)} y={y(value)} color={color} from={i>0&&prior!==null&&prior!==undefined?{x:x(i-1),y:y(prior)}:undefined}/>;}))}
    {recent.map((r,i)=><SvgText key={r.practiceId} x={x(i)} y={205} fontSize={9} textAnchor="middle" fill="#20382F">{new Date((r.pre??r.post)!.at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})}</SvgText>)}
   </Svg></View>{!rows.length&&<Body>저장한 응답이 아직 없어요. 연습 전후에 원할 때 기록할 수 있어요.</Body>}</Card>
  <Body>전체 {rows.length}회 · 기록 페이지 {page+1}</Body>
  {rows.slice(Math.max(0,rows.length-(page+1)*20),Math.max(0,rows.length-page*20)).reverse().map(r=>{const before=r.pre?.scores[measure],after=r.post?.scores[measure];const delta=before!=null&&after!=null?after-before:null;return <Card key={r.practiceId}><Body>{r.programTitle} · {new Date((r.pre??r.post)!.at).toLocaleString('ko-KR')}</Body><Body>{label}: 전 {before??'미응답'} → 후 {after??'미응답'}{delta!==null?` · 차이 ${delta>0?'+':''}${delta}`:''}</Body><Button title="이 기록 삭제" secondary onPress={()=>remove(r.practiceId)}/></Card>;})}
  <Button title="더 이전 기록" secondary disabled={(page+1)*20>=rows.length} onPress={()=>setPage(p=>p+1)}/><Button title="더 최근 기록" secondary disabled={page===0} onPress={()=>setPage(p=>p-1)}/>
  {deleting&&<Body>기록을 삭제하고 있어요…</Body>}<Button title="이 기기의 모든 상태 기록 삭제" secondary disabled={deleting} onPress={()=>remove()}/>
 </Screen>;
}
function ViewlessGrid({n,y}:{n:number;y:number}){return <><Line x1={30} x2={310} y1={y} y2={y} stroke="#CEDAD2"/><SvgText x={12} y={y+4} fontSize={12} fill="#20382F">{n}</SvgText></>;}
function GPoint({x,y,color,from}:{x:number;y:number;color:string;from?:{x:number;y:number}}){return <>{from&&<Line x1={from.x} y1={from.y} x2={x} y2={y} stroke={color} strokeWidth={2}/>}<Circle cx={x} cy={y} r={4} fill={color}/></>;}
