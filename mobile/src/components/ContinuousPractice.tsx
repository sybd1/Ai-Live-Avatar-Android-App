import {useEffect,useRef,useState} from 'react';
import {AppState,BackHandler,Keyboard,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {AudioModule,setAudioModeAsync,useAudioStream,useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';
import {File,Paths} from 'expo-file-system';
import {Body,Button,Card,ErrorText,Field,Screen,Title,openOfficial} from './mvp';
import {Avatar,type AvatarHandle} from './Avatar';
import {audioBase64,createLiveSocket,hasVoiceConsent,post,request,requestId} from '@/lib/api';
import {Generation} from '@/lib/generation';
import {GuidancePlayback} from '@/lib/guidance-playback';
import {VoiceActivity,type Utterance} from '@/lib/voice-activity';
import type {Practice,Program,Turn} from '@/lib/types';

type Context={practice:Practice;program:Program;liveVoice?:boolean};
type Status='ready'|'starting'|'listening'|'transcribing'|'generating'|'playing'|'paused'|'ended';
export default function ContinuousPractice(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [context,setContext]=useState<Context|null>(null),[status,setStatus]=useState<Status>('ready'),[reply,setReply]=useState<Turn|null>(null),[heard,setHeard]=useState(''),[error,setError]=useState('');
 const [paused,setPaused]=useState(false),[fallback,setFallback]=useState(false),[avatarKey,setAvatarKey]=useState(0),[textMode,setTextMode]=useState(false),[text,setText]=useState('');
 const current=useRef<Practice|null>(null),generation=useRef(new Generation()),controller=useRef<AbortController|null>(null);
 const running=useRef(false),processing=useRef(false),listening=useRef(false),alive=useRef(true),ending=useRef(false),pausedRef=useRef(false),starting=useRef(false);
 const vad=useRef(new VoiceActivity()),avatar=useRef<AvatarHandle>(null),outputFile=useRef<File|null>(null),inputFile=useRef<File|null>(null),savedAudio=useRef<string|null>(null);
 const playbackTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),controls=useRef<Promise<unknown>>(Promise.resolve()),consume=useRef<(u:Utterance)=>void>(()=>{});
 const player=useAudioPlayer(null),playerStatus=useAudioPlayerStatus(player);
 const liveSocket=useRef<WebSocket|null>(null);
 const guidance=useRef(new GuidancePlayback()),fallbackRef=useRef(false);
 const {stream}=useAudioStream({sampleRate:16000,channels:1,encoding:'int16',onBuffer:frame=>{
  if(!listening.current||!running.current)return;
  if(liveSocket.current){const socket=liveSocket.current;if(socket.readyState!==WebSocket.OPEN)return;if(socket.bufferedAmount>128000){pause();setError('음성 전송이 밀려 잠시 멈췄어요. 연결을 확인하고 다시 시작할 수 있어요.');return;}
   const bytes=new Uint8Array(frame.data);let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);socket.send(JSON.stringify({type:'audio',sampleRate:frame.sampleRate,data:btoa(binary)}));return;}
  const u=vad.current.push(frame);if(u){listening.current=false;stream.stop();consume.current(u);}
 }});
 function clean(ref:{current:File|null}){try{if(ref.current?.exists)ref.current.delete();}catch{}ref.current=null;}
 function stopLocal(next:Status='paused'){
  guidance.current.cancel();
  running.current=false;listening.current=false;processing.current=false;starting.current=false;generation.current.invalidate();controller.current?.abort();vad.current.reset();stream.stop();
  const socket=liveSocket.current;liveSocket.current=null;if(socket){socket.onmessage=null;socket.onclose=null;socket.onerror=null;socket.close();}
  if(playbackTimer.current)clearTimeout(playbackTimer.current);playbackTimer.current=undefined;
  avatar.current?.stop();player.pause();player.replace(null);savedAudio.current=null;clean(inputFile);clean(outputFile);
  pausedRef.current=true;if(alive.current){setPaused(true);setStatus(next);}
 }
 function control(action:'pause'|'resume'|'end'){
  const task=controls.current.catch(()=>{}).then(async()=>{const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),6000);try{return await post<Practice>(`/practices/${id}/${action}`,{requestId:requestId()},abort.signal);}finally{clearTimeout(timer);}});controls.current=task;return task;
 }
 function pause(){stopLocal();void control('pause').then(p=>{current.current=p;}).catch(()=>{if(alive.current)setError('마이크와 음성은 멈췄어요. 서버 연결 후 상태를 확인해 주세요.');});}
 async function listen(){
  if(!running.current||pausedRef.current||!alive.current||ending.current)return;
  if(AppState.currentState!=='active'){pause();return;}
  const captured=generation.current.capture();vad.current.reset();
  try{await setAudioModeAsync({allowsRecording:true,shouldPlayInBackground:false,interruptionMode:'doNotMix'});
   if(!generation.current.isCurrent(captured)||!running.current)return;
   await stream.start();if(!generation.current.isCurrent(captured)||!running.current){stream.stop();return;}listening.current=true;setStatus('listening');
  }catch{stopLocal();setError('마이크를 시작하지 못했어요. 권한·다른 앱의 마이크 사용을 확인하거나 텍스트로 연습할 수 있어요.');}
 }
 async function start(){
  if(processing.current||running.current||starting.current||ending.current||!current.current)return;
  if(!hasVoiceConsent()){setError('첫 화면에서 음성 처리에 동의한 뒤 새 시연 세션을 시작해 주세요. 텍스트·지켜보기는 계속 이용할 수 있어요.');return;}
  starting.current=true;setError('');setStatus('starting');const captured=generation.current.capture();
  try{const existing=await AudioModule.getRecordingPermissionsAsync(),permission=existing.granted?existing:await AudioModule.requestRecordingPermissionsAsync();
   if(!alive.current||!generation.current.isCurrent(captured))return;
   if(!permission.granted){setStatus('ready');setError('마이크 권한이 필요해요. 텍스트·지켜보기로도 연습할 수 있어요.');return;}
   if(AppState.currentState!=='active'){setStatus('ready');return;}
   const p=await control('resume');if(!generation.current.isCurrent(captured)||!alive.current){void control('pause').catch(()=>{});return;}
   current.current=p;pausedRef.current=false;setPaused(false);setTextMode(false);setAvatarKey(n=>n+1);
   if(context?.liveVoice)await connectLive(captured);
   if(!generation.current.isCurrent(captured))return;
   if(context?.liveVoice&&p.expectedTurn===0)liveSocket.current?.send(JSON.stringify({type:'text',text:'가상 연습을 시작할게요. 선택한 장면의 상대역으로 짧게 인사해 주세요.'}));
   running.current=true;await listen();
  }catch(e){stopLocal();setError((e as Error).message);}finally{starting.current=false;}
 }
 function connectLive(captured:number){return new Promise<void>((resolve,reject)=>{
  const socket=createLiveSocket(id);liveSocket.current=socket;let settled=false;
  const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error('실시간 음성 연결이 지연됐어요. 다시 시작할 수 있어요.'));socket.close();}},12000);
  const fail=(message:string)=>{clearTimeout(timer);if(!settled){settled=true;reject(new Error(message));}else if(liveSocket.current===socket){stopLocal();setError(message);void control('pause').catch(()=>{});}};
  socket.onmessage=event=>{if(!generation.current.isCurrent(captured)||liveSocket.current!==socket)return;
   try{if(typeof event.data!=='string'||event.data.length>6_800_000)throw Error();const data=JSON.parse(event.data);
    if(data.type==='ready'){clearTimeout(timer);settled=true;resolve();}
    if(data.type==='error')fail(String(data.message??'실시간 음성 연결을 확인해 주세요.'));
    if(data.type==='guidance'){
     if(typeof data.turnId!=='string'||typeof data.approvedText!=='string'||!['help','guard'].includes(data.kind))throw Error();
     prepareGuidance({turnId:data.turnId,kind:data.kind,approvedText:data.approvedText,factRefs:[],alternatives:[],generation:current.current?.generation??0,expectedTurn:current.current?.expectedTurn??0});
    }
    if(data.type==='guidanceUnavailable'){stopLocal();setError(String(data.message));void control('pause').catch(()=>{});}
    if(data.type==='checking')setStatus('generating');
    if(data.type==='heard')setHeard(data.text??'');
    if(data.type==='interrupted'&&!guidance.current.pending){console.info('[Voice] interrupted: '+String(data.reason??'policy_or_text'));avatar.current?.stop();player.pause();player.replace(null);savedAudio.current=null;clean(outputFile);if(playbackTimer.current)clearTimeout(playbackTimer.current);setStatus('listening');}
    if(data.type==='caption'&&!guidance.current.pending)setReply({turnId:data.utteranceId,kind:'roleplay',approvedText:data.text,factRefs:[],alternatives:[],generation:current.current?.generation??0,expectedTurn:current.current?.expectedTurn??0});
    if(data.type==='audioChunk'&&!guidance.current.pending){if(typeof data.data!=='string'||data.data.length>300000)throw Error();avatar.current?.pcm(data.data,data.utteranceId);setStatus('playing');}
    if(data.type==='speechEnd')avatar.current?.finishStream(data.utteranceId);
    if(data.type==='control'){if(data.kind==='end')end();else{stopLocal();void control('pause').catch(()=>{});if(data.kind==='help')router.push('/help');}}
    if(data.type==='reply'){
     if(typeof data.audioBase64!=='string'||typeof data.approvedText!=='string')throw Error();
     if(guidance.current.pending&&!guidance.current.queue(data.turnId))return;
     processing.current=false;setHeard(data.transcript??'');setReply(data as Turn);if(current.current)current.current={...current.current,generation:data.generation,expectedTurn:data.expectedTurn};
     void play(data.audioBase64,captured).catch(()=>fail('음성을 재생하지 못해 잠시 멈췄어요.'));
    }
   }catch{fail('실시간 음성 응답 형식을 확인하지 못했어요.');}
  };
  socket.onerror=()=>fail('실시간 음성 연결에 문제가 있어요. 다시 시작할 수 있어요.');socket.onclose=()=>fail('실시간 음성 연결이 끝났어요. 다시 시작할 수 있어요.');
 });}
 function prepareGuidance(turn:Turn){
  guidance.current.announce(turn.turnId,turn.kind as 'help'|'guard');
  running.current=false;listening.current=false;processing.current=true;stream.stop();vad.current.reset();
  if(playbackTimer.current)clearTimeout(playbackTimer.current);playbackTimer.current=undefined;
  avatar.current?.stop();player.pause();player.replace(null);savedAudio.current=null;clean(outputFile);
  setReply(turn);setError('');setStatus('generating');
 }
 async function playbackEnded(){
  if(guidance.current.pending){
   const kind=guidance.current.finish();if(!kind)return;
   stopLocal();void control('pause').catch(()=>{});if(kind==='help')router.push('/help');return;
  }
  if(playbackTimer.current)clearTimeout(playbackTimer.current);playbackTimer.current=undefined;clean(outputFile);savedAudio.current=null;
  if(liveSocket.current&&running.current&&!pausedRef.current){setStatus('listening');return;}
  if(running.current&&!pausedRef.current)await listen();else if(!pausedRef.current)setStatus('ready');
 }
 async function play(base64:string,captured:number){
  if(!generation.current.isCurrent(captured)||pausedRef.current)return;
  await setAudioModeAsync({allowsRecording:!!liveSocket.current&&!guidance.current.pending,shouldPlayInBackground:false,interruptionMode:'doNotMix'});
  if(!generation.current.isCurrent(captured)||pausedRef.current)return;
  savedAudio.current=base64;setStatus('playing');
  playbackTimer.current=setTimeout(()=>{if(generation.current.isCurrent(captured)){stopLocal();setError('음성 재생 완료를 확인하지 못해 멈췄어요. 다시 시작할 수 있어요.');}},65000);
  if(!fallbackRef.current&&avatar.current){avatar.current.load(base64,true);return;}
  await playNative(base64,captured);
 }
 async function playNative(base64:string,captured:number){
  clean(outputFile);const f=new File(Paths.cache,`firststep-output-${requestId()}.wav`);await f.write(base64,{encoding:'base64'});if(!generation.current.isCurrent(captured)||pausedRef.current){if(f.exists)f.delete();return;}outputFile.current=f;player.replace(f.uri);player.play();
 }
 async function send(input:string){
  if(!input.trim()||processing.current||pausedRef.current||!current.current)return;
  listening.current=false;stream.stop();vad.current.reset();Keyboard.dismiss();processing.current=true;
  const captured=generation.current.capture();controller.current=new AbortController();setStatus('generating');setError('');
  try{const p=current.current,out=await post<Turn>(`/practices/${id}/turns`,{requestId:requestId(),generation:p.generation,expectedTurn:p.expectedTurn,confirmedText:input},controller.current.signal);
   if(!generation.current.isCurrent(captured))return;
   current.current={...p,generation:out.generation,expectedTurn:out.expectedTurn};setReply(out);setText('');
   if(out.kind==='stop'){stopLocal();return;}
   if(out.kind==='help')prepareGuidance(out);
   if(!out.audioToken){stopLocal();setError(out.audioError??'음성을 준비하지 못해 멈췄어요. 자막을 확인하거나 다시 시작할 수 있어요.');return;}
   const audio=await audioBase64(`/practices/${id}/audio/${out.audioToken}`,controller.current.signal);
   if(!generation.current.isCurrent(captured))return;if(out.kind==='help'&&!guidance.current.queue(out.turnId))return;processing.current=false;await play(audio,captured);
  }catch(e){if(generation.current.isCurrent(captured)){stopLocal();setError((e as Error).message);void control('pause').catch(()=>{});}}
  finally{if(generation.current.isCurrent(captured))processing.current=false;}
 }
 consume.current=u=>{void transcribe(u);};
 async function transcribe(u:Utterance){
  if(processing.current||!running.current||!current.current)return;
  processing.current=true;const captured=generation.current.capture();controller.current=new AbortController();setStatus('transcribing');let f:File|null=null;
  try{f=new File(Paths.cache,`firststep-input-${requestId()}.wav`);await f.write(u.wav);if(!generation.current.isCurrent(captured))return;inputFile.current=f;
   const form=new FormData();form.append('audio',f);form.append('requestId',requestId());form.append('generation',String(current.current.generation));
   const r=await request<{transcript:string}>(`/practices/${id}/transcriptions`,{method:'POST',body:form,signal:controller.current.signal});
   if(!generation.current.isCurrent(captured))return;processing.current=false;setHeard(r.transcript);
   if(!r.transcript.trim()){await listen();return;}
   if(/^(오늘은\s*여기까지|대화\s*끝|연습\s*종료)/.test(r.transcript.trim())){end();return;}
   if(/^(잠깐\s*쉬|잠시\s*쉬|멈춰|멈추기)/.test(r.transcript.trim())){pause();return;}
   await send(r.transcript);
  }catch(e){if(generation.current.isCurrent(captured)){stopLocal();setError((e as Error).message);void control('pause').catch(()=>{});}}
  finally{try{if(f?.exists)f.delete();}catch{}if(inputFile.current===f)inputFile.current=null;if(generation.current.isCurrent(captured))processing.current=false;}
 }
 function end(){if(ending.current)return;ending.current=true;stopLocal('ended');void control('end').catch(()=>{});router.replace({pathname:'/practice/check-in',params:{id,stage:'post',title:context?.program.title??'프로그램 연습'}});}
 function avatarError(){fallbackRef.current=true;setFallback(true);if(guidance.current.pending){
  if(savedAudio.current&&!pausedRef.current){const captured=generation.current.capture();void playNative(savedAudio.current,captured).catch(()=>{if(generation.current.isCurrent(captured)){stopLocal();setError('음성 안내를 재생하지 못했어요. 화면의 안내를 읽거나 도움 안내를 선택할 수 있어요.');}});}return;
 }if((running.current||savedAudio.current)&&!pausedRef.current){stopLocal();setError('아바타 연결을 확인하지 못해 음성을 멈췄어요. 단순 화면으로 다시 시작할 수 있어요.');}}
 async function textStart(input:string){
  if(processing.current||ending.current)return;
  if(pausedRef.current){try{current.current=await control('resume');pausedRef.current=false;setPaused(false);}catch(e){setError((e as Error).message);return;}}
  running.current=false;listening.current=false;stream.stop();await send(input);
 }
 useEffect(()=>{
  alive.current=true;let mounted=true;
  request<Context>(`/practices/${id}/context`).then(c=>{if(mounted){setContext(c);current.current=c.practice;pausedRef.current=c.practice.state!=='ready';setPaused(pausedRef.current);if(pausedRef.current)setStatus('paused');}}).catch(e=>{if(mounted)setError(e.message);});
  const background=()=>{if(running.current||processing.current||listening.current||savedAudio.current||starting.current&&liveSocket.current)pause();};
  const state=AppState.addEventListener('change',s=>{if(s!=='active')background();}),blur=AppState.addEventListener('blur',background),back=BackHandler.addEventListener('hardwareBackPress',()=>{pause();router.back();return true;});
  return()=>{mounted=false;alive.current=false;state.remove();blur.remove();back.remove();stopLocal();if(!ending.current)void control('pause').catch(()=>{});};
 },[id]);
 useEffect(()=>{if(playerStatus.didJustFinish&&!pausedRef.current)void playbackEnded();},[playerStatus.didJustFinish]);
 useEffect(()=>{if(playerStatus.playing)guidance.current.start();},[playerStatus.playing]);
 const busy=['starting','transcribing','generating','playing'].includes(status);
 return <Screen top={!paused&&!textMode?<Avatar key={`${avatarKey}-${fallback}`} audioOnly={fallback} ref={avatar} onError={avatarError} onState={s=>{if(s==='STARTED')guidance.current.start();if(s==='ENDED'&&!pausedRef.current)void playbackEnded();if(s==='STREAM_STARTED'&&!pausedRef.current&&!guidance.current.pending)setStatus('playing');if(s==='STREAM_ENDED'&&liveSocket.current&&!pausedRef.current&&!guidance.current.pending)setStatus('listening');}}/>:undefined} footer={<><Button title="멈추기 · 잠깐 쉬기" onPress={pause}/><Button title="오늘은 여기까지" secondary onPress={end}/></>}>
  <Title>{context?.program.title??'연습 준비'}</Title><Body>선택한 장면 속 가상 안내자와 하는 연습이에요. 실제 진행·직원의 반응과 다를 수 있어요.</Body>
  <Body>상태: {{ready:'준비됨',starting:'마이크 준비 중',listening:'듣고 있어요 · 편하게 말해 주세요',transcribing:'말씀을 확인하는 중',generating:'답변 생성·검증 중',playing:'아바타가 말하는 중',paused:'잠깐 쉬는 중',ended:'대화 종료'}[status]}</Body>
  {fallback&&<Card><Body>3D 대신 단순 화면으로 대화해요. 음성과 자막 기능은 계속 사용할 수 있어요.</Body></Card>}
  {!running.current&&<Button title={paused?'내가 준비되면 다시 시작':'연습 시작 · 마이크로 대화'} onPress={()=>void start()} disabled={!context||busy||ending.current}/>}
  <Body>연습 시작 후에는 녹음·전송·듣기를 매번 누르지 않아도 돼요. {context?.liveVoice?'마이크로 듣고 아바타 음성을 실시간으로 재생해요. 실제 정책 정보는 공식 근거를 확인한 뒤 따로 안내해요.':'말을 마치면 음성을 인식하고 답변을 확인해 재생해요.'}</Body>
  {paused&&<Card><Body>마이크와 음성을 멈췄어요. 다시 시작하기 전에는 듣지 않아요.</Body></Card>}
  {heard&&<Card><Body>인식한 말</Body><Body>{heard}</Body></Card>}
  {reply&&<Card><Body>{reply.kind==='help'?'안전과 도움 안내':reply.kind==='guard'?'잠시 쉬어가기':reply.kind==='fact'?'공식 자료에서 확인한 정보':reply.kind==='unknown'?'확인 필요':'가상 연습 대사'}</Body><Body>{reply.approvedText}</Body>{reply.factRefs.map(f=><View key={f.id}><Body>근거: {f.quote}</Body>{!context?.program.synthetic&&<Button title="공식 근거" secondary onPress={()=>{pause();void openOfficial(f.sourceUrl);}}/>}</View>)}</Card>}
  <ErrorText error={error}/>{!running.current&&<Button title="먼저 지켜보기 · 예시 자동 재생" secondary disabled={busy||!context} onPress={()=>void textStart('__watch__')}/>}
  <Button title={textMode?'텍스트 입력 접기':'말하기가 어렵다면 텍스트로 연습'} secondary disabled={busy} onPress={()=>{if(!textMode)pause();setTextMode(v=>!v);}}/>
  {textMode&&<><Field label="직접 입력할 문장" value={text} onChangeText={setText} multiline/><Button title="입력한 문장으로 연습" disabled={busy||!text.trim()} onPress={()=>void textStart(text)}/></>}
  <Body>침묵은 실패가 아니에요. 천천히 생각해도 괜찮아요. 듣는 중에는 “잠깐 쉬기”, “오늘은 여기까지”라고 말해도 돼요. 아래 버튼은 언제든 즉시 멈춰요.</Body>
  <Button title="내 상태 기록·그래프" secondary onPress={()=>{pause();router.push('/history');}}/><Button title="도움 안내" secondary onPress={()=>{pause();router.push('/help');}}/>
 </Screen>;
}
