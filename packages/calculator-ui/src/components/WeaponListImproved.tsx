import { ChevronDown, ChevronUp, Skull, TrendingUp, Star } from "lucide-react";
import { StarButton } from './builds/StarButton.js';
import React, {
  useState,
  useMemo,
  useEffect,
  useDeferredValue,
  memo,
  useCallback,
  useRef,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useIsMobile } from "./ui/use-mobile";
import { MobileWeaponCard, type CardVisibility } from "./MobileWeaponCard";
import {
  calculateAowDamage,
  calculateEnemyDamage,
  calculateSimpleEnemyDamage,
  canWeaponMountAoW,
  getAvailableAowNames,
  getEnemyByKey,
  getScalingGrade,
  getWeaponDamageTypes,
  getWeaponDpsData,
  getWeaponSkillName,
  getWeaponTrueCombos,
} from "../data";
import type {
  AowCalculatorResult,
  AttackDpsData,
  DamageBreakdownResult,
  EnemyData,
  PrecomputedAowData,
} from "../data";
import type {
  CharacterStats,
  PhysDamageType,
  PrecomputedDataV2,
  ScalingGrade as ScalingGradeType,
  StartingClass,
  StatConfig,
  WeaponListItem,
} from "../types";
import { INITIAL_CLASS_VALUES, WEAPON_SKILL_FILTER } from "../types";
import type { SolverOptimizationMode } from "../types/solverTypes";
import {
  calculateCriticalDamage,
  getCriticalMultiplier,
} from "../utils/criticalDamage";
import {
  calculateWeaponAR,
  calculateWeaponListAR,
  findOptimalStats,
} from "../utils/damageCalculator";
import { type RollType, getIncrementalEndurance } from "../utils/equipLoad";
import { ScalingGrade } from "./ScalingGrade";
import {
  ActiveFilterChips,
  getDefaultFilters,
} from "./ui/active-filter-chips";
import { ColumnFilter, type FilterValue } from "./ui/column-filter";

interface WeaponListProps {
  precomputed: PrecomputedDataV2;
  aowData: PrecomputedAowData | null;
  weapons: WeaponListItem[];
  statConfigs: Record<string, StatConfig>;
  currentStats: CharacterStats;
  selectedWeapon: WeaponListItem | null;
  onWeaponSelect: (weapon: WeaponListItem) => void;
  hasUnlockedStats: boolean;
  twoHanding?: boolean;
  pointsBudget: number;
  startingClass: StartingClass;
  // Column visibility props
  showScaling: boolean;
  showNumericalScaling?: boolean;
  showRequirements: boolean;
  showAttributeInvestments: boolean;
  showEfficiency: boolean;
  showStatusEffects: boolean;
  showSpellPower: boolean;
  showAowDamage: boolean;
  showGuardStats: boolean;
  showDps: boolean;
  showWeaponStats: boolean;
  groupBy?: 'none' | 'weapon-type' | 'affinity' | 'weapon';
  level: number;
  // Enemy damage props - use key instead of object to ensure stable reference for memoization
  selectedEnemyKey: string | null;
  // Ash of War filter
  selectedAowFilter: string | null;
  // Solver weight subtraction props
  subtractWeaponWeight: boolean;
  armorWeight: number;
  rollType: RollType;
  // Optimization mode for solver
  optimizationMode?: SolverOptimizationMode;
  // Column filters (shared between desktop and mobile)
  columnFilters: Record<string, FilterValue>;
  onColumnFilterChange: (columnKey: string, value: FilterValue | undefined) => void;
  onColumnFiltersReset: () => void;
  // Build/star functionality
  isWeaponStarred?: (weaponId: string) => boolean;
  onToggleWeaponStar?: (weaponId: string) => void;
  builds?: Array<{ id: string; name: string; weapons: string[] }>;
}

type SortKey =
  | null
  | "name"
  | "affinity"
  | "totalAR"
  | "criticalDamage"
  | "efficiency"
  | "damagePercent"
  | "physical"
  | "magic"
  | "fire"
  | "lightning"
  | "holy"
  | "strScaling"
  | "dexScaling"
  | "intScaling"
  | "faiScaling"
  | "arcScaling"
  | "strReq"
  | "dexReq"
  | "intReq"
  | "faiReq"
  | "arcReq"
  | "minLevel"
  | "pointsRequired"
  // Attribute Investments (deficits)
  | "strDeficit"
  | "dexDeficit"
  | "intDeficit"
  | "faiDeficit"
  | "arcDeficit"
  | "totalDeficit"
  | "weight"
  | "category"
  | "trueCombos"
  | "buffable"
  | "uniqueAttacks"
  | "bleed"
  | "frost"
  | "poison"
  | "scarletRot"
  | "sleep"
  | "madness"
  | "spellScaling"
  | "damageType"
  | "enemyDamage"
  | "enemyDamagePercent"
  // AoW Motion Damage
  | "aowMotionPhys"
  | "aowMotionMag"
  | "aowMotionFire"
  | "aowMotionLtn"
  | "aowMotionHoly"
  | "aowMotionTotal"
  // AoW Bullet Damage
  | "aowBulletPhys"
  | "aowBulletMag"
  | "aowBulletFire"
  | "aowBulletLtn"
  | "aowBulletHoly"
  | "aowBulletTotal"
  // AoW Total Damage
  | "aowTotalPhys"
  | "aowTotalMag"
  | "aowTotalFire"
  | "aowTotalLtn"
  | "aowTotalHoly"
  | "aowTotalDamage"
  | "aowEffectiveness"
  | "aowMotionEffectiveness"
  | "aowBulletEffectiveness"
  // Guard Stats
  | "guardPhys"
  | "guardMag"
  | "guardFire"
  | "guardLtn"
  | "guardHoly"
  | "guardBoost"
  // DPS (pre-calculated)
  | "r1Dps"
  | "r1ChainDps"
  | "r2Dps"
  | "r2ChainDps"
  // Optimal Stats
  | "strOptimal"
  | "dexOptimal"
  | "intOptimal"
  | "faiOptimal"
  | "arcOptimal"
  // Weapon Skill
  | "skillName"
  | "skillStrScaling"
  | "skillDexScaling"
  | "skillIntScaling"
  | "skillFaiScaling"
  | "skillArcScaling";
type SortDirection = "asc" | "desc";

/** Shows primary physical damage type (most frequent across base attacks) */
function PrimaryDamageType({ type }: { type: PhysDamageType | "-" }) {
  if (type === "-") {
    return <span className="text-[#5a5a5a] text-xs">-</span>;
  }
  return <span className="text-[#8b8b8b] text-xs">{type}</span>;
}

/**
 * Calculate the minimum character level to wield a weapon given a starting class.
 * Formula: classLevel + sum(max(0, weaponReq[stat] - classBase[stat]) for each damage stat)
 * When two-handing, STR is effectively multiplied by 1.5x, so we need less actual STR investment.
 */
function calculateMinLevel(
  requirements: {
    str: number;
    dex: number;
    int: number;
    fai: number;
    arc: number;
  },
  startingClass: StartingClass,
  twoHanding: boolean,
): number {
  const classData = INITIAL_CLASS_VALUES[startingClass];

  // Calculate levels needed above class base for each damage stat
  // When two-handing, effective STR is base * 1.5, so we need ceil(requirement / 1.5) actual STR
  const effectiveStrReq = twoHanding
    ? Math.ceil(requirements.str / 1.5)
    : requirements.str;
  const strLevels = Math.max(0, effectiveStrReq - classData.str);
  const dexLevels = Math.max(0, requirements.dex - classData.dex);
  const intLevels = Math.max(0, requirements.int - classData.int);
  const faiLevels = Math.max(0, requirements.fai - classData.fai);
  const arcLevels = Math.max(0, requirements.arc - classData.arc);

  return (
    classData.lvl + strLevels + dexLevels + intLevels + faiLevels + arcLevels
  );
}

/**
 * Calculate AoW damage breakdown for a weapon
 * Separates motion-based damage from bullet-based damage
 */
interface AowBreakdownParams {
  aowData: PrecomputedAowData;
  precomputed: PrecomputedDataV2;
  weaponName: string;
  affinityName: string;
  stats: CharacterStats;
  upgradeLevel: number;
  weaponClass: string;
  twoHanding: boolean;
  aowName: string;
  selectedEnemy: EnemyData | null;
  weapon: WeaponListItem;
}

function calculateAowDamageBreakdown(
  params: AowBreakdownParams,
): AowDamageBreakdown | null {
  const {
    aowData,
    precomputed,
    weaponName,
    affinityName,
    stats,
    twoHanding,
    aowName,
    weapon,
    selectedEnemy,
  } = params;

  // Early exit: check if weapon can use this AoW before doing expensive calculation
  if (weapon.isUnique) {
    // For unique weapons, check if the built-in skill matches the selected AoW
    const skillName = getWeaponSkillName(aowData, precomputed, weaponName);
    if (skillName !== aowName) {
      return null;
    }
  } else {
    // For non-unique weapons, check if the AoW is available for this weapon class and affinity
    const availableAows = getAvailableAowNames(
      aowData,
      weapon.categoryName,
      weapon.affinity,
    );
    if (!availableAows.includes(aowName)) {
      return null;
    }
  }

  const result = calculateAowDamage(aowData, precomputed, {
    weaponName,
    affinity: affinityName,
    upgradeLevel: params.upgradeLevel,
    weaponClass: params.weaponClass,
    strength: stats.str,
    dexterity: stats.dex,
    intelligence: stats.int,
    faith: stats.fai,
    arcane: stats.arc,
    twoHanding,
    ignoreRequirements: false,
    pvpMode: false,
    showLackingFp: false,
    aowName,
  });

  if (!result || result.error || result.attacks.length === 0) {
    return null;
  }

  const breakdown: AowDamageBreakdown = {
    motionPhys: 0,
    motionMag: 0,
    motionFire: 0,
    motionLtn: 0,
    motionHoly: 0,
    motionTotal: 0,
    bulletPhys: 0,
    bulletMag: 0,
    bulletFire: 0,
    bulletLtn: 0,
    bulletHoly: 0,
    bulletTotal: 0,
    totalPhys: 0,
    totalMag: 0,
    totalFire: 0,
    totalLtn: 0,
    totalHoly: 0,
    totalDamage: 0,
    rawTotalDamage: 0,
    rawMotionTotal: 0,
    rawBulletTotal: 0,
  };

  for (const attack of result.attacks) {
    // Determine attack attribute
    let attribute: "standard" | "strike" | "slash" | "pierce" = "standard";

    // Map string attribute to literal type
    const atkAttr = attack.attackAttribute.toLowerCase();
    if (atkAttr === "strike") attribute = "strike";
    else if (atkAttr === "slash") attribute = "slash";
    else if (atkAttr === "pierce") attribute = "pierce";
    else if (atkAttr === "-" || atkAttr === "standard") {
      // Fallback to weapon damage type
      // weapon.damageType is typically "Standard", "Strike", etc.
      // Need to normalize it
      const wepType = (weapon.damageType || "Standard").toLowerCase();
      if (wepType.includes("strike")) attribute = "strike";
      else if (wepType.includes("slash")) attribute = "slash";
      else if (wepType.includes("pierce")) attribute = "pierce";
      else attribute = "standard";
    }

    if (selectedEnemy) {
      // Calculate Motion Damage vs Enemy
      // We pass the calculated motion damage as the "AR" and use 100 for MVs
      const motionDamage = calculateEnemyDamage({
        baseAR: {
          physical: attack.motionPhys,
          magic: attack.motionMag,
          fire: attack.motionFire,
          lightning: attack.motionLtn,
          holy: attack.motionHoly,
        },
        motionValues: {
          physical: 100,
          magic: 100,
          fire: 100,
          lightning: 100,
          holy: 100,
        },
        attackAttribute: attribute,
        enemyDefenses: selectedEnemy.defenses,
      });

      // Calculate Bullet Damage vs Enemy
      const bulletDamage = calculateEnemyDamage({
        baseAR: {
          physical: attack.bulletPhys,
          magic: attack.bulletMag,
          fire: attack.bulletFire,
          lightning: attack.bulletLtn,
          holy: attack.bulletHoly,
        },
        motionValues: {
          physical: 100,
          magic: 100,
          fire: 100,
          lightning: 100,
          holy: 100,
        },
        attackAttribute: attribute, // Bullet attacks might use same attribute? Currently yes.
        enemyDefenses: selectedEnemy.defenses,
      });

      // Accumulate Motion
      breakdown.motionPhys += motionDamage.byType.physical;
      breakdown.motionMag += motionDamage.byType.magic;
      breakdown.motionFire += motionDamage.byType.fire;
      breakdown.motionLtn += motionDamage.byType.lightning;
      breakdown.motionHoly += motionDamage.byType.holy;
      breakdown.motionTotal += motionDamage.total;

      // Accumulate Bullet
      breakdown.bulletPhys += bulletDamage.byType.physical;
      breakdown.bulletMag += bulletDamage.byType.magic;
      breakdown.bulletFire += bulletDamage.byType.fire;
      breakdown.bulletLtn += bulletDamage.byType.lightning;
      breakdown.bulletHoly += bulletDamage.byType.holy;
      breakdown.bulletTotal += bulletDamage.total;

      // Accumulate Totals
      breakdown.totalPhys +=
        motionDamage.byType.physical + bulletDamage.byType.physical;
      breakdown.totalMag +=
        motionDamage.byType.magic + bulletDamage.byType.magic;
      breakdown.totalFire +=
        motionDamage.byType.fire + bulletDamage.byType.fire;
      breakdown.totalLtn +=
        motionDamage.byType.lightning + bulletDamage.byType.lightning;
      breakdown.totalHoly +=
        motionDamage.byType.holy + bulletDamage.byType.holy;
      breakdown.totalDamage += motionDamage.total + bulletDamage.total;
    } else {
      // RAW AR (Existing Logic)

      const phys = typeof attack.physical === "number" ? attack.physical : 0;
      const mag = typeof attack.magic === "number" ? attack.magic : 0;
      const fire = typeof attack.fire === "number" ? attack.fire : 0;
      const ltn = typeof attack.lightning === "number" ? attack.lightning : 0;
      const holy = typeof attack.holy === "number" ? attack.holy : 0;
      const total = phys + mag + fire + ltn + holy;

      breakdown.motionPhys += attack.motionPhys;
      breakdown.motionMag += attack.motionMag;
      breakdown.motionFire += attack.motionFire;
      breakdown.motionLtn += attack.motionLtn;
      breakdown.motionHoly += attack.motionHoly;
      breakdown.motionTotal += attack.motionDamage;

      breakdown.bulletPhys += attack.bulletPhys;
      breakdown.bulletMag += attack.bulletMag;
      breakdown.bulletFire += attack.bulletFire;
      breakdown.bulletLtn += attack.bulletLtn;
      breakdown.bulletHoly += attack.bulletHoly;
      breakdown.bulletTotal += attack.bulletDamage;

      breakdown.totalPhys += phys;
      breakdown.totalMag += mag;
      breakdown.totalFire += fire;
      breakdown.totalLtn += ltn;
      breakdown.totalHoly += holy;
      breakdown.totalDamage += total;
    }

    // Always accumulate Raw Total Damage (for efficiency/effectiveness calculation)
    breakdown.rawTotalDamage += attack.motionDamage + attack.bulletDamage;
    breakdown.rawMotionTotal += attack.motionDamage;
    breakdown.rawBulletTotal += attack.bulletDamage;
  }

  return breakdown;
}

// AoW damage breakdown by type
interface AowDamageBreakdown {
  motionPhys: number;
  motionMag: number;
  motionFire: number;
  motionLtn: number;
  motionHoly: number;
  motionTotal: number;
  bulletPhys: number;
  bulletMag: number;
  bulletFire: number;
  bulletLtn: number;
  bulletHoly: number;
  bulletTotal: number;
  totalPhys: number;
  totalMag: number;
  totalFire: number;
  totalLtn: number;
  totalHoly: number;
  totalDamage: number;
  rawTotalDamage: number;
  rawMotionTotal: number;
  rawBulletTotal: number;
}

/** Scaling grades for a weapon skill, per stat */
interface SkillScaling {
  str: ScalingGradeType;
  dex: ScalingGradeType;
  int: ScalingGradeType;
  fai: ScalingGradeType;
  arc: ScalingGradeType;
}

/** Numeric ordering for scaling grades, used for sorting */
const GRADE_ORDER: Record<ScalingGradeType, number> = {
  '-': 0, 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6,
};

/**
 * Compute skill scaling grades for a weapon's built-in skill.
 * For each stat, takes the max effective correction rate across all attacks and damage types,
 * then maps it to a letter grade using the same thresholds as weapon AR scaling.
 *
 * - Motion attacks: scaling comes from the weapon's own stat scaling (weapon AR × motion value)
 * - Bullet attacks: scaling comes from AttackElementCorrect correction rates
 */
