/**
 * Types for Elden Ring Ash of War (AoW) Damage Calculator
 *
 * These types define:
 * - Attack parameters from AtkParam_Pc
 * - Sword Arts (AoW) mapping from SwordArtsParam
 * - Final damage rates from FinalDamageRateParam
 * - Calculator input/output structures
 */

// ============================================================================
// Attack Parameter Types (from AtkParam_Pc)
// ============================================================================

/**
 * Attack data from AtkParam_Pc.param.xml
 * Contains motion values and flat damage for AoW attacks
 */
export interface AtkParamEntry {
  id: number;
  name: string; // From paramdexName field

  // Motion values (percentage, divide by 100 for multiplier)
  atkPhysCorrection: number;
  atkMagCorrection: number;
  atkFireCorrection: number;
  atkThunCorrection: number;
  atkDarkCorrection: number;
  atkStamCorrection: number;
  atkSuperArmorCorrection: number; // Poise damage

  // Flat damage (for bullet attacks)
  atkPhys: number;
  atkMag: number;
  atkFire: number;
  atkThun: number;
  atkDark: number;
  atkStam: number;
  atkSuperArmor: number;

  // Attack properties
  atkAttribute: number; // Damage type (252 = use weapon's primary, 253 = use weapon's secondary)
  guardCutCancelRate: number; // Shield chip

  // Flags
  isAddBaseAtk: boolean; // true = bullet attack with flat damage, false = motion value attack
  isArrowAtk: boolean;
  isDisableBothHandsAtkBonus: boolean;
  throwFlag: number;
  disableGuard: boolean;

  // Status/scaling
  statusAilmentAtkPowerCorrectRate: number;
  spEffectAtkPowerCorrectRate_byPoint: number;
  spEffectAtkPowerCorrectRate_byRate: number;
  spEffectAtkPowerCorrectRate_byDmg: number;
  statusAilmentAtkPowerCorrectRate_byPoint: number;
  overwriteAttackElementCorrectId: number; // -1 = use weapon's, otherwise use this for bullet scaling

  // Special effect IDs
  spEffectId0: number;
  spEffectId1: number;
  spEffectId2: number;
  spEffectId3: number;
  spEffectId4: number;

  // PvP damage rate
  finalDamageRateId: number;
}

// ============================================================================
// Final Damage Rate Types (from FinalDamageRateParam)
// ============================================================================

/**
 * Final damage rate data from FinalDamageRateParam.param.xml
 * Used for PvP damage multipliers
 */
export interface FinalDamageRateEntry {
  id: number;
  physRate: number;
  magRate: number;
  fireRate: number;
  thunRate: number;
  darkRate: number;
  staminaRate: number;
  saRate: number; // Poise rate
}

// ============================================================================
// Sword Arts Parameter Types (from SwordArtsParam)
// ============================================================================

/**
 * Sword Arts (AoW) mapping from SwordArtsParam.param.xml
 */
export interface SwordArtsParamEntry {
  id: number;
  name: string;
}

// ============================================================================
// Equip Param Gem Types (from EquipParamGem)
// ============================================================================

/**
 * Equip Param Gem data from EquipParamGem.param.xml
 * Defines Ash of War compatibility with affinities and weapon types
 */
export interface EquipParamGemEntry {
  id: number;
  name: string;
  swordArtsParamId: number;

  // Affinity compatibility flags (configurableWepAttrXX)
  // 00=Standard, 01=Heavy, 02=Keen, 03=Quality, 04=Fire, 05=Flame Art,
  // 06=Lightning, 07=Sacred, 08=Magic, 09=Cold, 10=Poison, 11=Blood, 12=Occult
  configurableWepAttr00: boolean;
  configurableWepAttr01: boolean;
  configurableWepAttr02: boolean;
  configurableWepAttr03: boolean;
  configurableWepAttr04: boolean;
  configurableWepAttr05: boolean;
  configurableWepAttr06: boolean;
  configurableWepAttr07: boolean;
  configurableWepAttr08: boolean;
  configurableWepAttr09: boolean;
  configurableWepAttr10: boolean;
  configurableWepAttr11: boolean;
  configurableWepAttr12: boolean;

