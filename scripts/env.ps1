$ErrorActionPreference='Stop'
$canonicalRoot=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
if(!('FirstStepDriveApi' -as [type])){
 Add-Type -TypeDefinition 'using System; using System.Text; using System.Runtime.InteropServices; public static class FirstStepDriveApi { [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern uint QueryDosDevice(string name,StringBuilder target,int max); }'
}
$mappings=@{};$occupied=@{}
foreach($letterName in @('P','Q','R','S','T','U','V','W','X','Y','Z')){
 $buffer=[Text.StringBuilder]::new(4096)
 if([FirstStepDriveApi]::QueryDosDevice(($letterName+':'),$buffer,$buffer.Capacity) -gt 0){
  $occupied[$letterName]=$true;$target=$buffer.ToString()
  if($target.StartsWith('\??\')){$mappings[$letterName]=$target.Substring(4).TrimEnd('\')}
 }
}
if($canonicalRoot -match '^([A-Za-z]):(.*)$' -and $mappings.ContainsKey($matches[1].ToUpperInvariant())){$canonicalRoot=$mappings[$matches[1].ToUpperInvariant()]+$matches[2]}
$configPath=Join-Path $canonicalRoot '.env'
if(!(Test-Path -LiteralPath $configPath)){throw '.env가 없습니다. 처음설정.bat을 먼저 실행해 주세요.'}
foreach($line in [IO.File]::ReadAllLines($configPath)){
 if($line -match '^([A-Z][A-Z0-9_]*)=(.*)$'){[Environment]::SetEnvironmentVariable($matches[1],$matches[2].Trim().Trim('"'),'Process')}
}
$requested=$env:FIRSTSTEP_DRIVE_LETTER
if($requested -and $requested -notmatch '^[P-Z]$'){throw 'FIRSTSTEP_DRIVE_LETTER는 P~Z 중 한 글자로 지정해 주세요.'}
$letter=$null
if(!$requested){$letter=$mappings.Keys | Where-Object {[string]::Equals($mappings[$_],$canonicalRoot,[StringComparison]::OrdinalIgnoreCase)} | Select-Object -First 1}
if(!$letter){
 $choices=if($requested){@($requested)}else{@('P','Q','R','S','T','U','V','W','X','Y','Z')}
 foreach($candidate in $choices){
  if($mappings.ContainsKey($candidate) -and [string]::Equals($mappings[$candidate],$canonicalRoot,[StringComparison]::OrdinalIgnoreCase)){$letter=$candidate;break}
  if(!$occupied.ContainsKey($candidate) -and !(Test-Path -LiteralPath ($candidate+':\'))){& subst ($candidate+':') $canonicalRoot;if($LASTEXITCODE -ne 0){throw '프로젝트 경로 별칭 생성 실패'};$letter=$candidate;break}
 }
}
if(!$letter){throw '사용 가능한 P~Z 드라이브 별칭이 없습니다. 사용 중인 드라이브는 변경하지 않았습니다.'}
$projectRoot=$letter+':\'
$configPath=Join-Path $projectRoot '.env'
$env:FIRSTSTEP_RUNTIME_ROOT=$projectRoot
$env:FIRSTSTEP_CANONICAL_ROOT=$canonicalRoot
foreach($location in @('.tools\java21','.tools\jdk21')){
 $folder=Join-Path $projectRoot $location
 $java=Get-ChildItem -LiteralPath $folder -Directory -ErrorAction SilentlyContinue | Where-Object {Test-Path -LiteralPath (Join-Path $_.FullName 'bin\java.exe')} | Select-Object -First 1
 if($java){$env:JAVA_HOME=$java.FullName;break}
}
if(!$env:SERVER_PORT){$env:SERVER_PORT='8080'}
if(!$env:DATABASE_PORT){$env:DATABASE_PORT=if($env:DATABASE_URL -match ':(\d+)/firststep$'){$matches[1]}else{'55432'}}
foreach($port in @($env:SERVER_PORT,$env:DATABASE_PORT)){if($port -notmatch '^\d+$' -or [int]$port -lt 1024 -or [int]$port -gt 65535){throw '서버·DB 포트는 1024~65535 범위로 지정해 주세요.'}}
$env:MAVEN_OPTS='-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE'
$env:JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE'
$env:NODE_OPTIONS='--use-system-ca'

