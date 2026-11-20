// ZRL Sprawl - Windows screensaver by ZRolesLabs. No network, no telemetry, no audio. https://github.com/ZRolesLabs/zrl-sprawl
// One borderless window across every monitor, showing the Sprawl engine (local files) in WebView2.
// Any key, click or real mouse movement closes it.  /s = run, /c = settings (none), /p = mini preview (skipped).
// Self-test (off unless options.txt holds test=SECONDS): the saver checks once a second that it is the top window on every
// monitor, notes GPU and CPU load, saves the frames the page hands it (shots=...), then closes itself. All into a selftest folder beside the .scr.
using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class Program {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", SetLastError = true)] static extern bool SystemParametersInfo(uint action, uint param, IntPtr pv, uint winIni);
    // /install [seconds] makes this file the current user's screensaver; /uninstall clears it again (it was blank before).
    // Per user only (HKCU\Control Panel\Desktop), no admin rights. Every change is written to install-log.txt beside the .scr.
    static void Install(bool on, string secs) {
        string dir = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location), me = Path.Combine(dir, "ZRL-Sprawl.scr"), log = Path.Combine(dir, "install-log.txt");
        try {
            int n; if (!int.TryParse(secs, out n) || n < 60) n = 300;
            if (on && !File.Exists(me)) { File.AppendAllText(log, "ERROR ZRL-Sprawl.scr is not beside the setup program\r\n"); return; }
            using (var k = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Control Panel\Desktop", true)) {
                Func<string> state = () => "SCRNSAVE.EXE=[" + k.GetValue("SCRNSAVE.EXE", "(not set)") + "] ScreenSaveActive=[" + k.GetValue("ScreenSaveActive", "(not set)") + "] ScreenSaveTimeOut=[" + k.GetValue("ScreenSaveTimeOut", "(not set)") + "] ScreenSaverIsSecure=[" + k.GetValue("ScreenSaverIsSecure", "(not set)") + "]";
                File.AppendAllText(log, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + (on ? " install" : " uninstall") + " BEFORE " + state() + "\r\n");
                if (on) { k.SetValue("SCRNSAVE.EXE", me); k.SetValue("ScreenSaveActive", "1"); k.SetValue("ScreenSaveTimeOut", n.ToString()); }
                else k.DeleteValue("SCRNSAVE.EXE", false);
                bool a1 = SystemParametersInfo(0x0011, 1, IntPtr.Zero, 3), a2 = !on || SystemParametersInfo(0x000F, (uint)n, IntPtr.Zero, 3);
                File.AppendAllText(log, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + (on ? " install" : " uninstall") + " AFTER  " + state() + " applied=" + (a1 && a2 ? "yes" : "NO") + "\r\n");
            }
        } catch (Exception ex) { try { File.AppendAllText(log, "ERROR " + ex + "\r\n"); } catch { } }
    }
    [STAThread]
    static void Main(string[] args) {
        string a = args.Length > 0 ? args[0].ToLowerInvariant().Trim() : "/c";
        // Windows starts a .scr through its file type ("%1" /S), which drops extra arguments, so setup runs from a copy of this
        // same program named ZRL-Sprawl-Setup.exe:  ZRL-Sprawl-Setup.exe /install 300   or   ZRL-Sprawl-Setup.exe /uninstall
        for (int i = 0; i < args.Length; i++) { string x = args[i].ToLowerInvariant().Trim(); if (x == "/install" || x == "/uninstall") { Install(x == "/install", i + 1 < args.Length ? args[i + 1] : "300"); return; } }
        if (System.Reflection.Assembly.GetExecutingAssembly().Location.ToLowerInvariant().EndsWith("setup.exe")) { MessageBox.Show("ZRL Sprawl setup\n\nZRL-Sprawl-Setup.exe /install 300   makes ZRL Sprawl your screensaver (wait in seconds)\nZRL-Sprawl-Setup.exe /uninstall     clears it again", "ZRL Sprawl"); return; }
        string mode = a.Length >= 2 ? a.Substring(0, 2) : a;
        if (mode == "/p") return;
        if (mode == "/c") { MessageBox.Show("ZRL Sprawl screensaver\nZRolesLabs - no network, no telemetry, no audio.\n\nNothing to configure.", "ZRL Sprawl"); return; }
        bool created;
        using (var mx = new System.Threading.Mutex(true, "ZRL-Sprawl-Screensaver", out created)) {
            if (!created) return;
            try { SetProcessDPIAware(); } catch { }
            Application.EnableVisualStyles();
            Application.Run(new Saver(args.Any(x => x.ToLowerInvariant() == "/keep")));
        }
    }
}

