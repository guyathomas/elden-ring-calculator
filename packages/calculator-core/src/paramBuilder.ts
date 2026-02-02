/**
 * Build-time module for generating precomputed weapon data (V2)
 *
 * This module:
 * 1. Loads param XML files
 * 2. Extracts base weapon data (without upgrade rates applied)
 * 3. Extracts reinforcement rate tables
 * 4. Extracts only the curve definitions that are actually used
 * 5. Outputs compact JSON for client-side AR calculation
 *
 * V2 Architecture:
 * - Base weapon data + reinforcement rates shipped to client
 * - Upgrade level calculations done at runtime (smaller bundle)
 */

import {
  loadParamFile,
  parseCalcCorrectGraph,
  parseReinforceParamWeapon,
  parseEquipParamWeapon,
  parseAttackElementCorrect,
  parseSpEffectParam,
  type CalcCorrectGraphCurve,
  type ReinforceParamWeaponRow,
  type EquipParamWeaponRow,
  type AttackElementCorrectRow,
  type SpEffectParamRow,
} from './paramParser.js';

import type {
  CurveDefinition,
  BaseDamageType,
  BaseStatScaling,
  BaseSpellScaling,
  BaseStatusEffect,
  WeaponStatScaling,
  ReinforceRates,
  PrecomputedDataV2,
  WeaponEntry,
  AffinityData,
  SpEffectEntry,
} from './types.js';

// ============================================================================
// Affinity Configuration
// ============================================================================

/**
 * Affinity ID offsets for weapon IDs
 * Standard weapons have base ID, affinity adds offset * 100 to get variant
 */
const AFFINITY_OFFSETS: Record<string, number> = {
  Standard: 0,
  Heavy: 100,
  Keen: 200,
  Quality: 300,
  Fire: 400,
  'Flame Art': 500,
  Lightning: 600,
  Sacred: 700,
  Magic: 800,
  Cold: 900,
  Poison: 1000,
  Blood: 1100,
  Occult: 1200,
};

// ============================================================================
// Internal Build Context
// ============================================================================

