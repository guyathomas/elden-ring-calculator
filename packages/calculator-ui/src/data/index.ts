/**
 * Data loading and weapon data management
 * Uses the precomputed V2 data format from calculator-core
 */
import type {
  ARResult,
  AffinityData,
  AowAttackResult,
  AowCalculatorInput,
  AowCalculatorResult,
  DamageBreakdownResult,
  DamageCalculationInput,
  EnemyData,
  // Enemy types
  EnemyDefenseData,
  // Guard stats types
  GuardResult,
  PlayerStats,
  PrecomputedAowData,
  PrecomputedDataV2,
  PrecomputedEnemyData,
  StatusEffectResult,
  WeaponEntry,
} from "../../../calculator-core/dist/client.js";
import {
  WEAPON_CLASS_MAP,
  applyNegation,
  calculateARV2,
  calculateAowDamage,
  // Enemy damage calculator
  calculateDefenseReduction,
  calculateEnemyDamage,
  // Guard stats calculator
  calculateGuardStatsV2,
  calculateSimpleEnemyDamage,
  calculateSingleTypeDamage,
  canWeaponMountAoW,
  getAowAttacks,
  getAvailableAowNames,
  getMaxUpgradeLevelV2,
  getPhysicalDefenseType,
  getScalingGrade,
  getUniqueSkillNames,
  getWeaponAffinitiesV2,
  getWeaponNamesV2,
  getWeaponSkillName,
  hasWeaponAffinityV2,
  resolveWeaponAtLevel,
} from "../../../calculator-core/dist/client.js";

// Re-export types and functions that components need
export type {
  PrecomputedDataV2,
  PlayerStats,
  ARResult,
  WeaponEntry,
  AffinityData,
  PrecomputedAowData,
  AowCalculatorInput,
  AowCalculatorResult,
  AowAttackResult,
  StatusEffectResult,
  // Enemy types
  EnemyDefenseData,
  EnemyData,
  PrecomputedEnemyData,
  DamageBreakdownResult,
  DamageCalculationInput,
  // Guard stats types
  GuardResult,
};
export {
  calculateARV2,
  getWeaponNamesV2,
  getWeaponAffinitiesV2,
  getMaxUpgradeLevelV2,
  hasWeaponAffinityV2,
  getScalingGrade,
  resolveWeaponAtLevel,
  calculateAowDamage,
  getAvailableAowNames,
  getAowAttacks,
  canWeaponMountAoW,
  getWeaponSkillName,
  getUniqueSkillNames,
  WEAPON_CLASS_MAP,
  // Enemy damage calculator
  calculateDefenseReduction,
  applyNegation,
  calculateSingleTypeDamage,
  getPhysicalDefenseType,
  calculateEnemyDamage,
  calculateSimpleEnemyDamage,
  // Guard stats calculator
  calculateGuardStatsV2,
};

// Shared data loading utilities
import {
  USE_MSGPACK,
  getDecompressedBytes,
  loadCompressedData,
  parseData,
} from "./loadData";

import aowJsonGzippedDataUrl from "./aow-precomputed.json.gz?url";
import aowMsgpackDataUrl from "./aow-precomputed.msgpack.gz?url";
import jsonGzippedDataUrl from "./precomputed.json.gz?url";
// Import the gzipped data URLs
// In production: use MessagePack (opaque binary, fast parsing)
// In development: use JSON (human-readable for debugging)
import msgpackDataUrl from "./precomputed.msgpack.gz?url";

// Import class standard animations (wepType -> attackSuffix -> standard animation ID)
import classStandardAnimationsData from "./class-standard-animations.json";
// Import enemy data (JSON, no gzip needed - relatively small)
import enemyDataJson from "./enemy-data.json";
// Import weapon combo breakpoints (small JSON, no need for gzip)
import weaponCombosData from "./weapon-combos.json";
// Import weapon damage types (small JSON, no need for gzip)
import weaponDamageTypesData from "./weapon-damage-types.json";
// Import weapon DPS data (pre-calculated timing and motion values)
import weaponDpsDataJson from "./weapon-dps-data.json";
// Import unique attacks data (small JSON, weapon name -> has unique attacks boolean)
import weaponsUniqueAttacksData from "./weapons-unique-attacks.json";

