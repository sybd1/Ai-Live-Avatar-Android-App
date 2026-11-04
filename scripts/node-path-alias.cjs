const realRoot = process.env.FIRSTSTEP_CANONICAL_ROOT || require('node:path').resolve(__dirname,'..');
const aliasRoot = (process.env.FIRSTSTEP_RUNTIME_ROOT || realRoot).replace(/[\\/]$/,'');
function normalize(value) {
  if (typeof value === 'string') {
    for (const root of [realRoot, realRoot.replaceAll('\\','/')]) {
      if (value.toLowerCase().startsWith(root.toLowerCase())) return aliasRoot + value.slice(root.length);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,val])=>[key,normalize(val)]));
  return value;
}
module.exports = {normalize};
// Only the generated Expo/RN autolinking JSON is rewritten. Application data and SDK source stay intact.
if ([...process.argv,...process.execArgv].some(arg=>arg.includes('autolinking'))) {
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = function(chunk,...args) {
    if (typeof chunk === 'string') {
      const text=chunk.trim();
      if (text.startsWith('{') || text.startsWith('[')) {
        try {chunk=JSON.stringify(normalize(JSON.parse(text)))+'\n';} catch {}
      }
    }
    return original(chunk,...args);
  };
}
