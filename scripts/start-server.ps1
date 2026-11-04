. "$PSScriptRoot\env.ps1"
if (!$env:JAVA_HOME) { throw 'Java 21 경로가 필요합니다.' }
$env:DATABASE_URL = 'jdbc:postgresql://127.0.0.1:55432/firststep'
Push-Location (Join-Path $projectRoot 'server')
try {
    & '.\mvnw.cmd' spring-boot:run
} finally { Pop-Location }

