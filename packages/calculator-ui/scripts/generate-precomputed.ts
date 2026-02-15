/**
 * Generate precomputed weapon and AoW data for the web UI
 * This runs at build time to create the gzipped JSON and MessagePack that ships to the client
 *
 * In production, MessagePack binary format is served (gzipped) for:
 * - Smaller payload size
 * - Data opacity (not human-readable)
 * - Fast parsing
 *
 * In development, human-readable JSON is used for debugging.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { gzipSync } from 'zlib';
import { encode as msgpackEncode } from '@msgpack/msgpack';
import { buildPrecomputedDataV2, buildPrecomputedAowData } from '../../calculator-core/dist/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARAM_FILES_DIR = path.join(__dirname, '../../calculator-core/param-files');
const OUTPUT_DIR = path.join(__dirname, '../src/data');

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

// ============================================================================
// Generate Weapon Data (V2)
// ============================================================================

console.log('Generating V2 precomputed weapon data (all weapons)...');

// Build V2 precomputed data with nested structure
const precomputed = buildPrecomputedDataV2(PARAM_FILES_DIR);

const weaponCount = Object.keys(precomputed.weapons).length;
const affinityCount = Object.values(precomputed.weapons).reduce(
  (sum, w) => sum + Object.keys(w.affinities).length,
  0
);

console.log(`Generated data for ${weaponCount} unique weapons`);
console.log(`Total weapon+affinity combinations: ${affinityCount}`);
console.log(`Using ${Object.keys(precomputed.reinforceRates).length} reinforcement rate entries`);
console.log(`Using ${Object.keys(precomputed.curves).length} curve definitions`);

// Generate JSON and gzip it
const jsonString = JSON.stringify(precomputed);
const gzipped = gzipSync(jsonString);

// Generate MessagePack and gzip it (for production)
const msgpacked = msgpackEncode(precomputed);
const msgpackGzipped = gzipSync(msgpacked);

// Write gzipped JSON (for dev server backwards compat)
const gzipPath = path.join(OUTPUT_DIR, 'precomputed.json.gz');
writeFileSync(gzipPath, gzipped);

// Write gzipped MessagePack (for production)
const msgpackGzipPath = path.join(OUTPUT_DIR, 'precomputed.msgpack.gz');
writeFileSync(msgpackGzipPath, msgpackGzipped);

// Also write the JSON for development (non-gzipped, human-readable)
const jsonPath = path.join(OUTPUT_DIR, 'precomputed.json');
writeFileSync(jsonPath, jsonString);

console.log(`Weapon data - Raw JSON: ${(jsonString.length / 1024).toFixed(1)} KB`);
console.log(`Weapon data - Gzipped JSON: ${(gzipped.length / 1024).toFixed(1)} KB`);
console.log(`Weapon data - Gzipped MessagePack: ${(msgpackGzipped.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${gzipPath} and ${msgpackGzipPath}`);

// ============================================================================
// Generate AoW Data
// ============================================================================

console.log('\nGenerating precomputed AoW data...');

const aowData = buildPrecomputedAowData(PARAM_FILES_DIR);

const aowCount = Object.keys(aowData.swordArtsByName).length;
const attackCount = Object.keys(aowData.attacks).length;

console.log(`Generated data for ${aowCount} Ashes of War`);
console.log(`Total attacks: ${attackCount}`);
console.log(`Using ${Object.keys(aowData.attackElementCorrect).length} AttackElementCorrect entries`);
console.log(`Using ${Object.keys(aowData.equipParamGem).length} EquipParamGem entries`);

// Generate JSON and gzip it
const aowJsonString = JSON.stringify(aowData);
const aowGzipped = gzipSync(aowJsonString);

// Generate MessagePack and gzip it (for production)
const aowMsgpacked = msgpackEncode(aowData);
const aowMsgpackGzipped = gzipSync(aowMsgpacked);

// Write gzipped JSON (for dev server backwards compat)
const aowGzipPath = path.join(OUTPUT_DIR, 'aow-precomputed.json.gz');
writeFileSync(aowGzipPath, aowGzipped);

// Write gzipped MessagePack (for production)
const aowMsgpackGzipPath = path.join(OUTPUT_DIR, 'aow-precomputed.msgpack.gz');
writeFileSync(aowMsgpackGzipPath, aowMsgpackGzipped);

// Also write the JSON for development (non-gzipped, human-readable)
const aowJsonPath = path.join(OUTPUT_DIR, 'aow-precomputed.json');
writeFileSync(aowJsonPath, aowJsonString);

console.log(`AoW data - Raw JSON: ${(aowJsonString.length / 1024).toFixed(1)} KB`);
console.log(`AoW data - Gzipped JSON: ${(aowGzipped.length / 1024).toFixed(1)} KB`);
console.log(`AoW data - Gzipped MessagePack: ${(aowMsgpackGzipped.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${aowGzipPath} and ${aowMsgpackGzipPath}`);

// ============================================================================
// Generate Weapon Damage Types Mapping
// ============================================================================

console.log('\nGenerating weapon damage types mapping...');

// Physical damage types in the game
type PhysDamageType = 'Standard' | 'Strike' | 'Slash' | 'Pierce';

// Damage type priority for sorting (most common attack types first)
const DAMAGE_TYPE_ORDER: Record<PhysDamageType, number> = {
  Standard: 0,
  Slash: 1,
  Strike: 2,
  Pierce: 3,
};

// Valid attack type suffixes (from atkParamId % 1000)
// This filters out weapon skills and only includes base weapon attacks
const VALID_ATTACK_TYPES = new Set([
  0, 10, 20, 30, 40, 50,           // 1H Light
  100, 105, 110, 115,              // 1H Heavy
  120, 125, 130, 140, 150, 160,    // 1H Running/Crouch/Backstep/Rolling
  170, 175,                         // 1H Jumping
  200, 210, 220, 230, 240,         // 2H Light
  300, 305, 310, 315,              // 2H Heavy
  320, 325, 330, 340, 350, 360,    // 2H Running/Crouch/Backstep/Rolling
  370, 380,                         // 2H Jumping
  400, 410, 420, 430, 440, 450,    // Paired
  500, 510,                         // Guard Counter
]);

interface RawAttackData {
  refs?: { atkParamId: number };
  physAttribute: string;
  weapons?: string[];
  physicalDamageMV?: number;
}

// Load attacks.json
const attacksPath = path.join(__dirname, '../../calculator-core/data/attacks.json');
const rawAttacks: Record<string, RawAttackData> = JSON.parse(readFileSync(attacksPath, 'utf-8'));

// Build weapon -> damage types mapping (with counts for sorting by frequency)
const weaponDamageTypeCounts: Record<string, Record<PhysDamageType, number>> = {};

for (const attackData of Object.values(rawAttacks)) {
  if (!attackData.weapons || !attackData.physAttribute) continue;

  // Filter to only valid attack types (base weapon attacks, not skills)
  if (attackData.refs?.atkParamId) {
    const attackType = attackData.refs.atkParamId % 1000;
    if (!VALID_ATTACK_TYPES.has(attackType)) continue;
  }

  // Skip zero motion value attacks
  if (attackData.physicalDamageMV === 0) continue;

  const damageType = attackData.physAttribute as PhysDamageType;
  // Only include valid damage types
  if (!['Standard', 'Strike', 'Slash', 'Pierce'].includes(damageType)) continue;

  for (const weaponName of attackData.weapons) {
    if (!weaponDamageTypeCounts[weaponName]) {
      weaponDamageTypeCounts[weaponName] = {} as Record<PhysDamageType, number>;
    }
    weaponDamageTypeCounts[weaponName][damageType] = (weaponDamageTypeCounts[weaponName][damageType] || 0) + 1;
  }
}

// Normalize weapon name by removing accents (e.g., "Miséricorde" -> "Misericorde")
// NOTE: This function is duplicated in api/attacks/[weapon].ts - keep both in sync
function normalizeWeaponName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Convert to sorted arrays (sorted by attack count descending - most common first)
// Also add entries with normalized names for lookup compatibility
const weaponDamageTypes: Record<string, PhysDamageType[]> = {};

for (const [weaponName, counts] of Object.entries(weaponDamageTypeCounts)) {
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([type]) => type as PhysDamageType);

  weaponDamageTypes[weaponName] = sorted;

  // Also add normalized name if different (for lookup compatibility)
  const normalizedName = normalizeWeaponName(weaponName);
  if (normalizedName !== weaponName) {
    weaponDamageTypes[normalizedName] = sorted;
  }
}

const weaponDamageTypesCount = Object.keys(weaponDamageTypes).length;
console.log(`Generated damage types for ${weaponDamageTypesCount} weapons`);

// Count weapons by number of damage types
const damageTypeCounts: Record<number, number> = {};
for (const types of Object.values(weaponDamageTypes)) {
  damageTypeCounts[types.length] = (damageTypeCounts[types.length] || 0) + 1;
}
console.log('Weapons by damage type count:', damageTypeCounts);

// Write JSON (no gzip needed - small file)
const damageTypesJsonString = JSON.stringify(weaponDamageTypes);
const damageTypesPath = path.join(OUTPUT_DIR, 'weapon-damage-types.json');
writeFileSync(damageTypesPath, damageTypesJsonString);

console.log(`Damage types - Raw JSON: ${(damageTypesJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${damageTypesPath}`);

// ============================================================================
// Generate Weapons Motion Category Data (for API endpoint)
// ============================================================================

console.log('\nGenerating weapons motion category data...');

// Build a simple mapping of weapon name -> wepmotionCategory for the API
const weaponsMotionData: Record<string, { wepmotionCategory: number }> = {};

for (const [weaponName, weaponData] of Object.entries(precomputed.weapons)) {
  weaponsMotionData[weaponName] = {
    wepmotionCategory: weaponData.wepmotionCategory,
  };

  // Also add normalized name if different (for lookup compatibility)
  const normalizedName = normalizeWeaponName(weaponName);
  if (normalizedName !== weaponName) {
    weaponsMotionData[normalizedName] = {
      wepmotionCategory: weaponData.wepmotionCategory,
    };
  }
}

const weaponsJsonString = JSON.stringify(weaponsMotionData);
// Write to calculator-core/data so it's bundled with API functions
const CORE_DATA_DIR = path.join(__dirname, '../../calculator-core/data');
const weaponsJsonPath = path.join(CORE_DATA_DIR, 'weapons.json');
writeFileSync(weaponsJsonPath, weaponsJsonString);

console.log(`Generated motion data for ${Object.keys(weaponsMotionData).length} weapons`);
console.log(`Weapons data - Raw JSON: ${(weaponsJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${weaponsJsonPath}`);

// ============================================================================
// Generate Combo Animations Data (minimal animation data for combos API)
// ============================================================================

console.log('\nGenerating combo animations data...');

// Load full animations file
const fullAnimationsPath = path.join(__dirname, '../../calculator-core/data/animations.json');
const fullAnimations: Record<string, {
  events?: {
    activeFrames?: Array<{ range: [number, number]; type: string }>;
    cancels?: Array<{ type: string; range: { Regular?: [number, number] } }>;
  };
}> = JSON.parse(readFileSync(fullAnimationsPath, 'utf-8'));

// Cancel types relevant for combo calculation
const COMBO_CANCEL_TYPES = ['LightAttackOnly', 'RightAttack', 'Attack'];

// Extract minimal data: just hit frames and cancel frames for weapon attacks
// Weapon attack animations match pattern: a###_0[34]#### (1H attacks start with 03, 2H with 04)
const comboAnimations: Record<string, {
  /** Hit frame (first active Attack frame) */
  h: number | null;
  /** Cancel windows: array of [type, startFrame] */
  c: Array<[string, number]>;
}> = {};

