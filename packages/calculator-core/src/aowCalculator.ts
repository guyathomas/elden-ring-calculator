/**
 * Ash of War (AoW) Damage Calculator
 *
 * Calculates damage for AoW attacks using:
 * - Weapon AR from existing calculator
 * - Motion values for weapon-based attacks
 * - Flat damage for bullet/spell attacks
 * - Stat scaling for bullet attacks via AttackElementCorrect
 *
 * Formula for motion-based attacks:
 *   finalDamage = (weaponBase + weaponScaling) × motionValue
 *
 * Formula for bullet attacks (isAddBaseAtk = true):
 *   finalDamage = flatDamage × (1 + statScaling × PWU)
 *   where PWU = upgradeLevel / maxUpgradeLevel
 */

import type {
  PrecomputedAowData,
  PrecomputedAowAttack,
  AowCalculatorInput,
  AowCalculatorResult,
  AowAttackResult,
  AttackElementCorrectEntry,
  FinalDamageRateEntry,
  EquipParamGemEntry,
  AowStatPointBonus,
} from './aowTypes.js';
import type {
  PrecomputedDataV2,
  PlayerStats,
  CurveDefinition,
  ReinforceRates,
  DamageTypeResult,
  ResolvedDamageType,
} from './types.js';
import {
  calculateARV2,
  resolveWeaponAtLevel,
} from './calculator.js';
import { ATTACK_ATTRIBUTE_MAP, WEAPON_CLASS_MAP } from './aowTypes.js';
import {
  computePwuMultiplier,
  computeEffectiveStats,
  getStatSaturationFromCurves,
  computeScalingContribution,
  computeScalingWithReinforce,
  computeBulletDamage,
  computeBulletDamageNoScaling,
  computeMotionDamage,
  computeTotalStatPointBonus,
  computeShieldChip,
  computeStaminaDamage,
  computePoiseDamage,
  roundTo3Decimals,
  roundTo2Decimals,
  roundTo4Decimals,
} from './aowFormulas.js';

// ============================================================================
// Constants
// ============================================================================

/** swordArtsParamId value meaning "no skill" or "standard attack" */
const NO_SKILL_ID = 10;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Weapon attack type flags for atkAttribute=253 resolution
 */
interface WeaponAttackTypeFlags {
  isNormalAttackType: boolean;
  isSlashAttackType: boolean;
  isBlowAttackType: boolean;
  isThrustAttackType: boolean;
}

/**
 * Get the attack attribute name from ID
 *
 * atkAttribute values:
 * - 0-3: Direct damage type (Standard, Slash, Strike, Pierce)
 * - 252: Use weapon's atkAttribute field
 * - 253: Use weapon's is*AttackType flags (first enabled one)
 */
function getAttackAttributeName(
  atkAttribute: number,
  weaponAtkAttribute: number,
  weaponAttackTypeFlags: WeaponAttackTypeFlags
): string {
  // 252 = use weapon's primary attribute (atkAttribute field)
  if (atkAttribute === 252) {
    return ATTACK_ATTRIBUTE_MAP[weaponAtkAttribute] ?? 'Standard';
  }

  // 253 = use weapon's is*AttackType flags (first enabled one in priority order)
  // Priority: Normal (Standard) > Slash > Blow (Strike) > Thrust (Pierce)
  if (atkAttribute === 253) {
    if (weaponAttackTypeFlags.isNormalAttackType) return 'Standard';
    if (weaponAttackTypeFlags.isSlashAttackType) return 'Slash';
    if (weaponAttackTypeFlags.isBlowAttackType) return 'Strike';
    if (weaponAttackTypeFlags.isThrustAttackType) return 'Pierce';
    // Fallback to Standard if no flags are set
    return 'Standard';
  }

  return ATTACK_ATTRIBUTE_MAP[atkAttribute] ?? '-';
}

/**
 * Check if a resolved damage type has any non-zero stat scaling
 */
function damageTypeHasScaling(damageType: ResolvedDamageType | null): boolean {
  if (!damageType?.scaling) return false;
  const s = damageType.scaling;
  return (s.strength?.value ?? 0) > 0 ||
         (s.dexterity?.value ?? 0) > 0 ||
         (s.intelligence?.value ?? 0) > 0 ||
         (s.faith?.value ?? 0) > 0 ||
         (s.arcane?.value ?? 0) > 0;
}

/**
 * Check if a bullet attack has weapon scaling for any of its damage types
 * Used when overwriteAttackElementCorrectId === -1 (use weapon's scaling)
 */
function bulletHasWeaponScaling(
  attack: PrecomputedAowAttack,
  resolvedWeapon: ReturnType<typeof resolveWeaponAtLevel>
): boolean {
  if (!resolvedWeapon) return false;

  // Check each flat damage type the bullet deals
  if (attack.flatPhys > 0 && damageTypeHasScaling(resolvedWeapon.physical)) return true;
  if (attack.flatMag > 0 && damageTypeHasScaling(resolvedWeapon.magic)) return true;
  if (attack.flatFire > 0 && damageTypeHasScaling(resolvedWeapon.fire)) return true;
  if (attack.flatThun > 0 && damageTypeHasScaling(resolvedWeapon.lightning)) return true;
  if (attack.flatDark > 0 && damageTypeHasScaling(resolvedWeapon.holy)) return true;

  return false;
}


