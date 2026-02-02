/**
 * Enemy damage calculation utilities
 *
 * Implements the full damage calculation flow for Elden Ring:
 * Phase 1: Total Attack Power = (Base AR + Scaling) × Motion Value
 * Phase 2: Defense Calculation (step function)
 * Phase 3: Negation Calculation
 */

import type { EnemyDefenseData, DamageType, PhysicalDamageType } from './enemyTypes.js';

/**
 * Phase 2: Defense Calculation Step Function
 *
 * Calculates damage after defense based on ATK/DEF ratio.
 * Uses a piecewise function with 5 tiers.
 *
 * @param atk - Attack power (after motion value)
 * @param def - Enemy defense value
 * @returns Damage received after defense
 */
export function calculateDefenseReduction(atk: number, def: number): number {
  // Handle edge cases
  if (atk <= 0) return 0;
  if (def <= 0) return atk * 0.9; // Cap tier if no defense

  const ratio = atk / def;

  // Tier 5: The "Cap" Tier - DEF < 0.125 × ATK (ratio > 8)
  if (def < 0.125 * atk) {
    return 0.90 * atk;
  }

  // Tier 4: High Damage Tier - DEF > 0.125 × ATK AND DEF ≤ 0.4 × ATK
  // (0.125 * ATK ≤ DEF ≤ 0.4 * ATK means 2.5 ≤ ratio ≤ 8)
  if (def <= 0.4 * atk) {
    // Formula: ((-0.8/121) × (ATK/DEF - 8)² + 0.9) × ATK
    const term = ratio - 8;
    return ((-0.8 / 121) * term * term + 0.9) * atk;
  }

  // Tier 3: Standard Tier - DEF > 0.4 × ATK AND DEF ≤ ATK
  // (0.4 * ATK < DEF ≤ ATK means 1 ≤ ratio ≤ 2.5)
  if (def <= atk) {
    // Formula: ((-0.4/3) × (ATK/DEF - 2.5)² + 0.7) × ATK
    const term = ratio - 2.5;
    return ((-0.4 / 3) * term * term + 0.7) * atk;
  }

  // Tier 2: High Defense Tier - DEF > ATK AND DEF ≤ 8 × ATK
  // (ATK < DEF ≤ 8 * ATK means 0.125 ≤ ratio < 1)
  if (def <= 8 * atk) {
    // Formula: ((19.2/49) × (ATK/DEF - 0.125)² + 0.1) × ATK
    const term = ratio - 0.125;
    return ((19.2 / 49) * term * term + 0.1) * atk;
  }

  // Tier 1: The "Wall" Tier - DEF > 8 × ATK (ratio < 0.125)
  // Formula: 0.10 × ATK
  return 0.10 * atk;
}

/**
 * Phase 3: Negation Calculation
 *
 * Applies percentage-based damage reduction after defense.
 *
 * @param damageAfterDefense - Damage after defense calculation
 * @param negation - Negation percentage (can be negative for vulnerability)
 * @returns Final damage
 */
export function applyNegation(damageAfterDefense: number, negation: number): number {
  // Negation is a percentage reduction (can be negative = vulnerability)
  // Formula: Damage × (1 - Negation/100)
  return damageAfterDefense * (1 - negation / 100);
}

/**
 * Calculate damage for a single damage type
 *
 * @param baseDamage - Base AR for this damage type
 * @param motionValue - Motion value as percentage (100 = 100%)
 * @param defense - Defense value for this damage type
 * @param negation - Negation percentage for this damage type
 * @returns Calculated damage for this damage type
 */
export function calculateSingleTypeDamage(
  baseDamage: number,
  motionValue: number,
  defense: number,
  negation: number
): number {
  if (baseDamage <= 0) return 0;

  // Phase 1: Apply motion value
  const totalAttack = baseDamage * (motionValue / 100);

  // Phase 2: Defense calculation
  const damageAfterDefense = calculateDefenseReduction(totalAttack, defense);

  // Phase 3: Apply negation
  const finalDamage = applyNegation(damageAfterDefense, negation);

  return Math.max(0, finalDamage);
}

