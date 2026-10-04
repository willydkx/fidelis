using System.Diagnostics;
using System.Media;
using System.Runtime.InteropServices;

namespace Fidelis.Desktop;

/// <summary>
/// The app itself: an icon next to the clock that owns the window and the notifications.
/// Closing the window frees it entirely (WebView2 and its processes), so while Fidelis sits
/// in the tray only this small process remains.
/// </summary>
internal sealed class TrayContext : ApplicationContext
{
    private readonly NotifyIcon _tray;
    private readonly EventWaitHandle _showRequests;
    private readonly RegisteredWaitHandle _showRequestsWait;
    private readonly SynchronizationContext _ui;
    private MainForm? _window;
    private bool _reopenWhenClosed;
    private SoundPlayer? _alarm;

    public TrayContext(bool devTools)
    {
        DevTools = devTools;
        _ui = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
        Settings = AppSettings.Load();
        Scheduler = new NotificationScheduler(ShowNotification);

        // Fidelis starts with Windows unless the user turns it off in Ajustes.
        if (AppPaths.TestDataDirectory is null)
        {
            if (!Settings.AutostartInitialized)
            {
                Autostart.Set(true);
                Settings.AutostartInitialized = true;
                Settings.Save();
            }
            else
            {
                Autostart.RepairPath();
            }
        }

        var menu = new ContextMenuStrip();
        menu.Items.Add("Abrir Fidelis", null, (_, _) => ShowWindow());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Salir", null, async (_, _) => await ExitAsync());
        _tray = new NotifyIcon
        {
            Icon = AppIcon,
            Text = "Fidelis",
            ContextMenuStrip = menu,
            Visible = true,
        };
        _tray.MouseClick += (_, e) =>
        {
            if (e.Button == MouseButtons.Left) ShowWindow();
        };
        _tray.BalloonTipClicked += (_, _) => ShowWindow();

        // Another launch of Fidelis.exe asks this one to show its window.
        _showRequests = new EventWaitHandle(false, EventResetMode.AutoReset, Program.ShowEventName);
        _showRequestsWait = ThreadPool.RegisterWaitForSingleObject(
            _showRequests, (_, _) => _ui.Post(_ => ShowWindow(), null), null, Timeout.Infinite, executeOnlyOnce: false);

        Log.Write($"started {Application.ProductVersion}");
        ShowWindow();
    }

    public static Icon AppIcon { get; } =
        new(typeof(TrayContext).Assembly.GetManifestResourceStream("Fidelis.ico")!);

    public bool DevTools { get; }

    public AppSettings Settings { get; }

    public NotificationScheduler Scheduler { get; }

    public GoogleAuth Google { get; } = new();

    public void ShowWindow()
    {
        if (_window is { IsClosingForGood: true })
        {
            _reopenWhenClosed = true;
            return;
        }
        if (_window is null || _window.IsDisposed)
        {
            _window = new MainForm(this);
            _window.FormClosed += OnWindowClosed;
            _window.Show();
        }
        _window.Restore();
    }

    private void OnWindowClosed(object? sender, FormClosedEventArgs e)
    {
        _window = null;
        // Give the freed memory back to Windows straight away: from here on Fidelis only
        // waits in the tray.
        GC.Collect();
        GC.WaitForPendingFinalizers();
        GC.Collect();
        SetProcessWorkingSetSize(Process.GetCurrentProcess().Handle, -1, -1);
        if (_reopenWhenClosed)
        {
            _reopenWhenClosed = false;
            ShowWindow();
        }
    }

    private void ShowNotification(ScheduledNotification notification)
    {
        Log.Write($"notification: {notification.Title}");
        _tray.ShowBalloonTip(10_000, notification.Title, notification.Body, ToolTipIcon.None);
        if (notification.Sound && File.Exists(AppPaths.AlarmSound))
        {
            _alarm ??= new SoundPlayer(AppPaths.AlarmSound);
            _alarm.Play();
        }
    }

    private async Task ExitAsync()
    {
        if (_window is not null)
        {
            _window.FormClosed -= OnWindowClosed;
            await _window.CloseForGoodAsync();
        }
        _tray.Visible = false;
        ExitThread();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _showRequestsWait.Unregister(null);
            _showRequests.Dispose();
            Scheduler.Dispose();
            _alarm?.Dispose();
            _tray.Dispose();
        }
        base.Dispose(disposing);
    }

    [DllImport("kernel32.dll")]
    private static extern bool SetProcessWorkingSetSize(IntPtr process, nint minimum, nint maximum);
}
