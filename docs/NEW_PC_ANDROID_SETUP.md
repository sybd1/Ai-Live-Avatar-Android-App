# 새 Windows PC에서 Android 에뮬레이터로 실행하기

**대상:** Windows 10/11 x64 노트북. `.env`는 별도로 준비한 상태를 전제로 하며 이 문서에서 다루지 않는다.

이 저장소는 소스 배포본이다. 서버 JAR와 APK는 6·7절의 명령으로 직접 빌드한 뒤 5절의 실행 단계를 진행한다. 소스만 내려받은 상태에서는 `실행.bat`이 바로 동작하지 않는다.

## 1. 직접 설치할 프로그램

이미 설치돼 있다면 버전만 확인한다. 각 설치 파일을 받아 실행하고, 설치가 끝나면 터미널을 닫았다가 다시 연다.

| 프로그램 | 공식 설치 링크 | 선택할 항목·용도 |
| --- | --- | --- |
| Git for Windows | [Windows 설치 파일](https://git-scm.com/install/windows) | Windows x64. GitHub 소스 받기 |
| PowerShell 7 | [설치 안내·다운로드](https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows) | x64 MSI. 아래 명령은 **PowerShell 7**에서 실행 |
| Node.js 24 | [Node 24 설치 파일 목록](https://nodejs.org/dist/latest-v24.x/) | `node-v24.…-x64.msi`. 앱 소스 개발용. 최신 다른 메이저 버전 대신 24.x 사용 |
| Temurin JDK 21 | [JDK 21 / Windows / x64](https://adoptium.net/temurin/releases/?version=21&os=windows&arch=x64&package=jdk) | **JDK**, x64 MSI. 설치 시 PATH 추가와 `JAVA_HOME` 설정 선택 |
| Android Studio | [공식 다운로드](https://developer.android.com/studio) | 설치 후 SDK·에뮬레이터·가상 기기까지 준비 |
| Microsoft Visual C++ x64 런타임 | [설치 파일](https://aka.ms/vs/17/release/vc_redist.x64.exe) · [공식 설명](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist) | 설치 또는 기존 설치 복구. PostgreSQL 등 네이티브 도구 실행에 필요 |

Git과 PowerShell은 아래 설치 명령으로도 준비할 수 있다. `winget`이 없다면 위 설치 파일을 사용한다.

```powershell
winget install --id Git.Git --exact --source winget
winget install --id Microsoft.PowerShell --exact --source winget
```

설치 확인:

```powershell
git --version
node --version
npm --version
java -version
javac -version
$PSVersionTable.PSVersion
$env:JAVA_HOME
```

Node는 24.x, Java·javac는 21, PowerShell은 7.x여야 한다. `JAVA_HOME`은 `bin`이 아니라 JDK 설치 폴더를 가리켜야 한다. JRE만 있으면 앱을 다시 빌드할 수 없다. [JDK 설치 옵션 설명](https://adoptium.net/installation/windows/)

**별도 설치가 필요하지 않은 것:** Maven·Gradle은 프로젝트 Wrapper가 받는다. PostgreSQL 17은 첫 `실행.bat` 실행 때 프로젝트 폴더에 준비한다. 기본 Live 음성 실행에는 Python·Whisper 모델·유료 아바타 계정이 필요하지 않다.

## 2. 소스 받기

이후의 명령은 특별한 표시가 없으면 **PowerShell 7**에서 실행한다. 새 프로젝트 위치는 한글·공백이 없는 짧은 경로를 권장한다.

```powershell
New-Item -ItemType Directory -Path C:\dev -Force | Out-Null
Set-Location C:\dev
git clone https://github.com/sybd1/Ai-Live-Avatar-Android-App.git one_step_service
Set-Location C:\dev\one_step_service
```

공개 소스 저장소다. 폴더가 이미 있으면 위 명령을 반복하지 말고 해당 폴더를 연다.

## 3. 실행 파일 준비

이 저장소에는 APK와 서버 JAR가 포함되지 않는다. 아래 SDK 설정을 완료하고 6·7절에서 서버와 앱을 빌드한다. 앱을 실행하기 전에 `artifacts/`에 필요한 파일을 준비한다.

```text
one_step_service-server.jar
one_step_service-emulator.apk
one_step_service-phone.apk
```

휴대폰은 ARM64, 에뮬레이터는 x86_64로 빌드한다. 현재 Windows 자동 설치 도구 일부는 이전 릴리스 파일명도 확인하므로, 소스 개발 환경은 6·7절의 설정·빌드 명령을 우선 사용한다.

## 4. Android SDK와 가상 기기 준비

### 처음 설치하는 경우

Android Studio를 열고 설치 마법사를 완료한다. 시작 화면의 **More Actions → SDK Manager**, 또는 프로젝트 화면의 **Tools → SDK Manager**로 이동한다.

SDK 위치를 확인한다. 아래 명령은 기본 경로인 `%LOCALAPPDATA%\Android\Sdk`를 기준으로 한다. 위치가 다르면 해당 경로로 바꾼다.

**SDK Tools**에서 다음 항목을 설치한다.

- Android SDK Platform-Tools
- Android Emulator
- Android SDK Command-line Tools (latest)

**실행할 가상 기기**는 Device Manager에서 생성한다.

1. **Device Manager → Create Device**에서 Pixel 계열 휴대폰을 고른다.
2. **API 36 / Google APIs / x86_64** 시스템 이미지를 다운로드하고 선택한다.
3. 생성을 마치고 ▶ 버튼을 눌러 Android 홈 화면이 나올 때까지 기다린다.

이미 호환되는 64비트 가상 기기가 있다면 새로 만들지 않고 사용한다. 아래 기본 경로 설정 후 기기가 보이는지 확인한다.

```powershell
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
```

목록에 `emulator-5554 device` 같은 **에뮬레이터 항목**이 있어야 한다. 번호는 달라도 된다. 오프라인이거나 부팅 중이면 홈 화면이 나올 때까지 기다린다.

가상화 오류가 나면 [Android 공식 가속 설정 안내](https://developer.android.com/studio/run/emulator-acceleration)를 확인한다. Windows의 작업 관리자 → 성능 → CPU에서 가상화 상태를 확인하고, 필요한 경우 Windows 하이퍼바이저 플랫폼을 활성화·재부팅한다.

공식 설명: [SDK Manager](https://developer.android.com/studio/intro/update#sdk-manager) · [가상 기기 만들기](https://developer.android.com/studio/run/managing-avds)

## 5. 앱 실행

별도로 준비한 설정 파일이 프로젝트 루트에 있는 상태에서 실행한다.

```powershell
Set-Location C:\dev\one_step_service
.\실행.bat
```

누락된 서버 도구를 준비할 때 다운로드 동의를 묻는다. 완료되면 DB → 서버 → 선택한 에뮬레이터 → APK 설치 → 앱 실행 순으로 진행한다. 앱 주소는 **`http://127.0.0.1:8080`**을 사용한다. PC 서버를 유지한다.

확인할 장면은 **공고 목록 → ‘따뜻한 집’ 상세 → 연습 시작 → 잠깐 쉬기 → 종료 → 개인 기록**이다. 마이크는 가상 인물의 대사로 시험한다. 에뮬레이터 마이크가 꺼져 있으면 Extended Controls의 Microphone에서 호스트 마이크 입력을 활성화하고, Windows와 앱의 마이크 권한도 허용한다.

이 단계까지는 릴리스에 들어 있던 앱을 실행한 것이다. **소스코드를 수정한 내용은 아래 빌드를 해야 앱에 반영된다.**

## 6. 코드를 수정·빌드할 때 추가 준비

### Android 빌드 도구

현재 lockfile의 React Native/Expo 구성을 기준으로 다음 버전이 필요하다. **가상 기기 API 36과 앱 컴파일용 SDK 37.0은 용도가 다르므로 둘 다 사용할 수 있다.**

| 항목 | 버전 |
| --- | --- |
| Android SDK Platform | `platforms;android-37.0` |
| Android SDK Build-Tools | `37.0.0` |
| NDK (Side by side) | `27.1.12297006` |
| CMake | `3.22.1` |

Android Studio SDK Manager에서 **Show Package Details**를 켜고 설치하거나, 아래 명령을 실행한다. `--licenses`에서는 약관을 읽고 직접 수락한다.

```powershell
$firstStepSdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_HOME = $firstStepSdkPath
$env:ANDROID_SDK_ROOT = $firstStepSdkPath
$sdkManager = Join-Path $firstStepSdkPath 'cmdline-tools\latest\bin\sdkmanager.bat'
if (!(Test-Path -LiteralPath $sdkManager)) { throw 'SDK Manager에서 Command-line Tools (latest)를 먼저 설치해 주세요.' }
& $sdkManager --licenses
& $sdkManager 'platforms;android-37.0' 'build-tools;37.0.0' 'ndk;27.1.12297006' 'cmake;3.22.1'
if ($LASTEXITCODE -ne 0) { throw 'SDK 설치 오류를 확인한 뒤 다음 단계로 진행해 주세요.' }
```

`sdkmanager` 사용법은 [Android 공식 문서](https://developer.android.com/tools/sdkmanager)를 따른다. 지정된 패키지를 찾지 못하면 임의의 다른 버전으로 바꾸지 말고 SDK 목록·프로젝트 버전을 확인한다.

### 기존 SDK를 프로젝트 빌드 경로에 연결

현재 `build-apk.ps1`은 `.tools\android-sdk`를 사용한다. 기존 SDK를 다시 복사하지 않고 연결한다. 기존 폴더가 있으면 삭제하거나 덮어쓰지 않는다.

```powershell
Set-Location C:\dev\one_step_service
New-Item -ItemType Directory -Path .tools -Force | Out-Null
if (!(Test-Path -LiteralPath '.tools\android-sdk')) {
    New-Item -ItemType Junction -Path '.tools\android-sdk' -Target $firstStepSdkPath | Out-Null
}
Test-Path '.tools\android-sdk\platform-tools\adb.exe'
Test-Path '.tools\android-sdk\platforms\android-37.0'
```

두 확인 결과가 `True`여야 한다. SDK를 다른 위치에 설치했다면 `$firstStepSdkPath`부터 실제 위치로 바꾼다.

## 7. 소스 빌드와 다시 실행

### 서버

먼저 실행 중인 프로젝트 서버를 멈춘다. DB는 유지한다.

```powershell
Set-Location C:\dev\one_step_service
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-services.ps1

. .\scripts\env.ps1
if (!(Test-Path (Join-Path $env:JAVA_HOME 'bin\javac.exe'))) {
    throw '현재 선택된 Java는 JRE입니다. JDK 21 경로와 프로젝트의 로컬 Java 선택을 확인해 주세요.'
}
Push-Location server
try {
    .\mvnw.cmd -DskipTests package
    if ($LASTEXITCODE -ne 0) { throw '서버 빌드 실패' }
} finally { Pop-Location }
Copy-Item .\server\target\one_step_service-0.0.1-SNAPSHOT.jar .\artifacts\one_step_service-server.jar -Force
```

처음에는 Maven·의존성을 다운로드한다. 위 명령은 실행 파일 생성용이며 테스트는 생략한다. 별도 서버 검사는 `server` 폴더에서 `mvnw.cmd test`를 사용한다.

### Android 앱

```powershell
Set-Location C:\dev\one_step_service\mobile
npm ci
if ($LASTEXITCODE -ne 0) { throw '앱 의존성 설치 실패' }
npm run avatar:build
if ($LASTEXITCODE -ne 0) { throw '아바타 준비 실패' }
npx expo prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'Android 프로젝트 생성 실패' }
Set-Location ..

pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-apk.ps1 -Architectures x86_64 -ApiBaseUrl http://127.0.0.1:8080
if ($LASTEXITCODE -ne 0) { throw 'APK 빌드 실패' }
Copy-Item .\mobile\android\app\build\outputs\apk\release\app-release.apk .\artifacts\one_step_service-emulator.apk -Force
.\실행.bat
```

`npm ci`는 lockfile에 맞춰 설치한다. 아바타 스크립트는 모델을 받고 해시를 검사한다. `prebuild`는 clone에 없는 `mobile/android`를 만든다. 앱 설정·네이티브 모듈 변경이 없다면 매번 `prebuild`를 반복할 필요는 없다. `--clean`은 로컬 네이티브 변경을 지울 수 있으므로 이 안내에서는 사용하지 않는다. [Expo 설명](https://docs.expo.dev/workflow/continuous-native-generation/)

첫 빌드는 Gradle·SDK·네이티브 의존성 다운로드로 오래 걸릴 수 있다. 이후 앱 수정은 **APK 빌드 → emulator APK 복사 → 실행.bat**, 서버 수정은 **서버 종료 → Maven 빌드 → 실행.bat** 순서다. 자동으로 소스가 반영되는 구성은 아니다.

## 막힐 때 확인할 것

| 메시지·증상 | 확인할 곳 |
| --- | --- |
| 실행 파일 없음 | 3번의 JAR·APK 세 파일을 clone 폴더의 `artifacts`에 복사했는지 확인 |
| `node`·`javac`·`pwsh`를 찾지 못함 | 설치 후 터미널을 다시 열고 PATH·JDK 21·JAVA_HOME 확인 |
| Java는 있는데 빌드가 안 됨 | 실행용 JRE와 개발용 JDK가 다름. `env.ps1`이 선택한 JAVA_HOME 아래에 `javac.exe`가 있는지 확인 |
| SDK 위치·CMake·NDK 오류 | 6번의 SDK 버전과 `.tools/android-sdk` 연결 확인 |
| `.env`를 찾지 못함 | 별도 준비한 설정 파일을 프로젝트 루트에 두었는지 확인. 값은 이 문서에서 다루지 않음 |
| 에뮬레이터가 안 뜸 | Device Manager에서 먼저 부팅. 가상화·WHPX와 `adb devices` 확인 |
| 앱은 뜨는데 서버 연결이 안 됨 | 서버 준비 완료 메시지, 8080 포트 충돌, 앱 주소 확인. `실행.bat`이 해당 에뮬레이터의 연결을 설정함 |
| 인증서 오류 | Windows 신뢰 인증서·네트워크 정책 확인. TLS 검증을 끄는 명령은 사용하지 않음 |
| APK 서명 충돌 | 기존 앱을 자동 삭제하지 않음. 같은 서명으로 빌드하거나 별도의 테스트용 가상 기기 사용 |

`.tools`·`node_modules`·기존 DB 폴더 전체를 다른 PC에서 복사하지 않는다. 새 PC의 도구와 DB를 준비하고 공개 공고를 초기 등록하는 경로를 사용한다.

## 확인한 범위

문서 작성일: 2026.10.26. 실제 GitHub 소스의 실행 파일명·스크립트, 현재 설치된 SDK 패키지, 공식 설치 문서를 대조했다. 기존 Windows 격리 설치·에뮬레이터 실행 검사 결과는 저장소의 검증 문서를 참고한다. **이 안내를 따라 다른 실물 노트북에서 전체 설치·빌드를 재실행한 결과는 아직 없다.**
