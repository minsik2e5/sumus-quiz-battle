// SUMUS 위젯 v2.1 — 캐릭터 "수무": 화면 오른쪽 아래에서 올라와 말풍선으로 알려 줍니다.
//   · 딴짓 잔소리: 유튜브·웹툰·게임 같은 창을 20분 넘게 보고 있으면 (그 뒤로는 40분마다)
//   · 수업 알림: 위젯 화면에 보이는 오늘 수업 시간 10분 전
//   · 쉬는 시간: 컴퓨터를 1시간 쉬지 않고 쓰면
// C# 5 (.NET Framework 4.8 csc) 문법만 씁니다.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace SumusWidget
{
    // ---------------------------------------------------------------- 캐릭터 창 (투명 배경, 항상 위, 포커스 안 뺏음)
    class MascotForm : Form
    {
        [StructLayout(LayoutKind.Sequential)] struct PT { public int X, Y; public PT(int x, int y) { X = x; Y = y; } }
        [StructLayout(LayoutKind.Sequential)] struct SZ { public int W, H; public SZ(int w, int h) { W = w; H = h; } }
        [StructLayout(LayoutKind.Sequential, Pack = 1)] struct BLEND { public byte Op, Flags, Alpha, Format; }
        [DllImport("user32.dll")] static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref PT pptDst, ref SZ psize, IntPtr hdcSrc, ref PT pprSrc, int crKey, ref BLEND pblend, int dwFlags);
        [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hWnd);
        [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
        [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr hDC);
        [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr hdc);
        [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr hDC, IntPtr hObject);
        [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr hObject);

        static readonly Dictionary<string, Image> Poses = new Dictionary<string, Image>();
        public static Image Pose(string name)
        {
            Image img;
            if (Poses.TryGetValue(name, out img)) return img;
            Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("mascot." + name + ".png");
            img = s == null ? null : Image.FromStream(s);
            Poses[name] = img;
            return img;
        }

        readonly Timer anim = new Timer();
        readonly float k;              // 화면 배율 (DPI)
        readonly int W, H;
        string pose = "idle", text = "";
        DateTime shownAt, leaveAt;
        int phase;                    // 0 올라오는 중, 1 머무름, 2 내려가는 중
        float slide = 1f;              // 1 = 화면 아래로 숨음, 0 = 다 올라옴
        bool hover, blink;
        public event Action<string> MenuPicked;

        public MascotForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            using (Graphics g = Graphics.FromHwnd(IntPtr.Zero)) k = Math.Max(1f, g.DpiX / 96f);
            W = (int)(340 * k); H = (int)(250 * k);
            Size = new Size(W, H);
            anim.Interval = 33;
            anim.Tick += delegate { Step(); };
            MouseEnter += delegate { hover = true; };
            MouseLeave += delegate { hover = false; };
            MouseUp += delegate(object s, MouseEventArgs e)
            {
                if (e.Button == MouseButtons.Right) { ShowMenu(e.Location); return; }
                if (pose == "nag" || pose == "bell" || pose == "rest") { pose = "cheer"; text = "좋아요! 수무가 응원할게요"; leaveAt = DateTime.Now.AddSeconds(1.6); }
                else GoAway();
            };
        }
        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= 0x80000 /*LAYERED*/ | 0x80 /*TOOLWINDOW*/ | 0x8 /*TOPMOST*/ | 0x8000000 /*NOACTIVATE*/;
                return cp;
            }
        }
        protected override bool ShowWithoutActivation { get { return true; } }

        void ShowMenu(Point at)
        {
            ContextMenuStrip m = new ContextMenuStrip();
            m.Items.Add("알겠어요 (닫기)", null, delegate { GoAway(); });
            m.Items.Add("1시간 조용히", null, delegate { GoAway(); if (MenuPicked != null) MenuPicked("quiet1h"); });
            m.Items.Add("오늘은 그만", null, delegate { GoAway(); if (MenuPicked != null) MenuPicked("today"); });
            m.Items.Add(new ToolStripSeparator());
            m.Items.Add("캐릭터 알림 끄기", null, delegate { GoAway(); if (MenuPicked != null) MenuPicked("off"); });
            m.Show(this, at);
        }

        public bool Busy { get { return Visible; } }
        public void SetForShot(string poseName, string message) { pose = poseName; text = message; }

        // 말풍선과 함께 올라옴. 12초 뒤(마우스가 올라가 있으면 더 오래) 내려감.
        public void Say(string poseName, string message, int seconds)
        {
            pose = poseName; text = message;
            shownAt = DateTime.Now; leaveAt = shownAt.AddSeconds(seconds);
            phase = 0;
            if (!Visible) { slide = 1f; Show(); }
            anim.Start();
            Step();
        }
        void GoAway() { if (phase != 2) phase = 2; }

        void Step()
        {
            if (phase == 0) { slide = Math.Max(0f, slide - 0.09f); if (slide <= 0f) phase = 1; }
            else if (phase == 1 && DateTime.Now >= leaveAt && !hover) phase = 2;
            else if (phase == 2) { slide = Math.Min(1f, slide + 0.08f); if (slide >= 1f) { anim.Stop(); Hide(); return; } }
            double t = (DateTime.Now - shownAt).TotalSeconds;
            blink = (pose == "idle") && (t % 3.2) > 3.05;
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            float ease = 1f - (float)Math.Pow(1f - (1f - slide), 3);
            int x = wa.Right - W - (int)(12 * k);
            int y = wa.Bottom - H + (int)((H + 10) * (1f - ease));
            using (Bitmap bmp = Render((float)t)) Push(bmp, x, y);
        }

        public Bitmap Render(float t)
        {
            Bitmap bmp = new Bitmap(W, H, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                g.Clear(Color.Transparent);
                // 캐릭터: 오른쪽 아래, 살짝 통통 튀기 (잔소리는 더 크게)
                float amp = pose == "nag" ? 7f : pose == "cheer" || pose == "bell" ? 6f : 3f;
                float speed = pose == "nag" ? 9f : 4f;
                float bob = (float)Math.Abs(Math.Sin(t * speed)) * amp * k;
                float cs = 150 * k;
                RectangleF cr = new RectangleF(W - cs - 4 * k, H - cs - bob, cs, cs);
                Image img = Pose(blink ? "blink" : pose) ?? Pose("idle");
                if (img != null) g.DrawImage(img, cr);
                // 말풍선: 캐릭터 왼쪽 위
                if (!string.IsNullOrEmpty(text))
                {
                    using (Font f = new Font("Malgun Gothic", 15f * k, FontStyle.Bold, GraphicsUnit.Pixel))
                    {
                        float bw = W - cs * 0.62f - 10 * k;
                        StringFormat sf = new StringFormat { Alignment = StringAlignment.Near, LineAlignment = StringAlignment.Center, FormatFlags = StringFormatFlags.NoWrap };
                        string wrapped = Wrap(g, text, f, bw - 40 * k);
                        SizeF ts = g.MeasureString(wrapped, f);
                        float bh = Math.Max(48 * k, ts.Height + 26 * k);
                        RectangleF br = new RectangleF(6 * k, Math.Max(4 * k, cr.Top - bh + 34 * k), bw, bh);
                        Color edge = pose == "nag" ? Color.FromArgb(255, 229, 72, 77) : pose == "bell" ? Color.FromArgb(255, 242, 166, 12) : Color.FromArgb(255, 49, 130, 246);
                        using (GraphicsPath p = Bubble(br, 16 * k, new PointF(br.Right - 6 * k, br.Bottom - 22 * k), new PointF(cr.Left + 30 * k, br.Bottom + 8 * k)))
                        {
                            using (SolidBrush sh = new SolidBrush(Color.FromArgb(40, 20, 40, 80))) { g.TranslateTransform(0, 3 * k); g.FillPath(sh, p); g.ResetTransform(); }
                            g.FillPath(Brushes.White, p);
                            using (Pen pen = new Pen(edge, 2.5f * k)) g.DrawPath(pen, p);
                        }
                        using (SolidBrush tb = new SolidBrush(Color.FromArgb(255, 25, 31, 40)))
                            g.DrawString(wrapped, f, tb, new RectangleF(br.Left + 14 * k, br.Top + 4 * k, br.Width - 28 * k, br.Height - 8 * k), sf);
                    }
                }
            }
            return bmp;
        }
        // 띄어쓰기 단위로 줄바꿈 (한국어 단어가 중간에서 끊기지 않게)
        static string Wrap(Graphics g, string s, Font f, float width)
        {
            StringBuilder outp = new StringBuilder(); string line = "";
            foreach (string word in s.Split(' '))
            {
                string tryLine = line.Length == 0 ? word : line + " " + word;
                if (line.Length > 0 && g.MeasureString(tryLine, f).Width > width) { outp.Append(line).Append('\n'); line = word; }
                else line = tryLine;
            }
            return outp.Append(line).ToString();
        }
        static GraphicsPath Bubble(RectangleF r, float rad, PointF tailBase, PointF tip)
        {
            GraphicsPath p = new GraphicsPath();
            float d = rad * 2;
            p.AddArc(r.Left, r.Top, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Top, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddLine(r.Right - d * 0.6f, r.Bottom, tip.X, tip.Y);
            p.AddLine(tip.X, tip.Y, r.Right - d * 1.6f, r.Bottom);
            p.AddArc(r.Left, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        void Push(Bitmap bmp, int x, int y)
        {
            IntPtr screen = GetDC(IntPtr.Zero), mem = CreateCompatibleDC(screen), hbmp = IntPtr.Zero, old = IntPtr.Zero;
            try
            {
                hbmp = bmp.GetHbitmap(Color.FromArgb(0));
                old = SelectObject(mem, hbmp);
                PT dst = new PT(x, y), src = new PT(0, 0);
                SZ size = new SZ(bmp.Width, bmp.Height);
                BLEND b = new BLEND { Op = 0, Flags = 0, Alpha = 255, Format = 1 };
                UpdateLayeredWindow(Handle, screen, ref dst, ref size, mem, ref src, 0, ref b, 2 /*ULW_ALPHA*/);
            }
            finally
            {
                ReleaseDC(IntPtr.Zero, screen);
                if (hbmp != IntPtr.Zero) { SelectObject(mem, old); DeleteObject(hbmp); }
                DeleteDC(mem);
            }
        }
        protected override void Dispose(bool disposing) { if (disposing) anim.Dispose(); base.Dispose(disposing); }
    }

    // ---------------------------------------------------------------- 언제 무엇을 말할지
    class MascotBrain
    {
        [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize, dwTime; }
        [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        public const int NagAfterMin = 20, NagEveryMin = 40, BreakAfterMin = 60, ClassBeforeMin = 10;
        static readonly string[] Distractions = { "youtube", "유튜브", "netflix", "넷플릭스", "웹툰", "webtoon", "치지직", "chzzk", "twitch", "afreeca", "soop", "instagram", "인스타", "tiktok", "틱톡", "facebook", "페이스북", "쿠팡", "coupang", "11번가", "무신사", "디시인사이드", "dcinside", "fmkorea", "에펨", "인벤", "league of legends", "리그 오브 레전드", "steam", "넥슨", "쇼츠", "shorts" };
        static readonly string[] NagLines = {
            "정신 차려요! 일할 시간이에요!",
            "딴짓 20분째… 이제 할 일 하러 가요!",
            "선생님~ 수업 준비는 다 했어요?",
            "그 영상은 이따가! 지금은 일해요!",
            "수무가 보고 있어요. 플래너 한 번만 봐요!"
        };
        static readonly string[] RestLines = {
            "1시간 열심히 했어요! 물 한잔 마시고 기지개 쭉~",
            "잠깐 쉬어요. 눈 감고 10초, 어깨 돌리기!",
            "수고했어요! 일어나서 스트레칭 한 번 해요"
        };

        readonly MascotForm face;
        readonly Random rnd = new Random();
        public bool Enabled = true;
        public DateTime QuietUntil = DateTime.MinValue;
        DateTime distractSince = DateTime.MinValue, lastNag = DateTime.MinValue, lastDistractSeen = DateTime.MinValue;
        DateTime activeSince = DateTime.Now;
        readonly HashSet<string> classDone = new HashSet<string>();
        List<KeyValuePair<DateTime, string>> classes = new List<KeyValuePair<DateTime, string>>();

        public MascotBrain(MascotForm face) { this.face = face; }

        static int IdleSeconds()
        {
            LASTINPUTINFO li = new LASTINPUTINFO(); li.cbSize = (uint)Marshal.SizeOf(li);
            if (!GetLastInputInfo(ref li)) return 0;
            return (int)(((uint)Environment.TickCount - li.dwTime) / 1000);
        }
        static string ForegroundTitle()
        {
            StringBuilder sb = new StringBuilder(512);
            GetWindowText(GetForegroundWindow(), sb, sb.Capacity);
            return sb.ToString().ToLowerInvariant();
        }
        bool Quiet { get { return !Enabled || DateTime.Now < QuietUntil || face.Busy; } }

        // 20초마다
        public void Tick()
        {
            DateTime now = DateTime.Now;
            int idle = IdleSeconds();
            // 쉬는 시간: 10분 넘게 손을 떼면 다시 셈
            if (idle >= 600) activeSince = now;
            // 딴짓: 방해 창이 앞에 있는 동안 (1분 넘게 벗어나면 다시 셈)
            string title = ForegroundTitle();
            bool distracted = false;
            foreach (string w in Distractions) if (title.Contains(w)) { distracted = true; break; }
            if (distracted) { if (distractSince == DateTime.MinValue) distractSince = now; lastDistractSeen = now; }
            else if (now - lastDistractSeen > TimeSpan.FromMinutes(1)) distractSince = DateTime.MinValue;

            if (Quiet) return;
            // 1) 수업 10분 전
            foreach (KeyValuePair<DateTime, string> c in classes)
            {
                double left = (c.Key - now).TotalMinutes;
                string key = c.Key.ToString("yyyyMMddHHmm");
                if (left <= ClassBeforeMin && left > ClassBeforeMin - 3 && !classDone.Contains(key))
                {
                    classDone.Add(key);
                    string label = string.IsNullOrEmpty(c.Value) ? "" : c.Value + " ";
                    face.Say("bell", Math.Max(1, (int)Math.Round(left)) + "분 뒤 " + label + "수업이에요! 준비물 챙겨요", 20);
                    return;
                }
            }
            // 2) 딴짓 잔소리
            if (distractSince != DateTime.MinValue && now - distractSince >= TimeSpan.FromMinutes(NagAfterMin) && now - lastNag >= TimeSpan.FromMinutes(NagEveryMin))
            {
                lastNag = now;
                face.Say("nag", NagLines[rnd.Next(NagLines.Length)], 15);
                return;
            }
            // 3) 쉬는 시간
            if (idle < 300 && now - activeSince >= TimeSpan.FromMinutes(BreakAfterMin))
            {
                activeSince = now;
                face.Say("rest", RestLines[rnd.Next(RestLines.Length)], 15);
            }
        }

        static readonly Regex TimeRx = new Regex(@"(?<!\d)([01]?\d|2[0-3])\s*[:：시]\s*([0-5]\d)(?!\d)");
        // 위젯 화면 글자에서 오늘 수업 시간 찾기: 줄마다 첫 시각이 시작 시간, 나머지 글자가 이름
        public void ReadSchedule(string pageText)
        {
            List<KeyValuePair<DateTime, string>> list = new List<KeyValuePair<DateTime, string>>();
            if (!string.IsNullOrEmpty(pageText))
            {
                DateTime today = DateTime.Today;
                string prev = "";   // 반 이름이 시간 윗줄에 따로 있을 때
                foreach (string raw in pageText.Split('\n'))
                {
                    string line = raw.Trim();
                    Match m = TimeRx.Match(line);
                    if (!m.Success) { if (line.Length > 0 && line.Length <= 16 && !Regex.IsMatch(line, @"^\d+$")) prev = line; continue; }
                    if (line.Length > 80) continue;
                    int h = int.Parse(m.Groups[1].Value), mi = int.Parse(m.Groups[2].Value);
                    if (h < 7) continue;
                    string label = TimeRx.Replace(line, "");
                    label = Regex.Replace(label, @"[~\-–—·|()\[\]]", " ");
                    label = Regex.Replace(label, @"\s+", " ").Trim();
                    if (label.Length == 0) label = prev;
                    if (label.Length > 16) label = label.Substring(0, 16).Trim();
                    DateTime at = today.AddHours(h).AddMinutes(mi);
                    bool dup = false;
                    foreach (KeyValuePair<DateTime, string> x in list) if (x.Key == at) { dup = true; break; }
                    if (!dup) list.Add(new KeyValuePair<DateTime, string>(at, label));
                }
            }
            classes = list;
        }
        // window.sumusClasses 를 JSON 문자열로 받은 값: "[{\"start\":\"16:30\",\"label\":\"중2\"},…]"
        public bool ReadClassList(string raw)
        {
            if (string.IsNullOrEmpty(raw) || raw == "null" || raw == "\"null\"") return false;
            string text = raw.Length >= 2 && raw[0] == '"' ? Regex.Unescape(raw.Substring(1, raw.Length - 2)) : raw;
            List<KeyValuePair<DateTime, string>> list = new List<KeyValuePair<DateTime, string>>();
            foreach (Match m in Regex.Matches(text, "\"start\":\"(\\d{1,2}):(\\d{2})\",\"label\":\"([^\"]*)\""))
                list.Add(new KeyValuePair<DateTime, string>(DateTime.Today.AddHours(int.Parse(m.Groups[1].Value)).AddMinutes(int.Parse(m.Groups[2].Value)), m.Groups[3].Value));
            classes = list;
            return true;
        }
        public int ClassCount { get { return classes.Count; } }
    }
}
