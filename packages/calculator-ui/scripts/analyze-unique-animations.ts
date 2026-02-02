/**
 * Analyze which weapons have unique attack animations compared to their weapon class
 */

import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../src/data');

// Attack type suffixes (from animationMapping.ts)
const ATTACK_SUFFIXES: Record<string, string> = {
  // Light attacks (R1)
  'R1-1': '030000',
  'R1-2': '030005',
  'R1-3': '030010',
  'R1-4': '030015',
  'R1-5': '030020',
  // Heavy attacks (R2)
  'R2-1': '030500',
  'R2-2': '030505',
  // Charged R2
  'Charged R2-1': '030600',
  'Charged R2-2': '030605',
  // Running attacks
  'Running R1': '031000',
  'Running R2': '031500',
  // Rolling attacks
  'Rolling R1': '032000',
  // Backstep attacks
  'Backstep R1': '033000',
  // Crouch attacks
  'Crouch R1': '034000',
  'Crouch R2': '034500',
  // Jumping attacks
  'Jump R1': '035000',
  'Jump R2': '035500',
};

// Weapon class names from types.ts
const WEAPON_CLASS_NAMES: Record<number, string> = {
  1: 'Dagger',
  2: 'Straight Sword',
  3: 'Greatsword',
  4: 'Colossal Sword',
  5: 'Curved Sword',
  6: 'Curved Greatsword',
  7: 'Katana',
  8: 'Twinblade',
  9: 'Thrusting Sword',
  10: 'Heavy Thrusting Sword',
  11: 'Axe',
  12: 'Greataxe',
  13: 'Hammer',
  14: 'Great Hammer', // Renamed to Warhammer
  15: 'Flail',
  16: 'Spear',
  17: 'Great Spear',
  18: 'Halberd',
  19: 'Reaper',
  20: 'Fist',
  21: 'Claw',
  22: 'Whip',
  23: 'Colossal Weapon',
  24: 'Light Bow',
  25: 'Bow',
  26: 'Greatbow',
  27: 'Crossbow',
  28: 'Ballista',
  29: 'Glintstone Staff',
  30: 'Sacred Seal',
  31: 'Small Shield',
  32: 'Medium Shield',
  33: 'Greatshield',
  34: 'Torch',
  35: 'Hand-to-Hand Arts',
  36: 'Perfume Bottle',
  37: 'Thrusting Shield',
  38: 'Throwing Blade',
  39: 'Backhand Blade',
  40: 'Light Greatsword',
  41: 'Great Katana',
  42: 'Beast Claw',
};

// Load precomputed data
const precomputedPath = path.join(DATA_DIR, 'precomputed.json');
const precomputed = JSON.parse(readFileSync(precomputedPath, 'utf-8'));

// Load animation users data
const animationUsersPath = path.join(DATA_DIR, 'animation-users.json.gz');
const animationUsers: Record<string, string[]> = JSON.parse(
  gunzipSync(readFileSync(animationUsersPath)).toString('utf-8')
);

// Build reverse index: weapon name -> animations it uses
const weaponAnimations = new Map<string, Map<string, string>>();

for (const [animId, weapons] of Object.entries(animationUsers)) {
  for (const weaponName of weapons) {
    if (!weaponAnimations.has(weaponName)) {
      weaponAnimations.set(weaponName, new Map());
    }
    // Extract suffix from animation ID (e.g., "030000" from "a025_030000")
    const suffix = animId.split('_')[1];
    if (suffix) {
      weaponAnimations.get(weaponName)!.set(suffix, animId);
    }
  }
}

// Group weapons by class
const weaponsByClass = new Map<number, string[]>();
const weaponClassMap = new Map<string, number>();

for (const [name, weapon] of Object.entries(precomputed.weapons)) {
  const wepType = (weapon as any).wepType;
  weaponClassMap.set(name, wepType);
  if (!weaponsByClass.has(wepType)) {
    weaponsByClass.set(wepType, []);
  }
  weaponsByClass.get(wepType)!.push(name);
}

console.log('='.repeat(80));
console.log('ANALYSIS: Weapons with Unique Attack Animations');
console.log('='.repeat(80));
console.log();

// For each class, find which animation is "standard" for each attack type
// Then identify weapons that deviate

interface UniqueAttack {
  weaponName: string;
  attackType: string;
  animationId: string;
  sharedWith: string[];
  standardAnimation: string;
  standardSharedWith: string[];
}

const uniqueAttacks: UniqueAttack[] = [];

