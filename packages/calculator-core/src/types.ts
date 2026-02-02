/**
 * Shared types for Elden Ring AR Calculator
 *
 * These types define the precomputed data structures that are:
 * - Generated at build time from param XML files
 * - Shipped to the client as JSON
 * - Used by the runtime calculator
 */

// ============================================================================
// Curve Definitions (shipped to client)
// ============================================================================

/**
 * CalcCorrectGraph curve definition
 * Only 15 numbers per curve - much smaller than shipping 150 lookup values
 *
 * The curve defines stat scaling "soft caps" through 5 stages:
 * - Stage 0: stat 0 → stageMaxVal[0]
 * - Stage 1: stageMaxVal[0] → stageMaxVal[1]
 * - Stage 2: stageMaxVal[1] → stageMaxVal[2]
 * - Stage 3: stageMaxVal[2] → stageMaxVal[3]
 * - Stage 4: stageMaxVal[3] → stageMaxVal[4]
 */
export interface CurveDefinition {
  id: number;
  stageMaxVal: [number, number, number, number, number];
  stageMaxGrowVal: [number, number, number, number, number];
  adjPt_maxGrowVal: [number, number, number, number, number];
}

// ============================================================================
// Resolved Weapon Data (shipped to client)
// ============================================================================

/**
 * Scaling configuration for a single stat on a damage type
 * The `value` is precomputed: correctStat × correctRate
 */
export interface ResolvedStatScaling {
  value: number;    // Precomputed: correctStrength × correctStrengthRate (e.g., 83 for C scaling)
  curveId: number;  // Which CalcCorrectGraph curve to use
}

/**
 * Resolved damage type data (physical, magic, fire, lightning, holy)
 * Base is precomputed: attackBase × attackRate
 */
export interface ResolvedDamageType {
  base: number;  // Precomputed: attackBase × reinforceAttackRate
  scaling: {
    strength: ResolvedStatScaling | null;
    dexterity: ResolvedStatScaling | null;
    intelligence: ResolvedStatScaling | null;
    faith: ResolvedStatScaling | null;
    arcane: ResolvedStatScaling | null;
  };
}

/**
 * Resolved status effect data (poison, bleed, frost, etc.)
 */
export interface ResolvedStatusEffect {
  base: number;  // Precomputed: statusBase × statusRate
  arcaneScaling: ResolvedStatScaling | null;  // Only if status scales with arcane
}

/**
 * Stat requirements for a weapon
 */
export interface WeaponRequirements {
  strength: number;
  dexterity: number;
  intelligence: number;
  faith: number;
  arcane: number;
}

/**
 * Base guard stats for damage negation when blocking
 * Values represent percentage of damage blocked (0-100)
 */
export interface BaseGuardStats {
  physical: number;      // physGuardCutRate
  magic: number;         // magGuardCutRate
  fire: number;          // fireGuardCutRate
  lightning: number;     // thunGuardCutRate
  holy: number;          // darkGuardCutRate
  guardBoost: number;    // staminaGuardDef - affects stamina drain when blocking
}

/**
 * Guard resistance against status effects when blocking
 * Higher values = more protection against status buildup while guarding
 */
export interface GuardResistance {
  poison: number;        // poisonGuardResist
  scarletRot: number;    // diseaseGuardResist
  bleed: number;         // bloodGuardResist
  frost: number;         // freezeGuardResist
  sleep: number;         // sleepGuardResist
  madness: number;       // madnessGuardResist
  death: number;         // curseGuardResist
}

/**
 * Resolved spell scaling (after applying reinforcement rates)
 */
export interface ResolvedSpellScaling {
  strength: ResolvedStatScaling | null;
  dexterity: ResolvedStatScaling | null;
  intelligence: ResolvedStatScaling | null;
  faith: ResolvedStatScaling | null;
  arcane: ResolvedStatScaling | null;
}

/**
 * Resolved weapon scaling values (after applying reinforcement rate)
 * Used for UI display (letter grades) regardless of which damage types they affect
 */
export interface ResolvedWeaponScaling {
  strength: number;    // correctStrength × rate (for letter grade display)
  dexterity: number;   // correctAgility × rate
  intelligence: number; // correctMagic × rate
  faith: number;       // correctFaith × rate
  arcane: number;      // correctLuck × rate
}

/**
 * Fully resolved weapon data for a specific weapon + affinity + upgrade level
 * All upgrade-level-dependent calculations are precomputed
 */
export interface ResolvedWeapon {
  // Identification
  id: number;           // Weapon ID from param files
  name: string;         // Display name
  affinity: string;     // "Standard", "Heavy", "Keen", etc.
  upgradeLevel: number; // 0-25 for standard, 0-10 for somber

