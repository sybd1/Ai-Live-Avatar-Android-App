const {getDefaultConfig}=require('expo/metro-config');
const config=getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb','bin','html','avatarjs');
module.exports=config;
