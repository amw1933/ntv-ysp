# Android TV client

This is an optional native client for the nTv YSP gateway. The recommended
deployment is still a television IPTV player pointed at `/all.m3u`.

The client uses IJKPlayer for HEVC/H.264 compatibility and the same gateway HTTP
contract as the browser client.

## Build

```powershell
$env:JAVA_HOME = 'D:\tools\jdk-17\jdk-17.0.20.1+1'
.\gradlew.bat assembleDebug -PgatewayUrl=http://192.168.1.2:8768
```

Output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

On the television, press Menu to change the gateway address. The channel list
collapses automatically four seconds after switching channels. Press Left to
show it again.
