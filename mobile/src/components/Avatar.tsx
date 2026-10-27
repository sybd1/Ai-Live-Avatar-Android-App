import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import { View,useWindowDimensions } from 'react-native';
import WebView from 'react-native-webview';
import { Asset } from 'expo-asset';
import { Directory,File,Paths } from 'expo-file-system';
import { Body } from './mvp';
export type AvatarHandle={load:(base64:string,autoplay?:boolean)=>void;pcm:(base64:string,id:string)=>void;finishStream:(id:string)=>void;stop:()=>void};
export const Avatar=forwardRef<AvatarHandle,{onError:()=>void;onState:(state:string)=>void;audioOnly?:boolean}>(({onError,onState,audioOnly=false},ref)=>{
 const web=useRef<WebView<{}>>(null);const [uri,setUri]=useState('');const [mounted,setMounted]=useState(true);const stopTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const ready=useRef(false);const pending=useRef<object[]>([]);
 const send=(data:object)=>{if(ready.current)web.current?.postMessage(JSON.stringify(data));else if(pending.current.length<80)pending.current.push(data);else onError();};
 const {height}=useWindowDimensions();
 useEffect(()=>{let live=true;async function prepare(){
  const files:[number,string][]=[
   [require('../../assets/avatar-web/index.html'),'index.html'],[require('../../assets/avatar-web/bundle.avatarjs'),'bundle.js'],
   [require('../../assets/avatar/mpfb.glb'),'avatar.glb'],[require('../../assets/avatar/viseme-model.bin'),'viseme-model.bin']];
  const version=files.map(([module])=>(Asset.fromModule(module).hash??String(module)).slice(0,12)).join('-');
  const dir=new Directory(Paths.cache,'firststep-avatar-'+version);if(!dir.exists)dir.create();
  for(const [module,name]of files){const asset=await Asset.fromModule(module).downloadAsync();const source=new File(asset.localUri!);const dest=new File(dir,name);if(!dest.exists||dest.size!==source.size){if(dest.exists)dest.delete();await source.copy(dest);}}
  if(live)setUri(new File(dir,'index.html').uri);
 }void prepare().catch((e)=>{console.warn('Avatar asset preparation:',e instanceof Error?e.message:'unknown');if(live)onError();});return()=>{live=false;web.current?.postMessage(JSON.stringify({type:'DISPOSE'}));if(stopTimer.current)clearTimeout(stopTimer.current);};},[]);
 useImperativeHandle(ref,()=>({load(base64,autoplay=false){if(base64.length<=6_700_000)send({type:'LOAD_AUDIO',base64,autoplay});},pcm(base64,id){send({type:'PCM',base64,id});},finishStream(id){send({type:'PCM_END',id});},stop(){pending.current=[];if(stopTimer.current)clearTimeout(stopTimer.current);if(!ready.current)return;web.current?.postMessage(JSON.stringify({type:'STOP'}));stopTimer.current=setTimeout(()=>{setMounted(false);onError();},1500);}}));
 if(!uri||!mounted)return <Body>{mounted?'아바타 준비 중…':'재생을 멈췄어요. 다시 연습하면 아바타를 새로 준비해요.'}</Body>;
 return <View collapsable={false} style={{height:height<700?210:250,marginHorizontal:20,marginTop:8}}><WebView<{}> ref={web} source={{uri:uri+(audioOnly?'?audioOnly=1':'')}} originWhitelist={['file://*']} javaScriptEnabled domStorageEnabled={false} allowFileAccess allowFileAccessFromFileURLs allowUniversalAccessFromFileURLs={false} mediaPlaybackRequiresUserAction={false} androidLayerType={audioOnly?'software':'hardware'} nestedScrollEnabled={false} overScrollMode="never"
  onShouldStartLoadWithRequest={r=>r.url.startsWith(uri.slice(0,uri.lastIndexOf('/')+1))}
  onMessage={e=>{try{const data=JSON.parse(e.nativeEvent.data);if(typeof data.type!=='string')return;if(data.type==='READY'){ready.current=true;for(const payload of pending.current)web.current?.postMessage(JSON.stringify(payload));pending.current=[];}if(data.type==='STOPPED'&&stopTimer.current){clearTimeout(stopTimer.current);stopTimer.current=undefined;}if(data.type==='ERROR'){console.warn('Avatar renderer:',String(data.reason??'unknown').slice(0,300));onError();}else onState(data.type);}catch{onError();}}}
  onError={e=>{console.warn('Avatar WebView:',e.nativeEvent.description);onError();}} onRenderProcessGone={()=>{console.warn('Avatar WebView renderer process exited');onError();}} /></View>;
});
