import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo-modules-core';

type PlaybackEvent={session:string;type:'started'|'ended'|'error';id:string;message:string};
type NativeOutput={
 start(session:string):void;append(session:string,id:string,data:string):void;
 wav(session:string,id:string,data:string):void;finish(session:string,id:string):void;stop(session:string):void;
 addListener(name:string,listener:(event:PlaybackEvent)=>void):{remove():void};
};
export const nativeOutput=Platform.OS==='android'?requireOptionalNativeModule<NativeOutput>('OneStepAudio'):null;
