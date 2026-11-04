import fs from 'node:fs';
import crypto from 'node:crypto';
const lock=JSON.parse(fs.readFileSync('assets/avatar/assets.lock.json','utf8').replace(/^\uFEFF/,''));
const target='assets/avatar/mpfb.glb';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
if(fs.existsSync(target)){
 if(hash(fs.readFileSync(target))!==lock.avatar.sha256)throw Error('Avatar model changed; review its license and update assets.lock.json explicitly.');
}else{
 const response=await fetch(lock.avatar.url);if(!response.ok)throw Error('Avatar download failed: '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());if(hash(bytes)!==lock.avatar.sha256)throw Error('Avatar checksum mismatch');fs.writeFileSync(target,bytes);
}
const viseme='assets/avatar/viseme-model.bin';
if(!fs.existsSync(viseme))fs.copyFileSync('node_modules/@interviewflowai/talking-avatar/dist/viseme-model.bin',viseme);
console.log('Licensed avatar assets ready.');