  // Weapon type compatibility flags
  canMountWep_Dagger: boolean;
  canMountWep_SwordNormal: boolean;
  canMountWep_SwordLarge: boolean;
  canMountWep_SwordGigantic: boolean;
  canMountWep_SaberNormal: boolean;
  canMountWep_SaberLarge: boolean;
  canMountWep_katana: boolean;
  canMountWep_SwordDoubleEdge: boolean;
  canMountWep_SwordPierce: boolean;
  canMountWep_RapierHeavy: boolean;
  canMountWep_AxeNormal: boolean;
  canMountWep_AxeLarge: boolean;
  canMountWep_HammerNormal: boolean;
  canMountWep_HammerLarge: boolean;
  canMountWep_Flail: boolean;
  canMountWep_SpearNormal: boolean;
  canMountWep_SpearLarge: boolean;
  canMountWep_SpearHeavy: boolean;
  canMountWep_SpearAxe: boolean;
  canMountWep_Sickle: boolean;
  canMountWep_Knuckle: boolean;
  canMountWep_Claw: boolean;
  canMountWep_Whip: boolean;
  canMountWep_AxhammerLarge: boolean;
  canMountWep_BowSmall: boolean;
  canMountWep_BowNormal: boolean;
  canMountWep_BowLarge: boolean;
  canMountWep_ClossBow: boolean;
  canMountWep_Ballista: boolean;
  canMountWep_Staff: boolean;
  canMountWep_Sorcery: boolean;
  canMountWep_Talisman: boolean;
  canMountWep_ShieldSmall: boolean;
  canMountWep_ShieldNormal: boolean;
  canMountWep_ShieldLarge: boolean;
  canMountWep_Torch: boolean;
  canMountWep_HandToHand: boolean;
  canMountWep_PerfumeBottle: boolean;
  canMountWep_ThrustingShield: boolean;
  canMountWep_ThrowingWeapon: boolean;
  canMountWep_ReverseHandSword: boolean;
  canMountWep_LightGreatsword: boolean;
  canMountWep_GreatKatana: boolean;
  canMountWep_BeastClaw: boolean;

  // Text ID for weapon restrictions (e.g. 63004 = Thrusting weapons only)
  mountWepTextId: number;
}

// ============================================================================
// AoW Attack Data (curated/hardcoded data)
// ============================================================================

/**
 * Curated AoW attack data
 * This maps attack IDs to human-readable names and sword arts IDs
 * Some of this is manually curated in the spreadsheet's AowAtkData sheet
 */
export interface AowAtkDataEntry {
  atkId: number;
  name: string;
  swordArtsParamId: number;
  isBullet: boolean; // Derived from name containing "bullet" or from isAddBaseAtk
  isAddBaseAtk: boolean; // Whether this attack adds flat damage on top of motion
}

// ============================================================================
// Weapon Class Mappings (using wepType from EquipParamWeapon)
// ============================================================================

/**
 * Weapon class ID (wepType) to name mapping
 * These values come from the game's EquipParamWeapon wepType field
 */
export const WEAPON_CLASS_MAP: Record<number, string> = {
  // Melee weapons
  1: 'Dagger',
  3: 'Straight Sword',
  5: 'Greatsword',
  7: 'Colossal Sword',
  9: 'Curved Sword',
  11: 'Curved Greatsword',
  13: 'Katana',
  14: 'Twinblade',
  15: 'Thrusting Sword',
  16: 'Heavy Thrusting Sword',
  17: 'Axe',
  19: 'Greataxe',
  21: 'Hammer',
  23: 'Great Hammer',
  24: 'Flail',
  25: 'Spear',
  28: 'Great Spear',
  29: 'Halberd',
  31: 'Reaper',
  33: 'Unarmed',
  35: 'Fist',
  37: 'Claw',
  39: 'Whip',
  41: 'Colossal Weapon',
  // Ranged weapons
  50: 'Light Bow',
  51: 'Bow',
  53: 'Greatbow',
  55: 'Crossbow',
  56: 'Ballista',
  // Catalysts
  57: 'Glintstone Staff',
  61: 'Sacred Seal',
  // Shields
  65: 'Small Shield',
  67: 'Medium Shield',
  69: 'Greatshield',
  // Other
  87: 'Torch',
  // DLC categories
  88: 'Hand-to-Hand',
  89: 'Perfume Bottle',
  90: 'Thrusting Shield',
  91: 'Throwing Blade',
  92: 'Backhand Blade',
  93: 'Light Greatsword',
  94: 'Great Katana',
  95: 'Beast Claw',
};