interface BuildContext {
  calcCorrectGraphCurves: Map<number, CalcCorrectGraphCurve>;
  reinforceParamWeapon: Map<number, ReinforceParamWeaponRow>;
  equipParamWeapon: Map<number, EquipParamWeaponRow>;
  attackElementCorrect: Map<number, AttackElementCorrectRow>;
  spEffectParam: Map<number, SpEffectParamRow>;
  usedCurveIds: Set<number>;
  usedSpEffectIds: Set<number>;  // SpEffect IDs to include in output
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a stat affects a damage type based on AttackElementCorrect
 */
function doesStatAffectDamage(
  aec: AttackElementCorrectRow,
  stat: 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane',
  damageType: 'physical' | 'magic' | 'fire' | 'lightning' | 'holy'
): boolean {
  const statMap: Record<string, string> = {
    strength: 'Strength',
    dexterity: 'Dexterity',
    intelligence: 'Magic',
    faith: 'Faith',
    arcane: 'Luck',
  };
  const dmgMap: Record<string, string> = {
    physical: 'Physics',
    magic: 'Magic',
    fire: 'Fire',
    lightning: 'Thunder',
    holy: 'Dark',
  };

  const key = `is${statMap[stat]}Correct_by${dmgMap[damageType]}` as keyof AttackElementCorrectRow;
  return aec[key] === true;
}

/**
 * Get the scaling override value if one exists
 */
function getScalingOverride(
  aec: AttackElementCorrectRow,
  stat: 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane',
  damageType: 'physical' | 'magic' | 'fire' | 'lightning' | 'holy'
): number | null {
  const statMap: Record<string, string> = {
    strength: 'Strength',
    dexterity: 'Dexterity',
    intelligence: 'Magic',
    faith: 'Faith',
    arcane: 'Luck',
  };
  const dmgMap: Record<string, string> = {
    physical: 'Physics',
    magic: 'Magic',
    fire: 'Fire',
    lightning: 'Thunder',
    holy: 'Dark',
  };

  const overwriteKey =
    `overwrite${statMap[stat]}CorrectRate_by${dmgMap[damageType]}` as keyof AttackElementCorrectRow;
  const overwrite = aec[overwriteKey] as number;

  if (overwrite !== undefined && overwrite > 0) {
    return overwrite;
  }
  return null;
}

/**
 * Find a weapon by name and affinity
 */
function findWeaponByNameAndAffinity(
  ctx: BuildContext,
  name: string,
  affinity: string
): EquipParamWeaponRow | null {
  const expectedName = affinity === 'Standard' ? name : `${affinity} ${name}`;

  for (const weapon of ctx.equipParamWeapon.values()) {
    if (weapon.name === expectedName) {
      return weapon;
    }
  }

  // Fallback: try finding by ID offset
  let baseWeapon: EquipParamWeaponRow | null = null;
  for (const weapon of ctx.equipParamWeapon.values()) {
    if (weapon.name === name) {
      baseWeapon = weapon;
      break;
    }
  }

  if (!baseWeapon) {
    return null;
  }

  const affinityOffset = AFFINITY_OFFSETS[affinity] ?? 0;
  if (affinityOffset === 0) {
    return baseWeapon;
  }

  const affinityId = baseWeapon.id + affinityOffset;
  return ctx.equipParamWeapon.get(affinityId) ?? null;
}

/**
 * Get max upgrade level for a weapon
 */
function getMaxUpgradeLevel(ctx: BuildContext, weapon: EquipParamWeaponRow): number {
  const baseTypeId = weapon.reinforceTypeId;

  let maxLevel = 0;
  for (let level = 0; level <= 25; level++) {
    const key = baseTypeId + level;
    if (ctx.reinforceParamWeapon.has(key)) {
      maxLevel = level;
    }
  }

  return maxLevel;
}

/**
 * Convert CalcCorrectGraphCurve to CurveDefinition
 */
function toCurveDefinition(curve: CalcCorrectGraphCurve): CurveDefinition {
  return {
    id: curve.id,
    stageMaxVal: curve.stageMaxVal,
    stageMaxGrowVal: curve.stageMaxGrowVal,
    adjPt_maxGrowVal: curve.adjPt_maxGrowVal,
  };
}

// ============================================================================
// V2 Build Functions
// ============================================================================

/**
 * Build base stat scaling (without applying reinforcement rate)
 */
function buildBaseStatScaling(
  ctx: BuildContext,
  weapon: EquipParamWeaponRow,
  aec: AttackElementCorrectRow,
  stat: 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane',
  damageType: 'physical' | 'magic' | 'fire' | 'lightning' | 'holy',
  curveId: number
): BaseStatScaling | null {
  if (!doesStatAffectDamage(aec, stat, damageType)) {
    return null;
  }

  const correctionMap: Record<string, keyof EquipParamWeaponRow> = {
    strength: 'correctStrength',
    dexterity: 'correctAgility',
    intelligence: 'correctMagic',
    faith: 'correctFaith',
    arcane: 'correctLuck',
  };
  const baseCorrection = weapon[correctionMap[stat]] as number;

  const override = getScalingOverride(aec, stat, damageType);

  ctx.usedCurveIds.add(curveId);

  return {
    base: override !== null ? override : baseCorrection,
    curveId,
    isOverride: override !== null,
  };
}

/**
 * Build base damage type data (without applying reinforcement rate)
 */
function buildBaseDamageType(
  ctx: BuildContext,
  weapon: EquipParamWeaponRow,
  aec: AttackElementCorrectRow,
  damageType: 'physical' | 'magic' | 'fire' | 'lightning' | 'holy'
): BaseDamageType | null {
  const baseMap: Record<string, keyof EquipParamWeaponRow> = {
    physical: 'attackBasePhysics',
    magic: 'attackBaseMagic',
    fire: 'attackBaseFire',
    lightning: 'attackBaseThunder',
    holy: 'attackBaseDark',
  };
  const curveMap: Record<string, keyof EquipParamWeaponRow> = {
    physical: 'correctType_Physics',
    magic: 'correctType_Magic',
    fire: 'correctType_Fire',
    lightning: 'correctType_Thunder',
    holy: 'correctType_Dark',
  };

  const attackBase = weapon[baseMap[damageType]] as number;
  const curveId = weapon[curveMap[damageType]] as number;

  if (attackBase <= 0) {
    return null;
  }

  return {
    attackBase,
    scaling: {
      strength: buildBaseStatScaling(ctx, weapon, aec, 'strength', damageType, curveId),
      dexterity: buildBaseStatScaling(ctx, weapon, aec, 'dexterity', damageType, curveId),
      intelligence: buildBaseStatScaling(ctx, weapon, aec, 'intelligence', damageType, curveId),
      faith: buildBaseStatScaling(ctx, weapon, aec, 'faith', damageType, curveId),
      arcane: buildBaseStatScaling(ctx, weapon, aec, 'arcane', damageType, curveId),
    },
  };
}

/**
 * Build spell scaling data for catalysts
 * Spell scaling uses the same stat scaling curves but with base 100 (applied at runtime)
 */
function buildSpellScaling(
  ctx: BuildContext,
  weapon: EquipParamWeaponRow,
  aec: AttackElementCorrectRow
): BaseSpellScaling | null {
  // Spell scaling uses the magic damage type's scaling configuration
  // but the actual base (100) is applied at runtime
  const curveId = weapon.correctType_Magic;

  // Build scaling for each stat that affects magic damage (for staffs)
  // or holy damage (for seals that scale with faith)
  const buildStatScaling = (
    stat: 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane'
  ): BaseStatScaling | null => {
    // For spell scaling, we use the magic damage scaling configuration
    if (!doesStatAffectDamage(aec, stat, 'magic')) {
      return null;
    }

    const correctionMap: Record<string, keyof EquipParamWeaponRow> = {
      strength: 'correctStrength',
      dexterity: 'correctAgility',
      intelligence: 'correctMagic',
      faith: 'correctFaith',
      arcane: 'correctLuck',
    };
    const baseCorrection = weapon[correctionMap[stat]] as number;

    const override = getScalingOverride(aec, stat, 'magic');

    ctx.usedCurveIds.add(curveId);

    return {
      base: override !== null ? override : baseCorrection,
      curveId,
      isOverride: override !== null,
    };
  };

  return {
    strength: buildStatScaling('strength'),
    dexterity: buildStatScaling('dexterity'),
    intelligence: buildStatScaling('intelligence'),
    faith: buildStatScaling('faith'),
    arcane: buildStatScaling('arcane'),
  };
}

/**
 * Build affinity-specific data for a weapon
 */
function buildAffinityData(
  ctx: BuildContext,
  weapon: EquipParamWeaponRow
): AffinityData | null {
  const aec = ctx.attackElementCorrect.get(weapon.attackElementCorrectId);
  if (!aec) {
    return null;
  }

  // Build spell scaling for catalysts
  const sorceryScaling = weapon.enableMagic ? buildSpellScaling(ctx, weapon, aec) : null;
  const incantationScaling = weapon.enableMiracle ? buildSpellScaling(ctx, weapon, aec) : null;

  // Build weapon scaling values for display (letter grades)
  const weaponScaling: WeaponStatScaling = {
    strength: weapon.correctStrength ?? 0,
    dexterity: weapon.correctAgility ?? 0,
    intelligence: weapon.correctMagic ?? 0,
    faith: weapon.correctFaith ?? 0,
    arcane: weapon.correctLuck ?? 0,
  };

  return {
    id: weapon.id,
    reinforceTypeId: weapon.reinforceTypeId,

    physical: buildBaseDamageType(ctx, weapon, aec, 'physical'),
    magic: buildBaseDamageType(ctx, weapon, aec, 'magic'),
    fire: buildBaseDamageType(ctx, weapon, aec, 'fire'),
    lightning: buildBaseDamageType(ctx, weapon, aec, 'lightning'),
    holy: buildBaseDamageType(ctx, weapon, aec, 'holy'),

    // Status effects
    poison: buildStatusEffect(ctx, weapon, 'poison'),
    scarletRot: buildStatusEffect(ctx, weapon, 'scarletRot'),
    bleed: buildStatusEffect(ctx, weapon, 'bleed'),
    frost: buildStatusEffect(ctx, weapon, 'frost'),
    sleep: buildStatusEffect(ctx, weapon, 'sleep'),
    madness: buildStatusEffect(ctx, weapon, 'madness'),

    weaponScaling,
    sorceryScaling,
    incantationScaling,
  };
}

/**
 * Build status effect data for a weapon
 *
 * Status effects use spEffectBehaviorId0/1 to reference SpEffectParam for base values:
 * - spEffectBehaviorId0: Often used for inherent weapon status effects (e.g., Rivers of Blood's
 *   bleed, Rotten Greataxe's scarlet rot)
 * - spEffectBehaviorId1: Often used for affinity-added status effects (e.g., Blood affinity's
 *   bleed, Poison affinity's poison, Cold affinity's frost)
 *
 * Arcane scaling behavior:
 * Only ONE status effect per weapon gets arcane scaling. The scaling slot priority:
 * 1. If slot 1 has any status effect, it gets the arcane scaling (from affinity)
 * 2. If only slot 0 has status, it gets the arcane scaling (inherent + scaling like Rivers of Blood)
 * This matches the in-game behavior where affinity-applied status effects scale with arcane,
 * while inherent status effects (when an affinity effect is also present) do not scale.
 *
 * Example: Poison Rotten Greataxe has scarlet rot (slot 0, inherent, no scaling) and
 * poison (slot 1, from affinity, scales with arcane).
 *
 * Curve IDs: Uses correctType_Blood, correctType_Poison (for poison/scarletRot/frost),
 * correctType_Sleep, or correctType_Madness. Note: No separate correctType_Frost or
 * correctType_ScarletRot fields exist in the game data.
 *
 * At runtime: actual SpEffect ID = spEffectBehaviorId + spEffectId offset from reinforce rates
 * The base value is then looked up from spEffects[actualId][statusType]
 */
function buildStatusEffect(
  ctx: BuildContext,
  weapon: EquipParamWeaponRow,
  statusType: 'poison' | 'scarletRot' | 'bleed' | 'frost' | 'sleep' | 'madness'
): BaseStatusEffect | null {
  // Check both spEffectBehaviorId0 and spEffectBehaviorId1 for status effects
  // Different status types may be in different slots (e.g., frost is often in slot 1)
  const spEffectSlots: Array<{ id: number; slot: 0 | 1 }> = [];
  if (weapon.spEffectBehaviorId0 > 0) {
    spEffectSlots.push({ id: weapon.spEffectBehaviorId0, slot: 0 });
  }
  if (weapon.spEffectBehaviorId1 > 0) {
    spEffectSlots.push({ id: weapon.spEffectBehaviorId1, slot: 1 });
  }
  if (spEffectSlots.length === 0) return null;

  // Determine the curve ID based on status type
  let curveId: number;
  switch (statusType) {
    case 'poison':
    case 'scarletRot':
    case 'frost':
      curveId = weapon.correctType_Poison || 6;
      break;
    case 'bleed':
      curveId = weapon.correctType_Blood || 6;
      break;
    case 'sleep':
      curveId = weapon.correctType_Sleep || 6;
      break;
    case 'madness':
      curveId = weapon.correctType_Madness || 6;
      break;
  }

  // Search through all SpEffect IDs for the requested status type
  for (const { id: spEffectId, slot } of spEffectSlots) {
    const spEffect = ctx.spEffectParam.get(spEffectId);
    if (!spEffect) continue;

    // Get the base value for the requested status type
    let baseValue: number;
    switch (statusType) {
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

    if (baseValue > 0) {
      // Track the curve as used
      ctx.usedCurveIds.add(curveId);

      // Track this SpEffect ID as used (we'll need all upgrade levels)
      ctx.usedSpEffectIds.add(spEffectId);

      // Determine if this status effect gets arcane scaling
      // Rule: arcane scaling only applies to the affinity-added status effect, not innate ones
      // - Affinity-added effects have SpEffect IDs >= 100000 (e.g., 105000 for Blood bleed, 106200 for Poison)
      // - Innate effects have SpEffect IDs < 100000 (e.g., 6401 for bleed, 6511 for poison)
      // Examples:
      // - Blood Venomous Fang: slot0=105000 (bleed, affinity) scales, slot1=6511 (poison, innate) doesn't
      // - Poison Rotten Greataxe: slot0=6603 (scarlet rot, innate) doesn't, slot1=106200 (poison, affinity) scales
      const slot0Id = weapon.spEffectBehaviorId0;
      const slot1Id = weapon.spEffectBehaviorId1;
      const hasSlot0Status = slot0Id > 0;
      const hasSlot1Status = slot1Id > 0;
      const isSlot0 = slot === 0;

      let isPrimaryScalingSlot: boolean;
      if (hasSlot0Status && hasSlot1Status) {
        // Both slots have status effects - the affinity-added one (higher ID) gets scaling
        const isSlot0Affinity = slot0Id >= 100000;
        const isSlot1Affinity = slot1Id >= 100000;
        isPrimaryScalingSlot = isSlot0 ? isSlot0Affinity : isSlot1Affinity;
      } else {
        // Only one slot has a status effect - it gets scaling
        isPrimaryScalingSlot = isSlot0 ? hasSlot0Status : hasSlot1Status;
      }

      const arcaneScaling = isPrimaryScalingSlot ? (weapon.correctLuck ?? 0) : 0;

      return {
        spEffectBehaviorId: spEffectId,
        spEffectSlot: slot,
        statusType,
        arcaneScaling,
        curveId,
      };
    }
  }

  return null;
}

/**
 * Build weapon-level shared data
 */
function buildWeaponEntry(
  ctx: BuildContext,
  weapon: EquipParamWeaponRow
): Omit<WeaponEntry, 'affinities'> {
  const maxLevel = getMaxUpgradeLevel(ctx, weapon);

  // All weapons have guard stats (damage reduction when blocking)
  const guardStats = {
    physical: weapon.physGuardCutRate,
    magic: weapon.magGuardCutRate,
    fire: weapon.fireGuardCutRate,
    lightning: weapon.thunGuardCutRate,
    holy: weapon.darkGuardCutRate,
    guardBoost: weapon.staminaGuardDef,
  };

  const guardResistance = {
    poison: weapon.poisonGuardResist,
    scarletRot: weapon.diseaseGuardResist,
    bleed: weapon.bloodGuardResist,
    frost: weapon.freezeGuardResist,
    sleep: weapon.sleepGuardResist,
    madness: weapon.madnessGuardResist,
    death: weapon.curseGuardResist,
  };

  return {
    requirements: {
      strength: weapon.properStrength,
      dexterity: weapon.properAgility,
      intelligence: weapon.properMagic,
      faith: weapon.properFaith,
      arcane: weapon.properLuck,
    },
    wepType: weapon.wepType ?? 0,
    wepmotionCategory: weapon.wepmotionCategory ?? 0,
    // Critical value for backstabs/ripostes (100 + throwAtkRate from game data)
    criticalValue: 100 + (weapon.throwAtkRate ?? 0),
    isDualBlade: weapon.isDualBlade ?? false,
    isEnhance: weapon.isEnhance ?? false,
    maxUpgradeLevel: maxLevel,
    weight: weapon.weight ?? 0,

    // AoW-related properties (shared across all affinities)
    attackBaseStamina: weapon.attackBaseStamina ?? 0,
    saWeaponDamage: weapon.saWeaponDamage ?? 0,
    atkAttribute: weapon.atkAttribute ?? 0,
    atkAttribute2: weapon.atkAttribute2 ?? 0,

    // Attack type flags (for atkAttribute=253 resolution)
    isNormalAttackType: weapon.isNormalAttackType ?? false,
    isSlashAttackType: weapon.isSlashAttackType ?? false,
    isBlowAttackType: weapon.isBlowAttackType ?? false,
    isThrustAttackType: weapon.isThrustAttackType ?? false,

    gemMountType: weapon.gemMountType ?? 0,
    swordArtsParamId: weapon.swordArtsParamId ?? 0,

    // Guard stats (for blocking)
    guardStats,
    guardResistance,
  };
}

/**
 * Convert ReinforceParamWeaponRow to ReinforceRates
 */
function toReinforceRates(row: ReinforceParamWeaponRow): ReinforceRates {
  return {
    physicsAtkRate: row.physicsAtkRate,
    magicAtkRate: row.magicAtkRate,
    fireAtkRate: row.fireAtkRate,
    thunderAtkRate: row.thunderAtkRate,
    darkAtkRate: row.darkAtkRate,
    correctStrengthRate: row.correctStrengthRate,
    correctAgilityRate: row.correctAgilityRate,
    correctMagicRate: row.correctMagicRate,
    correctFaithRate: row.correctFaithRate,
    correctLuckRate: row.correctLuckRate,
    staminaAtkRate: row.staminaAtkRate,  // For AoW stamina damage calculations
    spEffectId1: row.spEffectId1,  // Offset for spEffectBehaviorId0
    spEffectId2: row.spEffectId2,  // Offset for spEffectBehaviorId1
    // Guard rate multipliers
    physicsGuardCutRate: row.physicsGuardCutRate,
    magicGuardCutRate: row.magicGuardCutRate,
    fireGuardCutRate: row.fireGuardCutRate,
    thunderGuardCutRate: row.thunderGuardCutRate,
    darkGuardCutRate: row.darkGuardCutRate,
    staminaGuardDefRate: row.staminaGuardDefRate,
  };
}

// ============================================================================
// Public API
// ============================================================================

export interface BuildOptionsV2 {
  /** Only include these weapons (by name). If empty, include all. */
  weaponFilter?: string[];
  /** Only include these affinities. If empty, include all. */
  affinityFilter?: string[];
}

/**
 * Build V2 precomputed data (hybrid approach with nested structure)
 * - Weapons indexed by name (O(1) lookup)
 * - Affinities nested under weapon (no repeated data)
 * - Upgrade levels computed at runtime
 */
export function buildPrecomputedDataV2(
  paramFilesDir: string,
  options: BuildOptionsV2 = {}
): PrecomputedDataV2 {
  // Load param files
  const ccgFile = loadParamFile(`${paramFilesDir}/CalcCorrectGraph.param.xml`);
  const rpwFile = loadParamFile(`${paramFilesDir}/ReinforceParamWeapon.param.xml`);
  const epwFile = loadParamFile(`${paramFilesDir}/EquipParamWeapon.param.xml`);
  const aecFile = loadParamFile(`${paramFilesDir}/AttackElementCorrectParam.param.xml`);
  const sepFile = loadParamFile(`${paramFilesDir}/SpEffectParam.param.xml`);

  const ctx: BuildContext = {
    calcCorrectGraphCurves: parseCalcCorrectGraph(ccgFile),
    reinforceParamWeapon: parseReinforceParamWeapon(rpwFile),
    equipParamWeapon: parseEquipParamWeapon(epwFile),
    attackElementCorrect: parseAttackElementCorrect(aecFile),
    spEffectParam: parseSpEffectParam(sepFile),
    usedCurveIds: new Set(),
    usedSpEffectIds: new Set(),
  };

  // Determine which weapons to process
  const weaponNames = options.weaponFilter ?? [];
  const affinities = options.affinityFilter ?? Object.keys(AFFINITY_OFFSETS);

  // Collect weapons to process
  const weaponsToProcess: Array<{ weapon: EquipParamWeaponRow; affinity: string; baseName: string }> = [];

  if (weaponNames.length > 0) {
    // Process specific weapons
    for (const name of weaponNames) {
      for (const affinity of affinities) {
        const weapon = findWeaponByNameAndAffinity(ctx, name, affinity);
        if (weapon) {
          weaponsToProcess.push({ weapon, affinity, baseName: name });
        }
      }
    }
  } else {
    // Process all weapons
    for (const weapon of ctx.equipParamWeapon.values()) {
      // Skip placeholder weapons (no name or internal naming)
      if (!weapon.name || weapon.name.startsWith('Weapon_')) {
        continue;
      }

      // Skip invalid/error names
      if (weapon.name.includes('[ERROR]') || weapon.name.includes('%null%')) {
        continue;
      }

      // Skip NPC-only weapons
      if (weapon.name.startsWith('[NPC]')) {
        continue;
      }

      // Skip ammunition and placeholder weapon types
      // wepType: 0=Thrown items/invalid, 81=Arrows, 83=Greatarrows, 85=Bolts, 86=Greatbolts
      // Note: weaponCategory is different - 0 there includes daggers which we want to keep
      const INVALID_WEP_TYPES = [0, 81, 83, 85, 86];
      if (INVALID_WEP_TYPES.includes(weapon.wepType ?? 0)) {
        continue;
      }

      // Only process base weapons (affinity offset 0)
      // Affinity ID is encoded as (id % 10000) / 100: 0=Standard, 1=Heavy, 2=Keen, etc.
      const affinityId = (weapon.id % 10000) / 100;
      const isBaseWeapon = affinityId === 0;
      if (isBaseWeapon) {
        for (const affinity of affinities) {
          const affinityWeapon = findWeaponByNameAndAffinity(ctx, weapon.name, affinity);
          if (affinityWeapon) {
            weaponsToProcess.push({ weapon: affinityWeapon, affinity, baseName: weapon.name });
          }
        }
      }
    }
  }

  // Build nested weapon structure
  const weapons: Record<string, WeaponEntry> = {};
  const usedReinforceTypeIds = new Set<number>();

  for (const { weapon, affinity, baseName } of weaponsToProcess) {
    const affinityData = buildAffinityData(ctx, weapon);
    if (!affinityData) continue;

    // Create weapon entry if it doesn't exist
    if (!weapons[baseName]) {
      const weaponEntry = buildWeaponEntry(ctx, weapon);
      weapons[baseName] = {
        ...weaponEntry,
        affinities: {},
      };
    }

    // Add affinity data
    weapons[baseName].affinities[affinity] = affinityData;
    usedReinforceTypeIds.add(weapon.reinforceTypeId);
  }

  // Build reinforcement rates (only for used types)
  const reinforceRates: Record<number, ReinforceRates> = {};
  for (const typeId of usedReinforceTypeIds) {
    // Find max level for this type
    let maxLevel = 0;
    for (let level = 0; level <= 25; level++) {
      const key = typeId + level;
      if (ctx.reinforceParamWeapon.has(key)) {
        maxLevel = level;
      }
    }

    // Extract rates for all levels
    for (let level = 0; level <= maxLevel; level++) {
      const key = typeId + level;
      const row = ctx.reinforceParamWeapon.get(key);
      if (row) {
        reinforceRates[key] = toReinforceRates(row);
      }
    }
  }

  // Build curve definitions (only for used curves)
  const curves: Record<number, CurveDefinition> = {};
  for (const curveId of ctx.usedCurveIds) {
    const curve = ctx.calcCorrectGraphCurves.get(curveId);
    if (curve) {
      curves[curveId] = toCurveDefinition(curve);
    }
  }

  // Build SpEffect entries for status effects
  // For each used base SpEffect ID, we need all upgrade levels (base + 0..maxLevel)
  const spEffects: Record<number, SpEffectEntry> = {};
  for (const baseId of ctx.usedSpEffectIds) {
    // Include the base ID and all upgrade level offsets (0-25 is the max possible)
    for (let offset = 0; offset <= 25; offset++) {
      const effectId = baseId + offset;
      const spEffect = ctx.spEffectParam.get(effectId);
      if (spEffect) {
        spEffects[effectId] = {
          poizonAttackPower: spEffect.poizonAttackPower,
          diseaseAttackPower: spEffect.diseaseAttackPower,
          bloodAttackPower: spEffect.bloodAttackPower,
          freezeAttackPower: spEffect.freezeAttackPower,
          sleepAttackPower: spEffect.sleepAttackPower,
          madnessAttackPower: spEffect.madnessAttackPower,
        };
      }
    }
  }

  return {
    version: '2.2.0',  // Updated for status effect support
    generatedAt: new Date().toISOString(),
    weapons,
    reinforceRates,
    curves,
    spEffects,
  };
}
