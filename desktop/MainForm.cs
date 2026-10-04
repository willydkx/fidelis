using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Fidelis.Desktop;

/// <summary>
/// The Fidelis window: WebView2 showing the web build, plus the bridge the page uses for
/// what a browser can't do (see src/platform/desktop.ts).
/// </summary>
internal sealed class MainForm : Form
{
    private const string HostName = "app.fidelis.internal";
    // Matches experiments.baseUrl in app.json; the web build sits in wwwroot/fidelis.
    private const string AppBasePath = "fidelis";
    private static readonly string StartUrl = $"https://{HostName}/{AppBasePath}/";
    private static readonly TimeSpan PageEventTimeout = TimeSpan.FromSeconds(3);

    private readonly TrayContext _app;
    private readonly WebView2 _web;
    private readonly Dictionary<string, TaskCompletionSource> _pageEvents = new();
    private bool _closeAllowed;

    public MainForm(TrayContext app)
    {
        _app = app;
        Text = "Fidelis";
        Icon = TrayContext.AppIcon;
        BackColor = Color.FromArgb(13, 13, 13);
        MinimumSize = new Size(420, 600);
        StartPosition = FormStartPosition.Manual;
        PlaceWindow(app.Settings);

        _web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = BackColor };
        Controls.Add(_web);
        Load += async (_, _) => await InitializeWebViewAsync();
    }

    /// <summary>True once the window has started freeing itself (closed to the tray or exiting).</summary>
    public bool IsClosingForGood { get; private set; }

    public void Restore()
    {
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Activate();
    }

    private async Task InitializeWebViewAsync()
    {
        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: AppPaths.WebViewData);
        await _web.EnsureCoreWebView2Async(environment);
        var core = _web.CoreWebView2;

        core.Settings.AreDevToolsEnabled = _app.DevTools;
        core.Settings.AreDefaultContextMenusEnabled = _app.DevTools;
        // No browser shortcuts (reload, print, find...): it should feel like an app.
        core.Settings.AreBrowserAcceleratorKeysEnabled = _app.DevTools;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.IsGeneralAutofillEnabled = false;
        core.Settings.IsPasswordAutosaveEnabled = false;

        // The app's files are served from wwwroot under a private https origin.
        core.AddWebResourceRequestedFilter($"https://{HostName}/*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += (_, e) => e.Response = ServeAppFile(core.Environment, new Uri(e.Request.Uri));
        core.WebMessageReceived += OnWebMessage;
        // Links to other sites open in the default browser.
        core.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            OpenExternal(e.Uri);
        };
        core.NavigationStarting += (_, e) =>
        {
            if (!e.Uri.StartsWith($"https://{HostName}/", StringComparison.OrdinalIgnoreCase))
            {
                e.Cancel = true;
                OpenExternal(e.Uri);
            }
        };
        core.Navigate(StartUrl);
    }

    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8",
        [".js"] = "text/javascript; charset=utf-8",
        [".css"] = "text/css; charset=utf-8",
        [".json"] = "application/json",
        [".webmanifest"] = "application/manifest+json",
        [".wasm"] = "application/wasm",
        [".png"] = "image/png",
        [".ico"] = "image/x-icon",
        [".ttf"] = "font/ttf",
        [".wav"] = "audio/wav",
    };

    private static CoreWebView2WebResourceResponse ServeAppFile(CoreWebView2Environment environment, Uri uri)
    {
        var root = Path.GetFullPath(AppPaths.WebRoot);
        var relative = Uri.UnescapeDataString(uri.AbsolutePath).TrimStart('/');
        var file = Path.GetFullPath(Path.Combine(root, relative));
        // App routes (/fidelis/, /fidelis/settings...) aren't files: answer them with the app's
        // index.html, as GitHub Pages does with its 404 page.
        if (!Path.HasExtension(file)) file = Path.Combine(root, AppBasePath, "index.html");
        if (!file.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(file))
        {
            return environment.CreateWebResourceResponse(null, 404, "Not Found", "");
        }
        var type = ContentTypes.GetValueOrDefault(Path.GetExtension(file), "application/octet-stream");
        return environment.CreateWebResourceResponse(
            new MemoryStream(File.ReadAllBytes(file)), 200, "OK", $"Content-Type: {type}");
    }

    private static void OpenExternal(string uri)
    {
        if (uri.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });
        }
    }

    // ---- Bridge -------------------------------------------------------------------------

    private void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        JsonNode? message;
        try
        {
            message = JsonNode.Parse(e.WebMessageAsJson);
        }
        catch (JsonException)
        {
            return;
        }
        var type = message?["type"]?.GetValue<string>();
        var payload = message?["payload"];

        if (type == "eventDone")
        {
            var name = payload?["event"]?.GetValue<string>();
            if (name is not null && _pageEvents.Remove(name, out var waiter)) waiter.TrySetResult();
            return;
        }

        var id = message?["id"]?.GetValue<int>();
        if (id is null || type is null) return;
        try
        {
            Reply(id.Value, true, HandleRequest(type, payload));
        }
        catch (Exception error)
        {
            Reply(id.Value, false, error: error.Message);
        }
    }

    private JsonNode? HandleRequest(string type, JsonNode? payload)
    {
        switch (type)
        {
            case "db.load":
                return File.Exists(AppPaths.Database) ? Convert.ToBase64String(File.ReadAllBytes(AppPaths.Database)) : null;

            case "db.save":
                SaveDatabase(Convert.FromBase64String(payload!.GetValue<string>()));
                return null;

            case "notifications.schedule":
                var group = payload!["group"]!.GetValue<string>();
                var items = payload["items"]!.AsArray().Select(item => new ScheduledNotification(
                    DateTimeOffset.FromUnixTimeMilliseconds(item!["at"]!.GetValue<long>()).ToLocalTime(),
                    item["title"]!.GetValue<string>(),
                    item["body"]!.GetValue<string>(),
                    item["sound"]?.GetValue<bool>() ?? false));
                _app.Scheduler.Replace(group, items);
                return null;

            case "autostart.get":
                return Autostart.IsEnabled;

            case "autostart.set":
                Autostart.Set(payload!.GetValue<bool>());
                return null;

            default:
                throw new InvalidOperationException($"Unknown request '{type}'");
        }
    }

    /// <summary>Writes a new copy and swaps it in, keeping the previous one as fidelis.db.bak.</summary>
    private static void SaveDatabase(byte[] bytes)
    {
        var temp = AppPaths.Database + ".tmp";
        File.WriteAllBytes(temp, bytes);
        if (File.Exists(AppPaths.Database))
        {
            File.Replace(temp, AppPaths.Database, AppPaths.Database + ".bak");
        }
        else
        {
            File.Move(temp, AppPaths.Database);
        }
    }

    private void Reply(int id, bool ok, JsonNode? result = null, string? error = null)
    {
        var reply = new JsonObject { ["id"] = id, ["ok"] = ok, ["result"] = result, ["error"] = error };
        _web.CoreWebView2?.PostWebMessageAsJson(reply.ToJsonString());
    }

    /// <summary>Tells the page something is about to happen and waits (briefly) until it is ready.</summary>
    private async Task RaisePageEventAsync(string name)
    {
        if (_web.CoreWebView2 is null) return;
        var waiter = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _pageEvents[name] = waiter;
        _web.CoreWebView2.PostWebMessageAsJson(new JsonObject { ["event"] = name }.ToJsonString());
        await Task.WhenAny(waiter.Task, Task.Delay(PageEventTimeout));
    }

    // ---- Closing ------------------------------------------------------------------------

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (!_closeAllowed && e.CloseReason == CloseReason.UserClosing)
        {
            // Closing the window sends Fidelis to the tray: save, then free the whole page.
            e.Cancel = true;
            Hide();
            _ = CloseForGoodAsync();
            return;
        }
        base.OnFormClosing(e);
    }

    /// <summary>Lets the page save, then closes and disposes the window and its WebView2.</summary>
    public async Task CloseForGoodAsync()
    {
        if (IsClosingForGood) return;
        IsClosingForGood = true;
        SaveWindowPlacement(_app.Settings);
        await RaisePageEventAsync("hide");
        _closeAllowed = true;
        Close();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) _web.Dispose();
        base.Dispose(disposing);
    }

    // ---- Window placement ---------------------------------------------------------------

    private void PlaceWindow(AppSettings settings)
    {
        var size = new Size(settings.WindowWidth, settings.WindowHeight);
        Point? location = settings.WindowX is int x && settings.WindowY is int y ? new Point(x, y) : null;
        var area = Screen.FromPoint(location ?? Cursor.Position).WorkingArea;
        if (location is null || !area.IntersectsWith(new Rectangle(location.Value, size)))
        {
            location = new Point(area.Left + (area.Width - size.Width) / 2, area.Top + (area.Height - size.Height) / 2);
        }
        Bounds = new Rectangle(location.Value, size);
        if (settings.WindowMaximized) WindowState = FormWindowState.Maximized;
    }

    private void SaveWindowPlacement(AppSettings settings)
    {
        var bounds = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
        settings.WindowX = bounds.X;
        settings.WindowY = bounds.Y;
        settings.WindowWidth = bounds.Width;
        settings.WindowHeight = bounds.Height;
        settings.WindowMaximized = WindowState == FormWindowState.Maximized;
        settings.Save();
    }

    // Dark title bar to match the app.
    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        var enabled = 1;
        DwmSetWindowAttribute(Handle, DwmwaUseImmersiveDarkMode, ref enabled, sizeof(int));
    }

    private const int DwmwaUseImmersiveDarkMode = 20;

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
}
