. "$PSScriptRoot\env.ps1"
$apk=Join-Path $projectRoot 'artifacts\first-step-mvp-emulator.apk'
$adb=Join-Path $projectRoot '.tools\android-sdk\platform-tools\adb.exe'
if (!(Test-Path -LiteralPath $apk)) {
 $phoneApk=Join-Path $projectRoot 'artifacts\first-step-mvp-phone.apk'
 $deviceAbis=(& $adb -s emulator-5554 shell getprop ro.product.cpu.abilist) -join ''
 if($LASTEXITCODE -ne 0){throw '가상 기기의 지원 아키텍처를 확인하지 못했습니다.'}
 if((Test-Path -LiteralPath $phoneApk) -and 'arm64-v8a' -in ($deviceAbis.Trim() -split ',')){$apk=$phoneApk}
 else{throw '이 가상 기기용 APK가 없습니다. x86_64 APK를 준비하거나 ARM64 앱 실행을 지원하는 시스템 이미지를 사용해 주세요.'}
}
& $adb -s emulator-5554 install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'APK 설치 실패' }
& $adb -s emulator-5554 reverse tcp:8080 ('tcp:'+$env:SERVER_PORT)
if ($LASTEXITCODE -ne 0) { throw '에뮬레이터 서버 연결 실패' }
& $adb -s emulator-5554 shell am start -n kr.ongi.firststep/.MainActivity