import type { PhysDamageType } from "../types";

let cachedData: PrecomputedDataV2 | null = null;
let cachedAowData: PrecomputedAowData | null = null;

/**
 * Pre-loaded enemy data (bosses only)
 * This is loaded synchronously since it's a small JSON file
 */
export const enemyData: PrecomputedEnemyData =
  enemyDataJson as PrecomputedEnemyData;

/**
 * Get enemy data by display key (name + location)
 */
export function getEnemyByKey(displayKey: string): EnemyData | null {
  return enemyData.bosses[displayKey] ?? null;
}

/**
 * Get list of all boss names for dropdown
 */
export function getBossNames(): string[] {
  return enemyData.bossNames;
}

/**
 * Weapon damage types mapping: weapon name -> array of physical damage types
 * Generated from attacks.json at build time
 */
export const weaponDamageTypes: Record<string, PhysDamageType[]> =
  weaponDamageTypesData as Record<string, PhysDamageType[]>;

/**
 * Get the damage types for a weapon by name
 */
export function getWeaponDamageTypes(weaponName: string): PhysDamageType[] {
  return weaponDamageTypes[weaponName] ?? [];
}

/**
 * Weapon combo breakpoints: weapon name -> [[maxPoise, count], ...]
 * Each pair means at target poise <= maxPoise, count true combos are available.
 * Generated from frame data at build time.
 */
export const weaponCombos: Record<
  string,
  Array<[number, number]>
> = weaponCombosData as Record<string, Array<[number, number]>>;

/**
 * Get the number of true combos available for a weapon at a given target poise.
 * Returns 0 if weapon has no combo data.
 */
export function getWeaponTrueCombos(
  weaponName: string,
  targetPoise: number,
): number {
  const breakpoints = weaponCombos[weaponName];
  if (!breakpoints || breakpoints.length === 0) return 0;

  // Find the count at the given poise level
  // Breakpoints are sorted by poise ascending
  for (let i = breakpoints.length - 1; i >= 0; i--) {
    if (targetPoise >= breakpoints[i][0]) {
      return breakpoints[i][1];
    }
  }

  // Target poise is below all breakpoints, return the first count
  return breakpoints[0][1];
}

/**
 * Weapons with unique attack animations: weapon name -> boolean
 * True if the weapon uses non-standard animations compared to its weapon class.
 * Generated from animation data at build time.
 */
export const weaponsUniqueAttacks: Record<string, boolean> =
  weaponsUniqueAttacksData as Record<string, boolean>;

/**
 * Check if a weapon has unique (non-standard) attack animations for its class.
 * Returns false if weapon not found in data.
 */
export function hasUniqueAttacks(weaponName: string): boolean {
  return weaponsUniqueAttacks[weaponName] ?? false;
}

/**
 * Class standard animations: wepType -> attackSuffix -> standard animation ID
 * The "standard" animation is the one used by most weapons in a class.
 * Generated from animation data at build time.
 */
export type ClassStandardAnimations = Record<number, Record<string, string>>;
export const classStandardAnimations: ClassStandardAnimations =
  classStandardAnimationsData as ClassStandardAnimations;

/**
 * Get the standard animation ID for a weapon class and attack suffix.
 * Returns null if no standard found.
 */
export function getClassStandardAnimation(
  wepType: number,
  attackSuffix: string,
): string | null {
  return classStandardAnimations[wepType]?.[attackSuffix] ?? null;
}

// ============================================================================
// Weapon DPS Data (pre-calculated attack timings and motion values)
// ============================================================================

/**
 * Pre-calculated attack DPS data for a single attack or chain
 */
