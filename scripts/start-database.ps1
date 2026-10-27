. "$PSScriptRoot\env.ps1"
$pgBin=Join-Path $projectRoot '.tools\postgres\pgsql\bin'
$pgData=Join-Path $projectRoot '.tools\pgdata'
if(!(Test-Path -LiteralPath (Join-Path $pgBin 'initdb.exe'))){throw 'PostgreSQL 실행 파일이 없습니다. 처음설정.bat을 실행해 주세요.'}
if(!(Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION'))){
 if(!$env:DATABASE_PASSWORD){
  $env:DATABASE_PASSWORD=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  $text=[IO.File]::ReadAllText($configPath)
  if($text -match '(?m)^DATABASE_PASSWORD='){$text=[regex]::Replace($text,'(?m)^DATABASE_PASSWORD=.*$','DATABASE_PASSWORD='+$env:DATABASE_PASSWORD)}else{$text+=[Environment]::NewLine+'DATABASE_PASSWORD='+$env:DATABASE_PASSWORD}
  [IO.File]::WriteAllText($configPath,$text)
 }
 $pwFile=Join-Path $projectRoot '.tools\pg-init-password'
 try{
  [IO.File]::WriteAllText($pwFile,$env:DATABASE_PASSWORD)
  Push-Location (Join-Path $projectRoot '.tools')
  try{& '.\postgres\pgsql\bin\initdb.exe' -D pgdata -U firststep --auth=scram-sha-256 --pwfile=pg-init-password --encoding=UTF8 --locale=C}finally{Pop-Location}
  if($LASTEXITCODE -ne 0){throw 'DB 초기화 실패'}
 }finally{if(Test-Path -LiteralPath $pwFile){Remove-Item -LiteralPath $pwFile}}
}
Push-Location (Join-Path $projectRoot '.tools')
try{
 & '.\postgres\pgsql\bin\pg_ctl.exe' -D pgdata status 2>$null
 if($LASTEXITCODE -ne 0){
  & '.\postgres\pgsql\bin\pg_ctl.exe' -D pgdata -l postgres.log -o ("-p "+$env:DATABASE_PORT+" -h 127.0.0.1") -w start
  if($LASTEXITCODE -ne 0){throw 'DB 시작 실패. 다른 실행과 포트가 겹치는지 확인해 주세요.'}
 }
}finally{Pop-Location}
$env:PGPASSWORD=$env:DATABASE_PASSWORD
try{
 $exists=& (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p $env:DATABASE_PORT -U firststep -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='firststep'"
 if($LASTEXITCODE -ne 0){throw 'DB 로그인 실패. .env와 이 폴더 DB의 설정을 확인해 주세요.'}
 if($exists -ne '1'){& (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p $env:DATABASE_PORT -U firststep firststep;if($LASTEXITCODE -ne 0){throw 'DB 생성 실패'}}
}finally{$env:PGPASSWORD=$null}
Write-Output ('공개 공고 DB 준비: 127.0.0.1:'+$env:DATABASE_PORT+'/firststep')

