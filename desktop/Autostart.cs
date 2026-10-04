using Microsoft.Win32;

namespace Fidelis.Desktop;

/// <summary>"Open when Windows starts", via the current user's Run key (no admin needed).</summary>
internal static class Autostart
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "Fidelis";

    private static string Command => $"\"{Environment.ProcessPath}\" --autostart";

    public static bool IsEnabled
    {
        get
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey);
            return key?.GetValue(ValueName) is string value
                && value.Contains(Environment.ProcessPath!, StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>If autostart is on but points to an older location of Fidelis.exe, points it here.</summary>
    public static void RepairPath()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKey);
        if (key?.GetValue(ValueName) is string && !IsEnabled) Set(true);
    }

    public static void Set(bool enabled)
    {
        using var key = Registry.CurrentUser.CreateSubKey(RunKey);
        if (enabled)
        {
            key.SetValue(ValueName, Command);
        }
        else
        {
            key.DeleteValue(ValueName, throwOnMissingValue: false);
        }
    }
}