/**
 * Calculate bullet damage with stat scaling
 *
 * Uses pure formula functions from aowFormulas.ts for testability.
 *
 * Formula:
 *   bulletDamage = flatDamage × (1 + 3 × PWU) × (1 + statScaling)
 *
 * Where:
 *   - PWU = upgradeLevel / maxUpgradeLevel (percent weapon upgrade)
 *   - (1 + 3 × PWU) gives: 1.0 at level 0, 4.0 at max level
 *   - statScaling = sum of (scalingPercent/100 × saturation) for each stat
 *   - scalingPercent comes from AttackElementCorrect overwrite values or weapon scaling
 *   - saturation comes from CalcCorrectGraph curve
 */
function calculateBulletDamage(
  flatDamage: number,
  weaponData: ReturnType<typeof resolveWeaponAtLevel>,
  attackElementCorrect: AttackElementCorrectEntry | undefined,
  curves: Record<number, CurveDefinition>,
  effectiveStats: PlayerStats,
  upgradeLevel: number,
  maxUpgradeLevel: number,
  damageType: 'physical' | 'magic' | 'fire' | 'lightning' | 'holy',
  reinforceRates: ReinforceRates | undefined,
  useWeaponScaling: boolean = false
): number {
  if (flatDamage === 0) return 0;

  // Compute PWU multiplier using formula function
  const pwuMultiplier = computePwuMultiplier(upgradeLevel, maxUpgradeLevel);

  // Get the damage type data from weapon (for curve lookups and weapon scaling)
  const damageTypeData = weaponData?.[damageType];

  // If no attack element correct data and not using weapon scaling, return flat damage scaled by PWU
  if (!attackElementCorrect && !useWeaponScaling) {
    return computeBulletDamageNoScaling(flatDamage, pwuMultiplier);
  }

  // Map damage type to AttackElementCorrect field suffix
  const typeMap: Record<string, string> = {
    physical: 'Physics',
    magic: 'Magic',
    fire: 'Fire',
    lightning: 'Thunder',
    holy: 'Dark',
  };
  const typeSuffix = typeMap[damageType];

  // Map stat names to reinforce rate field names
  const statToRateMap: Record<string, keyof ReinforceRates> = {
    strength: 'correctStrengthRate',
    dexterity: 'correctAgilityRate',
    intelligence: 'correctMagicRate',
    faith: 'correctFaithRate',
    arcane: 'correctLuckRate',
  };

  // Calculate stat contributions using formula functions
  const scalingContributions: number[] = [];

  // Check each stat
  const statNames: (keyof PlayerStats)[] = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane'];
  const aecStatNames = ['Strength', 'Dexterity', 'Magic', 'Faith', 'Luck'];
  const scalingNames = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane'] as const;

  for (let i = 0; i < statNames.length; i++) {
    const statName = statNames[i];
    const aecStatName = aecStatNames[i];
    const scalingName = scalingNames[i];

    // Check if this stat affects this damage type
    // When using weapon scaling, check if the weapon has scaling for this stat on this damage type
    let statAffectsDamage = false;
    if (attackElementCorrect) {
      const affectsKey = `is${aecStatName}Correct_by${typeSuffix}` as keyof AttackElementCorrectEntry;
      statAffectsDamage = !!attackElementCorrect[affectsKey];
    } else if (useWeaponScaling && damageTypeData) {
      // Use weapon scaling: stat affects damage if weapon has non-null scaling for this stat
      const weaponScaling = damageTypeData.scaling[scalingName];
      statAffectsDamage = weaponScaling !== null && weaponScaling.value > 0;
    }

    if (!statAffectsDamage) continue;

    // Get scaling value (use override if available, otherwise use weapon's)
    let scalingValue: number;
    if (attackElementCorrect) {
      const overrideKey = `overwrite${aecStatName}CorrectRate_by${typeSuffix}` as keyof AttackElementCorrectEntry;
      const overrideValue = attackElementCorrect[overrideKey] as number;

      if (overrideValue >= 0) {
        // Override value is the base scaling (e.g., 25 = 0.25)
        // For bullet arts, we need to multiply by the weapon's scaling rate
        const scalingRate = reinforceRates?.[statToRateMap[scalingName]] ?? 1;
        scalingValue = computeScalingWithReinforce(overrideValue, scalingRate);
      } else if (damageTypeData) {
        // Use weapon's scaling (already has rate applied)
        const weaponScaling = damageTypeData.scaling[scalingName];
        scalingValue = weaponScaling?.value ?? 0;
      } else {
        scalingValue = 0;
      }
    } else if (damageTypeData) {
      // Using weapon scaling directly (no AttackElementCorrect)
      const weaponScaling = damageTypeData.scaling[scalingName];
      scalingValue = weaponScaling?.value ?? 0;
    } else {
      scalingValue = 0;
    }

    if (scalingValue === 0) continue;

    // Get curve ID from weapon's damage type (default to curve 0 if not available)
    const curveId = damageTypeData?.scaling[scalingName]?.curveId ?? 0;

    // Calculate saturation using formula function
    const statLevel = effectiveStats[statName];
    const saturation = getStatSaturationFromCurves(curves, curveId, statLevel);

    // Compute scaling contribution
    scalingContributions.push(computeScalingContribution(scalingValue, saturation));
  }

  // Sum total scaling
  const totalScaling = scalingContributions.reduce((sum, contrib) => sum + contrib, 0);

  // Final damage using formula function
  return computeBulletDamage(flatDamage, pwuMultiplier, totalScaling);
}


