/**
 * Equip Load and Endurance Utility Functions
 *
 * This module provides functions for calculating endurance requirements
 * based on equip load and roll type in Elden Ring.
 *
 * Roll Types:
 * - Light Load: < 30% equip load ratio (fast roll)
 * - Medium Load: 30-70% equip load ratio (medium roll)
 * - Heavy Load: 70-100% equip load ratio (fat roll)
 * - Overloaded: > 100% equip load ratio (cannot roll)
 */

// ============================================================================
// Roll Types
// ============================================================================

export type RollType = 'light' | 'medium' | 'heavy';

/**
 * Roll type thresholds as percentage of max equip load
 * To achieve a roll type, your equip load must be at most (threshold * maxLoad)
 */
export const ROLL_TYPE_THRESHOLDS: Record<RollType, number> = {
  light: 0.3,   // < 30% for light roll
  medium: 0.7,  // < 70% for medium roll
  heavy: 1.0,   // < 100% for heavy roll
};

/**
 * Human-readable labels for roll types
 */
export const ROLL_TYPE_LABELS: Record<RollType, string> = {
  light: 'Light Load',
  medium: 'Medium Load',
  heavy: 'Heavy Load',
};

// ============================================================================
// Endurance to Equip Load Lookup Table
// ============================================================================

/**
 * Maximum equip load for each endurance level (1-99)
 * Index 0 = endurance 1, index 98 = endurance 99
 *
 * These values are derived from the in-game CalcCorrectGraph curve
 * used for equip load calculation.
 */
export const ENDURANCE_TO_EQUIP_LOAD: number[] = [
  // END 1-10
  45.0, 45.0, 45.0, 45.0, 45.0, 45.0, 45.0, 46.6, 48.2, 49.8,
  // END 11-20
  51.4, 52.9, 54.5, 56.1, 57.7, 59.3, 60.9, 62.5, 64.1, 65.6,
  // END 21-30
  67.2, 68.8, 70.4, 72.0, 73.0, 74.1, 75.2, 76.4, 77.6, 78.9,
  // END 31-40
  80.2, 81.5, 82.8, 84.1, 85.4, 86.8, 88.1, 89.5, 90.9, 92.3,
  // END 41-50
  93.7, 95.1, 96.5, 97.9, 99.4, 100.8, 102.2, 103.7, 105.2, 106.6,
  // END 51-60
  108.1, 109.6, 111.0, 112.5, 114.0, 115.5, 117.0, 118.5, 120.0, 121.0,
  // END 61-70
  122.1, 123.1, 124.1, 125.1, 126.2, 127.2, 128.2, 129.2, 130.3, 131.3,
  // END 71-80
  132.3, 133.3, 134.4, 135.4, 136.4, 137.4, 138.5, 139.5, 140.5, 141.5,
  // END 81-90
  142.6, 143.6, 144.6, 145.6, 146.7, 147.7, 148.7, 149.7, 150.8, 151.8,
  // END 91-99
  152.8, 153.8, 154.9, 155.9, 156.9, 157.9, 159.0, 160.0, 161.0,
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the maximum equip load for a given endurance level
 *
 * @param endurance - Endurance stat (1-99)
 * @returns Maximum equip load for that endurance level
 */
export function getMaxEquipLoad(endurance: number): number {
  const clampedEnd = Math.max(1, Math.min(99, Math.floor(endurance)));
  return ENDURANCE_TO_EQUIP_LOAD[clampedEnd - 1];
}

/**
 * Get the maximum weight you can carry while maintaining a specific roll type
 *
 * @param endurance - Endurance stat (1-99)
 * @param rollType - Desired roll type
 * @returns Maximum total weight to maintain that roll type
 */
export function getMaxWeightForRollType(endurance: number, rollType: RollType): number {
  const maxEquipLoad = getMaxEquipLoad(endurance);
  const threshold = ROLL_TYPE_THRESHOLDS[rollType];
  return maxEquipLoad * threshold;
}

/**
 * Calculate the minimum endurance required to carry a given weight
 * while maintaining a specific roll type
 *
 * @param weight - Total weight to carry
 * @param rollType - Desired roll type
 * @returns Minimum endurance required (1-99), or 100 if impossible
 */
export function getEnduranceForWeight(weight: number, rollType: RollType): number {
  if (weight <= 0) return 1;

  const threshold = ROLL_TYPE_THRESHOLDS[rollType];
  const requiredMaxEquipLoad = weight / threshold;

  // Find the first endurance level that provides enough equip load
  for (let end = 1; end <= 99; end++) {
    if (ENDURANCE_TO_EQUIP_LOAD[end - 1] >= requiredMaxEquipLoad) {
      return end;
    }
  }

  // Weight exceeds what's possible at 99 endurance
  return 100;
}

/**
 * Calculate the incremental endurance cost of adding weapon weight
 *
 * This is used when the "Subtract Weapon Weight" toggle is enabled in the solver.
 * It calculates how many additional endurance points are needed to carry
 * a weapon while maintaining the desired roll type.
 *
 * @param armorWeight - Weight of armor (excluding weapon)
 * @param weaponWeight - Weight of the weapon
 * @param rollType - Desired roll type
 * @returns Object containing incremental endurance and total endurance with weapon
 */
export function getIncrementalEndurance(
  armorWeight: number,
  weaponWeight: number,
  rollType: RollType
): { incrementalEndurance: number; enduranceWithWeapon: number; enduranceWithoutWeapon: number } {
  const enduranceWithoutWeapon = getEnduranceForWeight(armorWeight, rollType);
  const enduranceWithWeapon = getEnduranceForWeight(armorWeight + weaponWeight, rollType);
  const incrementalEndurance = Math.max(0, enduranceWithWeapon - enduranceWithoutWeapon);

  return {
    incrementalEndurance,
    enduranceWithWeapon,
    enduranceWithoutWeapon,
  };
}

/**
 * Determine the roll type based on current equip load and endurance
 *
 * @param currentWeight - Current total equip load
 * @param endurance - Endurance stat
 * @returns Current roll type, or 'overloaded' if over 100%
 */
export function getCurrentRollType(
  currentWeight: number,
  endurance: number
): RollType | 'overloaded' {
  const maxEquipLoad = getMaxEquipLoad(endurance);
  const ratio = currentWeight / maxEquipLoad;

  if (ratio <= ROLL_TYPE_THRESHOLDS.light) return 'light';
  if (ratio <= ROLL_TYPE_THRESHOLDS.medium) return 'medium';
  if (ratio <= ROLL_TYPE_THRESHOLDS.heavy) return 'heavy';
  return 'overloaded';
}

/**
 * Calculate the equip load ratio (percentage)
 *
 * @param currentWeight - Current total equip load
 * @param endurance - Endurance stat
 * @returns Equip load ratio as a percentage (0-100+)
 */
export function getEquipLoadRatio(currentWeight: number, endurance: number): number {
  const maxEquipLoad = getMaxEquipLoad(endurance);
  return (currentWeight / maxEquipLoad) * 100;
}
