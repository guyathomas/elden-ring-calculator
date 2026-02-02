/**
 * Parser for AoW-related param XML files
 *
 * Parses:
 * - AtkParam_Pc.param.xml - Attack parameters including AoW attacks
 * - FinalDamageRateParam.param.xml - PvP damage multipliers
 * - SwordArtsParam.param.xml - Sword Arts (AoW) mapping
 */

import { readFileSync } from 'fs';
import { parseParamXml, loadParamFile, type ParamFile, type ParamRow } from './paramParser.js';
import type {
  AtkParamEntry,
  FinalDamageRateEntry,
  SwordArtsParamEntry,
  AttackElementCorrectEntry,
  EquipParamGemEntry,
} from './aowTypes.js';

// ============================================================================
// AtkParam_Pc Parser
// ============================================================================

/**
 * Parse AtkParam_Pc.param.xml for attack data
 * Filters to only include entries with [AOW] in the name or specific attack IDs
 */
export function parseAtkParamPc(paramFile: ParamFile): Map<number, AtkParamEntry> {
  const attacks = new Map<number, AtkParamEntry>();

  for (const row of paramFile.rows) {
    const entry: AtkParamEntry = {
      id: row.id as number,
      name: (row.paramdexName as string) || '',

      // Motion values
      atkPhysCorrection: (row.atkPhysCorrection as number) ?? 100,
      atkMagCorrection: (row.atkMagCorrection as number) ?? 100,
      atkFireCorrection: (row.atkFireCorrection as number) ?? 100,
      atkThunCorrection: (row.atkThunCorrection as number) ?? 100,
      atkDarkCorrection: (row.atkDarkCorrection as number) ?? 100,
      atkStamCorrection: (row.atkStamCorrection as number) ?? 100,
      atkSuperArmorCorrection: (row.atkSuperArmorCorrection as number) ?? 0,

      // Flat damage
      atkPhys: (row.atkPhys as number) ?? 0,
      atkMag: (row.atkMag as number) ?? 0,
      atkFire: (row.atkFire as number) ?? 0,
      atkThun: (row.atkThun as number) ?? 0,
      atkDark: (row.atkDark as number) ?? 0,
      atkStam: (row.atkStam as number) ?? 0,
      atkSuperArmor: (row.atkSuperArmor as number) ?? 0,

      // Attack properties
      atkAttribute: (row.atkAttribute as number) ?? 253,
      guardCutCancelRate: (row.guardCutCancelRate as number) ?? 0,

      // Flags
      isAddBaseAtk: Boolean(row.isAddBaseAtk),
      isArrowAtk: Boolean(row.isArrowAtk),
      isDisableBothHandsAtkBonus: Boolean(row.isDisableBothHandsAtkBonus),
      throwFlag: (row.throwFlag as number) ?? 0,
      disableGuard: Boolean(row.disableGuard),

      // Status/scaling
      statusAilmentAtkPowerCorrectRate: (row.statusAilmentAtkPowerCorrectRate as number) ?? 100,
      spEffectAtkPowerCorrectRate_byPoint: (row.spEffectAtkPowerCorrectRate_byPoint as number) ?? 100,
      spEffectAtkPowerCorrectRate_byRate: (row.spEffectAtkPowerCorrectRate_byRate as number) ?? 100,
      spEffectAtkPowerCorrectRate_byDmg: (row.spEffectAtkPowerCorrectRate_byDmg as number) ?? 100,
      statusAilmentAtkPowerCorrectRate_byPoint:
        (row.statusAilmentAtkPowerCorrectRate_byPoint as number) ?? 100,
      overwriteAttackElementCorrectId: (row.overwriteAttackElementCorrectId as number) ?? -1,

      // Special effect IDs
      spEffectId0: (row.spEffectId0 as number) ?? -1,
      spEffectId1: (row.spEffectId1 as number) ?? -1,
      spEffectId2: (row.spEffectId2 as number) ?? -1,
      spEffectId3: (row.spEffectId3 as number) ?? -1,
      spEffectId4: (row.spEffectId4 as number) ?? -1,

      // PvP damage rate
      finalDamageRateId: (row.finalDamageRateId as number) ?? 10000,
    };

    attacks.set(entry.id, entry);
  }

  return attacks;
}