class Saver : Form {
    [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
    [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO p);
    [DllImport("user32.dll", SetLastError = true)] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint flags);
    [DllImport("kernel32.dll")] static extern bool IsProcessInJob(IntPtr proc, IntPtr job, out bool res);
    string topDiag = "";
    // created always-on-top by the system itself, and kept off the taskbar without WinForms' hidden owner window
    protected override CreateParams CreateParams { get { var cp = base.CreateParams; if (!keep0) cp.ExStyle |= 0x00000008 | 0x00000080; return cp; } }
    static bool keep0;
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point p);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint f);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    string Who(IntPtr h) { try { var sb = new System.Text.StringBuilder(128); GetClassName(h, sb, 128); uint pid; GetWindowThreadProcessId(h, out pid); string pn = "?"; try { pn = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch { } return "[" + pn + " class=" + sb + " topmost=" + ((GetWindowLong(h, -20) & 8) != 0 ? "yes" : "no") + "]"; } catch { return "[?]"; } }
    int topTick, testSec; string testDir; volatile string load = ""; DateTime born = DateTime.UtcNow;
    void OnTop() { if (keep || closing) return; var b = SystemInformation.VirtualScreen; try { bool ok = SetWindowPos(Handle, new IntPtr(-1), b.X, b.Y, b.Width, b.Height, 0x0040); int er = Marshal.GetLastWin32Error(); topDiag = "setpos=" + (ok ? "ok" : "FAIL" + er) + " ex=0x" + GetWindowLong(Handle, -20).ToString("x"); } catch { } }   // topmost, then to the head of the topmost band (no move, no size, no activate)
    WebView2 wv; Timer tm; Point cur0; uint in0; DateTime t0 = DateTime.UtcNow; bool keep, closing;
    static uint LastInput() { var l = new LASTINPUTINFO(); l.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO)); GetLastInputInfo(ref l); return l.dwTime; }

    public Saver(bool keepOpen) {
        keep = keep0 = keepOpen;
        FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.Manual; TopMost = !keep;
        BackColor = Color.FromArgb(7, 5, 12); Bounds = SystemInformation.VirtualScreen; Text = "ZRL Sprawl";
        Cursor.Hide(); cur0 = Cursor.Position; in0 = LastInput();
        tm = new Timer(); tm.Interval = 50; tm.Tick += (s, e) => Watch(); tm.Start();
        Shown += async (s, e) => {
            OnTop(); try { SetForegroundWindow(Handle); Activate(); } catch { }
            try {
                string here = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
                string site = Path.Combine(here, "sprawl");
                string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ZRolesLabs", "zrl-sprawl-wv2");
                var opt = new CoreWebView2EnvironmentOptions("--disable-background-timer-throttling --disable-renderer-backgrounding --disable-features=CalculateNativeWinOcclusion,msSmartScreenProtection --ignore-gpu-blocklist --disable-background-networking --disable-sync --no-first-run");
                var env = await CoreWebView2Environment.CreateAsync(null, data, opt);
                wv = new WebView2(); wv.DefaultBackgroundColor = Color.FromArgb(7, 5, 12); wv.Dock = DockStyle.Fill; Controls.Add(wv);
                await wv.EnsureCoreWebView2Async(env);
                var c = wv.CoreWebView2;
                c.SetVirtualHostNameToFolderMapping("zrl.sprawl", site, CoreWebView2HostResourceAccessKind.Allow);
                c.Settings.AreDefaultContextMenusEnabled = false; c.Settings.AreDevToolsEnabled = false; c.Settings.IsStatusBarEnabled = false; c.Settings.IsZoomControlEnabled = false; c.Settings.AreBrowserAcceleratorKeysEnabled = false;
                // nothing leaves the machine: only the local site may load
                c.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
                c.WebResourceRequested += (s2, e2) => { if (!e2.Request.Uri.StartsWith("https://zrl.sprawl/", StringComparison.OrdinalIgnoreCase)) e2.Response = env.CreateWebResourceResponse(null, 403, "Blocked", ""); };
                c.WebMessageReceived += (s2, e2) => { try { string m = e2.TryGetWebMessageAsString(); if (m == "exit") Quit(); else if (m != null && testSec > 0 && m.StartsWith("shot:")) { int k = m.IndexOf(':', 5); File.WriteAllBytes(Path.Combine(testDir, "shot-" + m.Substring(5, k - 5).PadLeft(3, '0') + ".jpg"), Convert.FromBase64String(m.Substring(k + 1))); } else if (m != null && m.StartsWith("stat:")) File.AppendAllText(Path.Combine(Path.GetTempPath(), "zrl-sprawl-stats.txt"), DateTime.Now.ToString("HH:mm:ss ") + m.Substring(5) + "\r\n"); } catch { } };
                var scr = Screen.AllScreens.OrderBy(x => x.Bounds.X).ToArray();
                int split = scr.Length > 1 ? scr[1].Bounds.X - SystemInformation.VirtualScreen.X : 0;
                string extra = "";
                try { string f = Path.Combine(here, "options.txt"); if (File.Exists(f)) extra = "&" + File.ReadAllText(f).Trim(); } catch { }
                try { var mt = System.Text.RegularExpressions.Regex.Match(extra, @"[&]test=(\d+)"); if (mt.Success) StartTest(int.Parse(mt.Groups[1].Value), here); } catch { }
                c.Navigate("https://zrl.sprawl/index.html?mode=pc&split=" + split + "&cssw=" + SystemInformation.VirtualScreen.Width + extra);
                t0 = DateTime.UtcNow; cur0 = Cursor.Position; in0 = LastInput();
            } catch (Exception ex) {
                try { File.WriteAllText(Path.Combine(Path.GetTempPath(), "zrl-sprawl-error.txt"), ex.ToString()); } catch { }
                var l = new Label(); l.ForeColor = Color.FromArgb(200, 107, 255); l.Font = new Font("Consolas", 14); l.AutoSize = true; l.Location = new Point(40, 40);
                l.Text = "ZRL Sprawl could not start its view (WebView2).\n" + ex.Message; Controls.Add(l);
            }
        };
    }
    void Watch() {
        if (keep || closing) return;
        if (++topTick % 20 == 0) { OnTop(); if (testSec > 0) TestTick(); }       // once a second: stay above everything on every monitor
        if ((DateTime.UtcNow - t0).TotalSeconds < 1.5) { cur0 = Cursor.Position; in0 = LastInput(); return; }
        Point p = Cursor.Position; int d = Math.Abs(p.X - cur0.X) + Math.Abs(p.Y - cur0.Y);
        uint li = LastInput();
        if (d > 14) { Quit(); return; }
        if (li != in0) { if (d == 0) { Quit(); return; } in0 = li; }   // input with no pointer travel = key, click or wheel; tiny pointer jitter is forgiven
    }
    void StartTest(int sec, string here) {
        testDir = Path.Combine(here, "selftest"); Directory.CreateDirectory(testDir);
        foreach (var f in Directory.GetFiles(testDir)) try { File.Delete(f); } catch { }
        testSec = sec; born = DateTime.UtcNow;
        var th = new System.Threading.Thread(() => {          // GPU (all 3D engines, summed) and CPU load, sampled off the UI thread
            var gpu = new System.Collections.Generic.Dictionary<string, System.Diagnostics.PerformanceCounter>(); System.Diagnostics.PerformanceCounter cpu = null;
            try { cpu = new System.Diagnostics.PerformanceCounter("Processor", "% Processor Time", "_Total"); cpu.NextValue(); } catch { }
            while (!closing) {
                float g = 0; string er = "";
                try {
                    var cat = new System.Diagnostics.PerformanceCounterCategory("GPU Engine");
                    foreach (var n in cat.GetInstanceNames()) if (n.EndsWith("engtype_3D") && !gpu.ContainsKey(n)) { try { var pc = new System.Diagnostics.PerformanceCounter("GPU Engine", "Utilization Percentage", n); pc.NextValue(); gpu[n] = pc; } catch { } }
                    foreach (var k in gpu.Keys.ToArray()) { try { g += gpu[k].NextValue(); } catch { gpu.Remove(k); } }
                } catch (Exception ex) { er = " gpuerr=" + ex.GetType().Name; }
                float cv = -1; try { if (cpu != null) cv = cpu.NextValue(); } catch { }
                load = "gpu3d=" + g.ToString("0") + " cpu=" + cv.ToString("0") + er;
                System.Threading.Thread.Sleep(2000);
            }
        }); th.IsBackground = true; th.Start();
    }
    void TestTick() {
        try {
            double el = (DateTime.UtcNow - born).TotalSeconds; RECT r; GetWindowRect(Handle, out r);
            string s = el.ToString("0").PadLeft(3) + "s win=" + r.L + "," + r.T + " " + (r.R - r.L) + "x" + (r.B - r.T) + " foreground=" + (GetAncestor(GetForegroundWindow(), 2) == Handle ? "me" : "OTHER");
            foreach (var sc in Screen.AllScreens.OrderBy(x => x.Bounds.X)) { var b = sc.Bounds; int ok = 0, n = 0;
                for (int i = 1; i <= 3; i++) for (int j = 1; j <= 3; j++) { n++; if (GetAncestor(WindowFromPoint(new Point(b.X + b.Width * i / 4, b.Y + b.Height * j / 4)), 2) == Handle) ok++; }
                s += " top@" + b.X + "=" + ok + "/" + n; if (ok < n) s += " above=" + Who(GetAncestor(WindowFromPoint(new Point(b.X + b.Width / 2, b.Y + b.Height / 2)), 2)); }
            bool inJob = false; try { IsProcessInJob(System.Diagnostics.Process.GetCurrentProcess().Handle, IntPtr.Zero, out inJob); } catch { }
            s += " me=" + Who(Handle) + " " + topDiag + " job=" + (inJob ? "yes" : "no");
            File.AppendAllText(Path.Combine(testDir, "selftest.txt"), s + " " + load + "\r\n");
            if (el >= testSec) Quit();
        } catch (Exception ex) { try { File.AppendAllText(Path.Combine(testDir, "selftest.txt"), "ERR " + ex.Message + "\r\n"); } catch { } }
    }
    void Quit() { if (closing) return; closing = true; try { tm.Stop(); } catch { } Cursor.Show(); Close(); }
    protected override void OnKeyDown(KeyEventArgs e) { Quit(); }
    protected override void OnMouseDown(MouseEventArgs e) { Quit(); }
    protected override void OnFormClosed(FormClosedEventArgs e) { try { Cursor.Show(); if (wv != null) wv.Dispose(); } catch { } base.OnFormClosed(e); }
}