let includedCount = 0;
for (const [id, anim] of Object.entries(fullAnimations)) {
  // Only include weapon attack animations (a###_03#### or a###_04####)
  if (!/^a\d{3}_0[34]\d{4}$/.test(id)) continue;

  const events = anim.events;
  if (!events) continue;

  // Get first Attack active frame
  const hitFrame = events.activeFrames?.find(af => af.type === 'Attack')?.range?.[0] ?? null;

  // Get relevant cancel windows
  const cancels: Array<[string, number]> = [];
  for (const cancel of events.cancels || []) {
    if (COMBO_CANCEL_TYPES.includes(cancel.type) && cancel.range?.Regular?.[0]) {
      cancels.push([cancel.type, cancel.range.Regular[0]]);
    }
  }

  // Only include if we have useful data
  if (hitFrame !== null || cancels.length > 0) {
    comboAnimations[id] = { h: hitFrame, c: cancels };
    includedCount++;
  }
}

const comboAnimationsJson = JSON.stringify(comboAnimations);
const comboAnimationsPath = path.join(CORE_DATA_DIR, 'combo-animations.json');
writeFileSync(comboAnimationsPath, comboAnimationsJson);

console.log(`Extracted ${includedCount} weapon attack animations (from ${Object.keys(fullAnimations).length} total)`);
console.log(`Combo animations - Raw JSON: ${(comboAnimationsJson.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${comboAnimationsPath}`);

// ============================================================================
// Calculate True Combo Breakpoints (poise-dependent combo counts)
// ============================================================================

console.log('\nCalculating true combo breakpoints for all weapons...');

import { getTrueComboBreakpoints, type RawAttack as ComboRawAttack, type ComboAnimation } from '../../calculator-core/dist/index.js';

// Build attacks map
const attacksMap = new Map<string, ComboRawAttack>();
for (const [key, attack] of Object.entries(rawAttacks)) {
  if (attack.refs?.atkParamId) {
    attacksMap.set(key, attack as ComboRawAttack);
  }
}

// Calculate combo breakpoints for each weapon
// Structure: { weaponName: [[poise, count], ...] }
// Each pair means: at target poise <= this value, count combos are available
const weaponCombos: Record<string, Array<[number, number]>> = {};
let weaponsWithCombos = 0;

for (const [weaponName, weaponData] of Object.entries(precomputed.weapons)) {
  const breakpoints = getTrueComboBreakpoints(
    weaponName,
    weaponData.wepmotionCategory,
    attacksMap,
    comboAnimations as Record<string, ComboAnimation>
  );

  if (breakpoints.length > 0) {
    weaponCombos[weaponName] = breakpoints;
    weaponsWithCombos++;

    // Also add normalized name if different
    const normalizedName = normalizeWeaponName(weaponName);
    if (normalizedName !== weaponName) {
      weaponCombos[normalizedName] = breakpoints;
    }
  }
}

// Write weapon combos data for UI (separate file)
const weaponCombosJson = JSON.stringify(weaponCombos);
const weaponCombosPath = path.join(OUTPUT_DIR, 'weapon-combos.json');
writeFileSync(weaponCombosPath, weaponCombosJson);

console.log(`Calculated combo breakpoints for ${Object.keys(precomputed.weapons).length} weapons`);
console.log(`Weapons with true combos: ${weaponsWithCombos}`);
console.log(`Weapon combos - Raw JSON: ${(weaponCombosJson.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${weaponCombosPath}`);

// ============================================================================
// Generate Enemy Data (Bosses only)
// ============================================================================

console.log('\nGenerating enemy data (bosses only)...');

import type { EnemyData, EnemyDefenseData, PrecomputedEnemyData } from '../../calculator-core/dist/client.js';

const enemyDataPath = path.join(__dirname, '../../calculator-core/data/enemy-data.tsv');
const enemyTsv = readFileSync(enemyDataPath, 'utf-8');
const enemyLines = enemyTsv.split('\n');

// Parse the header to understand column positions
const header = enemyLines[0].split('\t');

// Find column indices (based on the TSV structure)
// Location, Name, Is Boss, Is DLC, ID, [empty], Health, dlcClear, [empty],
// Phys, Strike, Slash, Pierce, Magic, Fire, Ltng, Holy (defense), [empty],
// Phys, Strike, Slash, Pierce, Magic, Fire, Ltng, Holy (negation), ...
const COL_LOCATION = 0;
const COL_NAME = 1;
const COL_IS_BOSS = 2;
const COL_IS_DLC = 3;
const COL_ID = 4;
// Skip empty column at 5
const COL_HEALTH = 6;
// Skip dlcClear at 7, empty at 8
// Defense columns start at 9
const COL_DEF_PHYS = 9;
const COL_DEF_STRIKE = 10;
const COL_DEF_SLASH = 11;
const COL_DEF_PIERCE = 12;
const COL_DEF_MAGIC = 13;
const COL_DEF_FIRE = 14;
const COL_DEF_LTNG = 15;
const COL_DEF_HOLY = 16;
// Skip empty at 17
// Negation columns start at 18
const COL_NEG_PHYS = 18;
const COL_NEG_STRIKE = 19;
const COL_NEG_SLASH = 20;
const COL_NEG_PIERCE = 21;
const COL_NEG_MAGIC = 22;
const COL_NEG_FIRE = 23;
const COL_NEG_LTNG = 24;
const COL_NEG_HOLY = 25;

function parseNumber(val: string): number {
  if (!val || val === '-' || val === '∞' || val.toLowerCase() === 'immune') {
    return 0;
  }
  // Remove commas from numbers like "2,102"
  return parseFloat(val.replace(/,/g, '')) || 0;
}

function parseBoolean(val: string): boolean {
  return val?.toUpperCase() === 'TRUE';
}

const bosses: Record<string, EnemyData> = {};
const bossNames: string[] = [];

// Skip header line
for (let i = 1; i < enemyLines.length; i++) {
  const line = enemyLines[i].trim();
  if (!line) continue;

  const cols = line.split('\t');

  const id = cols[COL_ID]?.trim() || '';
  const isBoss = parseBoolean(cols[COL_IS_BOSS]);
  // Only include bosses OR Omen Monstrosity (for testing)
  if (!isBoss && id !== '21401435') continue;

  const location = cols[COL_LOCATION]?.trim() || '';
  const name = cols[COL_NAME]?.trim() || '';
  const isDLC = parseBoolean(cols[COL_IS_DLC]);
  /* id declared above */
  const health = parseNumber(cols[COL_HEALTH]);

  // Parse defense values
  const defense = {
    physical: parseNumber(cols[COL_DEF_PHYS]),
    strike: parseNumber(cols[COL_DEF_STRIKE]),
    slash: parseNumber(cols[COL_DEF_SLASH]),
    pierce: parseNumber(cols[COL_DEF_PIERCE]),
    magic: parseNumber(cols[COL_DEF_MAGIC]),
    fire: parseNumber(cols[COL_DEF_FIRE]),
    lightning: parseNumber(cols[COL_DEF_LTNG]),
    holy: parseNumber(cols[COL_DEF_HOLY]),
  };

  // Parse negation values
  const negation = {
    physical: parseNumber(cols[COL_NEG_PHYS]),
    strike: parseNumber(cols[COL_NEG_STRIKE]),
    slash: parseNumber(cols[COL_NEG_SLASH]),
    pierce: parseNumber(cols[COL_NEG_PIERCE]),
    magic: parseNumber(cols[COL_NEG_MAGIC]),
    fire: parseNumber(cols[COL_NEG_FIRE]),
    lightning: parseNumber(cols[COL_NEG_LTNG]),
    holy: parseNumber(cols[COL_NEG_HOLY]),
  };

  const defenses: EnemyDefenseData = { defense, negation };

  // Create unique key combining location and name (some bosses appear in multiple locations)
  const displayKey = `${name} (${location})`;

  const enemy: EnemyData = {
    id,
    name,
    location,
    isBoss,
    isDLC,
    health,
    defenses,
  };

  bosses[displayKey] = enemy;

  // Add unique name to list
  if (!bossNames.includes(displayKey)) {
    bossNames.push(displayKey);
  }
}

