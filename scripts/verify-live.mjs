// Explicit synthetic-only integration check; never run on normal app startup.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url),WS=require(path.join(root,'mobile/node_modules/ws'));
const server=process.env.FIRSTSTEP_TEST_SERVER??'http://127.0.0.1:8080';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(server))throw Error('The synthetic check only targets a local test server.');
const base=server+'/api/v1',result={};let token,ws,interval,timer;
async function api(route,body,method){const res=await fetch(base+route,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});if(!res.ok)throw Error('HTTP '+res.status);return res.status===204?null:res.json();}
try{
 token=(await api('/sessions',{consentFlags:{syntheticOnly:true,voiceProcessing:true,preferenceAnalysis:false}})).sessionToken;
 const program=(await api('/programs')).items[0].program,p=await api('/practices',{programId:program.id,occurrenceId:program.occurrences[0].id,expectedVersionId:program.versionId,sceneTemplateId:'greeting',difficulty:'short',aiConsent:true});
 const pcmIndex=process.argv.indexOf('--pcm'),audio=pcmIndex>=0?fs.readFileSync(process.argv[pcmIndex+1]):null;
 const started=Date.now();let policy=false,rawDuringPolicy=false;
 await new Promise((resolve,reject)=>{
  timer=setTimeout(()=>reject(Error('Live check timeout')),40000);
  ws=new WS(server.replace(/^http/,'ws')+'/api/v1/practices/'+p.practiceId+'/live',{headers:{Authorization:'Bearer '+token}});
  ws.on('error',()=>reject(Error('socket-error')));
  ws.on('message',raw=>{
   const m=JSON.parse(raw);if(m.type==='error')return reject(Error('Live: '+m.message));
   if(m.type==='ready'){
    result.readyMs=Date.now()-started;
    if(!audio){ws.send(JSON.stringify({type:'text',text:'안녕하세요. 가상으로 첫 인사를 연습하고 싶어요.'}));return;}
    let offset=0;interval=setInterval(()=>{const bytes=offset<audio.length?audio.subarray(offset,Math.min(offset+3200,audio.length)):Buffer.alloc(3200);offset+=3200;if(offset>audio.length+160000){clearInterval(interval);return;}ws.send(JSON.stringify({type:'audio',sampleRate:16000,data:bytes.toString('base64')}));},100);
   }
   if(m.type==='audioChunk'){
    if(policy)rawDuringPolicy=true;
    if(!result.firstAudioMs){result.firstAudioMs=Date.now()-started;result.afterSpeechMs=audio?Math.round(result.firstAudioMs-result.readyMs-audio.length/32):null;}
    result.streamBytes=(result.streamBytes??0)+Buffer.from(m.data,'base64').length;
   }
   if(m.type==='speechEnd'&&!policy&&result.firstAudioMs){clearInterval(interval);policy=true;result.roleplayStreamed=true;ws.send(JSON.stringify({type:'text',text:'이 프로그램의 활동 날짜는 언제인가요?'}));}
   if(m.type==='reply'&&policy){
    result.policyUsesVerifiedFacts=m.kind==='fact'&&m.factRefs.length>0&&m.factRefs.every(f=>program.facts.some(official=>official.id===f.id&&official.status==='verified'));
    result.policyAudioBytes=Buffer.from(m.audioBase64,'base64').length;result.rawAudioDuringPolicy=rawDuringPolicy;
    result.passed=result.roleplayStreamed&&result.policyUsesVerifiedFacts&&!rawDuringPolicy&&result.policyAudioBytes>44;resolve();
   }
  });
 });
}catch(e){result.passed=false;result.error=e.message;}
finally{
 clearInterval(interval);clearTimeout(timer);ws?.close();if(token)try{await api('/sessions/current',null,'DELETE');}catch{}
 fs.writeFileSync(path.join(root,'.tools/live-stream-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
}
