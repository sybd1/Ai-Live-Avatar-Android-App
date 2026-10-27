param([switch]$AcceptedDownloads,[switch]$AcceptAndroidLicense)
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$root=Split-Path -Parent $PSScriptRoot
. "$PSScriptRoot\download-tool.ps1"
$lock=Get-Content -LiteralPath (Join-Path $root 'distribution\tools.lock.json') -Raw | ConvertFrom-Json
if(!$AcceptedDownloads){
 Write-Host '이 폴더에 무료 PowerShell 7, Java 21 런타임, PostgreSQL 17, Android Platform Tools를 설치합니다. 기존 시스템 도구는 교체하지 않습니다.'
 Write-Host '공식 Android SDK 이용약관: https://developer.android.com/studio/terms'
 Write-Host '다운로드와 약관에 동의해야 Android USB 도구를 설치할 수 있습니다.'
 if((Read-Host '동의하면 YES 입력') -ne 'YES'){throw '설치를 진행하지 않았습니다.'}
 $AcceptedDownloads=$true;$AcceptAndroidLicense=$true
}
$pwsh=Join-Path $root '.tools\pwsh7\pwsh.exe'
if(!(Test-Path -LiteralPath $pwsh)){
 $installed=Get-Command pwsh.exe -ErrorAction SilentlyContinue
 if($installed){$pwsh=$installed.Source}else{
  $archive=Get-CheckedToolArchive -Name powershell -Entry $lock.powershell -Root $root
  Expand-ToolArchive -Archive $archive -Destination (Join-Path $root '.tools\pwsh7')
 }
}
$arguments=@('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',"$PSScriptRoot\setup.ps1",'-AcceptedDownloads')
if($AcceptAndroidLicense){$arguments+='-AcceptAndroidLicense'}
& $pwsh @arguments
if($LASTEXITCODE -ne 0){throw '처음 설정을 완료하지 못했습니다.'}
