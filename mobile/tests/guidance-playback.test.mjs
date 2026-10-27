import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GuidancePlayback} from '../src/lib/guidance-playback.ts';

test('help text and queued audio cannot end guidance or trigger early navigation',()=>{
 const g=new GuidancePlayback();g.announce('help','help');
 assert.equal(g.finish(),undefined);assert.equal(g.pending,true);
 assert.equal(g.queue('old-roleplay'),false);assert.equal(g.queue('help'),true);
 assert.equal(g.finish(),undefined);assert.equal(g.pending,true);
 g.start();assert.equal(g.finish(),'help');assert.equal(g.pending,false);
 assert.equal(g.finish(),undefined);
});
test('explicit pause cancels pending and playing guidance immediately',()=>{
 for(const playing of [false,true]){
  const g=new GuidancePlayback();g.announce('help','help');g.queue('help');if(playing)g.start();
  g.cancel();g.start();assert.equal(g.pending,false);assert.equal(g.finish(),undefined);
  assert.equal(g.queue('help'),false);
 }
});
test('a previous response completion cannot finish a new guidance before its playback starts',()=>{
 const g=new GuidancePlayback();g.announce('old','guard');g.queue('old');g.start();
 g.announce('new','help');assert.equal(g.finish(),undefined);
 assert.equal(g.queue('old'),false);assert.equal(g.pending,true);
 g.queue('new');g.start();assert.equal(g.finish(),'help');
});
test('a guarded roleplay response pauses without routing to crisis help',()=>{
 const g=new GuidancePlayback();g.announce('guard','guard');g.queue('guard');g.start();
 assert.equal(g.finish(),'guard');
});
