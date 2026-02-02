/**
 * Combo Calculator Module
 *
 * Calculates true combos and pseudo combos for weapons based on frame data.
 * Used by both the API endpoint and build-time precomputation.
 */

// ============================================================================
// Types
// ============================================================================

export interface AttackTypeInfo {
  name: string;
  shortName: string;
  category: string;
  oneHanded: boolean;
  twoHanded: boolean;
}

/** Chain info extracted from attack short names (e.g., "1H R1 [2]") */
export interface ChainInfo {
  baseType: string;
  sequence: number | null;
}

/**
 * Get the core base type by stripping "(charged)" modifier.
 * This allows charged and non-charged versions of the same attack
 * to be treated as the same chain family for validation purposes.
 * e.g., "1H R2 (charged)" -> "1H R2"
 */
export function getCoreBaseType(baseType: string): string {
  return baseType.replace(/ \(charged\)/, '');
}

export interface RawAttack {
  refs: { atkParamId: number };
  physicalDamageMV: number;
  magicDamageMV: number;
  fireDamageMV: number;
  lightningDamageMV: number;
  holyDamageMV: number;
  staminaCost: number;
  poiseDamageFlat: number;
  physAttribute: string;
  damageLevel: number;
  weapons?: string[];
}

/** Minimal animation data for combo calculation */
export interface ComboAnimation {
  /** Hit frame (first Attack active frame) */
  h: number | null;
  /** Cancel windows: [type, startFrame][] */
  c: Array<[string, number]>;
}

