export const DAMAGE_COLORS = {
  physical: '#9a9a9a',
  magic: '#5bc0de',
  fire: '#f0ad4e',
  lightning: '#f4e04d',
  holy: '#d4af37',
} as const;

export const DAMAGE_TYPE_LABELS = {
  total: 'Total AR',
  physical: 'Physical',
  magic: 'Magic',
  fire: 'Fire',
  lightning: 'Lightning',
  holy: 'Holy',
} as const;

export const STAT_COLORS = {
  str: '#f59e0b',
  dex: '#ef4444',
  int: '#3b82f6',
  fai: '#d4af37',
  arc: '#a855f7',
} as const;

export const STAT_KEY_TO_FULL_NAME: Record<string, string> = {
  str: 'strength',
  dex: 'dexterity',
  int: 'intelligence',
  fai: 'faith',
  arc: 'arcane',
};

export type DamageType = keyof typeof DAMAGE_COLORS;
export type StatKey = keyof typeof STAT_COLORS;

