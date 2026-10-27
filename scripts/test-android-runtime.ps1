$ErrorActionPreference='Stop'
. "$PSScriptRoot\android-runtime.ps1"
$devices="List of devices attached`nphysical-phone`tdevice`nemulator-5558`tdevice`nemulator-5554`toffline`nemulator-5556`tdevice`n"
$serials=@(Get-EmulatorSerials $devices)
if($serials.Count -ne 2 -or $serials[0] -ne 'emulator-5558' -or $serials[1] -ne 'emulator-5556'){throw 'Physical/offline device filter failed'}
if(@(Get-EmulatorSerials "phone`tdevice").Count -ne 0){throw 'Default launcher could select a phone'}
if((Get-EmulatorApk -Root 'C:\demo with spaces' -AbiList 'x86_64,x86') -notlike '*one_step_service-emulator.apk'){throw 'x64 APK selection failed'}
if((Get-EmulatorApk -Root 'C:\demo' -AbiList 'arm64-v8a,armeabi-v7a') -notlike '*one_step_service-phone.apk'){throw 'ARM64 APK selection failed'}
$rejected=$false
try{Get-EmulatorApk -Root 'C:\demo' -AbiList 'x86' | Out-Null}catch{$rejected=$true}
if(!$rejected){throw '32-bit emulator must be rejected'}
$items=@([pscustomobject]@{Label='first'},[pscustomobject]@{Label='saved'})
if((Select-FirstStepOption -Items $items -PreferredLabel 'saved').Label -ne 'saved'){throw 'Saved choice was ignored'}
function Test-FailingAdb {$global:LASTEXITCODE=1;'simulated install failure'}
$rejected=$false
try{Invoke-FirstStepAdb -Adb Test-FailingAdb -Arguments @('-s','emulator-5558','install') | Out-Null}catch{$rejected=$_.Exception.Message -match 'simulated install failure'}
if(!$rejected){throw 'Native command failure was not propagated'}
$global:LASTEXITCODE=0
Write-Output 'PASS: physical/offline filtering, x64/ARM64 selection, unsupported ABI, saved target, native failure propagation.'