/** Pre-calculated combo data */
export interface ComboData {
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

// ============================================================================
// Constants
// ============================================================================

export const ATTACK_TYPE_MAP: Record<number, AttackTypeInfo> = {
  // 1H Light Attacks (R1)
  0: { name: '1H Light Attack 1', shortName: '1H R1 [1]', category: 'light', oneHanded: true, twoHanded: false },
  10: { name: '1H Light Attack 2', shortName: '1H R1 [2]', category: 'light', oneHanded: true, twoHanded: false },
  20: { name: '1H Light Attack 3', shortName: '1H R1 [3]', category: 'light', oneHanded: true, twoHanded: false },
  30: { name: '1H Light Attack 4', shortName: '1H R1 [4]', category: 'light', oneHanded: true, twoHanded: false },
  40: { name: '1H Light Attack 5', shortName: '1H R1 [5]', category: 'light', oneHanded: true, twoHanded: false },
  50: { name: '1H Charged Light Attack', shortName: '1H R1 (charged)', category: 'light', oneHanded: true, twoHanded: false },
  // 1H Heavy Attacks (R2)
  100: { name: '1H Heavy Attack 1', shortName: '1H R2 [1]', category: 'heavy', oneHanded: true, twoHanded: false },
  105: { name: '1H Charged Heavy Attack 1', shortName: '1H R2 (charged) [1]', category: 'heavy', oneHanded: true, twoHanded: false },
  110: { name: '1H Heavy Attack 2', shortName: '1H R2 [2]', category: 'heavy', oneHanded: true, twoHanded: false },
  115: { name: '1H Charged Heavy Attack 2', shortName: '1H R2 (charged) [2]', category: 'heavy', oneHanded: true, twoHanded: false },
  // 1H Running
  120: { name: '1H Running Light Attack', shortName: '1H Running R1', category: 'running', oneHanded: true, twoHanded: false },
  125: { name: '1H Running Heavy Attack', shortName: '1H Running R2', category: 'running', oneHanded: true, twoHanded: false },
  // 1H Crouch
  130: { name: '1H Crouch Light Attack', shortName: '1H Crouch R1', category: 'crouch', oneHanded: true, twoHanded: false },
  // 1H Backstep
  140: { name: '1H Backstep Light Attack', shortName: '1H Backstep R1', category: 'backstep', oneHanded: true, twoHanded: false },
  // 1H Rolling
  150: { name: '1H Rolling Light Attack', shortName: '1H Rolling R1', category: 'rolling', oneHanded: true, twoHanded: false },
  160: { name: '1H Rolling Heavy Attack', shortName: '1H Rolling R2', category: 'rolling', oneHanded: true, twoHanded: false },
  // 1H Jumping
  170: { name: '1H Jumping Light Attack', shortName: '1H Jump R1', category: 'jumping', oneHanded: true, twoHanded: false },
  175: { name: '1H Jumping Heavy Attack', shortName: '1H Jump R2', category: 'jumping', oneHanded: true, twoHanded: false },
  // 2H Light Attacks (R1)
  200: { name: '2H Light Attack 1', shortName: '2H R1 [1]', category: 'light', oneHanded: false, twoHanded: true },
  210: { name: '2H Light Attack 2', shortName: '2H R1 [2]', category: 'light', oneHanded: false, twoHanded: true },
  220: { name: '2H Light Attack 3', shortName: '2H R1 [3]', category: 'light', oneHanded: false, twoHanded: true },
  230: { name: '2H Light Attack 4', shortName: '2H R1 [4]', category: 'light', oneHanded: false, twoHanded: true },
  240: { name: '2H Light Attack 5', shortName: '2H R1 [5]', category: 'light', oneHanded: false, twoHanded: true },
  // 2H Heavy Attacks (R2)
  300: { name: '2H Heavy Attack 1', shortName: '2H R2 [1]', category: 'heavy', oneHanded: false, twoHanded: true },
  305: { name: '2H Charged Heavy Attack 1', shortName: '2H R2 (charged) [1]', category: 'heavy', oneHanded: false, twoHanded: true },
  310: { name: '2H Heavy Attack 2', shortName: '2H R2 [2]', category: 'heavy', oneHanded: false, twoHanded: true },
  315: { name: '2H Charged Heavy Attack 2', shortName: '2H R2 (charged) [2]', category: 'heavy', oneHanded: false, twoHanded: true },
  // 2H Running
  320: { name: '2H Running Light Attack', shortName: '2H Running R1', category: 'running', oneHanded: false, twoHanded: true },
  325: { name: '2H Running Heavy Attack', shortName: '2H Running R2', category: 'running', oneHanded: false, twoHanded: true },
  // 2H Crouch
  330: { name: '2H Crouch Light Attack', shortName: '2H Crouch R1', category: 'crouch', oneHanded: false, twoHanded: true },
  // 2H Backstep
  340: { name: '2H Backstep Light Attack', shortName: '2H Backstep R1', category: 'backstep', oneHanded: false, twoHanded: true },
  // 2H Rolling
  350: { name: '2H Rolling Light Attack', shortName: '2H Rolling R1', category: 'rolling', oneHanded: false, twoHanded: true },
  360: { name: '2H Rolling Heavy Attack', shortName: '2H Rolling R2', category: 'rolling', oneHanded: false, twoHanded: true },
  // 2H Jumping
  370: { name: '2H Jumping Light Attack', shortName: '2H Jump R1', category: 'jumping', oneHanded: false, twoHanded: true },
  380: { name: '2H Jumping Heavy Attack', shortName: '2H Jump R2', category: 'jumping', oneHanded: false, twoHanded: true },
  // Paired/Dual Wield Attacks (L1)
  400: { name: 'Paired Light Attack 1', shortName: 'Paired L1 [1]', category: 'light', oneHanded: false, twoHanded: false },
  410: { name: 'Paired Light Attack 2', shortName: 'Paired L1 [2]', category: 'light', oneHanded: false, twoHanded: false },
  420: { name: 'Paired Light Attack 3', shortName: 'Paired L1 [3]', category: 'light', oneHanded: false, twoHanded: false },
  430: { name: 'Paired Light Attack 4', shortName: 'Paired L1 [4]', category: 'light', oneHanded: false, twoHanded: false },
  440: { name: 'Paired Light Attack 5', shortName: 'Paired L1 [5]', category: 'light', oneHanded: false, twoHanded: false },
  // Paired Running
  450: { name: 'Paired Running Attack', shortName: 'Paired Running L1', category: 'running', oneHanded: false, twoHanded: false },
  // Guard Counter
  500: { name: 'Guard Counter 1', shortName: 'Guard Counter [1]', category: 'guard', oneHanded: true, twoHanded: true },
  510: { name: 'Guard Counter 2', shortName: 'Guard Counter [2]', category: 'guard', oneHanded: true, twoHanded: true },
  // Mounted attacks (Torrent)
  600: { name: 'Mounted Light Attack (Right)', shortName: 'Mount R1 (R)', category: 'mounted', oneHanded: true, twoHanded: false },
  605: { name: 'Mounted Light Attack (Left)', shortName: 'Mount R1 (L)', category: 'mounted', oneHanded: true, twoHanded: false },
  610: { name: 'Mounted Light Attack (Both)', shortName: 'Mount R1 (2)', category: 'mounted', oneHanded: false, twoHanded: true },
  700: { name: 'Mounted Heavy Attack (Right)', shortName: 'Mount R2 (R)', category: 'mounted', oneHanded: true, twoHanded: false },
  705: { name: 'Mounted Heavy Attack (Left)', shortName: 'Mount R2 (L)', category: 'mounted', oneHanded: true, twoHanded: false },
  710: { name: 'Mounted Heavy Attack (Both)', shortName: 'Mount R2 (2)', category: 'mounted', oneHanded: false, twoHanded: true },
  730: { name: 'Mounted Charged Heavy Attack', shortName: 'Mount R2 (charged)', category: 'mounted', oneHanded: true, twoHanded: true },
  // Riposte/Critical
  800: { name: '1H Critical', shortName: '1H Critical', category: 'special', oneHanded: true, twoHanded: false },
  805: { name: '2H Critical', shortName: '2H Critical', category: 'special', oneHanded: false, twoHanded: true },
  // Stance breaking attacks (varies by weapon)
  950: { name: 'Stance Attack 1', shortName: 'Stance [1]', category: 'special', oneHanded: true, twoHanded: true },
  951: { name: 'Stance Attack 2', shortName: 'Stance [2]', category: 'special', oneHanded: true, twoHanded: true },
  952: { name: 'Stance Attack 3', shortName: 'Stance [3]', category: 'special', oneHanded: true, twoHanded: true },
  956: { name: 'Stance Attack Combo', shortName: 'Stance Combo', category: 'special', oneHanded: true, twoHanded: true },
};

// Animation suffix mapping
export const ATTACK_TYPE_TO_ANIMATION_SUFFIX: Record<number, string> = {
  // 1H Light Attacks (R1)
  0: '030000', 10: '030010', 20: '030020', 30: '030030', 40: '030040',
  50: '030050', // 1H Charged Light Attack
  // 1H Heavy Attacks (R2)
  100: '030505', 105: '030500', 110: '030515', 115: '030510',
  // 1H Running/Crouch/Backstep/Rolling
  120: '030200', 125: '030210', 130: '030310', 140: '030400', 150: '030300',
  // 1H Jumping
  170: '031030', 175: '031040',
  // 2H Light Attacks (R1)
  200: '040000', 210: '040010', 220: '040020', 230: '040030', 240: '040040',
  // 2H Heavy Attacks (R2)
  300: '040505', 305: '040500', 310: '040515', 315: '040510',
  // 2H Running/Crouch/Backstep/Rolling
  320: '040200', 325: '040210', 330: '040310', 340: '040400', 350: '040300',
  // 2H Jumping
  370: '041030', 380: '041040',
  // Guard Counter
  500: '030700', 510: '040700',
};

// Categories that require prerequisite states/animations and cannot be valid follow-up attacks
export const INVALID_FOLLOWUP_CATEGORIES = new Set([
  'running',
  'crouch',
  'rolling',
  'backstep',
  'guard',
  'mounted',
  'special',
  'jumping',
]);

// Charged attack types cannot be valid follow-ups (can't cancel into a charged attack mid-combo)
const CHARGED_ATTACK_TYPES = new Set([
  50,   // 1H Charged Light Attack
  105,  // 1H Charged Heavy Attack 1
  115,  // 1H Charged Heavy Attack 2
  305,  // 2H Charged Heavy Attack 1
  315,  // 2H Charged Heavy Attack 2
  730,  // Mounted Charged Heavy Attack
]);

// Cancel type priority for finding the best cancel window
const CANCEL_PRIORITIES: Record<string, string[]> = {
  light: ['LightAttackOnly', 'RightAttack', 'Attack'],
  heavy: ['RightAttack', 'Attack'],
};

// Damage level to stun duration mapping
const DAMAGE_LEVEL_TO_STUN: Record<number, number> = {
  0: 0,
  1: 10,
  2: 25,
  3: 35,
};

// ============================================================================
// Helper Functions
// ============================================================================

export function normalizeWeaponName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function getAnimationId(motionCategory: number, attackType: number): string | null {
  const suffix = ATTACK_TYPE_TO_ANIMATION_SUFFIX[attackType];
  if (!suffix) return null;
  const section = `a${motionCategory.toString().padStart(3, '0')}`;
  return `${section}_${suffix}`;
}

function getCancelFrame(
  animation: ComboAnimation,
  targetCategory: string
): { frame: number; type: string } | null {
  const cancels = animation.c;
  if (!cancels || cancels.length === 0) return null;

  const priorities = CANCEL_PRIORITIES[targetCategory] || ['RightAttack', 'Attack'];

  for (const cancelType of priorities) {
    const cancel = cancels.find(([type]) => type === cancelType);
    if (cancel) {
      return { frame: cancel[1], type: cancel[0] };
    }
  }

  // Fallback: find any attack-related cancel
  for (const [type, frame] of cancels) {
    if (type.includes('Attack')) {
      return { frame, type };
    }
  }

  return null;
}

// Regex for extracting chain sequence from attack names (e.g., "1H R1 [2]" -> base: "1H R1", seq: 2)
const CHAIN_SEQUENCE_REGEX = /^(.+?)\s*\[(\d+)\]$/;

/**
 * Extract chain info from attack short name.
 * Returns the base attack type (e.g., "1H R1") and sequence number (e.g., 2 for "[2]").
 * Returns null sequence for attacks not in a chain (e.g., "1H Running R1").
 */
export function getChainInfo(shortName: string): ChainInfo {
  const match = shortName.match(CHAIN_SEQUENCE_REGEX);
  if (match) {
    return {
      baseType: match[1].trim(),
      sequence: parseInt(match[2], 10),
    };
  }
  // No chain number - not part of a numbered chain
  return {
    baseType: shortName,
    sequence: null,
  };
}

/**
 * Check if attackB can validly follow attackA based on attack chain rules.
 * - Attacks with [2], [3], etc. can only follow the previous attack in the same chain
 * - Attacks with [1] can only follow attacks from a DIFFERENT chain type (or non-chain attacks)
 * - Non-chain attacks can follow any valid attack
 * - Charged and non-charged versions of the same attack are treated as the same chain family
 *   (e.g., "1H R2 (charged) [1]" -> "1H R2 [1]" is invalid as it would restart the same chain)
 */
export function isValidChainSequence(infoA: AttackTypeInfo, infoB: AttackTypeInfo): boolean {
  const chainB = getChainInfo(infoB.shortName);

  // If attackB is not part of a chain, it's always valid
  if (chainB.sequence === null) {
    return true;
  }

  const chainA = getChainInfo(infoA.shortName);

  // Use core base types for comparison to treat charged/non-charged as the same chain family
  const coreBaseTypeA = getCoreBaseType(chainA.baseType);
  const coreBaseTypeB = getCoreBaseType(chainB.baseType);

  // If attackB is [1], it can only follow a DIFFERENT chain type (starting a new chain)
  // Can't restart the same chain mid-combo (e.g., 1H R1 [2] -> 1H R1 [1] is invalid)
  // Also applies to charged -> non-charged of same type (e.g., 1H R2 (charged) [1] -> 1H R2 [1] is invalid)
  if (chainB.sequence === 1) {
    return coreBaseTypeA !== coreBaseTypeB;
  }

  // attackB is [2] or higher, so attackA must be the previous in the same chain
  // attackA must be in the same chain type (using core base types)
  if (coreBaseTypeA !== coreBaseTypeB) {
    return false;
  }

  // attackA must be the immediately preceding attack in the chain
  if (chainA.sequence === null || chainA.sequence !== chainB.sequence - 1) {
    return false;
  }

  return true;
}

/** Check if two attacks have compatible grips (can't switch grip mid-combo) */
function areGripsCompatible(infoA: AttackTypeInfo, infoB: AttackTypeInfo): boolean {
  // If either attack works with both grips, they're compatible
  if ((infoA.oneHanded && infoA.twoHanded) || (infoB.oneHanded && infoB.twoHanded)) {
    return true;
  }
  // Paired attacks only combo with other paired attacks
  if (!infoA.oneHanded && !infoA.twoHanded) {
    return !infoB.oneHanded && !infoB.twoHanded;
  }
  if (!infoB.oneHanded && !infoB.twoHanded) {
    return !infoA.oneHanded && !infoA.twoHanded;
  }
  // 1H only combos with 1H, 2H only combos with 2H
  return infoA.oneHanded === infoB.oneHanded && infoA.twoHanded === infoB.twoHanded;
}

// ============================================================================
// Main Calculation Functions
// ============================================================================

interface WeaponAttackData {
  type: number;
  info: AttackTypeInfo;
  damageLevel: number;
  poiseDamage: number;
}

/**
 * Calculate all combos for a weapon
 */
export function calculateCombosForWeapon(
  weaponName: string,
  motionCategory: number,
  attacks: Map<string, RawAttack>,
  animations: Record<string, ComboAnimation>
): ComboData[] {
  const combos: ComboData[] = [];

  // Get attacks for this weapon
  const weaponAttacks: WeaponAttackData[] = [];
  const seenAttackTypes = new Set<number>();

  for (const attack of attacks.values()) {
    if (!attack.weapons) continue;

    const hasWeapon = attack.weapons.some(w =>
      w === weaponName || normalizeWeaponName(w) === weaponName
    );
    if (!hasWeapon) continue;

    const attackType = attack.refs.atkParamId % 1000;

    if (seenAttackTypes.has(attackType)) continue;

    const info = ATTACK_TYPE_MAP[attackType];
    if (!info) continue;

    if (attack.physicalDamageMV === 0 && attack.magicDamageMV === 0) continue;

    seenAttackTypes.add(attackType);
    weaponAttacks.push({
      type: attackType,
      info,
      damageLevel: attack.damageLevel,
      poiseDamage: attack.poiseDamageFlat,
    });
  }

  // Calculate combos between all attack pairs
  for (const attackA of weaponAttacks) {
    if (attackA.damageLevel === 0) continue;

    const animIdA = getAnimationId(motionCategory, attackA.type);
    if (!animIdA) continue;

    const animA = animations[animIdA];
    if (!animA) continue;

    const hitFrameA = animA.h;
    if (hitFrameA === null) continue;

    const stunDuration = DAMAGE_LEVEL_TO_STUN[attackA.damageLevel] ?? 0;

    for (const attackB of weaponAttacks) {
      // Skip attacks that require prerequisite states/animations
      if (INVALID_FOLLOWUP_CATEGORIES.has(attackB.info.category)) continue;

      // Skip charged attacks (can't cancel into a charged attack mid-combo)
      if (CHARGED_ATTACK_TYPES.has(attackB.type)) continue;

      // Skip if grips are incompatible
      if (!areGripsCompatible(attackA.info, attackB.info)) continue;

      // Skip if attack chain sequence is invalid (e.g., can't go from [1] to [3])
      if (!isValidChainSequence(attackA.info, attackB.info)) continue;

      const animIdB = getAnimationId(motionCategory, attackB.type);
      if (!animIdB) continue;

      const animB = animations[animIdB];
      if (!animB) continue;

      const startupFrameB = animB.h;
      if (startupFrameB === null) continue;

      const cancelData = getCancelFrame(animA, attackB.info.category);
      if (!cancelData) continue;

      // Calculate gap
      const gap = (cancelData.frame + startupFrameB) - (hitFrameA + stunDuration);

      // Classify combo type
      let comboType: 'true' | 'pseudo' | 'none';
      if (gap <= 0) {
        comboType = 'true';
      } else if (gap <= 5) {
        comboType = 'pseudo';
      } else {
        comboType = 'none';
      }

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

  // Sort: true combos first, then by gap
  combos.sort((a, b) => {
    if (a.comboType === 'true' && b.comboType !== 'true') return -1;
    if (b.comboType === 'true' && a.comboType !== 'true') return 1;
    return a.gap - b.gap;
  });

  return combos;
}

/**
 * Count true combos for a weapon (for precomputation)
 */
export function countTrueCombos(
  weaponName: string,
  motionCategory: number,
  attacks: Map<string, RawAttack>,
  animations: Record<string, ComboAnimation>
): number {
  const combos = calculateCombosForWeapon(weaponName, motionCategory, attacks, animations);
  return combos.filter(c => c.comboType === 'true').length;
}

/**
 * Get poise breakpoints for true combos.
 * Returns array of [maxPoise, comboCount] pairs showing how many true combos
 * are available at each poise threshold.
 *
 * Example: [[30, 4], [50, 2], [75, 1]] means:
 * - At target poise 0-29: 4 true combos available
 * - At target poise 30-49: 2 true combos available
 * - At target poise 50-74: 1 true combo available
 * - At target poise 75+: 0 true combos available
 */
export function getTrueComboBreakpoints(
  weaponName: string,
  motionCategory: number,
  attacks: Map<string, RawAttack>,
  animations: Record<string, ComboAnimation>
): Array<[number, number]> {
  const combos = calculateCombosForWeapon(weaponName, motionCategory, attacks, animations);
  const trueCombos = combos.filter(c => c.comboType === 'true');

  if (trueCombos.length === 0) return [];

  // Get unique poise damage values, sorted ascending
  const uniquePoiseDamages = [...new Set(trueCombos.map(c => c.poiseDamageA))].sort((a, b) => a - b);

  // Build breakpoints: at each poise threshold, how many combos have higher poise damage?
  const breakpoints: Array<[number, number]> = [];

  for (const poiseDmg of uniquePoiseDamages) {
    // Count combos with poise damage > this threshold
    const countAbove = trueCombos.filter(c => c.poiseDamageA > poiseDmg).length;

    // Only add if count changed from previous
    if (breakpoints.length === 0 || breakpoints[breakpoints.length - 1][1] !== countAbove) {
      breakpoints.push([poiseDmg, countAbove]);
    }
  }

  // Add initial count (combos available at poise 0)
  const countAtZero = trueCombos.length;
  if (breakpoints.length === 0 || breakpoints[0][0] > 0) {
    breakpoints.unshift([0, countAtZero]);
  }

  return breakpoints;
}
