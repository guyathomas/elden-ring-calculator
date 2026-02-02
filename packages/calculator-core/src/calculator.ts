/**
 * Lightweight runtime AR calculator
 *
 * This module is designed to ship to the client. It:
 * - Takes precomputed weapon data (no XML parsing)
 * - Takes user input (stats, weapon selection, options)
 * - Calculates AR using the curve interpolation formula
 *
 * Dependencies: Only types.ts (no fs, no XML parsing)
 */

import type {
  CurveDefinition,
  ResolvedWeapon,
  ResolvedWeaponScaling,
  ResolvedDamageType,
  ResolvedStatScaling,
  ResolvedSpellScaling,
  ResolvedStatusEffect,
  PrecomputedData,
  PlayerStats,
  CalculatorOptions,
  DamageTypeResult,
  DisplayScaling,
  StatScalingResult,
  StatusEffectResult,
  SpellScalingResult,
  ARResult,
  GuardResult,
  BaseGuardStats,
  GuardResistance,
  // V2 types
  BaseDamageType,
  BaseStatScaling,
  BaseSpellScaling,
  BaseStatusEffect,
  ReinforceRates,
  PrecomputedDataV2,
  WeaponEntry,
  AffinityData,
} from './types.js';

// ============================================================================
// Curve Calculation (same formula as paramParser, but standalone)
// ============================================================================

// Cache for curve calculations
// Maps curveId -> statLevel -> value
// Using a nested Map structure for efficient lookups
const curveCache = new Map<number, Float32Array>();

/**
 * Calculate the correction value for a given stat level using curve definition
 * This implements the piecewise power interpolation used by Elden Ring
 *
 * @param curve - The curve definition (15 numbers)
 * @param statLevel - The player's stat level
 * @returns Correction value (0-100+ range)
 */
export function calculateCurveValue(curve: CurveDefinition, statLevel: number): number {
  const { stageMaxVal, stageMaxGrowVal, adjPt_maxGrowVal } = curve;

  // Find which segment the stat level falls into
  let segmentIndex = 0;
  for (let i = 0; i < 4; i++) {
    if (statLevel > stageMaxVal[i]) {
      segmentIndex = i + 1;
    }
  }
  segmentIndex = Math.min(segmentIndex, 4);

  // Get segment boundaries
  const minStatLevel = segmentIndex === 0 ? 0 : stageMaxVal[segmentIndex - 1];
  const maxStatLevel = stageMaxVal[segmentIndex];
  const minGrowVal = segmentIndex === 0 ? 0 : stageMaxGrowVal[segmentIndex - 1];
  const maxGrowVal = stageMaxGrowVal[segmentIndex];
  const adjPtIndex = segmentIndex === 0 ? 0 : segmentIndex - 1;
  const adjPt = adjPt_maxGrowVal[adjPtIndex];

  // Boundary conditions
  if (statLevel <= minStatLevel) return minGrowVal;
  if (statLevel >= maxStatLevel) return maxGrowVal;

  // Calculate progress through segment (0-1)
  const range = maxStatLevel - minStatLevel;
  const ratio = (statLevel - minStatLevel) / range;

  // Apply adjustment point for curve shape
  let growthVal: number;
  if (adjPt > 0) {
    growthVal = Math.pow(ratio, adjPt);
  } else if (adjPt < 0) {
    growthVal = 1 - Math.pow(1 - ratio, Math.abs(adjPt));
  } else {
    growthVal = 0;
  }

  // Interpolate between min and max growth values
  const growthRange = maxGrowVal - minGrowVal;
  return minGrowVal + growthRange * growthVal;
}

// ============================================================================
// AR Calculator
// ============================================================================

/**
 * Calculate stat saturation (0-1 range) from curve
 */
function getStatSaturation(
  curves: Record<number, CurveDefinition>,
  curveId: number,
  statLevel: number
): number {
  // Check cache first
  let levelCache = curveCache.get(curveId);
  if (!levelCache) {
    levelCache = new Float32Array(151); // 0-150 stat range support
    levelCache.fill(-1); // Initialize with -1 to indicate not calculated
    curveCache.set(curveId, levelCache);
  }

  // Return cached value if available
  if (statLevel >= 0 && statLevel <= 150 && levelCache[statLevel] >= 0) {
    return levelCache[statLevel];
  }

  const curve = curves[curveId];
  if (!curve) return 0;

  const value = calculateCurveValue(curve, statLevel) / 100;

  // Cache the result
  if (statLevel >= 0 && statLevel <= 150) {
    levelCache[statLevel] = value;
  }

  return value;
}

/**
 * Calculate scaling for a single stat on a damage type
 */