/**
 * Load and parse AtkParam_Pc.param.xml
 */
export function loadAtkParamPc(filePath: string): Map<number, AtkParamEntry> {
  const paramFile = loadParamFile(filePath);
  return parseAtkParamPc(paramFile);
}

// ============================================================================
// FinalDamageRateParam Parser
// ============================================================================

/**
 * Parse FinalDamageRateParam.param.xml for PvP multipliers
 */
export function parseFinalDamageRateParam(paramFile: ParamFile): Map<number, FinalDamageRateEntry> {
  const rates = new Map<number, FinalDamageRateEntry>();

  for (const row of paramFile.rows) {
    const entry: FinalDamageRateEntry = {
      id: row.id as number,
      physRate: (row.physRate as number) ?? 1,
      magRate: (row.magRate as number) ?? 1,
      fireRate: (row.fireRate as number) ?? 1,
      thunRate: (row.thunRate as number) ?? 1,
      darkRate: (row.darkRate as number) ?? 1,
      staminaRate: (row.staminaRate as number) ?? 1.25,
      saRate: (row.saRate as number) ?? 2.7,
    };

    rates.set(entry.id, entry);
  }

  return rates;
}

/**
 * Load and parse FinalDamageRateParam.param.xml
 */
export function loadFinalDamageRateParam(filePath: string): Map<number, FinalDamageRateEntry> {
  const paramFile = loadParamFile(filePath);
  return parseFinalDamageRateParam(paramFile);
}

// ============================================================================
// SwordArtsParam Parser
// ============================================================================

/**
 * Parse SwordArtsParam.param.xml for AoW name mapping
 */
export function parseSwordArtsParam(paramFile: ParamFile): Map<number, SwordArtsParamEntry> {
  const swordArts = new Map<number, SwordArtsParamEntry>();

  for (const row of paramFile.rows) {
    const entry: SwordArtsParamEntry = {
      id: row.id as number,
      name: (row.paramdexName as string) || '',
    };

    // Only include entries with a name
    if (entry.name) {
      swordArts.set(entry.id, entry);
    }
  }

  return swordArts;
}

/**
 * Load and parse SwordArtsParam.param.xml
 */
export function loadSwordArtsParam(filePath: string): Map<number, SwordArtsParamEntry> {
  const paramFile = loadParamFile(filePath);
  return parseSwordArtsParam(paramFile);
}

// ============================================================================
// AttackElementCorrectParam Parser
// ============================================================================

/**
 * Parse AttackElementCorrectParam.param.xml for stat scaling overrides
 */
