import { useIsFocused } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * Runs `shortcuts[key]` on key presses while this screen is the one shown. Keys are
 * KeyboardEvent.key values, letters in lower case ('n', ' ', 'ArrowLeft'...). Ignored while
 * typing in a field or with Ctrl/Alt held.
 */
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>): void {
  const focused = useIsFocused();
  const latest = useRef(shortcuts);
  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    if (!focused) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const action = latest.current[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focused]);
}
