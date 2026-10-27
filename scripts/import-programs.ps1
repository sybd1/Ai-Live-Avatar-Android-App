param([Parameter(Mandatory=$true)][string]$File)
. "$PSScriptRoot\env.ps1"
$resolvedFile = (Resolve-Path -LiteralPath $File).Path
& (Join-Path $env:JAVA_HOME 'bin\java.exe') '-Dfirststep.importOnly=true' -jar (Join-Path $projectRoot 'server\target\firststep-0.0.1-SNAPSHOT.jar') '--spring.main.web-application-type=none' "--import.file=$resolvedFile"
if ($LASTEXITCODE -ne 0) { throw '공고 검증·등록 실패' }