export function parseAttackElementCorrectParam(paramFile: ParamFile): Map<number, AttackElementCorrectEntry> {
  const entries = new Map<number, AttackElementCorrectEntry>();

  for (const row of paramFile.rows) {
    const entry: AttackElementCorrectEntry = {
      id: row.id as number,

      // Strength affects damage types
      isStrengthCorrect_byPhysics: Boolean(row.isStrengthCorrect_byPhysics),
      isStrengthCorrect_byMagic: Boolean(row.isStrengthCorrect_byMagic),
      isStrengthCorrect_byFire: Boolean(row.isStrengthCorrect_byFire),
      isStrengthCorrect_byThunder: Boolean(row.isStrengthCorrect_byThunder),
      isStrengthCorrect_byDark: Boolean(row.isStrengthCorrect_byDark),

      // Dexterity affects damage types
      isDexterityCorrect_byPhysics: Boolean(row.isDexterityCorrect_byPhysics),
      isDexterityCorrect_byMagic: Boolean(row.isDexterityCorrect_byMagic),
      isDexterityCorrect_byFire: Boolean(row.isDexterityCorrect_byFire),
      isDexterityCorrect_byThunder: Boolean(row.isDexterityCorrect_byThunder),
      isDexterityCorrect_byDark: Boolean(row.isDexterityCorrect_byDark),

      // Intelligence affects damage types
      isMagicCorrect_byPhysics: Boolean(row.isMagicCorrect_byPhysics),
      isMagicCorrect_byMagic: Boolean(row.isMagicCorrect_byMagic),
      isMagicCorrect_byFire: Boolean(row.isMagicCorrect_byFire),
      isMagicCorrect_byThunder: Boolean(row.isMagicCorrect_byThunder),
      isMagicCorrect_byDark: Boolean(row.isMagicCorrect_byDark),

      // Faith affects damage types
      isFaithCorrect_byPhysics: Boolean(row.isFaithCorrect_byPhysics),
      isFaithCorrect_byMagic: Boolean(row.isFaithCorrect_byMagic),
      isFaithCorrect_byFire: Boolean(row.isFaithCorrect_byFire),
      isFaithCorrect_byThunder: Boolean(row.isFaithCorrect_byThunder),
      isFaithCorrect_byDark: Boolean(row.isFaithCorrect_byDark),

      // Arcane affects damage types
      isLuckCorrect_byPhysics: Boolean(row.isLuckCorrect_byPhysics),
      isLuckCorrect_byMagic: Boolean(row.isLuckCorrect_byMagic),
      isLuckCorrect_byFire: Boolean(row.isLuckCorrect_byFire),
      isLuckCorrect_byThunder: Boolean(row.isLuckCorrect_byThunder),
      isLuckCorrect_byDark: Boolean(row.isLuckCorrect_byDark),

      // Override scaling values
      overwriteStrengthCorrectRate_byPhysics: (row.overwriteStrengthCorrectRate_byPhysics as number) ?? -1,
      overwriteStrengthCorrectRate_byMagic: (row.overwriteStrengthCorrectRate_byMagic as number) ?? -1,
      overwriteStrengthCorrectRate_byFire: (row.overwriteStrengthCorrectRate_byFire as number) ?? -1,
      overwriteStrengthCorrectRate_byThunder: (row.overwriteStrengthCorrectRate_byThunder as number) ?? -1,
      overwriteStrengthCorrectRate_byDark: (row.overwriteStrengthCorrectRate_byDark as number) ?? -1,

      overwriteDexterityCorrectRate_byPhysics: (row.overwriteDexterityCorrectRate_byPhysics as number) ?? -1,
      overwriteDexterityCorrectRate_byMagic: (row.overwriteDexterityCorrectRate_byMagic as number) ?? -1,
      overwriteDexterityCorrectRate_byFire: (row.overwriteDexterityCorrectRate_byFire as number) ?? -1,
      overwriteDexterityCorrectRate_byThunder: (row.overwriteDexterityCorrectRate_byThunder as number) ?? -1,
      overwriteDexterityCorrectRate_byDark: (row.overwriteDexterityCorrectRate_byDark as number) ?? -1,

      overwriteMagicCorrectRate_byPhysics: (row.overwriteMagicCorrectRate_byPhysics as number) ?? -1,
      overwriteMagicCorrectRate_byMagic: (row.overwriteMagicCorrectRate_byMagic as number) ?? -1,
      overwriteMagicCorrectRate_byFire: (row.overwriteMagicCorrectRate_byFire as number) ?? -1,
      overwriteMagicCorrectRate_byThunder: (row.overwriteMagicCorrectRate_byThunder as number) ?? -1,
      overwriteMagicCorrectRate_byDark: (row.overwriteMagicCorrectRate_byDark as number) ?? -1,

      overwriteFaithCorrectRate_byPhysics: (row.overwriteFaithCorrectRate_byPhysics as number) ?? -1,
      overwriteFaithCorrectRate_byMagic: (row.overwriteFaithCorrectRate_byMagic as number) ?? -1,
      overwriteFaithCorrectRate_byFire: (row.overwriteFaithCorrectRate_byFire as number) ?? -1,
      overwriteFaithCorrectRate_byThunder: (row.overwriteFaithCorrectRate_byThunder as number) ?? -1,
      overwriteFaithCorrectRate_byDark: (row.overwriteFaithCorrectRate_byDark as number) ?? -1,

      overwriteLuckCorrectRate_byPhysics: (row.overwriteLuckCorrectRate_byPhysics as number) ?? -1,
      overwriteLuckCorrectRate_byMagic: (row.overwriteLuckCorrectRate_byMagic as number) ?? -1,
      overwriteLuckCorrectRate_byFire: (row.overwriteLuckCorrectRate_byFire as number) ?? -1,
      overwriteLuckCorrectRate_byThunder: (row.overwriteLuckCorrectRate_byThunder as number) ?? -1,
      overwriteLuckCorrectRate_byDark: (row.overwriteLuckCorrectRate_byDark as number) ?? -1,
    };

    entries.set(entry.id, entry);
  }

  return entries;
}

