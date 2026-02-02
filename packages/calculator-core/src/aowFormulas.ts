/**
 * Pure AoW Formula Functions
 *
 * This module contains pure, stateless calculation functions extracted from
 * aowCalculator.ts. Each function implements a specific formula step that
 * corresponds to columns in the AowCalcData spreadsheet.
 *
 * These functions are designed to be:
 * 1. Pure - no side effects, same inputs always produce same outputs
 * 2. Testable - can be unit tested in isolation
 * 3. Composable - can be combined to build the full damage calculation
 *
 */

import type { CurveDefinition, PlayerStats, DamageTypeResult } from './types.js';
import type { AowStatPointBonus } from './aowTypes.js';
import { calculateCurveValue } from './calculator.js';

// ============================================================================
// PWU (Percent Weapon Upgrade) Functions
// ============================================================================

/**
 * Compute PWU (Percent Weapon Upgrade)
 *
 * PWU = upgradeLevel / maxUpgradeLevel
 *
 * @param upgradeLevel - Current weapon upgrade level (0-25)
 * @param maxUpgradeLevel - Maximum upgrade level for the weapon (e.g., 25 for somber, 10 for regular)
 * @returns PWU value between 0 and 1
 */
export function computePwu(upgradeLevel: number, maxUpgradeLevel: number): number {
  return maxUpgradeLevel > 0 ? upgradeLevel / maxUpgradeLevel : 0;
}

/**
 * Compute PWU multiplier for bullet damage
 *
 * The PWU multiplier scales flat bullet damage based on upgrade level.
 * Formula: 1 + 3 × PWU
 * - At level 0: 1.0
 * - At max level: 4.0
 *
 * @param upgradeLevel - Current weapon upgrade level
 * @param maxUpgradeLevel - Maximum upgrade level for the weapon
 * @returns PWU multiplier between 1.0 and 4.0
 */
export function computePwuMultiplier(upgradeLevel: number, maxUpgradeLevel: number): number {
  const pwu = computePwu(upgradeLevel, maxUpgradeLevel);
  return 1 + 3 * pwu;
}

// ============================================================================
// Stat Saturation Functions
// ============================================================================

/**
 * Compute stat saturation from curve
 *
 * Saturation represents how much of the scaling a stat provides at a given level.
 * The curve defines diminishing returns at different stat breakpoints.
 *
 * @param curve - CalcCorrectGraph curve definition
 * @param statLevel - Stat level (1-99)
 * @returns Saturation as decimal (0-1 range, though can exceed 1 for some curves)
 */
export function computeStatSaturation(
  curve: CurveDefinition | undefined,
  statLevel: number
): number {
  if (!curve) return 0;
  return calculateCurveValue(curve, statLevel) / 100;
}

/**
 * Get stat saturation from curves lookup
 *
 * @param curves - Map of curve ID to curve definition
 * @param curveId - ID of the curve to use
 * @param statLevel - Stat level (1-99)
 * @returns Saturation as decimal (0-1 range)
 */
export function getStatSaturationFromCurves(
  curves: Record<number, CurveDefinition>,
  curveId: number,
  statLevel: number
): number {
  return computeStatSaturation(curves[curveId], statLevel);
}

// ============================================================================
// Scaling Rate Functions
// ============================================================================

/**
 * Compute scaling contribution for a single stat
 *
 * This implements the scaling rate calculation from the spreadsheet.
 * The formula is: (scalingPercent / 100) × saturation
 *
 * For bullets with AttackElementCorrect overrides:
 * - scalingPercent = overwriteValue × reinforceRate
 *
 * For weapon scaling (no override):
 * - scalingPercent comes directly from weapon data
 *
 * @param scalingPercent - Scaling value as percentage (e.g., 25 = 25%)
 * @param saturation - Stat saturation from curve (0-1 decimal)
 * @returns Scaling contribution as decimal
 */
export function computeScalingContribution(
  scalingPercent: number,
  saturation: number
): number {
  return (scalingPercent / 100) * saturation;
}

/**
 * Compute scaling value with reinforce rate applied
 *
 * For bullet attacks, the base scaling (overwrite value) is multiplied
 * by the weapon's reinforce rate at the current upgrade level.
 *
 * @param overwriteValue - Base scaling from AttackElementCorrect (e.g., 25)
 * @param reinforceRate - Rate multiplier from ReinforceParamWeapon (e.g., 1.5 at max level)
 * @returns Effective scaling value
 */
export function computeScalingWithReinforce(
  overwriteValue: number,
  reinforceRate: number
): number {
  return overwriteValue * reinforceRate;
}

// ============================================================================
// Bullet Damage Functions
// ============================================================================

/**
 * Compute bullet damage (flat damage × PWU multiplier × scaling)
 *
 * Formula: flatDamage × pwuMultiplier × (1 + totalScaling)
 *
 * This is the core bullet damage formula used for spell/projectile attacks.
 *
 * @param flatDamage - Base flat damage from bullet/spell param
 * @param pwuMultiplier - PWU multiplier (1.0 to 4.0)
 * @param totalScaling - Total stat scaling contribution (decimal)
 * @returns Computed bullet damage
 */
