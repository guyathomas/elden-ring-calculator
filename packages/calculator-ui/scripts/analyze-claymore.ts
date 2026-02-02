import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../src/data');

// Load data
const precomputed = JSON.parse(readFileSync(path.join(DATA_DIR, 'precomputed.json'), 'utf-8'));
const animationUsers: Record<string, string[]> = JSON.parse(
  gunzipSync(readFileSync(path.join(DATA_DIR, 'animation-users.json.gz'))).toString('utf-8')
);

// Attack suffixes
const ATTACKS: Record<string, string> = {
  'R1-1': '030000',
  'R1-2': '030005',
  'R2-1': '030500',
  'R2-2': '030505',
  'Charged R2-1': '030600',
  'Charged R2-2': '030605',
  'Rolling R1': '032000',
  'Jump R1': '035000',
};

// Find weapon's animations
const weaponName = process.argv[2] || 'Claymore';
const weapon = precomputed.weapons[weaponName];

if (!weapon) {
  console.error(`Weapon not found: ${weaponName}`);
  process.exit(1);
}

const WEAPON_CLASS_NAMES: Record<number, string> = {
  1: 'Dagger', 2: 'Straight Sword', 3: 'Greatsword', 4: 'Colossal Sword',
  5: 'Curved Sword', 6: 'Curved Greatsword', 7: 'Katana', 8: 'Twinblade',
  9: 'Thrusting Sword', 10: 'Heavy Thrusting Sword', 11: 'Axe', 12: 'Greataxe',
  13: 'Hammer', 14: 'Great Hammer', 15: 'Flail', 16: 'Spear', 17: 'Great Spear',
  18: 'Halberd', 19: 'Reaper', 20: 'Fist', 21: 'Claw', 22: 'Whip',
  23: 'Colossal Weapon', 40: 'Light Greatsword', 41: 'Great Katana',
};

console.log(`\n${weaponName}`);
console.log(`Class: ${WEAPON_CLASS_NAMES[weapon.wepType] || weapon.wepType}`);
console.log(`wepmotionCategory: ${weapon.wepmotionCategory}`);
console.log();

// Find all animations this weapon uses
const weaponAnims = new Map<string, string>();
for (const [animId, weapons] of Object.entries(animationUsers)) {
  if (weapons.includes(weaponName)) {
    const suffix = animId.split('_')[1];
    if (suffix) weaponAnims.set(suffix, animId);
  }
}

// Get all weapons in the same class
const classWeapons = Object.entries(precomputed.weapons)
  .filter(([_, w]: [string, any]) => w.wepType === weapon.wepType)
  .map(([name, _]) => name);

console.log(`Class has ${classWeapons.length} weapons total\n`);
console.log('Attack'.padEnd(14) + ' | Animation'.padEnd(17) + ' | Shared | Class Standard');
console.log('-'.repeat(75));

for (const [attackName, suffix] of Object.entries(ATTACKS)) {
  const animId = weaponAnims.get(suffix);
  if (!animId) continue;

  const sharedWith = animationUsers[animId] || [];
  const sharedCount = sharedWith.length - 1; // exclude self

  // Count how many class weapons use which animation for this attack
  const animCounts: Record<string, number> = {};
  for (const classWeapon of classWeapons) {
    for (const [aId, users] of Object.entries(animationUsers)) {
      if (aId.endsWith('_' + suffix) && users.includes(classWeapon)) {
        animCounts[aId] = (animCounts[aId] || 0) + 1;
      }
    }
  }

  // Find the standard (most common in class)
  let standardAnim = '';
  let standardCount = 0;
  for (const [aId, count] of Object.entries(animCounts)) {
    if (count > standardCount) {
      standardAnim = aId;
      standardCount = count;
    }
  }

  const isUnique = animId !== standardAnim;
  const marker = isUnique ? ' ⚠️  UNIQUE' : '';

  console.log(
    attackName.padEnd(14) + ' | ' +
    animId.padEnd(15) + ' | ' +
    String(sharedCount).padStart(6) + ' | ' +
    standardAnim + ' (' + standardCount + ')' +
    marker
  );
}

console.log();
console.log('DETECTION LOGIC:');
console.log('- "Shared" = total weapons using this exact animation (across all classes)');
console.log('- "Class Standard" = the animation most weapons in this class use');
console.log('- "UNIQUE" = this weapon uses a different animation than the class standard');