/**
 * Load and parse AttackElementCorrectParam.param.xml
 */
export function loadAttackElementCorrectParam(filePath: string): Map<number, AttackElementCorrectEntry> {
  const paramFile = loadParamFile(filePath);
  return parseAttackElementCorrectParam(paramFile);
}

// ============================================================================
// EquipParamGem Parser
// ============================================================================

/**
 * Parse EquipParamGem.param.xml for affinity and weapon compatibility
 */
export function parseEquipParamGem(paramFile: ParamFile): Map<number, EquipParamGemEntry> {
  const entries = new Map<number, EquipParamGemEntry>();

  for (const row of paramFile.rows) {
    // Get the default affinity for this AoW (e.g., 9=Cold for Hoarfrost Stomp)
    const defaultWepAttr = row.defaultWepAttr !== undefined ? Number(row.defaultWepAttr) : -1;

    // Determine if this entry has any explicit FALSE (0) values for special affinities (04-10)
    // This indicates it's a "specialized" AoW that only works with certain affinities
    // (e.g., Hoarfrost Stomp only works with Cold/Magic, not Fire/Lightning/etc.)
    const hasExplicitFalseInSpecialAffinities =
      row.configurableWepAttr04 === 0 ||
      row.configurableWepAttr05 === 0 ||
      row.configurableWepAttr06 === 0 ||
      row.configurableWepAttr07 === 0 ||
      row.configurableWepAttr08 === 0 ||
      row.configurableWepAttr09 === 0 ||
      row.configurableWepAttr10 === 0;

    // Helper to determine affinity support based on the correct formula:
    //   Valid Affinities = Basic(0-3) ALWAYS ∪ {defaultWepAttr} ∪ {configurableWepAttrXX=1}
    //                      ∪ (all non-basic if no explicit 0s in special affinities)
    //
    // - Basic affinities (0-3: Standard, Heavy, Keen, Quality) are ALWAYS supported
    // - The defaultWepAttr affinity is always supported
    // - Any affinity with configurableWepAttrXX=1 in the param file is supported
    // - If there are NO explicit 0s in special affinities, it's an "all-affinity" AoW
    //   and all affinities default to TRUE (e.g., Storm Stomp, Kick)
    // - If there ARE explicit 0s in special affinities, it's a "specialized" AoW
    //   and missing affinities default to FALSE (e.g., Hoarfrost Stomp, Flame Skewer)
    const getAffinitySupport = (attrIndex: number, paramValue: unknown): boolean => {
      // Basic affinities (0-3) are ALWAYS supported for all AoWs
      if (attrIndex <= 3) {
        return true;
      }
      // defaultWepAttr is always supported
      if (attrIndex === defaultWepAttr) {
        return true;
      }
      // Use param file value if explicitly set (1 = supported, 0 = not supported)
      if (paramValue !== undefined) {
        return Boolean(paramValue);
      }
      // For missing values: if no explicit 0s in special affinities, it's an all-affinity AoW
      // Otherwise it's a specialized AoW and missing affinities are not supported
      return !hasExplicitFalseInSpecialAffinities;
    };

    const entry: EquipParamGemEntry = {
      id: row.id as number,
      name: (row.paramdexName as string) || '',
      swordArtsParamId: (row.swordArtsParamId as number) ?? 0,

      // Affinity compatibility flags using the correct formula:
      // Basic(0-3) ALWAYS ∪ {defaultWepAttr} ∪ {configurableWepAttrXX=1}
      configurableWepAttr00: getAffinitySupport(0, row.configurableWepAttr00),
      configurableWepAttr01: getAffinitySupport(1, row.configurableWepAttr01),
      configurableWepAttr02: getAffinitySupport(2, row.configurableWepAttr02),
      configurableWepAttr03: getAffinitySupport(3, row.configurableWepAttr03),
      configurableWepAttr04: getAffinitySupport(4, row.configurableWepAttr04),
      configurableWepAttr05: getAffinitySupport(5, row.configurableWepAttr05),
      configurableWepAttr06: getAffinitySupport(6, row.configurableWepAttr06),
      configurableWepAttr07: getAffinitySupport(7, row.configurableWepAttr07),
      configurableWepAttr08: getAffinitySupport(8, row.configurableWepAttr08),
      configurableWepAttr09: getAffinitySupport(9, row.configurableWepAttr09),
      configurableWepAttr10: getAffinitySupport(10, row.configurableWepAttr10),
      configurableWepAttr11: getAffinitySupport(11, row.configurableWepAttr11),
      configurableWepAttr12: getAffinitySupport(12, row.configurableWepAttr12),

      // Weapon type compatibility flags
      canMountWep_Dagger: Boolean(row.canMountWep_Dagger),
      canMountWep_SwordNormal: Boolean(row.canMountWep_SwordNormal),
      canMountWep_SwordLarge: Boolean(row.canMountWep_SwordLarge),
      canMountWep_SwordGigantic: Boolean(row.canMountWep_SwordGigantic),
      canMountWep_SaberNormal: Boolean(row.canMountWep_SaberNormal),
      canMountWep_SaberLarge: Boolean(row.canMountWep_SaberLarge),
      canMountWep_katana: Boolean(row.canMountWep_katana),
      canMountWep_SwordDoubleEdge: Boolean(row.canMountWep_SwordDoubleEdge),
      canMountWep_SwordPierce: Boolean(row.canMountWep_SwordPierce),
      canMountWep_RapierHeavy: Boolean(row.canMountWep_RapierHeavy),
      canMountWep_AxeNormal: Boolean(row.canMountWep_AxeNormal),
      canMountWep_AxeLarge: Boolean(row.canMountWep_AxeLarge),
      canMountWep_HammerNormal: Boolean(row.canMountWep_HammerNormal),
      canMountWep_HammerLarge: Boolean(row.canMountWep_HammerLarge),
      canMountWep_Flail: Boolean(row.canMountWep_Flail),
      canMountWep_SpearNormal: Boolean(row.canMountWep_SpearNormal),
      canMountWep_SpearLarge: Boolean(row.canMountWep_SpearLarge),
      canMountWep_SpearHeavy: Boolean(row.canMountWep_SpearHeavy),
      canMountWep_SpearAxe: Boolean(row.canMountWep_SpearAxe),
      canMountWep_Sickle: Boolean(row.canMountWep_Sickle),
      canMountWep_Knuckle: Boolean(row.canMountWep_Knuckle),
      canMountWep_Claw: Boolean(row.canMountWep_Claw),
      canMountWep_Whip: Boolean(row.canMountWep_Whip),
      canMountWep_AxhammerLarge: Boolean(row.canMountWep_AxhammerLarge),
      canMountWep_BowSmall: Boolean(row.canMountWep_BowSmall),
      canMountWep_BowNormal: Boolean(row.canMountWep_BowNormal),
      canMountWep_BowLarge: Boolean(row.canMountWep_BowLarge),
      canMountWep_ClossBow: Boolean(row.canMountWep_ClossBow),
      canMountWep_Ballista: Boolean(row.canMountWep_Ballista),
      canMountWep_Staff: Boolean(row.canMountWep_Staff),
      canMountWep_Sorcery: Boolean(row.canMountWep_Sorcery),
      canMountWep_Talisman: Boolean(row.canMountWep_Talisman),
      canMountWep_ShieldSmall: Boolean(row.canMountWep_ShieldSmall),
      canMountWep_ShieldNormal: Boolean(row.canMountWep_ShieldNormal),
      canMountWep_ShieldLarge: Boolean(row.canMountWep_ShieldLarge),
      canMountWep_Torch: Boolean(row.canMountWep_Torch),
      canMountWep_HandToHand: Boolean(row.canMountWep_HandToHand),
      canMountWep_PerfumeBottle: Boolean(row.canMountWep_PerfumeBottle),
      canMountWep_ThrustingShield: Boolean(row.canMountWep_ThrustingShield),
      canMountWep_ThrowingWeapon: Boolean(row.canMountWep_ThrowingWeapon),
      canMountWep_ReverseHandSword: Boolean(row.canMountWep_ReverseHandSword),
      canMountWep_LightGreatsword: Boolean(row.canMountWep_LightGreatsword),
      canMountWep_GreatKatana: Boolean(row.canMountWep_GreatKatana),
      canMountWep_BeastClaw: Boolean(row.canMountWep_BeastClaw),

      // Text ID for weapon restrictions
      mountWepTextId: (row.mountWepTextId as number) ?? -1,
    };

    entries.set(entry.id, entry);
  }

  return entries;
}

