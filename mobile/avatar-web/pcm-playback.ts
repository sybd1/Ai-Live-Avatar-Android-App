type Sink = {
 attach:(stream:MediaStream)=>Promise<void>;
 detach:()=>void;
 tailSeconds:number;
};
type Options = {
 createContext:()=>AudioContext;
 sink?:Sink;
 onStart:()=>void;
 onEnd:()=>void;
 onError:(error:unknown)=>void;
};

// One audio graph per conversation. A new model turn must not discard sound
// still queued for the previous turn, including the avatar's lip-sync delay.
export class PcmPlayback {
 private context:AudioContext|null=null;
 private destination:MediaStreamAudioDestinationNode|null=null;
 private audible:AudioNode|null=null;
 private sources=new Set<AudioBufferSourceNode>();
 private chain:Promise<void>=Promise.resolve();
 private generation=0;
 private queued=0;
 private id='';
 private next=0;
 private ended=false;
 private speaking=false;
 private timer:ReturnType<typeof setTimeout>|undefined;

 private options:Options;
 constructor(options:Options){this.options=options;}

 append(base64:string,id:string){
  this.enqueue(async expected=>{
   const raw=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
   if(!raw.length||raw.length%2||raw.length>160000)throw new Error('Invalid live audio');
   if(!this.context){
    const context=this.options.createContext();this.context=context;
    await context.resume();
    if(expected!==this.generation)return;
    if(this.options.sink){
     // Keep audible PCM in its original context. A MediaStream crossing into
     // the lip-sync SDK's second context must never be the only speaker path.
     const delay=context.createDelay(Math.max(1,this.options.sink.tailSeconds*2));
     delay.delayTime.value=this.options.sink.tailSeconds;
     delay.connect(context.destination);this.audible=delay;
     this.destination=context.createMediaStreamDestination();
     await this.options.sink.attach(this.destination.stream);
     if(expected!==this.generation)return;
    }
   }
   if(expected!==this.generation||!this.context)return;
   this.cancelEnd();this.id=id;this.ended=false;
   const context=this.context,buffer=context.createBuffer(1,raw.length/2,24000);
   const view=new DataView(raw.buffer),samples=buffer.getChannelData(0);
   for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;
   // Buffer briefly at startup or after a network underrun; otherwise join
   // chunks sample-to-sample instead of adding a gap to every arriving chunk.
   const at=this.next>context.currentTime+0.005?this.next:context.currentTime+0.12;
   if(at-context.currentTime>20)throw new Error('Live audio queue exceeded');
   this.next=at+buffer.duration;
   const source=context.createBufferSource();source.buffer=buffer;
   source.connect(this.audible??context.destination);
   if(this.destination)source.connect(this.destination);
   source.onended=()=>{this.sources.delete(source);source.disconnect();this.maybeEnd(expected);};
   this.sources.add(source);source.start(at);
   if(!this.speaking){this.speaking=true;this.options.onStart();}
  });
 }

 finish(id:string){this.enqueue(async expected=>{
  if(this.id===id){this.ended=true;this.maybeEnd(expected);}
 });}

 stop(){
  this.generation++;this.cancelEnd();this.chain=Promise.resolve();
  for(const source of this.sources){source.onended=null;try{source.stop();}catch{}source.disconnect();}
  this.sources.clear();this.options.sink?.detach();
  this.audible?.disconnect();this.audible=null;
  void this.context?.close().catch(()=>{});
  this.context=null;this.destination=null;this.id='';this.next=0;this.ended=false;this.speaking=false;
 }

 private enqueue(action:(expected:number)=>Promise<void>){
  const expected=this.generation;
  if(++this.queued>80){this.queued--;this.options.onError(new Error('Live audio backlog'));return;}
  this.chain=this.chain.then(async()=>{if(expected===this.generation)await action(expected);})
   .catch(error=>{if(expected===this.generation){this.stop();this.options.onError(error);}})
   .finally(()=>{this.queued--;});
 }

 private cancelEnd(){if(this.timer)clearTimeout(this.timer);this.timer=undefined;}
 private maybeEnd(expected:number){
  if(expected!==this.generation||!this.ended||this.sources.size||!this.context)return;
  this.cancelEnd();
  const delay=Math.max(0,(this.next+(this.options.sink?.tailSeconds??0)-this.context.currentTime)*1000)+30;
  this.timer=setTimeout(()=>{
   this.timer=undefined;
   if(expected===this.generation&&this.ended&&!this.sources.size&&this.speaking){
    this.speaking=false;this.options.onEnd();
   }
  },delay);
 }
}
