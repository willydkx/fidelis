namespace Fidelis.Desktop;

/// <summary>A short log next to the data (fidelis.log), for diagnosing notifications and startup.</summary>
internal static class Log
{
    private const long MaxBytes = 256 * 1024;
    private static readonly string FilePath = Path.Combine(AppPaths.DataDirectory, "fidelis.log");

    public static void Write(string message)
    {
        try
        {
            if (File.Exists(FilePath) && new FileInfo(FilePath).Length > MaxBytes) File.Delete(FilePath);
            File.AppendAllText(FilePath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}{Environment.NewLine}");
        }
        catch (IOException)
        {
            // Logging must never break the app.
        }
    }
}