/**
 * Weapon class name to ID mapping
 */
export const WEAPON_CLASS_NAME_TO_ID: Record<string, number> = Object.entries(WEAPON_CLASS_MAP).reduce(
  (acc, [id, name]) => {
    acc[name] = parseInt(id);
    return acc;
  },
  {} as Record<string, number>
);

// ============================================================================
// Attack Attribute Types
// ============================================================================

/**
 * Attack attribute ID to name mapping
 */
export const ATTACK_ATTRIBUTE_MAP: Record<number, string> = {
  0: 'Standard',
  1: 'Strike',
  2: 'Slash',
  3: 'Pierce',
  252: '-', // Use weapon's primary attribute (atkAttribute field)
  253: '-', // Use weapon's is*AttackType flags (isNormalAttackType, isSlashAttackType, etc.)
  255: '-',
};

// ============================================================================
// Precomputed AoW Data
// ============================================================================

/**
 * Precomputed data for a single AoW attack hit
 */
export interface PrecomputedAowAttack {
  atkId: number;
  name: string;
  weaponClass: string | null; // Weapon class from name (e.g., "Dagger", "Straight Sword"), null for generic attacks

  // Motion values (already divided by 100)
  motionPhys: number;
  motionMag: number;
  motionFire: number;
  motionThun: number;
  motionDark: number;
  motionStam: number;
  motionPoise: number;

  // Flat damage
  flatPhys: number;
  flatMag: number;
  flatFire: number;
  flatThun: number;
  flatDark: number;
  flatStam: number;
  flatPoise: number;

  // Attack properties
  atkAttribute: number;
  guardCutCancelRate: number;
  isAddBaseAtk: boolean;
  overwriteAttackElementCorrectId: number;
  /** When true, this attack should NOT use the 2H STR bonus even when 2-handing */
  isDisableBothHandsAtkBonus: boolean;

  // PvP multiplier (from FinalDamageRateParam)
  pvpMultiplier: number;
}

/**
 * Precomputed data for a complete AoW (may have multiple hits)
 */
export interface PrecomputedAow {
  swordArtsId: number;
  name: string;
  attacks: PrecomputedAowAttack[];
}

/**
 * Complete precomputed AoW data bundle
 */
export interface PrecomputedAowData {
  version: string;
  generatedAt: string;

  // All sword arts indexed by ID
  swordArts: Record<number, PrecomputedAow>;

  // Attack data indexed by attack ID
  attacks: Record<number, PrecomputedAowAttack>;

  // Sword Arts ID by name (for lookup)
  swordArtsByName: Record<string, number>;

  // Attack Element Correct data for bullet scaling
  attackElementCorrect: Record<number, AttackElementCorrectEntry>;

  // Final damage rates for PvP
  finalDamageRates: Record<number, FinalDamageRateEntry>;

  // Equip Param Gem data for affinity/weapon compatibility
  equipParamGem: Record<number, EquipParamGemEntry>;

  // Mappings from GemData
  weaponClassMountFieldMap: Record<string, string>; // "Dagger" -> "canMountWep_Dagger"
  affinityConfigFieldMap: Record<string, string>; // "Standard" -> "configurableWepAttr00"

  // Maps AoW name to the set of weapon classes that have explicit [WeaponClass] attacks
  // Weapon classes NOT in this set should use [VarN] attacks instead
  // e.g., { "Spinning Slash": ["Dagger", "Straight Sword", "Curved Sword", ...] }
  aowExplicitWeaponClasses: Record<string, string[]>;

  // Maps swordArtsParamId to the corresponding gemId in EquipParamGem
  // This is needed because swordArtsId and gemId are not always the same
  swordArtsIdToGemId: Record<number, number>;

