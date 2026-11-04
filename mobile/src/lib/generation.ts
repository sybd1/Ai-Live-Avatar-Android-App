// A local generation invalidates pending network, file, recording, and playback work together.
export class Generation {
  private value=0;
  private ended=false;
  capture(){return this.value;}
  isCurrent(value:number){return !this.ended&&this.value===value;}
  invalidate(){return ++this.value;}
  end(){this.ended=true;return ++this.value;}
}