export interface AttackDpsData {
  frames: number; // Total frames until can attack again
  mv: number; // Motion value (single attack) or total MV (chain)
  hits: number; // Number of hits (1 for single, N for chain)
  dpsMultiplier: number; // Pre-calculated: (mv/100) * 30 / frames
}

/**
 * DPS data for one grip (1H or 2H)
 */
export interface GripDpsData {
  r1: AttackDpsData | null;
  r1Chain: AttackDpsData | null;
  r2: AttackDpsData | null;
  r2Chain: AttackDpsData | null;
}

/**
 * Complete DPS data for a weapon
 */
export interface WeaponDpsData {
  oneHanded: GripDpsData;
  twoHanded: GripDpsData;
}

/**
 * Weapon DPS data: weapon name -> DPS data for all attacks
 * Pre-calculated at build time for instant DPS calculations.
 * DPS = AR * dpsMultiplier
 */
export const weaponDpsData: Record<string, WeaponDpsData> =
  weaponDpsDataJson as Record<string, WeaponDpsData>;

/**
 * Get DPS data for a specific weapon
 * Returns null if weapon not found
 */
export function getWeaponDpsData(weaponName: string): WeaponDpsData | null {
  return weaponDpsData[weaponName] ?? null;
}

/**
 * Load the precomputed weapon data
 * Uses MessagePack in production for opacity and performance,
 * JSON in development for debuggability
 */
export async function loadPrecomputedData(): Promise<PrecomputedDataV2> {
  if (cachedData) return cachedData;
  cachedData = await loadCompressedData<PrecomputedDataV2>(
    msgpackDataUrl,
    jsonGzippedDataUrl,
  );
  return cachedData;
}

/**
 * Load the precomputed AoW data
 * Uses MessagePack in production for opacity and performance,
 * JSON in development for debuggability
 */
export async function loadAowData(): Promise<PrecomputedAowData> {
  if (cachedAowData) return cachedAowData;
  cachedAowData = await loadCompressedData<PrecomputedAowData>(
    aowMsgpackDataUrl,
    aowJsonGzippedDataUrl,
  );
  return cachedAowData;
}

// For backwards compatibility - export promises that resolve to the data
export const precomputedPromise = loadPrecomputedData();
export const aowDataPromise = loadAowData();

// Re-export weapon attacks functionality
export {
  fetchWeaponAttacks,
  filterAttacksByGrip,
  ATTACK_TYPE_MAP,
} from "./weaponAttacks";

export type {
  WeaponAttack,
  WeaponAttacksResult,
  AttackTypeInfo,
} from "./weaponAttacks";

// ============================================================================
// Animation Data
// ============================================================================

import type {
  AnimationEventData,
  AnimationIndexEntry,
  ComboData,
} from "../types";
import animationIndexJsonGzippedUrl from "./animation-index.json.gz?url";
import animationIndexMsgpackUrl from "./animation-index.msgpack.gz?url";
import animationUsersJsonGzippedUrl from "./animation-users.json.gz?url";
import animationUsersMsgpackUrl from "./animation-users.msgpack.gz?url";
import weaponCombosDetailJsonGzippedUrl from "./weapon-combos-detail.json.gz?url";
import weaponCombosDetailMsgpackUrl from "./weapon-combos-detail.msgpack.gz?url";

let cachedAnimationIndex: AnimationIndexEntry[] | null = null;
let cachedAnimationUsers: Record<string, string[]> | null = null;
let cachedWeaponCombosDetail: Record<string, ComboData[]> | null = null;

// Per-prefix cache for chunked animation events (e.g., "a029" -> promise of that chunk's data)
const animationChunkCache = new Map<
  string,
  Promise<Record<string, AnimationEventData>>
>();

/**
 * Load the animation index (lightweight searchable list)
 * Uses MessagePack in production for opacity and performance,
 * JSON in development for debuggability
 */
