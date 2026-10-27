param([string]$Phase='idle',[ValidateRange(1,20)][int]$Samples=3,[ValidateRange(1,10)][int]$Seconds=3)
. "$PSScriptRoot\env.ps1"
$logicalCount=(Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$qemu=Get-CimInstance Win32_Process -Filter "Name='qemu-system-x86_64.exe'" | Where-Object {$_.CommandLine -match '-avd\s+firststep_api36(?:\s|$)'}
if(@($qemu).Count -ne 1){throw '프로젝트 에뮬레이터 프로세스를 하나로 확인하지 못했습니다.'}
$records=@()
for($i=0;$i -lt $Samples;$i++){
    $process=Get-Process -Id $qemu.ProcessId
    $cpuBefore=$process.TotalProcessorTime.TotalSeconds
    $clock=[Diagnostics.Stopwatch]::StartNew()
    Start-Sleep -Seconds $Seconds
    $elapsed=$clock.Elapsed.TotalSeconds
    $process=Get-Process -Id $qemu.ProcessId
    $cores=($process.TotalProcessorTime.TotalSeconds-$cpuBefore)/$elapsed
    $record=[ordered]@{phase=$Phase;sample=$i+1;cpuPercent=[math]::Round($cores/$logicalCount*100,2);cpuCoreEquivalent=[math]::Round($cores,2);workingSetMb=[math]::Round($process.WorkingSet64/1MB);logicalProcessors=$logicalCount}
    $records+=$record
    $record | ConvertTo-Json -Compress
}
$path=Join-Path $projectRoot '.tools\performance-measurements.jsonl'
foreach($record in $records){$record | ConvertTo-Json -Compress | Add-Content -LiteralPath $path -Encoding utf8}