function calculateStatScaling(
  curves: Record<number, CurveDefinition>,
  base: number,
  scaling: ResolvedStatScaling | null,
  statLevel: number
): StatScalingResult {
  if (!scaling) {
    return { saturation: 0, scaling: 0, rawScaling: 0 };
  }

  const saturation = getStatSaturation(curves, scaling.curveId, statLevel);
  const scalingValue = base * saturation * (scaling.value / 100);

  return {
    saturation,
    scaling: scalingValue,
    rawScaling: scaling.value, // The raw scaling value (e.g., 36 for D, 100 for A)
  };
}

/**
 * Check if requirements are met for a specific damage type
 * Only checks the stats that actually scale that damage type
 */
function checkDamageTypeRequirementsMet(
  effectiveStats: PlayerStats,
  requirements: {
    strength: number;
    dexterity: number;
    intelligence: number;
    faith: number;
    arcane: number;
  },
  damageType: ResolvedDamageType,
  ignoreRequirements: boolean
): boolean {
  if (ignoreRequirements) return true;

  // Check each stat that affects this damage type
  if (damageType.scaling.strength && effectiveStats.strength < requirements.strength) {
    return false;
  }
  if (damageType.scaling.dexterity && effectiveStats.dexterity < requirements.dexterity) {
    return false;
  }
  if (damageType.scaling.intelligence && effectiveStats.intelligence < requirements.intelligence) {
    return false;
  }
  if (damageType.scaling.faith && effectiveStats.faith < requirements.faith) {
    return false;
  }
  if (damageType.scaling.arcane && effectiveStats.arcane < requirements.arcane) {
    return false;
  }
  return true;
}

/**
 * Calculate damage for a damage type
 * @param displayScalingValues - Optional weapon scaling values for UI display (correctX × rate)
 *                               Pass these to show letter grades even for stats that don't affect this damage type
 */
function calculateDamageType(
  curves: Record<number, CurveDefinition>,
  damageType: ResolvedDamageType | null,
  effectiveStats: PlayerStats,
  requirements: {
    strength: number;
    dexterity: number;
    intelligence: number;
    faith: number;
    arcane: number;
  },
  ignoreRequirements: boolean,
  displayScalingValues?: DisplayScaling
): DamageTypeResult {
  const emptyDisplayScaling: DisplayScaling = {
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    faith: 0,
    arcane: 0,
  };

  const empty: DamageTypeResult = {
    base: 0,
    scaling: 0,
    total: 0,
    rounded: 0,
    perStat: {
      strength: { saturation: 0, scaling: 0, rawScaling: 0 },
      dexterity: { saturation: 0, scaling: 0, rawScaling: 0 },
      intelligence: { saturation: 0, scaling: 0, rawScaling: 0 },
      faith: { saturation: 0, scaling: 0, rawScaling: 0 },
      arcane: { saturation: 0, scaling: 0, rawScaling: 0 },
    },
    displayScaling: displayScalingValues ?? emptyDisplayScaling,
  };

  if (!damageType) return empty;

  const base = damageType.base;

  // Calculate per-stat scaling
  const perStat = {
    strength: calculateStatScaling(
      curves,
      base,
      damageType.scaling.strength,
      effectiveStats.strength
    ),
    dexterity: calculateStatScaling(
      curves,
      base,
      damageType.scaling.dexterity,
      effectiveStats.dexterity
    ),
    intelligence: calculateStatScaling(
      curves,
      base,
      damageType.scaling.intelligence,
      effectiveStats.intelligence
    ),
    faith: calculateStatScaling(curves, base, damageType.scaling.faith, effectiveStats.faith),
    arcane: calculateStatScaling(curves, base, damageType.scaling.arcane, effectiveStats.arcane),
  };

  // Total scaling
  let totalScaling =
    perStat.strength.scaling +
    perStat.dexterity.scaling +
    perStat.intelligence.scaling +
    perStat.faith.scaling +
    perStat.arcane.scaling;

  // Check requirements for this specific damage type
  const requirementsMet = checkDamageTypeRequirementsMet(
    effectiveStats,
    requirements,
    damageType,
    ignoreRequirements
  );

  // Apply requirement penalty if not met
  // When requirements aren't met: base stays the same, scaling becomes base * -0.4
  // Per-stat values still show POTENTIAL contributions (for display/breakdown purposes)
  let finalBase = base;
  let finalScaling = totalScaling;
  if (!requirementsMet) {
    finalScaling = base * -0.4; // Penalty is -40% of base
  }

  const total = finalBase + finalScaling;
  const rounded = Math.trunc(total);

  // Build display scaling - use provided values or fall back to perStat.rawScaling
  const displayScaling: DisplayScaling = displayScalingValues ?? {
    strength: perStat.strength.rawScaling,
    dexterity: perStat.dexterity.rawScaling,
    intelligence: perStat.intelligence.rawScaling,
    faith: perStat.faith.rawScaling,
    arcane: perStat.arcane.rawScaling,
  };

  return {
    base: finalBase,
    scaling: finalScaling,
    total,
    rounded,
    perStat,
    displayScaling,
  };
}

