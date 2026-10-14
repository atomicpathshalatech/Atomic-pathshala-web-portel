@echo off
rem Builds the Play Store bundle: android\app\build\outputs\bundle\release\app-release.aab
rem
rem Capacitor 8 needs Java 21. Java 17 fails ("invalid source release: 21") and
rem this Gradle cannot run on Java 25 ("Unsupported class file major version 69"),
rem so this looks for a Java 21 first (Android Studio downloads them to %USERPROFILE%\.jdks).
rem Needs android\keystore.properties (the Play upload key) - see ANDROID_SETUP.md.

setlocal
set "JAVA_HOME="
for /d %%J in ("%USERPROFILE%\.jdks\*21*") do if exist "%%J\bin\java.exe" set "JAVA_HOME=%%J"
for /d %%J in ("%ProgramFiles%\Eclipse Adoptium\jdk-21*") do if exist "%%J\bin\java.exe" set "JAVA_HOME=%%J"
for /d %%J in ("%ProgramFiles%\Microsoft\jdk-21*") do if exist "%%J\bin\java.exe" set "JAVA_HOME=%%J"
if not defined JAVA_HOME (
  echo Java 21 not found. Install JDK 21: Android Studio - Settings - Build Tools - Gradle - Gradle JDK - Download JDK, version 21.
  exit /b 1
)
echo Using Java: %JAVA_HOME%

if not exist "%~dp0local.properties" (
  if exist "%LOCALAPPDATA%\Android\Sdk" (
    > "%~dp0local.properties" echo sdk.dir=%LOCALAPPDATA:\=/%/Android/Sdk
  )
)

pushd "%~dp0.."
call npx cap sync android || goto :fail
popd

pushd "%~dp0"
call "%~dp0gradlew.bat" -p "%~dp0." bundleRelease %* || goto :fail
popd
echo.
echo Done: android\app\build\outputs\bundle\release\app-release.aab
exit /b 0

:fail
echo.
echo Build failed - see the messages above.
exit /b 1
