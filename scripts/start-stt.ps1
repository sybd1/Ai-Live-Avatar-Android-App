. "$PSScriptRoot\env.ps1"
$env:STT_MODEL_PATH = Join-Path $projectRoot 'models\faster-whisper-small'
Push-Location (Join-Path $projectRoot 'stt-worker')
try { & (Join-Path $projectRoot '.venv\Scripts\python.exe') -m uvicorn app:app --host 127.0.0.1 --port 8091 --no-access-log }
finally { Pop-Location }
