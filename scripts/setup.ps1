param([switch]$AcceptedDownloads,[switch]$AcceptAndroidLicense,[switch]$SkipAndroid,[switch]$SkipArtifacts)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
. "$PSScriptRoot\download-tool.ps1"
$lock=Get-Content -LiteralPath (Join-Path $root 'distribution\tools.lock.json') -Raw | ConvertFrom-Json
if(!$AcceptedDownloads){
 Write-Host '공식 무료 Java 21 런타임, PostgreSQL 17과 Android USB 도구를 이 폴더에 준비합니다.'
 Write-Host 'Android 약관: https://developer.android.com/studio/terms'
 if((Read-Host '다운로드·약관에 동의하면 YES 입력') -ne 'YES'){throw '설치를 진행하지 않았습니다.'}
 $AcceptAndroidLicense=$true
}
if(!$SkipArtifacts){foreach($name in @('first-step-server.jar','first-step-mvp-phone.apk')){if(!(Test-Path -LiteralPath (Join-Path $root ('artifacts\'+$name)))){throw 'GitHub Releases의 Windows 시연 ZIP을 내려받아 압축을 푼 폴더에서 실행해 주세요. 소스만 받은 경우 실행 파일을 먼저 준비해야 합니다.'}}}
if(!(Test-Path -LiteralPath (Join-Path $env:WINDIR 'System32\vcruntime140.dll'))){throw 'Microsoft Visual C++ x64 런타임 설치가 필요합니다: https://aka.ms/vs/17/release/vc_redist.x64.exe'}
$config=Join-Path $root '.env'
if(!(Test-Path -LiteralPath $config)){Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination $config}
$javaReady=$false
foreach($folder in @('.tools\java21','.tools\jdk21')){if(Get-ChildItem -LiteralPath (Join-Path $root $folder) -Directory -ErrorAction SilentlyContinue | Where-Object {Test-Path -LiteralPath (Join-Path $_.FullName 'bin\java.exe')}){$javaReady=$true}}
if(!$javaReady -and $env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))){
 $version=(& (Join-Path $env:JAVA_HOME 'bin\java.exe') -version 2>&1 | Out-String)
 $javaReady=$version -match 'version "21\.'
}
if(!$javaReady){$archive=Get-CheckedToolArchive -Name java -Entry $lock.java -Root $root;Expand-ToolArchive -Archive $archive -Destination (Join-Path $root '.tools\java21')}
if(!(Test-Path -LiteralPath (Join-Path $root '.tools\postgres\pgsql\bin\initdb.exe'))){$archive=Get-CheckedToolArchive -Name postgres -Entry $lock.postgres -Root $root;Expand-ToolArchive -Archive $archive -Destination (Join-Path $root '.tools\postgres') -PostgresOnly}
if(!$SkipAndroid -and !(Test-Path -LiteralPath (Join-Path $root '.tools\android-sdk\platform-tools\adb.exe'))){
 if(!$AcceptAndroidLicense){throw 'Android 약관 동의가 필요합니다. 처음설정.bat을 실행해 주세요.'}
 $archive=Get-CheckedToolArchive -Name adb -Entry $lock.adb -Root $root;Expand-ToolArchive -Archive $archive -Destination (Join-Path $root '.tools\android-sdk')
}
Write-Output '실행 도구 준비 완료. .env에서 본인의 GEMINI_API_KEY와 AI_ENABLED=true를 설정한 뒤 실행.bat을 실행해 주세요.'
Write-Output '지도 경로에는 본인의 KAKAO_REST_API_KEY와 MAP_ROUTING_ENABLED=true가 필요합니다. 키가 없어도 공고·상태 기록 화면은 사용할 수 있습니다.'
