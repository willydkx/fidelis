using System.Text.Json;

namespace Fidelis.Desktop;

/// <summary>Small desktop-only preferences, stored next to the database.</summary>
internal sealed class AppSettings
{
    public bool AutostartInitialized { get; set; }
    public int? WindowX { get; set; }
    public int? WindowY { get; set; }
    public int WindowWidth { get; set; } = 1100;
    public int WindowHeight { get; set; } = 780;
    public bool WindowMaximized { get; set; }

    public static AppSettings Load()
    {
        try
        {
            if (File.Exists(AppPaths.Settings))
            {
                return JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(AppPaths.Settings)) ?? new AppSettings();
            }
        }
        catch (Exception)
        {
            // A damaged settings file just means default window size.
        }
        return new AppSettings();
    }

    public void Save()
    {
        File.WriteAllText(AppPaths.Settings, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
    }
}
