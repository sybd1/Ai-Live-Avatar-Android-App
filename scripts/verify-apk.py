"""Check configured server keys are absent from the built APK; never print key values."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
apk = root / 'mobile/android/app/build/outputs/apk/release/app-release.apk'
settings = {}
for line in (root / '.env').read_text(encoding='utf-8-sig').splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        name, value = line.split('=', 1)
        settings[name.strip()] = value.strip().strip('"')
names = ['GEMINI_API_KEY', 'KAKAO_REST_API_KEY', 'YOUTH_POLICY_API_KEY', 'STT_WORKER_TOKEN', 'DATABASE_PASSWORD']
secrets = [settings[name].encode() for name in names if len(settings.get(name, '')) >= 16]
with zipfile.ZipFile(apk) as archive:
    for item in archive.infolist():
        if item.is_dir():
            continue
        content = archive.read(item)
        if any(secret in content for secret in secrets):
            raise SystemExit('FAIL: configured server secret found in APK')
    architectures = sorted({name.split('/')[1] for name in archive.namelist() if name.startswith('lib/')})
with apk.open('rb') as stream:
    checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
filename = 'first-step-mvp-phone.apk' if architectures == ['arm64-v8a'] else 'first-step-mvp-emulator.apk' if architectures == ['x86_64'] else 'first-step-mvp-universal.apk'
metadata = {'file': filename, 'bytes': apk.stat().st_size,
            'sha256': checksum,
            'architectures': architectures, 'configuredServerSecretsAbsent': True}
folder = root / 'artifacts'
folder.mkdir(exist_ok=True)
shutil.copy2(apk, folder / metadata['file'])
(folder / 'apk-verification.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
(folder / (Path(filename).stem + '-verification.json')).write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
print('PASS configured server keys absent from APK; architectures:', ','.join(architectures))