export async function loadAnimationIndex(): Promise<AnimationIndexEntry[]> {
  if (cachedAnimationIndex) return cachedAnimationIndex;
  cachedAnimationIndex = await loadCompressedData<AnimationIndexEntry[]>(
    animationIndexMsgpackUrl,
    animationIndexJsonGzippedUrl,
  );
  return cachedAnimationIndex;
}

/**
 * Load a single animation event chunk by prefix (e.g., "a029").
 * Chunks are stored in public/data/animation-events/ and served as static files.
 * Caches the promise so concurrent requests for the same prefix share one fetch.
 */
function loadAnimationChunk(
  prefix: string,
): Promise<Record<string, AnimationEventData>> {
  let promise = animationChunkCache.get(prefix);
  if (!promise) {
    const ext = USE_MSGPACK ? "msgpack.gz" : "json.gz";
    const url = `/data/animation-events/${prefix}.${ext}`;
    promise = fetch(url).then(async (response) => {
      if (!response.ok)
        throw new Error(
          `Failed to load animation chunk ${prefix}: ${response.status}`,
        );
      const bytes = await getDecompressedBytes(response);
      return parseData<Record<string, AnimationEventData>>(bytes, USE_MSGPACK);
    });
    animationChunkCache.set(prefix, promise);
  }
  return promise;
}

/**
 * Fetch full animation event data by animation ID.
 * Only loads the chunk for the animation's prefix (e.g., "a029" from "a029_030000"),
 * so users only download ~12KB for their weapon class instead of ~840KB for all animations.
 */
export async function fetchAnimationData(
  animationId: string,
): Promise<AnimationEventData> {
  const prefix = animationId.split("_")[0];
  const chunk = await loadAnimationChunk(prefix);
  const animation = chunk[animationId];

  if (!animation) {
    throw new Error(`Animation not found: ${animationId}`);
  }

  return animation;
}

// Re-export animation types for convenience
export type { AnimationIndexEntry, AnimationEventData };

/**
 * Animation users data: mapping of animation ID -> list of weapon names that use it
 * This provides accurate per-animation weapon sharing data
 */
export type AnimationUsersData = Record<string, string[]>;

/**
 * Load the animation users data (per-animation weapon lists)
 * Uses MessagePack in production for opacity and performance,
 * JSON in development for debuggability
 */
export async function loadAnimationUsers(): Promise<AnimationUsersData> {
  if (cachedAnimationUsers) return cachedAnimationUsers;
  cachedAnimationUsers = await loadCompressedData<AnimationUsersData>(
    animationUsersMsgpackUrl,
    animationUsersJsonGzippedUrl,
  );
  return cachedAnimationUsers;
}

/**
 * Get the list of weapons that share a specific animation
 * Returns empty array if animation not found or no weapons share it
 */
export function getAnimationUsers(
  animationUsers: AnimationUsersData,
  animationId: string,
): string[] {
  return animationUsers[animationId] ?? [];
}

// ============================================================================
// Weapon Combos Detail Data (pre-calculated combo chains)
// ============================================================================

/**
 * Load all weapon combo detail data from pre-generated static file.
 * Cached after first load.
 */
async function loadWeaponCombosDetail(): Promise<Record<string, ComboData[]>> {
  if (cachedWeaponCombosDetail) return cachedWeaponCombosDetail;
  cachedWeaponCombosDetail = await loadCompressedData<
    Record<string, ComboData[]>
  >(weaponCombosDetailMsgpackUrl, weaponCombosDetailJsonGzippedUrl);
  return cachedWeaponCombosDetail;
}

/**
 * Fetch combo data for a specific weapon from pre-generated static data.
 * Returns empty array if weapon has no combos.
 */
export async function fetchWeaponCombos(
  weaponName: string,
): Promise<ComboData[]> {
  const allCombos = await loadWeaponCombosDetail();
  return allCombos[weaponName] ?? [];
}

// Re-export ComboData type for convenience
export type { ComboData };
