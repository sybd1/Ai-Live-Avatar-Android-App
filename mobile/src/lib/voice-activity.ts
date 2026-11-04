export type PcmFrame = {data:ArrayBuffer;sampleRate:number;channels:number};
export type Utterance = {wav:Uint8Array;duration:number};

// AudioStream delivers PCM buffers, not recording files. Keep only one bounded
// utterance and a short pre-roll; silence never makes a server request.
export class VoiceActivity {
 private frames:Uint8Array[]=[];
 private lead:Uint8Array[]=[];
 private leadMs=0;
 private duration=0;
 private voiced=0;
 private silence=0;
 private noise=0.001;
 private format='';
 private waitMs:number;
 constructor(waitMs=1800){this.waitMs=waitMs;}
 reset(){this.frames=[];this.lead=[];this.leadMs=0;this.duration=0;this.voiced=0;this.silence=0;this.format='';}
 push(frame:PcmFrame):Utterance|null{
  if(!frame.data.byteLength||frame.channels!==1||frame.sampleRate<8000||frame.sampleRate>96000||frame.data.byteLength%2)return null;
  const format=`${frame.sampleRate}/${frame.channels}`;
  if(this.format&&this.format!==format)this.reset();this.format=format;
  const view=new DataView(frame.data);let sum=0;
  for(let i=0;i<view.byteLength;i+=2){const sample=view.getInt16(i,true)/32768;sum+=sample*sample;}
  const rms=Math.sqrt(sum/(view.byteLength/2));const ms=view.byteLength/2/frame.sampleRate*1000;
  const speaking=rms>Math.max(0.0045,Math.min(0.035,this.noise*3));
  const bytes=new Uint8Array(frame.data.slice(0));
  if(!this.frames.length&&!speaking){this.noise=this.noise*0.96+Math.min(rms,0.012)*0.04;this.lead.push(bytes);this.leadMs+=ms;while(this.leadMs>350&&this.lead.length>1){this.leadMs-=this.lead.shift()!.length/2/frame.sampleRate*1000;}return null;}
  if(!this.frames.length){this.frames=this.lead;this.duration=this.leadMs;this.lead=[];this.leadMs=0;}
  this.frames.push(bytes);this.duration+=ms;
  if(speaking){this.voiced+=ms;this.silence=0;}else this.silence+=ms;
  if(this.silence<this.waitMs&&this.duration<50000)return null;
  const frames=this.frames;const duration=this.duration;const voiced=this.voiced;this.reset();
  if(voiced<200)return null;
  return {wav:pcmWav(frames,frame.sampleRate),duration:duration/1000};
 }
}

export function pcmWav(frames:Uint8Array[],sampleRate:number){
 const size=frames.reduce((n,b)=>n+b.length,0);const out=new Uint8Array(44+size);const v=new DataView(out.buffer);
 const word=(at:number,text:string)=>{for(let i=0;i<text.length;i++)out[at+i]=text.charCodeAt(i);};
 word(0,'RIFF');v.setUint32(4,36+size,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,size,true);
 let offset=44;for(const bytes of frames){out.set(bytes,offset);offset+=bytes.length;}return out;
}
