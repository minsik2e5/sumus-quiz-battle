// SUMUS 위젯 v3 — 바탕화면 위젯 여러 개. 위젯마다 작은 창 하나 (WebView2), 트레이 메뉴에서 추가·빼기.
//   · 창은 테두리 없이 바탕화면에 붙어 있음 (다른 창 뒤 맨 아래). 평소엔 다른 창에 가려지고 바탕화면에서 보임.
//   · 머리 부분을 끌어 옮기고, 가장자리를 끌어 크기를 바꿈. 위치·크기는 위젯마다 기억.
// C# 5 (.NET Framework 4.8 csc) 문법만 씁니다.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SumusWidget
{
    // id = 종류 또는 종류#번호.  all(전체 카드) classes(오늘 수업) work(출퇴근·생활) quick(일정 메모) checklist notes clock
    class Kinds
    {
        public static readonly string[][] All = {
            new[] { "all", "오늘 전체 카드", "430", "820" },
            new[] { "classes", "오늘 수업", "320", "270" },
            new[] { "checklist", "오늘 체크리스트", "340", "460" },
            new[] { "notes", "메모장", "360", "420" },
            new[] { "work", "출퇴근 · 생활", "340", "170" },
            new[] { "quick", "일정 메모", "320", "130" },
            new[] { "clock", "시계", "250", "170" }
        };
        public static string Of(string id) { int i = id.IndexOf('#'); return i < 0 ? id : id.Substring(0, i); }
        public static string[] Info(string id) { string k = Of(id); foreach (string[] a in All) if (a[0] == k) return a; return null; }
    }

    class WidgetWindow : Form
    {
        const int WM_NCHITTEST = 0x84, WM_WINDOWPOSCHANGING = 0x46, GRIP = 8;
        const uint SWP_NOSIZE = 1, SWP_NOMOVE = 2, SWP_NOZORDER = 4, SWP_NOACTIVATE = 0x10;
        static readonly IntPtr HWND_BOTTOM = new IntPtr(1), HWND_TOP = IntPtr.Zero;
        [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hWnd, uint cmd);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
        [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
        delegate bool EnumProc(IntPtr h, IntPtr l);
        // 바탕화면 아이콘을 그리는 창 (Progman 또는 WorkerW). 위젯은 이 창 바로 위, 다른 모든 창 아래에 놓음.
        static IntPtr DesktopHost()
        {
            IntPtr found = IntPtr.Zero;
            EnumWindows(delegate(IntPtr h, IntPtr l) { if (FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero) { found = h; return false; } return true; }, IntPtr.Zero);
            return found;
        }
        // 놓을 자리: 바탕화면 창 바로 위. 이미 거기 있으면 Zero.
        IntPtr RestingPlace()
        {
            IntPtr host = DesktopHost();
            if (host == IntPtr.Zero) return HWND_BOTTOM;
            IntPtr prev = GetWindow(host, 3 /*GW_HWNDPREV*/);
            if (prev == IntPtr.Zero) return HWND_TOP;
            return prev == Handle ? IntPtr.Zero : prev;
        }
        [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
        [StructLayout(LayoutKind.Sequential)] struct WINDOWPOS { public IntPtr hwnd, hwndInsertAfter; public int x, y, cx, cy; public uint flags; }

        readonly WidgetHost host;
        public readonly string Id;
        readonly WebView2 web = new WebView2();
        readonly System.Windows.Forms.Timer retryTimer = new System.Windows.Forms.Timer();
        readonly System.Windows.Forms.Timer saveTimer = new System.Windows.Forms.Timer();
        bool offline, pageReported;
        public bool AllowFront;     // 잠깐 앞으로 보기 / 항상 위

        public WidgetWindow(WidgetHost host, string id)
        {
            this.host = host; Id = id;
            string[] info = Kinds.Info(id);
            Text = "SUMUS " + (info != null ? info[1] : id);
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.FromArgb(244, 247, 251);
            AutoScaleMode = AutoScaleMode.None;
            Padding = new Padding(4);
            MinimumSize = host.Scale(new Size(200, 110));
            web.Dock = DockStyle.Fill;
            web.DefaultBackgroundColor = BackColor;
            Controls.Add(web);
            Bounds = host.BoundsFor(id, info);
            retryTimer.Interval = 15000;
            retryTimer.Tick += delegate { if (offline) Reload(); };
            saveTimer.Interval = 700;
            saveTimer.Tick += delegate { saveTimer.Stop(); host.SaveBounds(Id, Bounds); };
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= 0x80 /*TOOLWINDOW: 작업 표시줄·Alt+Tab에 안 보임*/;
                cp.ClassStyle |= 0x20000 /*그림자*/;
                return cp;
            }
        }
        protected override bool ShowWithoutActivation { get { return true; } }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            int round = 2; // Windows 11 둥근 모서리
            try { DwmSetWindowAttribute(Handle, 33, ref round, 4); } catch { }
        }
        protected override void OnShown(EventArgs e) { base.OnShown(e); SendToBottom(); }
        protected override void OnMove(EventArgs e) { base.OnMove(e); if (IsHandleCreated && Visible) { saveTimer.Stop(); saveTimer.Start(); } }
        protected override void OnResizeEnd(EventArgs e) { base.OnResizeEnd(e); host.SaveBounds(Id, Bounds); }
        protected override void OnSizeChanged(EventArgs e) { base.OnSizeChanged(e); if (IsHandleCreated && Visible) { saveTimer.Stop(); saveTimer.Start(); } }

        public void SendToBottom() { AllowFront = false; if (!IsHandleCreated) return; IntPtr at = RestingPlace(); if (at != IntPtr.Zero) SetWindowPos(Handle, at, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE); }
        public void BringFront() { AllowFront = true; if (IsHandleCreated) SetWindowPos(Handle, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE); }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_NCHITTEST)
            {
                // 테두리 4px 띠에서 크기 조절 (웹 화면이 나머지를 덮고 있음)
                Point p = PointToClient(new Point((short)(m.LParam.ToInt32() & 0xFFFF), (short)((m.LParam.ToInt32() >> 16) & 0xFFFF)));
                int g = Math.Max(GRIP, host.Scale(new Size(GRIP, 0)).Width);
                bool l = p.X < g, r = p.X >= ClientSize.Width - g, t = p.Y < g, b = p.Y >= ClientSize.Height - g;
                if (t && l) { m.Result = (IntPtr)13; return; }
                if (t && r) { m.Result = (IntPtr)14; return; }
                if (b && l) { m.Result = (IntPtr)16; return; }
                if (b && r) { m.Result = (IntPtr)17; return; }
                if (l) { m.Result = (IntPtr)10; return; }
                if (r) { m.Result = (IntPtr)11; return; }
                if (t) { m.Result = (IntPtr)12; return; }
                if (b) { m.Result = (IntPtr)15; return; }
            }
            if (m.Msg == WM_WINDOWPOSCHANGING && !AllowFront)
            {
                // 클릭하거나 활성화돼도 다른 창 위로 올라오지 않음 (바탕화면에 붙어 있기)
                WINDOWPOS wp = (WINDOWPOS)Marshal.PtrToStructure(m.LParam, typeof(WINDOWPOS));
                if ((wp.flags & SWP_NOZORDER) == 0) { IntPtr at = RestingPlace(); if (at == IntPtr.Zero) wp.flags |= SWP_NOZORDER; else wp.hwndInsertAfter = at; Marshal.StructureToPtr(wp, m.LParam, false); }
            }
            base.WndProc(ref m);
        }

        protected override async void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            try
            {
                CoreWebView2Environment env = await host.GetEnv();
                await web.EnsureCoreWebView2Async(env);
                CoreWebView2Settings st = web.CoreWebView2.Settings;
                st.IsStatusBarEnabled = false; st.AreDevToolsEnabled = false; st.IsZoomControlEnabled = false;
                st.IsGeneralAutofillEnabled = false; st.IsPasswordAutosaveEnabled = false;
                try { st.IsNonClientRegionSupportEnabled = true; } catch (Exception ex) { App.Log("끌어 옮기기 지원 안 됨: " + ex.Message); }
                st.UserAgent = st.UserAgent + " SUMUSWidget/" + App.Version;
                web.CoreWebView2.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs a) { a.Handled = true; App.OpenInBrowser(a.Uri); };
                web.CoreWebView2.DownloadStarting += delegate(object s, CoreWebView2DownloadStartingEventArgs a) { a.Cancel = true; App.OpenInBrowser(a.DownloadOperation.Uri); };
                web.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
                web.CoreWebView2.WebMessageReceived += delegate(object s, CoreWebView2WebMessageReceivedEventArgs a)
                {
                    string msg = a.TryGetWebMessageAsString();
                    if (msg == "retry") Reload();
                    else if (msg == "close") host.RemoveWidget(Id);
                    else if (msg != null && msg.StartsWith("n:")) host.SetNote(Id, msg.Substring(2));
                };
                web.CoreWebView2.Navigate(host.UrlFor(Id));
            }
            catch (Exception ex)
            {
                App.Log("WebView2 초기화 실패 (" + Id + "): " + ex);
                if (!host.ErrorShown) { host.ErrorShown = true; MessageBox.Show("위젯 화면을 준비하지 못했어요.\r\n\r\n" + ex.Message, App.AppName, MessageBoxButtons.OK, MessageBoxIcon.Error); }
            }
        }

        void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            string src = web.CoreWebView2.Source ?? "";
            bool isSite = src.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || src.StartsWith("https://", StringComparison.OrdinalIgnoreCase);
            if (e.IsSuccess && !isSite) return;
            if (e.IsSuccess)
            {
                offline = false; retryTimer.Stop();
                if (!pageReported)
                {
                    pageReported = true;
                    System.Windows.Forms.Timer once = new System.Windows.Forms.Timer { Interval = 4000 };
                    once.Tick += delegate { once.Stop(); once.Dispose(); host.OnPageReady(); };
                    once.Start();
                }
                return;
            }
            if (e.WebErrorStatus == CoreWebView2WebErrorStatus.OperationCanceled) return;
            App.Log("페이지 로드 실패 (" + Id + "): " + e.WebErrorStatus);
            offline = true; retryTimer.Start();
            web.CoreWebView2.NavigateToString(OfflineHtml);
        }
        public void Reload() { if (web.CoreWebView2 != null) web.CoreWebView2.Navigate(host.UrlFor(Id)); }
        public async Task<string> Eval(string script)
        {
            if (web.CoreWebView2 == null || offline) return null;
            return await web.CoreWebView2.ExecuteScriptAsync(script);
        }

        const string OfflineHtml = "<!doctype html><html lang='ko'><meta charset='utf-8'><body style=\"margin:0;height:100vh;display:grid;place-items:center;background:#f4f7fb;font-family:'Malgun Gothic',sans-serif;color:#333d4b;-webkit-app-region:drag\">"
            + "<div style='text-align:center;padding:12px'><b style='font-size:14px'>인터넷 연결을 기다리는 중이에요</b><p style='color:#8b95a1;font-size:12px;margin:6px 0 12px'>연결되면 자동으로 다시 불러와요.</p>"
            + "<button onclick=\"chrome.webview.postMessage('retry')\" style='-webkit-app-region:no-drag;border:0;border-radius:10px;background:#3182f6;color:#fff;font-weight:700;padding:8px 14px;font-size:12px;cursor:pointer'>지금 다시 시도</button></div></body></html>";

        protected override void Dispose(bool disposing)
        {
            if (disposing) { retryTimer.Dispose(); saveTimer.Dispose(); }
            base.Dispose(disposing);
        }
    }

    class WidgetHost : ApplicationContext
    {
        readonly Dictionary<string, string> settings = new Dictionary<string, string>();
        readonly List<WidgetWindow> windows = new List<WidgetWindow>();
        readonly NotifyIcon tray = new NotifyIcon();
        readonly Control sync = new Control();
        readonly MascotForm mascot = new MascotForm();
        readonly MascotBrain brain;
        readonly ToolStripMenuItem miPin = new ToolStripMenuItem("위젯 항상 위에 표시");
        readonly ToolStripMenuItem miAuto = new ToolStripMenuItem("Windows 시작 시 자동 실행");
        readonly ToolStripMenuItem miMascot = new ToolStripMenuItem("캐릭터 알림 (수무)");
        readonly ToolStripMenuItem miAdd = new ToolStripMenuItem("위젯 추가");
        readonly ToolStripMenuItem miRemove = new ToolStripMenuItem("위젯 빼기");
        readonly System.Windows.Forms.Timer brainTimer = new System.Windows.Forms.Timer();
        readonly System.Windows.Forms.Timer scheduleTimer = new System.Windows.Forms.Timer();
        readonly System.Windows.Forms.Timer frontTimer = new System.Windows.Forms.Timer();
        readonly System.Windows.Forms.Timer seatTimer = new System.Windows.Forms.Timer();
        Task<CoreWebView2Environment> envTask;
        EventWaitHandle showEvent, quitEvent;
        RegisteredWaitHandle showWait, quitWait;
        bool pinned, greeted;
        public bool ErrorShown;
        int cascade;

        public WidgetHost()
        {
            LoadSettings();
            IntPtr h = sync.Handle; // BeginInvoke용
            pinned = Get("pinned", "0") == "1";
            brain = new MascotBrain(mascot);
            brain.Enabled = Get("mascot", "1") == "1";
            mascot.MenuPicked += delegate(string what)
            {
                if (what == "quiet1h") brain.QuietUntil = DateTime.Now.AddHours(1);
                else if (what == "today") brain.QuietUntil = DateTime.Today.AddDays(1);
                else if (what == "off") { brain.Enabled = false; SaveSettings(); }
            };

            // 트레이 메뉴
            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Items.Add("위젯 모두 앞으로 (잠깐)", null, delegate { ShowAllFront(); });
            menu.Items.Add(miAdd);
            menu.Items.Add(miRemove);
            miPin.Click += delegate { SetPinned(!pinned); };
            menu.Items.Add(miPin);
            menu.Items.Add("새로고침", null, delegate { foreach (WidgetWindow w in windows) w.Reload(); });
            menu.Items.Add("전체 플래너 열기", null, delegate { App.OpenInBrowser(App.PlannerUrl); });
            menu.Items.Add(new ToolStripSeparator());
            miMascot.Click += delegate { brain.Enabled = !brain.Enabled; brain.QuietUntil = DateTime.MinValue; SaveSettings(); if (brain.Enabled) mascot.Say("cheer", "다시 왔어요! 수무가 지켜볼게요", 6); };
            menu.Items.Add(miMascot);
            menu.Items.Add("수무 불러보기", null, delegate { mascot.Say("cheer", brain.ClassCount > 0 ? "오늘 수업 " + brain.ClassCount + "개를 찾았어요. 10분 전에 알려 줄게요!" : "오늘도 화이팅! 수무가 옆에서 지켜볼게요", 8); });
            menu.Items.Add(new ToolStripSeparator());
            miAuto.Click += delegate { App.SetAutoStart(!App.IsAutoStart()); };
            menu.Items.Add(miAuto);
            menu.Items.Add("위젯 제거…", null, delegate { App.Uninstall(false); });
            menu.Items.Add("종료", null, delegate { ExitThread(); });
            menu.Opening += delegate { RebuildSubmenus(); miPin.Checked = pinned; miMascot.Checked = brain.Enabled; miAuto.Checked = App.IsAutoStart(); miAuto.Enabled = !App.Portable; };
            tray.Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            tray.Text = "SUMUS 오늘 위젯";
            tray.ContextMenuStrip = menu;
            tray.Visible = true;
            tray.MouseClick += delegate(object s, MouseEventArgs e) { if (e.Button == MouseButtons.Left) ShowAllFront(); };

            frontTimer.Interval = 7000;
            frontTimer.Tick += delegate { frontTimer.Stop(); foreach (WidgetWindow w in windows) if (!pinned) w.SendToBottom(); };
            // 바탕화면 보기(Win+D) 때 바탕화면이 위로 올라오므로, 위젯을 계속 바탕화면 바로 위에 다시 앉힘
            seatTimer.Interval = 400;
            seatTimer.Tick += delegate { foreach (WidgetWindow w in windows) if (!w.AllowFront && !pinned) w.SendToBottom(); };
            seatTimer.Start();
            brainTimer.Interval = 20000;
            brainTimer.Tick += delegate { try { brain.Tick(); } catch (Exception ex) { App.Log("수무 오류: " + ex.Message); } };
            brainTimer.Start();
            scheduleTimer.Interval = 5 * 60 * 1000;
            scheduleTimer.Tick += delegate { ReadSchedule(); };
            scheduleTimer.Start();

            // 다른 실행(바탕화면 아이콘 다시 클릭, 업데이트, 제거)에서 보내는 신호
            showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, App.ShowEventName);
            quitEvent = new EventWaitHandle(false, EventResetMode.AutoReset, App.QuitEventName);
            showWait = ThreadPool.RegisterWaitForSingleObject(showEvent, delegate { sync.BeginInvoke(new MethodInvoker(ShowAllFront)); }, null, -1, false);
            quitWait = ThreadPool.RegisterWaitForSingleObject(quitEvent, delegate { sync.BeginInvoke(new MethodInvoker(ExitThread)); }, null, -1, true);

            string list = Get("widgets", "all");
            foreach (string id in list.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)) if (Kinds.Info(id) != null) Open(id.Trim());
            if (windows.Count == 0) Open("all");
        }

        // ---------------------------------------------------------------- 창
        public Task<CoreWebView2Environment> GetEnv() { if (envTask == null) envTask = CoreWebView2Environment.CreateAsync(null, App.DataDir, null); return envTask; }
        public Size Scale(Size s) { using (Graphics g = sync.CreateGraphics()) return new Size((int)(s.Width * g.DpiX / 96f), (int)(s.Height * g.DpiY / 96f)); }
        public string UrlFor(string id)
        {
            string kind = Kinds.Of(id), url = App.Url, n = Get("w." + id + ".n", "");
            if (kind == "all") return url;
            string q = "w=" + kind + (n.Length > 0 ? "&n=" + Uri.EscapeDataString(n) : "");
            return url + (url.IndexOf('?') >= 0 ? "&" : "?") + q;
        }
        public void SetNote(string id, string note) { settings["w." + id + ".n"] = note; SaveSettings(); }
        public Rectangle BoundsFor(string id, string[] info)
        {
            Size def = Scale(new Size(info != null ? int.Parse(info[2]) : 320, info != null ? int.Parse(info[3]) : 300));
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            string p = "w." + id + ".";
            if (id == "all" && Get(p + "x", "") == "") p = ""; // 예전 버전(v2)에서 저장한 위치
            int x, y, w, h;
            if (int.TryParse(Get(p + "x", ""), out x) && int.TryParse(Get(p + "y", ""), out y) && int.TryParse(Get(p + "w", ""), out w) && int.TryParse(Get(p + "h", ""), out h))
            {
                Rectangle r = new Rectangle(x, y, Math.Max(w, 200), Math.Max(h, 110));
                foreach (Screen s in Screen.AllScreens) { Rectangle hit = Rectangle.Intersect(s.WorkingArea, r); if (hit.Width >= 100 && hit.Height >= 60) return r; }
            }
            int off = (cascade++ % 6) * 28;
            def.Height = Math.Min(def.Height, wa.Height - 32);
            return new Rectangle(wa.Right - def.Width - 16 - off, wa.Top + 16 + off, def.Width, def.Height);
        }
        public void SaveBounds(string id, Rectangle b)
        {
            string p = "w." + id + ".";
            settings[p + "x"] = b.X.ToString(); settings[p + "y"] = b.Y.ToString(); settings[p + "w"] = b.Width.ToString(); settings[p + "h"] = b.Height.ToString();
            SaveSettings();
        }
        WidgetWindow Find(string id) { foreach (WidgetWindow w in windows) if (w.Id == id) return w; return null; }
        void Open(string id)
        {
            if (Find(id) != null) return;
            WidgetWindow w = new WidgetWindow(this, id);
            windows.Add(w);
            w.AllowFront = pinned;
            w.TopMost = pinned;
            w.Show();
        }
        public void AddWidget(string kind)
        {
            string id = kind; int n = 2;
            while (Find(id) != null) id = kind + "#" + (n++);
            Open(id); SaveSettings();
            WidgetWindow w = Find(id); if (w != null) { w.BringFront(); frontTimer.Stop(); frontTimer.Start(); }
        }
        public void RemoveWidget(string id)
        {
            WidgetWindow w = Find(id); if (w == null) return;
            windows.Remove(w);
            w.Close(); w.Dispose();
            SaveSettings();
        }
        void ShowAllFront()
        {
            foreach (WidgetWindow w in windows) { if (w.WindowState == FormWindowState.Minimized) w.WindowState = FormWindowState.Normal; w.BringFront(); }
            frontTimer.Stop(); frontTimer.Start();
        }
        void SetPinned(bool on)
        {
            pinned = on;
            foreach (WidgetWindow w in windows) { w.TopMost = on; if (on) w.BringFront(); else w.SendToBottom(); }
            SaveSettings();
        }
        void RebuildSubmenus()
        {
            miAdd.DropDownItems.Clear(); miRemove.DropDownItems.Clear();
            foreach (string[] k in Kinds.All) { string kind = k[0]; miAdd.DropDownItems.Add(k[1], null, delegate { AddWidget(kind); }); }
            foreach (WidgetWindow w in windows) { string id = w.Id; string[] info = Kinds.Info(id); miRemove.DropDownItems.Add((info != null ? info[1] : id) + (id.IndexOf('#') > 0 ? " " + id.Substring(id.IndexOf('#') + 1) : ""), null, delegate { RemoveWidget(id); }); }
            miRemove.Enabled = windows.Count > 0;
        }

        // ---------------------------------------------------------------- 수무 (캐릭터)
        public void OnPageReady() { ReadSchedule(); Greet(); }
        async void ReadSchedule()
        {
            try
            {
                foreach (WidgetWindow w in windows)
                {
                    string list = await w.Eval("JSON.stringify(window.sumusClasses || null)");
                    if (list == null) continue;
                    if (brain.ReadClassList(list)) return;
                    string json = await w.Eval("document.body ? document.body.innerText : ''");
                    string text = json != null && json.Length >= 2 && json[0] == '"' ? System.Text.RegularExpressions.Regex.Unescape(json.Substring(1, json.Length - 2)) : "";
                    brain.ReadSchedule(text);
                    return;
                }
            }
            catch (Exception ex) { App.Log("수업 시간 읽기 실패: " + ex.Message); }
        }
        void Greet()
        {
            string today = DateTime.Today.ToString("yyyyMMdd");
            if (!brain.Enabled || greeted || Get("greet", "") == today) return;
            greeted = true; settings["greet"] = today; SaveSettings();
            mascot.Say("cheer", brain.ClassCount > 0 ? "오늘 수업 " + brain.ClassCount + "개! 10분 전에 알려 줄게요" : "오늘도 화이팅! 수무가 옆에서 지켜볼게요", 8);
        }

        // ---------------------------------------------------------------- 설정
        void LoadSettings()
        {
            try
            {
                if (!File.Exists(App.SettingsPath)) return;
                foreach (string line in File.ReadAllLines(App.SettingsPath, Encoding.UTF8))
                { int i = line.IndexOf('='); if (i > 0) settings[line.Substring(0, i).Trim()] = line.Substring(i + 1).Trim(); }
            }
            catch { }
        }
        string Get(string key, string fallback) { string v; return settings.TryGetValue(key, out v) ? v : fallback; }
        void SaveSettings()
        {
            try
            {
                List<string> ids = new List<string>(); foreach (WidgetWindow w in windows) ids.Add(w.Id);
                settings["widgets"] = ids.Count > 0 ? string.Join(",", ids.ToArray()) : Get("widgets", "all");
                settings["pinned"] = pinned ? "1" : "0";
                settings["mascot"] = brain == null || brain.Enabled ? "1" : "0";
                StringBuilder sb = new StringBuilder();
                foreach (KeyValuePair<string, string> kv in settings) sb.Append(kv.Key).Append('=').Append(kv.Value).Append("\r\n");
                File.WriteAllText(App.SettingsPath, sb.ToString(), Encoding.UTF8);
            }
            catch (Exception ex) { App.Log("설정 저장 실패: " + ex.Message); }
        }

        protected override void ExitThreadCore()
        {
            SaveSettings();
            tray.Visible = false;
            if (showWait != null) showWait.Unregister(null);
            if (quitWait != null) quitWait.Unregister(null);
            foreach (WidgetWindow w in windows.ToArray()) { try { w.Close(); } catch { } }
            tray.Dispose(); mascot.Dispose(); brainTimer.Dispose(); scheduleTimer.Dispose(); frontTimer.Dispose(); seatTimer.Dispose();
            base.ExitThreadCore();
        }
    }
}