  // Attack Power (precomputed base + scaling config)
  physical: ResolvedDamageType | null;
  magic: ResolvedDamageType | null;
  fire: ResolvedDamageType | null;
  lightning: ResolvedDamageType | null;
  holy: ResolvedDamageType | null;

  // Status Effects
  poison: ResolvedStatusEffect | null;
  scarletRot: ResolvedStatusEffect | null;
  bleed: ResolvedStatusEffect | null;
  frost: ResolvedStatusEffect | null;
  sleep: ResolvedStatusEffect | null;
  madness: ResolvedStatusEffect | null;

  // Spell Scaling (for catalysts)
  sorceryScaling: ResolvedSpellScaling | null;
  incantationScaling: ResolvedSpellScaling | null;

  // Requirements
  requirements: WeaponRequirements;

  // Weapon scaling for display (letter grades)
  // These are the weapon's correctX values × rate, used for UI display
  weaponScaling: ResolvedWeaponScaling;

  // Properties
  isDualBlade: boolean;
  wepType: number;  // Weapon type ID from EquipParamWeapon (e.g., 35=Fist, 51=Bow)
  wepmotionCategory: number; // Animation motion category - maps to a0XX animation sections
}

// ============================================================================
// Precomputed Data Bundle (what gets shipped to client)
// ============================================================================

/**
 * Complete precomputed data bundle
 * This is what gets generated at build time and shipped to the client
 */
export interface PrecomputedData {
  version: string;
  generatedAt: string;
  weapons: ResolvedWeapon[];
  curves: Record<number, CurveDefinition>;
}

// ============================================================================
// V2: Hybrid Precomputed Data (base weapons + reinforce rates)
// ============================================================================

/**
 * Base stat scaling (before reinforcement rate is applied)
 * At runtime: finalScaling = base × rate (unless isOverride is true)
 */
export interface BaseStatScaling {
  base: number;     // correctStrength, correctAgility, etc.
  curveId: number;  // CalcCorrectGraph curve ID
  isOverride: boolean;  // If true, base is already the final value (don't multiply by rate)
}

/**
 * Base damage type data (before reinforcement rate is applied)
 * At runtime: finalBase = attackBase × attackRate
 */
export interface BaseDamageType {
  attackBase: number;  // Raw attack value from EquipParamWeapon
  scaling: {
    strength: BaseStatScaling | null;
    dexterity: BaseStatScaling | null;
    intelligence: BaseStatScaling | null;
    faith: BaseStatScaling | null;
    arcane: BaseStatScaling | null;
  };
}

/**
 * Spell scaling data for catalysts (staffs/seals)
 * Uses base 100 + scaling contributions
 */
export interface BaseSpellScaling {
  // Which stats affect spell scaling
  strength: BaseStatScaling | null;
  dexterity: BaseStatScaling | null;
  intelligence: BaseStatScaling | null;
  faith: BaseStatScaling | null;
  arcane: BaseStatScaling | null;
}

/**
 * Base status effect data (before upgrade rates applied)
 * At runtime: The base value is looked up from SpEffectParam using spEffectBehaviorId + spEffectIdOffset
 */
export interface BaseStatusEffect {
  spEffectBehaviorId: number;  // SpEffect ID reference (add spEffectId1/2 offset for upgrade level)
  spEffectSlot: 0 | 1;         // Which slot (0 for spEffectBehaviorId0, 1 for spEffectBehaviorId1)
  statusType: 'poison' | 'scarletRot' | 'bleed' | 'frost' | 'sleep' | 'madness';
  arcaneScaling: number;       // correctLuck value for arcane scaling
  curveId: number;             // CalcCorrectGraph curve ID (typically 6)
}

/**
 * SpEffect entry for status effect values
 * Lookup by: spEffectBehaviorId + spEffectIdOffset (from reinforce rates)
 */
export interface SpEffectEntry {
  poizonAttackPower: number;
  diseaseAttackPower: number;   // Scarlet Rot
  bloodAttackPower: number;
  freezeAttackPower: number;
  sleepAttackPower: number;
  madnessAttackPower: number;
}

/**
 * Weapon's base stat scaling values (correctStrength, correctAgility, etc.)
 * These are used for UI display (letter grades) regardless of which damage types they affect
 */
export interface WeaponStatScaling {
  strength: number;    // correctStrength (e.g., 47 for D grade)
  dexterity: number;   // correctAgility
  intelligence: number; // correctMagic
  faith: number;       // correctFaith
  arcane: number;      // correctLuck
}

/**
 * Base weapon data at +0 (before any reinforcement rates applied)
 * This is weapon-specific data that doesn't change with upgrade level
 */
export interface BaseWeaponData {
  id: number;
  name: string;
  affinity: string;
  reinforceTypeId: number;  // Used to look up reinforcement rates

