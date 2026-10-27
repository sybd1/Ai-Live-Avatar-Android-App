"""Build a source snapshot and a Windows runtime ZIP from an explicit allowlist."""
from pathlib import Path
import argparse, fnmatch, hashlib, json, os, shutil, zipfile

root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--runtime',type=Path,required=True);args=parser.parse_args()
excluded_dirs={'.git','.tools','.venv','node_modules','android','ios','target','models','__pycache__','.expo','dist'}
def allowed(path):
    rel=path.relative_to(root)
    if any(p in excluded_dirs for p in rel.parts[:-1]):return False
    if path.name.startswith('.env') and path.name!='.env.example':return False
    if any(fnmatch.fnmatch(path.name,p) for p in ('*.log','*.pyc','*.jks','*.keystore','*.apk','*.jar','*.zip')):return False
    if rel.parts[0]=='verification' and path.name!='README.md':return False
    if rel.as_posix() in ('mobile/assets/avatar/mpfb.glb','mobile/assets/avatar-web/bundle.avatarjs'):return False
    if rel.parts[0]=='distribution' and path.name.endswith('-checksums.json'):return False
    if rel.as_posix()=='distribution/SHA256SUMS.txt':return False
    return True
args.source.mkdir(parents=True,exist_ok=True)
files=[]
for folder,dirs,names in os.walk(root):
    dirs[:]=[name for name in dirs if name not in excluded_dirs]
    for name in names:
        path=Path(folder)/name
        if allowed(path):
            rel=path.relative_to(root);dest=args.source/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,dest);files.append(rel)
runtime_roots={'scripts','data','distribution','docs'}
runtime_files={Path(name) for name in ('README.md','THIRD_PARTY_NOTICES.md','.env.example','.firststep-project-id','실행.bat','휴대폰실행.bat','처음설정.bat')}
runtime_files.update(rel for rel in files if rel.parts[0] in runtime_roots)
runtime_files.update(Path('mobile/assets/avatar')/name for name in ('SDK-LICENSE.txt','LICENSES.md','provenance.json','assets.lock.json'))
runtime_files.add(Path('mobile/LICENSE'))
runtime_files.update(Path('artifacts')/name for name in ('first-step-server.jar','first-step-mvp-phone.apk'))
checksums={rel.as_posix():hashlib.sha256((root/rel).read_bytes()).hexdigest() for rel in sorted(runtime_files)}
args.runtime.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(args.runtime,'w',zipfile.ZIP_DEFLATED,compresslevel=4) as archive:
    for rel in sorted(runtime_files):archive.write(root/rel,'One-Step-Service/'+rel.as_posix())
    archive.writestr('One-Step-Service/distribution/runtime-checksums.json',json.dumps(checksums,indent=2)+'\n')
print(json.dumps({'sourceFiles':len(files),'runtimeFiles':len(runtime_files),'runtimeBytes':args.runtime.stat().st_size}))
