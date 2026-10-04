// Metro turns the .wav into an asset URL.
const alarmAsset = require('../../assets/sounds/pomodoro_alarm.wav');

const VIBRATION = [0, 500, 250, 500, 250, 500];

let audio: HTMLAudioElement | null = null;

function alarmUrl(): string {
  return typeof alarmAsset === 'string' ? alarmAsset : alarmAsset.uri ?? alarmAsset.default;
}

/**
 * Called from the start button: browsers only let a page play sound or ask for notification
 * permission in response to a tap, so both are unlocked here for when the phase ends.
 */
export function prepareAlarm(): void {
  if (!audio) {
    audio = new Audio(alarmUrl());
    audio.preload = 'auto';
    // A silent play/pause inside the tap unlocks later playback on iOS.
    audio.muted = true;
    audio.play().then(
      () => {
        audio?.pause();
        if (audio) audio.muted = false;
      },
      () => audio && (audio.muted = false),
    );
  }
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

export function ringAlarm(body: string, sound: boolean): void {
  if (sound && audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
  navigator.vibrate?.(VIBRATION);
  if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  // Android Chrome only shows notifications through the service worker.
  navigator.serviceWorker?.ready
    .then((registration) => registration.showNotification('Fidelis · Enfoque', { body, icon: 'icon-192.png' }))
    .catch(() => {});
}
