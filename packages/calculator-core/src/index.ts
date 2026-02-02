/**
 * Elden Ring Attack Rating Calculator
 *
 * This package provides game-accurate damage calculation for Elden Ring weapons.
 *
 * Architecture:
 * - Build-time: paramBuilder.ts loads XML files and generates precomputed JSON (V2)
 * - Runtime: calculator.ts uses precomputed data for fast client-side calculation
 */

// ============================================================================
// Types (for client bundle)
// ============================================================================
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
  // Guard stats types
  BaseGuardStats,
  GuardResistance,
  GuardResult,
  // V2 types (nested structure)
  BaseDamageType,
  BaseStatScaling,
  WeaponStatScaling,
  ReinforceRates,
  PrecomputedDataV2,
  WeaponEntry,
  AffinityData,
} from './types.js';

// ============================================================================
// Build-time module (server/build only - has fs dependency)
// ============================================================================
export {
  buildPrecomputedDataV2,
  type BuildOptionsV2,
} from './paramBuilder.js';

// AoW build-time module
export { buildPrecomputedAowData } from './aowParamBuilder.js';

// ============================================================================
// Runtime calculator (client bundle - no fs dependency)
// ============================================================================
export {
  // V2 calculator (nested structure - recommended)
  calculateARV2,
  resolveWeaponAtLevel,
  getWeaponV2,
  getAffinityDataV2,
  hasWeaponAffinityV2,
  getWeaponNamesV2,
  getWeaponAffinitiesV2,
  getMaxUpgradeLevelV2,
  // Core calculation (used internally by V2)
  calculateAR,
  calculateCurveValue,
  findWeapon,
  getWeaponNames,
  getWeaponAffinities,
  getMaxUpgradeLevel,
  // Utility functions
  getScalingGrade,
  // Guard stats calculation
  calculateGuardStats,
  calculateGuardStatsV2,
} from './calculator.js';

// ============================================================================
// Param file parsing utilities (build-time only)
// ============================================================================
export {
  parseParamXml,
  loadParamFile,
  parseCalcCorrectGraph,
  parseReinforceParamWeapon,
  parseEquipParamWeapon,
  parseAttackElementCorrect,
  buildCalcCorrectGraphTable,
  buildCurveIdToIndex,
  calculateCurveValue as calculateCurveValueFromCurve,
  parseTestCasesCsv,
  type ParamRow,
  type ParamFile,
  type CalcCorrectGraphCurve,
  type ReinforceParamWeaponRow,
  type EquipParamWeaponRow,
  type AttackElementCorrectRow,
  type TestCaseRow,
} from './paramParser.js';

// ============================================================================
// Combo calculation (build-time and runtime)
// ============================================================================
export {
  calculateCombosForWeapon,
  countTrueCombos,
  getTrueComboBreakpoints,
  normalizeWeaponName as normalizeWeaponNameCombo,
  getAnimationId,
  ATTACK_TYPE_MAP,
  ATTACK_TYPE_TO_ANIMATION_SUFFIX,
  INVALID_FOLLOWUP_CATEGORIES,
  type AttackTypeInfo,
  type RawAttack,
  type ComboAnimation,
  type ComboData,
} from './comboCalculator.js';

// ============================================================================
// Data exports
// ============================================================================
import spEffectNamesData from './data/SpEffectParamNames.json' with { type: "json" };
export const spEffectNames = spEffectNamesData;