  // Base damage types (will be multiplied by rates)
  physical: BaseDamageType | null;
  magic: BaseDamageType | null;
  fire: BaseDamageType | null;
  lightning: BaseDamageType | null;
  holy: BaseDamageType | null;

  // Weapon's base stat scaling values (for UI display)
  // These are the correctX values from EquipParamWeapon, used for letter grade display
  weaponScaling: WeaponStatScaling;

  // Requirements (don't change with level)
  requirements: WeaponRequirements;

  // Properties
  isDualBlade: boolean;
  wepType: number;  // Weapon type ID from EquipParamWeapon (e.g., 35=Fist, 51=Bow)
  wepmotionCategory: number; // Animation motion category - maps to a0XX animation sections
  maxUpgradeLevel: number;  // 25 for standard, 10 for somber

  // Catalyst properties
  sorceryScaling: BaseSpellScaling | null;     // For staffs (enableMagic)
  incantationScaling: BaseSpellScaling | null; // For seals (enableMiracle)
}

/**
 * Reinforcement rates for a specific reinforceTypeId + level
 * These are shared across many weapons
 */
export interface ReinforceRates {
  // Attack rate multipliers
  physicsAtkRate: number;
  magicAtkRate: number;
  fireAtkRate: number;
  thunderAtkRate: number;  // Lightning
  darkAtkRate: number;     // Holy

  // Scaling rate multipliers
  correctStrengthRate: number;
  correctAgilityRate: number;   // Dexterity
  correctMagicRate: number;     // Intelligence
  correctFaithRate: number;
  correctLuckRate: number;      // Arcane

  // Stamina attack rate multiplier (for AoW calculations)
  staminaAtkRate: number;

  // SpEffect ID offsets for status effects at this upgrade level
  spEffectId1: number;  // Offset for spEffectBehaviorId0
  spEffectId2: number;  // Offset for spEffectBehaviorId1

  // Guard rate multipliers (for shield/guard calculations)
  physicsGuardCutRate: number;
  magicGuardCutRate: number;
  fireGuardCutRate: number;
  thunderGuardCutRate: number;
  darkGuardCutRate: number;
  staminaGuardDefRate: number;
}

/**
 * Affinity-specific weapon data
 * Only stores data that varies per affinity
 */
export interface AffinityData {
  id: number;
  reinforceTypeId: number;

  // Damage types (vary per affinity)
  physical: BaseDamageType | null;
  magic: BaseDamageType | null;
  fire: BaseDamageType | null;
  lightning: BaseDamageType | null;
  holy: BaseDamageType | null;

  // Status effects (vary per affinity)
  poison: BaseStatusEffect | null;
  scarletRot: BaseStatusEffect | null;
  bleed: BaseStatusEffect | null;
  frost: BaseStatusEffect | null;
  sleep: BaseStatusEffect | null;
  madness: BaseStatusEffect | null;

  // Weapon's stat scaling values (for UI display, vary per affinity)
  weaponScaling: WeaponStatScaling;

  // Catalyst properties (vary per affinity)
  sorceryScaling: BaseSpellScaling | null;
  incantationScaling: BaseSpellScaling | null;
}

/**
 * Weapon entry with nested affinities
 * Stores shared weapon-level data once, with affinities nested inside
 */
export interface WeaponEntry {
  // Shared across all affinities
  requirements: WeaponRequirements;
  wepType: number;  // Weapon type ID from EquipParamWeapon (e.g., 35=Fist, 51=Bow)
  wepmotionCategory: number; // Animation motion category - maps to a0XX animation sections
  criticalValue: number;  // Critical hit multiplier (100 = base, 130 = +30% crit damage)
  isDualBlade: boolean;
  isEnhance: boolean;  // Can be buffed with greases/spells (true = can be buffed)
  maxUpgradeLevel: number;
  weight: number;  // Weapon weight for equip load calculations

  // AoW-related properties (shared across all affinities)
  attackBaseStamina: number;
  saWeaponDamage: number;  // Poise damage (Super Armor weapon damage)
  atkAttribute: number;    // Primary damage type (0=Standard, 1=Slash, 2=Strike, 3=Pierce)
  atkAttribute2: number;   // Secondary damage type (legacy, not used for atkAttribute=253)

  // Attack type flags (used for atkAttribute=253 resolution)
  // When attack's atkAttribute=253, use the first enabled flag to determine damage type
  isNormalAttackType: boolean;  // Can deal Standard damage (maps to atkAttribute 0)
  isSlashAttackType: boolean;   // Can deal Slash damage (maps to atkAttribute 1)
  isBlowAttackType: boolean;    // Can deal Strike damage (maps to atkAttribute 2)
  isThrustAttackType: boolean;  // Can deal Pierce damage (maps to atkAttribute 3)

