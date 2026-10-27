param([switch]$ConfigureKeys,[switch]$Phone,[switch]$KeepMicrophoneOff)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
. "$PSScriptRoot\env.ps1"
. "$PSScriptRoot\android-runtime.ps1"
$sdkPaths=@(Get-AndroidSdkCandidates -Root $root)
$adb=Get-AndroidAdb -SdkPaths $sdkPaths

if($ConfigureKeys){
 Write-Host 'AI 음성 시연에는 본인의 Gemini API 키가 필요합니다. 실제 사연 대신 가상 인물의 대사만 사용해 주세요. 키 없이도 공고 탐색과 자기 응답 기록은 사용할 수 있습니다.'
 if((Read-Host '지금 키를 입력하려면 Y, 나중에 설정하려면 Enter') -eq 'Y'){
  $secure=Read-Host 'Gemini API 키 (화면에 표시되지 않음)' -AsSecureString
  $key=[Net.NetworkCredential]::new('',$secure).Password
  if($key -and $key -notmatch '[\r\n]'){
   $path=Join-Path $root '.env';$text=[IO.File]::ReadAllText($path)
   $text=[regex]::Replace($text,'(?m)^GEMINI_API_KEY=.*$',{param($m)'GEMINI_API_KEY='+$key})
   $text=[regex]::Replace($text,'(?m)^AI_ENABLED=.*$','AI_ENABLED=true')
   [IO.File]::WriteAllText($path,$text)
  }
  $key=$null;$secure.Dispose()
 }
}

if($Phone){
 # Phone mode is explicit; the default launcher never selects a physical phone.
 $env:FIRSTSTEP_ADB=$adb
 & "$PSScriptRoot\run-phone.ps1"
 return
}
$preferencesPath=Join-Path $root '.tools\launcher-preferences.json'
$preferences=if(Test-Path -LiteralPath $preferencesPath){try{Get-Content -LiteralPath $preferencesPath -Raw | ConvertFrom-Json}catch{$null}}else{$null}
$devices=Invoke-FirstStepAdb -Adb $adb -Arguments @('devices')
$serials=@(Get-EmulatorSerials -DevicesOutput $devices)
$avd=$null;$emulatorProcess=$null
if($serials.Count){
 $items=@($serials | ForEach-Object {[pscustomobject]@{Serial=$_;Label=$_}})
 $selected=Select-FirstStepOption -Items $items -Prompt '실행 중인 에뮬레이터를 선택해 주세요.' -PreferredLabel $preferences.Device
 $device=$selected.Serial
}else{
 $avds=@(Get-AvailableAvds -SdkPaths $sdkPaths -Root $root)
 $avd=Select-FirstStepOption -Items $avds -Prompt '사용할 가상 기기를 선택해 주세요. 목록이 없다면 Android Studio Device Manager에서 기존 가상 기기를 먼저 실행한 뒤 실행.bat을 다시 눌러 주세요.' -PreferredLabel $preferences.Avd
 $ports=@([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | ForEach-Object {$_.Port})
 $port=@(5554..5584 | Where-Object {$_ % 2 -eq 0 -and $_ -notin $ports -and ($_+1) -notin $ports}) | Select-Object -First 1
 if(!$port){throw '에뮬레이터용 빈 포트가 없습니다. 기존 가상 기기를 먼저 실행해 주세요.'}
 $device='emulator-'+$port
 $saved=@{}
 foreach($name in @('ANDROID_HOME','ANDROID_SDK_ROOT','ANDROID_AVD_HOME','ANDROID_USER_HOME')){$saved[$name]=[Environment]::GetEnvironmentVariable($name)}
 try{
  $env:ANDROID_HOME=$avd.Sdk;$env:ANDROID_SDK_ROOT=$avd.Sdk;$env:ANDROID_AVD_HOME=$avd.AvdHome;$env:ANDROID_USER_HOME=$avd.UserHome
  $emulatorProcess=Start-Process -FilePath (Join-Path $avd.Sdk 'emulator\emulator.exe') -ArgumentList @('-avd',$avd.Name,'-port',"$port",'-gpu','host','-feature','-Vulkan','-no-snapshot','-no-boot-anim') -WindowStyle Normal -RedirectStandardOutput (Join-Path $root '.tools\launcher-emulator-out.log') -RedirectStandardError (Join-Path $root '.tools\launcher-emulator-error.log') -PassThru
 }finally{foreach($name in $saved.Keys){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}}
 Write-Host ('가상 기기 부팅 중: '+$avd.Name)
}
$booted=$false
for($i=0;$i -lt 180;$i++){
 $status=& $adb -s $device shell getprop sys.boot_completed 2>$null
 if($LASTEXITCODE -eq 0 -and ($status -join '').Trim() -eq '1'){$booted=$true;break}
 # emulator.exe can hand off to qemu; readiness is determined by ADB, not its wrapper PID.
 Start-Sleep -Seconds 1
}
if(!$booted){throw '3분 안에 가상 기기가 준비되지 않았습니다. Android Studio에서 부팅 상태와 가상화 설정을 확인해 주세요.'}
$abis=Invoke-FirstStepAdb -Adb $adb -Arguments @('-s',$device,'shell','getprop','ro.product.cpu.abilist')
$apk=Get-EmulatorApk -Root $root -AbiList $abis
if(!(Test-Path -LiteralPath $apk)){throw '해당 기기용 APK가 없습니다. 최신 Windows MVP 배포 ZIP을 사용해 주세요.'}

& "$PSScriptRoot\start-services.ps1"
$null=Invoke-FirstStepAdb -Adb $adb -Arguments @('-s',$device,'reverse','tcp:8080',('tcp:'+$env:SERVER_PORT))
Write-Host '앱 설치·업데이트 중. 기존 상태 기록을 유지합니다.'
$null=Invoke-FirstStepAdb -Adb $adb -Arguments @('-s',$device,'install','-r',$apk)
# Failure here must not silently uninstall the app or erase its local records.
$null=Invoke-FirstStepAdb -Adb $adb -Arguments @('-s',$device,'shell','settings','put','secure','show_ime_with_hard_keyboard','1')
$mic=if($KeepMicrophoneOff){'off'}else{'on'}
$null=Invoke-FirstStepAdb -Adb $adb -Arguments @('-s',$device,'emu','avd','hostmicon',$mic)
$null=Invoke-FirstStepAdb -Adb $adb -Arguments @('-s',$device,'shell','am','start','-W','-n','kr.ongi.firststep/.MainActivity')
@{Device=$device;Avd=if($avd){$avd.Label}else{$preferences.Avd}} | ConvertTo-Json | Set-Content -LiteralPath $preferencesPath -Encoding utf8
Write-Host 'one_step_service 실행 완료. 서버는 백그라운드에서 동작합니다. 앱의 주소는 http://127.0.0.1:8080을 사용하세요.'
Write-Host 'AI 미연결이면 .env의 GEMINI_API_KEY와 AI_ENABLED=true를 설정해 주세요. 지도는 카카오 키와 MAP_ROUTING_ENABLED=true가 필요합니다.'
