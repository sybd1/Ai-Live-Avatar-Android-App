param([switch]$KeepMicrophoneOff,[switch]$ForceEmulator)
. "$PSScriptRoot\env.ps1"
$adb=Join-Path $projectRoot '.tools\android-sdk\platform-tools\adb.exe'
if(!(Test-Path -LiteralPath $adb)){throw '처음설정.bat을 먼저 실행해 주세요.'}
if(!$ForceEmulator){
 $phones=@(& $adb devices | Select-Object -Skip 1 | Where-Object {$_ -match '^\S+\s+device$' -and $_ -notmatch '^emulator-'})
 if($phones.Count -eq 1){& "$PSScriptRoot\run-phone.ps1";return}
 if($phones.Count -gt 1){throw '여러 휴대폰이 연결됐습니다. run-phone.ps1 -DeviceId로 대상을 지정해 주세요.'}
}
if(!(Test-Path -LiteralPath (Join-Path $projectRoot '.tools\android-sdk\emulator\emulator.exe'))){throw 'USB 디버깅을 켠 Android 휴대폰을 연결해 주세요. 일반 시연 설치에는 에뮬레이터를 포함하지 않습니다.'}
& "$PSScriptRoot\start-services.ps1"
& "$PSScriptRoot\start-emulator.ps1" -Visible
$booted=$false
for($i=0;$i -lt 360;$i++){
 $status=(& $adb -s emulator-5554 shell getprop sys.boot_completed 2>$null) -join ''
 if($status.Trim() -eq '1'){$booted=$true;break}
 Start-Sleep -Milliseconds 500
}
if(!$booted){throw '에뮬레이터가 아직 부팅 중입니다. 잠시 뒤 다시 실행해 주세요.'}
& $adb -s emulator-5554 shell wm size 720x1280
& $adb -s emulator-5554 shell wm density 280
& $adb -s emulator-5554 shell settings put secure show_ime_with_hard_keyboard 1
& "$PSScriptRoot\install-apk.ps1"
if($KeepMicrophoneOff){& $adb -s emulator-5554 emu avd hostmicon off}else{& $adb -s emulator-5554 emu avd hostmicon on}
Write-Output '가상 대사로만 시연하세요. 연습 시작 후 자동으로 듣고 답하며 쉬기·종료하면 마이크를 멈춥니다.'
