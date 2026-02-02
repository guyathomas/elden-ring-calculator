/**
 * Types for the Elden Ring Calculator UI
 *
 * This file defines types that bridge between the precomputed calculator data
 * and the UI components. Some types map directly to calculator types,
 * others are UI-specific.
 */

import type {
  PrecomputedDataV2,
  PlayerStats as CalculatorPlayerStats,
  ARResult,
  WeaponEntry,
  AffinityData,
} from '../../calculator-core/dist/client.js';

import { WEAPON_CLASS_MAP } from '../../calculator-core/dist/client.js';

// Re-export core calculator types
export type { PrecomputedDataV2, ARResult, WeaponEntry, AffinityData };

// ============================================================================
// Player Stats
// ============================================================================

/**
 * Character stats for the UI - uses short stat names for UI consistency
 */
export interface CharacterStats {
  vig: number;
  mnd: number;
  end: number;
  str: number;
  dex: number;
  int: number;
  fai: number;
  arc: number;
}

/**
 * Convert UI stats to calculator format
 */
export function toCalculatorStats(stats: CharacterStats): CalculatorPlayerStats {
  return {
    strength: stats.str,
    dexterity: stats.dex,
    intelligence: stats.int,
    faith: stats.fai,
    arcane: stats.arc,
  };
}

/**
 * Stat configuration for solver/optimization.
 * A stat is effectively "fixed" when min === max.
 */
export interface StatConfig {
  min: number;
  max: number;
}

/**
 * Check if a stat is effectively locked (fixed value, not a range).
 * A stat is locked when its min equals its max.
 */
export function isStatLocked(config: StatConfig): boolean {
  return config.min === config.max;
}

/**
 * Get the effective value of a stat config.
 * For locked stats (min === max), returns that value.
 * For range stats, returns the min (the committed floor).
 */
export function getStatValue(config: StatConfig): number {
  return config.min;
}

export const DAMAGE_STATS = ['str', 'dex', 'int', 'fai', 'arc'] as const;

export function lockAllDamageStats(
  statConfigs: Record<string, StatConfig>,
  onChange: (stat: string, config: StatConfig) => void,
): void {
  for (const stat of DAMAGE_STATS) {
    if (!isStatLocked(statConfigs[stat])) {
      onChange(stat, { min: statConfigs[stat].min, max: statConfigs[stat].min });
    }
  }
}

export function unlockAllDamageStats(
  statConfigs: Record<string, StatConfig>,
  classMinMap: Record<string, number>,
  onChange: (stat: string, config: StatConfig) => void,
): void {
  for (const stat of DAMAGE_STATS) {
    if (isStatLocked(statConfigs[stat])) {
      onChange(stat, { min: classMinMap[stat], max: 99 });
    }
  }
}

// ============================================================================
// Weapon Types (UI Display)
// ============================================================================

export type ScalingGrade = '-' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

/**
 * Physical damage types in Elden Ring
 */
export type PhysDamageType = 'Standard' | 'Strike' | 'Slash' | 'Pierce';

export type Affinity =
  | 'Standard'
  | 'Heavy'
  | 'Keen'
  | 'Quality'
  | 'Magic'
  | 'Cold'
  | 'Fire'
  | 'Flame Art'
  | 'Lightning'
  | 'Sacred'
  | 'Poison'
  | 'Blood'
  | 'Occult';

/**
 * UI-friendly weapon representation for the weapon list
 * This is a flattened view of weapon data at a specific upgrade level
 */
export interface WeaponListItem {
  // Identity
  id: string;
  name: string;
  affinity: string;
  upgradeLevel: number;
  maxUpgradeLevel: number;

  // Weapon properties
  category: number;
  categoryName: string;
  wepmotionCategory: number; // Animation motion category - maps to a0XX animation sections
  weight: number;
  isDualBlade: boolean;
  isBuffable: boolean;  // Can be buffed with greases/spells (from isEnhance param)
  criticalValue: number;  // Critical hit multiplier (100 = base, 130 = +30% crit damage)
  isUnique: boolean;  // True if weapon cannot mount Ash of War (fixed skill)
  hasUniqueAttacks: boolean;  // True if weapon has non-standard attack animations for its class