// Sort boss names alphabetically
bossNames.sort((a, b) => a.localeCompare(b));

const enemyData: PrecomputedEnemyData = {
  bosses,
  bossNames,
};

const bossCount = Object.keys(bosses).length;
console.log(`Generated data for ${bossCount} bosses`);

// Write JSON (no gzip needed - relatively small file)
const enemyJsonString = JSON.stringify(enemyData);
const enemyJsonPath = path.join(OUTPUT_DIR, 'enemy-data.json');
writeFileSync(enemyJsonPath, enemyJsonString);

console.log(`Enemy data - Raw JSON: ${(enemyJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${enemyJsonPath}`);

// ============================================================================
// Generate Animation Index (lightweight searchable index)
// ============================================================================

console.log('\nGenerating animation index...');

interface RawAnimationEvents {
  cancels?: unknown[];
  activeFrames?: unknown[];
  spEffects?: unknown[];
  hyperArmour?: unknown[];
  guarding?: unknown[];
}

interface RawAnimation {
  name: string;
  labels: string[];
  filename: string;
  section: string;
  categories: string[];
  events: RawAnimationEvents;
}

interface AnimationIndexEntry {
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

// Load animations.json
const animationsPath = path.join(__dirname, '../../calculator-core/data/animations.json');
const rawAnimations: Record<string, RawAnimation> = JSON.parse(readFileSync(animationsPath, 'utf-8'));

// Build lightweight index
const animationIndex: AnimationIndexEntry[] = [];

for (const [key, animation] of Object.entries(rawAnimations)) {
  const events = animation.events || {};
  
  // Only include animations that have at least one useful event type
  const hasActiveFrames = (events.activeFrames?.length ?? 0) > 0;
  const hasCancels = (events.cancels?.length ?? 0) > 0;
  const hasSpEffects = (events.spEffects?.length ?? 0) > 0;
  const hasHyperArmour = (events.hyperArmour?.length ?? 0) > 0;
  const hasGuarding = (events.guarding?.length ?? 0) > 0;
  
  // Skip animations with no event data
  if (!hasActiveFrames && !hasCancels && !hasSpEffects && !hasHyperArmour && !hasGuarding) {
    continue;
  }
  
  animationIndex.push({
    id: key,
    name: animation.name || key,
    labels: animation.labels || [],
    section: animation.section || '',
    categories: animation.categories || [],
    hasActiveFrames,
    hasCancels,
    hasSpEffects,
    hasHyperArmour,
    hasGuarding,
  });
}

// Sort by section then by id for predictable ordering
animationIndex.sort((a, b) => {
  if (a.section !== b.section) return a.section.localeCompare(b.section);
  return a.id.localeCompare(b.id);
});

const animationIndexCount = animationIndex.length;
const totalAnimations = Object.keys(rawAnimations).length;
console.log(`Generated index for ${animationIndexCount} animations with events (out of ${totalAnimations} total)`);

// Count by label for info
const labelCounts: Record<string, number> = {};
for (const anim of animationIndex) {
  for (const label of anim.labels) {
    labelCounts[label] = (labelCounts[label] || 0) + 1;
  }
}
const topLabels = Object.entries(labelCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([label, count]) => `${label}: ${count}`);
console.log('Top 10 labels:', topLabels.join(', '));

// Generate JSON and gzip it
const animationIndexJsonString = JSON.stringify(animationIndex);
const animationIndexGzipped = gzipSync(animationIndexJsonString);

// Generate MessagePack and gzip it (for production)
const animationIndexMsgpacked = msgpackEncode(animationIndex);
const animationIndexMsgpackGzipped = gzipSync(animationIndexMsgpacked);

// Write all versions
const animationIndexGzipPath = path.join(OUTPUT_DIR, 'animation-index.json.gz');
const animationIndexMsgpackGzipPath = path.join(OUTPUT_DIR, 'animation-index.msgpack.gz');
const animationIndexJsonPath = path.join(OUTPUT_DIR, 'animation-index.json');
writeFileSync(animationIndexGzipPath, animationIndexGzipped);
writeFileSync(animationIndexMsgpackGzipPath, animationIndexMsgpackGzipped);
writeFileSync(animationIndexJsonPath, animationIndexJsonString);

console.log(`Animation index - Raw JSON: ${(animationIndexJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Animation index - Gzipped JSON: ${(animationIndexGzipped.length / 1024).toFixed(1)} KB`);
console.log(`Animation index - Gzipped MessagePack: ${(animationIndexMsgpackGzipped.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${animationIndexGzipPath} and ${animationIndexMsgpackGzipPath}`);

// ============================================================================
// Generate Animation Users Data (per-animation weapon users)
// ============================================================================

console.log('\nGenerating animation users data...');

interface AnimationUser {
  name: string;
  id: number;
  type: string;
}

interface RawAnimationWithUsers extends RawAnimation {
  users?: AnimationUser[];
}

// Build a mapping of animation ID -> list of weapon names that use it
const animationUsers: Record<string, string[]> = {};

const rawAnimationsWithUsers = rawAnimations as Record<string, RawAnimationWithUsers>;

for (const [animId, animation] of Object.entries(rawAnimationsWithUsers)) {
  // Only include weapon attack animations (a###_0[34]####) - same filter as combo animations
  if (!/^a\d{3}_0[34]\d{4}$/.test(animId)) continue;

  if (animation.users && animation.users.length > 0) {
    // Filter to only Weapon type users and extract names
    const weaponNames = animation.users
      .filter(u => u.type === 'Weapon')
      .map(u => u.name);

    if (weaponNames.length > 0) {
      animationUsers[animId] = weaponNames;
    }
  }
}

const animationUsersCount = Object.keys(animationUsers).length;
console.log(`Generated users data for ${animationUsersCount} weapon attack animations`);

// Count average users per animation
const totalUsers = Object.values(animationUsers).reduce((sum, users) => sum + users.length, 0);
console.log(`Average users per animation: ${(totalUsers / animationUsersCount).toFixed(1)}`);

// Generate JSON and gzip it
const animationUsersJsonString = JSON.stringify(animationUsers);
const animationUsersGzipped = gzipSync(animationUsersJsonString);

// Generate MessagePack and gzip it (for production)
const animationUsersMsgpacked = msgpackEncode(animationUsers);
const animationUsersMsgpackGzipped = gzipSync(animationUsersMsgpacked);

// Write all versions
const animationUsersGzipPath = path.join(OUTPUT_DIR, 'animation-users.json.gz');
const animationUsersMsgpackGzipPath = path.join(OUTPUT_DIR, 'animation-users.msgpack.gz');
const animationUsersJsonPath = path.join(OUTPUT_DIR, 'animation-users.json');
writeFileSync(animationUsersGzipPath, animationUsersGzipped);
writeFileSync(animationUsersMsgpackGzipPath, animationUsersMsgpackGzipped);
writeFileSync(animationUsersJsonPath, animationUsersJsonString);

console.log(`Animation users - Raw JSON: ${(animationUsersJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Animation users - Gzipped JSON: ${(animationUsersGzipped.length / 1024).toFixed(1)} KB`);
console.log(`Animation users - Gzipped MessagePack: ${(animationUsersMsgpackGzipped.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${animationUsersGzipPath} and ${animationUsersMsgpackGzipPath}`);

// ============================================================================
// Generate Unique Attacks Data (weapons with non-standard animations for their class)
// ============================================================================

console.log('\nGenerating unique attacks data...');

// Attack suffixes we care about (main combat attacks)
const ATTACK_SUFFIXES: Record<string, string> = {
  'R1-1': '030000',
  'R1-2': '030005',
  'R1-3': '030010',
  'R1-4': '030015',
  'R1-5': '030020',
  'R2-1': '030500',
  'R2-2': '030505',
  'Charged R2-1': '030600',
  'Charged R2-2': '030605',
  'Running R1': '031000',
  'Running R2': '031500',
  'Rolling R1': '032000',
  'Backstep R1': '033000',
  'Crouch R1': '034000',
  'Crouch R2': '034500',
  'Jump R1': '035000',
  'Jump R2': '035500',
};

// Build reverse index: weapon name -> suffix -> animation ID
const weaponAnimationMap = new Map<string, Map<string, string>>();

for (const [animId, weaponNames] of Object.entries(animationUsers)) {
  const suffix = animId.split('_')[1];
  if (!suffix) continue;

  for (const weaponName of weaponNames) {
    if (!weaponAnimationMap.has(weaponName)) {
      weaponAnimationMap.set(weaponName, new Map());
    }
    weaponAnimationMap.get(weaponName)!.set(suffix, animId);
  }
}

// Group weapons by class (wepType)
const weaponsByClass = new Map<number, string[]>();
for (const [name, weapon] of Object.entries(precomputed.weapons)) {
  const wepType = (weapon as { wepType: number }).wepType;
  if (!weaponsByClass.has(wepType)) {
    weaponsByClass.set(wepType, []);
  }
  weaponsByClass.get(wepType)!.push(name);
}

// For each class, find the "standard" animation for each attack type
// Standard = the animation used by most weapons in that class
const classStandardAnimations = new Map<number, Map<string, string>>(); // wepType -> suffix -> animId

for (const [wepType, weapons] of weaponsByClass) {
  const standardMap = new Map<string, string>();

  for (const suffix of Object.values(ATTACK_SUFFIXES)) {
    // Count which animations are used for this attack in this class
    const animCounts = new Map<string, number>();

    for (const weaponName of weapons) {
      const weaponAnims = weaponAnimationMap.get(weaponName);
      if (!weaponAnims) continue;

      const animId = weaponAnims.get(suffix);
      if (animId) {
        animCounts.set(animId, (animCounts.get(animId) || 0) + 1);
      }
    }

    // Find the most common animation
    let maxCount = 0;
    let standardAnim = '';
    for (const [animId, count] of animCounts) {
      if (count > maxCount) {
        maxCount = count;
        standardAnim = animId;
      }
    }

    if (standardAnim) {
      standardMap.set(suffix, standardAnim);
    }
  }

  classStandardAnimations.set(wepType, standardMap);
}

// Now check each weapon: does it have any non-standard animations?
const weaponsWithUniqueAttacks: Record<string, boolean> = {};
let uniqueCount = 0;

for (const [name, weapon] of Object.entries(precomputed.weapons)) {
  const wepType = (weapon as { wepType: number }).wepType;
  const standards = classStandardAnimations.get(wepType);
  const weaponAnims = weaponAnimationMap.get(name);

  if (!standards || !weaponAnims) {
    weaponsWithUniqueAttacks[name] = false;
    continue;
  }

  let hasUnique = false;

  for (const suffix of Object.values(ATTACK_SUFFIXES)) {
    const standardAnim = standards.get(suffix);
    const weaponAnim = weaponAnims.get(suffix);

    // If the weapon has an animation for this attack and it differs from standard
    if (weaponAnim && standardAnim && weaponAnim !== standardAnim) {
      hasUnique = true;
      break;
    }
  }

  weaponsWithUniqueAttacks[name] = hasUnique;
  if (hasUnique) uniqueCount++;

  // Also add normalized name if different
  const normalizedName = normalizeWeaponName(name);
  if (normalizedName !== name) {
    weaponsWithUniqueAttacks[normalizedName] = hasUnique;
  }
}

console.log(`Found ${uniqueCount} weapons with unique attacks (out of ${Object.keys(precomputed.weapons).length})`);

// Write JSON (small file, no gzip needed)
const uniqueAttacksJsonString = JSON.stringify(weaponsWithUniqueAttacks);
const uniqueAttacksPath = path.join(OUTPUT_DIR, 'weapons-unique-attacks.json');
writeFileSync(uniqueAttacksPath, uniqueAttacksJsonString);

console.log(`Unique attacks - Raw JSON: ${(uniqueAttacksJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${uniqueAttacksPath}`);

// Also export class standard animations for UI filtering
// Format: { wepType: { attackSuffix: animationId } }
const classStandardAnimationsExport: Record<number, Record<string, string>> = {};
for (const [wepType, standardMap] of classStandardAnimations) {
  classStandardAnimationsExport[wepType] = Object.fromEntries(standardMap);
}

const classStandardsJsonString = JSON.stringify(classStandardAnimationsExport);
const classStandardsPath = path.join(OUTPUT_DIR, 'class-standard-animations.json');
writeFileSync(classStandardsPath, classStandardsJsonString);

console.log(`Class standards - Raw JSON: ${(classStandardsJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${classStandardsPath}`);

// ============================================================================
// Generate Weapon DPS Data (pre-calculated attack timings for DPS calculations)
// ============================================================================

console.log('\nGenerating weapon DPS data...');

// Attack type mappings (attack type ID -> animation suffix)
// Note: Most weapons use the same animations for 1H and 2H (03xxxx suffix),
// only the motion values differ. The combo-animations.json only contains 03xxxx.
const DPS_ATTACK_TYPES = {
  // 1H - uses 03xxxx animations with 1H motion values (attack types 0-40, 100-105)
  r1_1h: [
    { type: 0, suffix: '030000' },   // R1 [1]
    { type: 10, suffix: '030010' },  // R1 [2]
    { type: 20, suffix: '030020' },  // R1 [3]
    { type: 30, suffix: '030030' },  // R1 [4]
    { type: 40, suffix: '030040' },  // R1 [5]
  ],
  r2_1h: [
    { type: 100, suffix: '030505' }, // R2 [1] (release)
    { type: 105, suffix: '030500' }, // R2 [1] (charged)
  ],
  // 2H - uses same 03xxxx animations but with 2H motion values (attack types 200-240, 300-305)
  r1_2h: [
    { type: 200, suffix: '030000' }, // 2H R1 [1] - same anim as 1H
    { type: 210, suffix: '030010' }, // 2H R1 [2]
    { type: 220, suffix: '030020' }, // 2H R1 [3]
    { type: 230, suffix: '030030' }, // 2H R1 [4]
    { type: 240, suffix: '030040' }, // 2H R1 [5]
  ],
  r2_2h: [
    { type: 300, suffix: '030505' }, // 2H R2 [1] (release) - same anim as 1H
    { type: 305, suffix: '030500' }, // 2H R2 [1] (charged)
  ],
};

// Build weapon -> attack type -> motion value mapping from attacks.json
// Note: Some attacks have multiple entries (e.g., multi-hit attacks). We keep the first non-zero MV.
const weaponAttackMV = new Map<string, Map<number, number>>();

for (const attackData of Object.values(rawAttacks)) {
  if (!attackData.weapons || !attackData.refs?.atkParamId) continue;

  const attackType = attackData.refs.atkParamId % 1000;
  const mv = attackData.physicalDamageMV ?? 0;

  for (const weaponName of attackData.weapons) {
    if (!weaponAttackMV.has(weaponName)) {
      weaponAttackMV.set(weaponName, new Map());
    }
    // Only set if we don't have a value yet OR if current value is 0 and new value is non-zero
    const existingMV = weaponAttackMV.get(weaponName)!.get(attackType);
    if (existingMV === undefined || (existingMV === 0 && mv > 0)) {
      weaponAttackMV.get(weaponName)!.set(attackType, mv);
    }
  }
}

// Get attack cancel frame from combo animation data
function getAttackFrames(animId: string): number | null {
  const anim = comboAnimations[animId];
  if (!anim) return null;

  // Find earliest attack cancel window
  const attackCancels = anim.c.filter(([type]) =>
    type === 'RightAttack' || type === 'Attack' || type === 'LightAttackOnly'
  );

  if (attackCancels.length === 0) return null;

  // Return earliest cancel frame
  return Math.min(...attackCancels.map(([, frame]) => frame));
}

// Calculate DPS multiplier: (mv / 100) * 30 / frames
// At runtime: DPS = AR * dpsMultiplier
function calculateDpsMultiplier(mv: number, frames: number): number {
  if (frames <= 0) return 0;
  return (mv / 100) * 30 / frames;
}

// Structure for pre-calculated DPS data
interface AttackDpsData {
  frames: number;        // Total frames until can attack again
  mv: number;            // Motion value (single attack) or total MV (chain)
  hits: number;          // Number of hits (1 for single, N for chain)
  dpsMultiplier: number; // Pre-calculated: (mv/100) * 30 / frames
}

interface GripDpsData {
  r1: AttackDpsData | null;
  r1Chain: AttackDpsData | null;
  r2: AttackDpsData | null;
  r2Chain: AttackDpsData | null;
}

interface WeaponDpsData {
  oneHanded: GripDpsData;
  twoHanded: GripDpsData;
}

const weaponDpsData: Record<string, WeaponDpsData> = {};

for (const [weaponName, weaponData] of Object.entries(precomputed.weapons)) {
  const wepmotionCategory = weaponData.wepmotionCategory;
  const section = `a${wepmotionCategory.toString().padStart(3, '0')}`;
  const attackMVs = weaponAttackMV.get(weaponName);

  // Helper to get animation ID for this weapon
  const getAnimId = (suffix: string): string => `${section}_${suffix}`;

  // Helper to calculate single attack data
  const getSingleAttackData = (attackTypes: Array<{ type: number; suffix: string }>): AttackDpsData | null => {
    if (attackTypes.length === 0) return null;

    const first = attackTypes[0];
    const animId = getAnimId(first.suffix);
    const frames = getAttackFrames(animId);
    const mv = attackMVs?.get(first.type) ?? 0;

    if (frames === null || mv === 0) return null;

    return {
      frames,
      mv,
      hits: 1,
      dpsMultiplier: calculateDpsMultiplier(mv, frames),
    };
  };

  // Helper to calculate chain data
  const getChainData = (attackTypes: Array<{ type: number; suffix: string }>): AttackDpsData | null => {
    let totalFrames = 0;
    let totalMV = 0;
    let hits = 0;

    for (let i = 0; i < attackTypes.length; i++) {
      const attack = attackTypes[i];
      const animId = getAnimId(attack.suffix);
      const frames = getAttackFrames(animId);
      const mv = attackMVs?.get(attack.type) ?? 0;

      // Stop chain at first missing animation or zero MV
      if (frames === null || mv === 0) break;

      totalFrames += frames;
      totalMV += mv;
      hits++;
    }

    if (hits === 0) return null;

    return {
      frames: totalFrames,
      mv: totalMV,
      hits,
      dpsMultiplier: calculateDpsMultiplier(totalMV, totalFrames),
    };
  };

  weaponDpsData[weaponName] = {
    oneHanded: {
      r1: getSingleAttackData(DPS_ATTACK_TYPES.r1_1h),
      r1Chain: getChainData(DPS_ATTACK_TYPES.r1_1h),
      r2: getSingleAttackData(DPS_ATTACK_TYPES.r2_1h),
      r2Chain: getChainData(DPS_ATTACK_TYPES.r2_1h),
    },
    twoHanded: {
      r1: getSingleAttackData(DPS_ATTACK_TYPES.r1_2h),
      r1Chain: getChainData(DPS_ATTACK_TYPES.r1_2h),
      r2: getSingleAttackData(DPS_ATTACK_TYPES.r2_2h),
      r2Chain: getChainData(DPS_ATTACK_TYPES.r2_2h),
    },
  };

  // Also add normalized name if different
  const normalizedName = normalizeWeaponName(weaponName);
  if (normalizedName !== weaponName) {
    weaponDpsData[normalizedName] = weaponDpsData[weaponName];
  }
}

// Count weapons with DPS data
let weaponsWithDpsData = 0;
for (const data of Object.values(weaponDpsData)) {
  if (data.oneHanded.r1 || data.twoHanded.r1) {
    weaponsWithDpsData++;
  }
}

console.log(`Generated DPS data for ${weaponsWithDpsData} weapons (out of ${Object.keys(precomputed.weapons).length})`);

// Write JSON (small file, no gzip needed)
const weaponDpsJsonString = JSON.stringify(weaponDpsData);
const weaponDpsPath = path.join(OUTPUT_DIR, 'weapon-dps-data.json');
writeFileSync(weaponDpsPath, weaponDpsJsonString);

console.log(`Weapon DPS data - Raw JSON: ${(weaponDpsJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${weaponDpsPath}`);

// ============================================================================
// Generate Catalyst Spell Power Curves (optimal SP at each investment level)
// ============================================================================

console.log('\nGenerating catalyst spell power curves...');

import { calculateARV2 } from '../../calculator-core/dist/client.js';
import type { PlayerStats } from '../../calculator-core/dist/client.js';

type StatKey = 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane';
const ALL_STAT_KEYS: StatKey[] = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane'];

/** Fixed baseline: all stats at 1. Paths are universal and class-independent. */
const BASELINE_STATS: PlayerStats = { strength: 1, dexterity: 1, intelligence: 1, faith: 1, arcane: 1 };

/**
 * Compute the optimal spell power investment path for a catalyst.
 * Greedy: at each budget point, invest in whichever spell-scaling stat gives the most SP gain.
 * Returns array where index = points invested, value = floor(spell power).
 */
function computeCatalystSPCurve(
  weaponName: string,
  affinity: string,
  upgradeLevel: number,
): number[] {
  const weaponData = precomputed.weapons[weaponName];
  if (!weaponData) return [];
  const affinityData = weaponData.affinities[affinity];
  if (!affinityData) return [];

  const spellScaling = affinityData.sorceryScaling ?? affinityData.incantationScaling;
  if (!spellScaling) return [];

  // Identify which stats contribute to spell scaling
  const spellStats: StatKey[] = [];
  for (const stat of ALL_STAT_KEYS) {
    if ((spellScaling as Record<string, unknown>)[stat] !== null) {
      spellStats.push(stat);
    }
  }
  if (spellStats.length === 0) return [];

  // Max budget = sum of (99 - 1) for each spell scaling stat, capped at 400
  const maxBudget = Math.min(
    spellStats.reduce((sum, _stat) => sum + 98, 0),
    400,
  );

  // Requirements
  const minLevels: Record<string, number> = {};
  for (const stat of spellStats) {
    minLevels[stat] = Math.max(1, (weaponData.requirements as Record<string, number>)[stat] ?? 0);
  }

  const currentLevels: Record<string, number> = {};
  for (const stat of spellStats) {
    currentLevels[stat] = 1;
  }

  const getSP = (levels: Record<string, number>): number => {
    const stats: PlayerStats = { ...BASELINE_STATS };
    for (const stat of spellStats) {
      (stats as Record<string, number>)[stat] = levels[stat];
    }
    const result = calculateARV2(precomputed, weaponName, affinity, upgradeLevel, stats, {
      twoHanding: false,
      ignoreRequirements: true,
    });
    if (!result) return 0;
    return Math.max(
      result.sorceryScaling?.total ?? 0,
      result.incantationScaling?.total ?? 0,
    );
  };

  let currentSP = getSP(currentLevels);
  const spPath: number[] = [Math.floor(currentSP)];
  let budget = 0;

  // Phase 1: Meet minimum requirements (invest in required stats first)
  while (budget < maxBudget) {
    const needReqs = spellStats.filter(s => currentLevels[s] < minLevels[s]);
    if (needReqs.length === 0) break;

    let bestStat: string | null = null;
    let bestGain = -Infinity;
    for (const stat of needReqs) {
      const testLevels = { ...currentLevels, [stat]: currentLevels[stat] + 1 };
      const gain = getSP(testLevels) - currentSP;
      if (gain > bestGain) { bestGain = gain; bestStat = stat; }
    }
    if (!bestStat) break;

    currentLevels[bestStat] += 1;
    currentSP = getSP(currentLevels);
    budget++;
    spPath.push(Math.floor(currentSP));
  }

  // Phase 2: Greedy optimization
  while (budget < maxBudget) {
    let bestStat: string | null = null;
    let bestGain = 0;
    for (const stat of spellStats) {
      if (currentLevels[stat] >= 99) continue;
      const testLevels = { ...currentLevels, [stat]: currentLevels[stat] + 1 };
      const gain = getSP(testLevels) - currentSP;
      if (gain > bestGain) { bestGain = gain; bestStat = stat; }
    }
    if (!bestStat || bestGain < 0.01) break;

    currentLevels[bestStat] += 1;
    currentSP = getSP(currentLevels);
    budget++;
    spPath.push(Math.floor(currentSP));
  }

  return spPath;
}

// Compute curves for all catalysts at max upgrade level
// Structure: { weaponName: number[] }
const catalystSPCurves: Record<string, number[]> = {};
let catalystCount = 0;

for (const [weaponName, weaponData] of Object.entries(precomputed.weapons)) {
  const maxLevel = weaponData.maxUpgradeLevel;

  // Check each affinity for spell scaling (catalysts typically only have "Standard")
  for (const [affinity, affinityData] of Object.entries(weaponData.affinities)) {
    const hasSpellScaling =
      affinityData.sorceryScaling !== null || affinityData.incantationScaling !== null;
    if (!hasSpellScaling) continue;

    const curve = computeCatalystSPCurve(weaponName, affinity, maxLevel);
    if (curve.length > 0) {
      catalystSPCurves[weaponName] = curve;
      catalystCount++;
    }
    break; // Only one affinity per catalyst
  }
}

console.log(`Generated SP curves for ${catalystCount} catalysts`);

// Write JSON (no gzip needed - small file)
const catalystSPJsonString = JSON.stringify(catalystSPCurves);
const catalystSPPath = path.join(OUTPUT_DIR, 'catalyst-sp-curves.json');
writeFileSync(catalystSPPath, catalystSPJsonString);

console.log(`Catalyst SP curves - Raw JSON: ${(catalystSPJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Written to ${catalystSPPath}`);

// ============================================================================
// Generate Weapon Attacks Static Data (replaces /api/attacks/[weapon] edge function)
// ============================================================================

console.log('\nGenerating weapon attacks static data...');

// Build weapon -> attacks[] mapping (same logic as api/attacks/[weapon].ts)
interface AttacksApiData {
  type: number;
  physicalMV: number;
  magicMV: number;
  fireMV: number;
  lightningMV: number;
  holyMV: number;
  staminaCost: number;
  poiseDamage: number;
  physAttribute: string;
  damageLevel: number;
}

const weaponAttacksDataMap: Record<string, AttacksApiData[]> = {};

for (const attackData of Object.values(rawAttacks)) {
  if (!attackData.weapons || !attackData.refs?.atkParamId) continue;

  const attackType = attackData.refs.atkParamId % 1000;

  // Skip invalid types (same filter as edge function)
  if (!VALID_ATTACK_TYPES.has(attackType)) continue;

  // Skip zero motion value attacks
  const physicalMV = (attackData as Record<string, unknown>).physicalDamageMV as number ?? 0;
  const magicMV = (attackData as Record<string, unknown>).magicDamageMV as number ?? 0;
  const fireMV = (attackData as Record<string, unknown>).fireDamageMV as number ?? 0;
  const lightningMV = (attackData as Record<string, unknown>).lightningDamageMV as number ?? 0;
  const holyMV = (attackData as Record<string, unknown>).holyDamageMV as number ?? 0;

  if (physicalMV === 0 && magicMV === 0 && fireMV === 0 && lightningMV === 0 && holyMV === 0) continue;

  const attack: AttacksApiData = {
    type: attackType,
    physicalMV,
    magicMV,
    fireMV,
    lightningMV,
    holyMV,
    staminaCost: (attackData as Record<string, unknown>).staminaCost as number ?? 0,
    poiseDamage: (attackData as Record<string, unknown>).poiseDamageFlat as number ?? 0,
    physAttribute: attackData.physAttribute,
    damageLevel: (attackData as Record<string, unknown>).damageLevel as number ?? 0,
  };

  for (const weaponName of attackData.weapons) {
    if (!weaponAttacksDataMap[weaponName]) {
      weaponAttacksDataMap[weaponName] = [];
    }

    // Skip duplicates (same attack type AND physAttribute for this weapon)
    if (!weaponAttacksDataMap[weaponName].some(a => a.type === attackType && a.physAttribute === attack.physAttribute)) {
      weaponAttacksDataMap[weaponName].push(attack);
    }
  }
}

// Sort each weapon's attacks by type
for (const attacks of Object.values(weaponAttacksDataMap)) {
  attacks.sort((a, b) => a.type - b.type);
}

// Add normalized name entries for lookup compatibility
const normalizedAttackEntries: [string, AttacksApiData[]][] = [];
for (const [wName, attacks] of Object.entries(weaponAttacksDataMap)) {
  const normName = normalizeWeaponName(wName);
  if (normName !== wName && !weaponAttacksDataMap[normName]) {
    normalizedAttackEntries.push([normName, attacks]);
  }
}
for (const [name, attacks] of normalizedAttackEntries) {
  weaponAttacksDataMap[name] = attacks;
}

const weaponAttacksCount = Object.keys(weaponAttacksDataMap).length;
console.log(`Generated attacks data for ${weaponAttacksCount} weapons`);

// Write as gzip + msgpack (lazy loaded by frontend)
const weaponAttacksJsonString = JSON.stringify(weaponAttacksDataMap);
const weaponAttacksGzipped = gzipSync(weaponAttacksJsonString);
const weaponAttacksMsgpacked = msgpackEncode(weaponAttacksDataMap);
const weaponAttacksMsgpackGzipped = gzipSync(weaponAttacksMsgpacked);

writeFileSync(path.join(OUTPUT_DIR, 'weapon-attacks-data.json.gz'), weaponAttacksGzipped);
writeFileSync(path.join(OUTPUT_DIR, 'weapon-attacks-data.msgpack.gz'), weaponAttacksMsgpackGzipped);
writeFileSync(path.join(OUTPUT_DIR, 'weapon-attacks-data.json'), weaponAttacksJsonString);

console.log(`Weapon attacks - Raw JSON: ${(weaponAttacksJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Weapon attacks - Gzipped JSON: ${(weaponAttacksGzipped.length / 1024).toFixed(1)} KB`);
console.log(`Weapon attacks - Gzipped MessagePack: ${(weaponAttacksMsgpackGzipped.length / 1024).toFixed(1)} KB`);

// ============================================================================
// Generate Weapon Combos Detail Static Data (replaces /api/combos/[weapon] edge function)
// ============================================================================

console.log('\nGenerating weapon combos detail static data...');

// Attack type info (synced with api/combos/[weapon].ts and weaponAttacks.ts)
interface ComboAttackTypeInfo {
  shortName: string;
  category: string;
  oneHanded: boolean;
  twoHanded: boolean;
}

const COMBO_ATTACK_TYPE_MAP: Record<number, ComboAttackTypeInfo> = {
  0: { shortName: '1H R1 [1]', category: 'light', oneHanded: true, twoHanded: false },
  10: { shortName: '1H R1 [2]', category: 'light', oneHanded: true, twoHanded: false },
  20: { shortName: '1H R1 [3]', category: 'light', oneHanded: true, twoHanded: false },
  30: { shortName: '1H R1 [4]', category: 'light', oneHanded: true, twoHanded: false },
  40: { shortName: '1H R1 [5]', category: 'light', oneHanded: true, twoHanded: false },
  50: { shortName: '1H R1 (charged)', category: 'light', oneHanded: true, twoHanded: false },
  100: { shortName: '1H R2 [1]', category: 'heavy', oneHanded: true, twoHanded: false },
  105: { shortName: '1H R2 (charged) [1]', category: 'heavy', oneHanded: true, twoHanded: false },
  110: { shortName: '1H R2 [2]', category: 'heavy', oneHanded: true, twoHanded: false },
  115: { shortName: '1H R2 (charged) [2]', category: 'heavy', oneHanded: true, twoHanded: false },
  120: { shortName: '1H Running R1', category: 'running', oneHanded: true, twoHanded: false },
  125: { shortName: '1H Running R2', category: 'running', oneHanded: true, twoHanded: false },
  130: { shortName: '1H Crouch R1', category: 'crouch', oneHanded: true, twoHanded: false },
  140: { shortName: '1H Backstep R1', category: 'backstep', oneHanded: true, twoHanded: false },
  150: { shortName: '1H Rolling R1', category: 'rolling', oneHanded: true, twoHanded: false },
  160: { shortName: '1H Rolling R2', category: 'rolling', oneHanded: true, twoHanded: false },
  170: { shortName: '1H Jump R1', category: 'jumping', oneHanded: true, twoHanded: false },
  175: { shortName: '1H Jump R2', category: 'jumping', oneHanded: true, twoHanded: false },
  200: { shortName: '2H R1 [1]', category: 'light', oneHanded: false, twoHanded: true },
  210: { shortName: '2H R1 [2]', category: 'light', oneHanded: false, twoHanded: true },
  220: { shortName: '2H R1 [3]', category: 'light', oneHanded: false, twoHanded: true },
  230: { shortName: '2H R1 [4]', category: 'light', oneHanded: false, twoHanded: true },
  240: { shortName: '2H R1 [5]', category: 'light', oneHanded: false, twoHanded: true },
  300: { shortName: '2H R2 [1]', category: 'heavy', oneHanded: false, twoHanded: true },
  305: { shortName: '2H R2 (charged) [1]', category: 'heavy', oneHanded: false, twoHanded: true },
  310: { shortName: '2H R2 [2]', category: 'heavy', oneHanded: false, twoHanded: true },
  315: { shortName: '2H R2 (charged) [2]', category: 'heavy', oneHanded: false, twoHanded: true },
  320: { shortName: '2H Running R1', category: 'running', oneHanded: false, twoHanded: true },
  325: { shortName: '2H Running R2', category: 'running', oneHanded: false, twoHanded: true },
  330: { shortName: '2H Crouch R1', category: 'crouch', oneHanded: false, twoHanded: true },
  340: { shortName: '2H Backstep R1', category: 'backstep', oneHanded: false, twoHanded: true },
  350: { shortName: '2H Rolling R1', category: 'rolling', oneHanded: false, twoHanded: true },
  360: { shortName: '2H Rolling R2', category: 'rolling', oneHanded: false, twoHanded: true },
  370: { shortName: '2H Jump R1', category: 'jumping', oneHanded: false, twoHanded: true },
  380: { shortName: '2H Jump R2', category: 'jumping', oneHanded: false, twoHanded: true },
  400: { shortName: 'Paired L1 [1]', category: 'light', oneHanded: false, twoHanded: false },
  410: { shortName: 'Paired L1 [2]', category: 'light', oneHanded: false, twoHanded: false },
  420: { shortName: 'Paired L1 [3]', category: 'light', oneHanded: false, twoHanded: false },
  430: { shortName: 'Paired L1 [4]', category: 'light', oneHanded: false, twoHanded: false },
  440: { shortName: 'Paired L1 [5]', category: 'light', oneHanded: false, twoHanded: false },
  450: { shortName: 'Paired Running L1', category: 'running', oneHanded: false, twoHanded: false },
  500: { shortName: 'Guard Counter [1]', category: 'guard', oneHanded: true, twoHanded: true },
  510: { shortName: 'Guard Counter [2]', category: 'guard', oneHanded: true, twoHanded: true },
  600: { shortName: 'Mount R1 (R)', category: 'mounted', oneHanded: true, twoHanded: false },
  605: { shortName: 'Mount R1 (L)', category: 'mounted', oneHanded: true, twoHanded: false },
  610: { shortName: 'Mount R1 (2)', category: 'mounted', oneHanded: false, twoHanded: true },
  700: { shortName: 'Mount R2 (R)', category: 'mounted', oneHanded: true, twoHanded: false },
  705: { shortName: 'Mount R2 (L)', category: 'mounted', oneHanded: true, twoHanded: false },
  710: { shortName: 'Mount R2 (2)', category: 'mounted', oneHanded: false, twoHanded: true },
  730: { shortName: 'Mount R2 (charged)', category: 'mounted', oneHanded: true, twoHanded: true },
  800: { shortName: '1H Critical', category: 'special', oneHanded: true, twoHanded: false },
  805: { shortName: '2H Critical', category: 'special', oneHanded: false, twoHanded: true },
  950: { shortName: 'Stance [1]', category: 'special', oneHanded: true, twoHanded: true },
  951: { shortName: 'Stance [2]', category: 'special', oneHanded: true, twoHanded: true },
  952: { shortName: 'Stance [3]', category: 'special', oneHanded: true, twoHanded: true },
  956: { shortName: 'Stance Combo', category: 'special', oneHanded: true, twoHanded: true },
};

// Animation suffix mapping (synced with api/combos/[weapon].ts)
const COMBO_ANIMATION_SUFFIX: Record<number, string> = {
  0: '030000', 10: '030010', 20: '030020', 30: '030030', 40: '030040',
  50: '030050',
  100: '030505', 105: '030500', 110: '030515', 115: '030510',
  120: '030200', 125: '030210', 130: '030310', 140: '030400', 150: '030300',
  170: '031030', 175: '031040',
  200: '040000', 210: '040010', 220: '040020', 230: '040030', 240: '040040',
  300: '040505', 305: '040500', 310: '040515', 315: '040510',
  320: '040200', 325: '040210', 330: '040310', 340: '040400', 350: '040300',
  370: '041030', 380: '041040',
  500: '030700', 510: '040700',
};

const COMBO_DAMAGE_LEVEL_TO_STUN: Record<number, number> = { 0: 0, 1: 10, 2: 25, 3: 35 };

const COMBO_INVALID_FOLLOWUP_CATEGORIES = new Set([
  'running', 'crouch', 'rolling', 'backstep', 'guard', 'mounted', 'special', 'jumping',
]);

const COMBO_CHARGED_ATTACK_TYPES = new Set([50, 105, 115, 305, 315, 730]);

const COMBO_CANCEL_PRIORITIES: Record<string, string[]> = {
  light: ['LightAttackOnly', 'RightAttack', 'Attack'],
  heavy: ['RightAttack', 'Attack'],
  running: ['RightAttack', 'Attack'],
  crouch: ['RightAttack', 'Attack'],
  backstep: ['RightAttack', 'Attack'],
  rolling: ['RightAttack', 'Attack'],
  jumping: ['RightAttack', 'Attack'],
  guard: ['RightAttack', 'Attack'],
  mounted: ['RightAttack', 'Attack'],
  special: ['RightAttack', 'Attack'],
};

// Chain validation (synced with api/combos/[weapon].ts)
const COMBO_CHAIN_REGEX = /^(.+?)\s*\[(\d+)\]$/;

function getComboChainInfo(shortName: string): { baseType: string; sequence: number | null } {
  const match = shortName.match(COMBO_CHAIN_REGEX);
  if (match) {
    return { baseType: match[1].trim(), sequence: parseInt(match[2], 10) };
  }
  return { baseType: shortName, sequence: null };
}

function getComboCoreBaseType(baseType: string): string {
  return baseType.replace(/ \(charged\)/, '');
}

function isComboValidChainSequence(infoA: ComboAttackTypeInfo, infoB: ComboAttackTypeInfo): boolean {
  const chainB = getComboChainInfo(infoB.shortName);
  if (chainB.sequence === null) return true;

  const chainA = getComboChainInfo(infoA.shortName);
  const coreBaseTypeA = getComboCoreBaseType(chainA.baseType);
  const coreBaseTypeB = getComboCoreBaseType(chainB.baseType);

  if (chainB.sequence === 1) return coreBaseTypeA !== coreBaseTypeB;
  if (coreBaseTypeA !== coreBaseTypeB) return false;
  if (chainA.sequence === null || chainA.sequence !== chainB.sequence - 1) return false;
  return true;
}

function areComboGripsCompatible(infoA: ComboAttackTypeInfo, infoB: ComboAttackTypeInfo): boolean {
  if ((infoA.oneHanded && infoA.twoHanded) || (infoB.oneHanded && infoB.twoHanded)) return true;
  if (!infoA.oneHanded && !infoA.twoHanded) return !infoB.oneHanded && !infoB.twoHanded;
  if (!infoB.oneHanded && !infoB.twoHanded) return !infoA.oneHanded && !infoA.twoHanded;
  return infoA.oneHanded === infoB.oneHanded && infoA.twoHanded === infoB.twoHanded;
}

function getComboCancelFrame(
  animation: { h: number | null; c: Array<[string, number]> },
  targetCategory: string,
): { frame: number; type: string } | null {
  const cancels = animation.c;
  if (!cancels || cancels.length === 0) return null;

  const priorities = COMBO_CANCEL_PRIORITIES[targetCategory] || ['RightAttack', 'Attack'];

  for (const cancelType of priorities) {
    const cancel = cancels.find(([type]) => type === cancelType);
    if (cancel) return { frame: cancel[1], type: cancel[0] };
  }

  for (const [type, frame] of cancels) {
    if (type.includes('Attack')) return { frame, type };
  }

  return null;
}

// ComboData output type (matches frontend types.ts ComboData)
interface ComboDataOutput {
  attackAType: number;
  attackAName: string;
  attackACategory: string;
  attackBType: number;
  attackBName: string;
  attackBCategory: string;
  hitFrameA: number;
  stunDuration: number;
  cancelFrameA: number;
  cancelType: string;
  startupFrameB: number;
  gap: number;
  comboType: 'true' | 'pseudo' | 'none';
  poiseDamageA: number;
}

interface ComboRawAttackFull {
  refs?: { atkParamId: number };
  weapons?: string[];
  physicalDamageMV?: number;
  magicDamageMV?: number;
  damageLevel?: number;
  poiseDamageFlat?: number;
}

function calculateCombosForWeaponStatic(
  weaponName: string,
  motionCategory: number,
  attacks: Record<string, ComboRawAttackFull>,
  animations: Record<string, { h: number | null; c: Array<[string, number]> }>,
): ComboDataOutput[] {
  const combos: ComboDataOutput[] = [];

  interface WeaponAttackInfo {
    type: number;
    info: ComboAttackTypeInfo;
    damageLevel: number;
    poiseDamage: number;
  }

  const weaponAttacksList: WeaponAttackInfo[] = [];
  const seenAttackTypes = new Set<number>();

  for (const attack of Object.values(attacks)) {
    if (!attack.weapons) continue;

    const hasWeapon = attack.weapons.some(w =>
      w === weaponName || normalizeWeaponName(w) === weaponName
    );
    if (!hasWeapon) continue;

    const attackType = (attack.refs?.atkParamId ?? 0) % 1000;
    if (seenAttackTypes.has(attackType)) continue;

    const info = COMBO_ATTACK_TYPE_MAP[attackType];
    if (!info) continue;

    if ((attack.physicalDamageMV ?? 0) === 0 && (attack.magicDamageMV ?? 0) === 0) continue;

    seenAttackTypes.add(attackType);
    weaponAttacksList.push({
      type: attackType,
      info,
      damageLevel: attack.damageLevel ?? 0,
      poiseDamage: attack.poiseDamageFlat ?? 0,
    });
  }

  const getAnimId = (attackType: number): string | null => {
    const suffix = COMBO_ANIMATION_SUFFIX[attackType];
    if (!suffix) return null;
    const section = `a${motionCategory.toString().padStart(3, '0')}`;
    return `${section}_${suffix}`;
  };

  for (const attackA of weaponAttacksList) {
    if (attackA.damageLevel === 0) continue;

    const animIdA = getAnimId(attackA.type);
    if (!animIdA) continue;

    const animA = animations[animIdA];
    if (!animA) continue;

    const hitFrameA = animA.h;
    if (hitFrameA === null) continue;

    const stunDuration = COMBO_DAMAGE_LEVEL_TO_STUN[attackA.damageLevel] ?? 0;

    for (const attackB of weaponAttacksList) {
      if (COMBO_INVALID_FOLLOWUP_CATEGORIES.has(attackB.info.category)) continue;
      if (COMBO_CHARGED_ATTACK_TYPES.has(attackB.type)) continue;
      if (!areComboGripsCompatible(attackA.info, attackB.info)) continue;
      if (!isComboValidChainSequence(attackA.info, attackB.info)) continue;

      const animIdB = getAnimId(attackB.type);
      if (!animIdB) continue;

      const animB = animations[animIdB];
      if (!animB) continue;

      const startupFrameB = animB.h;
      if (startupFrameB === null) continue;

      const cancelData = getComboCancelFrame(animA, attackB.info.category);
      if (!cancelData) continue;

      const gap = (cancelData.frame + startupFrameB) - (hitFrameA + stunDuration);

      let comboType: 'true' | 'pseudo' | 'none';
      if (gap <= 0) comboType = 'true';
      else if (gap <= 5) comboType = 'pseudo';
      else comboType = 'none';

      if (comboType === 'none') continue;

      combos.push({
        attackAType: attackA.type,
        attackAName: attackA.info.shortName,
        attackACategory: attackA.info.category,
        attackBType: attackB.type,
        attackBName: attackB.info.shortName,
        attackBCategory: attackB.info.category,
        hitFrameA,
        stunDuration,
        cancelFrameA: cancelData.frame,
        cancelType: cancelData.type,
        startupFrameB,
        gap,
        comboType,
        poiseDamageA: attackA.poiseDamage,
      });
    }
  }

  combos.sort((a, b) => {
    if (a.comboType === 'true' && b.comboType !== 'true') return -1;
    if (b.comboType === 'true' && a.comboType !== 'true') return 1;
    return a.gap - b.gap;
  });

  return combos;
}

// Calculate combos for all weapons
const allWeaponCombosDetail: Record<string, ComboDataOutput[]> = {};
let combosWeaponCount = 0;

for (const [wepName, wepData] of Object.entries(precomputed.weapons)) {
  const combos = calculateCombosForWeaponStatic(
    wepName,
    wepData.wepmotionCategory,
    rawAttacks as Record<string, ComboRawAttackFull>,
    comboAnimations,
  );

  allWeaponCombosDetail[wepName] = combos;
  if (combos.length > 0) combosWeaponCount++;

  const normName = normalizeWeaponName(wepName);
  if (normName !== wepName) {
    allWeaponCombosDetail[normName] = combos;
  }
}

console.log(`Generated combo detail data for ${Object.keys(precomputed.weapons).length} weapons`);
console.log(`Weapons with combos: ${combosWeaponCount}`);

const combosDetailJsonString = JSON.stringify(allWeaponCombosDetail);
const combosDetailGzipped = gzipSync(combosDetailJsonString);
const combosDetailMsgpacked = msgpackEncode(allWeaponCombosDetail);
const combosDetailMsgpackGzipped = gzipSync(combosDetailMsgpacked);

writeFileSync(path.join(OUTPUT_DIR, 'weapon-combos-detail.json.gz'), combosDetailGzipped);
writeFileSync(path.join(OUTPUT_DIR, 'weapon-combos-detail.msgpack.gz'), combosDetailMsgpackGzipped);
writeFileSync(path.join(OUTPUT_DIR, 'weapon-combos-detail.json'), combosDetailJsonString);

console.log(`Weapon combos detail - Raw JSON: ${(combosDetailJsonString.length / 1024).toFixed(1)} KB`);
console.log(`Weapon combos detail - Gzipped JSON: ${(combosDetailGzipped.length / 1024).toFixed(1)} KB`);
console.log(`Weapon combos detail - Gzipped MessagePack: ${(combosDetailMsgpackGzipped.length / 1024).toFixed(1)} KB`);

// ============================================================================
// Generate Animation Events Static Data (replaces /api/animations/[animation] edge function)
// ============================================================================

console.log('\nGenerating animation events static data...');

// More detailed types for the full animations.json event data
interface FullRawCancelRange {
  Regular?: [number, number];
  LightEquipLoad?: [number, number];
}

interface FullRawCancel {
  type: string;
  range: FullRawCancelRange;
}

interface FullRawActiveFrame {
  range: [number, number];
  type: string;
  params?: Record<string, number>;
}

interface FullRawSpEffect {
  range: [number, number];
  id: number;
  mp?: boolean;
}

interface FullRawHyperArmour {
  range: [number, number];
  super?: boolean;
}

interface FullRawAnimationEvents {
  cancels?: FullRawCancel[];
  activeFrames?: FullRawActiveFrame[];
  spEffects?: FullRawSpEffect[];
  hyperArmour?: FullRawHyperArmour[];
  guarding?: Array<[number, number]>;
  jumpFrames?: Array<[number, number]>;
}

interface FullRawAnimation {
  name: string;
  labels: string[];
  id: string;
  filename: string;
  section: string;
  categories: string[];
  events: FullRawAnimationEvents;
}

// Output types (matches frontend AnimationEventData)
interface AnimEventCancelWindow {
  type: string;
  startFrame: number;
  endFrame: number;
  lightEquipLoad?: { startFrame: number; endFrame: number };
}

interface AnimEventActiveFrame {
  startFrame: number;
  endFrame: number;
  type: string;
  params?: Record<string, number>;
}

interface AnimEventSpEffect {
  startFrame: number;
  endFrame: number;
  id: number;
  mp?: boolean;
}

interface AnimEventHyperArmour {
  startFrame: number;
  endFrame: number;
  isSuper: boolean;
}

interface AnimEventFrameRange {
  startFrame: number;
  endFrame: number;
}

interface AnimationEventDataOutput {
  id: string;
  filename: string;
  name: string;
  labels: string[];
  section: string;
  categories: string[];
  maxFrame: number;
  cancels: AnimEventCancelWindow[];
  activeFrames: AnimEventActiveFrame[];
  spEffects: AnimEventSpEffect[];
  hyperArmour: AnimEventHyperArmour[];
  guarding: AnimEventFrameRange[];
  jumpFrames: AnimEventFrameRange[];
}

function calculateAnimMaxFrame(events: FullRawAnimationEvents): number {
  let max = 0;
  const checkRange = (range: [number, number] | undefined) => {
    if (range && range[1] > max) max = range[1];
  };
  events.cancels?.forEach(c => { checkRange(c.range.Regular); checkRange(c.range.LightEquipLoad); });
  events.activeFrames?.forEach(a => checkRange(a.range));
  events.spEffects?.forEach(s => checkRange(s.range));
  events.hyperArmour?.forEach(h => checkRange(h.range));
  events.guarding?.forEach(g => checkRange(g));
  events.jumpFrames?.forEach(j => checkRange(j));
  return max;
}

function transformAnimationForOutput(raw: FullRawAnimation): AnimationEventDataOutput {
  const events = raw.events;
  return {
    id: raw.id,
    filename: raw.filename,
    name: raw.name,
    labels: raw.labels,
    section: raw.section,
    categories: raw.categories,
    maxFrame: calculateAnimMaxFrame(events),
    cancels: (events.cancels ?? []).map(c => ({
      type: c.type,
      startFrame: c.range.Regular?.[0] ?? 0,
      endFrame: c.range.Regular?.[1] ?? 0,
      ...(c.range.LightEquipLoad && {
        lightEquipLoad: {
          startFrame: c.range.LightEquipLoad[0],
          endFrame: c.range.LightEquipLoad[1],
        },
      }),
    })),
    activeFrames: (events.activeFrames ?? []).map(a => ({
      startFrame: a.range[0],
      endFrame: a.range[1],
      type: a.type,
      ...(a.params && { params: a.params }),
    })),
    spEffects: (events.spEffects ?? []).map(s => ({
      startFrame: s.range[0],
      endFrame: s.range[1],
      id: s.id,
      ...(s.mp !== undefined && { mp: s.mp }),
    })),
    hyperArmour: (events.hyperArmour ?? []).map(h => ({
      startFrame: h.range[0],
      endFrame: h.range[1],
      isSuper: h.super ?? false,
    })),
    guarding: (events.guarding ?? []).map(g => ({ startFrame: g[0], endFrame: g[1] })),
    jumpFrames: (events.jumpFrames ?? []).map(j => ({ startFrame: j[0], endFrame: j[1] })),
  };
}

// Re-parse animations.json with full types for events
const fullRawAnimations: Record<string, FullRawAnimation> = JSON.parse(readFileSync(fullAnimationsPath, 'utf-8'));

const allAnimationEvents: Record<string, AnimationEventDataOutput> = {};
let animEventsCount = 0;

for (const [key, animation] of Object.entries(fullRawAnimations)) {
  const events = animation.events || {};
  const hasActiveFrames = (events.activeFrames?.length ?? 0) > 0;
  const hasCancels = (events.cancels?.length ?? 0) > 0;
  const hasSpEffects = (events.spEffects?.length ?? 0) > 0;
  const hasHyperArmour = (events.hyperArmour?.length ?? 0) > 0;
  const hasGuarding = (events.guarding?.length ?? 0) > 0;

  if (!hasActiveFrames && !hasCancels && !hasSpEffects && !hasHyperArmour && !hasGuarding) continue;

  const transformed = transformAnimationForOutput(animation);
  allAnimationEvents[key] = transformed;

  // Also index by filename if different from key
  if (animation.filename && animation.filename !== key) {
    allAnimationEvents[animation.filename] = transformed;
  }

  animEventsCount++;
}

console.log(`Generated animation events for ${animEventsCount} animations (out of ${Object.keys(fullRawAnimations).length} total)`);

// Group animation events by prefix (e.g., "a029" from "a029_030000")
// This chunks the data so users only download events for the weapon class they're viewing
const animEventsByPrefix: Record<string, Record<string, AnimationEventDataOutput>> = {};
for (const [key, eventData] of Object.entries(allAnimationEvents)) {
  const prefix = key.split('_')[0];
  if (!animEventsByPrefix[prefix]) animEventsByPrefix[prefix] = {};
  animEventsByPrefix[prefix][key] = eventData;
}

const CHUNKS_DIR = path.join(__dirname, '../public/data/animation-events');
mkdirSync(CHUNKS_DIR, { recursive: true });

let totalJsonGzSize = 0;
let totalMsgpackGzSize = 0;

for (const [prefix, chunkData] of Object.entries(animEventsByPrefix)) {
  const jsonGz = gzipSync(JSON.stringify(chunkData));
  const msgpackGz = gzipSync(msgpackEncode(chunkData));
  writeFileSync(path.join(CHUNKS_DIR, `${prefix}.json.gz`), jsonGz);
  writeFileSync(path.join(CHUNKS_DIR, `${prefix}.msgpack.gz`), msgpackGz);
  totalJsonGzSize += jsonGz.length;
  totalMsgpackGzSize += msgpackGz.length;
}

console.log(`Animation events - ${Object.keys(animEventsByPrefix).length} chunks written to public/data/animation-events/`);
console.log(`Animation events - Total Gzipped JSON: ${(totalJsonGzSize / 1024).toFixed(1)} KB`);
console.log(`Animation events - Total Gzipped MessagePack: ${(totalMsgpackGzSize / 1024).toFixed(1)} KB`);

console.log('\nDone!');