function getWeaponSkillScaling(
  aowData: PrecomputedAowData,
  precomputed: PrecomputedDataV2,
  weaponName: string,
): SkillScaling | null {
  // Look up weapon entry
  const weapon = precomputed.weapons[weaponName];
  if (!weapon) return null;

  const affinity = weapon.affinities['Standard'];
  if (!affinity) return null;

  // Look up the weapon's swordArtsParamId
  const swordArtsParamId = weapon.swordArtsParamId;
  if (swordArtsParamId === undefined || swordArtsParamId < 0) return null;

  // Look up the sword art
  const swordArt = aowData.swordArts[swordArtsParamId];
  if (!swordArt || swordArt.attacks.length === 0) return null;

  // Weapon raw scaling values
  // These represent how the weapon's AR scales with each stat
  const ws = affinity.weaponScaling;
  const weaponScaling = {
    str: ws.strength ?? 0,
    dex: ws.dexterity ?? 0,
    int: ws.intelligence ?? 0,
    fai: ws.faith ?? 0,
    arc: ws.arcane ?? 0,
  };

  // Track max scaling per stat across all attacks
  const maxScaling = { str: 0, dex: 0, int: 0, fai: 0, arc: 0 };

  // AEC stat name mapping for field lookups
  const statKeys = [
    { stat: 'str' as const, aecName: 'Strength' },
    { stat: 'dex' as const, aecName: 'Dexterity' },
    { stat: 'int' as const, aecName: 'Magic' },
    { stat: 'fai' as const, aecName: 'Faith' },
    { stat: 'arc' as const, aecName: 'Luck' },
  ];

  const damageTypes = ['Physics', 'Magic', 'Fire', 'Thunder', 'Dark'];

  for (const attack of swordArt.attacks) {
    const hasMotion = attack.motionPhys > 0 || attack.motionMag > 0 ||
      attack.motionFire > 0 || attack.motionThun > 0 || attack.motionDark > 0;
    const hasBullet = attack.isAddBaseAtk && (attack.flatPhys > 0 || attack.flatMag > 0 ||
      attack.flatFire > 0 || attack.flatThun > 0 || attack.flatDark > 0);

    if (hasMotion) {
      // Motion attacks scale through weapon AR, so use weapon's own scaling
      for (const { stat } of statKeys) {
        maxScaling[stat] = Math.max(maxScaling[stat], weaponScaling[stat]);
      }
    }

    if (hasBullet && attack.overwriteAttackElementCorrectId >= 0) {
      // Bullet attacks with AEC override: check each stat × damage type
      const aec = aowData.attackElementCorrect[attack.overwriteAttackElementCorrectId];
      if (!aec) continue;

      for (const { stat, aecName } of statKeys) {
        for (const dmgType of damageTypes) {
          const affectsKey = `is${aecName}Correct_by${dmgType}`;
          if (!(aec as Record<string, unknown>)[affectsKey]) continue;

          const overrideKey = `overwrite${aecName}CorrectRate_by${dmgType}`;
          const overrideValue = (aec as Record<string, unknown>)[overrideKey] as number;

          if (overrideValue >= 0) {
            maxScaling[stat] = Math.max(maxScaling[stat], overrideValue);
          } else {
            // -1 means use weapon's own scaling
            maxScaling[stat] = Math.max(maxScaling[stat], weaponScaling[stat]);
          }
        }
      }
    } else if (hasBullet) {
      // Bullet attacks using weapon scaling (overwrite ID = -1)
      for (const { stat } of statKeys) {
        maxScaling[stat] = Math.max(maxScaling[stat], weaponScaling[stat]);
      }
    }
  }

  return {
    str: getScalingGrade(maxScaling.str) as ScalingGradeType,
    dex: getScalingGrade(maxScaling.dex) as ScalingGradeType,
    int: getScalingGrade(maxScaling.int) as ScalingGradeType,
    fai: getScalingGrade(maxScaling.fai) as ScalingGradeType,
    arc: getScalingGrade(maxScaling.arc) as ScalingGradeType,
  };
}

/**
 * Generic damage display - shows either AR or damage vs enemy
 * The same interface is used regardless of mode, making column rendering simple
 */
interface DamageDisplay {
  physical: number;
  magic: number;
  fire: number;
  lightning: number;
  holy: number;
  total: number;
}

interface WeaponWithCalculations extends WeaponListItem {
  calculatedDamage: number;
  totalAR: number;
  criticalDamage: number | null; // null if weapon cannot perform critical attacks
  optimalStats: Record<string, number>;
  meetsReqs: boolean;
  // Effective stats used for requirement checking (accounts for solver/two-handing)
  effectiveStats: {
    str: number;
    dex: number;
    int: number;
    fai: number;
    arc: number;
  };
  efficiency: number;
  totalStatsUsed: number;
  statsOverBudget: boolean;
  showScaling: boolean;
  showRequirements: boolean;
  showEfficiency: boolean;
  level: number;
  // Minimum level to wield this weapon given starting class
  minLevel: number;
  // Points required to invest to meet weapon requirements (0 if already met)
  pointsRequired: number;
  // Per-stat deficits (points needed per stat to meet requirements)
  strDeficit: number;
  dexDeficit: number;
  intDeficit: number;
  faiDeficit: number;
  arcDeficit: number;
  // Total deficit (sum of per-stat deficits)
  totalDeficit: number;
  // Max damage (all stats at 99) and percentage of max
  maxDamage: number;
  damagePercent: number;
  // Status effects
  bleed: number;
  frost: number;
  poison: number;
  scarletRot: number;
  sleep: number;
  madness: number;
  // Spell scaling (combined - same value for both sorcery and incantation when both exist)
  spellScaling: number;
  // Generic damage display - shows AR when no enemy selected, enemy damage when selected
  damageDisplay: DamageDisplay;
  // AR breakdown by damage type (for DPS calculations vs enemies)
  arBreakdown: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  };
  // Percentage of AR that hits the enemy (only shown when enemy is selected)
  enemyDamagePercent: number | null;
  // AoW damage breakdown (null when no AoW filter selected)
  aowDamage: AowDamageBreakdown | null;
  // Weapon skill name (only set when Weapon Skill filter is active)
  skillName: string | null;
  // Weapon skill scaling grades (only set when Weapon Skill filter is active)
  skillScaling: SkillScaling | null;
  // Guard stats (from WeaponListItem, but explicitly included here for clarity)
  // guardStats is inherited from WeaponListItem
  // Pre-calculated DPS values (null when no DPS data available for this weapon)
  r1Dps: number | null;
  r1ChainDps: number | null;
  r2Dps: number | null;
  r2ChainDps: number | null;
}

// Props for the memoized row cells component
interface WeaponRowCellsProps {
  weapon: WeaponWithCalculations;
  isSelected: boolean;
  showScaling: boolean;
  showNumericalScaling: boolean;
  showRequirements: boolean;
  showAttributeInvestments: boolean;
  showEfficiency: boolean;
  showStatusEffects: boolean;
  showSpellPower: boolean;
  showAowDamage: boolean;
  showGuardStats: boolean;
  showDps: boolean;
  showWeaponStats: boolean;
  hasUnlockedStats: boolean;
  twoHanding: boolean;
  // Pass enemy name directly instead of key to avoid lookup in each row
  selectedEnemyName: string | null;
  // Selected enemy data for DPS calculations
  selectedEnemy: EnemyData | null;
  // Ash of War filter
  selectedAowFilter: string | null;
  // Whether the "Weapon Skill" filter is active
  isWeaponSkillFilter: boolean;
  // AoW damage type flags (determined by AoW, not per-weapon)
  aowHasMotion: boolean;
  aowHasBullet: boolean;
  // Star/build functionality
  isStarred: boolean;
  onToggleStar?: (weaponId: string) => void;
}