  gemMountType: number;    // 0/1 = unique weapon, 2 = can mount AoWs
  swordArtsParamId: number; // Weapon skill ID (references SwordArtsParam)

  // Guard stats (for blocking - shared across all affinities)
  // All weapons have guard stats for damage reduction when blocking
  guardStats: BaseGuardStats;
  guardResistance: GuardResistance;

  // Affinity-specific data
  affinities: Record<string, AffinityData>;
}

/**
 * V2 Precomputed data bundle - hybrid approach with nested structure
 * - Weapons indexed by name (O(1) lookup)
 * - Affinities nested under weapon (no repeated data)
 * - Upgrade levels computed at runtime
 */
export interface PrecomputedDataV2 {
  version: string;
  generatedAt: string;

  // Weapons indexed by name, with affinities nested
  weapons: Record<string, WeaponEntry>;

  // Reinforcement rates indexed by (reinforceTypeId + level)
  reinforceRates: Record<number, ReinforceRates>;

  // Curve definitions
  curves: Record<number, CurveDefinition>;

  // SpEffect entries for status effect lookup (indexed by SpEffect ID)
  spEffects: Record<number, SpEffectEntry>;
}

// ============================================================================
// Runtime Calculator Types
// ============================================================================

/**
 * Player stats input for AR calculation
 */
export interface PlayerStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  faith: number;
  arcane: number;
}

/**
 * Calculator options
 */
export interface CalculatorOptions {
  twoHanding: boolean;
  ignoreRequirements: boolean;
}

/**
 * Per-stat scaling result
 */
export interface StatScalingResult {
  saturation: number;  // CalcCorrectGraph value (0-1 range)
  scaling: number;     // Contribution to damage
  rawScaling: number;  // Raw scaling value before saturation (correctStat × rate), e.g., 36 for D, 100 for A
}

/**
 * Display scaling values for UI (based on weapon's correctX values, regardless of whether they affect this damage type)
 */
export interface DisplayScaling {
  strength: number;    // Weapon's correctStrength × rate (for letter grade display)
  dexterity: number;   // Weapon's correctAgility × rate
  intelligence: number; // Weapon's correctMagic × rate
  faith: number;       // Weapon's correctFaith × rate
  arcane: number;      // Weapon's correctLuck × rate
}

/**
 * Damage type calculation result
 */
export interface DamageTypeResult {
  base: number;
  scaling: number;
  total: number;
  rounded: number;
  perStat: {
    strength: StatScalingResult;
    dexterity: StatScalingResult;
    intelligence: StatScalingResult;
    faith: StatScalingResult;
    arcane: StatScalingResult;
  };
  // Display scaling values for UI (weapon's correctX × rate, for letter grade display)
  // These show what letter grade to display, even if the stat doesn't affect this damage type
  displayScaling: DisplayScaling;
}

/**
 * Status effect calculation result
 */
export interface StatusEffectResult {
  base: number;
  scaling: number;
  total: number;
  rounded: number;
}

/**
 * Spell scaling calculation result (for staffs/seals)
 * Base is always 100, scaling adds to it
 */
export interface SpellScalingResult {
  base: number;     // Always 100
  scaling: number;  // Contribution from stats
  total: number;    // base + scaling
  rounded: number;  // Truncated total
  perStat: {
    strength: StatScalingResult;
    dexterity: StatScalingResult;
    intelligence: StatScalingResult;
    faith: StatScalingResult;
    arcane: StatScalingResult;
  };
}

/**
 * Full AR calculation result
 */
export interface ARResult {
  // Damage types
  physical: DamageTypeResult;
  magic: DamageTypeResult;
  fire: DamageTypeResult;
  lightning: DamageTypeResult;
  holy: DamageTypeResult;

  // Total AR
  total: number;
  rounded: number;

  // Status effects
  poison: StatusEffectResult;
  scarletRot: StatusEffectResult;
  bleed: StatusEffectResult;
  frost: StatusEffectResult;
  sleep: StatusEffectResult;
  madness: StatusEffectResult;

  // Spell scaling (for catalysts)
  sorceryScaling: SpellScalingResult | null;     // For staffs
  incantationScaling: SpellScalingResult | null; // For seals

  // Effective stats (after 2H bonus)
  effectiveStats: PlayerStats;

  // Requirements check
  requirementsMet: boolean;
}

/**
 * Guard calculation result
 * Shows damage negation percentages and guard boost at a specific upgrade level
 */
export interface GuardResult {
  // Damage negation percentages (capped at 100)
  physical: number;
  magic: number;
  fire: number;
  lightning: number;
  holy: number;
  // Guard boost (affects stamina drain when blocking)
  guardBoost: number;
  // Status resistance when blocking
  resistance: GuardResistance;
}