export function computeBulletDamage(
  flatDamage: number,
  pwuMultiplier: number,
  totalScaling: number
): number {
  if (flatDamage === 0) return 0;
  return flatDamage * pwuMultiplier * (1 + totalScaling);
}

/**
 * Compute bullet damage without scaling (no AttackElementCorrect)
 *
 * When no AttackElementCorrect override is provided, bullet damage
 * is just flat damage × PWU multiplier.
 *
 * @param flatDamage - Base flat damage from bullet/spell param
 * @param pwuMultiplier - PWU multiplier (1.0 to 4.0)
 * @returns Computed bullet damage
 */
export function computeBulletDamageNoScaling(
  flatDamage: number,
  pwuMultiplier: number
): number {
  if (flatDamage === 0) return 0;
  return flatDamage * pwuMultiplier;
}

// ============================================================================
// Motion Damage Functions
// ============================================================================

/**
 * Compute motion-based damage
 *
 * Formula: weaponTotal × motionValue
 *
 * Motion attacks use the weapon's total AR and apply a motion value multiplier.
 * The weapon AR already includes any requirement penalty.
 *
 * @param weaponTotal - Weapon's total AR for this damage type
 * @param motionValue - Motion value multiplier (typically 0.1-3.0)
 * @returns Computed motion damage
 */
export function computeMotionDamage(
  weaponTotal: number,
  motionValue: number
): number {
  if (motionValue === 0) return 0;
  return weaponTotal * motionValue;
}

// ============================================================================
// Stat Point Bonus Functions
// ============================================================================

/**
 * Compute stat point bonus AR
 *
 * Some AoWs (War Cry, Barbaric Roar, Shriek of Milos) add a temporary
 * stat bonus that increases AR. The bonus is calculated as:
 *   bonusAR = base × saturation × (bonusPoints / 100)
 *
 * @param base - Base damage for this damage type
 * @param saturation - Stat saturation for the relevant stat
 * @param bonusPoints - Bonus points (e.g., 5 for +5 STR)
 * @returns Bonus AR to add
 */
export function computeStatPointBonus(
  base: number,
  saturation: number,
  bonusPoints: number
): number {
  if (base === 0 || saturation === 0 || bonusPoints === 0) return 0;
  return base * saturation * (bonusPoints / 100);
}

/**
 * Compute total stat point bonus AR for a damage type
 *
 * Sums bonus AR from all stats that have bonuses.
 *
 * @param damageType - Damage type result with base and perStat saturation
 * @param statBonus - Stat point bonuses for this AoW
 * @returns Total bonus AR to add
 */
export function computeTotalStatPointBonus(
  damageType: DamageTypeResult,
  statBonus: AowStatPointBonus | undefined
): number {
  if (!statBonus) return 0;
  if (damageType.base === 0) return 0;

  let bonusAR = 0;

  // STR bonus
  if (statBonus.strength > 0 && damageType.perStat.strength.saturation > 0) {
    bonusAR += computeStatPointBonus(
      damageType.base,
      damageType.perStat.strength.saturation,
      statBonus.strength
    );
  }

  // DEX bonus
  if (statBonus.dexterity > 0 && damageType.perStat.dexterity.saturation > 0) {
    bonusAR += computeStatPointBonus(
      damageType.base,
      damageType.perStat.dexterity.saturation,
      statBonus.dexterity
    );
  }

  // INT bonus
  if (statBonus.intelligence > 0 && damageType.perStat.intelligence.saturation > 0) {
    bonusAR += computeStatPointBonus(
      damageType.base,
      damageType.perStat.intelligence.saturation,
      statBonus.intelligence
    );
  }

  // FTH bonus
  if (statBonus.faith > 0 && damageType.perStat.faith.saturation > 0) {
    bonusAR += computeStatPointBonus(
      damageType.base,
      damageType.perStat.faith.saturation,
      statBonus.faith
    );
  }

  // ARC bonus
  if (statBonus.arcane > 0 && damageType.perStat.arcane.saturation > 0) {
    bonusAR += computeStatPointBonus(
      damageType.base,
      damageType.perStat.arcane.saturation,
      statBonus.arcane
    );
  }

  return bonusAR;
}

// ============================================================================
// Effective Stats Functions
// ============================================================================

// Maximum effective attribute value in Elden Ring
const MAX_EFFECTIVE_STAT = 148;

// Weapon type constants (wepType from EquipParamWeapon)
const FIST_WEP_TYPE = 35;
const LIGHT_BOW_WEP_TYPE = 50;
const BOW_WEP_TYPE = 51;
const GREATBOW_WEP_TYPE = 53;
const BALLISTA_WEP_TYPE = 56;

/**
 * Check if weapon is a ranged weapon that is always two-handed
 */