for (const [wepType, weapons] of weaponsByClass) {
  const className = WEAPON_CLASS_NAMES[wepType] || `Unknown (${wepType})`;

  // Skip non-melee weapon classes
  if (wepType >= 24 && wepType <= 30) continue; // Bows, staves, seals
  if (wepType >= 31 && wepType <= 33) continue; // Shields

  // For each attack type, count which animations are used
  for (const [attackName, suffix] of Object.entries(ATTACK_SUFFIXES)) {
    const animationCounts = new Map<string, string[]>(); // animId -> weapon names

    for (const weaponName of weapons) {
      const anims = weaponAnimations.get(weaponName);
      if (!anims) continue;

      const animId = anims.get(suffix);
      if (!animId) continue;

      if (!animationCounts.has(animId)) {
        animationCounts.set(animId, []);
      }
      animationCounts.get(animId)!.push(weaponName);
    }

    if (animationCounts.size <= 1) continue; // All weapons use same animation or none

    // Find the "standard" animation (most weapons use it)
    let standardAnim = '';
    let standardCount = 0;
    for (const [animId, weaponList] of animationCounts) {
      if (weaponList.length > standardCount) {
        standardAnim = animId;
        standardCount = weaponList.length;
      }
    }

    // Find weapons that don't use the standard animation
    for (const [animId, weaponList] of animationCounts) {
      if (animId === standardAnim) continue;

      // Get all weapons sharing this unique animation (across all classes)
      const allShared = animationUsers[animId] || [];

      for (const weaponName of weaponList) {
        uniqueAttacks.push({
          weaponName,
          attackType: attackName,
          animationId: animId,
          sharedWith: allShared.filter(w => w !== weaponName),
          standardAnimation: standardAnim,
          standardSharedWith: animationCounts.get(standardAnim) || [],
        });
      }
    }
  }
}

// Group by weapon name for cleaner output
const uniqueByWeapon = new Map<string, UniqueAttack[]>();
for (const attack of uniqueAttacks) {
  if (!uniqueByWeapon.has(attack.weaponName)) {
    uniqueByWeapon.set(attack.weaponName, []);
  }
  uniqueByWeapon.get(attack.weaponName)!.push(attack);
}

// Sort by number of unique attacks (most unique first)
const sortedWeapons = [...uniqueByWeapon.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`Found ${uniqueByWeapon.size} weapons with unique attack animations`);
console.log(`Total unique attacks: ${uniqueAttacks.length}`);
console.log();

// Print summary
console.log('='.repeat(80));
console.log('WEAPONS WITH UNIQUE ANIMATIONS (sorted by count)');
console.log('='.repeat(80));
console.log();

for (const [weaponName, attacks] of sortedWeapons) {
  const wepType = weaponClassMap.get(weaponName)!;
  const className = WEAPON_CLASS_NAMES[wepType] || `Unknown`;

  console.log(`\n${weaponName} (${className}) - ${attacks.length} unique attack(s):`);

  for (const attack of attacks) {
    const sharedStr = attack.sharedWith.length > 0
      ? `Shared with: ${attack.sharedWith.slice(0, 3).join(', ')}${attack.sharedWith.length > 3 ? ` (+${attack.sharedWith.length - 3} more)` : ''}`
      : 'COMPLETELY UNIQUE (no other weapons)';

    console.log(`  - ${attack.attackType}: ${attack.animationId}`);
    console.log(`    Standard: ${attack.standardAnimation} (${attack.standardSharedWith.length} weapons)`);
    console.log(`    ${sharedStr}`);
  }
}

// Print statistics
console.log();
console.log('='.repeat(80));
console.log('STATISTICS BY ATTACK TYPE');
console.log('='.repeat(80));
console.log();

const attackTypeCounts = new Map<string, number>();
for (const attack of uniqueAttacks) {
  attackTypeCounts.set(attack.attackType, (attackTypeCounts.get(attack.attackType) || 0) + 1);
}

const sortedAttackTypes = [...attackTypeCounts.entries()].sort((a, b) => b[1] - a[1]);
for (const [attackType, count] of sortedAttackTypes) {
  console.log(`${attackType}: ${count} weapons with unique animation`);
}

// Print weapons that are completely unique (not shared with any other weapon)
console.log();
console.log('='.repeat(80));
console.log('COMPLETELY UNIQUE ATTACKS (not shared with any other weapon)');
console.log('='.repeat(80));
console.log();

const completelyUnique = uniqueAttacks.filter(a => a.sharedWith.length === 0);
console.log(`Found ${completelyUnique.length} completely unique attacks:`);
for (const attack of completelyUnique) {
  const wepType = weaponClassMap.get(attack.weaponName)!;
  const className = WEAPON_CLASS_NAMES[wepType] || `Unknown`;
  console.log(`  ${attack.weaponName} (${className}): ${attack.attackType} - ${attack.animationId}`);
}

// Detection method summary
console.log();
console.log('='.repeat(80));
console.log('DETECTION METHOD');
console.log('='.repeat(80));
console.log();
console.log('To detect if a weapon has unique attacks:');
console.log('1. Group all weapons by wepType (weapon class)');
console.log('2. For each attack suffix, count which animations are used by weapons in that class');
console.log('3. The "standard" animation is the one used by the most weapons');
console.log('4. Any weapon using a different animation has a "unique" attack');
console.log();
console.log('Key data points needed:');
console.log('- precomputed.weapons[name].wepType - weapon class');
console.log('- animation-users.json - which weapons use which animations');
console.log('- Animation suffix mapping (attack type -> suffix like "030000")');