/**
 * Load and parse EquipParamGem.param.xml
 */
export function loadEquipParamGem(filePath: string): Map<number, EquipParamGemEntry> {
  const paramFile = loadParamFile(filePath);
  return parseEquipParamGem(paramFile);
}

// ============================================================================
// AoW Test Cases CSV Parser
// ============================================================================

/**
 * Parse AoW test case value to number or '-'
 */
function parseAowValue(value: string): number | '-' {
  if (value === '-' || value === '' || value === undefined) {
    return '-';
  }
  const num = parseFloat(value);
  return isNaN(num) ? '-' : num;
}

/**
 * Parse AoW test cases CSV content
 */
export function parseAowTestCasesCsv(csvContent: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header line (handle quoted values with commas)
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

/**
 * Load and parse AoW test cases CSV file
 */
export function loadAowTestCasesCsv(filePath: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const content = readFileSync(filePath, 'utf-8');
  return parseAowTestCasesCsv(content);
}

// ============================================================================
// Gem Data Parser
// ============================================================================

/**
 * Parse Gem Data TSV content
 */
export function parseGemDataTsv(tsvContent: string): import('./aowTypes.js').GemDataEntry[] {
  const lines = tsvContent.trim().split('\n');
  const entries: import('./aowTypes.js').GemDataEntry[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split('\t');
    if (cols.length < 2) continue;

    const name = cols[0]?.trim() || '';
    const canMountWep = cols[1]?.trim() || '';
    const defaultWepAttrStr = cols[3]?.trim();
    const infusion = cols[4]?.trim() || '';
    const equipParamGem = cols[5]?.trim() || '';
    // Column 7 (index 7) is varCategorySwordArt - the AoW that uses variants for this weapon class
    const varCategorySwordArt = cols[7]?.trim() || null;

    // Stat point bonus columns (indices 13-18)
    // changeAttributePoint (13): AoW name this bonus applies to
    // changeStrengthPoint (14), changeAgilityPoint (15), changeMagicPoint (16),
    // changeFaithPoint (17), changeLuckPoint (18)
    const changeAttributePoint = cols[13]?.trim() || null;
    const changeStrengthPoint = parseInt(cols[14]?.trim() || '0', 10) || 0;
    const changeAgilityPoint = parseInt(cols[15]?.trim() || '0', 10) || 0;
    const changeMagicPoint = parseInt(cols[16]?.trim() || '0', 10) || 0;
    const changeFaithPoint = parseInt(cols[17]?.trim() || '0', 10) || 0;
    const changeLuckPoint = parseInt(cols[18]?.trim() || '0', 10) || 0;

    const defaultWepAttr = defaultWepAttrStr && defaultWepAttrStr !== '' ? parseInt(defaultWepAttrStr, 10) : null;

    entries.push({
      name,
      canMountWep,
      defaultWepAttr: isNaN(defaultWepAttr as number) ? null : defaultWepAttr,
      infusion,
      equipParamGem,
      varCategorySwordArt,
      changeAttributePoint,
      changeStrengthPoint,
      changeAgilityPoint,
      changeMagicPoint,
      changeFaithPoint,
      changeLuckPoint,
    });
  }

  return entries;
}

/**
 * Load and parse Gem Data TSV file
 */
export function loadGemDataTsv(filePath: string): import('./aowTypes.js').GemDataEntry[] {
  const content = readFileSync(filePath, 'utf-8');
  return parseGemDataTsv(content);
}