/**
 * Validate if an affinity is compatible with an Ash of War
 */
function validateAowAffinity(
  gemId: number,
  affinityName: string,
  equipParamGem: Record<number, EquipParamGemEntry>,
  affinityConfigFieldMap: Record<string, string>
): boolean {
  const gemEntry = equipParamGem[gemId];
  if (!gemEntry) return false;

  // Get the config field for this affinity (e.g., "Standard" -> "configurableWepAttr00")
  const fieldName = affinityConfigFieldMap[affinityName];
  if (!fieldName) {
    // Fallback to hardcoded logic if mapping is missing (e.g. for new affinities)
    // This maintains backward compatibility if gem-data.tsv is incomplete
    console.warn(`No mapping found for affinity '${affinityName}', falling back to ID-based check`);
    return false;
  }

  // Check the field in the gem entry
  // We need to cast to any because we're accessing by string key
  return (gemEntry as any)[fieldName] === true;
}

/**
 * Validate if a weapon type is compatible with an Ash of War
 */
function validateAowWeaponType(
  gemId: number,
  wepType: number,
  equipParamGem: Record<number, EquipParamGemEntry>,
  weaponClassMountFieldMap: Record<string, string>
): boolean {
  const gemEntry = equipParamGem[gemId];
  if (!gemEntry) return false;

  // Get weapon class name from ID
  const weaponClassName = WEAPON_CLASS_MAP[wepType];
  if (!weaponClassName) return false;

  // Get the mount field for this weapon class (e.g., "Dagger" -> "canMountWep_Dagger")
  const fieldName = weaponClassMountFieldMap[weaponClassName];
  if (!fieldName) {
    console.warn(`No mapping found for weapon class '${weaponClassName}', falling back to default`);
    return false;
  }

  // Check the field in the gem entry
  return (gemEntry as any)[fieldName] === true;
}

// ============================================================================
// Main Calculator
// ============================================================================

/**
 * Calculate AoW damage for all attacks in a sword art
 */
