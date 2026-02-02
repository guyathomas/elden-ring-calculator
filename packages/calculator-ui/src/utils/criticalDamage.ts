/**
 * Critical damage calculation utilities for Elden Ring weapons
 */

/**
 * Critical damage multiplier by weapon category (wepType)
 * Based on community research and game data
 * Note: Some weapon types cannot perform critical attacks (returns null)
 */
export const CRITICAL_MULTIPLIERS: Record<number, number | null> = {
  1: 4.0,    // Dagger
  3: 3.0,    // Straight Sword
  5: 2.5,    // Greatsword
  7: 2.5,    // Colossal Sword
  9: 3.0,    // Curved Sword
  11: 2.5,   // Curved Greatsword
  13: 3.0,   // Katana
  14: 3.0,   // Twinblade
  15: 3.3,   // Thrusting Sword
  16: 2.4,   // Heavy Thrusting Sword
  17: 3.25,  // Axe
  19: 2.5,   // Greataxe
  21: 3.25,  // Hammer
  23: 2.5,   // Great Hammer
  24: 3.25,  // Flail
  25: 2.8,   // Spear
  28: 2.4,   // Great Spear
  29: 2.8,   // Halberd
  31: 2.4,   // Reaper
  35: 3.5,   // Fist
  37: 3.5,   // Claw
  39: null,  // Whip - cannot crit
  41: 2.5,   // Colossal Weapon
  50: null,  // Light Bow - cannot crit
  51: null,  // Bow - cannot crit
  53: null,  // Greatbow - cannot crit
  55: null,  // Crossbow - cannot crit
  56: null,  // Ballista - cannot crit
  57: null,  // Glintstone Staff - cannot crit
  61: null,  // Sacred Seal - cannot crit
  65: 3.0,   // Small Shield
  67: 3.0,   // Medium Shield
  69: 3.0,   // Greatshield
  87: 3.0,   // Torch
  88: 3.5,   // Hand-to-Hand Arts
  89: 3.0,   // Perfume Bottle
  90: 3.0,   // Thrusting Shield
  91: 3.0,   // Throwing Blade
  92: 4.0,   // Backhand Blade (similar to daggers)
  93: 2.5,   // Light Greatsword
  94: 3.0,   // Great Katana
  95: 3.5,   // Beast Claw
};

/**
 * Calculate critical damage for a weapon
 * Formula: total AR × (critValue / 100) × critMultiplier
 *
 * @param totalAR - Total attack rating of the weapon
 * @param category - Weapon type (wepType from game data)
 * @param critValue - Critical value from weapon data (100 = base, 130 = +30% crit damage)
 * @returns Calculated critical damage, or null if weapon cannot perform critical attacks
 *
 * @example
 * // Dagger with 200 AR and 130 crit value
 * calculateCriticalDamage(200, 1, 130) // Returns 1040 (200 × 1.3 × 4.0)
 *
 * @example
 * // Rapier with 200 AR and 130 crit value
 * calculateCriticalDamage(200, 15, 130) // Returns 858 (200 × 1.3 × 3.3)
 *
 * @example
 * // Bow cannot perform critical attacks
 * calculateCriticalDamage(200, 51, 100) // Returns null
 */
export function calculateCriticalDamage(
  totalAR: number,
  category: number,
  critValue: number
): number | null {
  const critMultiplier = CRITICAL_MULTIPLIERS[category];
  if (critMultiplier === null || critMultiplier === undefined) {
    return null; // Weapon cannot perform critical attacks
  }
  return Math.round(totalAR * (critValue / 100) * critMultiplier);
}

/**
 * Check if a weapon category can perform critical attacks
 *
 * @param category - Weapon type (wepType from game data)
 * @returns true if weapon can perform backstabs/ripostes, false otherwise
 */
export function canPerformCriticalAttack(category: number): boolean {
  const multiplier = CRITICAL_MULTIPLIERS[category];
  return multiplier !== null && multiplier !== undefined;
}

/**
 * Get the critical multiplier for a weapon category
 *
 * @param category - Weapon type (wepType from game data)
 * @returns The critical multiplier, or null if weapon cannot crit
 */
export function getCriticalMultiplier(category: number): number | null {
  return CRITICAL_MULTIPLIERS[category] ?? null;
}
