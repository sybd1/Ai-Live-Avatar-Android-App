import { TalkingAvatar } from '@interviewflowai/talking-avatar';
import { PcmPlayback } from './pcm-playback';
const bridge=(type:string)=> (window as any).ReactNativeWebView?.postMessage(JSON.stringify({type}));
const reportError=(error:unknown)=> (window as any).ReactNativeWebView?.postMessage(JSON.stringify({type:'ERROR',reason:error instanceof Error?`${error.name}: ${error.message}`.slice(0,300):'unknown'}));
// Android WebView supports local-file XHR but not fetch(file://). Keep the adapter
// restricted to these two bundled model files; it never handles user/server data.
const originalFetch=window.fetch.bind(window);
window.fetch=(input:RequestInfo|URL,init?:RequestInit)=>{
 const value=input instanceof Request?input.url:String(input);const url=new URL(value,location.href);
 const allowed=['avatar.glb','viseme-model.bin'].map(name=>new URL(name,location.href).href);
 if(url.protocol!=='file:'||!allowed.includes(url.href))return originalFetch(input,init);
 return new Promise<Response>((resolve,reject)=>{
  const xhr=new XMLHttpRequest();const signal=init?.signal??(input instanceof Request?input.signal:null);
  const abort=()=>{xhr.abort();reject(new DOMException('Aborted','AbortError'));};
  if(signal?.aborted){abort();return;}
  xhr.open('GET',url.href,true);xhr.responseType='arraybuffer';
  const clean=()=>signal?.removeEventListener('abort',abort);
  xhr.onload=()=>{clean();if(xhr.response instanceof ArrayBuffer&&(xhr.status===0||xhr.status===200))resolve(new Response(xhr.response,{status:200}));else reject(new Error('Bundled model unavailable'));};
  xhr.onerror=()=>{clean();reject(new Error('Bundled model read failed'));};
  signal?.addEventListener('abort',abort,{once:true});xhr.send();
 });
};
let avatar:TalkingAvatar|null=null;let audio:ArrayBuffer|null=null;let serial=0;
(window as any).__firstStepAvatarSpeaking=false;
const button=document.getElementById('play') as HTMLButtonElement;
const message=document.getElementById('message')!;
const audioOnly=new URLSearchParams(location.search).get('audioOnly')==='1';
const streamDelayMs=150;
const pcm=new PcmPlayback({
 createContext:()=>new AudioContext({sampleRate:24000,latencyHint:'interactive'}),
 sink:audioOnly?undefined:{attach:async stream=>{if(!avatar)throw new Error('Avatar not ready');await avatar.attachStream(stream);},detach:()=>avatar?.detachStream(),tailSeconds:streamDelayMs/1000},
 onStart:()=>{(window as any).__firstStepAvatarSpeaking=true;bridge('STREAM_STARTED');},
 onEnd:()=>{(window as any).__firstStepAvatarSpeaking=false;bridge('STREAM_ENDED');},
 onError:reportError,
});
function stopStream(){
 pcm.stop();
 (window as any).__firstStepAvatarSpeaking=false;
}
document.addEventListener('webglcontextlost',()=>reportError(new Error('Avatar graphics context lost')),true);
async function initialize(){
 if(audioOnly){document.getElementById('avatar')!.innerHTML='<div style="height:100%;display:grid;place-items:center;font-size:56px" aria-label="단순 안내자">●</div>';button.hidden=true;message.textContent='단순 안내자 · 음성과 자막으로 대화해요.';bridge('READY');return;}
 try{avatar=new TalkingAvatar({container:document.getElementById('avatar')!,avatarUrl:'./avatar.glb',modelUrl:'./viseme-model.bin',morphTargets:{viseme_sil:[]},streamDelayMs,onError:reportError});await avatar.ready;bridge('READY');message.textContent='가상 안내자 · 대화 음성을 자동으로 재생해요.';button.hidden=true;}
 catch(error){message.textContent='3D 아바타 연결을 확인해야 해요.';reportError(error);}
}
function receive(event:MessageEvent){
 try{if(typeof event.data!=='string'||event.data.length>7_000_000)return;const data=JSON.parse(event.data);
  if(data.type==='STOP'||data.type==='DISPOSE'){serial++;stopStream();(window as any).__firstStepAvatarSpeaking=false;avatar?.stopSpeaking();audio=null;button.disabled=true;bridge('STOPPED');if(data.type==='DISPOSE'){avatar?.dispose();avatar=null;}return;}
  if(data.type==='PCM'&&typeof data.base64==='string'&&typeof data.id==='string'){
   pcm.append(data.base64,data.id);return;
  }
  if(data.type==='PCM_END'&&typeof data.id==='string'){pcm.finish(data.id);return;}
  if(data.type==='LOAD_AUDIO'&&typeof data.base64==='string'&&data.base64.length<=6_700_000){serial++;stopStream();avatar?.stopSpeaking();const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));audio=bytes.buffer;button.disabled=false;message.textContent='공식 안내 또는 가상 예시를 말해요.';if(data.autoplay===true)void speak();}
 }catch(error){reportError(error);}
}
async function speak(){if(!avatar||!audio)return;const current=++serial;button.disabled=true;(window as any).__firstStepAvatarSpeaking=true;bridge('STARTED');try{await avatar.speak(audio);if(current===serial)bridge('ENDED');}catch(error){reportError(error);}finally{if(current===serial){(window as any).__firstStepAvatarSpeaking=false;button.disabled=false;}}}
button.onclick=()=>void speak();
window.addEventListener('message',receive);document.addEventListener('message',receive as EventListener);
document.addEventListener('visibilitychange',()=>{if(document.hidden){serial++;stopStream();(window as any).__firstStepAvatarSpeaking=false;avatar?.stopSpeaking();audio=null;bridge('STOPPED');}});
window.addEventListener('pagehide',()=>{stopStream();avatar?.dispose();avatar=null;audio=null;});
void initialize();
