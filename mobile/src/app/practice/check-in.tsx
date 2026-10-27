import {useEffect,useRef,useState} from 'react';
import {View,Pressable,Text} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {Body,Button,Card,ErrorText,Screen,Title,colors} from '@/components/mvp';
import {emptyScores,measures,saveCheckIn} from '@/lib/check-ins';

export default function CheckInScreen(){
 const {id,stage:rawStage,title}=useLocalSearchParams<{id:string;stage:string;title:string}>();
 const stage=rawStage==='post'?'post':'pre';const [scores,setScores]=useState(emptyScores);const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);const saving=useRef(false);const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const next=()=>stage==='pre'?router.replace({pathname:'/practice/[id]',params:{id}}):router.replace({pathname:'/practice/result',params:{id}});
 async function save(){if(saving.current)return;saving.current=true;setBusy(true);try{await saveCheckIn(id,title??'프로그램 연습',stage,scores);if(alive.current)next();}catch(e){if(alive.current)setError((e as Error).message);}finally{saving.current=false;if(alive.current)setBusy(false);}}
 return <Screen><Title>{stage==='pre'?'연습 전, 지금의 내 상태':'연습 후, 지금의 내 상태'}</Title>
  <Body>정답은 없어요. 직접 느끼는 정도를 표시하거나 건너뛸 수 있어요. AI가 감정을 진단하거나 응답으로 능력을 평가하지 않아요.</Body>
  <Card><Body>응답은 이 휴대폰에만 저장해요. AI·서버·관리자에게 전송하지 않아요. 공동으로 쓰는 기기에서는 다른 사람이 기록을 볼 수 있으니 저장 여부를 선택해 주세요.</Body></Card>
  {measures.map(m=><Card key={m.key}><Body>{m.question}</Body><Body>0: 전혀 그렇지 않음 · 10: 매우 그러함 · {scores[m.key]===null?'미응답':`${scores[m.key]} 선택`}</Body>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{Array.from({length:11},(_,n)=><Pressable key={n} accessibilityRole="button" accessibilityLabel={`${m.label} ${n}점`} accessibilityState={{selected:scores[m.key]===n}} onPress={()=>setScores(s=>({...s,[m.key]:n}))} style={{minWidth:46,minHeight:46,padding:10,borderRadius:8,borderWidth:1,borderColor:colors.button,backgroundColor:scores[m.key]===n?colors.button:colors.background,alignItems:'center',justifyContent:'center'}}><Text style={{color:scores[m.key]===n?'white':colors.ink,fontSize:17}}>{n}</Text></Pressable>)}</View>
   <Button title="이 항목 응답 지우기" secondary onPress={()=>setScores(s=>({...s,[m.key]:null}))}/></Card>)}
  <ErrorText error={error}/><Button title={busy?'기록 저장 중…':'내 기기에 저장하고 계속'} onPress={save} disabled={busy||!Object.values(scores).some(v=>v!==null)}/><Button title="저장하지 않고 건너뛰기" secondary onPress={next} disabled={busy}/>
 </Screen>;
}