  // Requirements
  requirements: {
    str: number;
    dex: number;
    int: number;
    fai: number;
    arc: number;
  };

  // Base damage at upgrade level (before scaling)
  baseDamage: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  };

  // Scaling grades at upgrade level
  scaling: {
    str: ScalingGrade;
    dex: ScalingGrade;
    int: ScalingGrade;
    fai: ScalingGrade;
    arc: ScalingGrade;
  };

  // Raw scaling values (for sorting)
  rawScaling: {
    str: number;
    dex: number;
    int: number;
    fai: number;
    arc: number;
  };

  // Spell scaling (for catalysts)
  hasSorceryScaling: boolean;
  hasIncantationScaling: boolean;

  // Precalculated primary damage type
  damageType: PhysDamageType | '-';

  // True combo count at default poise (51)
  trueCombos: number;

  // Guard stats (damage reduction when blocking - all weapons have these)
  guardStats: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
    guardBoost: number;
  };
}

/**
 * Calculated weapon data including AR results
 */
export interface CalculatedWeapon extends WeaponListItem {
  // AR calculation result
  arResult: ARResult;
  totalAR: number;

  // Requirements check
  meetsRequirements: boolean;
}

// ============================================================================
// Weapon Categories
// ============================================================================

/**
 * Re-export weapon category names from the calculator package (single source of truth)
 */
export const WEAPON_CATEGORY_NAMES = WEAPON_CLASS_MAP;

export function getCategoryName(categoryId: number): string {
  return WEAPON_CLASS_MAP[categoryId] ?? 'Unknown';
}

// ============================================================================
// Affinities
// ============================================================================

/**
 * Standard affinity order for display/sorting
 */
export const AFFINITY_ORDER: Affinity[] = [
  'Standard',
  'Heavy',
  'Keen',
  'Quality',
  'Fire',
  'Flame Art',
  'Lightning',
  'Sacred',
  'Magic',
  'Cold',
  'Poison',
  'Blood',
  'Occult',
];

/**
 * Affinities that allow weapon buffing with greases/spells.
 * Elemental and status affinities (Magic, Cold, Fire, etc.) prevent buffing.
 */
export const BUFFABLE_AFFINITIES: Set<Affinity> = new Set([
  'Standard',
  'Heavy',
  'Keen',
  'Quality',
]);

// ============================================================================
// Ash of War Types
// ============================================================================

/** Sentinel value for the "Weapon Skill" filter option.
 * When selected, filters to unique weapons and shows each weapon's built-in skill damage. */
export const WEAPON_SKILL_FILTER = '__weapon_skill__';

export interface AshOfWar {
  id: string;
  name: string;
  description?: string;
  attacks: AshAttack[];
}

export interface AshAttack {
  name: string;
  damage: {
    physical: number;
    magic: number;
    fire: number;
    lightning: number;
    holy: number;
  };
  stamina: number;
  poise: number;
  attackAttribute: 'Standard' | 'Pierce' | 'Strike' | 'Slash';
  pvpMultiplier: number;
  shieldDmg: string;
}

// ============================================================================
// Optimization Types
// ============================================================================

export interface OptimalStats {
  stats: CharacterStats;
  damage: number;
}

// ============================================================================
// Starting Classes
// ============================================================================

export type StartingClass =
  | 'Hero'
  | 'Bandit'
  | 'Astrologer'
  | 'Warrior'
  | 'Prisoner'
  | 'Confessor'
  | 'Wretch'
  | 'Vagabond'
  | 'Prophet'
  | 'Samurai';

export type AllStartingClassAttributes = 'lvl' | 'vig' | 'min' | 'end' | 'str' | 'dex' | 'int' | 'fai' | 'arc' | 'total';

export const INITIAL_CLASS_VALUES: Record<
  StartingClass,
  Record<AllStartingClassAttributes, number>
