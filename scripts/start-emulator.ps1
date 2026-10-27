param([switch]$Visible,[ValidateSet('host','swiftshader','auto')][string]$Gpu='host',[int]$MemoryMb=4096,[switch]$EnableVulkan)
. "$PSScriptRoot\env.ps1"
$env:ANDROID_HOME=Join-Path $projectRoot '.tools\android-sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:ANDROID_AVD_HOME=Join-Path $projectRoot '.tools\avd'
$env:ANDROID_USER_HOME=Join-Path $projectRoot '.tools\android-user'
$emulatorArgs=@('-avd','firststep_api36','-no-snapshot','-no-boot-anim','-gpu',$Gpu,'-memory',"$MemoryMb",'-port','5554')
if (!$EnableVulkan) { $emulatorArgs += @('-feature','-Vulkan') }
if (!$Visible) { $emulatorArgs += '-no-window' }
$adb=Join-Path $projectRoot '.tools\android-sdk\platform-tools\adb.exe'
$devices=& $adb devices
if ($devices -match 'emulator-5554\s+device') { Write-Output '에뮬레이터가 이미 실행 중입니다.';return }
$windowStyle=if($Visible){'Normal'}else{'Hidden'}
$p=Start-Process -FilePath (Join-Path $projectRoot '.tools\android-sdk\emulator\emulator.exe') -ArgumentList $emulatorArgs -WindowStyle $windowStyle -RedirectStandardOutput (Join-Path $projectRoot '.tools\emulator-out.log') -RedirectStandardError (Join-Path $projectRoot '.tools\emulator-error.log') -PassThru
$p.Id | Set-Content -LiteralPath (Join-Path $projectRoot '.tools\emulator.pid')
Write-Output '에뮬레이터 부팅을 시작했습니다. 부팅 완료 후 install-apk.ps1을 실행하세요.'

