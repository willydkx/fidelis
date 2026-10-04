namespace Fidelis.Desktop;

internal static class Program
{
    private const string MutexName = "Fidelis.Desktop.SingleInstance";
    internal const string ShowEventName = "Fidelis.Desktop.Show";

    [STAThread]
    private static void Main(string[] args)
    {
        // A second launch (e.g. from the Start menu while Fidelis sits in the tray) just
        // brings the running window back.
        using var mutex = new Mutex(true, MutexName, out var isFirstInstance);
        if (!isFirstInstance)
        {
            if (EventWaitHandle.TryOpenExisting(ShowEventName, out var showEvent))
            {
                showEvent.Set();
                showEvent.Dispose();
            }
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new TrayContext(devTools: args.Contains("--devtools")));
    }
}