export function isAlwaysTwoHanded(wepType: number): boolean {
  return (
    wepType === LIGHT_BOW_WEP_TYPE ||
    wepType === BOW_WEP_TYPE ||
    wepType === GREATBOW_WEP_TYPE ||
    wepType === BALLISTA_WEP_TYPE
  );
}

/**
 * Compute effective strength with 2H bonus
 *
 * Two-handing provides 1.5× strength (floored, capped at 148), except for:
 * - Fist weapons (wepType 35)
 * - Paired/dual weapons (isDualBlade)
 *
 * Bows and ballistae are always two-handed and always get the bonus.
 *
 * @param strength - Base strength stat
 * @param twoHanding - Whether weapon is two-handed
 * @param wepType - Weapon type ID (wepType from EquipParamWeapon)
 * @param isDualBlade - Whether weapon is a paired weapon
 * @returns Effective strength value (capped at 148)
 */
export function computeEffectiveStrength(
  strength: number,
  twoHanding: boolean,
  wepType: number,
  isDualBlade: boolean
): number {
  // Determine if 2H bonus should apply
  let applyTwoHandingBonus = twoHanding;

  // Paired weapons do not get the two handing bonus
  if (isDualBlade) {
    applyTwoHandingBonus = false;
  }

  // Fist weapons don't get 2H bonus
  if (wepType === FIST_WEP_TYPE) {
    applyTwoHandingBonus = false;
  }

  // Bows and ballistae are always two-handed
  if (isAlwaysTwoHanded(wepType)) {
    applyTwoHandingBonus = true;
  }

  if (!applyTwoHandingBonus) {
    return strength;
  }

  // 2-handing gives 1.5x strength, capped at 148
  return Math.min(Math.floor(strength * 1.5), MAX_EFFECTIVE_STAT);
}

/**
 * Compute effective stats with 2H bonus applied
 *
 * @param stats - Base player stats
 * @param twoHanding - Whether weapon is two-handed
 * @param wepType - Weapon type ID (wepType from EquipParamWeapon)
 * @param isDualBlade - Whether weapon is a paired weapon
 * @returns Stats with effective strength
 */
export function computeEffectiveStats(
  stats: PlayerStats,
  twoHanding: boolean,
  wepType: number,
  isDualBlade: boolean
): PlayerStats {
  return {
    ...stats,
    strength: computeEffectiveStrength(
      stats.strength,
      twoHanding,
      wepType,
      isDualBlade
    ),
  };
}

// ============================================================================
// Shield/Guard Functions
// ============================================================================

/**
 * Compute shield chip damage multiplier
 *
 * Some AoW attacks can pierce through shields (chip damage).
 * Formula: 1 - (1 + guardCutCancelRate / 100)
 *
 * A positive guardCutCancelRate reduces chip, negative increases it.
 *
 * @param guardCutCancelRate - Guard cut cancel rate from attack params
 * @returns Shield chip multiplier (0 = no chip, higher = more chip)
 */
export function computeShieldChip(guardCutCancelRate: number): number {
  if (guardCutCancelRate === 0) return 0;
  return 1 - (1 + guardCutCancelRate / 100);
}

// ============================================================================
// Stamina/Poise Functions
// ============================================================================

/**
 * Compute stamina damage
 *
 * Formula: weaponStam × weaponStamRate × motionStam + flatStam
 *
 * @param weaponBaseStam - Weapon's base stamina damage
 * @param weaponStamRate - Stamina rate multiplier from reinforce params
 * @param motionStam - Motion value for stamina
 * @param flatStam - Flat stamina damage from attack params
 * @returns Total stamina damage
 */
export function computeStaminaDamage(
  weaponBaseStam: number,
  weaponStamRate: number,
  motionStam: number,
  flatStam: number
): number {
  return weaponBaseStam * weaponStamRate * motionStam + flatStam;
}

/**
 * Compute poise damage
 *
 * Formula: weaponPoise × weaponPoiseRate × motionPoise + flatPoise
 *
 * @param weaponBasePoise - Weapon's base poise damage
 * @param weaponPoiseRate - Poise rate multiplier from reinforce params
 * @param motionPoise - Motion value for poise
 * @param flatPoise - Flat poise damage from attack params
 * @returns Total poise damage
 */
export function computePoiseDamage(
  weaponBasePoise: number,
  weaponPoiseRate: number,
  motionPoise: number,
  flatPoise: number
): number {
  return weaponBasePoise * weaponPoiseRate * motionPoise + flatPoise;
}

// ============================================================================
// Rounding Functions
// ============================================================================

/**
 * Round to 3 decimal places (matches spreadsheet precision)
 *
 * @param value - Value to round
 * @returns Rounded value
 */
export function roundTo3Decimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Round to 2 decimal places
 *
 * @param value - Value to round
 * @returns Rounded value
 */
export function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round to 4 decimal places
 *
 * @param value - Value to round
 * @returns Rounded value
 */
export function roundTo4Decimals(value: number): number {
  return Math.round(value * 10000) / 10000;
}
