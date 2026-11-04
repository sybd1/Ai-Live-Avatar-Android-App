. "$PSScriptRoot\env.ps1"
if(!$env:JAVA_HOME -or !(Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))){throw 'Java 21 런타임이 없습니다. 처음설정.bat을 실행해 주세요.'}
& "$PSScriptRoot\start-database.ps1"
$statePath=Join-Path $projectRoot '.tools\service-pids.json'
$state=if(Test-Path -LiteralPath $statePath){Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json -AsHashtable}else{@{}}
$base='http://127.0.0.1:'+$env:SERVER_PORT+'/api/v1'
try{$ready=Invoke-RestMethod -Uri ($base+'/capabilities') -TimeoutSec 2}catch{$ready=$null}
if($ready -and !$state.server){throw '같은 포트에 다른 실행이 있습니다. .env의 SERVER_PORT를 바꾸거나 기존 서버를 종료해 주세요.'}
if(!$ready){
 $sourceJar=Join-Path $projectRoot 'server\target\one_step_service-0.0.1-SNAPSHOT.jar'
 if(!(Test-Path -LiteralPath $sourceJar)){$sourceJar=Join-Path $projectRoot 'artifacts\one_step_service-server.jar'}
 if(!(Test-Path -LiteralPath $sourceJar)){$sourceJar=Join-Path $projectRoot 'server\target\firststep-0.0.1-SNAPSHOT.jar'}
 if(!(Test-Path -LiteralPath $sourceJar)){$sourceJar=Join-Path $projectRoot 'artifacts\first-step-server.jar'}
 if(!(Test-Path -LiteralPath $sourceJar)){throw '서버 실행 파일이 없습니다. GitHub Releases의 Windows 시연 ZIP을 받거나 서버를 빌드해 주세요.'}
 $runtime=Join-Path $projectRoot '.tools\runtime'
 New-Item -ItemType Directory -Path $runtime -Force | Out-Null
 $runtimeJar=Join-Path $runtime 'server.jar'
 Copy-Item -LiteralPath $sourceJar -Destination $runtimeJar -Force
 $arguments=@('-Xms64m','-Xmx384m','-jar',$runtimeJar,('--import.file='+(Join-Path $projectRoot 'data\programs.json')))
 $process=Start-Process -FilePath (Join-Path $env:JAVA_HOME 'bin\java.exe') -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot '.tools\server-out.log') -RedirectStandardError (Join-Path $projectRoot '.tools\server-error.log') -PassThru
 $state.server=@{id=$process.Id;startedAt=$process.StartTime.ToUniversalTime().ToString('o')}
 $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding utf8
}
# Live voice does not require the optional local Whisper worker or its model.
if($env:STT_AUTOSTART -eq 'true'){
 $python=Join-Path $projectRoot '.venv\Scripts\python.exe'
 if(!(Test-Path -LiteralPath $python)){throw '선택한 Whisper 실행에는 별도 Python 환경·모델 설치가 필요합니다. Live 기본 시연에는 STT_AUTOSTART=false를 사용해 주세요.'}
 try{$worker=Invoke-RestMethod -Uri 'http://127.0.0.1:8091/health' -TimeoutSec 1}catch{$worker=$null}
 if(!$worker.ready){
  $env:STT_MODEL_PATH=Join-Path $projectRoot 'models\faster-whisper-small'
  $workerProcess=Start-Process -FilePath $python -ArgumentList @('-m','uvicorn','app:app','--host','127.0.0.1','--port','8091','--no-access-log') -WorkingDirectory (Join-Path $projectRoot 'stt-worker') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot '.tools\stt-out.log') -RedirectStandardError (Join-Path $projectRoot '.tools\stt-error.log') -PassThru
  $state.worker=@{id=$workerProcess.Id;startedAt=$workerProcess.StartTime.ToUniversalTime().ToString('o')}
  $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding utf8
 }
}
$ready=$null
for($attempt=0;$attempt -lt 40;$attempt++){
 try{$ready=Invoke-RestMethod -Uri ($base+'/capabilities') -TimeoutSec 1;if($ready){break}}catch{}
 Start-Sleep -Milliseconds 300
}
if(!$ready){throw '서버가 준비되지 않았습니다. .tools/server-error.log와 포트·DB 설정을 확인해 주세요.'}
Write-Output ('서비스 준비 완료: '+$base+'/capabilities')
if(!$ready.text){Write-Output '공고 탐색은 사용할 수 있습니다. 실시간 AI 시연에는 .env의 Gemini 키와 AI_ENABLED=true가 필요합니다.'}

