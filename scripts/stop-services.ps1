param([switch]$IncludeDatabase,[switch]$IncludeEmulator)
. "$PSScriptRoot\env.ps1"
if(Test-Path -LiteralPath (Join-Path $projectRoot '.tools\service-pids.json')){
    $state=Get-Content -LiteralPath (Join-Path $projectRoot '.tools\service-pids.json') -Raw | ConvertFrom-Json -AsHashtable
    foreach($name in @('server','worker','workerLauncher')){
        $record=$state[$name]
        if($record -isnot [System.Collections.IDictionary]){continue}
        $process=Get-Process -Id $record.id -ErrorAction SilentlyContinue
        if(!$process){continue}
        $recordedStart = if($record.startedAt -is [datetime]){$record.startedAt}else{[datetime]::Parse($record.startedAt,[cultureinfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)}
        $difference=($process.StartTime.ToUniversalTime()-$recordedStart.ToUniversalTime()).TotalSeconds
        if([math]::Abs($difference) -lt 1 -and $process.ProcessName -match '^(java|python)$'){Stop-Process -Id $process.Id}
        else{Write-Output "$name 프로세스의 소유 기록이 달라 종료하지 않았습니다."}
    }
}
if($IncludeDatabase){Push-Location (Join-Path $projectRoot '.tools');try{& '.\postgres\pgsql\bin\pg_ctl.exe' -D pgdata -m fast -w stop}finally{Pop-Location}}
if($IncludeEmulator -and (Test-Path -LiteralPath (Join-Path $projectRoot '.tools\emulator.pid'))){$adb=Join-Path $projectRoot '.tools\android-sdk\platform-tools\adb.exe';$names=@(& $adb -s emulator-5554 emu avd name | ForEach-Object {$_.Trim()});if($names -contains 'firststep_api36'){& $adb -s emulator-5554 emu kill}}
Write-Output '이 프로젝트가 시작한 서비스만 종료했습니다.'