> = {
  Hero: {
    lvl: 7,
    vig: 14,
    min: 9,
    end: 12,
    str: 16,
    dex: 9,
    int: 7,
    fai: 8,
    arc: 11,
    total: 86,
  },
  Bandit: {
    lvl: 5,
    vig: 10,
    min: 11,
    end: 10,
    str: 9,
    dex: 13,
    int: 9,
    fai: 8,
    arc: 14,
    total: 84,
  },
  Astrologer: {
    lvl: 6,
    vig: 9,
    min: 15,
    end: 9,
    str: 8,
    dex: 12,
    int: 16,
    fai: 7,
    arc: 9,
    total: 85,
  },
  Warrior: {
    lvl: 8,
    vig: 11,
    min: 12,
    end: 11,
    str: 10,
    dex: 16,
    int: 10,
    fai: 8,
    arc: 9,
    total: 87,
  },
  Prisoner: {
    lvl: 9,
    vig: 11,
    min: 12,
    end: 11,
    str: 11,
    dex: 14,
    int: 14,
    fai: 6,
    arc: 9,
    total: 88,
  },
  Confessor: {
    lvl: 10,
    vig: 10,
    min: 13,
    end: 10,
    str: 12,
    dex: 12,
    int: 9,
    fai: 14,
    arc: 9,
    total: 89,
  },
  Wretch: {
    lvl: 1,
    vig: 10,
    min: 10,
    end: 10,
    str: 10,
    dex: 10,
    int: 10,
    fai: 10,
    arc: 10,
    total: 80,
  },
  Vagabond: {
    lvl: 9,
    vig: 15,
    min: 10,
    end: 11,
    str: 14,
    dex: 13,
    int: 9,
    fai: 9,
    arc: 7,
    total: 88,
  },
  Prophet: {
    lvl: 7,
    vig: 10,
    min: 14,
    end: 8,
    str: 11,
    dex: 10,
    int: 7,
    fai: 16,
    arc: 10,
    total: 86,
  },
  Samurai: {
    lvl: 9,
    vig: 12,
    min: 11,
    end: 13,
    str: 12,
    dex: 15,
    int: 9,
    fai: 8,
    arc: 8,
    total: 88,
  },
};

export const STARTING_CLASS_LIST: StartingClass[] = [
  'Vagabond',
  'Warrior',
  'Hero',
  'Bandit',
  'Astrologer',
  'Prophet',
  'Samurai',
  'Prisoner',
  'Confessor',
  'Wretch',
];

// ============================================================================
// Animation Types
// ============================================================================

/**
 * Lightweight animation index entry for search/filtering
 * This is loaded from animation-index.json.gz
 */
export interface AnimationIndexEntry {
  id: string;           // filename key (e.g., "a000_040000")
  name: string;         // human readable name
  labels: string[];     // e.g., ["Attack", "HyperArmour"]
  section: string;      // e.g., "a000"
  categories: string[]; // e.g., ["Character"]
  hasActiveFrames: boolean;
  hasCancels: boolean;
  hasSpEffects: boolean;
  hasHyperArmour: boolean;
  hasGuarding: boolean;
}

/**
 * Cancel window data from the API
 */
export interface AnimationCancelWindow {
  type: string;         // e.g., "Dodge", "RightAttack", "Block"
  startFrame: number;
  endFrame: number;
  lightEquipLoad?: {    // Optional alternate frames for light equip load
    startFrame: number;
    endFrame: number;
  };
}

/**
 * Active frame (attack hitbox) data
 */
export interface AnimationActiveFrame {
  startFrame: number;
  endFrame: number;
  type: string;         // Usually "Attack"
  params?: Record<string, number>;
}

/**
 * Special effect frame data
 */
export interface AnimationSpEffect {
  startFrame: number;
  endFrame: number;
  id: number;
  mp?: boolean;
}

/**
 * Hyper armor frame data
 */
export interface AnimationHyperArmour {
  startFrame: number;
  endFrame: number;
  isSuper: boolean;
}

/**
 * Generic frame range
 */
export interface AnimationFrameRange {
  startFrame: number;
  endFrame: number;
}

/**
 * Full animation event data returned by the API
 */
export interface AnimationEventData {
  id: string;
  filename: string;
  name: string;
  labels: string[];
  section: string;
  categories: string[];
  maxFrame: number;
  cancels: AnimationCancelWindow[];
  activeFrames: AnimationActiveFrame[];
  spEffects: AnimationSpEffect[];
  hyperArmour: AnimationHyperArmour[];
  guarding: AnimationFrameRange[];
  jumpFrames: AnimationFrameRange[];
}