// Memoized row cells component - returns just the <td> elements for table rows
const WeaponRowCells = memo(function WeaponRowCells({
  weapon,
  isSelected,
  showScaling,
  showNumericalScaling,
  showRequirements,
  showAttributeInvestments,
  showEfficiency,
  showStatusEffects,
  showSpellPower,
  showAowDamage,
  showGuardStats,
  showDps,
  showWeaponStats,
  hasUnlockedStats,
  twoHanding,
  selectedEnemyName,
  selectedEnemy,
  selectedAowFilter,
  isWeaponSkillFilter,
  aowHasMotion,
  aowHasBullet,
  isStarred,
  onToggleStar,
}: WeaponRowCellsProps) {
  // Determine which AoW column groups to show (respects both data availability and user toggle)
  const showAowMotion = showAowDamage && selectedAowFilter && aowHasMotion;
  const showAowBullet = showAowDamage && selectedAowFilter && aowHasBullet;
  const showAowTotal =
    showAowDamage && selectedAowFilter && aowHasMotion && aowHasBullet;
  return (
    <>
      {/* Star */}
      {onToggleStar && (
        <td
          className={`pl-[1rem] pr-1 py-2 ${
            isSelected ? "bg-[#2a2514]" : "bg-[#141414]"
          }`}
        >
          <StarButton
            isStarred={isStarred}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(weapon.id);
            }}
            size="sm"
          />
        </td>
      )}

      {/* Name */}
      <td
        className={`px-3 py-2 border-r border-[#1a1a1a] whitespace-nowrap text-xs ${
          isSelected ? "bg-[#2a2514]" : "bg-[#141414]"
        }`}
      >
        <div className="flex items-center gap-2">
          {weapon.name}
          {weapon.statsOverBudget && (
            <span
              className="text-[#f0ad4e] text-xs"
              title="Exceeds stat budget"
            >
              ⚠
            </span>
          )}
        </div>
      </td>

      {/* Type */}
      <td className="px-3 py-2 text-[#8b8b8b] text-xs border-r border-[#1a1a1a] whitespace-nowrap">
        {weapon.categoryName}
      </td>

      {/* Affinity */}
      <td className={`px-3 py-2 text-[#8b8b8b] text-xs whitespace-nowrap ${!showWeaponStats ? 'border-r border-[#1a1a1a]' : ''}`}>
        {weapon.isUnique ? "Unique" : weapon.affinity}
      </td>

      {/* Weapon Stats (Dmg, Wgt, TC, Buff, Uniq) */}
      {showWeaponStats && (
        <>
          {/* Damage Types */}
          <td className="px-2 py-2 border-r border-[#1a1a1a]">
            <PrimaryDamageType type={weapon.damageType} />
          </td>

          {/* Weight */}
          <td className="px-2 py-2 text-center text-xs text-[#8b8b8b]">
            {weapon.weight}
          </td>

          {/* True Combos */}
          <td className="px-2 py-2 text-center text-xs text-[#8b8b8b]">
            {weapon.trueCombos || "-"}
          </td>

          {/* Buffable */}
          <td
            className="px-2 py-2 text-center text-xs text-[#9370db]"
            title={
              weapon.isBuffable
                ? "Can be buffed with greases and spells"
                : "Cannot be buffed"
            }
          >
            {weapon.isBuffable ? "✓" : "-"}
          </td>

          {/* Unique Attacks */}
          <td
            className="px-2 py-2 text-center text-xs text-[#9b59b6] border-r border-[#1a1a1a]"
            title={
              weapon.hasUniqueAttacks
                ? "Has unique attack animations compared to weapon class"
                : "Uses standard attack animations"
            }
          >
            {weapon.hasUniqueAttacks ? "✓" : "-"}
          </td>
        </>
      )}

      {/* Attack Power / Enemy Damage (uses damageDisplay for unified rendering) */}
      <td className="px-2 py-2 text-center text-xs text-[#9a9a9a]">
        {Math.round(weapon.damageDisplay.physical) || "-"}
      </td>
      <td className="px-2 py-2 text-center text-xs text-[#5bc0de]">
        {Math.round(weapon.damageDisplay.magic) || "-"}
      </td>
      <td className="px-2 py-2 text-center text-xs text-[#f0ad4e]">
        {Math.round(weapon.damageDisplay.fire) || "-"}
      </td>
      <td className="px-2 py-2 text-center text-xs text-[#f4e04d]">
        {Math.round(weapon.damageDisplay.lightning) || "-"}
      </td>
      <td className="px-2 py-2 text-center text-xs text-[#d4af37]">
        {Math.round(weapon.damageDisplay.holy) || "-"}
      </td>
      <td className="px-2 py-2 text-center text-xs">
        {Math.round(weapon.damageDisplay.total)}
      </td>
      <td
        className={`px-2 py-2 text-center text-xs ${selectedEnemyName ? "" : "border-r border-[#1a1a1a]"}`}
        title={
          weapon.criticalDamage !== null
            ? `Critical: ${weapon.criticalValue} × ${getCriticalMultiplier(weapon.category)}x`
            : "Cannot perform critical attacks"
        }
      >
        {weapon.criticalDamage ?? "-"}
      </td>
      {/* Enemy Damage % - only shown when enemy is selected */}
      {selectedEnemyName && (
        <td
          className="px-2 py-2 text-center text-xs text-[#e06666] border-r border-[#1a1a1a]"
          title="Percentage of AR dealt to enemy"
        >
          {weapon.enemyDamagePercent !== null
            ? `${weapon.enemyDamagePercent.toFixed(0)}%`
            : "-"}
        </td>
      )}

      {/* Weapon Skill Name + Scaling (only when Weapon Skill filter is active) */}
      {isWeaponSkillFilter && (
        <>
          <td className="px-2 py-2 text-xs text-[#c8c8c8] whitespace-nowrap">
            {weapon.skillName ?? "-"}
          </td>
          <td className="px-2 py-2 text-center">
            {weapon.skillScaling ? (
              <ScalingGrade grade={weapon.skillScaling.str} stat="STR" showLabel={false} />
            ) : "-"}
          </td>
          <td className="px-2 py-2 text-center">
            {weapon.skillScaling ? (
              <ScalingGrade grade={weapon.skillScaling.dex} stat="DEX" showLabel={false} />
            ) : "-"}
          </td>
          <td className="px-2 py-2 text-center">
            {weapon.skillScaling ? (
              <ScalingGrade grade={weapon.skillScaling.int} stat="INT" showLabel={false} />
            ) : "-"}
          </td>
          <td className="px-2 py-2 text-center">
            {weapon.skillScaling ? (
              <ScalingGrade grade={weapon.skillScaling.fai} stat="FAI" showLabel={false} />
            ) : "-"}
          </td>
          <td className="px-2 py-2 text-center border-r border-[#1a1a1a]">
            {weapon.skillScaling ? (
              <ScalingGrade grade={weapon.skillScaling.arc} stat="ARC" showLabel={false} />
            ) : "-"}
          </td>
        </>
      )}

      {/* AoW Motion Damage */}
      {showAowMotion && (
        <>
          <td className="px-2 py-2 text-center text-xs text-[#9a9a9a]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.motionPhys) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#5bc0de]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.motionMag) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#f0ad4e]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.motionFire) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#f4e04d]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.motionLtn) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#d4af37]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.motionHoly) || "-"
              : "-"}
          </td>
          <td
            className={`px-2 py-2 text-center text-xs ${showAowBullet || showAowTotal ? "border-r border-[#1a1a1a]" : ""}`}
          >
            {weapon.aowDamage ? Math.round(weapon.aowDamage.motionTotal) : "-"}
          </td>
          {selectedEnemyName && (
            <td
              className={`px-2 py-2 text-center text-xs text-[#e06666] ${showAowBullet || showAowTotal ? "border-r border-[#1a1a1a]" : ""}`}
            >
              {weapon.aowDamage && weapon.aowDamage.rawMotionTotal > 0
                ? Math.round(
                    (weapon.aowDamage.motionTotal /
                      weapon.aowDamage.rawMotionTotal) *
                      100,
                  )
                : "-"}
              %
            </td>
          )}
        </>
      )}

      {/* AoW Bullet Damage */}
      {showAowBullet && (
        <>
          <td className="px-2 py-2 text-center text-xs text-[#9a9a9a]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.bulletPhys) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#5bc0de]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.bulletMag) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#f0ad4e]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.bulletFire) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#f4e04d]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.bulletLtn) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#d4af37]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.bulletHoly) || "-"
              : "-"}
          </td>
          <td
            className={`px-2 py-2 text-center text-xs ${showAowTotal ? "border-r border-[#1a1a1a]" : ""}`}
          >
            {weapon.aowDamage ? Math.round(weapon.aowDamage.bulletTotal) : "-"}
          </td>
          {selectedEnemyName && (
            <td
              className={`px-2 py-2 text-center text-xs text-[#e06666] ${showAowTotal ? "border-r border-[#1a1a1a]" : ""}`}
            >
              {weapon.aowDamage && weapon.aowDamage.rawBulletTotal > 0
                ? Math.round(
                    (weapon.aowDamage.bulletTotal /
                      weapon.aowDamage.rawBulletTotal) *
                      100,
                  )
                : "-"}
              %
            </td>
          )}
        </>
      )}

      {/* AoW Total Damage */}
      {showAowTotal && (
        <>
          <td className="px-2 py-2 text-center text-xs text-[#9a9a9a]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.totalPhys) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#5bc0de]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.totalMag) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#f0ad4e]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.totalFire) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#f4e04d]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.totalLtn) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#d4af37]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.totalHoly) || "-"
              : "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs border-r border-[#1a1a1a]">
            {weapon.aowDamage
              ? Math.round(weapon.aowDamage.totalDamage) || "-"
              : "-"}
          </td>
          {selectedEnemyName && (
            <td className="px-2 py-2 text-center text-xs text-[#e06666] border-r border-[#1a1a1a]">
              {weapon.aowDamage && weapon.aowDamage.rawTotalDamage > 0
                ? Math.round(
                    (weapon.aowDamage.totalDamage /
                      weapon.aowDamage.rawTotalDamage) *
                      100,
                  )
                : "-"}
              %
            </td>
          )}
        </>
      )}

      {/* DPS (pre-calculated, or calculated vs enemy if selected) */}
      {showDps && (() => {
        const dpsData = getWeaponDpsData(weapon.name);
        const grip = twoHanding ? dpsData?.twoHanded : dpsData?.oneHanded;

        // Helper to calculate DPS for a given attack type
        const calcDps = (attackData: AttackDpsData | null | undefined) => {
          if (!attackData) return null;

          // When enemy is selected, calculate actual damage vs enemy
          if (selectedEnemy) {
            // Handle '-' (no physical damage) by defaulting to 'physical' defense type
            const physDefenseType = weapon.damageType === 'Standard' || weapon.damageType === '-'
              ? 'physical'
              : weapon.damageType.toLowerCase() as 'strike' | 'slash' | 'pierce';

            // Scale AR by motion value
            const scaledAR = {
              physical: weapon.arBreakdown.physical * (attackData.mv / 100),
              magic: weapon.arBreakdown.magic * (attackData.mv / 100),
              fire: weapon.arBreakdown.fire * (attackData.mv / 100),
              lightning: weapon.arBreakdown.lightning * (attackData.mv / 100),
              holy: weapon.arBreakdown.holy * (attackData.mv / 100),
            };

            const enemyDamage = calculateSimpleEnemyDamage(scaledAR, physDefenseType, selectedEnemy.defenses);
            const durationSeconds = attackData.frames / 30; // 30 fps
            return durationSeconds > 0 ? Math.round(enemyDamage / durationSeconds) : null;
          }

          // No enemy selected - use pre-calculated AR-based DPS
          return Math.round(weapon.totalAR * attackData.dpsMultiplier);
        };

        const r1Dps = calcDps(grip?.r1);
        const r1ChainDps = calcDps(grip?.r1Chain);
        const r2Dps = calcDps(grip?.r2);
        const r2ChainDps = calcDps(grip?.r2Chain);

        return (
          <>
            <td className="px-2 py-2 text-center text-xs">
              {r1Dps ?? '-'}
            </td>
            <td className="px-2 py-2 text-center text-xs">
              {r1ChainDps ?? '-'}
            </td>
            <td className="px-2 py-2 text-center text-xs">
              {r2Dps ?? '-'}
            </td>
            <td className="px-2 py-2 text-center text-xs border-r border-[#1a1a1a]">
              {r2ChainDps ?? '-'}
            </td>
          </>
        );
      })()}

      {/* Spell Power */}
      {showSpellPower && (
        <td className="px-2 py-2 text-center text-xs text-[#9370db] border-r border-[#1a1a1a]">
          {weapon.spellScaling || "-"}
        </td>
      )}

      {/* Efficiency */}
      {showEfficiency && (
        <>
          <td
            className="px-3 py-2 text-center text-xs"
            title={`${weapon.calculatedDamage} damage / ${weapon.totalStatsUsed} stat points`}
          >
            <span className="text-[#8b8b8b]">
              {weapon.efficiency.toFixed(1)}
            </span>
          </td>
          <td
            className="px-3 py-2 text-center text-xs border-r border-[#1a1a1a] text-[#8b8b8b]"
            title={`${weapon.calculatedDamage} / ${weapon.maxDamage} max damage`}
          >
            {weapon.damagePercent.toFixed(1)}%
          </td>
        </>
      )}

      {/* Optimal Stats */}
      {hasUnlockedStats && (
        <>
          <td className="px-2 py-2 text-center text-xs">
            {weapon.optimalStats.str || "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs">
            {weapon.optimalStats.dex || "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs">
            {weapon.optimalStats.int || "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs">
            {weapon.optimalStats.fai || "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs border-r border-[#1a1a1a]">
            {weapon.optimalStats.arc || "-"}
          </td>
        </>
      )}

      {/* Attribute Scaling */}
      {showScaling && (
        <>
          <td className="px-2 py-2 text-center">
            {showNumericalScaling ? (
              <span className="text-[#8b8b8b] text-xs">{weapon.rawScaling.str ? weapon.rawScaling.str.toFixed(1) : "-"}</span>
            ) : (
              <ScalingGrade
                grade={weapon.scaling.str}
                stat="STR"
                showLabel={false}
              />
            )}
          </td>
          <td className="px-2 py-2 text-center">
            {showNumericalScaling ? (
              <span className="text-[#8b8b8b] text-xs">{weapon.rawScaling.dex ? weapon.rawScaling.dex.toFixed(1) : "-"}</span>
            ) : (
              <ScalingGrade
                grade={weapon.scaling.dex}
                stat="DEX"
                showLabel={false}
              />
            )}
          </td>
          <td className="px-2 py-2 text-center">
            {showNumericalScaling ? (
              <span className="text-[#8b8b8b] text-xs">{weapon.rawScaling.int ? weapon.rawScaling.int.toFixed(1) : "-"}</span>
            ) : (
              <ScalingGrade
                grade={weapon.scaling.int}
                stat="INT"
                showLabel={false}
              />
            )}
          </td>
          <td className="px-2 py-2 text-center">
            {showNumericalScaling ? (
              <span className="text-[#8b8b8b] text-xs">{weapon.rawScaling.fai ? weapon.rawScaling.fai.toFixed(1) : "-"}</span>
            ) : (
              <ScalingGrade
                grade={weapon.scaling.fai}
                stat="FAI"
                showLabel={false}
              />
            )}
          </td>
          <td className="px-2 py-2 text-center border-r border-[#1a1a1a]">
            {showNumericalScaling ? (
              <span className="text-[#8b8b8b] text-xs">{weapon.rawScaling.arc ? weapon.rawScaling.arc.toFixed(1) : "-"}</span>
            ) : (
              <ScalingGrade
                grade={weapon.scaling.arc}
                stat="ARC"
                showLabel={false}
              />
            )}
          </td>
        </>
      )}

      {/* Attributes Required */}
      {showRequirements && (
        <>
          <td className={`px-2 py-2 text-center text-xs ${
            !weapon.requirements.str || weapon.effectiveStats.str >= weapon.requirements.str
              ? "text-[#8b8b8b]"
              : "text-[#c9302c]"
          }`}>
            {weapon.requirements.str || "-"}
          </td>
          <td className={`px-2 py-2 text-center text-xs ${
            !weapon.requirements.dex || weapon.effectiveStats.dex >= weapon.requirements.dex
              ? "text-[#8b8b8b]"
              : "text-[#c9302c]"
          }`}>
            {weapon.requirements.dex || "-"}
          </td>
          <td className={`px-2 py-2 text-center text-xs ${
            !weapon.requirements.int || weapon.effectiveStats.int >= weapon.requirements.int
              ? "text-[#8b8b8b]"
              : "text-[#c9302c]"
          }`}>
            {weapon.requirements.int || "-"}
          </td>
          <td className={`px-2 py-2 text-center text-xs ${
            !weapon.requirements.fai || weapon.effectiveStats.fai >= weapon.requirements.fai
              ? "text-[#8b8b8b]"
              : "text-[#c9302c]"
          }`}>
            {weapon.requirements.fai || "-"}
          </td>
          <td className={`px-2 py-2 text-center text-xs ${
            !weapon.requirements.arc || weapon.effectiveStats.arc >= weapon.requirements.arc
              ? "text-[#8b8b8b]"
              : "text-[#c9302c]"
          }`}>
            {weapon.requirements.arc || "-"}
          </td>
          <td
            className={`px-2 py-2 text-center text-xs border-r border-[#1a1a1a] ${weapon.meetsReqs ? 'text-[#5cb85c]' : 'text-[#d9534f]'}`}
            title={weapon.meetsReqs ? "Meets stat requirements" : "Does not meet stat requirements"}
          >
            {weapon.meetsReqs ? "✓" : "✗"}
          </td>
        </>
      )}

      {/* Attribute Investments */}
      {showAttributeInvestments && (
        <>
          <td className={`px-2 py-2 text-center text-xs ${
            weapon.strDeficit > 0 ? "text-[#d9534f]" : "text-[#8b8b8b]"
          }`}>
            {weapon.strDeficit || "-"}
          </td>
          <td className={`px-2 py-2 text-center text-xs ${
            weapon.dexDeficit > 0 ? "text-[#d9534f]" : "text-[#8b8b8b]"
          }`}>
            {weapon.dexDeficit || "-"}
          </td>
          <td className={`px-2 py-2 text-center text-xs ${
            weapon.intDeficit > 0 ? "text-[#d9534f]" : "text-[#8b8b8b]"
          }`}>
            {weapon.intDeficit || "-"}
          </td>
          <td className={`px-2 py-2 text-center text-xs ${
            weapon.faiDeficit > 0 ? "text-[#d9534f]" : "text-[#8b8b8b]"
          }`}>
            {weapon.faiDeficit || "-"}
          </td>
          <td className={`px-2 py-2 text-center text-xs ${
            weapon.arcDeficit > 0 ? "text-[#d9534f]" : "text-[#8b8b8b]"
          }`}>
            {weapon.arcDeficit || "-"}
          </td>
          <td
            className={`px-2 py-2 text-center text-xs ${weapon.totalDeficit === 0 ? 'text-[#5cb85c]' : 'text-[#d9534f]'}`}
            title={weapon.totalDeficit === 0 ? "Meets stat requirements" : `${weapon.totalDeficit} points needed to meet requirements`}
          >
            {weapon.totalDeficit}
          </td>
          <td
            className="px-2 py-2 text-center text-[#8b8b8b] text-xs"
            title="Minimum level to wield this weapon"
          >
            {weapon.minLevel}
          </td>
          <td
            className="px-2 py-2 text-center text-[#8b8b8b] text-xs border-r border-[#1a1a1a]"
            title="Points required to meet weapon requirements"
          >
            {weapon.pointsRequired}
          </td>
        </>
      )}

      {/* Status Effects */}
      {showStatusEffects && (
        <>
          <td className="px-2 py-2 text-center text-xs text-[#c9302c]">
            {weapon.bleed || "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#5bc0de]">
            {weapon.frost || "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#9c6]">
            {weapon.poison || "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#d9534f]">
            {weapon.scarletRot || "-"}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#9370db]">
            {weapon.sleep || "-"}
          </td>
          <td
            className={`px-2 py-2 text-center text-xs text-[#ff6b35] ${showGuardStats ? "" : "border-r border-[#1a1a1a]"}`}
          >
            {weapon.madness || "-"}
          </td>
        </>
      )}

      {/* Guard Stats */}
      {showGuardStats && (
        <>
          <td className="px-2 py-2 text-center text-xs text-[#9a9a9a]">
            {weapon.guardStats.physical.toFixed(1)}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#5bc0de]">
            {weapon.guardStats.magic.toFixed(1)}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#f0ad4e]">
            {weapon.guardStats.fire.toFixed(1)}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#f4e04d]">
            {weapon.guardStats.lightning.toFixed(1)}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#d4af37]">
            {weapon.guardStats.holy.toFixed(1)}
          </td>
          <td className="px-2 py-2 text-center text-xs text-[#8b8b8b] border-r border-[#1a1a1a]">
            {weapon.guardStats.guardBoost}
          </td>
        </>
      )}
    </>
  );
});

export function WeaponList({
  precomputed,
  aowData,
  weapons,
  statConfigs,
  currentStats,
  selectedWeapon,
  onWeaponSelect,
  hasUnlockedStats,
  twoHanding = false,
  pointsBudget,
  startingClass,
  showScaling,
  showNumericalScaling = false,
  showRequirements,
  showAttributeInvestments,
  showEfficiency,
  showStatusEffects,
  showSpellPower,
  showAowDamage,
  showGuardStats,
  showDps,
  showWeaponStats,
  groupBy = 'none',
  level,
  selectedEnemyKey,
  selectedAowFilter,
  subtractWeaponWeight,
  armorWeight,
  rollType,
  optimizationMode,
  // Column filters from parent
  columnFilters,
  onColumnFilterChange: updateColumnFilter,
  onColumnFiltersReset,
  // Build/star functionality
  isWeaponStarred,
  onToggleWeaponStar,
  builds = [],
}: WeaponListProps) {
  const isMobile = useIsMobile();
  const [sortKey, setSortKey] = useState<SortKey>("totalAR");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    // Clear to empty object (no filters)
    Object.keys(columnFilters).forEach(key => updateColumnFilter(key, undefined));
  }, [columnFilters, updateColumnFilter]);

  // Defer expensive values - keeps UI responsive while recalculating
  // React will show stale results while computing new ones
  const deferredStats = useDeferredValue(currentStats);
  const deferredStatConfigs = useDeferredValue(statConfigs);
  const deferredPointsBudget = useDeferredValue(pointsBudget);
  const deferredStartingClass = useDeferredValue(startingClass);
  const deferredSelectedEnemyKey = useDeferredValue(selectedEnemyKey);
  const deferredSelectedAowFilter = useDeferredValue(selectedAowFilter);
  const deferredSubtractWeaponWeight = useDeferredValue(subtractWeaponWeight);
  const deferredArmorWeight = useDeferredValue(armorWeight);
  const deferredRollType = useDeferredValue(rollType);
  const deferredOptimizationMode = useDeferredValue(optimizationMode);
  const deferredColumnFilters = useDeferredValue(columnFilters);

  // Look up enemy data from key for use in header/calculations
  const selectedEnemy = selectedEnemyKey
    ? getEnemyByKey(selectedEnemyKey)
    : null;
  const deferredSelectedEnemy = deferredSelectedEnemyKey
    ? getEnemyByKey(deferredSelectedEnemyKey)
    : null;

  // Show loading indicator when deferred values are stale
  const isStale =
    deferredStats !== currentStats ||
    deferredStatConfigs !== statConfigs ||
    deferredPointsBudget !== pointsBudget ||
    deferredStartingClass !== startingClass ||
    deferredSelectedEnemyKey !== selectedEnemyKey ||
    deferredSelectedAowFilter !== selectedAowFilter ||
    deferredSubtractWeaponWeight !== subtractWeaponWeight ||
    deferredArmorWeight !== armorWeight ||
    deferredRollType !== rollType ||
    deferredOptimizationMode !== optimizationMode ||
    deferredColumnFilters !== columnFilters;

  // Auto-switch to sorting by total AR when solver becomes active
  useEffect(() => {
    if (hasUnlockedStats && sortKey === "physical") {
      setSortKey("totalAR");
      // setShowEfficiency(true); // Controlled by parent now
    }
  }, [hasUnlockedStats, sortKey]);

  // Calculate budget: total available stat points (uses deferred for smoother input)
  const availableBudget = useMemo(() => {
    const budgetStats = [
      "vig",
      "mnd",
      "end",
      "str",
      "dex",
      "int",
      "fai",
      "arc",
    ];
    return budgetStats.reduce((sum, stat) => {
      if (deferredStatConfigs[stat].locked) {
        return sum + (deferredStatConfigs[stat].value || 0);
      }
      return sum + (deferredStatConfigs[stat].max || 0);
    }, 0);
  }, [deferredStatConfigs]);

  // Generate unique values for filterable columns (for set filters)
  const uniqueColumnValues = useMemo(() => {
    const damageTypes = new Set<string>();
    const scalingGrades = new Set<string>();
    const categoryNames = new Set<string>();
    const affinities = new Set<string>();

    weapons.forEach((weapon) => {
      damageTypes.add(weapon.damageType);
      categoryNames.add(weapon.categoryName);
      // For affinity, show "Unique" for unique weapons, otherwise show their actual affinity
      affinities.add(weapon.isUnique ? "Unique" : weapon.affinity);
      // Add scaling grades for reference
      scalingGrades.add(weapon.scaling.str);
      scalingGrades.add(weapon.scaling.dex);
      scalingGrades.add(weapon.scaling.int);
      scalingGrades.add(weapon.scaling.fai);
      scalingGrades.add(weapon.scaling.arc);
    });

    return {
      damageType: Array.from(damageTypes).sort(),
      scalingGrade: ["-", "E", "D", "C", "B", "A", "S"],
      categoryName: Array.from(categoryNames).sort(),
      affinity: Array.from(affinities).sort(),
    };
  }, [weapons]);

  // Helper to apply column filter to a weapon
  const passesColumnFilter = useCallback(
    (weapon: WeaponWithCalculations, filters: Record<string, FilterValue>) => {
      for (const [columnKey, filter] of Object.entries(filters)) {
        if (!filter) continue;

        // Text filters (substring match)
        if (filter.type === "text") {
          let value: string | null;
          switch (columnKey) {
            case "name":
              value = weapon.name;
              break;
            case "skillName":
              value = weapon.skillName;
              break;
            default:
              continue;
          }
          if (!value || !value.toLowerCase().includes(filter.value.toLowerCase())) return false;
        }

        // Set filters (categorical)
        if (filter.type === "set") {
          // Special handling for "starred" - check if weapon is in any selected build
          if (columnKey === "starred") {
            const selectedBuildNames = filter.values;
            const weaponInSelectedBuild = builds.some(build =>
              selectedBuildNames.has(build.name) &&
              build.weapons.includes(weapon.id)
            );
            if (!weaponInSelectedBuild) return false;
            continue;
          }

          // Special handling for status effects — OR logic (weapon has ANY selected effect)
          if (columnKey === "statusEffects") {
            const effectMap: Record<string, number> = {
              Bleed: weapon.bleed,
              Frost: weapon.frost,
              Poison: weapon.poison,
              'Scarlet Rot': weapon.scarletRot,
              Sleep: weapon.sleep,
              Madness: weapon.madness,
            };
            const hasAny = [...filter.values].some((name) => (effectMap[name] ?? 0) > 0);
            if (!hasAny) return false;
            continue;
          }

          let value: string;
          switch (columnKey) {
            case "damageType":
              value = weapon.damageType;
              break;
            case "categoryName":
              value = weapon.categoryName;
              break;
            case "affinity":
              // For unique weapons, map to "Unique" pseudo-affinity
              value = weapon.isUnique ? "Unique" : weapon.affinity;
              break;
            case "strScalingGrade":
              value = weapon.scaling.str;
              break;
            case "dexScalingGrade":
              value = weapon.scaling.dex;
              break;
            case "intScalingGrade":
              value = weapon.scaling.int;
              break;
            case "faiScalingGrade":
              value = weapon.scaling.fai;
              break;
            case "arcScalingGrade":
              value = weapon.scaling.arc;
              break;
            case "skillStrScalingGrade":
              value = weapon.skillScaling?.str ?? '-';
              break;
            case "skillDexScalingGrade":
              value = weapon.skillScaling?.dex ?? '-';
              break;
            case "skillIntScalingGrade":
              value = weapon.skillScaling?.int ?? '-';
              break;
            case "skillFaiScalingGrade":
              value = weapon.skillScaling?.fai ?? '-';
              break;
            case "skillArcScalingGrade":
              value = weapon.skillScaling?.arc ?? '-';
              break;
            default:
              continue;
          }
          if (!filter.values.has(value)) return false;
        }

        // Range filters (numeric)
        if (filter.type === "range") {
          let value: number;
          switch (columnKey) {
            case "weight":
              value = weapon.weight;
              break;
            case "totalAR":
              value = weapon.damageDisplay.total;
              break;
            case "criticalDamage":
              value = weapon.criticalDamage ?? 0;
              break;
            case "efficiency":
              value = weapon.efficiency;
              break;
            case "damagePercent":
              value = weapon.damagePercent;
              break;
            case "physical":
              value = weapon.damageDisplay.physical;
              break;
            case "magic":
              value = weapon.damageDisplay.magic;
              break;
            case "fire":
              value = weapon.damageDisplay.fire;
              break;
            case "lightning":
              value = weapon.damageDisplay.lightning;
              break;
            case "holy":
              value = weapon.damageDisplay.holy;
              break;
            case "strScaling":
              value = weapon.rawScaling.str;
              break;
            case "dexScaling":
              value = weapon.rawScaling.dex;
              break;
            case "intScaling":
              value = weapon.rawScaling.int;
              break;
            case "faiScaling":
              value = weapon.rawScaling.fai;
              break;
            case "arcScaling":
              value = weapon.rawScaling.arc;
              break;
            case "strReq":
              value = weapon.requirements.str;
              break;
            case "dexReq":
              value = weapon.requirements.dex;
              break;
            case "intReq":
              value = weapon.requirements.int;
              break;
            case "faiReq":
              value = weapon.requirements.fai;
              break;
            case "arcReq":
              value = weapon.requirements.arc;
              break;
            case "minLevel":
              value = weapon.minLevel;
              break;
            case "pointsRequired":
              value = weapon.pointsRequired;
              break;
            case "strDeficit":
              value = weapon.strDeficit;
              break;
            case "dexDeficit":
              value = weapon.dexDeficit;
              break;
            case "intDeficit":
              value = weapon.intDeficit;
              break;
            case "faiDeficit":
              value = weapon.faiDeficit;
              break;
            case "arcDeficit":
              value = weapon.arcDeficit;
              break;
            case "totalDeficit":
              value = weapon.totalDeficit;
              break;
            case "bleed":
              value = weapon.bleed;
              break;
            case "frost":
              value = weapon.frost;
              break;
            case "poison":
              value = weapon.poison;
              break;
            case "scarletRot":
              value = weapon.scarletRot;
              break;
            case "sleep":
              value = weapon.sleep;
              break;
            case "madness":
              value = weapon.madness;
              break;
            case "spellScaling":
              value = weapon.spellScaling;
              break;
            case "trueCombos":
              value = weapon.trueCombos;
              break;
            case "guardPhys":
              value = weapon.guardStats.physical;
              break;
            case "guardMag":
              value = weapon.guardStats.magic;
              break;
            case "guardFire":
              value = weapon.guardStats.fire;
              break;
            case "guardLtn":
              value = weapon.guardStats.lightning;
              break;
            case "guardHoly":
              value = weapon.guardStats.holy;
              break;
            case "guardBoost":
              value = weapon.guardStats.guardBoost;
              break;
            // AoW damage columns
            case "aowMotionTotal":
              value = weapon.aowDamage?.motionTotal ?? 0;
              break;
            case "aowBulletTotal":
              value = weapon.aowDamage?.bulletTotal ?? 0;
              break;
            case "aowTotalDamage":
              value = weapon.aowDamage?.totalDamage ?? 0;
              break;
            default:
              continue;
          }
          if (filter.min !== undefined && value < filter.min) return false;
          if (filter.max !== undefined && value > filter.max) return false;
        }

        // Boolean filters
        if (filter.type === "boolean" && filter.value !== null) {
          let value: boolean;
          switch (columnKey) {
            case "buffable":
              value = weapon.isBuffable;
              break;
            case "uniqueAttacks":
              value = weapon.hasUniqueAttacks;
              break;
            case "meetsReqs":
              value = weapon.meetsReqs;
              break;
            default:
              continue;
          }
          if (value !== filter.value) return false;
        }
      }
      return true;
    },
    [builds],
  );

  // PERFORMANCE FIX: Apply basic filters (name, type, affinity) BEFORE expensive AR calculations
  // These filters don't depend on calculated values, so we can filter first
  // Advanced filters (meetsReqs, damage ranges, etc.) are applied after AR calculation
  const preFilteredWeapons = useMemo(() => {
    const nameFilter = deferredColumnFilters['name'];
    const typeFilter = deferredColumnFilters['categoryName'];
    const affinityFilter = deferredColumnFilters['affinity'];

    // If no basic filters, return all weapons
    if (!nameFilter && !typeFilter && !affinityFilter) {
      return weapons;
    }

    return weapons.filter((weapon) => {
      // Text filter for name
      if (nameFilter?.type === 'text' && nameFilter.value) {
        if (!weapon.name.toLowerCase().includes(nameFilter.value.toLowerCase())) {
          return false;
        }
      }

      // Set filter for category/type
      if (typeFilter?.type === 'set') {
        if (!typeFilter.values.has(weapon.categoryName)) {
          return false;
        }
      }

      // Set filter for affinity (with Unique pseudo-affinity handling)
      if (affinityFilter?.type === 'set') {
        const affinityValue = weapon.isUnique ? 'Unique' : weapon.affinity;
        if (!affinityFilter.values.has(affinityValue)) {
          return false;
        }
      }

      return true;
    });
  }, [weapons, deferredColumnFilters]);

  // Calculate AR only for filtered weapons (much faster than calculating for all 3113)
  // Uses deferred stats so stat input sliders stay responsive
  const filteredWeapons = useMemo(() => {
    // Calculate AR for filtered weapons only
    const weaponsWithAR = calculateWeaponListAR(
      precomputed,
      preFilteredWeapons,
      deferredStats,
      { twoHanding },
    );

    const calculated = weaponsWithAR.map((weapon) => {
      // If solver is enabled, calculate optimal stats
      let optimalStats: Record<string, number> =
        deferredStats as unknown as Record<string, number>;

      if (hasUnlockedStats) {
        // Calculate adjusted points budget if subtracting weapon weight
        let adjustedPointsBudget = deferredPointsBudget;
        if (deferredSubtractWeaponWeight && weapon.weight > 0) {
          const { incrementalEndurance } = getIncrementalEndurance(
            deferredArmorWeight,
            weapon.weight,
            deferredRollType,
          );
          adjustedPointsBudget = Math.max(
            0,
            deferredPointsBudget - incrementalEndurance,
          );
        }

        const optimal = findOptimalStats(
          precomputed,
          weapon.name,
          weapon.affinity,
          weapon.upgradeLevel,
          deferredStatConfigs,
          {
            twoHanding,
            pointsBudget: adjustedPointsBudget,
            optimizationMode: deferredOptimizationMode,
            aowData,
            aowName: deferredSelectedAowFilter,
          },
        );
        optimalStats = optimal.stats as unknown as Record<string, number>;
      }

      // Calculate weapon AR with optimal stats (always needed for totalAR display)
      // The solver may optimize for AoW damage, but we always display weapon AR
      const arWithOptimalStats = hasUnlockedStats
        ? calculateWeaponAR(
            precomputed,
            weapon.name,
            weapon.affinity,
            weapon.upgradeLevel,
            optimalStats as unknown as CharacterStats,
            { twoHanding },
          )
        : weapon.arResult;
      const weaponAR = arWithOptimalStats?.rounded ?? weapon.totalAR;

      // Calculate efficiency: AR per stat point invested (for unlocked stats only)
      const damageStats = ["str", "dex", "int", "fai", "arc"];
      const totalStatsUsed = damageStats.reduce((sum, stat) => {
        return (
          sum +
          (optimalStats[stat as keyof typeof optimalStats] ||
            weapon.requirements[stat as keyof typeof weapon.requirements] ||
            0)
        );
      }, 0);

      const efficiency = totalStatsUsed > 0 ? weaponAR / totalStatsUsed : 0;

      // Check if stats are over budget
      const totalUsed = Object.keys(deferredStatConfigs).reduce((sum, stat) => {
        if (deferredStatConfigs[stat].locked) {
          return sum + (deferredStatConfigs[stat].value || 0);
        }
        return (
          sum +
          (optimalStats[stat as keyof typeof optimalStats] ||
            deferredStatConfigs[stat].min ||
            0)
        );
      }, 0);
      const statsOverBudget = totalUsed > availableBudget;

      // Calculate max damage with all stats at 99
      const maxStats: CharacterStats = {
        vig: 99,
        mnd: 99,
        end: 99,
        str: 99,
        dex: 99,
        int: 99,
        fai: 99,
        arc: 99,
      };
      const maxResult = calculateWeaponAR(
        precomputed,
        weapon.name,
        weapon.affinity,
        weapon.upgradeLevel,
        maxStats,
        { twoHanding },
      );
      const maxDamage = maxResult?.rounded ?? 0;
      const damagePercent = maxDamage > 0 ? (weaponAR / maxDamage) * 100 : 0;

      // Calculate base AR without 2H bonus for critical damage (2H strength bonus should not affect crits)
      const critBaseAR = twoHanding
        ? (calculateWeaponAR(
            precomputed,
            weapon.name,
            weapon.affinity,
            weapon.upgradeLevel,
            optimalStats as unknown as CharacterStats,
            { twoHanding: false },
          )?.rounded ?? 0)
        : weaponAR;

      // Calculate enemy damage if an enemy is selected
      // Uses MV=100 (normalized) and the weapon's primary physical damage type
      let enemyDamageBreakdown: DamageBreakdownResult | null = null;
      const arBreakdown = {
        physical: arWithOptimalStats?.physical.total ?? 0,
        magic: arWithOptimalStats?.magic.total ?? 0,
        fire: arWithOptimalStats?.fire.total ?? 0,
        lightning: arWithOptimalStats?.lightning.total ?? 0,
        holy: arWithOptimalStats?.holy.total ?? 0,
      };

      if (deferredSelectedEnemy) {
        // Use precalculated damage type directly
        const primaryPhysType = weapon.damageType;
        const attackAttribute =
          primaryPhysType === "Standard"
            ? "physical"
            : (primaryPhysType.toLowerCase() as "strike" | "slash" | "pierce");

        enemyDamageBreakdown = calculateEnemyDamage({
          baseAR: arBreakdown,
          motionValues: {
            physical: 100,
            magic: 100,
            fire: 100,
            lightning: 100,
            holy: 100,
          },
          attackAttribute,
          enemyDefenses: deferredSelectedEnemy.defenses,
        });
      }

      // Build the damage display: enemy damage when selected, AR otherwise
      const damageDisplay: DamageDisplay = enemyDamageBreakdown
        ? {
            physical: enemyDamageBreakdown.byType.physical,
            magic: enemyDamageBreakdown.byType.magic,
            fire: enemyDamageBreakdown.byType.fire,
            lightning: enemyDamageBreakdown.byType.lightning,
            holy: enemyDamageBreakdown.byType.holy,
            total: enemyDamageBreakdown.rounded,
          }
        : {
            physical: arBreakdown.physical,
            magic: arBreakdown.magic,
            fire: arBreakdown.fire,
            lightning: arBreakdown.lightning,
            holy: arBreakdown.holy,
            total: weaponAR,
          };

      // Calculate AoW damage if an AoW filter is selected
      let aowDamage: AowDamageBreakdown | null = null;
      if (deferredSelectedAowFilter && aowData) {
        // For "Weapon Skill" filter, use each weapon's own built-in skill name
        const aowName = deferredSelectedAowFilter === WEAPON_SKILL_FILTER
          ? getWeaponSkillName(aowData, precomputed, weapon.name)
          : deferredSelectedAowFilter;

        if (aowName) {
          aowDamage = calculateAowDamageBreakdown({
            aowData,
            precomputed,
            weaponName: weapon.name,
            affinityName: weapon.affinity,
            stats: optimalStats as unknown as CharacterStats,
            upgradeLevel: weapon.upgradeLevel,
            weaponClass: weapon.categoryName,
            twoHanding,
            aowName,
            selectedEnemy: deferredSelectedEnemy,
            weapon,
          });
        }
      }

      // Compute effective stats for requirement comparison (accounts for solver and two-handing)
      const effectiveStr = hasUnlockedStats
        ? (twoHanding ? Math.floor((optimalStats.str ?? 0) * 1.5) : (optimalStats.str ?? 0))
        : (twoHanding ? Math.floor((deferredStats.str ?? 0) * 1.5) : (deferredStats.str ?? 0));
      const effectiveDex = hasUnlockedStats ? (optimalStats.dex ?? 0) : (deferredStats.dex ?? 0);
      const effectiveInt = hasUnlockedStats ? (optimalStats.int ?? 0) : (deferredStats.int ?? 0);
      const effectiveFai = hasUnlockedStats ? (optimalStats.fai ?? 0) : (deferredStats.fai ?? 0);
      const effectiveArc = hasUnlockedStats ? (optimalStats.arc ?? 0) : (deferredStats.arc ?? 0);

      // Per-stat deficits (points needed per stat to meet requirements)
      const strDeficit = Math.max(0, weapon.requirements.str - effectiveStr);
      const dexDeficit = Math.max(0, weapon.requirements.dex - effectiveDex);
      const intDeficit = Math.max(0, weapon.requirements.int - effectiveInt);
      const faiDeficit = Math.max(0, weapon.requirements.fai - effectiveFai);
      const arcDeficit = Math.max(0, weapon.requirements.arc - effectiveArc);
      const totalDeficit = strDeficit + dexDeficit + intDeficit + faiDeficit + arcDeficit;

      // Pre-calculate DPS values for mobile cards
      const dpsData = getWeaponDpsData(weapon.name);
      const dpsGrip = twoHanding ? dpsData?.twoHanded : dpsData?.oneHanded;
      const calcDps = (attackData: AttackDpsData | null | undefined): number | null => {
        if (!attackData) return null;
        if (deferredSelectedEnemy) {
          const physDefenseType = (weapon.damageType === 'Standard' || weapon.damageType === '-')
            ? 'physical'
            : weapon.damageType.toLowerCase() as 'strike' | 'slash' | 'pierce';
          const scaledAR = {
            physical: arBreakdown.physical * (attackData.mv / 100),
            magic: arBreakdown.magic * (attackData.mv / 100),
            fire: arBreakdown.fire * (attackData.mv / 100),
            lightning: arBreakdown.lightning * (attackData.mv / 100),
            holy: arBreakdown.holy * (attackData.mv / 100),
          };
          const dpsEnemyDamage = calculateSimpleEnemyDamage(scaledAR, physDefenseType, deferredSelectedEnemy.defenses);
          const durationSeconds = attackData.frames / 30;
          return durationSeconds > 0 ? Math.round(dpsEnemyDamage / durationSeconds) : null;
        }
        return Math.round(weaponAR * attackData.dpsMultiplier);
      };

      return {
        ...weapon,
        calculatedDamage: weaponAR,
        totalAR: weaponAR,
        optimalStats,
        meetsReqs: hasUnlockedStats
          ? effectiveStr >= weapon.requirements.str &&
            effectiveDex >= weapon.requirements.dex &&
            effectiveInt >= weapon.requirements.int &&
            effectiveFai >= weapon.requirements.fai &&
            effectiveArc >= weapon.requirements.arc
          : weapon.meetsRequirements,
        effectiveStats: {
          str: effectiveStr,
          dex: effectiveDex,
          int: effectiveInt,
          fai: effectiveFai,
          arc: effectiveArc,
        },
        efficiency,
        totalStatsUsed,
        statsOverBudget,
        showScaling,
        showRequirements,
        showEfficiency,
        level,
        // Max damage and percentage
        maxDamage,
        damagePercent,
        // Status effects from AR result (use solver-optimized result when available)
        bleed: arWithOptimalStats?.bleed.rounded ?? weapon.arResult.bleed.rounded,
        frost: arWithOptimalStats?.frost.rounded ?? weapon.arResult.frost.rounded,
        poison: arWithOptimalStats?.poison.rounded ?? weapon.arResult.poison.rounded,
        scarletRot: arWithOptimalStats?.scarletRot.rounded ?? weapon.arResult.scarletRot.rounded,
        sleep: arWithOptimalStats?.sleep.rounded ?? weapon.arResult.sleep.rounded,
        madness: arWithOptimalStats?.madness.rounded ?? weapon.arResult.madness.rounded,
        // Spell scaling from AR result (use solver-optimized result when available)
        spellScaling:
          arWithOptimalStats?.sorceryScaling?.rounded ??
          arWithOptimalStats?.incantationScaling?.rounded ??
          weapon.arResult.sorceryScaling?.rounded ??
          weapon.arResult.incantationScaling?.rounded ??
          0,
        // Critical damage calculation: base AR (without 2H bonus) × (critValue / 100) × critMultiplier
        criticalDamage: calculateCriticalDamage(
          critBaseAR,
          weapon.category,
          weapon.criticalValue,
        ),
        // Precalculated primary damage type is inherited from weapon
        damageType: weapon.damageType,
        // Generic damage display - shows AR or enemy damage based on context
        damageDisplay,
        // AR breakdown by damage type (for DPS calculations vs enemies)
        arBreakdown,
        // Percentage of AR that hits the enemy (only when enemy is selected)
        enemyDamagePercent:
          enemyDamageBreakdown !== null && weaponAR > 0
            ? (enemyDamageBreakdown.rounded / weaponAR) * 100
            : null,
        // AoW damage breakdown (null when no AoW filter selected)
        aowDamage,
        // Weapon skill name and scaling (only when Weapon Skill filter is active)
        skillName: deferredSelectedAowFilter === WEAPON_SKILL_FILTER && aowData
          ? (getWeaponSkillName(aowData, precomputed, weapon.name) ?? null)
          : null,
        skillScaling: deferredSelectedAowFilter === WEAPON_SKILL_FILTER && aowData
          ? getWeaponSkillScaling(aowData, precomputed, weapon.name)
          : null,
        // Minimum level to wield this weapon given starting class
        minLevel: calculateMinLevel(weapon.requirements, deferredStartingClass, twoHanding),
        // Points required to meet requirements (0 if already met)
        pointsRequired: totalDeficit,
        // Per-stat deficits
        strDeficit,
        dexDeficit,
        intDeficit,
        faiDeficit,
        arcDeficit,
        totalDeficit,
        // Pre-calculated DPS
        r1Dps: calcDps(dpsGrip?.r1),
        r1ChainDps: calcDps(dpsGrip?.r1Chain),
        r2Dps: calcDps(dpsGrip?.r2),
        r2ChainDps: calcDps(dpsGrip?.r2Chain),
      } as WeaponWithCalculations;
    });

    // Apply column filters (includes name, type, affinity, meetsReqs, and starred filters)
    const hasColumnFilters = Object.keys(deferredColumnFilters).length > 0;
    if (hasColumnFilters) {
      return calculated.filter((weapon) =>
        passesColumnFilter(weapon, deferredColumnFilters),
      );
    }

    return calculated;
  }, [
    precomputed,
    preFilteredWeapons,
    deferredStatConfigs,
    deferredStats,
    availableBudget,
    hasUnlockedStats,
    twoHanding,
    deferredPointsBudget,
    deferredSelectedEnemy,
    deferredSubtractWeaponWeight,
    deferredArmorWeight,
    deferredRollType,
    deferredSelectedAowFilter,
    deferredOptimizationMode,
    aowData,
    deferredColumnFilters,
    passesColumnFilter,
    deferredStartingClass,
    builds,
  ]);

  // Determine if the selected AoW has motion/bullet damage (across all weapons)
  const { aowHasMotion, aowHasBullet } = useMemo(() => {
    if (!selectedAowFilter || filteredWeapons.length === 0) {
      return { aowHasMotion: false, aowHasBullet: false };
    }

    let hasMotion = false;
    let hasBullet = false;

    for (const weapon of filteredWeapons) {
      if (weapon.aowDamage) {
        if (weapon.aowDamage.motionTotal > 0) hasMotion = true;
        if (weapon.aowDamage.bulletTotal > 0) hasBullet = true;
        // If we've found both, no need to continue
        if (hasMotion && hasBullet) break;
      }
    }

    return { aowHasMotion: hasMotion, aowHasBullet: hasBullet };
  }, [selectedAowFilter, filteredWeapons]);

  // Determine which AoW column groups to show (respects both data availability and user toggle)
  const showAowMotion = showAowDamage && selectedAowFilter && aowHasMotion;
  const showAowBullet = showAowDamage && selectedAowFilter && aowHasBullet;
  const showAowTotal =
    showAowDamage && selectedAowFilter && aowHasMotion && aowHasBullet;

  // Whether the "Weapon Skill" filter is active (shows skill name + scaling columns)
  const isWeaponSkillFilter = selectedAowFilter === WEAPON_SKILL_FILTER;

  // Sort weapons
  const sortedWeapons = useMemo(() => {
    // If no sort key, return unsorted (original order)
    if (sortKey === null) {
      return filteredWeapons;
    }
    return [...filteredWeapons].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "affinity":
          comparison = a.affinity.localeCompare(b.affinity);
          break;
        case "category":
          comparison = a.categoryName.localeCompare(b.categoryName);
          break;
        case "totalAR":
          comparison = a.damageDisplay.total - b.damageDisplay.total;
          break;
        case "criticalDamage":
          // Weapons that can't crit (null) sort to the bottom
          if (a.criticalDamage === null && b.criticalDamage === null)
            comparison = 0;
          else if (a.criticalDamage === null) comparison = -1;
          else if (b.criticalDamage === null) comparison = 1;
          else comparison = a.criticalDamage - b.criticalDamage;
          break;
        case "efficiency":
          comparison = a.efficiency - b.efficiency;
          break;
        case "damagePercent":
          comparison = a.damagePercent - b.damagePercent;
          break;
        case "physical":
          comparison = a.damageDisplay.physical - b.damageDisplay.physical;
          break;
        case "magic":
          comparison = a.damageDisplay.magic - b.damageDisplay.magic;
          break;
        case "fire":
          comparison = a.damageDisplay.fire - b.damageDisplay.fire;
          break;
        case "lightning":
          comparison = a.damageDisplay.lightning - b.damageDisplay.lightning;
          break;
        case "holy":
          comparison = a.damageDisplay.holy - b.damageDisplay.holy;
          break;
        case "strScaling":
          comparison = a.rawScaling.str - b.rawScaling.str;
          break;
        case "dexScaling":
          comparison = a.rawScaling.dex - b.rawScaling.dex;
          break;
        case "intScaling":
          comparison = a.rawScaling.int - b.rawScaling.int;
          break;
        case "faiScaling":
          comparison = a.rawScaling.fai - b.rawScaling.fai;
          break;
        case "arcScaling":
          comparison = a.rawScaling.arc - b.rawScaling.arc;
          break;
        case "strReq":
          comparison = a.requirements.str - b.requirements.str;
          break;
        case "dexReq":
          comparison = a.requirements.dex - b.requirements.dex;
          break;
        case "intReq":
          comparison = a.requirements.int - b.requirements.int;
          break;
        case "faiReq":
          comparison = a.requirements.fai - b.requirements.fai;
          break;
        case "arcReq":
          comparison = a.requirements.arc - b.requirements.arc;
          break;
        case "minLevel":
          comparison = a.minLevel - b.minLevel;
          break;
        case "pointsRequired":
          comparison = a.pointsRequired - b.pointsRequired;
          break;
        case "strDeficit":
          comparison = a.strDeficit - b.strDeficit;
          break;
        case "dexDeficit":
          comparison = a.dexDeficit - b.dexDeficit;
          break;
        case "intDeficit":
          comparison = a.intDeficit - b.intDeficit;
          break;
        case "faiDeficit":
          comparison = a.faiDeficit - b.faiDeficit;
          break;
        case "arcDeficit":
          comparison = a.arcDeficit - b.arcDeficit;
          break;
        case "totalDeficit":
          comparison = a.totalDeficit - b.totalDeficit;
          break;
        // Optimal Stats
        case "strOptimal":
          comparison = (a.optimalStats.str ?? 0) - (b.optimalStats.str ?? 0);
          break;
        case "dexOptimal":
          comparison = (a.optimalStats.dex ?? 0) - (b.optimalStats.dex ?? 0);
          break;
        case "intOptimal":
          comparison = (a.optimalStats.int ?? 0) - (b.optimalStats.int ?? 0);
          break;
        case "faiOptimal":
          comparison = (a.optimalStats.fai ?? 0) - (b.optimalStats.fai ?? 0);
          break;
        case "arcOptimal":
          comparison = (a.optimalStats.arc ?? 0) - (b.optimalStats.arc ?? 0);
          break;
        case "weight":
          comparison = a.weight - b.weight;
          break;
        case "trueCombos":
          comparison = a.trueCombos - b.trueCombos;
          break;
        case "buffable":
          // Sort buffable weapons first (true = 1, false = 0)
          comparison = (a.isBuffable ? 1 : 0) - (b.isBuffable ? 1 : 0);
          break;
        case "uniqueAttacks":
          // Sort weapons with unique attacks first (true = 1, false = 0)
          comparison =
            (a.hasUniqueAttacks ? 1 : 0) - (b.hasUniqueAttacks ? 1 : 0);
          break;
        // Status effects
        case "bleed":
          comparison = a.bleed - b.bleed;
          break;
        case "frost":
          comparison = a.frost - b.frost;
          break;
        case "poison":
          comparison = a.poison - b.poison;
          break;
        case "scarletRot":
          comparison = a.scarletRot - b.scarletRot;
          break;
        case "sleep":
          comparison = a.sleep - b.sleep;
          break;
        case "madness":
          comparison = a.madness - b.madness;
          break;
        // Guard stats
        case "guardPhys":
          comparison = a.guardStats.physical - b.guardStats.physical;
          break;
        case "guardMag":
          comparison = a.guardStats.magic - b.guardStats.magic;
          break;
        case "guardFire":
          comparison = a.guardStats.fire - b.guardStats.fire;
          break;
        case "guardLtn":
          comparison = a.guardStats.lightning - b.guardStats.lightning;
          break;
        case "guardHoly":
          comparison = a.guardStats.holy - b.guardStats.holy;
          break;
        case "guardBoost":
          comparison = a.guardStats.guardBoost - b.guardStats.guardBoost;
          break;
        // DPS columns - calculate from pre-computed data, or use enemy damage if enemy is selected
        case "r1Dps":
        case "r1ChainDps":
        case "r2Dps":
        case "r2ChainDps": {
          const dpsDataA = getWeaponDpsData(a.name);
          const dpsDataB = getWeaponDpsData(b.name);
          const gripA = twoHanding ? dpsDataA?.twoHanded : dpsDataA?.oneHanded;
          const gripB = twoHanding ? dpsDataB?.twoHanded : dpsDataB?.oneHanded;
          const attackType = sortKey === "r1Dps" ? "r1" : sortKey === "r1ChainDps" ? "r1Chain" : sortKey === "r2Dps" ? "r2" : "r2Chain";

          // Helper to calculate DPS for sorting
          const calcSortDps = (weapon: WeaponWithCalculations, attackData: AttackDpsData | null | undefined) => {
            if (!attackData) return 0;

            // When enemy is selected, calculate actual damage vs enemy
            if (selectedEnemy) {
              // Handle '-' (no physical damage) by defaulting to 'physical' defense type
              const physDefenseType = weapon.damageType === 'Standard' || weapon.damageType === '-'
                ? 'physical'
                : weapon.damageType.toLowerCase() as 'strike' | 'slash' | 'pierce';

              const scaledAR = {
                physical: weapon.arBreakdown.physical * (attackData.mv / 100),
                magic: weapon.arBreakdown.magic * (attackData.mv / 100),
                fire: weapon.arBreakdown.fire * (attackData.mv / 100),
                lightning: weapon.arBreakdown.lightning * (attackData.mv / 100),
                holy: weapon.arBreakdown.holy * (attackData.mv / 100),
              };

              const enemyDamage = calculateSimpleEnemyDamage(scaledAR, physDefenseType, selectedEnemy.defenses);
              const durationSeconds = attackData.frames / 30; // 30 fps
              return durationSeconds > 0 ? enemyDamage / durationSeconds : 0;
            }

            // No enemy selected - use pre-calculated AR-based DPS
            return weapon.totalAR * attackData.dpsMultiplier;
          };

          const dpsA = calcSortDps(a, gripA?.[attackType]);
          const dpsB = calcSortDps(b, gripB?.[attackType]);
          comparison = dpsA - dpsB;
          break;
        }
        // Spell scaling
        case "spellScaling":
          comparison = a.spellScaling - b.spellScaling;
          break;
        // Damage types - sort by first damage type alphabetically, then by count
        // Damage types - sort by primary damage type alphabetically
        case "damageType":
          comparison = a.damageType.localeCompare(b.damageType);
          break;
        // Enemy damage - uses damageDisplay.total (same as totalAR when no enemy selected, enemy damage when selected)
        case "enemyDamage":
          comparison = a.damageDisplay.total - b.damageDisplay.total;
          break;
        // Enemy damage percent - null values sort to the bottom
        case "enemyDamagePercent":
          if (a.enemyDamagePercent === null && b.enemyDamagePercent === null)
            comparison = 0;
          else if (a.enemyDamagePercent === null) comparison = -1;
          else if (b.enemyDamagePercent === null) comparison = 1;
          else comparison = a.enemyDamagePercent - b.enemyDamagePercent;
          break;
        // AoW Motion Damage - null values sort to the bottom
        case "aowMotionPhys":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.motionPhys - b.aowDamage.motionPhys;
          break;
        case "aowMotionMag":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.motionMag - b.aowDamage.motionMag;
          break;
        case "aowMotionFire":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.motionFire - b.aowDamage.motionFire;
          break;
        case "aowMotionLtn":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.motionLtn - b.aowDamage.motionLtn;
          break;
        case "aowMotionHoly":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.motionHoly - b.aowDamage.motionHoly;
          break;
        case "aowMotionTotal":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.motionTotal - b.aowDamage.motionTotal;
          break;
        // AoW Bullet Damage - null values sort to the bottom
        case "aowBulletPhys":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.bulletPhys - b.aowDamage.bulletPhys;
          break;
        case "aowBulletMag":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.bulletMag - b.aowDamage.bulletMag;
          break;
        case "aowBulletFire":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.bulletFire - b.aowDamage.bulletFire;
          break;
        case "aowBulletLtn":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.bulletLtn - b.aowDamage.bulletLtn;
          break;
        case "aowBulletHoly":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.bulletHoly - b.aowDamage.bulletHoly;
          break;
        case "aowBulletTotal":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.bulletTotal - b.aowDamage.bulletTotal;
          break;
        // AoW Total Damage - null values sort to the bottom
        case "aowTotalPhys":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.totalPhys - b.aowDamage.totalPhys;
          break;
        case "aowTotalMag":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.totalMag - b.aowDamage.totalMag;
          break;
        case "aowTotalFire":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.totalFire - b.aowDamage.totalFire;
          break;
        case "aowTotalLtn":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.totalLtn - b.aowDamage.totalLtn;
          break;
        case "aowTotalHoly":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.totalHoly - b.aowDamage.totalHoly;
          break;
        case "aowTotalDamage":
          if (!a.aowDamage && !b.aowDamage) comparison = 0;
          else if (!a.aowDamage) comparison = -1;
          else if (!b.aowDamage) comparison = 1;
          else comparison = a.aowDamage.totalDamage - b.aowDamage.totalDamage;
          break;
        case "aowEffectiveness":
          if (
            (!a.aowDamage || a.aowDamage.rawTotalDamage <= 0) &&
            (!b.aowDamage || b.aowDamage.rawTotalDamage <= 0)
          )
            comparison = 0;
          else if (!a.aowDamage || a.aowDamage.rawTotalDamage <= 0)
            comparison = -1;
          else if (!b.aowDamage || b.aowDamage.rawTotalDamage <= 0)
            comparison = 1;
          else {
            const effA = a.aowDamage.totalDamage / a.aowDamage.rawTotalDamage;
            const effB = b.aowDamage.totalDamage / b.aowDamage.rawTotalDamage;
            comparison = effA - effB;
          }
          break;
        case "aowMotionEffectiveness":
          if (
            (!a.aowDamage || a.aowDamage.rawMotionTotal <= 0) &&
            (!b.aowDamage || b.aowDamage.rawMotionTotal <= 0)
          )
            comparison = 0;
          else if (!a.aowDamage || a.aowDamage.rawMotionTotal <= 0)
            comparison = -1;
          else if (!b.aowDamage || b.aowDamage.rawMotionTotal <= 0)
            comparison = 1;
          else {
            const effA = a.aowDamage.motionTotal / a.aowDamage.rawMotionTotal;
            const effB = b.aowDamage.motionTotal / b.aowDamage.rawMotionTotal;
            comparison = effA - effB;
          }
          break;
        case "aowBulletEffectiveness":
          if (
            (!a.aowDamage || a.aowDamage.rawBulletTotal <= 0) &&
            (!b.aowDamage || b.aowDamage.rawBulletTotal <= 0)
          )
            comparison = 0;
          else if (!a.aowDamage || a.aowDamage.rawBulletTotal <= 0)
            comparison = -1;
          else if (!b.aowDamage || b.aowDamage.rawBulletTotal <= 0)
            comparison = 1;
          else {
            const effA = a.aowDamage.bulletTotal / a.aowDamage.rawBulletTotal;
            const effB = b.aowDamage.bulletTotal / b.aowDamage.rawBulletTotal;
            comparison = effA - effB;
          }
          break;
        // Weapon Skill columns
        case "skillName":
          if (!a.skillName && !b.skillName) comparison = 0;
          else if (!a.skillName) comparison = -1;
          else if (!b.skillName) comparison = 1;
          else comparison = a.skillName.localeCompare(b.skillName);
          break;
        case "skillStrScaling":
          if (!a.skillScaling && !b.skillScaling) comparison = 0;
          else if (!a.skillScaling) comparison = -1;
          else if (!b.skillScaling) comparison = 1;
          else comparison = GRADE_ORDER[a.skillScaling.str] - GRADE_ORDER[b.skillScaling.str];
          break;
        case "skillDexScaling":
          if (!a.skillScaling && !b.skillScaling) comparison = 0;
          else if (!a.skillScaling) comparison = -1;
          else if (!b.skillScaling) comparison = 1;
          else comparison = GRADE_ORDER[a.skillScaling.dex] - GRADE_ORDER[b.skillScaling.dex];
          break;
        case "skillIntScaling":
          if (!a.skillScaling && !b.skillScaling) comparison = 0;
          else if (!a.skillScaling) comparison = -1;
          else if (!b.skillScaling) comparison = 1;
          else comparison = GRADE_ORDER[a.skillScaling.int] - GRADE_ORDER[b.skillScaling.int];
          break;
        case "skillFaiScaling":
          if (!a.skillScaling && !b.skillScaling) comparison = 0;
          else if (!a.skillScaling) comparison = -1;
          else if (!b.skillScaling) comparison = 1;
          else comparison = GRADE_ORDER[a.skillScaling.fai] - GRADE_ORDER[b.skillScaling.fai];
          break;
        case "skillArcScaling":
          if (!a.skillScaling && !b.skillScaling) comparison = 0;
          else if (!a.skillScaling) comparison = -1;
          else if (!b.skillScaling) comparison = 1;
          else comparison = GRADE_ORDER[a.skillScaling.arc] - GRADE_ORDER[b.skillScaling.arc];
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredWeapons, sortKey, sortDirection, selectedEnemy, twoHanding]);

  // Helper function to get the group key for a weapon based on groupBy mode
  const getGroupKey = useCallback((weapon: WeaponWithCalculations, mode: typeof groupBy): string => {
    switch (mode) {
      case 'weapon-type':
        return weapon.categoryName;
      case 'affinity':
        return weapon.isUnique ? 'Unique' : weapon.affinity;
      case 'weapon':
        return weapon.name;
      default:
        return '';
    }
  }, []);

  // Sort weapons by group key when grouping is enabled (flat list sorted by groups)
  const groupSortedWeapons = useMemo(() => {
    if (groupBy === 'none') {
      return sortedWeapons;
    }

    // Sort by group key, maintaining original sort order within groups
    return [...sortedWeapons].sort((a, b) => {
      const keyA = getGroupKey(a, groupBy);
      const keyB = getGroupKey(b, groupBy);
      return keyA.localeCompare(keyB);
    });
  }, [sortedWeapons, groupBy, getGroupKey]);

  // TanStack Table: minimal column definition (existing rendering is preserved)
  const columns = useMemo<ColumnDef<WeaponWithCalculations>[]>(
    () => [{ id: 'name', accessorFn: (row) => row.name }],
    [],
  );

  // TanStack Table instance - manages the row model for the virtualizer
  const table = useReactTable({
    data: groupSortedWeapons,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const { rows } = table.getRowModel();

  // Scroll container refs for the virtualizers
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const mobileContainerRef = useRef<HTMLDivElement>(null);

  // Desktop row virtualizer (TanStack Virtual)
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 33,
    overscan: 10,
    enabled: !isMobile,
    getItemKey: (index) => rows[index]?.id ?? index,
  });

  // Mobile card virtualizer (TanStack Virtual)
  const mobileVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    getScrollElement: () => mobileContainerRef.current,
    estimateSize: () => 120,
    overscan: 5,
    enabled: isMobile,
    getItemKey: (index) => rows[index]?.id ?? index,
  });

  // Stable refs for virtualizers so keyboard handler doesn't need them as deps
  const rowVirtualizerRef = useRef(rowVirtualizer);
  rowVirtualizerRef.current = rowVirtualizer;
  const mobileVirtualizerRef = useRef(mobileVirtualizer);
  mobileVirtualizerRef.current = mobileVirtualizer;

  // Keyboard navigation: Arrow keys to navigate weapons when detail panel is open
  const handleKeyboardNavigation = useCallback(
    (e: KeyboardEvent) => {
      // Only handle arrow keys when a weapon is selected (detail panel is open)
      if (!selectedWeapon || groupSortedWeapons.length === 0) return;

      // Don't handle if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      e.preventDefault();

      const currentIndex = groupSortedWeapons.findIndex(
        (w) => w.id === selectedWeapon.id,
      );
      if (currentIndex === -1) return;

      let nextIndex: number;
      if (e.key === "ArrowDown") {
        nextIndex = currentIndex + 1;
        if (nextIndex >= groupSortedWeapons.length) {
          nextIndex = 0; // Wrap to first
        }
      } else {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = groupSortedWeapons.length - 1; // Wrap to last
        }
      }

      const nextWeapon = groupSortedWeapons[nextIndex];
      onWeaponSelect(nextWeapon);

      // Scroll the row into view using the virtualizer (works for both desktop and mobile)
      rowVirtualizerRef.current.scrollToIndex(nextIndex, { align: 'center', behavior: 'smooth' });
      mobileVirtualizerRef.current.scrollToIndex(nextIndex, { align: 'center', behavior: 'smooth' });
    },
    [selectedWeapon, groupSortedWeapons, onWeaponSelect],
  );

  // Attach keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyboardNavigation);
    return () => {
      document.removeEventListener("keydown", handleKeyboardNavigation);
    };
  }, [handleKeyboardNavigation]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // Cycle: desc -> asc -> unsorted
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else {
        // Was asc, now go to unsorted
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  // Memoize the select handler to prevent WeaponRow re-renders
  const handleWeaponSelect = useCallback(
    (weapon: WeaponWithCalculations) => {
      onWeaponSelect(weapon);
    },
    [onWeaponSelect],
  );

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  // Filterable header component for columns with filters
  const FilterableHeader = ({
    columnKey,
    sortColumnKey,
    label,
    filterType,
    options,
    className,
    title,
  }: {
    columnKey: string;
    sortColumnKey: SortKey;
    label: string;
    filterType: "set" | "range" | "boolean";
    options?: string[];
    className?: string;
    title?: string;
  }) => (
    <th
      className={`px-2 py-2 cursor-pointer hover:text-[#d4af37] ${className || ""}`}
      onClick={() => handleSort(sortColumnKey)}
      title={title}
    >
      <div className="flex items-center justify-center gap-1">
        <span>{label}</span>
        <SortIcon columnKey={sortColumnKey} />
        <ColumnFilter
          columnKey={columnKey}
          filterType={filterType}
          value={columnFilters[columnKey]}
          onChange={(value) => updateColumnFilter(columnKey, value)}
          options={options}
        />
      </div>
    </th>
  );

  // Render weapon row content
  const renderWeaponContent = useCallback((weapon: WeaponWithCalculations) => (
    <WeaponRowCells
      weapon={weapon}
      isSelected={selectedWeapon?.id === weapon.id}
      showScaling={showScaling}
      showNumericalScaling={showNumericalScaling}
      showRequirements={showRequirements}
      showAttributeInvestments={showAttributeInvestments}
      showEfficiency={showEfficiency}
      showStatusEffects={showStatusEffects}
      showSpellPower={showSpellPower}
      showAowDamage={showAowDamage}
      showGuardStats={showGuardStats}
      showDps={showDps}
      showWeaponStats={showWeaponStats}
      hasUnlockedStats={hasUnlockedStats}
      twoHanding={twoHanding}
      selectedAowFilter={selectedAowFilter}
      isWeaponSkillFilter={isWeaponSkillFilter}
      selectedEnemyName={selectedEnemy?.name ?? null}
      selectedEnemy={selectedEnemy}
      aowHasMotion={aowHasMotion}
      aowHasBullet={aowHasBullet}
      isStarred={isWeaponStarred?.(weapon.id) ?? false}
      onToggleStar={onToggleWeaponStar}
    />
  ), [selectedWeapon?.id, showScaling, showNumericalScaling, showRequirements, showAttributeInvestments, showEfficiency, showStatusEffects, showSpellPower, showAowDamage, showGuardStats, showDps, showWeaponStats, hasUnlockedStats, twoHanding, selectedAowFilter, isWeaponSkillFilter, selectedEnemy, aowHasMotion, aowHasBullet, isWeaponStarred, onToggleWeaponStar]);

  // Fixed header content for the table
  const renderFixedHeader = useCallback(() => (
    <>
      {/* First header row - group names */}
      <tr className="[&>th]:shadow-[inset_0_-1px_0_#2a2a2a] bg-[#1a1a1a]">
        {/* Weapon (includes star column if enabled) */}
        <th colSpan={onToggleWeaponStar ? 4 : 3} className={`text-center px-2 py-1 ${!showWeaponStats ? 'border-r border-[#2a2a2a]' : ''} uppercase tracking-wider`}>
          Weapon
        </th>
        {/* Weapon Stats */}
        {showWeaponStats && (
          <th colSpan={5} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider">
            Weapon Stats
          </th>
        )}
        {/* Attack Power */}
        <th
          colSpan={7}
          className={`text-center px-2 py-1 ${selectedEnemy ? '' : 'border-r border-[#2a2a2a]'} uppercase tracking-wider ${selectedEnemy ? 'text-[#e06666]' : ''}`}
        >
          {selectedEnemy ? (
            <div className="flex items-center justify-center gap-1">
              <Skull className="w-3 h-3" /> Damage vs {selectedEnemy.name}
            </div>
          ) : (
            'Attack Power'
          )}
        </th>
        {selectedEnemy && (
          <th colSpan={1} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider text-[#e06666]">
            %
          </th>
        )}
        {/* Weapon Skill (name + scaling) */}
        {isWeaponSkillFilter && (
          <th colSpan={6} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider text-[#c8a2c8]">
            Weapon Skill
          </th>
        )}
        {/* AoW Motion Damage */}
        {showAowMotion && (
          <th colSpan={selectedEnemy ? 7 : 6} className={`text-center px-2 py-1 ${showAowBullet || showAowTotal ? 'border-r border-[#2a2a2a]' : ''} uppercase tracking-wider text-[#93c47d]`}>
            {selectedEnemy ? (
              <div className="flex items-center justify-center gap-1">
                <Skull className="w-3 h-3" /> Motion Dmg vs {selectedEnemy.name}
              </div>
            ) : "Motion Damage"}
          </th>
        )}
        {/* AoW Bullet Damage */}
        {showAowBullet && (
          <th colSpan={selectedEnemy ? 7 : 6} className={`text-center px-2 py-1 ${showAowTotal ? 'border-r border-[#2a2a2a]' : ''} uppercase tracking-wider text-[#6fa8dc]`}>
            {selectedEnemy ? (
              <div className="flex items-center justify-center gap-1">
                <Skull className="w-3 h-3" /> Bullet Dmg vs {selectedEnemy.name}
              </div>
            ) : "Bullet Damage"}
          </th>
        )}
        {/* AoW Total Damage */}
        {showAowTotal && (
          <th colSpan={selectedEnemy ? 7 : 6} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider">
            {selectedEnemy ? (
              <div className="flex items-center justify-center gap-1">
                <Skull className="w-3 h-3" /> Total AoW vs {selectedEnemy.name}
              </div>
            ) : "Total AoW Damage"}
          </th>
        )}
        {/* DPS */}
        {showDps && (
          <th colSpan={4} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider">
            DPS
          </th>
        )}
        {/* Spell Power */}
        {showSpellPower && (
          <th colSpan={1} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider">
            Spell Power
          </th>
        )}
        {/* Efficiency */}
        {showEfficiency && (
          <th colSpan={2} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" /> Efficiency
            </div>
          </th>
        )}
        {/* Optimal Stats */}
        {hasUnlockedStats && (
          <th colSpan={5} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider">
            Optimal Stats
          </th>
        )}
        {/* Attribute Scaling */}
        {showScaling && (
          <th colSpan={5} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider">
            Attribute Scaling
          </th>
        )}
        {/* Attributes Required */}
        {showRequirements && (
          <th colSpan={6} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider">
            Attributes Required
          </th>
        )}
        {/* Attribute Investments */}
        {showAttributeInvestments && (
          <th colSpan={8} className="text-center px-2 py-1 border-r border-[#2a2a2a] uppercase tracking-wider">
            Attribute Investments
          </th>
        )}
        {/* Status Effects */}
        {showStatusEffects && (
          <th colSpan={6} className="text-center px-2 py-1 uppercase tracking-wider border-r border-[#2a2a2a]">
            Status Effects
          </th>
        )}
        {/* Guard Stats */}
        {showGuardStats && (
          <th colSpan={6} className="text-center px-2 py-1 uppercase tracking-wider border-r border-[#2a2a2a]">
            Guard Stats
          </th>
        )}
      </tr>
      {/* Second header row - individual columns */}
      <tr className="[&>th]:shadow-[inset_0_-2px_0_#2a2a2a] bg-[#1a1a1a]">
        {/* Star column */}
        {onToggleWeaponStar && (
          <th className="pl-[1rem] pr-1 py-2 bg-[#1a1a1a] w-[36px]">
            <div className="flex items-center gap-0.5">
              <Star className="w-4 h-4 text-[#4a4a4a] ml-1" />
              <ColumnFilter
                columnKey="starred"
                filterType="set"
                value={columnFilters['starred']}
                onChange={(value) => updateColumnFilter('starred', value)}
                options={builds.map(b => b.name)}
              />
            </div>
          </th>
        )}
        {/* Weapon */}
        <th className={`text-left px-3 py-2 bg-[#1a1a1a] cursor-pointer hover:text-[#d4af37] whitespace-nowrap`} onClick={() => handleSort('name')}>
          <div className="flex items-center gap-1">
            Name <SortIcon columnKey="name" />
            <ColumnFilter
              columnKey="name"
              filterType="text"
              value={columnFilters['name']}
              onChange={(value) => updateColumnFilter('name', value)}
              placeholder="Search weapons..."
            />
          </div>
        </th>
        <th className="text-left px-3 py-2 cursor-pointer hover:text-[#d4af37] whitespace-nowrap" onClick={() => handleSort('category')}>
          <div className="flex items-center gap-1">
            Type <SortIcon columnKey="category" />
            <ColumnFilter
              columnKey="categoryName"
              filterType="set"
              value={columnFilters['categoryName']}
              onChange={(value) => updateColumnFilter('categoryName', value)}
              options={uniqueColumnValues.categoryName}
            />
          </div>
        </th>
        <th className={`text-left px-3 py-2 cursor-pointer hover:text-[#d4af37] whitespace-nowrap ${!showWeaponStats ? 'border-r border-[#2a2a2a]' : ''}`} onClick={() => handleSort('affinity')}>
          <div className="flex items-center gap-1">
            Affinity <SortIcon columnKey="affinity" />
            <ColumnFilter
              columnKey="affinity"
              filterType="set"
              value={columnFilters['affinity']}
              onChange={(value) => updateColumnFilter('affinity', value)}
              options={uniqueColumnValues.affinity}
            />
          </div>
        </th>
        {/* Weapon Stats columns (Dmg, Wgt, TC, Buff, Uniq) */}
        {showWeaponStats && (
          <>
            <th className="text-left px-3 py-2 cursor-pointer hover:text-[#d4af37] whitespace-nowrap" onClick={() => handleSort('damageType')} title="Primary Damage Type">
              <div className="flex items-center gap-1">
                Dmg <SortIcon columnKey="damageType" />
                <ColumnFilter
                  columnKey="damageType"
                  filterType="set"
                  value={columnFilters['damageType']}
                  onChange={(value) => updateColumnFilter('damageType', value)}
                  options={uniqueColumnValues.damageType}
                />
              </div>
            </th>
            <th className="text-center px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('weight')} title="Weapon Weight">
              <div className="flex items-center justify-center gap-1">
                Wgt <SortIcon columnKey="weight" />
                <ColumnFilter
                  columnKey="weight"
                  filterType="range"
                  value={columnFilters['weight']}
                  onChange={(value) => updateColumnFilter('weight', value)}
                />
              </div>
            </th>
            <th className="text-center px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('trueCombos')} title="True Combos (at default poise)">
              <div className="flex items-center justify-center gap-1">
                TC <SortIcon columnKey="trueCombos" />
                <ColumnFilter
                  columnKey="trueCombos"
                  filterType="range"
                  value={columnFilters['trueCombos']}
                  onChange={(value) => updateColumnFilter('trueCombos', value)}
                />
              </div>
            </th>
            <th className="text-center px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#9370db]" onClick={() => handleSort('buffable')} title="Can be buffed with greases and spells">
              <div className="flex items-center justify-center gap-1">
                Buff <SortIcon columnKey="buffable" />
                <ColumnFilter
                  columnKey="buffable"
                  filterType="boolean"
                  value={columnFilters['buffable']}
                  onChange={(value) => updateColumnFilter('buffable', value)}
                />
              </div>
            </th>
            <th className="text-center px-2 py-2 border-r border-[#2a2a2a] cursor-pointer hover:text-[#d4af37] text-[#9b59b6]" onClick={() => handleSort('uniqueAttacks')} title="Has unique attack animations compared to weapon class">
              <div className="flex items-center justify-center gap-1">
                Uniq <SortIcon columnKey="uniqueAttacks" />
                <ColumnFilter
                  columnKey="uniqueAttacks"
                  filterType="boolean"
                  value={columnFilters['uniqueAttacks']}
                  onChange={(value) => updateColumnFilter('uniqueAttacks', value)}
                />
              </div>
            </th>
          </>
        )}

        {/* Attack Power */}
        <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#9a9a9a]" onClick={() => handleSort('physical')}>
          <div className="flex items-center justify-center gap-1">
            Phy <SortIcon columnKey="physical" />
            <ColumnFilter
              columnKey="physical"
              filterType="range"
              value={columnFilters['physical']}
              onChange={(value) => updateColumnFilter('physical', value)}
            />
          </div>
        </th>
        <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#5bc0de]" onClick={() => handleSort('magic')}>
          <div className="flex items-center justify-center gap-1">
            Mag <SortIcon columnKey="magic" />
            <ColumnFilter
              columnKey="magic"
              filterType="range"
              value={columnFilters['magic']}
              onChange={(value) => updateColumnFilter('magic', value)}
            />
          </div>
        </th>
        <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#f0ad4e]" onClick={() => handleSort('fire')}>
          <div className="flex items-center justify-center gap-1">
            Fire <SortIcon columnKey="fire" />
            <ColumnFilter
              columnKey="fire"
              filterType="range"
              value={columnFilters['fire']}
              onChange={(value) => updateColumnFilter('fire', value)}
            />
          </div>
        </th>
        <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#f4e04d]" onClick={() => handleSort('lightning')}>
          <div className="flex items-center justify-center gap-1">
            Ligt <SortIcon columnKey="lightning" />
            <ColumnFilter
              columnKey="lightning"
              filterType="range"
              value={columnFilters['lightning']}
              onChange={(value) => updateColumnFilter('lightning', value)}
            />
          </div>
        </th>
        <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#d4af37]" onClick={() => handleSort('holy')}>
          <div className="flex items-center justify-center gap-1">
            Holy <SortIcon columnKey="holy" />
            <ColumnFilter
              columnKey="holy"
              filterType="range"
              value={columnFilters['holy']}
              onChange={(value) => updateColumnFilter('holy', value)}
            />
          </div>
        </th>
        <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('totalAR')}>
          <div className="flex items-center justify-center gap-1">
            Σ <SortIcon columnKey="totalAR" />
            <ColumnFilter
              columnKey="totalAR"
              filterType="range"
              value={columnFilters['totalAR']}
              onChange={(value) => updateColumnFilter('totalAR', value)}
            />
          </div>
        </th>
        <th className={`px-2 py-2 cursor-pointer hover:text-[#d4af37] ${selectedEnemy ? '' : 'border-r border-[#2a2a2a]'}`} onClick={() => handleSort('criticalDamage')} title="Critical Damage">
          <div className="flex items-center justify-center gap-1">
            Crit <SortIcon columnKey="criticalDamage" />
            <ColumnFilter
              columnKey="criticalDamage"
              filterType="range"
              value={columnFilters['criticalDamage']}
              onChange={(value) => updateColumnFilter('criticalDamage', value)}
            />
          </div>
        </th>
        {selectedEnemy && (
          <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#e06666] border-r border-[#2a2a2a]" onClick={() => handleSort('enemyDamagePercent')} title="Percentage of AR dealt to enemy">
            <div className="flex items-center justify-center gap-1">% <SortIcon columnKey="enemyDamagePercent" /></div>
          </th>
        )}

        {/* Weapon Skill sub-headers */}
        {isWeaponSkillFilter && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#c8a2c8]" onClick={() => handleSort('skillName')} title="Weapon Skill Name">
              <div className="flex items-center justify-center gap-1">
                Skill <SortIcon columnKey="skillName" />
                <ColumnFilter
                  columnKey="skillName"
                  filterType="text"
                  value={columnFilters['skillName']}
                  onChange={(value) => updateColumnFilter('skillName', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('skillStrScaling')} title="Skill Strength Scaling">
              <div className="flex items-center justify-center gap-1">
                Str <SortIcon columnKey="skillStrScaling" />
                <ColumnFilter
                  columnKey="skillStrScalingGrade"
                  filterType="set"
                  value={columnFilters['skillStrScalingGrade']}
                  onChange={(value) => updateColumnFilter('skillStrScalingGrade', value)}
                  options={uniqueColumnValues.scalingGrade}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('skillDexScaling')} title="Skill Dexterity Scaling">
              <div className="flex items-center justify-center gap-1">
                Dex <SortIcon columnKey="skillDexScaling" />
                <ColumnFilter
                  columnKey="skillDexScalingGrade"
                  filterType="set"
                  value={columnFilters['skillDexScalingGrade']}
                  onChange={(value) => updateColumnFilter('skillDexScalingGrade', value)}
                  options={uniqueColumnValues.scalingGrade}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('skillIntScaling')} title="Skill Intelligence Scaling">
              <div className="flex items-center justify-center gap-1">
                Int <SortIcon columnKey="skillIntScaling" />
                <ColumnFilter
                  columnKey="skillIntScalingGrade"
                  filterType="set"
                  value={columnFilters['skillIntScalingGrade']}
                  onChange={(value) => updateColumnFilter('skillIntScalingGrade', value)}
                  options={uniqueColumnValues.scalingGrade}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('skillFaiScaling')} title="Skill Faith Scaling">
              <div className="flex items-center justify-center gap-1">
                Fai <SortIcon columnKey="skillFaiScaling" />
                <ColumnFilter
                  columnKey="skillFaiScalingGrade"
                  filterType="set"
                  value={columnFilters['skillFaiScalingGrade']}
                  onChange={(value) => updateColumnFilter('skillFaiScalingGrade', value)}
                  options={uniqueColumnValues.scalingGrade}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] border-r border-[#2a2a2a]" onClick={() => handleSort('skillArcScaling')} title="Skill Arcane Scaling">
              <div className="flex items-center justify-center gap-1">
                Arc <SortIcon columnKey="skillArcScaling" />
                <ColumnFilter
                  columnKey="skillArcScalingGrade"
                  filterType="set"
                  value={columnFilters['skillArcScalingGrade']}
                  onChange={(value) => updateColumnFilter('skillArcScalingGrade', value)}
                  options={uniqueColumnValues.scalingGrade}
                />
              </div>
            </th>
          </>
        )}

        {/* AoW Motion Damage */}
        {showAowMotion && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#9a9a9a]" onClick={() => handleSort('aowMotionPhys')} title="Motion-based Physical Damage">
              <div className="flex items-center justify-center gap-1">Phy <SortIcon columnKey="aowMotionPhys" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#5bc0de]" onClick={() => handleSort('aowMotionMag')} title="Motion-based Magic Damage">
              <div className="flex items-center justify-center gap-1">Mag <SortIcon columnKey="aowMotionMag" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#f0ad4e]" onClick={() => handleSort('aowMotionFire')} title="Motion-based Fire Damage">
              <div className="flex items-center justify-center gap-1">Fire <SortIcon columnKey="aowMotionFire" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#f4e04d]" onClick={() => handleSort('aowMotionLtn')} title="Motion-based Lightning Damage">
              <div className="flex items-center justify-center gap-1">Ltn <SortIcon columnKey="aowMotionLtn" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#d4af37]" onClick={() => handleSort('aowMotionHoly')} title="Motion-based Holy Damage">
              <div className="flex items-center justify-center gap-1">Holy <SortIcon columnKey="aowMotionHoly" /></div>
            </th>
            <th className={`px-2 py-2 cursor-pointer hover:text-[#d4af37] ${selectedEnemy || showAowBullet || showAowTotal ? 'border-r border-[#2a2a2a]' : ''}`} onClick={() => handleSort('aowMotionTotal')} title="Total Motion-based Damage">
              <div className="flex items-center justify-center gap-1">Σ <SortIcon columnKey="aowMotionTotal" /></div>
            </th>
            {selectedEnemy && (
              <th className={`px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#e06666] ${showAowBullet || showAowTotal ? 'border-r border-[#2a2a2a]' : ''}`} onClick={() => handleSort('aowMotionEffectiveness')} title="Percentage of Raw Motion Damage dealt to enemy">
                <div className="flex items-center justify-center gap-1">% <SortIcon columnKey="aowMotionEffectiveness" /></div>
              </th>
            )}
          </>
        )}

        {/* AoW Bullet Damage */}
        {showAowBullet && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#9a9a9a]" onClick={() => handleSort('aowBulletPhys')} title="Bullet-based Physical Damage">
              <div className="flex items-center justify-center gap-1">Phy <SortIcon columnKey="aowBulletPhys" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#5bc0de]" onClick={() => handleSort('aowBulletMag')} title="Bullet-based Magic Damage">
              <div className="flex items-center justify-center gap-1">Mag <SortIcon columnKey="aowBulletMag" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#f0ad4e]" onClick={() => handleSort('aowBulletFire')} title="Bullet-based Fire Damage">
              <div className="flex items-center justify-center gap-1">Fire <SortIcon columnKey="aowBulletFire" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#f4e04d]" onClick={() => handleSort('aowBulletLtn')} title="Bullet-based Lightning Damage">
              <div className="flex items-center justify-center gap-1">Ltn <SortIcon columnKey="aowBulletLtn" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#d4af37]" onClick={() => handleSort('aowBulletHoly')} title="Bullet-based Holy Damage">
              <div className="flex items-center justify-center gap-1">Holy <SortIcon columnKey="aowBulletHoly" /></div>
            </th>
            <th className={`px-2 py-2 cursor-pointer hover:text-[#d4af37] ${selectedEnemy || showAowTotal ? 'border-r border-[#2a2a2a]' : ''}`} onClick={() => handleSort('aowBulletTotal')} title="Total Bullet-based Damage">
              <div className="flex items-center justify-center gap-1">Σ <SortIcon columnKey="aowBulletTotal" /></div>
            </th>
            {selectedEnemy && (
              <th className={`px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#e06666] ${showAowTotal ? 'border-r border-[#2a2a2a]' : ''}`} onClick={() => handleSort('aowBulletEffectiveness')} title="Percentage of Raw Bullet Damage dealt to enemy">
                <div className="flex items-center justify-center gap-1">% <SortIcon columnKey="aowBulletEffectiveness" /></div>
              </th>
            )}
          </>
        )}

        {/* AoW Total Damage */}
        {showAowTotal && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#9a9a9a]" onClick={() => handleSort('aowTotalPhys')} title="Total Physical AoW Damage">
              <div className="flex items-center justify-center gap-1">Phy <SortIcon columnKey="aowTotalPhys" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#5bc0de]" onClick={() => handleSort('aowTotalMag')} title="Total Magic AoW Damage">
              <div className="flex items-center justify-center gap-1">Mag <SortIcon columnKey="aowTotalMag" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#f0ad4e]" onClick={() => handleSort('aowTotalFire')} title="Total Fire AoW Damage">
              <div className="flex items-center justify-center gap-1">Fire <SortIcon columnKey="aowTotalFire" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#f4e04d]" onClick={() => handleSort('aowTotalLtn')} title="Total Lightning AoW Damage">
              <div className="flex items-center justify-center gap-1">Ltn <SortIcon columnKey="aowTotalLtn" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#d4af37]" onClick={() => handleSort('aowTotalHoly')} title="Total Holy AoW Damage">
              <div className="flex items-center justify-center gap-1">Holy <SortIcon columnKey="aowTotalHoly" /></div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] border-r border-[#2a2a2a]" onClick={() => handleSort('aowTotalDamage')} title="Total AoW Damage">
              <div className="flex items-center justify-center gap-1">Σ <SortIcon columnKey="aowTotalDamage" /></div>
            </th>
            {selectedEnemy && (
              <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#e06666] border-r border-[#2a2a2a]" onClick={() => handleSort('aowEffectiveness')} title="Percentage of Raw AoW Damage dealt to enemy">
                <div className="flex items-center justify-center gap-1">% <SortIcon columnKey="aowEffectiveness" /></div>
              </th>
            )}
          </>
        )}

        {/* DPS Columns */}
        {showDps && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('r1Dps')} title="R1 DPS (AR × Motion Value / Duration)">
              <div className="flex items-center justify-center gap-1">
                R1 <SortIcon columnKey="r1Dps" />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('r1ChainDps')} title="R1 Chain DPS (full combo)">
              <div className="flex items-center justify-center gap-1">
                R1C <SortIcon columnKey="r1ChainDps" />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('r2Dps')} title="R2 DPS (AR × Motion Value / Duration)">
              <div className="flex items-center justify-center gap-1">
                R2 <SortIcon columnKey="r2Dps" />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] border-r border-[#2a2a2a]" onClick={() => handleSort('r2ChainDps')} title="R2 Chain DPS (full combo)">
              <div className="flex items-center justify-center gap-1">
                R2C <SortIcon columnKey="r2ChainDps" />
              </div>
            </th>
          </>
        )}

        {/* Spell Power */}
        {showSpellPower && (
          <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#9370db] border-r border-[#2a2a2a]" onClick={() => handleSort('spellScaling')} title="Spell Scaling">
            <div className="flex items-center justify-center gap-1">
              Spell <SortIcon columnKey="spellScaling" />
              <ColumnFilter
                columnKey="spellScaling"
                filterType="range"
                value={columnFilters['spellScaling']}
                onChange={(value) => updateColumnFilter('spellScaling', value)}
              />
            </div>
          </th>
        )}

        {/* Efficiency */}
        {showEfficiency && (
          <>
            <th
              className="px-2 py-2 cursor-pointer hover:text-[#d4af37]"
              onClick={() => handleSort('efficiency')}
              title="Damage per stat point invested. Calculated as: Total Damage ÷ Total Stats Used (Str + Dex + Int + Fai + Arc above base class)"
            >
              <div className="flex items-center justify-center gap-1">
                Eff <SortIcon columnKey="efficiency" />
                <ColumnFilter
                  columnKey="efficiency"
                  filterType="range"
                  value={columnFilters['efficiency']}
                  onChange={(value) => updateColumnFilter('efficiency', value)}
                />
              </div>
            </th>
            <th
              className="px-2 py-2 cursor-pointer hover:text-[#d4af37] border-r border-[#2a2a2a]"
              onClick={() => handleSort('damagePercent')}
              title="Percentage of max damage (99 in all stats)"
            >
              <div className="flex items-center justify-center gap-1">
                %Max <SortIcon columnKey="damagePercent" />
                <ColumnFilter
                  columnKey="damagePercent"
                  filterType="range"
                  value={columnFilters['damagePercent']}
                  onChange={(value) => updateColumnFilter('damagePercent', value)}
                />
              </div>
            </th>
          </>
        )}

        {/* Optimal Stats */}
        {hasUnlockedStats && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('strOptimal')}>
              <div className="flex items-center justify-center gap-1">
                Str <SortIcon columnKey="strOptimal" />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('dexOptimal')}>
              <div className="flex items-center justify-center gap-1">
                Dex <SortIcon columnKey="dexOptimal" />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('intOptimal')}>
              <div className="flex items-center justify-center gap-1">
                Int <SortIcon columnKey="intOptimal" />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('faiOptimal')}>
              <div className="flex items-center justify-center gap-1">
                Fai <SortIcon columnKey="faiOptimal" />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] border-r border-[#2a2a2a]" onClick={() => handleSort('arcOptimal')}>
              <div className="flex items-center justify-center gap-1">
                Arc <SortIcon columnKey="arcOptimal" />
              </div>
            </th>
          </>
        )}

        {/* Attribute Scaling */}
        {showScaling && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('strScaling')}>
              <div className="flex items-center justify-center gap-1">
                Str <SortIcon columnKey="strScaling" />
                <ColumnFilter
                  columnKey="strScalingGrade"
                  filterType="set"
                  value={columnFilters['strScalingGrade']}
                  onChange={(value) => updateColumnFilter('strScalingGrade', value)}
                  options={uniqueColumnValues.scalingGrade}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('dexScaling')}>
              <div className="flex items-center justify-center gap-1">
                Dex <SortIcon columnKey="dexScaling" />
                <ColumnFilter
                  columnKey="dexScalingGrade"
                  filterType="set"
                  value={columnFilters['dexScalingGrade']}
                  onChange={(value) => updateColumnFilter('dexScalingGrade', value)}
                  options={uniqueColumnValues.scalingGrade}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('intScaling')}>
              <div className="flex items-center justify-center gap-1">
                Int <SortIcon columnKey="intScaling" />
                <ColumnFilter
                  columnKey="intScalingGrade"
                  filterType="set"
                  value={columnFilters['intScalingGrade']}
                  onChange={(value) => updateColumnFilter('intScalingGrade', value)}
                  options={uniqueColumnValues.scalingGrade}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('faiScaling')}>
              <div className="flex items-center justify-center gap-1">
                Fai <SortIcon columnKey="faiScaling" />
                <ColumnFilter
                  columnKey="faiScalingGrade"
                  filterType="set"
                  value={columnFilters['faiScalingGrade']}
                  onChange={(value) => updateColumnFilter('faiScalingGrade', value)}
                  options={uniqueColumnValues.scalingGrade}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] border-r border-[#2a2a2a]" onClick={() => handleSort('arcScaling')}>
              <div className="flex items-center justify-center gap-1">
                Arc <SortIcon columnKey="arcScaling" />
                <ColumnFilter
                  columnKey="arcScalingGrade"
                  filterType="set"
                  value={columnFilters['arcScalingGrade']}
                  onChange={(value) => updateColumnFilter('arcScalingGrade', value)}
                  options={uniqueColumnValues.scalingGrade}
                />
              </div>
            </th>
          </>
        )}

        {/* Requirements */}
        {showRequirements && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('strReq')}>
              <div className="flex items-center justify-center gap-1">
                Str <SortIcon columnKey="strReq" />
                <ColumnFilter
                  columnKey="strReq"
                  filterType="range"
                  value={columnFilters['strReq']}
                  onChange={(value) => updateColumnFilter('strReq', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('dexReq')}>
              <div className="flex items-center justify-center gap-1">
                Dex <SortIcon columnKey="dexReq" />
                <ColumnFilter
                  columnKey="dexReq"
                  filterType="range"
                  value={columnFilters['dexReq']}
                  onChange={(value) => updateColumnFilter('dexReq', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('intReq')}>
              <div className="flex items-center justify-center gap-1">
                Int <SortIcon columnKey="intReq" />
                <ColumnFilter
                  columnKey="intReq"
                  filterType="range"
                  value={columnFilters['intReq']}
                  onChange={(value) => updateColumnFilter('intReq', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('faiReq')}>
              <div className="flex items-center justify-center gap-1">
                Fai <SortIcon columnKey="faiReq" />
                <ColumnFilter
                  columnKey="faiReq"
                  filterType="range"
                  value={columnFilters['faiReq']}
                  onChange={(value) => updateColumnFilter('faiReq', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('arcReq')}>
              <div className="flex items-center justify-center gap-1">
                Arc <SortIcon columnKey="arcReq" />
                <ColumnFilter
                  columnKey="arcReq"
                  filterType="range"
                  value={columnFilters['arcReq']}
                  onChange={(value) => updateColumnFilter('arcReq', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 border-r border-[#2a2a2a]" title="Meets stat requirements with current build">
              <div className="flex items-center justify-center gap-1">
                Reqs
                <ColumnFilter
                  columnKey="meetsReqs"
                  filterType="boolean"
                  value={columnFilters['meetsReqs']}
                  onChange={(value) => updateColumnFilter('meetsReqs', value)}
                />
              </div>
            </th>
          </>
        )}

        {/* Attribute Investments */}
        {showAttributeInvestments && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('strDeficit')} title="STR points needed to meet requirement">
              <div className="flex items-center justify-center gap-1">
                Str <SortIcon columnKey="strDeficit" />
                <ColumnFilter
                  columnKey="strDeficit"
                  filterType="range"
                  value={columnFilters['strDeficit']}
                  onChange={(value) => updateColumnFilter('strDeficit', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('dexDeficit')} title="DEX points needed to meet requirement">
              <div className="flex items-center justify-center gap-1">
                Dex <SortIcon columnKey="dexDeficit" />
                <ColumnFilter
                  columnKey="dexDeficit"
                  filterType="range"
                  value={columnFilters['dexDeficit']}
                  onChange={(value) => updateColumnFilter('dexDeficit', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('intDeficit')} title="INT points needed to meet requirement">
              <div className="flex items-center justify-center gap-1">
                Int <SortIcon columnKey="intDeficit" />
                <ColumnFilter
                  columnKey="intDeficit"
                  filterType="range"
                  value={columnFilters['intDeficit']}
                  onChange={(value) => updateColumnFilter('intDeficit', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('faiDeficit')} title="FAI points needed to meet requirement">
              <div className="flex items-center justify-center gap-1">
                Fai <SortIcon columnKey="faiDeficit" />
                <ColumnFilter
                  columnKey="faiDeficit"
                  filterType="range"
                  value={columnFilters['faiDeficit']}
                  onChange={(value) => updateColumnFilter('faiDeficit', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('arcDeficit')} title="ARC points needed to meet requirement">
              <div className="flex items-center justify-center gap-1">
                Arc <SortIcon columnKey="arcDeficit" />
                <ColumnFilter
                  columnKey="arcDeficit"
                  filterType="range"
                  value={columnFilters['arcDeficit']}
                  onChange={(value) => updateColumnFilter('arcDeficit', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('totalDeficit')} title="Total points needed to meet all requirements">
              <div className="flex items-center justify-center gap-1">
                &Sigma; <SortIcon columnKey="totalDeficit" />
                <ColumnFilter
                  columnKey="totalDeficit"
                  filterType="range"
                  value={columnFilters['totalDeficit']}
                  onChange={(value) => updateColumnFilter('totalDeficit', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37]" onClick={() => handleSort('minLevel')} title="Minimum level to wield this weapon">
              <div className="flex items-center justify-center gap-1">
                Lvl <SortIcon columnKey="minLevel" />
                <ColumnFilter
                  columnKey="minLevel"
                  filterType="range"
                  value={columnFilters['minLevel']}
                  onChange={(value) => updateColumnFilter('minLevel', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] border-r border-[#2a2a2a]" onClick={() => handleSort('pointsRequired')} title="Points required to meet weapon requirements">
              <div className="flex items-center justify-center gap-1">
                Pts <SortIcon columnKey="pointsRequired" />
                <ColumnFilter
                  columnKey="pointsRequired"
                  filterType="range"
                  value={columnFilters['pointsRequired']}
                  onChange={(value) => updateColumnFilter('pointsRequired', value)}
                />
              </div>
            </th>
          </>
        )}

        {/* Status Effects */}
        {showStatusEffects && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#c9302c]" onClick={() => handleSort('bleed')} title="Blood Loss buildup">
              <div className="flex items-center justify-center gap-1">
                Bld <SortIcon columnKey="bleed" />
                <ColumnFilter
                  columnKey="bleed"
                  filterType="range"
                  value={columnFilters['bleed']}
                  onChange={(value) => updateColumnFilter('bleed', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#5bc0de]" onClick={() => handleSort('frost')} title="Frostbite buildup">
              <div className="flex items-center justify-center gap-1">
                Fst <SortIcon columnKey="frost" />
                <ColumnFilter
                  columnKey="frost"
                  filterType="range"
                  value={columnFilters['frost']}
                  onChange={(value) => updateColumnFilter('frost', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#9c6]" onClick={() => handleSort('poison')} title="Poison buildup">
              <div className="flex items-center justify-center gap-1">
                Psn <SortIcon columnKey="poison" />
                <ColumnFilter
                  columnKey="poison"
                  filterType="range"
                  value={columnFilters['poison']}
                  onChange={(value) => updateColumnFilter('poison', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#d9534f]" onClick={() => handleSort('scarletRot')} title="Scarlet Rot buildup">
              <div className="flex items-center justify-center gap-1">
                Rot <SortIcon columnKey="scarletRot" />
                <ColumnFilter
                  columnKey="scarletRot"
                  filterType="range"
                  value={columnFilters['scarletRot']}
                  onChange={(value) => updateColumnFilter('scarletRot', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#9370db]" onClick={() => handleSort('sleep')} title="Sleep buildup">
              <div className="flex items-center justify-center gap-1">
                Slp <SortIcon columnKey="sleep" />
                <ColumnFilter
                  columnKey="sleep"
                  filterType="range"
                  value={columnFilters['sleep']}
                  onChange={(value) => updateColumnFilter('sleep', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#ff6b35] border-r border-[#2a2a2a]" onClick={() => handleSort('madness')} title="Madness buildup">
              <div className="flex items-center justify-center gap-1">
                Mad <SortIcon columnKey="madness" />
                <ColumnFilter
                  columnKey="madness"
                  filterType="range"
                  value={columnFilters['madness']}
                  onChange={(value) => updateColumnFilter('madness', value)}
                />
              </div>
            </th>
          </>
        )}

        {/* Guard Stats */}
        {showGuardStats && (
          <>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#9a9a9a]" onClick={() => handleSort('guardPhys')} title="Physical Damage Negation when guarding">
              <div className="flex items-center justify-center gap-1">
                Phy <SortIcon columnKey="guardPhys" />
                <ColumnFilter
                  columnKey="guardPhys"
                  filterType="range"
                  value={columnFilters['guardPhys']}
                  onChange={(value) => updateColumnFilter('guardPhys', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#5bc0de]" onClick={() => handleSort('guardMag')} title="Magic Damage Negation when guarding">
              <div className="flex items-center justify-center gap-1">
                Mag <SortIcon columnKey="guardMag" />
                <ColumnFilter
                  columnKey="guardMag"
                  filterType="range"
                  value={columnFilters['guardMag']}
                  onChange={(value) => updateColumnFilter('guardMag', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#f0ad4e]" onClick={() => handleSort('guardFire')} title="Fire Damage Negation when guarding">
              <div className="flex items-center justify-center gap-1">
                Fire <SortIcon columnKey="guardFire" />
                <ColumnFilter
                  columnKey="guardFire"
                  filterType="range"
                  value={columnFilters['guardFire']}
                  onChange={(value) => updateColumnFilter('guardFire', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#f4e04d]" onClick={() => handleSort('guardLtn')} title="Lightning Damage Negation when guarding">
              <div className="flex items-center justify-center gap-1">
                Ligt <SortIcon columnKey="guardLtn" />
                <ColumnFilter
                  columnKey="guardLtn"
                  filterType="range"
                  value={columnFilters['guardLtn']}
                  onChange={(value) => updateColumnFilter('guardLtn', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#d4af37]" onClick={() => handleSort('guardHoly')} title="Holy Damage Negation when guarding">
              <div className="flex items-center justify-center gap-1">
                Holy <SortIcon columnKey="guardHoly" />
                <ColumnFilter
                  columnKey="guardHoly"
                  filterType="range"
                  value={columnFilters['guardHoly']}
                  onChange={(value) => updateColumnFilter('guardHoly', value)}
                />
              </div>
            </th>
            <th className="px-2 py-2 cursor-pointer hover:text-[#d4af37] text-[#8b8b8b] border-r border-[#2a2a2a]" onClick={() => handleSort('guardBoost')} title="Guard Boost - reduces stamina loss when blocking">
              <div className="flex items-center justify-center gap-1">
                Boost <SortIcon columnKey="guardBoost" />
                <ColumnFilter
                  columnKey="guardBoost"
                  filterType="range"
                  value={columnFilters['guardBoost']}
                  onChange={(value) => updateColumnFilter('guardBoost', value)}
                />
              </div>
            </th>
          </>
        )}
      </tr>
    </>
  ), [showEfficiency, hasUnlockedStats, showSpellPower, selectedEnemy, isWeaponSkillFilter, showAowMotion, showAowBullet, showAowTotal, showScaling, showRequirements, showAttributeInvestments, showStatusEffects, showGuardStats, showDps, showWeaponStats, handleSort, columnFilters, updateColumnFilter, uniqueColumnValues, onToggleWeaponStar]);

  // Mobile card view
  const cardVisibility = useMemo<CardVisibility>(() => ({
    weaponStats: showWeaponStats,
    guardStats: showGuardStats,
    attributeInvestments: showAttributeInvestments,
    statusEffects: showStatusEffects,
    dps: showDps,
    efficiency: showEfficiency,
    spellPower: showSpellPower,
    aowDamage: showAowDamage && !!selectedAowFilter,
    scaling: showScaling,
    requirements: showRequirements,
    weaponSkill: isWeaponSkillFilter,
  }), [showWeaponStats, showGuardStats, showAttributeInvestments, showStatusEffects, showDps, showEfficiency, showSpellPower, showAowDamage, selectedAowFilter, showScaling, showRequirements, isWeaponSkillFilter]);

  // Desktop virtualizer computed values
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  if (isMobile) {
    const mobileVirtualItems = mobileVirtualizer.getVirtualItems();
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden">
        {/* Results count */}
        <div className="px-4 py-2 text-xs text-[#6a6a6a] border-b border-[#1a1a1a]">
          {groupSortedWeapons.length} weapon{groupSortedWeapons.length !== 1 ? 's' : ''}
        </div>
        <div
          ref={mobileContainerRef}
          className={`flex-1 overflow-auto ${isStale ? "opacity-70" : ""} transition-opacity duration-150`}
        >
          <div style={{ height: `${mobileVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {mobileVirtualItems.map((virtualRow) => {
              const weapon = rows[virtualRow.index]?.original;
              if (!weapon) return null;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={(node) => { mobileVirtualizer.measureElement(node); }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="p-2">
                    <MobileWeaponCard
                      weapon={weapon}
                      isSelected={selectedWeapon?.id === weapon.id}
                      meetsRequirements={weapon.meetsReqs}
                      showOptimalStats={hasUnlockedStats}
                      visibleSections={cardVisibility}
                      onClick={() => handleWeaponSelect(weapon)}
                      isStarred={isWeaponStarred?.(weapon.id) ?? false}
                      onToggleStar={onToggleWeaponStar}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Desktop table view
  return (
    <div className="relative flex flex-col h-full bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
      <ActiveFilterChips
        filters={columnFilters}
        onRemoveFilter={(key) => updateColumnFilter(key, undefined)}
        onClearAll={clearAllFilters}
        onResetToDefaults={onColumnFiltersReset}
      />
      {/* Virtualized Table - uses groupSortedWeapons which sorts by group key when grouping is enabled */}
      {groupSortedWeapons.length === 0 && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <p className="text-[#6a6a6a] text-sm italic">
            No weapons found for current filters
          </p>
          {Object.keys(columnFilters).length > 0 && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-1.5 text-sm text-[#d4af37] hover:text-[#f4cf57] border border-[#d4af37] hover:border-[#f4cf37] rounded transition-colors pointer-events-auto"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
      <div
        ref={tableContainerRef}
        className={`flex-1 overflow-auto ${isStale ? "opacity-70" : ""} transition-opacity duration-150`}
      >
        <table className="text-sm border-collapse w-full">
          <thead className="sticky top-0 z-30 bg-[#1a1a1a] text-[#8b8b8b] text-xs">
            {renderFixedHeader()}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr><td colSpan={999} style={{ height: `${paddingTop}px`, padding: 0, border: 'none' }} /></tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              const weapon = row.original;
              const isSelected = selectedWeapon?.id === weapon.id;
              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={(node) => { rowVirtualizer.measureElement(node); }}
                  onClick={() => handleWeaponSelect(weapon)}
                  className={`
                    border-b border-[#1a1a1a] cursor-pointer transition-colors
                    ${isSelected ? "bg-[#2a2514]" : "hover:bg-[#1a1a1a]"}
                    ${!weapon.meetsReqs ? "opacity-50" : ""}
                  `}
                >
                  {renderWeaponContent(weapon)}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr><td colSpan={999} style={{ height: `${paddingBottom}px`, padding: 0, border: 'none' }} /></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
