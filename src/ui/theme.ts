// Dark palette; chart colors are a validated categorical/sequential set.
export const colors = {
  page: '#0d0d0d',
  surface: '#1a1a19',
  surfaceRaised: '#232321',
  primaryInk: '#ffffff',
  secondaryInk: '#c3c2b7',
  mutedInk: '#898781',
  gridline: '#2c2c2a',
  baseline: '#383835',
  border: 'rgba(255,255,255,0.1)',
  accent: '#3987e5',
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

export const CATEGORICAL = [
  '#3987e5', // blue
  '#199e70', // aqua
  '#c98500', // yellow
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
  '#d55181', // magenta
  '#d95926', // orange
] as const;

export const SEQUENTIAL_BLUE = [
  '#243142',
  '#284262',
  '#295489',
  '#2764b0',
  '#2372d1',
  '#2d7ee1',
  '#3987e5',
] as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 4, md: 8, lg: 12, pill: 999 } as const;

/** '#rrggbb' + alpha (0-1) → 'rgba(...)'. */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
