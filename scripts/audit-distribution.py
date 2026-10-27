"""Audit the explicit source snapshot and nested runtime archives without printing secrets."""
from pathlib import Path
import argparse,io,json,zipfile

root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--zip',type=Path,required=True);args=parser.parse_args()
secrets=[]
config=root/'.env'
if config.exists():
    for line in config.read_text(encoding='utf-8-sig').splitlines():
        if '=' not in line or line.startswith('#'):continue
        key,value=line.split('=',1);value=value.strip().strip('"')
        if key in {'GEMINI_API_KEY','KAKAO_REST_API_KEY','YOUTH_POLICY_API_KEY','STT_WORKER_TOKEN','DATABASE_PASSWORD'} and len(value)>=16:secrets.append(value.encode())
count=0
for file in args.source.rglob('*'):
    if not file.is_file():continue
    rel=file.relative_to(args.source)
    if file.name=='.env' or any(p in {'.tools','.venv','node_modules','pgdata','models','.git'} for p in rel.parts):raise SystemExit('Private runtime path included')
    if any(secret in file.read_bytes() for secret in secrets):raise SystemExit('Configured secret found in source')
    count+=1
entries=0
def scan(data,depth=0):
    global entries
    if any(secret in data for secret in secrets):raise SystemExit('Configured secret found in distribution')
    if depth<3 and zipfile.is_zipfile(io.BytesIO(data)):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for item in archive.infolist():
                if item.is_dir():continue
                if item.filename.endswith('/.env') or '/pgdata/' in item.filename:raise SystemExit('Private file in distribution')
                entries+=1;scan(archive.read(item),depth+1)
scan(args.zip.read_bytes())
result={'sourceFilesChecked':count,'zipEntriesChecked':entries,'configuredSecretsAbsent':True,'privateRuntimeExcluded':True}
(root/'.tools/share-scan.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