/**
 * Check if player meets weapon requirements
 */
function checkRequirements(
  effectiveStats: PlayerStats,
  weapon: ResolvedWeapon,
  ignoreRequirements: boolean
): boolean {
  if (ignoreRequirements) return true;

  return (
    effectiveStats.strength >= weapon.requirements.strength &&
    effectiveStats.dexterity >= weapon.requirements.dexterity &&
    effectiveStats.intelligence >= weapon.requirements.intelligence &&
    effectiveStats.faith >= weapon.requirements.faith &&
    effectiveStats.arcane >= weapon.requirements.arcane
  );
}

/**
 * Calculate per-stat scaling contribution for spell scaling
 * Returns saturation, scaling contribution, and raw scaling value
 */
function calculateSpellStatScaling(
  curves: Record<number, CurveDefinition>,
  scaling: ResolvedStatScaling | null,
  statLevel: number,
  base: number
): StatScalingResult {
  if (!scaling) {
    return { saturation: 0, scaling: 0, rawScaling: 0 };
  }

  const saturation = getStatSaturation(curves, scaling.curveId, statLevel);
  // For spell scaling, the contribution is: base × scalingRatio × saturation
  // where scalingRatio = scaling.value / 100
  const scalingContribution = base * (scaling.value / 100) * saturation;

  return {
    saturation,
    scaling: scalingContribution,
    rawScaling: scaling.value,
  };
}

/**
 * Calculate spell scaling for catalysts (staffs/seals)
 * Formula: 100 * (1 + sum(scalingRatio * saturation))
 * Where scalingRatio = scalingValue / 100 (scaling value is a percentage like 83 for C)
 */
function calculateSpellScaling(
  curves: Record<number, CurveDefinition>,
  spellScaling: ResolvedSpellScaling | null,
  effectiveStats: PlayerStats,
  requirements: { strength: number; dexterity: number; intelligence: number; faith: number; arcane: number },
  ignoreRequirements: boolean
): SpellScalingResult | null {
  if (!spellScaling) return null;

  const BASE = 100; // Spell scaling always uses base 100

  // Calculate per-stat contributions
  const perStat = {
    strength: calculateSpellStatScaling(curves, spellScaling.strength, effectiveStats.strength, BASE),
    dexterity: calculateSpellStatScaling(curves, spellScaling.dexterity, effectiveStats.dexterity, BASE),
    intelligence: calculateSpellStatScaling(curves, spellScaling.intelligence, effectiveStats.intelligence, BASE),
    faith: calculateSpellStatScaling(curves, spellScaling.faith, effectiveStats.faith, BASE),
    arcane: calculateSpellStatScaling(curves, spellScaling.arcane, effectiveStats.arcane, BASE),
  };

  // Total scaling is sum of per-stat contributions
  const totalScalingContribution =
    perStat.strength.scaling +
    perStat.dexterity.scaling +
    perStat.intelligence.scaling +
    perStat.faith.scaling +
    perStat.arcane.scaling;

  // Check requirements - if not met, use reduced scaling
  const checkStatRequirement = (scaling: ResolvedStatScaling | null, statLevel: number, required: number): boolean => {
    if (!scaling) return true;
    return statLevel >= required;
  };

  const reqMet = ignoreRequirements || (
    checkStatRequirement(spellScaling.strength, effectiveStats.strength, requirements.strength) &&
    checkStatRequirement(spellScaling.dexterity, effectiveStats.dexterity, requirements.dexterity) &&
    checkStatRequirement(spellScaling.intelligence, effectiveStats.intelligence, requirements.intelligence) &&
    checkStatRequirement(spellScaling.faith, effectiveStats.faith, requirements.faith) &&
    checkStatRequirement(spellScaling.arcane, effectiveStats.arcane, requirements.arcane)
  );

  // Empty per-stat result for when requirements not met
  const emptyPerStat = {
    strength: { saturation: 0, scaling: 0, rawScaling: perStat.strength.rawScaling },
    dexterity: { saturation: 0, scaling: 0, rawScaling: perStat.dexterity.rawScaling },
    intelligence: { saturation: 0, scaling: 0, rawScaling: perStat.intelligence.rawScaling },
    faith: { saturation: 0, scaling: 0, rawScaling: perStat.faith.rawScaling },
    arcane: { saturation: 0, scaling: 0, rawScaling: perStat.arcane.rawScaling },
  };

  // If requirements not met, scaling is reduced (base * 0.6, scaling = 0)
  if (!reqMet) {
    const total = BASE * 0.6;
    return {
      base: BASE * 0.6,
      scaling: 0,
      total,
      rounded: Math.trunc(total),
      perStat: emptyPerStat,
    };
  }

  const total = BASE + totalScalingContribution;

  return {
    base: BASE,
    scaling: totalScalingContribution,
    total,
    rounded: Math.trunc(total),
    perStat,
  };
}

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
function isAlwaysTwoHanded(wepType: number): boolean {
  return (
    wepType === LIGHT_BOW_WEP_TYPE ||
    wepType === BOW_WEP_TYPE ||
    wepType === GREATBOW_WEP_TYPE ||
    wepType === BALLISTA_WEP_TYPE
  );
}

