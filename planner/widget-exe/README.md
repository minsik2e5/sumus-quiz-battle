# SUMUS 오늘 위젯 (Windows EXE)

C# 5 / .NET Framework 4.8 / WebView2 단일 EXE. `/widget` 페이지를 띄우고, 캐릭터 "수무"가 수업 10분 전·딴짓·쉬는 시간을 알려 줍니다.

- 빌드: `wv2.zip`(Microsoft.Web.WebView2 1.0.2903.40 NuGet)을 `sdk/`에 풀고 `build.ps1` 실행 → `out/SUMUS_Widget.exe`
- 배포: EXE를 zip으로 묶어 `planner/public/SUMUS_Widget_Installer.zip` 교체
- 캐릭터 그림: `mascot-draw.js`(puppeteer)로 `mascot/*.png` 생성
