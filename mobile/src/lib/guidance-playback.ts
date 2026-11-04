export type GuidanceKind='help'|'guard';

// Screen transitions depend on actual playback, never on the arrival of text
// or on a previous roleplay clip's delayed completion event.
export class GuidancePlayback {
 private turnId='';
 private kind:GuidanceKind|undefined;
 private phase:'waiting'|'queued'|'playing'='waiting';
 get pending(){return this.kind!==undefined;}
 announce(turnId:string,kind:GuidanceKind){this.turnId=turnId;this.kind=kind;this.phase='waiting';}
 queue(turnId:string){if(!this.pending||this.turnId!==turnId)return false;this.phase='queued';return true;}
 start(){if(this.phase==='queued'&&this.pending)this.phase='playing';}
 finish(){if(this.phase!=='playing'||!this.pending)return;const kind=this.kind;this.cancel();return kind;}
 cancel(){this.turnId='';this.kind=undefined;this.phase='waiting';}
}
