import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PcmPlayback} from '../avatar-web/pcm-playback.ts';

const settle=()=>new Promise(resolve=>setImmediate(resolve));
const audio=(milliseconds=160)=>Buffer.alloc(24000*2*milliseconds/1000).toString('base64');
class Context {
 currentTime=0;
 destination={};
 sources=[];
 closed=false;
 resume=async()=>{};
 close=async()=>{this.closed=true;};
 createDelay(){return {delayTime:{value:0},output:null,connect(output){this.output=output;},disconnect(){}};}
 createMediaStreamDestination(){return {stream:{}};}
 createBuffer(channels,length,rate){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}
 createBufferSource(){
  const source={buffer:null,onended:null,stopped:false,at:0,outputs:[],connect(output){this.outputs.push(output);},disconnect(){},
   start(at){this.at=at;},stop(){this.stopped=true;},finish(){this.onended?.();}};
  this.sources.push(source);return source;
 }
}
function fixture(options={}){
 const contexts=[],events=[],errors=[];
 const playback=new PcmPlayback({createContext:()=>{const c=new Context();contexts.push(c);return c;},
  onStart:()=>events.push('start'),onEnd:()=>events.push('end'),onError:e=>errors.push(e),...options});
 return {playback,contexts,events,errors};
}

test('a subsequent response preserves the previous response and queues contiguously',async t=>{
 const f=fixture();t.after(()=>f.playback.stop());
 f.playback.append(audio(),'first');f.playback.finish('first');await settle();
 const c=f.contexts[0],first=c.sources[0];
 f.playback.append(audio(),'second');f.playback.finish('second');await settle();
 assert.equal(f.contexts.length,1);assert.equal(c.closed,false);assert.equal(first.stopped,false);
 assert.equal(c.sources[1].at,first.at+first.buffer.duration);
 assert.deepEqual(f.events,['start']);assert.deepEqual(f.errors,[]);
});

test('small delivery jitter does not insert silence between each PCM chunk',async t=>{
 const f=fixture();t.after(()=>f.playback.stop());
 f.playback.append(audio(),'one');await settle();const c=f.contexts[0],first=c.sources[0];
 c.currentTime=first.at+first.buffer.duration-0.02;
 f.playback.append(audio(),'one');await settle();
 assert.equal(c.sources[1].at,first.at+first.buffer.duration);
 // A real underrun gets a short buffer before playback resumes.
 c.currentTime=2;f.playback.append(audio(),'one');await settle();
 assert.equal(c.sources[2].at,2.12);assert.deepEqual(f.errors,[]);
});

test('completion waits for all chunks and the avatars delayed audio tail',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture({sink:{attach:async()=>{},detach:()=>{},tailSeconds:0.15}});t.after(()=>f.playback.stop());
 f.playback.append(audio(),'one');f.playback.append(audio(),'one');f.playback.finish('one');await settle();
 const c=f.contexts[0];c.currentTime=c.sources[0].at+c.sources[0].buffer.duration;
 c.sources[0].finish();t.mock.timers.tick(200);assert.deepEqual(f.events,['start']);
 c.currentTime=c.sources[1].at+c.sources[1].buffer.duration;c.sources[1].finish();
 t.mock.timers.tick(149);assert.deepEqual(f.events,['start']);
 t.mock.timers.tick(32);assert.deepEqual(f.events,['start','end']);
});

test('live speech has a direct speaker path independent of the lip-sync MediaStream',async t=>{
 const f=fixture({sink:{attach:async()=>{},detach:()=>{},tailSeconds:0.15}});t.after(()=>f.playback.stop());
 f.playback.append(audio(1000),'one');await settle();const c=f.contexts[0],source=c.sources[0];
 assert.equal(source.outputs.length,2);
 assert.equal(source.outputs[0].output,c.destination);
 assert.equal(source.outputs[0].delayTime.value,0.15);
 assert.ok(source.outputs[1].stream);
 assert.equal(source.buffer.duration,1);assert.deepEqual(f.errors,[]);
});

test('next turn during the lip-sync tail cancels a stale finished notification',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture({sink:{attach:async()=>{},detach:()=>{},tailSeconds:0.15}});t.after(()=>f.playback.stop());
 f.playback.append(audio(),'one');f.playback.finish('one');await settle();const c=f.contexts[0];
 c.currentTime=c.sources[0].at+c.sources[0].buffer.duration;c.sources[0].finish();
 f.playback.append(audio(),'two');await settle();t.mock.timers.tick(500);
 assert.deepEqual(f.events,['start']);assert.equal(c.closed,false);
});

test('pause immediately discards queued playback and never starts delayed initialization',async()=>{
 let resume;const slow=new Context();slow.resume=()=>new Promise(resolve=>{resume=resolve;});
 const contexts=[slow,new Context()];let index=0,attached=0;
 const f=fixture({createContext:()=>contexts[index++],sink:{attach:async()=>{attached++;},detach:()=>{},tailSeconds:0.15}});
 f.playback.append(audio(),'before-pause');await settle();f.playback.stop();
 f.playback.append(audio(),'after-resume');await settle();resume();await settle();
 assert.equal(slow.sources.length,0);assert.equal(slow.closed,true);assert.equal(attached,1);
 assert.equal(contexts[1].sources.length,1);f.playback.stop();
 assert.equal(contexts[1].sources[0].stopped,true);assert.deepEqual(f.errors,[]);
});

test('malformed PCM stops playback instead of leaving partially queued sound',async()=>{
 const f=fixture();f.playback.append(audio(),'one');await settle();
 f.playback.append('AA==','one');await settle();
 assert.equal(f.errors.length,1);assert.equal(f.contexts[0].sources[0].stopped,true);
 f.playback.stop();
});
