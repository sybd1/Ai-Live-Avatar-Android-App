import {File,Paths} from 'expo-file-system';

export const measures=[
 {key:'anxiety',label:'불안도',question:'지금 얼마나 불안한가요?'},
 {key:'lethargy',label:'무기력',question:'지금 얼마나 무기력한가요?'},
 {key:'lowMood',label:'우울감',question:'지금 얼마나 기분이 가라앉아 있나요?'},
 {key:'isolation',label:'고립감',question:'지금 얼마나 혼자라고 느끼나요?'},
 {key:'selfEsteem',label:'자존감',question:'지금 나 자신을 얼마나 소중하게 느끼나요?'},
] as const;
export type Measure=typeof measures[number]['key'];
export type Scores=Record<Measure,number|null>;
export const emptyScores=():Scores=>({anxiety:null,lethargy:null,lowMood:null,isolation:null,selfEsteem:null});
export type CheckIn={practiceId:string;programTitle:string;version:1;pre?:{at:string;scores:Scores};post?:{at:string;scores:Scores}};
export function isScores(value:unknown):value is Scores{
 if(!value||typeof value!=='object')return false;
 return measures.every(({key})=>{const n=(value as Scores)[key];return n===null||Number.isInteger(n)&&n>=0&&n<=10;});
}
function file(){return new File(Paths.document,'firststep-check-ins-v1.json');}
export function readCheckIns():CheckIn[]{
 const f=file();if(!f.exists)return [];
 try{if(f.size>2_000_000)throw Error();const raw=JSON.parse(f.textSync());if(!Array.isArray(raw))throw Error();
  const valid=(r:any)=>r&&typeof r.practiceId==='string'&&typeof r.programTitle==='string'&&r.version===1&&(r.pre||r.post)&&['pre','post'].every(stage=>r[stage]===undefined||typeof r[stage]?.at==='string'&&Number.isFinite(Date.parse(r[stage].at))&&isScores(r[stage].scores));
  if(!raw.every(valid))throw Error();return raw;
 }catch{throw new Error('기록을 읽지 못했어요. 원본은 덮어쓰지 않았어요. 기록 화면에서 삭제 후 다시 시작할 수 있어요.');}
}
export async function saveCheckIn(practiceId:string,programTitle:string,stage:'pre'|'post',scores:Scores){
 if(!isScores(scores))throw new Error('응답은 0~10 중에서 선택해 주세요.');
 const rows=readCheckIns();let row=rows.find(r=>r.practiceId===practiceId);
 if(!row){if(rows.length>=1000)throw new Error('이 기기에 기록 1,000개가 쌓였어요. 기록을 정리한 뒤 저장할 수 있어요.');row={practiceId,programTitle:programTitle.slice(0,200),version:1};rows.push(row);}
 row[stage]={at:new Date().toISOString(),scores:{...scores}};
 const f=file();await f.write(JSON.stringify(rows));
}
export async function deleteCheckIns(practiceId?:string){
 const f=file();if(!f.exists)return;
 if(!practiceId){f.delete();return;}await f.write(JSON.stringify(readCheckIns().filter(r=>r.practiceId!==practiceId)));
}