  // Maps AoW name to stat point bonuses (e.g., War Cry, Barbaric Roar)
  // These are added to scaling calculations for certain buff AoWs
  aowStatPointBonuses: Record<string, AowStatPointBonus>;

  // Maps swordArtsParamId to skill name for ALL skills (including unique weapon skills)
  // This is used to display the built-in skill name for unique weapons
  skillNames: Record<number, string>;
}

// ============================================================================
// Gem Data Types (from gem-data.tsv)
// ============================================================================

/**
 * Raw entry from gem-data.tsv
 */
export interface GemDataEntry {
  name: string;
  canMountWep: string;
  defaultWepAttr: number | null;
  infusion: string;
  equipParamGem: string;
  varCategorySwordArt: string | null; // AoW name that uses variants for this weapon class
  // Stat point bonuses (from changeAttributePoint columns)
  changeAttributePoint: string | null; // AoW name this bonus applies to
  changeStrengthPoint: number;
  changeAgilityPoint: number;
  changeMagicPoint: number;
  changeFaithPoint: number;
  changeLuckPoint: number;
}

/**
 * Stat point bonuses for an AoW (from GemData changeAttributePoint columns)
 * These are added to scaling calculations for certain AoWs like War Cry/Barbaric Roar
 */
export interface AowStatPointBonus {
  strength: number;
  dexterity: number; // Note: GemData calls this "Agility"
  intelligence: number; // Note: GemData calls this "Magic"
  faith: number;
  arcane: number; // Note: GemData calls this "Luck"
}

/**
 * Attack Element Correct data for stat scaling on bullet attacks
 */
export interface AttackElementCorrectEntry {
  id: number;

  // Which stats affect which damage types (boolean flags as 0/1)
  isStrengthCorrect_byPhysics: boolean;
  isStrengthCorrect_byMagic: boolean;
  isStrengthCorrect_byFire: boolean;
  isStrengthCorrect_byThunder: boolean;
  isStrengthCorrect_byDark: boolean;

  isDexterityCorrect_byPhysics: boolean;
  isDexterityCorrect_byMagic: boolean;
  isDexterityCorrect_byFire: boolean;
  isDexterityCorrect_byThunder: boolean;
  isDexterityCorrect_byDark: boolean;

  isMagicCorrect_byPhysics: boolean;
  isMagicCorrect_byMagic: boolean;
  isMagicCorrect_byFire: boolean;
  isMagicCorrect_byThunder: boolean;
  isMagicCorrect_byDark: boolean;

  isFaithCorrect_byPhysics: boolean;
  isFaithCorrect_byMagic: boolean;
  isFaithCorrect_byFire: boolean;
  isFaithCorrect_byThunder: boolean;
  isFaithCorrect_byDark: boolean;

  isLuckCorrect_byPhysics: boolean;
  isLuckCorrect_byMagic: boolean;
  isLuckCorrect_byFire: boolean;
  isLuckCorrect_byThunder: boolean;
  isLuckCorrect_byDark: boolean;

  // Override scaling values (-1 = use weapon's scaling)
  overwriteStrengthCorrectRate_byPhysics: number;
  overwriteStrengthCorrectRate_byMagic: number;
  overwriteStrengthCorrectRate_byFire: number;
  overwriteStrengthCorrectRate_byThunder: number;
  overwriteStrengthCorrectRate_byDark: number;

  overwriteDexterityCorrectRate_byPhysics: number;
  overwriteDexterityCorrectRate_byMagic: number;
  overwriteDexterityCorrectRate_byFire: number;
  overwriteDexterityCorrectRate_byThunder: number;
  overwriteDexterityCorrectRate_byDark: number;

  overwriteMagicCorrectRate_byPhysics: number;
  overwriteMagicCorrectRate_byMagic: number;
  overwriteMagicCorrectRate_byFire: number;
  overwriteMagicCorrectRate_byThunder: number;
  overwriteMagicCorrectRate_byDark: number;

  overwriteFaithCorrectRate_byPhysics: number;
  overwriteFaithCorrectRate_byMagic: number;
  overwriteFaithCorrectRate_byFire: number;
  overwriteFaithCorrectRate_byThunder: number;
  overwriteFaithCorrectRate_byDark: number;

