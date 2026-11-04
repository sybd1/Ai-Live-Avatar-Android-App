function Get-CheckedToolArchive {
 param([Parameter(Mandatory=$true)][string]$Name,[Parameter(Mandatory=$true)]$Entry,[Parameter(Mandatory=$true)][string]$Root)
 $cache=Join-Path $Root '.tools\setup-cache'
 New-Item -ItemType Directory -Path $cache -Force | Out-Null
 $file=Join-Path $cache ($Name+'.zip')
 $algorithm=[string]$Entry.checksumAlgorithm
 $expected=[string]$Entry.checksum
 if($algorithm -notin @('SHA256','SHA1') -or $expected -notmatch '^[a-fA-F0-9]{40,64}$'){throw ('도구 체크섬 명세 오류: '+$Name)}
 $uri=[uri]$Entry.url
 if($uri.Scheme -ne 'https' -or $uri.Host -notin @('github.com','dl.google.com','get.enterprisedb.com')){throw '허용된 공식 HTTPS 다운로드 주소가 아닙니다.'}
 if(Test-Path -LiteralPath $file){if((Get-FileHash -LiteralPath $file -Algorithm $algorithm).Hash -eq $expected){return $file}}
 Write-Host ('공식 도구 다운로드: '+$Name+' / '+[math]::Round($Entry.bytes/1MB)+' MB')
 $previousProgress=$ProgressPreference
 try{$ProgressPreference='SilentlyContinue';Invoke-WebRequest -UseBasicParsing -Uri $uri.AbsoluteUri -OutFile ($file+'.part') -TimeoutSec 900}finally{$ProgressPreference=$previousProgress}
 if((Get-FileHash -LiteralPath ($file+'.part') -Algorithm $algorithm).Hash -ne $expected){throw ('체크섬 불일치. 실행·압축 해제를 중단했습니다: '+$Name)}
 Move-Item -LiteralPath ($file+'.part') -Destination $file -Force
 return $file
}

function Expand-ToolArchive {
 param([string]$Archive,[string]$Destination,[switch]$PostgresOnly)
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $root=[IO.Path]::GetFullPath($Destination).TrimEnd('\')+'\'
 [IO.Directory]::CreateDirectory($root) | Out-Null
 $zip=[IO.Compression.ZipFile]::OpenRead($Archive)
 try{foreach($entry in $zip.Entries){
  if($PostgresOnly -and $entry.FullName -match '^pgsql/(pgAdmin|StackBuilder)'){continue}
  $target=[IO.Path]::GetFullPath((Join-Path $root $entry.FullName))
  if(!$target.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){throw '압축 내부 경로 오류'}
  if(!$entry.Name){[IO.Directory]::CreateDirectory($target) | Out-Null;continue}
  [IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
  [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$true)
 }}finally{$zip.Dispose()}
}
