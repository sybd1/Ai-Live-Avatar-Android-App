param([string]$DeviceId)
. "$PSScriptRoot\env.ps1"
$adb=Join-Path $projectRoot '.tools\android-sdk\platform-tools\adb.exe'
if(!(Test-Path -LiteralPath $adb)){throw 'Android USB 도구가 없습니다. 처음설정.bat을 실행해 주세요.'}
$phones=@(& $adb devices | Select-Object -Skip 1 | Where-Object {$_ -match '^\S+\s+device$' -and $_ -notmatch '^emulator-'} | ForEach-Object {($_ -split '\s+')[0]})
if(!$DeviceId){if($phones.Count -ne 1){throw 'USB 디버깅을 허용한 휴대폰 한 대를 연결해 주세요. 여러 대면 -DeviceId를 지정해 주세요.'};$DeviceId=$phones[0]}
if($DeviceId -notin $phones){throw '휴대폰의 USB 연결과 디버깅 허용을 확인해 주세요.'}
$abi=(& $adb -s $DeviceId shell getprop ro.product.cpu.abi | Out-String).Trim()
if($abi -ne 'arm64-v8a'){throw '배포 APK는 ARM64용입니다. 다른 기기는 별도 빌드가 필요합니다.'}
$apk=Join-Path $projectRoot 'artifacts\one_step_service-phone.apk'
if(!(Test-Path -LiteralPath $apk)){$apk=Join-Path $projectRoot 'artifacts\first-step-mvp-phone.apk'}
if(!(Test-Path -LiteralPath $apk)){throw 'GitHub Releases의 Windows 시연 ZIP에 있는 APK가 필요합니다.'}
& "$PSScriptRoot\start-services.ps1"
& $adb -s $DeviceId reverse tcp:8080 ('tcp:'+$env:SERVER_PORT)
if($LASTEXITCODE -ne 0){throw 'USB 서버 연결 실패'}
& $adb -s $DeviceId install -r $apk
if($LASTEXITCODE -ne 0){throw '휴대폰 APK 설치 실패. 휴대폰에 설치 허용 창이 있는지 확인해 주세요.'}
& $adb -s $DeviceId shell am start -n kr.ongi.firststep/.MainActivity
if($LASTEXITCODE -ne 0){throw '앱 실행 실패'}
Write-Output '휴대폰 실행 완료. 앱 주소 http://127.0.0.1:8080을 사용하며 USB와 PC 서버를 유지해 주세요. 가상 대사로만 시연해 주세요.'
