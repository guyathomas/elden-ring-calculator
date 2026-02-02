/**
 * Animation Mapping Utilities
 * 
 * Maps weapon attack types to animation IDs for the animation timeline viewer.
 * Animation IDs follow the pattern: a{motionCategory}_{animationId}
 */

/**
 * Maps attack type IDs (from weaponAttacks.ts) to animation ID suffixes.
 * The animation ID suffix corresponds to the attack animation within a motion category.
 * 
 * Pattern: Animation filename = `a${motionCategory.toString().padStart(3, '0')}_${animationSuffix}`
 * Example: Uchigatana (motionCategory=29) + 1H R1 [1] (suffix=030000) → a029_030000
 */
export const ATTACK_TYPE_TO_ANIMATION_SUFFIX: Record<number, string> = {
  // 1H Light Attacks (R1)
  0: '030000',   // 1H R1 [1]
  10: '030010',  // 1H R1 [2]
  20: '030020',  // 1H R1 [3]
  30: '030030',  // 1H R1 [4]
  40: '030040',  // 1H R1 [5]
  
  // 1H Heavy Attacks (R2) - charged variants
  100: '030505',  // 1H R2 [1] (release)
  105: '030500',  // 1H R2 (charged) [1]
  110: '030515',  // 1H R2 [2] (release)
  115: '030510',  // 1H R2 (charged) [2]
  
  // 1H Running
  120: '030200',  // 1H Running R1
  125: '030210',  // 1H Running R2
  
  // 1H Crouch
  130: '030310',  // 1H Crouch R1
  
  // 1H Backstep
  140: '030400',  // 1H Backstep R1
  
  // 1H Rolling
  150: '030300',  // 1H Rolling R1
  
  // 1H Jumping
  170: '031030',  // 1H Jumping R1
  175: '031040',  // 1H Jumping R2
  
  // 2H Light Attacks (R1)
  200: '040000',  // 2H R1 [1]
  210: '040010',  // 2H R1 [2]
  220: '040020',  // 2H R1 [3]
  230: '040030',  // 2H R1 [4]
  240: '040040',  // 2H R1 [5]
  
  // 2H Heavy Attacks (R2)
  300: '040505',  // 2H R2 [1] (release)
  305: '040500',  // 2H R2 (charged) [1]
  310: '040515',  // 2H R2 [2] (release)
  315: '040510',  // 2H R2 (charged) [2]
  
  // 2H Running
  320: '040200',  // 2H Running R1
  325: '040210',  // 2H Running R2
  
  // 2H Crouch
  330: '040310',  // 2H Crouch R1
  
  // 2H Backstep
  340: '040400',  // 2H Backstep R1
  
  // 2H Rolling
  350: '040300',  // 2H Rolling R1
  
  // 2H Jumping
  370: '041030',  // 2H Jumping R1
  380: '041040',  // 2H Jumping R2
  
  // Guard Counter
  500: '030700',  // Guard Counter (1H)
  510: '040700',  // Guard Counter (2H)
};

/**
 * Get the animation ID for a given weapon and attack type
 * 
 * @param wepmotionCategory - The weapon's motion category (from weapon data)
 * @param attackTypeId - The attack type ID (from ATTACK_TYPE_MAP)
 * @returns Animation ID (e.g., "a029_030000") or null if not found
 */
export function getAnimationId(wepmotionCategory: number, attackTypeId: number): string | null {
  const animationSuffix = ATTACK_TYPE_TO_ANIMATION_SUFFIX[attackTypeId];
  if (!animationSuffix) {
    return null;
  }
  
  // Build animation ID: a{category}_{suffix}
  const section = `a${wepmotionCategory.toString().padStart(3, '0')}`;
  return `${section}_${animationSuffix}`;
}

/**
 * Get the animation section for a weapon's motion category
 * 
 * @param wepmotionCategory - The weapon's motion category
 * @returns Animation section (e.g., "a029")
 */
export function getAnimationSection(wepmotionCategory: number): string {
  return `a${wepmotionCategory.toString().padStart(3, '0')}`;
}

/**
 * Common motion categories with descriptive names
 */
export const MOTION_CATEGORY_NAMES: Record<number, string> = {
  20: 'Dagger',
  21: 'Straight Sword (Standard)',
  22: 'Greatsword',
  23: 'Colossal Sword',
  24: 'Curved Sword',
  25: 'Curved Greatsword',
  26: 'Katana (Unique)',
  27: 'Twinblade',
  28: 'Thrusting Sword',
  29: 'Katana',
  30: 'Heavy Thrusting Sword',
  31: 'Axe',
  32: 'Greataxe',
  33: 'Hammer',
  34: 'Flail',
  35: 'Great Hammer',
  36: 'Colossal Weapon',
  37: 'Spear',
  38: 'Great Spear',
  39: 'Halberd',
  40: 'Reaper',
  41: 'Fist',
  42: 'Claw',
  43: 'Whip',
  44: 'Staff',
  45: 'Sacred Seal',
  50: 'Light Bow',
  51: 'Bow',
  52: 'Greatbow',
  53: 'Crossbow',
  54: 'Ballista',
  55: 'Torch',
  56: 'Small Shield',
  57: 'Medium Shield',
  58: 'Greatshield',
};
