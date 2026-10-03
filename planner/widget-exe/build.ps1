$ErrorActionPreference = "Stop"
$w = $PSScriptRoot; $sdk = "$w\sdk"
New-Item -ItemType Directory -Force "$w\out" | Out-Null
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /platform:anycpu /optimize+ /codepage:65001 /utf8output `
  /out:"$w\out\SUMUS_Widget.exe" /win32icon:"$w\sumus.ico" /win32manifest:"$w\src\app.manifest" `
  /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll `
  /r:"$sdk\lib\net462\Microsoft.Web.WebView2.Core.dll" /r:"$sdk\lib\net462\Microsoft.Web.WebView2.WinForms.dll" `
  /resource:"$sdk\lib\net462\Microsoft.Web.WebView2.Core.dll",Microsoft.Web.WebView2.Core.dll `
  /resource:"$sdk\lib\net462\Microsoft.Web.WebView2.WinForms.dll",Microsoft.Web.WebView2.WinForms.dll `
  /resource:"$sdk\runtimes\win-x64\native\WebView2Loader.dll",WebView2Loader.x64.dll `
  /resource:"$sdk\runtimes\win-x86\native\WebView2Loader.dll",WebView2Loader.x86.dll `
  /resource:"$sdk\runtimes\win-arm64\native\WebView2Loader.dll",WebView2Loader.arm64.dll `
  /resource:"$w\mascot\idle.png",mascot.idle.png `
  /resource:"$w\mascot\blink.png",mascot.blink.png `
  /resource:"$w\mascot\nag.png",mascot.nag.png `
  /resource:"$w\mascot\bell.png",mascot.bell.png `
  /resource:"$w\mascot\rest.png",mascot.rest.png `
  /resource:"$w\mascot\cheer.png",mascot.cheer.png `
  "$w\src\Program.cs" "$w\src\Mascot.cs" "$w\src\Widgets.cs"
if ($LASTEXITCODE -ne 0) { throw "csc failed: $LASTEXITCODE" }
"{0:N0} bytes" -f (Get-Item "$w\out\SUMUS_Widget.exe").Length
