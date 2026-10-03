/** Settings key for the name asked on first launch. Absent = not onboarded yet; '' = skipped. */
export const USER_NAME_KEY = 'user_name';

export const NAME_PLACEHOLDER = '{nombre}';
export const MAX_NAME_LENGTH = 30;

/** "Buenos días" 6:00–12:59, "Buenas tardes" 13:00–20:59, "Buenas noches" otherwise. */
export function greeting(hour: number, name: string | null): string {
  const salutation = hour >= 6 && hour < 13 ? 'Buenos días' : hour >= 13 && hour < 21 ? 'Buenas tardes' : 'Buenas noches';
  const trimmed = name?.trim();
  return trimmed ? `${salutation}, ${trimmed}` : salutation;
}

/**
 * Replaces {nombre} with the user's name. Without a name the placeholder is dropped along
 * with the comma that went with it, and the sentence is re-capitalized.
 */
export function fillName(template: string, name: string | null): string {
  const trimmed = name?.trim() ?? '';
  const placeholder = /\{nombre\}/gi;
  if (trimmed) {
    return template.replace(placeholder, trimmed).trim();
  }
  const text = template
    .replace(/\s*,?\s*\{nombre\}\s*,?\s*/gi, ' ')
    .replace(/\s+([.!?,])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Capitalize the first letter, skipping leading Spanish opening marks (¡, ¿).
  return text.replace(/^([¡¿]*)(\p{L})/u, (_, marks: string, letter: string) => marks + letter.toUpperCase());
}
