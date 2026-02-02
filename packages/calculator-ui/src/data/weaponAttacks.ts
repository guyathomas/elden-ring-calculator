/**
 * Weapon Attacks Data
 *
 * Provides attack information for specific weapons including R1, R2, crouch attacks, etc.
 * Attack data is loaded from pre-generated static files at build time.
 */
import { loadCompressedData } from './loadData';

import weaponAttacksMsgpackUrl from './weapon-attacks-data.msgpack.gz?url';
import weaponAttacksJsonGzippedUrl from './weapon-attacks-data.json.gz?url';

// Attack type mapping based on the last 3 digits of atkParamId
// These represent different attack types in Elden Ring
export interface AttackTypeInfo {
  name: string;
  shortName: string;
  category: 'light' | 'heavy' | 'crouch' | 'running' | 'rolling' | 'backstep' | 'jumping' | 'guard' | 'mounted' | 'special';
  oneHanded: boolean;
  twoHanded: boolean;
}

// Common attack type suffixes mapped to human-readable names
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

  // 1H Running Attack
  120: { name: '1H Running Light Attack', shortName: '1H Running R1', category: 'running', oneHanded: true, twoHanded: false },
  125: { name: '1H Running Heavy Attack', shortName: '1H Running R2', category: 'running', oneHanded: true, twoHanded: false },

  // 1H Crouch Attack
  130: { name: '1H Crouch Light Attack', shortName: '1H Crouch R1', category: 'crouch', oneHanded: true, twoHanded: false },

  // 1H Backstep Attack
  140: { name: '1H Backstep Light Attack', shortName: '1H Backstep R1', category: 'backstep', oneHanded: true, twoHanded: false },

  // 1H Rolling Attack
  150: { name: '1H Rolling Light Attack', shortName: '1H Rolling R1', category: 'rolling', oneHanded: true, twoHanded: false },
  160: { name: '1H Rolling Heavy Attack', shortName: '1H Rolling R2', category: 'rolling', oneHanded: true, twoHanded: false },

  // 1H Jumping Attack
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

  // 2H Running Attack
  320: { name: '2H Running Light Attack', shortName: '2H Running R1', category: 'running', oneHanded: false, twoHanded: true },
  325: { name: '2H Running Heavy Attack', shortName: '2H Running R2', category: 'running', oneHanded: false, twoHanded: true },

  // 2H Crouch Attack
  330: { name: '2H Crouch Light Attack', shortName: '2H Crouch R1', category: 'crouch', oneHanded: false, twoHanded: true },

  // 2H Backstep Attack
  340: { name: '2H Backstep Light Attack', shortName: '2H Backstep R1', category: 'backstep', oneHanded: false, twoHanded: true },

  // 2H Rolling Attack
  350: { name: '2H Rolling Light Attack', shortName: '2H Rolling R1', category: 'rolling', oneHanded: false, twoHanded: true },
  360: { name: '2H Rolling Heavy Attack', shortName: '2H Rolling R2', category: 'rolling', oneHanded: false, twoHanded: true },

  // 2H Jumping Attack
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

// Processed weapon attack for display
export interface WeaponAttack {
  type: number;
  name: string;
  shortName: string;
  category: string;
  motionValue: number;
  staminaCost: number;
  attackAttribute: string;
  oneHanded: boolean;
  twoHanded: boolean;
  // Motion values for damage types (multipliers)
  physicalMV: number;
  magicMV: number;
  fireMV: number;
  lightningMV: number;
  holyMV: number;
  // Poise damage
  poiseDamage: number;
  // Damage level (for stun duration calculation: 0=none, 1=10f, 2=25f, 3=35f)
  damageLevel: number;
}

/** API response shape */
interface ApiAttackData {
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

/** Result type for fetchWeaponAttacks */
export interface WeaponAttacksResult {
  attacks: WeaponAttack[];
  error: string | null;
}

// Client-side cache for weapon attacks
const attacksCache = new Map<string, WeaponAttack[]>();

// Cached all-weapons attack data (loaded once from static file)
let allWeaponAttacks: Record<string, ApiAttackData[]> | null = null;

/**
 * Load all weapon attacks data from the pre-generated static file.
 * Cached after first load.
 */
async function loadAllWeaponAttacks(): Promise<Record<string, ApiAttackData[]>> {
  if (allWeaponAttacks) return allWeaponAttacks;
  allWeaponAttacks = await loadCompressedData<Record<string, ApiAttackData[]>>(
    weaponAttacksMsgpackUrl,
    weaponAttacksJsonGzippedUrl,
  );
  return allWeaponAttacks;
}

/**
 * Fetch attacks for a specific weapon from pre-generated static data.
 * Returns cached result if available.
 */
export async function fetchWeaponAttacks(weaponName: string): Promise<WeaponAttacksResult> {
  // Check per-weapon cache first
  const cached = attacksCache.get(weaponName);
  if (cached) {
    return { attacks: cached, error: null };
  }

  try {
    const allAttacks = await loadAllWeaponAttacks();
    const apiAttacks: ApiAttackData[] = allAttacks[weaponName] ?? [];

    // Transform to WeaponAttack[]
    const attacks: WeaponAttack[] = [];

    for (const attackData of apiAttacks) {
      const attackTypeInfo = ATTACK_TYPE_MAP[attackData.type];
      if (!attackTypeInfo) continue;

      attacks.push({
        type: attackData.type,
        name: attackTypeInfo.name,
        shortName: attackTypeInfo.shortName,
        category: attackTypeInfo.category,
        motionValue: attackData.physicalMV,
        staminaCost: attackData.staminaCost,
        attackAttribute: attackData.physAttribute,
        oneHanded: attackTypeInfo.oneHanded,
        twoHanded: attackTypeInfo.twoHanded,
        physicalMV: attackData.physicalMV,
        magicMV: attackData.magicMV,
        fireMV: attackData.fireMV,
        lightningMV: attackData.lightningMV,
        holyMV: attackData.holyMV,
        poiseDamage: attackData.poiseDamage,
        damageLevel: attackData.damageLevel,
      });
    }

    // Sort attacks by category priority and then by name
    const categoryOrder: Record<string, number> = {
      light: 0,
      heavy: 1,
      running: 2,
      crouch: 3,
      rolling: 4,
      backstep: 5,
      jumping: 6,
      guard: 7,
      mounted: 8,
      special: 9,
    };

    attacks.sort((a, b) => {
      const catDiff = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
      if (catDiff !== 0) return catDiff;
      return a.name.localeCompare(b.name);
    });

    // Cache the result
    attacksCache.set(weaponName, attacks);

    return { attacks, error: null };
  } catch (err) {
    return {
      attacks: [],
      error: err instanceof Error ? err.message : 'Failed to load attacks'
    };
  }
}

/**
 * Filter attacks by grip type
 */
export function filterAttacksByGrip(
  attacks: WeaponAttack[],
  twoHanding: boolean
): WeaponAttack[] {
  return attacks.filter(attack => {
    // Show both 1H/2H agnostic attacks and attacks matching the current grip
    if (twoHanding) {
      return attack.twoHanded;
    } else {
      return attack.oneHanded;
    }
  });
}
