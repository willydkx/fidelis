/**
 * Opens the browser's own time picker (used by the desktop app); calls `onPicked` with
 * "HH:MM" if the user picks a time. Must run inside a click handler.
 */
export function pickTime(initial: string, onPicked: (time: string) => void) {
  const input = document.createElement('input');
  input.type = 'time';
  input.value = initial;
  // Invisible, but placed in the page so the picker has something to anchor to.
  Object.assign(input.style, { position: 'fixed', top: '50%', left: '50%', opacity: '0', pointerEvents: 'none' });
  document.body.appendChild(input);
  const cleanup = () => input.remove();
  input.addEventListener('change', () => {
    if (input.value) onPicked(input.value.slice(0, 5));
    cleanup();
  });
  input.addEventListener('blur', () => setTimeout(cleanup, 0));
  try {
    input.showPicker();
  } catch {
    input.focus();
  }
}
