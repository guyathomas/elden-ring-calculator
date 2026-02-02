/**
 * Client-only exports (no fs dependency)
 * Use this entry point for browser bundles
 */

// Types
export type {
  CurveDefinition,
  ResolvedWeapon,
  ResolvedWeaponScaling,
  ResolvedDamageType,
  ResolvedStatScaling,
  ResolvedStatusEffect,
  WeaponRequirements,
  PrecomputedData,
  PlayerStats,
  CalculatorOptions,
  StatScalingResult,
  DisplayScaling,
  DamageTypeResult,
  StatusEffectResult,
  SpellScalingResult,
  ARResult,
  // V2 types (nested structure)
  BaseDamageType,
  BaseStatScaling,
  WeaponStatScaling,
  ReinforceRates,
  PrecomputedDataV2,
  WeaponEntry,
  AffinityData,
  // Guard stats types
  BaseGuardStats,
  GuardResistance,
  GuardResult,
} from './types.js';

// V2 Runtime calculator (recommended - nested structure with O(1) lookups)
export {
  calculateARV2,
  resolveWeaponAtLevel,
  getWeaponV2,
  getAffinityDataV2,
  hasWeaponAffinityV2,
  getWeaponNamesV2,
  getWeaponAffinitiesV2,
  getMaxUpgradeLevelV2,
  // Guard stats calculation
  calculateGuardStats,
  calculateGuardStatsV2,
} from './calculator.js';

// Core calculation utilities (used internally by V2)
export {
  calculateAR,
  calculateCurveValue,
  findWeapon,
  getWeaponNames,
  getWeaponAffinities,
  getMaxUpgradeLevel,
  getScalingGrade,
} from './calculator.js';

// AoW types
export type {
  PrecomputedAowData,
  PrecomputedAow,
  PrecomputedAowAttack,
  AowCalculatorInput,
  AowCalculatorResult,
  AowAttackResult,
  EquipParamGemEntry,
  AowStatPointBonus,
} from './aowTypes.js';

// AoW constants
export {
  WEAPON_CLASS_MAP,
  WEAPON_CLASS_NAME_TO_ID,
  ATTACK_ATTRIBUTE_MAP,
} from './aowTypes.js';

// AoW calculator
export {
  calculateAowDamage,
  getAvailableAowNames,
  getAowAttacks,
  canWeaponMountAoW,
  getWeaponSkillName,
  getUniqueSkillNames,
} from './aowCalculator.js';

// Enemy types
export type {
  PhysicalDamageType,
  ElementalDamageType,
  DamageType,
  EnemyDefenseData,
  EnemyData,
  PrecomputedEnemyData,
} from './enemyTypes.js';

// Enemy damage calculator
export {
  calculateDefenseReduction,
  applyNegation,
  calculateSingleTypeDamage,
  getPhysicalDefenseType,
  calculateEnemyDamage,
  calculateSimpleEnemyDamage,
} from './enemyDamageCalculator.js';

export type {
  DamageBreakdownResult,
  DamageCalculationInput,
} from './enemyDamageCalculator.js';

// Data exports
import spEffectNamesData from './data/SpEffectParamNames.json' with { type: "json" };
export const spEffectNames = spEffectNamesData;
