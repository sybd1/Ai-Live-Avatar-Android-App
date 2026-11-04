function Resolve-FirstStepExistingAlias {
 param([string]$Path)
 if(!$Path){return $null}
 if(!('FirstStepAndroidDriveApi' -as [type])){
  Add-Type -TypeDefinition 'using System; using System.Text; using System.Runtime.InteropServices; public static class FirstStepAndroidDriveApi { [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] public static extern uint QueryDosDevice(string name,StringBuilder target,int max); }'
 }
 $full=[IO.Path]::GetFullPath($Path).TrimEnd('\');$matchesList=@()
 foreach($letter in @('P','Q','R','S','T','U','V','W','X','Y','Z')){
  $buffer=[Text.StringBuilder]::new(4096)
  if([FirstStepAndroidDriveApi]::QueryDosDevice(($letter+':'),$buffer,$buffer.Capacity) -eq 0){continue}
  $target=$buffer.ToString()
  if(!$target.StartsWith('\??\')){continue}
  $target=$target.Substring(4).TrimEnd('\')
  if([string]::Equals($full,$target,[StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)){
   $matchesList+=[pscustomobject]@{Length=$target.Length;Path=($letter+':'+$full.Substring($target.Length))}
  }
 }
 if($matchesList.Count){return ($matchesList | Sort-Object Length -Descending | Select-Object -First 1).Path}
 $full
}

function Get-AndroidSdkCandidates {
 param([string]$Root)
 $paths=@($env:ANDROID_HOME,$env:ANDROID_SDK_ROOT)
 if($env:LOCALAPPDATA){$paths+=Join-Path $env:LOCALAPPDATA 'Android\Sdk'}
 $paths+=Join-Path $Root '.tools\android-sdk'
 @($paths | Where-Object {$_ -and (Test-Path -LiteralPath $_)} | ForEach-Object {Resolve-FirstStepExistingAlias $_} | Select-Object -Unique)
}

function Get-AndroidAdb {
 param([string[]]$SdkPaths)
 foreach($sdk in $SdkPaths){$candidate=Join-Path $sdk 'platform-tools\adb.exe';if(Test-Path -LiteralPath $candidate){return $candidate}}
 $installed=Get-Command adb.exe -ErrorAction SilentlyContinue
 if($installed){return $installed.Source}
 throw 'Android SDK의 platform-tools/adb.exe를 찾지 못했습니다. ANDROID_HOME을 기존 SDK 폴더로 설정하거나 Android Studio의 SDK 경로를 확인해 주세요.'
}

function Invoke-FirstStepAdb {
 param([string]$Adb,[string[]]$Arguments)
 $result=& $Adb @Arguments 2>&1
 if($LASTEXITCODE -ne 0){throw ('Android 명령 실패: '+(($Arguments | Select-Object -First 3) -join ' ')+[Environment]::NewLine+($result -join [Environment]::NewLine))}
 ($result | ForEach-Object {"$_"}) -join [Environment]::NewLine
}

function Get-EmulatorSerials {
 param([string]$DevicesOutput)
 @($DevicesOutput -split '\r?\n' | Where-Object {$_ -match '^emulator-\d+\s+device(?:\s|$)'} | ForEach-Object {($_ -split '\s+')[0]})
}

function Get-EmulatorApk {
 param([string]$Root,[string]$AbiList)
 $abis=$AbiList.Trim() -split ','
 if('x86_64' -in $abis){return Join-Path $Root 'artifacts\one_step_service-emulator.apk'}
 if('arm64-v8a' -in $abis){return Join-Path $Root 'artifacts\one_step_service-phone.apk'}
 throw '이 가상 기기는 64비트 Android APK와 호환되지 않습니다. x86_64 또는 ARM64 가상 기기를 선택해 주세요.'
}

function Get-AvailableAvds {
 param([string[]]$SdkPaths,[string]$Root)
 foreach($sdk in $SdkPaths){
  $exe=Join-Path $sdk 'emulator\emulator.exe'
  if(!(Test-Path -LiteralPath $exe)){continue}
  $isLocal=[string]::Equals($sdk.TrimEnd('\'),(Resolve-FirstStepExistingAlias (Join-Path $Root '.tools\android-sdk')),[StringComparison]::OrdinalIgnoreCase)
  $saved=@{}
  foreach($name in @('ANDROID_HOME','ANDROID_SDK_ROOT','ANDROID_AVD_HOME','ANDROID_USER_HOME')){$saved[$name]=[Environment]::GetEnvironmentVariable($name)}
  try{
   $env:ANDROID_HOME=$sdk;$env:ANDROID_SDK_ROOT=$sdk
   $env:ANDROID_AVD_HOME=Resolve-FirstStepExistingAlias $env:ANDROID_AVD_HOME
   $env:ANDROID_USER_HOME=Resolve-FirstStepExistingAlias $env:ANDROID_USER_HOME
   if($isLocal -and (Test-Path -LiteralPath (Join-Path $Root '.tools\avd'))){$env:ANDROID_AVD_HOME=Resolve-FirstStepExistingAlias (Join-Path $Root '.tools\avd');$env:ANDROID_USER_HOME=Resolve-FirstStepExistingAlias (Join-Path $Root '.tools\android-user')}
   $names=@(& $exe -list-avds 2>$null)
   if($LASTEXITCODE -ne 0){continue}
   foreach($name in $names){
    $name="$name".Trim()
    if($name -match '^[A-Za-z0-9_.-]+$'){
     [pscustomobject]@{Name=$name;Sdk=$sdk;AvdHome=$env:ANDROID_AVD_HOME;UserHome=$env:ANDROID_USER_HOME;Label=($name+' ['+$sdk+']')}
    }
   }
  }finally{foreach($name in $saved.Keys){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}}
 }
}

function Select-FirstStepOption {
 param([object[]]$Items,[string]$Prompt,[string]$PreferredLabel)
 if(!$Items.Count){throw $Prompt}
 if($Items.Count -eq 1){return $Items[0]}
 $preferred=@($Items | Where-Object {$_.Label -eq $PreferredLabel})
 if($preferred.Count -eq 1){return $preferred[0]}
 Write-Host $Prompt
 for($i=0;$i -lt $Items.Count;$i++){Write-Host ('  '+($i+1)+'. '+$Items[$i].Label)}
 $number=0
 do{$answer=Read-Host '사용할 번호';$valid=[int]::TryParse($answer,[ref]$number) -and $number -ge 1 -and $number -le $Items.Count}while(!$valid)
 $Items[$number-1]
}
