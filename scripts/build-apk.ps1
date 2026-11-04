param([ValidateSet('x86_64','arm64-v8a','arm64-v8a,x86_64')][string]$Architectures='x86_64',[ValidateScript({
 if($_ -in @('http://10.0.2.2:8080','http://127.0.0.1:8080')){return $true}
 $targetUri=$null
 return [Uri]::TryCreate($_,[UriKind]::Absolute,[ref]$targetUri) -and $targetUri.Scheme -eq 'https' -and !$targetUri.UserInfo -and !$targetUri.Query -and !$targetUri.Fragment -and $targetUri.AbsolutePath -eq '/'
})][string]$ApiBaseUrl='http://10.0.2.2:8080')
. "$PSScriptRoot\env.ps1"
$env:ANDROID_HOME = Join-Path $projectRoot '.tools\android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = Join-Path $projectRoot '.tools\gradle-cache'
$env:NODE_OPTIONS = '--use-system-ca --require='+(Join-Path $projectRoot 'scripts\node-path-alias.cjs')
$env:EXPO_PUBLIC_API_BASE_URL = $ApiBaseUrl
$env:EXPO_NO_TELEMETRY = '1'
Push-Location (Join-Path $projectRoot 'mobile')
try {
    $appGradle = Join-Path $projectRoot 'mobile\android\app\build.gradle'
    $gradleText = [IO.File]::ReadAllText($appGradle)
    if (!$gradleText.Contains('CMAKE_OBJECT_PATH_MAX=240')) {
        $gradleText = $gradleText.Replace("android {", "android {`n    defaultConfig { externalNativeBuild { cmake { arguments '-DCMAKE_OBJECT_PATH_MAX=240' } } }")
        [IO.File]::WriteAllText($appGradle, $gradleText)
    }
    & node scripts/patch-audio-echo.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Android 음성 반향 제거 설정 실패' }
    & node scripts/prepare-avatar-assets.mjs
    if ($LASTEXITCODE -ne 0) { throw '아바타 자산 준비 실패' }
    & node scripts/build-avatar.mjs
    if ($LASTEXITCODE -ne 0) { throw '아바타 웹 번들 생성 실패' }
    & '.\android\gradlew.bat' -p android assembleRelease "-PreactNativeArchitectures=$Architectures" --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'APK 빌드 실패' }
} finally { Pop-Location }