  overwriteLuckCorrectRate_byPhysics: number;
  overwriteLuckCorrectRate_byMagic: number;
  overwriteLuckCorrectRate_byFire: number;
  overwriteLuckCorrectRate_byThunder: number;
  overwriteLuckCorrectRate_byDark: number;
}

// ============================================================================
// Calculator Input Types
// ============================================================================

/**
 * Input for AoW damage calculation
 */
export interface AowCalculatorInput {
  // Weapon data
  weaponName: string;
  affinity: string;
  upgradeLevel: number;
  weaponClass: string;

  // Player stats
  strength: number;
  dexterity: number;
  intelligence: number;
  faith: number;
  arcane: number;

  // Options
  twoHanding: boolean;
  ignoreRequirements: boolean;
  pvpMode: boolean;
  showLackingFp: boolean;

  // AoW selection
  aowName: string;
}

// ============================================================================
// Calculator Output Types
// ============================================================================

/**
 * Single attack result
 */
export interface AowAttackResult {
  name: string;
  atkId: number;

  // Damage outputs (rounded)
  physical: number | '-';
  magic: number | '-';
  fire: number | '-';
  lightning: number | '-';
  holy: number | '-';

  // Other outputs
  stamina: number | '-';
  poise: number | '-';
  attackAttribute: string;
  pvpMultiplier: number | '-';
  shieldChip: number | '-';

  // Scaling metadata (for UI charting)
  /** Whether this attack's damage scales with player stats (STR/DEX/INT/FAI/ARC) */
  hasStatScaling: boolean;
  /** Whether this is a bullet attack (isAddBaseAtk=true) vs motion attack (isAddBaseAtk=false) */
  isBullet: boolean;

  // Separate motion and bullet damage (for column display)
  /** Total damage from motion values (scales with weapon AR) */
  motionDamage: number;
  /** Total damage from flat/bullet values (may have stat scaling) */
  bulletDamage: number;
  // Per-element motion damage
  motionPhys: number;
  motionMag: number;
  motionFire: number;
  motionLtn: number;
  motionHoly: number;
  // Per-element bullet damage
  bulletPhys: number;
  bulletMag: number;
  bulletFire: number;
  bulletLtn: number;
  bulletHoly: number;
}

/**
 * Complete AoW calculation result
 */
export interface AowCalculatorResult {
  aowName: string;
  swordArtsId: number;

  // Requirements
  requirements: {
    strength: number | '-';
    dexterity: number | '-';
    intelligence: number | '-';
    faith: number | '-';
    arcane: number | '-';
  };

  // All attack hits
  attacks: AowAttackResult[];

  // Error state
  error?: string;
}

// ============================================================================
// CSV Test Case Types
// ============================================================================

/**
 * AoW test case from CSV file
 */
export interface AowTestCase {
  // Inputs
  AoW_Input_2h: boolean;
  AoW_Input_Affinity: string;
  AoW_Input_AoW: string;
  AoW_Input_Arcane: number;
  AoW_Input_Dexterity: number;
  AoW_Input_Faith: number;
  AoW_Input_IgnoreReq: boolean;
  AoW_Input_Intelligence: number;
  AoW_Input_PvP: boolean;
  AoW_Input_ShowLackFP: boolean;
  AoW_Input_Strength: number;
  AoW_Input_UpgradeLevel: number;
  AoW_Input_WeaponClass: string;
  AoW_Input_WeaponName: string;

  // AoW List (selected AoW)
  AoW_AoWList: string;

  // Output attacks (up to 7)
  outputs: Array<{
    name: string;
    attackAttribute: string;
    physical: number | '-';
    magic: number | '-';
    fire: number | '-';
    lightning: number | '-';
    holy: number | '-';
    stamina: number | '-';
    poise: number | '-';
    pvpMultiplier: number | '-';
    shieldChip: number | '-';
  }>;

  // Requirements
  AoW_Require_Strength: number | '-';
  AoW_Require_Dexterity: number | '-';
  AoW_Require_Intelligence: number | '-';
  AoW_Require_Faith: number | '-';
  AoW_Require_Arcane: number | '-';
}
