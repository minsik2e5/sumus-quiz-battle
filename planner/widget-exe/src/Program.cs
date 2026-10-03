// SUMUS 오늘 위젯 — 단일 EXE (C# 5 / .NET Framework 4.8 / WebView2)
// 사용자는 EXE를 더블클릭만 하면 됩니다:
//   1) %LOCALAPPDATA%\SUMUSWidget 에 자기 자신을 복사하고 바탕화면·시작 메뉴 바로가기, 자동 실행, 앱 제거 항목을 등록
//   2) 예전 브라우저(Edge) 방식 위젯의 시작 프로그램 바로가기를 정리
//   3) 위젯 창을 띄움 (항상 위, 위치·크기 기억, 트레이 메뉴, 오프라인 자동 재시도)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("SUMUS 오늘 위젯")]
[assembly: AssemblyDescription("SUMUS 오늘 위젯")]
[assembly: AssemblyProduct("SUMUS Widget")]
[assembly: AssemblyCompany("SUMUS")]
[assembly: AssemblyCopyright("SUMUS")]
[assembly: AssemblyVersion("3.1.0.0")]
[assembly: AssemblyFileVersion("3.1.0.0")]

namespace SumusWidget
{
    static class App
    {
        public const string Version = "3.1.0";
        public const string DefaultUrl = "https://sumus-planner.minsik2e5.workers.dev/widget";
        public const string PlannerUrl = "https://sumus-planner.minsik2e5.workers.dev/";
        public const string AppName = "SUMUS 오늘 위젯";
        public const string ExeName = "SUMUS_Widget.exe";
        const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
        const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\SUMUSWidget";
        const string RunName = "SUMUSWidget";

        public static string Dir;
        public static string Url = DefaultUrl;
        public static bool Portable;      // --no-install : 설치 없이 그 자리에서 실행 (테스트용)
        public static bool AutoStart;     // --autostart : Windows 시작 시 실행됨
        static string[] Args;

