namespace Fidelis.Desktop;

/// <summary>Where Fidelis keeps its files: the app folder and the user's data folder.</summary>
internal static class AppPaths
{
    public static string AppDirectory { get; } = AppContext.BaseDirectory;

    /// <summary>The web build (same as the browser version), served to WebView2.</summary>
    public static string WebRoot { get; } = Path.Combine(AppDirectory, "wwwroot");

    public static string AlarmSound { get; } = Path.Combine(AppDirectory, "pomodoro_alarm.wav");

    /// <summary>Set to try a build without touching the real data (or the Windows autostart).</summary>
    public static string? TestDataDirectory { get; } = Environment.GetEnvironmentVariable("FIDELIS_DATA_DIR");

    public static string DataDirectory { get; } = Directory.CreateDirectory(
        TestDataDirectory ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Fidelis")).FullName;

    public static string Database { get; } = Path.Combine(DataDirectory, "fidelis.db");

    public static string Settings { get; } = Path.Combine(DataDirectory, "settings.json");

    public static string WebViewData { get; } = Path.Combine(DataDirectory, "WebView2");
}
