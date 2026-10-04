/**
 * On Android the phase-end alarm is a scheduled notification (see reminders.ts), so these
 * are no-ops; the web version (phaseAlarm.web.ts) rings from the open page instead.
 */
export function prepareAlarm(): void {}

export function ringAlarm(_body: string, _sound: boolean): void {}
