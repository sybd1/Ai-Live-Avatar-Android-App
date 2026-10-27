import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Generation} from '../src/lib/generation.ts';
test('pause invalidates delayed audio, STT and generation results',()=>{const g=new Generation();const pending=g.capture();g.invalidate();assert.equal(g.isCurrent(pending),false);assert.equal(g.isCurrent(g.capture()),true);});
test('ended practice cannot accept a new or old generation',()=>{const g=new Generation();const old=g.capture();g.end();assert.equal(g.isCurrent(old),false);assert.equal(g.isCurrent(g.capture()),false);});
test('successive pauses never make an older request current again',()=>{const g=new Generation();const a=g.capture();g.invalidate();const b=g.capture();g.invalidate();assert.equal(g.isCurrent(a),false);assert.equal(g.isCurrent(b),false);});
