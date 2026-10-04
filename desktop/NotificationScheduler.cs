using Microsoft.Win32;
using Timer = System.Windows.Forms.Timer;

namespace Fidelis.Desktop;

internal sealed record ScheduledNotification(DateTimeOffset At, string Title, string Body, bool Sound);

/// <summary>
/// Holds the notifications the page asked for (daily reminders, pomodoro end) and shows them
/// on time, even while the window is closed. Uses a single timer set to the next one, so it
/// costs nothing between notifications.
/// </summary>
internal sealed class NotificationScheduler : IDisposable
{
    // After sleep or hibernation, still show what was missed by at most this much.
    private static readonly TimeSpan Grace = TimeSpan.FromMinutes(15);
    // Re-check at least this often in case the clock changes.
    private static readonly TimeSpan MaxWait = TimeSpan.FromMinutes(30);

    private readonly Dictionary<string, List<ScheduledNotification>> _groups = new();
    private readonly Action<ScheduledNotification> _show;
    private readonly Timer _timer = new();
    private readonly SynchronizationContext _ui;

    public NotificationScheduler(Action<ScheduledNotification> show)
    {
        _show = show;
        _ui = SynchronizationContext.Current ?? new SynchronizationContext();
        _timer.Tick += (_, _) => Check();
        SystemEvents.PowerModeChanged += OnPowerModeChanged;
    }

    /// <summary>Replaces everything scheduled for <paramref name="group"/>.</summary>
    public void Replace(string group, IEnumerable<ScheduledNotification> items)
    {
        _groups[group] = items.OrderBy(item => item.At).ToList();
        Log.Write($"scheduled {group}: {_groups[group].Count}, next {_groups[group].FirstOrDefault()?.At:yyyy-MM-dd HH:mm}");
        Check();
    }

    private void Check()
    {
        var now = DateTimeOffset.Now;
        foreach (var items in _groups.Values)
        {
            var due = items.Where(item => item.At <= now).ToList();
            foreach (var item in due)
            {
                items.Remove(item);
                if (now - item.At <= Grace)
                {
                    _show(item);
                }
            }
        }

        var next = _groups.Values.SelectMany(items => items).Select(item => (DateTimeOffset?)item.At).Min();
        _timer.Stop();
        if (next is { } at)
        {
            var wait = at - now;
            if (wait < TimeSpan.FromMilliseconds(200)) wait = TimeSpan.FromMilliseconds(200);
            if (wait > MaxWait) wait = MaxWait;
            _timer.Interval = (int)wait.TotalMilliseconds;
            _timer.Start();
        }
    }

    private void OnPowerModeChanged(object? sender, PowerModeChangedEventArgs e)
    {
        // Raised on a system thread; the timer and lists belong to the UI thread.
        if (e.Mode == PowerModes.Resume) _ui.Post(_ => Check(), null);
    }

    public void Dispose()
    {
        SystemEvents.PowerModeChanged -= OnPowerModeChanged;
        _timer.Dispose();
    }
}