/**
 * Physical damage type mapping from weapon attack attribute to defense type
 */
export function getPhysicalDefenseType(attackAttribute: string): PhysicalDamageType {
  switch (attackAttribute.toLowerCase()) {
    case 'strike':
      return 'strike';
    case 'slash':
      return 'slash';
    case 'pierce':
      return 'pierce';
    case 'standard':
    default:
      return 'physical';
  }
}

/**
 * Damage breakdown result for a single attack
 */
export interface DamageBreakdownResult {
  /** Damage by type before totaling */
  byType: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  };
  /** Total damage (sum of all types) */
  total: number;
  /** Total damage rounded to integer */
  rounded: number;
}

/**
 * Input for calculating full damage with all types
 */
export interface DamageCalculationInput {
  /** Base AR values by damage type */
  baseAR: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  };
  /** Motion values by damage type (percentages) */
  motionValues: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  };
  /** Physical attack attribute for defense type selection */
  attackAttribute: string;
  /** Enemy defense data */
  enemyDefenses: EnemyDefenseData;
}

/**
 * Calculate full damage against an enemy
 *
 * This handles the complete damage calculation for all damage types.
 * Physical damage uses the attack attribute to determine which defense type to use.
 *
 * @param input - Damage calculation input
 * @returns Damage breakdown with per-type and total damage
 */
export function calculateEnemyDamage(input: DamageCalculationInput): DamageBreakdownResult {
  const { baseAR, motionValues, attackAttribute, enemyDefenses } = input;

  // Determine which physical defense type to use
  const physDefenseType = getPhysicalDefenseType(attackAttribute);

  // Calculate damage for each type
  const physicalDamage = calculateSingleTypeDamage(
    baseAR.physical,
    motionValues.physical,
    enemyDefenses.defense[physDefenseType],
    enemyDefenses.negation[physDefenseType]
  );

  const magicDamage = calculateSingleTypeDamage(
    baseAR.magic,
    motionValues.magic,
    enemyDefenses.defense.magic,
    enemyDefenses.negation.magic
  );

  const fireDamage = calculateSingleTypeDamage(
    baseAR.fire,
    motionValues.fire,
    enemyDefenses.defense.fire,
    enemyDefenses.negation.fire
  );

  const lightningDamage = calculateSingleTypeDamage(
    baseAR.lightning,
    motionValues.lightning,
    enemyDefenses.defense.lightning,
    enemyDefenses.negation.lightning
  );

  const holyDamage = calculateSingleTypeDamage(
    baseAR.holy,
    motionValues.holy,
    enemyDefenses.defense.holy,
    enemyDefenses.negation.holy
  );

  const total = physicalDamage + magicDamage + fireDamage + lightningDamage + holyDamage;

  return {
    byType: {
      physical: physicalDamage,
      magic: magicDamage,
      fire: fireDamage,
      lightning: lightningDamage,
      holy: holyDamage,
    },
    total,
    rounded: Math.ceil(total),  // Game rounds UP for displayed damage
  };
}

/**
 * Calculate damage with a simple MV=100 and default damage type
 * Useful for weapon table column display
 *
 * @param totalAR - Total attack rating (sum of all damage types)
 * @param baseARs - Base AR values by damage type
 * @param attackAttribute - Physical attack attribute
 * @param enemyDefenses - Enemy defense data
 * @returns Total damage rounded
 */
export function calculateSimpleEnemyDamage(
  baseARs: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  },
  attackAttribute: string,
  enemyDefenses: EnemyDefenseData
): number {
  const result = calculateEnemyDamage({
    baseAR: baseARs,
    motionValues: {
      physical: 100,
      magic: 100,
      fire: 100,
      lightning: 100,
      holy: 100,
    },
    attackAttribute,
    enemyDefenses,
  });

  return result.rounded;
}