export function calculateAowDamage(
  aowData: PrecomputedAowData,
  weaponData: PrecomputedDataV2,
  input: AowCalculatorInput
): AowCalculatorResult {
  // Get the sword art - first try swordArtsByName (equippable AoWs)
  let swordArtsId = aowData.swordArtsByName[input.aowName];

  // If not found, try to find by skill name in skillNames (for unique weapon skills)
  if (swordArtsId === undefined && aowData.skillNames) {
    for (const [id, name] of Object.entries(aowData.skillNames)) {
      if (name === input.aowName) {
        swordArtsId = parseInt(id, 10);
        break;
      }
    }
  }

  if (swordArtsId === undefined) {
    return {
      aowName: input.aowName,
      swordArtsId: -1,
      requirements: {
        strength: '-',
        dexterity: '-',
        intelligence: '-',
        faith: '-',
        arcane: '-',
      },
      attacks: [],
      error: `AoW not found: ${input.aowName}`,
    };
  }

  const swordArt = aowData.swordArts[swordArtsId];
  if (!swordArt || swordArt.attacks.length === 0) {
    return {
      aowName: input.aowName,
      swordArtsId,
      requirements: {
        strength: '-',
        dexterity: '-',
        intelligence: '-',
        faith: '-',
        arcane: '-',
      },
      attacks: [{
        name: 'No AoW Attack Data',
        atkId: -1,
        physical: '-',
        magic: '-',
        fire: '-',
        lightning: '-',
        holy: '-',
        stamina: '-',
        poise: '-',
        attackAttribute: '-',
        pvpMultiplier: '-',
        shieldChip: '-',
        hasStatScaling: false,
        isBullet: false,
        motionDamage: 0,
        bulletDamage: 0,
        motionPhys: 0,
        motionMag: 0,
        motionFire: 0,
        motionLtn: 0,
        motionHoly: 0,
        bulletPhys: 0,
        bulletMag: 0,
        bulletFire: 0,
        bulletLtn: 0,
        bulletHoly: 0,
      }],
    };
  }

  // Get weapon data
  const weapon = weaponData.weapons[input.weaponName];
  if (!weapon) {
    return {
      aowName: input.aowName,
      swordArtsId,
      requirements: {
        strength: '-',
        dexterity: '-',
        intelligence: '-',
        faith: '-',
        arcane: '-',
      },
      attacks: [],
      error: `Weapon not found: ${input.weaponName}`,
    };
  }

  const affinity = weapon.affinities[input.affinity];
  if (!affinity) {
    return {
      aowName: input.aowName,
      swordArtsId,
      requirements: {
        strength: '-',
        dexterity: '-',
        intelligence: '-',
        faith: '-',
        arcane: '-',
      },
      attacks: [],
      error: `Affinity not found: ${input.affinity}`,
    };
  }

  // Calculate player stats
  const stats: PlayerStats = {
    strength: input.strength,
    dexterity: input.dexterity,
    intelligence: input.intelligence,
    faith: input.faith,
    arcane: input.arcane,
  };

  // Calculate effective stats (with 2H bonus) using formula function
  const effectiveStats = computeEffectiveStats(
    stats,
    input.twoHanding,
    weapon.wepType,
    weapon.isDualBlade
  );

  // Resolve weapon at upgrade level for AR calculation
  const resolvedWeapon = resolveWeaponAtLevel(
    weaponData,
    input.weaponName,
    input.affinity,
    input.upgradeLevel
  );

  if (!resolvedWeapon) {
    return {
      aowName: input.aowName,
      swordArtsId,
      requirements: {
        strength: '-',
        dexterity: '-',
        intelligence: '-',
        faith: '-',
        arcane: '-',
      },
      attacks: [],
      error: `Failed to resolve weapon at level ${input.upgradeLevel}`,
    };
  }

  // Calculate weapon AR
  const weaponAR = calculateARV2(
    weaponData,
    input.weaponName,
    input.affinity,
    input.upgradeLevel,
    stats,
    {
      twoHanding: input.twoHanding,
      ignoreRequirements: input.ignoreRequirements,
    }
  );

  if (!weaponAR) {
    return {
      aowName: input.aowName,
      swordArtsId,
      requirements: {
        strength: '-',
        dexterity: '-',
        intelligence: '-',
        faith: '-',
        arcane: '-',
      },
      attacks: [],
      error: 'Failed to calculate weapon AR',
    };
  }

  // Calculate 1H AR for attacks that disable the 2H bonus (isDisableBothHandsAtkBonus=true)
  // Only calculate if player is 2-handing and there are attacks that need this
  const needs1hAR = input.twoHanding && swordArt.attacks.some(a => a.isDisableBothHandsAtkBonus);
  const weaponAR1H = needs1hAR
    ? calculateARV2(
        weaponData,
        input.weaponName,
        input.affinity,
        input.upgradeLevel,
        stats,
        {
          twoHanding: false,
          ignoreRequirements: input.ignoreRequirements,
        }
      )
    : null;

  // Get reinforcement rates for bullet damage scaling (may be undefined, handled gracefully)
  const rateKey = affinity.reinforceTypeId + input.upgradeLevel;
  const reinforceRates = weaponData.reinforceRates[rateKey];

  // Get weapon's attack attribute (for attacks that use weapon's attribute)
  const weaponAtkAttribute = weapon.atkAttribute;

  // Get weapon's attack type flags (for atkAttribute=253 resolution)
  const weaponAttackTypeFlags: WeaponAttackTypeFlags = {
    isNormalAttackType: weapon.isNormalAttackType,
    isSlashAttackType: weapon.isSlashAttackType,
    isBlowAttackType: weapon.isBlowAttackType,
    isThrustAttackType: weapon.isThrustAttackType,
  };

  // Calculate damage for each attack
  const attackResults: AowAttackResult[] = [];

  // Get stat point bonuses for this AoW (e.g., War Cry, Barbaric Roar, Shriek of Milos)
  // These bonuses add to the scaling AR for motion-based attacks
  const statBonus = aowData.aowStatPointBonuses[input.aowName];

  // Pre-compute stat point bonus AR for each damage type (for normal 2H/1H AR)
  // Formula: bonusAR = base × saturation × bonusPoints/100
  const physBonusAR = computeTotalStatPointBonus(weaponAR.physical, statBonus);
  const magBonusAR = computeTotalStatPointBonus(weaponAR.magic, statBonus);
  const fireBonusAR = computeTotalStatPointBonus(weaponAR.fire, statBonus);
  const lightningBonusAR = computeTotalStatPointBonus(weaponAR.lightning, statBonus);
  const holyBonusAR = computeTotalStatPointBonus(weaponAR.holy, statBonus);

  // Pre-compute 1H stat point bonuses for attacks that disable 2H bonus
  const physBonusAR1H = weaponAR1H ? computeTotalStatPointBonus(weaponAR1H.physical, statBonus) : 0;
  const magBonusAR1H = weaponAR1H ? computeTotalStatPointBonus(weaponAR1H.magic, statBonus) : 0;
  const fireBonusAR1H = weaponAR1H ? computeTotalStatPointBonus(weaponAR1H.fire, statBonus) : 0;
  const lightningBonusAR1H = weaponAR1H ? computeTotalStatPointBonus(weaponAR1H.lightning, statBonus) : 0;
  const holyBonusAR1H = weaponAR1H ? computeTotalStatPointBonus(weaponAR1H.holy, statBonus) : 0;

  // Pre-compute base names of explicit attacks for this weapon class
  // This is used to determine if a generic attack should be skipped
  const explicitAttackBaseNames = new Set<string>();
  for (const atk of swordArt.attacks) {
    if (atk.weaponClass && atk.weaponClass.toLowerCase() === input.weaponClass.toLowerCase()) {
      // Extract base name by removing weapon class prefix and any numbering
      // e.g., "[Greatsword] Bloody Slash" -> "Bloody Slash"
      // e.g., "[Greatsword] War Cry 1h R2 #1" -> "War Cry 1h R2"
      const baseName = atk.name
        .replace(/^\[[^\]]+\]\s*/, '')  // Remove [WeaponClass] prefix
        .replace(/\s*#\d+$/, '')        // Remove trailing #N
        .trim();
      explicitAttackBaseNames.add(baseName.toLowerCase());
    }
  }

  // Check if this is an equippable AoW (has a gem entry) or a unique weapon skill
  // Unique weapon skills don't have gem entries and should skip affinity/weapon type validation
  const gemId = aowData.swordArtsIdToGemId[swordArtsId];
  const isEquippableAow = gemId !== undefined && aowData.equipParamGem[gemId] !== undefined;

  // Only validate affinity and weapon type compatibility for equippable AoWs
  if (isEquippableAow) {
    // Validate AoW/Affinity compatibility
    if (!validateAowAffinity(gemId, input.affinity, aowData.equipParamGem, aowData.affinityConfigFieldMap)) {
      return {
        aowName: input.aowName,
        swordArtsId,
        requirements: {
          strength: '-',
          dexterity: '-',
          intelligence: '-',
          faith: '-',
          arcane: '-',
        },
        attacks: [],
        error: `AoW "${input.aowName}" is not compatible with affinity "${input.affinity}"`,
      };
    }

    // Validate AoW/Weapon Type compatibility
    if (!validateAowWeaponType(gemId, weapon.wepType, aowData.equipParamGem, aowData.weaponClassMountFieldMap)) {
      return {
        aowName: input.aowName,
        swordArtsId,
        requirements: {
          strength: '-',
          dexterity: '-',
          intelligence: '-',
          faith: '-',
          arcane: '-',
        },
        attacks: [],
        error: `AoW "${input.aowName}" is not compatible with weapon type "${weapon.wepType}"`,
      };
    }
  }

  // Pre-compute weapon class filtering (constant for all attacks)
  const explicitClasses = aowData.aowExplicitWeaponClasses[input.aowName] || [];
  const inputClass = input.weaponClass;
  const inputHasExplicitAttacks = explicitClasses.some(
    cls => cls.toLowerCase() === inputClass.toLowerCase()
  );

  for (const attack of swordArt.attacks) {
    // Skip lacking FP attacks unless requested
    if (!input.showLackingFp && attack.name.toLowerCase().includes('lacking fp')) {
      continue;
    }

    // Filter attacks based on weapon class
    if (attack.weaponClass === null) {
      // Generic attack (no weapon class prefix)
      // Only skip if there's an explicit attack with the SAME base name
      // e.g., "Bloody Slash" is skipped if "[Greatsword] Bloody Slash" exists
      // but "War Cry - Roar" is kept even if "[Greatsword] War Cry 1h R2" exists
      const genericBaseName = attack.name.replace(/\s*#\d+$/, '').trim().toLowerCase();
      if (explicitAttackBaseNames.has(genericBaseName)) {
        continue; // Skip - this generic attack is replaced by an explicit one
      }
      // Include generic attack - either no explicit attacks or different attack type
    } else {
      const attackClass = attack.weaponClass;

      // Check if this is a variant marker (Var1, Var2, etc.)
      const isVariantAttack = /^Var\d+$/i.test(attackClass);

      if (isVariantAttack) {
        // This is a [VarN] attack - only include if weapon class has NO explicit attacks
        if (inputHasExplicitAttacks) {
          continue; // Skip variant attacks for weapon classes with explicit attacks
        }
        // Include this variant attack for weapon classes without explicit attacks
      } else {
        // This is an explicit [WeaponClass] attack - only include if it matches
        if (attackClass.toLowerCase() !== inputClass.toLowerCase()) {
          continue; // Skip if weapon class doesn't match
        }
      }
    }


    // Get attack element correct data if this is a bullet attack with override
    const attackElementCorrect = attack.overwriteAttackElementCorrectId >= 0
      ? aowData.attackElementCorrect[attack.overwriteAttackElementCorrectId]
      : undefined;

    // Determine if this attack scales with player stats
    // An attack has stat scaling if:
    // 1. It has any motion-based damage (which scales with weapon AR, which scales with stats)
    // 2. OR it has bullet damage with stat scaling (either explicit override OR using weapon's actual scaling)
    const hasMotionDamage = attack.motionPhys > 0 || attack.motionMag > 0 ||
      attack.motionFire > 0 || attack.motionThun > 0 || attack.motionDark > 0;
    // Bullet attacks scale with stats if they have an explicit override OR use weapon's scaling (-1)
    // For weapon scaling (-1), only true if weapon actually has scaling for the bullet's damage types
    const hasBulletStatScaling = attack.isAddBaseAtk && (
      attackElementCorrect !== undefined ||
      (attack.overwriteAttackElementCorrectId === -1 && bulletHasWeaponScaling(attack, resolvedWeapon))
    );
    const hasStatScaling = hasMotionDamage || hasBulletStatScaling;

    // Select the appropriate AR and stat bonuses based on isDisableBothHandsAtkBonus
    // When this flag is true and player is 2-handing, use 1H AR instead
    const useAR = (attack.isDisableBothHandsAtkBonus && weaponAR1H) ? weaponAR1H : weaponAR;
    const usePhysBonusAR = (attack.isDisableBothHandsAtkBonus && weaponAR1H) ? physBonusAR1H : physBonusAR;
    const useMagBonusAR = (attack.isDisableBothHandsAtkBonus && weaponAR1H) ? magBonusAR1H : magBonusAR;
    const useFireBonusAR = (attack.isDisableBothHandsAtkBonus && weaponAR1H) ? fireBonusAR1H : fireBonusAR;
    const useLightningBonusAR = (attack.isDisableBothHandsAtkBonus && weaponAR1H) ? lightningBonusAR1H : lightningBonusAR;
    const useHolyBonusAR = (attack.isDisableBothHandsAtkBonus && weaponAR1H) ? holyBonusAR1H : holyBonusAR;

    // Calculate damage for each type
    // Track motion and bullet damage separately for column display (per element)
    let physical: number | '-' = '-';
    let magic: number | '-' = '-';
    let fire: number | '-' = '-';
    let lightning: number | '-' = '-';
    let holy: number | '-' = '-';
    let stamina: number | '-' = '-';
    let poise: number | '-' = '-';
    let totalMotionDamage = 0;
    let totalBulletDamage = 0;
    let motionPhysDmg = 0;
    let motionMagDmg = 0;
    let motionFireDmg = 0;
    let motionLtnDmg = 0;
    let motionHolyDmg = 0;
    let bulletPhysDmg = 0;
    let bulletMagDmg = 0;
    let bulletFireDmg = 0;
    let bulletLtnDmg = 0;
    let bulletHolyDmg = 0;

    // Physical damage
    if (attack.motionPhys > 0 || attack.flatPhys > 0) {
      let phys = 0;
      if (attack.motionPhys > 0) {
        // Apply stat point bonus AR (e.g., War Cry +5 STR bonus)
        const effectivePhysAR = useAR.physical.total + usePhysBonusAR;
        const motionDmg = computeMotionDamage(effectivePhysAR, attack.motionPhys);
        phys += motionDmg;
        totalMotionDamage += motionDmg;
        motionPhysDmg += motionDmg;
      }
      if (attack.flatPhys > 0 && attack.isAddBaseAtk) {
        const bulletDmg = calculateBulletDamage(
          attack.flatPhys,
          resolvedWeapon,
          attackElementCorrect,
          weaponData.curves,
          effectiveStats,
          input.upgradeLevel,
          weapon.maxUpgradeLevel,
          'physical',
          reinforceRates,
          attack.overwriteAttackElementCorrectId === -1
        );
        phys += bulletDmg;
        totalBulletDamage += bulletDmg;
        bulletPhysDmg += bulletDmg;
      }
      physical = phys > 0 ? roundTo3Decimals(phys) : '-';
    }

    // Magic damage
    if (attack.motionMag > 0 || attack.flatMag > 0) {
      let mag = 0;
      if (attack.motionMag > 0) {
        // Apply stat point bonus AR
        const effectiveMagAR = useAR.magic.total + useMagBonusAR;
        const motionDmg = computeMotionDamage(effectiveMagAR, attack.motionMag);
        mag += motionDmg;
        totalMotionDamage += motionDmg;
        motionMagDmg += motionDmg;
      }
      if (attack.flatMag > 0 && attack.isAddBaseAtk) {
        const bulletDmg = calculateBulletDamage(
          attack.flatMag,
          resolvedWeapon,
          attackElementCorrect,
          weaponData.curves,
          effectiveStats,
          input.upgradeLevel,
          weapon.maxUpgradeLevel,
          'magic',
          reinforceRates,
          attack.overwriteAttackElementCorrectId === -1
        );
        mag += bulletDmg;
        totalBulletDamage += bulletDmg;
        bulletMagDmg += bulletDmg;
      }
      magic = mag > 0 ? roundTo3Decimals(mag) : '-';
    }

    // Fire damage
    if (attack.motionFire > 0 || attack.flatFire > 0) {
      let fir = 0;
      if (attack.motionFire > 0) {
        // Apply stat point bonus AR
        const effectiveFireAR = useAR.fire.total + useFireBonusAR;
        const motionDmg = computeMotionDamage(effectiveFireAR, attack.motionFire);
        fir += motionDmg;
        totalMotionDamage += motionDmg;
        motionFireDmg += motionDmg;
      }
      if (attack.flatFire > 0 && attack.isAddBaseAtk) {
        const bulletDmg = calculateBulletDamage(
          attack.flatFire,
          resolvedWeapon,
          attackElementCorrect,
          weaponData.curves,
          effectiveStats,
          input.upgradeLevel,
          weapon.maxUpgradeLevel,
          'fire',
          reinforceRates,
          attack.overwriteAttackElementCorrectId === -1
        );
        fir += bulletDmg;
        totalBulletDamage += bulletDmg;
        bulletFireDmg += bulletDmg;
      }
      fire = fir > 0 ? roundTo3Decimals(fir) : '-';
    }

    // Lightning damage
    if (attack.motionThun > 0 || attack.flatThun > 0) {
      let thu = 0;
      if (attack.motionThun > 0) {
        // Apply stat point bonus AR
        const effectiveLightningAR = useAR.lightning.total + useLightningBonusAR;
        const motionDmg = computeMotionDamage(effectiveLightningAR, attack.motionThun);
        thu += motionDmg;
        totalMotionDamage += motionDmg;
        motionLtnDmg += motionDmg;
      }
      if (attack.flatThun > 0 && attack.isAddBaseAtk) {
        const bulletDmg = calculateBulletDamage(
          attack.flatThun,
          resolvedWeapon,
          attackElementCorrect,
          weaponData.curves,
          effectiveStats,
          input.upgradeLevel,
          weapon.maxUpgradeLevel,
          'lightning',
          reinforceRates,
          attack.overwriteAttackElementCorrectId === -1
        );
        thu += bulletDmg;
        totalBulletDamage += bulletDmg;
        bulletLtnDmg += bulletDmg;
      }
      lightning = thu > 0 ? roundTo3Decimals(thu) : '-';
    }

    // Holy damage
    if (attack.motionDark > 0 || attack.flatDark > 0) {
      let hol = 0;
      if (attack.motionDark > 0) {
        // Apply stat point bonus AR
        const effectiveHolyAR = useAR.holy.total + useHolyBonusAR;
        const motionDmg = computeMotionDamage(effectiveHolyAR, attack.motionDark);
        hol += motionDmg;
        totalMotionDamage += motionDmg;
        motionHolyDmg += motionDmg;
      }
      if (attack.flatDark > 0 && attack.isAddBaseAtk) {
        const bulletDmg = calculateBulletDamage(
          attack.flatDark,
          resolvedWeapon,
          attackElementCorrect,
          weaponData.curves,
          effectiveStats,
          input.upgradeLevel,
          weapon.maxUpgradeLevel,
          'holy',
          reinforceRates,
          attack.overwriteAttackElementCorrectId === -1
        );
        hol += bulletDmg;
        totalBulletDamage += bulletDmg;
        bulletHolyDmg += bulletDmg;
      }
      holy = hol > 0 ? roundTo3Decimals(hol) : '-';
    }

    // Stamina damage using formula function
    // Formula: weaponStam × weaponStamRate × motionStam + flatStam
    if (attack.motionStam > 0 || attack.flatStam > 0) {
      const weaponBaseStam = weapon.attackBaseStamina;
      const weaponStamRate = reinforceRates?.staminaAtkRate ?? 1;
      const stamDamage = computeStaminaDamage(weaponBaseStam, weaponStamRate, attack.motionStam, attack.flatStam);
      stamina = stamDamage > 0 ? roundTo3Decimals(stamDamage) : '-';
    }

    // Poise damage using formula function
    // Formula: weaponPoise × weaponPoiseRate × motionPoise + flatPoise
    if (attack.motionPoise > 0 || attack.flatPoise > 0) {
      const weaponBasePoise = weapon.saWeaponDamage;
      const weaponPoiseRate = 1; // saWeaponAtkRate in ReinforceParamWeapon always defaults to 1
      const poiseDamage = computePoiseDamage(weaponBasePoise, weaponPoiseRate, attack.motionPoise, attack.flatPoise);
      poise = poiseDamage > 0 ? roundTo2Decimals(poiseDamage) : '-';
    }

    // Attack attribute
    const attackAttribute = getAttackAttributeName(
      attack.atkAttribute,
      weaponAtkAttribute,
      weaponAttackTypeFlags
    );

    // PvP multiplier
    const pvpMultiplier = input.pvpMode ? attack.pvpMultiplier : '-';

    // Shield chip using formula function
    const shieldChip = attack.guardCutCancelRate !== 0
      ? roundTo4Decimals(computeShieldChip(attack.guardCutCancelRate))
      : '-';

    attackResults.push({
      name: attack.name,
      atkId: attack.atkId,
      physical,
      magic,
      fire,
      lightning,
      holy,
      stamina,
      poise,
      attackAttribute,
      pvpMultiplier,
      shieldChip,
      hasStatScaling,
      isBullet: attack.isAddBaseAtk,
      motionDamage: roundTo3Decimals(totalMotionDamage),
      bulletDamage: roundTo3Decimals(totalBulletDamage),
      motionPhys: roundTo3Decimals(motionPhysDmg),
      motionMag: roundTo3Decimals(motionMagDmg),
      motionFire: roundTo3Decimals(motionFireDmg),
      motionLtn: roundTo3Decimals(motionLtnDmg),
      motionHoly: roundTo3Decimals(motionHolyDmg),
      bulletPhys: roundTo3Decimals(bulletPhysDmg),
      bulletMag: roundTo3Decimals(bulletMagDmg),
      bulletFire: roundTo3Decimals(bulletFireDmg),
      bulletLtn: roundTo3Decimals(bulletLtnDmg),
      bulletHoly: roundTo3Decimals(bulletHolyDmg),
    });
  }

  return {
    aowName: input.aowName,
    swordArtsId,
    requirements: {
      strength: weapon.requirements.strength > 0 ? weapon.requirements.strength : '-',
      dexterity: weapon.requirements.dexterity > 0 ? weapon.requirements.dexterity : '-',
      intelligence: weapon.requirements.intelligence > 0 ? weapon.requirements.intelligence : '-',
      faith: weapon.requirements.faith > 0 ? weapon.requirements.faith : '-',
      arcane: weapon.requirements.arcane > 0 ? weapon.requirements.arcane : '-',
    },
    attacks: attackResults,
  };
}

/**
 * Get list of available AoW names for a specific weapon class and affinity
 *
 * @param aowData - Precomputed AoW data
 * @param weaponClass - Weapon class name (e.g., "Dagger", "Straight Sword")
 * @param affinity - Affinity name (e.g., "Standard", "Heavy", "Keen")
 * @returns List of AoW names that are compatible with the weapon class and affinity
 */
export function getAvailableAowNames(
  aowData: PrecomputedAowData,
  weaponClass?: string,
  affinity?: string
): string[] {
  // Get the field names for filtering (if provided)
  const weaponClassField = weaponClass
    ? aowData.weaponClassMountFieldMap[weaponClass]
    : null;
  const affinityField = affinity
    ? aowData.affinityConfigFieldMap[affinity]
    : null;

  // If weapon class specified but not found in mapping, return empty array
  // (weapon doesn't support AoWs, e.g., bows, staves, seals)
  if (weaponClass && !weaponClassField) {
    return [];
  }

  // If affinity specified but not found in mapping, return empty array
  if (affinity && !affinityField) {
    return [];
  }

  // Filter AoWs based on EquipParamGem compatibility
  // Only return skills that have a gem entry (mountable Ashes of War)
  const availableAows: string[] = [];

  for (const aowName of Object.keys(aowData.swordArtsByName)) {
    const swordArtsId = aowData.swordArtsByName[aowName];
    const gemId = aowData.swordArtsIdToGemId[swordArtsId];

    // Skip skills without gem entries (unique weapon skills)
    if (gemId === undefined) continue;

    const gem = aowData.equipParamGem[gemId];
    if (!gem) continue;

    // Check weapon class compatibility (if filter provided)
    if (weaponClassField) {
      const canMount = (gem as unknown as Record<string, boolean>)[weaponClassField];
      if (!canMount) continue;
    }

    // Check affinity compatibility (if filter provided)
    if (affinityField) {
      const canUseAffinity = (gem as unknown as Record<string, boolean>)[affinityField];
      if (!canUseAffinity) continue;
    }

    availableAows.push(aowName);
  }

  return availableAows.sort();
}

/**
 * Check if a weapon can have Ashes of War applied to it
 *
 * @param precomputed - Precomputed weapon data
 * @param weaponName - Name of the weapon to check
 * @returns true if the weapon can have AoWs applied (gemMountType === 2)
 */
export function canWeaponMountAoW(
  precomputed: PrecomputedDataV2,
  weaponName: string
): boolean {
  const weapon = precomputed.weapons[weaponName];
  if (!weapon) return false;

  // gemMountType === 2 means the weapon can have AoWs applied
  // gemMountType === 0 or 1 means unique weapons with fixed skills
  return weapon.gemMountType === 2;
}

/**
 * Get the built-in weapon skill name for a weapon
 *
 * @param aowData - Precomputed AoW data containing skillNames mappings
 * @param precomputed - Precomputed weapon data
 * @param weaponName - Name of the weapon
 * @returns The skill name, or null if not found
 */
export function getWeaponSkillName(
  aowData: PrecomputedAowData,
  precomputed: PrecomputedDataV2,
  weaponName: string
): string | null {
  const weapon = precomputed.weapons[weaponName];
  if (!weapon) return null;

  const swordArtsId = weapon.swordArtsParamId;
  if (!swordArtsId || swordArtsId === NO_SKILL_ID) return null;

  // Use skillNames which contains ALL skills (including unique weapon skills)
  return aowData.skillNames?.[swordArtsId] ?? null;
}

/**
 * Get attacks for a specific AoW
 */
export function getAowAttacks(
  aowData: PrecomputedAowData,
  aowName: string
): PrecomputedAowAttack[] {
  const swordArtsId = aowData.swordArtsByName[aowName];
  if (swordArtsId === undefined) return [];

  const swordArt = aowData.swordArts[swordArtsId];
  return swordArt?.attacks ?? [];
}

/**
 * Get list of unique skill names (skills that cannot be mounted on other weapons)
 *
 * These are skills that do NOT have a corresponding gem entry in EquipParamGem.
 * A skill is unique if:
 * 1. It exists in skillNames but has no gem entry (checked via swordArtsIdToGemId)
 * 2. Or it's in swordArtsByName but the swordArtsId has no gem mapping
 *
 * Examples include Corpse Piler, Waterfowl Dance, etc.
 *
 * @param aowData - Precomputed AoW data
 * @returns List of unique skill names sorted alphabetically
 */
export function getUniqueSkillNames(
  aowData: PrecomputedAowData
): string[] {
  if (!aowData.skillNames) return [];

  const uniqueSkills: string[] = [];
  const seenNames = new Set<string>();

  // Check skills in swordArtsByName that don't have gem entries
  for (const aowName of Object.keys(aowData.swordArtsByName)) {
    const swordArtsId = aowData.swordArtsByName[aowName];
    const gemId = aowData.swordArtsIdToGemId[swordArtsId];

    // If no gem entry, it's a unique skill (has attack data but not mountable)
    if (gemId === undefined) {
      uniqueSkills.push(aowName);
      seenNames.add(aowName);
    }
  }

  // Also check skillNames for any skills not in swordArtsByName
  // These are skills that exist but have no attack data in our system
  for (const [idStr, skillName] of Object.entries(aowData.skillNames)) {
    if (seenNames.has(skillName)) continue;

    const id = parseInt(idStr, 10);
    const gemId = aowData.swordArtsIdToGemId[id];

    // If no gem entry and not already added, it's a unique skill
    if (gemId === undefined && !seenNames.has(skillName)) {
      uniqueSkills.push(skillName);
      seenNames.add(skillName);
    }
  }

  return uniqueSkills.sort();
}