/**
 * Calculate effective stats (apply 2H strength bonus)
 */
function calculateEffectiveStats(
  stats: PlayerStats,
  weapon: ResolvedWeapon,
  options: CalculatorOptions
): PlayerStats {
  let effectiveStrength = stats.strength;

  // Determine if 2H bonus should apply
  let applyTwoHandingBonus = options.twoHanding;

  // Paired weapons do not get the two handing bonus
  if (weapon.isDualBlade) {
    applyTwoHandingBonus = false;
  }

  // Fist weapons don't get 2H bonus
  if (weapon.wepType === FIST_WEP_TYPE) {
    applyTwoHandingBonus = false;
  }

  // Bows and ballistae are always two-handed
  if (isAlwaysTwoHanded(weapon.wepType)) {
    applyTwoHandingBonus = true;
  }

  // 2-handing gives 1.5x strength, capped at 148
  if (applyTwoHandingBonus) {
    effectiveStrength = Math.min(Math.floor(stats.strength * 1.5), MAX_EFFECTIVE_STAT);
  }

  return {
    ...stats,
    strength: effectiveStrength,
  };
}

/**
 * Calculate status effect value (poison, bleed, frost, etc.)
 *
 * Status effect formula:
 * - Base value from SpEffectParam (fixed, doesn't scale with upgrade)
 * - Scaling: base × (arcaneScaling/100) × arcaneSaturation
 * - Total: base + scaling
 *
 * Only arcane affects status effect scaling.
 * When arcane requirement isn't met: (base + scaling) × 0.6
 *
 * Note: The returned `base` is the raw base value (unpenalized),
 * matching how the CSV reports it. The penalty is applied to total/rounded.
 */
function calculateStatusEffect(
  curves: Record<number, CurveDefinition>,
  statusEffect: ResolvedStatusEffect | null,
  stats: PlayerStats,
  requirements: { arcane: number },
  ignoreRequirements: boolean
): StatusEffectResult {
  const emptyResult: StatusEffectResult = { base: 0, scaling: 0, total: 0, rounded: 0 };

  if (!statusEffect) return emptyResult;

  // Base value (doesn't change with stats)
  const base = statusEffect.base;

  // Check if arcane meets requirement (only if weapon has arcane scaling on status)
  const hasArcaneScaling = statusEffect.arcaneScaling !== null;
  const meetsRequirement = ignoreRequirements || !hasArcaneScaling || stats.arcane >= requirements.arcane;

  // Calculate arcane scaling if present
  let scaling = 0;
  if (statusEffect.arcaneScaling) {
    const curve = curves[statusEffect.arcaneScaling.curveId];
    if (curve) {
      // Get saturation from curve at arcane stat level
      const saturation = calculateCurveValue(curve, stats.arcane) / 100;

      // Calculate scaling: base × (scalingValue/100) × saturation
      const scalingValue = statusEffect.arcaneScaling.value;
      scaling = base * (scalingValue / 100) * saturation;
    }
  }

  // Apply requirement penalty to total if not met
  // When requirements aren't met: total × 0.6
  let total = base + scaling;
  if (!meetsRequirement) {
    total = total * 0.6;
  }
  const rounded = Math.trunc(total);

  // Return original base (unpenalized) to match CSV format
  return { base, scaling, total, rounded };
}

/**
 * Calculate AR for a resolved weapon with player stats
 *
 * @param data - Precomputed data (weapons + curves)
 * @param weapon - Resolved weapon data
 * @param stats - Player stats
 * @param options - Calculator options
 * @returns AR calculation result
 */