        public static string InstalledExe { get { return Path.Combine(Dir, ExeName); } }
        public static string BinDir { get { return Path.Combine(Dir, "bin-" + Version); } }
        public static string DataDir { get { return Path.Combine(Dir, "WebView2"); } }
        public static string SettingsPath { get { return Path.Combine(Dir, "settings.txt"); } }
        public static string LogPath { get { return Path.Combine(Dir, "widget.log"); } }
        static string InstanceKey { get { return "SUMUSWidget." + ((uint)Dir.ToLowerInvariant().GetHashCode()).ToString("x8"); } }
        public static string ShowEventName { get { return @"Local\" + InstanceKey + ".Show"; } }
        public static string QuitEventName { get { return @"Local\" + InstanceKey + ".Quit"; } }

        static string Arg(string name)
        {
            foreach (string a in Args)
                if (a.StartsWith(name + "=", StringComparison.OrdinalIgnoreCase)) return a.Substring(name.Length + 1);
            return null;
        }
        static bool Has(string name)
        {
            foreach (string a in Args) if (string.Equals(a, name, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        [STAThread]
        static int Main(string[] args)
        {
            Args = args;
            Dir = Arg("--data") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SUMUSWidget");
            Url = Arg("--url") ?? DefaultUrl;
            Portable = Has("--no-install");
            AutoStart = Has("--autostart");
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            if (Arg("--mascot-shot") != null)
            {
                // 테스트용: 캐릭터 말풍선 그림을 PNG로 저장하고 끝냄
                using (MascotForm f = new MascotForm())
                {
                    string[,] shots = { { "nag", "딴짓 20분째… 이제 할 일 하러 가요!" }, { "bell", "10분 뒤 고1A 수업이에요! 준비물 챙겨요" }, { "rest", "1시간 열심히 했어요! 물 한 잔 마시고 기지개 쭉~" }, { "cheer", "오늘도 화이팅! 수무가 옆에서 지켜볼게요" } };
                    for (int i = 0; i < shots.GetLength(0); i++)
                    {
                        f.SetForShot(shots[i, 0], shots[i, 1]);
                        using (Bitmap b = f.Render(0.2f)) b.Save(Path.Combine(Arg("--mascot-shot"), shots[i, 0] + "-shot.png"));
                    }
                }
                return 0;
            }
            try
            {
                Directory.CreateDirectory(Dir);
                if (Has("--uninstall")) { Uninstall(Has("--quiet")); return 0; }

                string self = Assembly.GetExecutingAssembly().Location;
                if (!Portable && !SamePath(self, InstalledExe))
                {
                    // 이미 더 새 버전이 설치돼 있으면 덮어쓰지 않고 설치본을 실행 (예전 EXE를 실수로 다시 실행한 경우)
                    if (!IsInstalledNewer(self)) Install(self);
                    else Log("더 새 버전이 이미 설치돼 있어 설치 생략: " + self);
                    // 테스트용 옵션(--data, --url)은 설치본에도 그대로 넘김 (안 넘기면 실제 설치 폴더로 다시 설치됨)
                    string pass = "";
                    if (Arg("--data") != null) pass += " \"--data=" + Arg("--data") + "\"";
                    if (Arg("--url") != null) pass += " \"--url=" + Arg("--url") + "\"";
                    Process.Start(new ProcessStartInfo(InstalledExe, pass.Trim()) { UseShellExecute = false, WorkingDirectory = Dir });
                    return 0;
                }

                bool created;
                using (Mutex m = new Mutex(true, @"Local\" + InstanceKey, out created))
                {
                    if (!created)
                    {
                        // 이미 실행 중이면 그 창을 앞으로
                        EventWaitHandle show;
                        if (EventWaitHandle.TryOpenExisting(ShowEventName, out show)) { show.Set(); show.Dispose(); }
                        return 0;
                    }
                    PrepareBinaries();
                    AppDomain.CurrentDomain.AssemblyResolve += ResolveWebView2;
                    return RunWidget();
                }
            }
            catch (Exception ex)
            {
                Log("오류: " + ex);
                MessageBox.Show("SUMUS 위젯을 시작하지 못했어요.\r\n\r\n" + ex.Message + "\r\n\r\n오류 기록: " + LogPath,
                    AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        static int RunWidget()
        {
            // WebView2 런타임 확인 (Windows 11 기본 포함, Windows 10 대부분 포함)
            try { CoreWebView2Environment.SetLoaderDllFolderPath(BinDir); CoreWebView2Environment.GetAvailableBrowserVersionString(); }
            catch (Exception ex)
            {
                Log("WebView2 런타임 없음: " + ex.Message);
                if (MessageBox.Show("위젯을 표시하는 데 필요한 Microsoft Edge WebView2 런타임이 없어요.\r\n\r\n[확인]을 누르면 Microsoft 공식 설치 페이지를 열게요. 설치 후 위젯을 다시 실행해 주세요.",
                        AppName, MessageBoxButtons.OKCancel, MessageBoxIcon.Information) == DialogResult.OK)
                    OpenInBrowser("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
                return 2;
            }
            Application.Run(new WidgetHost());
            return 0;
        }

        // ---------------------------------------------------------------- WebView2 DLL (EXE 안에 포함)
        static void PrepareBinaries()
        {
            Directory.CreateDirectory(BinDir);
            string arch = IntPtr.Size == 4 ? "x86"
                : (string.Equals(Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE"), "ARM64", StringComparison.OrdinalIgnoreCase) ? "arm64" : "x64");
            Extract("Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.Core.dll");
            Extract("Microsoft.Web.WebView2.WinForms.dll", "Microsoft.Web.WebView2.WinForms.dll");
            Extract("WebView2Loader." + arch + ".dll", "WebView2Loader.dll");
        }
        static void Extract(string resource, string fileName)
        {
            string path = Path.Combine(BinDir, fileName);
            using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
            {
                if (s == null) throw new InvalidOperationException("포함 파일 누락: " + resource);
                if (File.Exists(path) && new FileInfo(path).Length == s.Length) return;
                using (FileStream f = File.Create(path)) s.CopyTo(f);
            }
        }
        static Assembly ResolveWebView2(object sender, ResolveEventArgs e)
        {
            string name = new AssemblyName(e.Name).Name;
            string path = Path.Combine(BinDir, name + ".dll");
            return name.StartsWith("Microsoft.Web.WebView2", StringComparison.Ordinal) && File.Exists(path) ? Assembly.LoadFrom(path) : null;
        }

        // ---------------------------------------------------------------- 설치 / 제거
        static bool IsInstalledNewer(string self)
        {
            try
            {
                if (!File.Exists(InstalledExe)) return false;
                Version installed = new Version(FileVersionInfo.GetVersionInfo(InstalledExe).FileVersion);
                Version mine = new Version(FileVersionInfo.GetVersionInfo(self).FileVersion);
                return installed > mine;
            }
            catch { return false; }
        }

        static void Install(string self)
        {
            Log("설치 시작 v" + Version + " from " + self);
            // 이미 실행 중인 설치본이 있으면 종료시킨 뒤 교체 (업데이트)
            EventWaitHandle quit;
            if (EventWaitHandle.TryOpenExisting(QuitEventName, out quit)) { quit.Set(); quit.Dispose(); }
            for (int i = 0; i < 30; i++)
            {
                try { File.Copy(self, InstalledExe, true); break; }
                catch (IOException) { if (i == 29) throw; Thread.Sleep(200); }
            }
            DeleteFileW(InstalledExe + ":Zone.Identifier"); // 다운로드 표시 제거 (두 번째 보안 경고 방지)

            // --data(테스트 폴더) 설치는 바로가기·자동 실행·앱 목록 같은 시스템 전체 등록을 건드리지 않음
            if (Arg("--data") != null) { Log("테스트 폴더 설치: 시스템 등록 생략"); return; }

            // 예전 브라우저 방식 위젯 정리 (Edge 창이 같이 자동 실행되지 않도록)
            TryDelete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "SUMUS 오늘 위젯.lnk"));
            TryDelete(Path.Combine(Dir, "RUN_WIDGET.cmd"));
            TryDelete(Path.Combine(Dir, "uninstall.ps1"));
            TryDelete(Path.Combine(Dir, "install.log"));
            string oldMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "SUMUS");
            TryDelete(Path.Combine(oldMenu, "SUMUS 오늘 위젯.lnk"));
            TryDelete(Path.Combine(oldMenu, "SUMUS 위젯 제거.lnk"));
            try { if (Directory.Exists(oldMenu) && Directory.GetFileSystemEntries(oldMenu).Length == 0) Directory.Delete(oldMenu); } catch { }

            CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "SUMUS 오늘 위젯.lnk"), "");
            CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "SUMUS 오늘 위젯.lnk"), "");
            SetAutoStart(true);
            using (RegistryKey k = Registry.CurrentUser.CreateSubKey(UninstallKey))
            {
                k.SetValue("DisplayName", AppName);
                k.SetValue("DisplayVersion", Version);
                k.SetValue("Publisher", "SUMUS");
                k.SetValue("DisplayIcon", InstalledExe + ",0");
                k.SetValue("InstallLocation", Dir);
                k.SetValue("UninstallString", "\"" + InstalledExe + "\" --uninstall");
                k.SetValue("QuietUninstallString", "\"" + InstalledExe + "\" --uninstall --quiet");
                k.SetValue("NoModify", 1, RegistryValueKind.DWord);
                k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                k.SetValue("EstimatedSize", (int)(new FileInfo(InstalledExe).Length / 1024), RegistryValueKind.DWord);
            }
            Log("설치 완료");
        }

        public static void Uninstall(bool quiet)
        {
            if (!quiet && MessageBox.Show("SUMUS 오늘 위젯을 이 컴퓨터에서 제거할까요?\r\n\r\n플래너에 저장된 일정·체크 기록은 서버에 그대로 남아요.",
                    AppName, MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            if (Application.OpenForms.Count == 0)
            {
                // 다른 프로세스(앱 및 기능, 시작 메뉴)에서 제거: 실행 중인 위젯에 종료 신호
                EventWaitHandle quit;
                if (EventWaitHandle.TryOpenExisting(QuitEventName, out quit)) { quit.Set(); quit.Dispose(); }
            }
            SetAutoStart(false);
            TryDelete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "SUMUS 오늘 위젯.lnk"));
            TryDelete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "SUMUS 오늘 위젯.lnk"));
            TryDelete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "SUMUS 오늘 위젯.lnk"));
            try { Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false); } catch { }
            if (!quiet) MessageBox.Show("SUMUS 오늘 위젯을 제거했어요.", AppName, MessageBoxButtons.OK, MessageBoxIcon.Information);
            // 실행 중인 EXE와 WebView2가 끝난 뒤 설치 폴더 삭제. 작업 폴더를 TEMP로 둬야 폴더가 잠기지 않음.
            ProcessStartInfo psi = new ProcessStartInfo("cmd.exe",
                "/c ping 127.0.0.1 -n 6 >nul & rmdir /s /q \"" + Dir + "\"");
            psi.WorkingDirectory = Path.GetTempPath();
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            Process.Start(psi);
            // 트레이 메뉴에서 제거한 경우 이 창도 곧바로 종료
            if (Application.OpenForms.Count > 0) Application.OpenForms[0].BeginInvoke(new MethodInvoker(Application.OpenForms[0].Close));
        }

        public static bool IsAutoStart()
        {
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RunKey))
                return k != null && k.GetValue(RunName) != null;
        }
        public static void SetAutoStart(bool on)
        {
            using (RegistryKey k = Registry.CurrentUser.CreateSubKey(RunKey))
            {
                if (on) k.SetValue(RunName, "\"" + InstalledExe + "\" --autostart");
                else if (k.GetValue(RunName) != null) k.DeleteValue(RunName);
            }
        }

        static void CreateShortcut(string lnk, string args)
        {
            Type t = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(t);
            try
            {
                object sc = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
                Type st = sc.GetType();
                st.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { InstalledExe });
                st.InvokeMember("Arguments", BindingFlags.SetProperty, null, sc, new object[] { args });
                st.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, sc, new object[] { Dir });
                st.InvokeMember("IconLocation", BindingFlags.SetProperty, null, sc, new object[] { InstalledExe + ",0" });
                st.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { AppName });
                st.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
                Marshal.FinalReleaseComObject(sc);
            }
            finally { Marshal.FinalReleaseComObject(shell); }
        }

        // ---------------------------------------------------------------- 유틸
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern bool DeleteFileW(string path);
        static void TryDelete(string path) { try { if (File.Exists(path)) { File.Delete(path); Log("삭제: " + path); } } catch (Exception ex) { Log("삭제 실패: " + path + " / " + ex.Message); } }
        static bool SamePath(string a, string b)
        {
            return string.Equals(Path.GetFullPath(a).TrimEnd('\\'), Path.GetFullPath(b).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
        }
        public static void OpenInBrowser(string url)
        {
            try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch (Exception ex) { Log("브라우저 열기 실패: " + ex.Message); }
        }
        public static void Log(string message)
        {
            try
            {
                Directory.CreateDirectory(Dir);
                File.AppendAllText(LogPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + message + "\r\n", Encoding.UTF8);
            }
            catch { }
        }
    }

}
