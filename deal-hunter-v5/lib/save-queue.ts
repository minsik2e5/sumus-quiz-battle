// One in-flight write. New edits replace the queued snapshot, never the active one.
export class SaveQueue<T> {
  pending:T|undefined;
  running=false;
  stopped=false;
  write:(value:T)=>Promise<void>;
  onError:(error:unknown)=>void;
  constructor(write:(value:T)=>Promise<void>, onError:(error:unknown)=>void) {this.write=write;this.onError=onError;}
  enqueue(value:T) { this.pending=value; void this.flush(); }
  async flush() {
    if(this.running || this.stopped) return;
    this.running=true;
    try {
      while(this.pending !== undefined && !this.stopped) {
        const value=this.pending; this.pending=undefined;
        try { await this.write(value); }
        catch(error) { if(this.pending===undefined)this.pending=value; this.stopped=true; this.onError(error); }
      }
    } finally {this.running=false;}
  }
  retry() {this.stopped=false; void this.flush();}
}