export function calculateAR(
  data: PrecomputedData,
  weapon: ResolvedWeapon,
  stats: PlayerStats,
  options: Partial<CalculatorOptions> = {}
): ARResult {
  const opts: CalculatorOptions = {
    twoHanding: options.twoHanding ?? false,
    ignoreRequirements: options.ignoreRequirements ?? false,
  };

  // Calculate effective stats
  const effectiveStats = calculateEffectiveStats(stats, weapon, opts);

  // Check requirements
  const requirementsMet = checkRequirements(effectiveStats, weapon, opts.ignoreRequirements);

  // Get weapon scaling for display (letter grades) - same for all damage types
  const displayScaling: DisplayScaling = weapon.weaponScaling;

  // Calculate each damage type with display scaling values
  const physical = calculateDamageType(data.curves, weapon.physical, effectiveStats, weapon.requirements, opts.ignoreRequirements, displayScaling);
  const magic = calculateDamageType(data.curves, weapon.magic, effectiveStats, weapon.requirements, opts.ignoreRequirements, displayScaling);
  const fire = calculateDamageType(data.curves, weapon.fire, effectiveStats, weapon.requirements, opts.ignoreRequirements, displayScaling);
  const lightning = calculateDamageType(data.curves, weapon.lightning, effectiveStats, weapon.requirements, opts.ignoreRequirements, displayScaling);
  const holy = calculateDamageType(data.curves, weapon.holy, effectiveStats, weapon.requirements, opts.ignoreRequirements, displayScaling);

  // Calculate total AR
  const total = physical.total + magic.total + fire.total + lightning.total + holy.total;
  const rounded = Math.trunc(total);

  // Calculate status effects
  const arcaneReq = { arcane: weapon.requirements.arcane };
  const poison = calculateStatusEffect(data.curves, weapon.poison, effectiveStats, arcaneReq, opts.ignoreRequirements);
  const scarletRot = calculateStatusEffect(data.curves, weapon.scarletRot, effectiveStats, arcaneReq, opts.ignoreRequirements);
  const bleed = calculateStatusEffect(data.curves, weapon.bleed, effectiveStats, arcaneReq, opts.ignoreRequirements);
  const frost = calculateStatusEffect(data.curves, weapon.frost, effectiveStats, arcaneReq, opts.ignoreRequirements);
  const sleep = calculateStatusEffect(data.curves, weapon.sleep, effectiveStats, arcaneReq, opts.ignoreRequirements);
  const madness = calculateStatusEffect(data.curves, weapon.madness, effectiveStats, arcaneReq, opts.ignoreRequirements);

  // Calculate spell scaling for catalysts
  const sorceryScalingResult = calculateSpellScaling(
    data.curves,
    weapon.sorceryScaling,
    effectiveStats,
    weapon.requirements,
    opts.ignoreRequirements
  );
  const incantationScalingResult = calculateSpellScaling(
    data.curves,
    weapon.incantationScaling,
    effectiveStats,
    weapon.requirements,
    opts.ignoreRequirements
  );

  return {
    physical,
    magic,
    fire,
    lightning,
    holy,
    total,
    rounded,
    poison,
    scarletRot,
    bleed,
    frost,
    sleep,
    madness,
    sorceryScaling: sorceryScalingResult,
    incantationScaling: incantationScalingResult,
    effectiveStats,
    requirementsMet,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find a weapon in precomputed data by name, affinity, and upgrade level
 */
export function findWeapon(
  data: PrecomputedData,
  name: string,
  affinity: string,
  upgradeLevel: number
): ResolvedWeapon | undefined {
  return data.weapons.find(
    (w) => w.name === name && w.affinity === affinity && w.upgradeLevel === upgradeLevel
  );
}

/**
 * Get all unique weapon names in precomputed data
 */
export function getWeaponNames(data: PrecomputedData): string[] {
  const names = new Set<string>();
  for (const weapon of data.weapons) {
    names.add(weapon.name);
  }
  return Array.from(names).sort();
}

/**
 * Get all affinities available for a weapon
 */
export function getWeaponAffinities(data: PrecomputedData, name: string): string[] {
  const affinities = new Set<string>();
  for (const weapon of data.weapons) {
    if (weapon.name === name) {
      affinities.add(weapon.affinity);
    }
  }
  return Array.from(affinities);
}

/**
 * Get max upgrade level for a weapon
 */
export function getMaxUpgradeLevel(data: PrecomputedData, name: string, affinity: string): number {
  let max = 0;
  for (const weapon of data.weapons) {
    if (weapon.name === name && weapon.affinity === affinity) {
      max = Math.max(max, weapon.upgradeLevel);
    }
  }
  return max;
}

// ============================================================================
// V2: Hybrid Calculator (base weapons + reinforce rates at runtime)
// ============================================================================

/**
 * Apply reinforcement rate to base stat scaling
 * If the scaling is an override, use the value directly (don't multiply by rate)
 */
function applyScalingRate(
  baseScaling: BaseStatScaling | null,
  rate: number
): ResolvedStatScaling | null {
  if (!baseScaling) return null;

  // Override values bypass rate multiplication - they're already the final value
  const value = baseScaling.isOverride ? baseScaling.base : baseScaling.base * rate;

  return {
    value,
    curveId: baseScaling.curveId,
  };
}

/**
 * Apply reinforcement rates to base damage type
 */
function applyDamageRates(
  baseDamage: BaseDamageType | null,
  rates: ReinforceRates,
  damageType: 'physical' | 'magic' | 'fire' | 'lightning' | 'holy'
): ResolvedDamageType | null {
  if (!baseDamage) return null;

  // Map damage types to rate fields
  const attackRateMap = {
    physical: rates.physicsAtkRate,
    magic: rates.magicAtkRate,
    fire: rates.fireAtkRate,
    lightning: rates.thunderAtkRate,
    holy: rates.darkAtkRate,
  };

  const scalingRateMap = {
    strength: rates.correctStrengthRate,
    dexterity: rates.correctAgilityRate,
    intelligence: rates.correctMagicRate,
    faith: rates.correctFaithRate,
    arcane: rates.correctLuckRate,
  };

  return {
    base: baseDamage.attackBase * attackRateMap[damageType],
    scaling: {
      strength: applyScalingRate(baseDamage.scaling.strength, scalingRateMap.strength),
      dexterity: applyScalingRate(baseDamage.scaling.dexterity, scalingRateMap.dexterity),
      intelligence: applyScalingRate(baseDamage.scaling.intelligence, scalingRateMap.intelligence),
      faith: applyScalingRate(baseDamage.scaling.faith, scalingRateMap.faith),
      arcane: applyScalingRate(baseDamage.scaling.arcane, scalingRateMap.arcane),
    },
  };
}

/**
 * Apply reinforcement rate to spell scaling stat
 * The resulting value is a percentage (e.g., 83 for C scaling, 249 at +25 with 3x rate)
 */
function applySpellScalingStatRate(
  baseScaling: BaseStatScaling | null,
  rate: number
): ResolvedStatScaling | null {
  if (!baseScaling) return null;

  // Override values bypass rate multiplication - they're already the final value
  const value = baseScaling.isOverride ? baseScaling.base : baseScaling.base * rate;

  return {
    value,
    curveId: baseScaling.curveId,
  };
}

/**
 * Apply reinforcement rates to spell scaling
 */
function applySpellScalingRates(
  baseScaling: BaseSpellScaling | null,
  rates: ReinforceRates
): ResolvedSpellScaling | null {
  if (!baseScaling) return null;

  const scalingRateMap = {
    strength: rates.correctStrengthRate,
    dexterity: rates.correctAgilityRate,
    intelligence: rates.correctMagicRate,
    faith: rates.correctFaithRate,
    arcane: rates.correctLuckRate,
  };

  return {
    strength: applySpellScalingStatRate(baseScaling.strength, scalingRateMap.strength),
    dexterity: applySpellScalingStatRate(baseScaling.dexterity, scalingRateMap.dexterity),
    intelligence: applySpellScalingStatRate(baseScaling.intelligence, scalingRateMap.intelligence),
    faith: applySpellScalingStatRate(baseScaling.faith, scalingRateMap.faith),
    arcane: applySpellScalingStatRate(baseScaling.arcane, scalingRateMap.arcane),
  };
}

/**
 * Convert BaseStatusEffect to ResolvedStatusEffect
 * Status effects change with upgrade level - look up base value from SpEffectParam
 * The actual SpEffect ID = spEffectBehaviorId + spEffectIdOffset from reinforce rates
 * The arcane scaling uses correctLuck with the specified curve
 */
function resolveStatusEffect(
  baseStatus: BaseStatusEffect | null,
  rates: ReinforceRates,
  spEffects: Record<number, import('./types.js').SpEffectEntry>
): ResolvedStatusEffect | null {
  if (!baseStatus) return null;

  // Calculate actual SpEffect ID using the offset for this upgrade level
  const offset = baseStatus.spEffectSlot === 0 ? rates.spEffectId1 : rates.spEffectId2;
  const actualSpEffectId = baseStatus.spEffectBehaviorId + offset;

  // Look up base value from SpEffectParam
  const spEffect = spEffects[actualSpEffectId];
  if (!spEffect) return null;

  // Get the base value for the specific status type
  let baseValue: number;
  switch (baseStatus.statusType) {
    case 'poison':
      baseValue = spEffect.poizonAttackPower;
      break;
    case 'scarletRot':
      baseValue = spEffect.diseaseAttackPower;
      break;
    case 'bleed':
      baseValue = spEffect.bloodAttackPower;
      break;
    case 'frost':
      baseValue = spEffect.freezeAttackPower;
      break;
    case 'sleep':
      baseValue = spEffect.sleepAttackPower;
      break;
    case 'madness':
      baseValue = spEffect.madnessAttackPower;
      break;
  }

  if (baseValue <= 0) return null;

  // Apply reinforcement rate to arcane scaling (correctLuckRate affects status scaling)
  const scaledArcane = baseStatus.arcaneScaling * rates.correctLuckRate;

  return {
    base: baseValue,
    arcaneScaling: scaledArcane > 0 ? {
      value: scaledArcane,
      curveId: baseStatus.curveId,
    } : null,
  };
}

/**
 * Resolve a weapon at a specific upgrade level
 * This applies reinforcement rates to base weapon data at runtime
 */
export function resolveWeaponAtLevel(
  data: PrecomputedDataV2,
  weaponName: string,
  affinity: string,
  upgradeLevel: number
): ResolvedWeapon | null {
  const weapon = data.weapons[weaponName];
  if (!weapon) return null;

  const affinityData = weapon.affinities[affinity];
  if (!affinityData) return null;

  // Get reinforcement rates for this weapon type + level
  const rateKey = affinityData.reinforceTypeId + upgradeLevel;
  const rates = data.reinforceRates[rateKey];

  if (!rates) {
    return null;
  }

  // Apply rates to weapon scaling values for display
  const weaponScaling: ResolvedWeaponScaling = {
    strength: affinityData.weaponScaling.strength * rates.correctStrengthRate,
    dexterity: affinityData.weaponScaling.dexterity * rates.correctAgilityRate,
    intelligence: affinityData.weaponScaling.intelligence * rates.correctMagicRate,
    faith: affinityData.weaponScaling.faith * rates.correctFaithRate,
    arcane: affinityData.weaponScaling.arcane * rates.correctLuckRate,
  };

  return {
    id: affinityData.id,
    name: weaponName,
    affinity,
    upgradeLevel,

    physical: applyDamageRates(affinityData.physical, rates, 'physical'),
    magic: applyDamageRates(affinityData.magic, rates, 'magic'),
    fire: applyDamageRates(affinityData.fire, rates, 'fire'),
    lightning: applyDamageRates(affinityData.lightning, rates, 'lightning'),
    holy: applyDamageRates(affinityData.holy, rates, 'holy'),

    // Status effects
    poison: resolveStatusEffect(affinityData.poison, rates, data.spEffects),
    scarletRot: resolveStatusEffect(affinityData.scarletRot, rates, data.spEffects),
    bleed: resolveStatusEffect(affinityData.bleed, rates, data.spEffects),
    frost: resolveStatusEffect(affinityData.frost, rates, data.spEffects),
    sleep: resolveStatusEffect(affinityData.sleep, rates, data.spEffects),
    madness: resolveStatusEffect(affinityData.madness, rates, data.spEffects),

    // Spell scaling for catalysts
    sorceryScaling: applySpellScalingRates(affinityData.sorceryScaling, rates),
    incantationScaling: applySpellScalingRates(affinityData.incantationScaling, rates),

    requirements: weapon.requirements,
    weaponScaling,
    isDualBlade: weapon.isDualBlade,
    wepType: weapon.wepType,
    wepmotionCategory: weapon.wepmotionCategory ?? 0,
  };
}

/**
 * Calculate AR using V2 precomputed data
 * This resolves weapon at upgrade level at runtime, then calculates AR
 */
export function calculateARV2(
  data: PrecomputedDataV2,
  weaponName: string,
  affinity: string,
  upgradeLevel: number,
  stats: PlayerStats,
  options: Partial<CalculatorOptions> = {}
): ARResult | null {
  // Resolve weapon at the specified upgrade level
  const resolvedWeapon = resolveWeaponAtLevel(data, weaponName, affinity, upgradeLevel);

  if (!resolvedWeapon) {
    return null;
  }

  // Use the existing calculateAR with a V2-compatible data object
  const compatData: PrecomputedData = {
    version: data.version,
    generatedAt: data.generatedAt,
    weapons: [], // Not needed for single weapon calculation
    curves: data.curves,
  };

  return calculateAR(compatData, resolvedWeapon, stats, options);
}

// ============================================================================
// V2 Helper Functions (O(1) lookups with nested structure)
// ============================================================================

/**
 * Get a weapon entry by name (O(1) lookup)
 */
export function getWeaponV2(
  data: PrecomputedDataV2,
  name: string
): WeaponEntry | undefined {
  return data.weapons[name];
}

/**
 * Get affinity data for a weapon (O(1) lookup)
 */
export function getAffinityDataV2(
  data: PrecomputedDataV2,
  name: string,
  affinity: string
): AffinityData | undefined {
  return data.weapons[name]?.affinities[affinity];
}

/**
 * Check if a weapon+affinity combination exists
 */
export function hasWeaponAffinityV2(
  data: PrecomputedDataV2,
  name: string,
  affinity: string
): boolean {
  return data.weapons[name]?.affinities[affinity] !== undefined;
}

/**
 * Get all weapon names (O(1) - just Object.keys)
 */
export function getWeaponNamesV2(data: PrecomputedDataV2): string[] {
  return Object.keys(data.weapons).sort();
}

/**
 * Get all affinities available for a weapon (O(1) lookup)
 */
export function getWeaponAffinitiesV2(data: PrecomputedDataV2, name: string): string[] {
  const weapon = data.weapons[name];
  if (!weapon) return [];
  return Object.keys(weapon.affinities);
}

/**
 * Get max upgrade level for a weapon (O(1) lookup)
 */
export function getMaxUpgradeLevelV2(
  data: PrecomputedDataV2,
  name: string,
  _affinity?: string  // Kept for API compatibility, but not needed (same for all affinities)
): number {
  const weapon = data.weapons[name];
  return weapon?.maxUpgradeLevel ?? 0;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert a raw scaling value to its letter grade representation
 * Elden Ring scaling grades: S, A, B, C, D, E, or - (no scaling)
 *
 * @param rawScaling - The raw scaling value (e.g., 36 for D, 100 for A)
 * @returns The letter grade (S, A, B, C, D, E, or -)
 */
export function getScalingGrade(rawScaling: number): string {
  if (rawScaling === 0) return '-';
  if (rawScaling >= 175) return 'S';
  if (rawScaling >= 140) return 'A';
  if (rawScaling >= 90) return 'B';
  if (rawScaling >= 60) return 'C';
  if (rawScaling >= 25) return 'D';
  return 'E';
}

// ============================================================================
// Guard Stats Calculation
// ============================================================================

/**
 * Calculate guard stats for a weapon at a specific upgrade level
 *
 * Guard formula from spreadsheet:
 * - Damage negation: MIN(base × rate, 100) - capped at 100%
 * - Guard boost: TRUNC(base × rate)
 * - Status resistance: Does not scale with upgrade level (base values only)
 *
 * @param guardStats - Base guard stats from weapon data
 * @param guardResistance - Guard resistance stats from weapon data
 * @param rates - Reinforcement rates for the upgrade level
 * @returns Guard stats result with scaled damage negation values
 */
export function calculateGuardStats(
  guardStats: BaseGuardStats,
  guardResistance: GuardResistance,
  rates: ReinforceRates
): GuardResult {
  return {
    // Damage negation: base × rate, capped at 100
    physical: Math.min(guardStats.physical * rates.physicsGuardCutRate, 100),
    magic: Math.min(guardStats.magic * rates.magicGuardCutRate, 100),
    fire: Math.min(guardStats.fire * rates.fireGuardCutRate, 100),
    lightning: Math.min(guardStats.lightning * rates.thunderGuardCutRate, 100),
    holy: Math.min(guardStats.holy * rates.darkGuardCutRate, 100),
    // Guard boost: TRUNC(base × rate)
    guardBoost: Math.trunc(guardStats.guardBoost * rates.staminaGuardDefRate),
    // Status resistance doesn't scale with upgrade level
    resistance: guardResistance,
  };
}

/**
 * Calculate guard stats for a weapon using V2 precomputed data
 *
 * @param data - V2 precomputed data
 * @param weaponName - Name of the weapon
 * @param affinity - Affinity name
 * @param upgradeLevel - Upgrade level (0-25 for standard, 0-10 for somber)
 * @returns Guard stats result, or null if weapon/affinity/rates not found
 */
export function calculateGuardStatsV2(
  data: PrecomputedDataV2,
  weaponName: string,
  affinity: string,
  upgradeLevel: number
): GuardResult | null {
  const weapon = data.weapons[weaponName];
  if (!weapon) return null;

  const affinityData = weapon.affinities[affinity];
  if (!affinityData) return null;

  // Get reinforcement rates for this upgrade level
  const ratesKey = affinityData.reinforceTypeId + upgradeLevel;
  const rates = data.reinforceRates[ratesKey];
  if (!rates) return null;

  return calculateGuardStats(weapon.guardStats, weapon.guardResistance, rates);
}
