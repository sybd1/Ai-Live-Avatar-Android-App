import fs from 'node:fs';
const config=JSON.parse(fs.readFileSync('package.json','utf8'));
if(!config.expo?.autolinking?.android?.buildFromSource?.includes('expo-audio'))throw Error('expo-audio must build from source: prebuilt AARs ignore the echo cancellation patch.');
const file='node_modules/expo-audio/android/src/main/java/expo/modules/audio/AudioStream.kt';
let source=fs.readFileSync(file,'utf8');
if(!source.includes('FIRSTSTEP_ECHO_CANCELLATION')){
const edits=[
 ['import android.media.AudioRecord','import android.media.AudioRecord\nimport android.media.audiofx.AcousticEchoCanceler'],
 ['private var audioRecord: AudioRecord? = null','// FIRSTSTEP_ECHO_CANCELLATION: release with this recording session.\n  private var echoCanceler: AcousticEchoCanceler? = null\n  private var audioRecord: AudioRecord? = null'],
 ['audioRecord = recorder','audioRecord = recorder\n    echoCanceler = if (AcousticEchoCanceler.isAvailable()) {\n      runCatching { AcousticEchoCanceler.create(recorder.audioSessionId)?.apply { enabled = true } }.getOrNull()\n    } else null'],
 ['audioRecord?.release()','echoCanceler?.release()\n    echoCanceler = null\n    audioRecord?.release()'],
 ['MediaRecorder.AudioSource.MIC,','MediaRecorder.AudioSource.VOICE_COMMUNICATION,'],
];
for(const [before,after] of edits){if(source.split(before).length!==2)throw Error('expo-audio source changed; echo patch needs review');source=source.replace(before,after);}
}
if(!source.includes('MediaRecorder.AudioSource.VOICE_COMMUNICATION,'))throw Error('Voice communication capture is missing.');
if(!source.includes('FIRSTSTEP_CAPTURE_DIAGNOSTIC')){
 source=source.replace('import android.Manifest','import android.Manifest\nimport android.util.Log');
 const before='startTimeNanos = System.nanoTime()';
 if(source.split(before).length!==2)throw Error('expo-audio capture initialization changed.');
 source=source.replace(before,'// FIRSTSTEP_CAPTURE_DIAGNOSTIC: no speech content is logged.\n    Log.i("FirstStepVoice", "Capture source=VOICE_COMMUNICATION; aec=${echoCanceler?.enabled == true}")\n    '+before);
}
fs.writeFileSync(file,source);
console.log('Applied Android voice-communication capture and optional hardware echo cancellation.');