/**
 * Common animation labels for filtering
 */
export const ANIMATION_LABEL_ORDER = [
  'Attack',
  'WeaponSkill',
  'Casting',
  'Parriable',
  'HyperArmour',
  'Special',
  'Multihit',
] as const;

// ============================================================================
// Combo Types
// ============================================================================

/**
 * Pre-calculated combo data for a weapon attack pair
 */
export interface ComboData {
  attackAType: number;
  attackAName: string;
  attackACategory: string;
  attackBType: number;
  attackBName: string;
  attackBCategory: string;
  // Frame data
  hitFrameA: number;
  stunDuration: number;
  cancelFrameA: number;
  cancelType: string;
  startupFrameB: number;
  // Calculated values
  gap: number;
  comboType: 'true' | 'pseudo' | 'none';
  // For poise filtering
  poiseDamageA: number;
}

// ============================================================================
// Weapon Attack Timing Types (for DPS calculations)
// ============================================================================

/**
 * Timing data for a single attack (in frames at 30fps)
 * - startup: frames before the attack becomes active (hit frame)
 * - active: frames the attack hitbox is active
 * - recovery: frames after active ends before next action
 * - totalFrames: total animation duration (startup + active + recovery)
 */
export interface AttackTiming {
  startup: number;      // Frames until hit
  active: number;       // Active hitbox frames
  recovery: number;     // Recovery frames until next action
  totalFrames: number;  // Total animation length
}

/**
 * Timing data for an attack chain (full R1 or R2 combo)
 * Includes aggregate motion value and hit count for DPS calculations
 */
export interface AttackChainTiming {
  totalFrames: number;       // Total duration of full chain
  hitCount: number;          // Number of hits in the chain
  totalMotionValue: number;  // Sum of all motion values in chain
  attacks: AttackTiming[];   // Individual attack timings
}

/**
 * Complete attack properties for a weapon
 * Separates 1H and 2H attack data since they have different animations
 */
export interface WeaponAttackProperties {
  // One-handed attacks
  oneHanded: {
    r1: AttackTiming | null;           // Single R1 attack
    r1Chain: AttackChainTiming | null; // Full R1 combo
    r2: AttackTiming | null;           // Single R2 attack
    r2Chain: AttackChainTiming | null; // Full R2 combo (including charged variants)
  };
  // Two-handed attacks
  twoHanded: {
    r1: AttackTiming | null;
    r1Chain: AttackChainTiming | null;
    r2: AttackTiming | null;
    r2Chain: AttackChainTiming | null;
  };
}

/**
 * DPS calculation result for an attack or chain
 */
export interface AttackDpsResult {
  /** Raw DPS (damage per second) based on AR and motion value */
  dps: number;
  /** Total damage for the attack/chain */
  totalDamage: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** Duration in frames */
  durationFrames: number;
  /** Average motion value per hit (for chains) */
  averageMotionValue: number;
}

// ============================================================================
// Unified Filter State
// ============================================================================

/**
 * Unified filter state used by both table and card views.
 * This ensures filters stay in sync when switching between views.
 */
export interface WeaponFilters {
  // Text search
  searchText: string;

  // Sorting
  sortKey: string;
  sortDirection: 'asc' | 'desc';

  // Set-based filters (multi-select)
  categoryFilter: Set<string>;
  affinityFilter: Set<string>;
  damageTypeFilter: Set<string>;
  statusEffectFilter: Set<string>;

  // Range filters
  weightRange: { min?: number; max?: number };
  arRange: { min?: number; max?: number };

  // Boolean filters (null = show all)
  buffableFilter: boolean | null;
  meetsReqsFilter: boolean | null;
}

/**
 * Default filter state - shows weapons meeting requirements, sorted by AR descending
 */
export const DEFAULT_WEAPON_FILTERS: WeaponFilters = {
  searchText: '',
  sortKey: 'totalAR',
  sortDirection: 'desc',
  categoryFilter: new Set(),
  affinityFilter: new Set(),
  damageTypeFilter: new Set(),
  statusEffectFilter: new Set(),
  weightRange: {},
  arRange: {},
  buffableFilter: null,
  meetsReqsFilter: true,
};

