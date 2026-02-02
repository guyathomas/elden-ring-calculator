/**
 * Parser for Elden Ring param XML files
 * These files are exported from the game using tools like WitchyBND
 */

import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';

// ============================================================================
// Generic XML Param Parser
// ============================================================================

export interface ParamRow {
  id: number;
  [key: string]: string | number;
}

export interface ParamFile {
  filename: string;
  type: string;
  rows: ParamRow[];
}

/**
 * Field definition from the XML schema
 */
interface FieldDefinition {
  name: string;
  type: string;
  defaultValue: string;
}

/**
 * Parse a default value string based on field type
 */
function parseDefaultValue(value: string, type: string): string | number {
  // Handle array defaults like "[0|0|0]" - skip these
  if (value.startsWith('[')) {
    return 0;
  }

  // Numeric types
  if (type.startsWith('f32') || type.startsWith('f64')) {
    return parseFloat(value) || 0;
  }
  if (type.startsWith('s') || type.startsWith('u')) {
    return parseInt(value, 10) || 0;
  }

  return value;
}

/**
 * Parse field definitions from XML to build defaults map
 * Returns a Map of field name -> default value for O(1) lookups
 */
function parseFieldDefaults(fields: FieldDefinition[]): Map<string, string | number> {
  const defaults = new Map<string, string | number>();

  for (const field of fields) {
    if (field.name && field.defaultValue !== undefined) {
      defaults.set(field.name, parseDefaultValue(field.defaultValue, field.type));
    }
  }

  return defaults;
}

/**
 * Convert a raw row object's values to proper types (numbers where applicable)
 */
function convertRowValues(row: Record<string, string>): ParamRow {
  const result: ParamRow = { id: 0 };

  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string') {
      const numValue = parseFloat(value);
      result[key] = isNaN(numValue) ? value : numValue;
    } else {
      result[key] = value;
    }
  }

  return result;
}

// Shared XML parser instance - configured once, reused for all parsing
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  // Parse attribute values - keeps them as strings for consistent handling
  parseAttributeValue: false,
  // Allow boolean attributes
  allowBooleanAttributes: true,
  // Ensure arrays for consistent handling
  isArray: (name) => name === 'field' || name === 'row',
});

/**
 * Parse a param XML file into rows using fast-xml-parser
 * O(n) parse time, then O(1) field access per row
 */
export function parseParamXml(xmlContent: string): ParamFile {
  const parsed = xmlParser.parse(xmlContent);

  // Extract metadata
  const param = parsed.param;
  const filename = param?.filename ?? '';
  const type = param?.type ?? '';

  // Parse field defaults for O(1) lookup (currently not applying defaults
  // since rows in these files include all values, but structure is ready)
  const fieldDefs = param?.fields?.field ?? [];
  const _fieldDefaults = parseFieldDefaults(fieldDefs);

  // Parse rows - direct object access, no regex needed
  const rawRows = param?.rows?.row ?? [];
  const rows: ParamRow[] = rawRows.map((row: Record<string, string>) =>
    convertRowValues(row)
  );

  return { filename, type, rows };
}

/**
 * Load and parse a param XML file
 */
export function loadParamFile(filePath: string): ParamFile {
  const content = readFileSync(filePath, 'utf-8');
  return parseParamXml(content);
}

// ============================================================================
// CalcCorrectGraph Parser
// ============================================================================

/**
 * CalcCorrectGraph curve definition from param file
 * Uses piecewise linear interpolation between stage points
 */
export interface CalcCorrectGraphCurve {
  id: number;
  name?: string;
  // Stage breakpoints (stat values)
  stageMaxVal: [number, number, number, number, number];
  // Growth values at each stage
  stageMaxGrowVal: [number, number, number, number, number];
  // Adjustment points for curve shape
  adjPt_maxGrowVal: [number, number, number, number, number];
}

/**
 * Parse CalcCorrectGraph param file into curve definitions
 */
export function parseCalcCorrectGraph(paramFile: ParamFile): Map<number, CalcCorrectGraphCurve> {
  const curves = new Map<number, CalcCorrectGraphCurve>();

  for (const row of paramFile.rows) {
    const curve: CalcCorrectGraphCurve = {
      id: row.id as number,
      name: row.paramdexName as string | undefined,
      stageMaxVal: [
        row.stageMaxVal0 as number,
        row.stageMaxVal1 as number,
        row.stageMaxVal2 as number,
        row.stageMaxVal3 as number,
        row.stageMaxVal4 as number,
      ],
      stageMaxGrowVal: [
        row.stageMaxGrowVal0 as number,
        row.stageMaxGrowVal1 as number,
        row.stageMaxGrowVal2 as number,
        row.stageMaxGrowVal3 as number,
        row.stageMaxGrowVal4 as number,
      ],
      adjPt_maxGrowVal: [
        row.adjPt_maxGrowVal0 as number,
        row.adjPt_maxGrowVal1 as number,
        row.adjPt_maxGrowVal2 as number,
        row.adjPt_maxGrowVal3 as number,
        row.adjPt_maxGrowVal4 as number,
      ],
    };
    curves.set(curve.id, curve);
  }

  return curves;
}

/**
 * Calculate the correction value for a given stat level using CalcCorrectGraph curve
 * This implements the piecewise power interpolation used by Elden Ring
 * Based on: https://github.com/kingborehaha/CalcCorrectGraph-Calculation-Tool
 *
 * @param curve - The CalcCorrectGraph curve definition
 * @param statLevel - The player's stat level
 * @returns Correction value (0-100+ range, where higher = more scaling)
 */
export function calculateCurveValue(curve: CalcCorrectGraphCurve, statLevel: number): number {
  const { stageMaxVal, stageMaxGrowVal, adjPt_maxGrowVal } = curve;

  // Find which segment the stat level falls into
  let segmentIndex = 0;
  for (let i = 0; i < 4; i++) {
    if (statLevel > stageMaxVal[i]) {
      segmentIndex = i + 1;
    }
  }

  // Clamp to valid segment
  segmentIndex = Math.min(segmentIndex, 4);

  // Get segment boundaries
  // Note: adjPt uses the index of the transition INTO this segment
  // i.e., for segment 2 (18-60), we use adjPt[1] which defines the curve leaving stage 1
  const minStatLevel = segmentIndex === 0 ? 0 : stageMaxVal[segmentIndex - 1];
  const maxStatLevel = stageMaxVal[segmentIndex];
  const minGrowVal = segmentIndex === 0 ? 0 : stageMaxGrowVal[segmentIndex - 1];
  const maxGrowVal = stageMaxGrowVal[segmentIndex];
  // Use previous segment's adjPt for the transition curve
  const adjPtIndex = segmentIndex === 0 ? 0 : segmentIndex - 1;
  const adjPt = adjPt_maxGrowVal[adjPtIndex];

  // If stat is at or below minimum, return minimum growth
  if (statLevel <= minStatLevel) {
    return minGrowVal;
  }

  // If stat is at or above maximum, return maximum growth
  if (statLevel >= maxStatLevel) {
    return maxGrowVal;
  }

  // Calculate progress through segment (0-1)
  const range = maxStatLevel - minStatLevel;
  const ratio = (statLevel - minStatLevel) / range;

  // Apply adjustment point for curve shape using power function
  // Formula from CalcCorrectGraph-Calculation-Tool:
  // - Positive adjPt: growthVal = ratio^adjPt (direct power)
  // - Negative adjPt: growthVal = 1 - (1-ratio)^|adjPt| (inverse power)
  let growthVal: number;
  if (adjPt > 0) {
    growthVal = Math.pow(ratio, adjPt);
  } else if (adjPt < 0) {
    growthVal = 1 - Math.pow(1 - ratio, Math.abs(adjPt));
  } else {
    // adjPt == 0: step function (jump to max at end)
    growthVal = 0;
  }

  // Interpolate between min and max growth values
  const growthRange = maxGrowVal - minGrowVal;
  return minGrowVal + growthRange * growthVal;
}

/**
 * Build a pre-computed lookup table for CalcCorrectGraph
 * This matches the CalcCorrectGraphEz table in the spreadsheet
 *
 * @param curves - Map of curve ID to curve definition
 * @param maxStatLevel - Maximum stat level to compute (default 150)
 * @returns 2D array [statLevel][graphId] = correction value
 */
export function buildCalcCorrectGraphTable(
  curves: Map<number, CalcCorrectGraphCurve>,
  maxStatLevel: number = 150
): number[][] {
  // Get all curve IDs sorted
  const curveIds = Array.from(curves.keys()).sort((a, b) => a - b);

  // Build lookup table
  const table: number[][] = [];

  for (let statLevel = 0; statLevel <= maxStatLevel; statLevel++) {
    const row: number[] = [];
    for (const curveId of curveIds) {
      const curve = curves.get(curveId)!;
      row.push(calculateCurveValue(curve, statLevel));
    }
    table.push(row);
  }

  return table;
}

/**
 * Create a mapping from curve ID to index in the table
 */
export function buildCurveIdToIndex(curves: Map<number, CalcCorrectGraphCurve>): Map<number, number> {
  const curveIds = Array.from(curves.keys()).sort((a, b) => a - b);
  const mapping = new Map<number, number>();
  curveIds.forEach((id, index) => mapping.set(id, index));
  return mapping;
}

// ============================================================================
// ReinforceParamWeapon Parser
// ============================================================================

export interface ReinforceParamWeaponRow {
  id: number;
  name?: string;
  // Attack rate modifiers
  physicsAtkRate: number;
  magicAtkRate: number;
  fireAtkRate: number;
  thunderAtkRate: number;
  darkAtkRate: number;
  staminaAtkRate: number;
  baseAtkRate: number;
  // Scaling rate modifiers
  correctStrengthRate: number;
  correctAgilityRate: number;
  correctMagicRate: number;
  correctFaithRate: number;
  correctLuckRate: number;
  // Guard rate modifiers
  physicsGuardCutRate: number;
  magicGuardCutRate: number;
  fireGuardCutRate: number;
  thunderGuardCutRate: number;
  darkGuardCutRate: number;
  staminaGuardDefRate: number;
  // Status effect modifiers
  poisonGuardResistRate: number;
  diseaseGuardResistRate: number;
  bloodGuardResistRate: number;
  freezeGuardDefRate: number;
  sleepGuardDefRate: number;
  madnessGuardDefRate: number;
  curseGuardResistRate: number;
  // SpEffect ID offsets for upgrade levels (added to spEffectBehaviorId)
  spEffectId1: number;  // Offset for spEffectBehaviorId0
  spEffectId2: number;  // Offset for spEffectBehaviorId1
  // Metadata
  maxReinforceLevel: number;
}

/**
 * Parse ReinforceParamWeapon param file
 */
export function parseReinforceParamWeapon(paramFile: ParamFile): Map<number, ReinforceParamWeaponRow> {
  const rows = new Map<number, ReinforceParamWeaponRow>();

  for (const row of paramFile.rows) {
    const parsed: ReinforceParamWeaponRow = {
      id: row.id as number,
      name: row.paramdexName as string | undefined,
      physicsAtkRate: (row.physicsAtkRate as number) ?? 1,
      magicAtkRate: (row.magicAtkRate as number) ?? 1,
      fireAtkRate: (row.fireAtkRate as number) ?? 1,
      thunderAtkRate: (row.thunderAtkRate as number) ?? 1,
      darkAtkRate: (row.darkAtkRate as number) ?? 1,
      staminaAtkRate: (row.staminaAtkRate as number) ?? 1,
      baseAtkRate: (row.baseAtkRate as number) ?? 1,
      correctStrengthRate: (row.correctStrengthRate as number) ?? 1,
      correctAgilityRate: (row.correctAgilityRate as number) ?? 1,
      correctMagicRate: (row.correctMagicRate as number) ?? 1,
      correctFaithRate: (row.correctFaithRate as number) ?? 1,
      correctLuckRate: (row.correctLuckRate as number) ?? 1,
      physicsGuardCutRate: (row.physicsGuardCutRate as number) ?? 1,
      magicGuardCutRate: (row.magicGuardCutRate as number) ?? 1,
      fireGuardCutRate: (row.fireGuardCutRate as number) ?? 1,
      thunderGuardCutRate: (row.thunderGuardCutRate as number) ?? 1,
      darkGuardCutRate: (row.darkGuardCutRate as number) ?? 1,
      staminaGuardDefRate: (row.staminaGuardDefRate as number) ?? 1,
      poisonGuardResistRate: (row.poisonGuardResistRate as number) ?? 1,
      diseaseGuardResistRate: (row.diseaseGuardResistRate as number) ?? 1,
      bloodGuardResistRate: (row.bloodGuardResistRate as number) ?? 1,
      freezeGuardDefRate: (row.freezeGuardDefRate as number) ?? 1,
      sleepGuardDefRate: (row.sleepGuardDefRate as number) ?? 1,
      madnessGuardDefRate: (row.madnessGuardDefRate as number) ?? 1,
      curseGuardResistRate: (row.curseGuardResistRate as number) ?? 1,
      spEffectId1: (row.spEffectId1 as number) ?? 0,
      spEffectId2: (row.spEffectId2 as number) ?? 0,
      maxReinforceLevel: (row.maxReinforceLevel as number) ?? 0,
    };
    rows.set(parsed.id, parsed);
  }

  return rows;
}

// ============================================================================
// Test Case CSV Parser
// ============================================================================

export interface TestCaseRow {
  // Inputs
  weaponClass: string;
  weapon: string;
  upgradeLevel: number;
  affinity: string;
  strength: number;
  dexterity: number;
  intelligence: number;
  faith: number;
  arcane: number;
  twoHanded: boolean;
  ignoreRequirements: boolean;
  // Outputs - Physical AP
  physicalAPBase: number | null;
  physicalAPScaling: number | null;
  physicalAPTotal: number | null;
  physicalAPRounded: number | null;
  // Outputs - Magic AP
  magicAPBase: number | null;
  magicAPScaling: number | null;
  magicAPTotal: number | null;
  magicAPRounded: number | null;
  // Outputs - Fire AP
  fireAPBase: number | null;
  fireAPScaling: number | null;
  fireAPTotal: number | null;
  fireAPRounded: number | null;
  // Outputs - Lightning AP
  lightningAPBase: number | null;
  lightningAPScaling: number | null;
  lightningAPTotal: number | null;
  lightningAPRounded: number | null;
  // Outputs - Holy AP
  holyAPBase: number | null;
  holyAPScaling: number | null;
  holyAPTotal: number | null;
  holyAPRounded: number | null;
  // Raw row for additional fields
  raw: Record<string, string>;
}

/**
 * Parse a value that might be a number, "-", or empty
 */
function parseNumericValue(value: string): number | null {
  if (!value || value.trim() === '' || value.trim() === '-' || value.trim().startsWith('-   ')) {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse a CSV line handling quoted fields (fields with internal commas)
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      values.push(value);
      value = '';
    } else {
      value += c;
    }
  }
  values.push(value);

  return values;
}

/**
 * Parse the test cases CSV file
 */
export function parseTestCasesCsv(csvContent: string): TestCaseRow[] {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: TestCaseRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};

    // Build raw record
    headers.forEach((header, idx) => {
      raw[header] = values[idx] ?? '';
    });

    const row: TestCaseRow = {
      // Inputs - support both old and new column names
      weaponClass: raw['Input_WeaponClass'] ?? raw['Weapon Class'] ?? '',
      weapon: raw['Input_WeaponName'] ?? raw['Weapon'] ?? '',
      upgradeLevel: parseInt(raw['Input_UpgradeLevel'] ?? raw['Upgrade Level'] ?? '0', 10),
      affinity: raw['Input_Affinity'] ?? raw['Affinity'] ?? 'Standard',
      strength: parseInt(raw['Input_Strength'] ?? raw['Strength'] ?? '10', 10),
      dexterity: parseInt(raw['Input_Dexterity'] ?? raw['Dexterity'] ?? '10', 10),
      intelligence: parseInt(raw['Input_Intelligence'] ?? raw['Intelligence'] ?? '10', 10),
      faith: parseInt(raw['Input_Faith'] ?? raw['Faith'] ?? '10', 10),
      arcane: parseInt(raw['Input_Arcane'] ?? raw['Arcane'] ?? '10', 10),
      twoHanded: (raw['Input_2h'] ?? raw['twoHanded'])?.toUpperCase() === 'TRUE',
      ignoreRequirements: (raw['Input_IgnoreReq'] ?? raw['Ignore Requirements'])?.toUpperCase() === 'TRUE',
      // Outputs - Physical AP (support both old AP/SP_ prefix and new names)
      physicalAPBase: parseNumericValue(raw['Physical_AP_Base'] ?? raw['AP/SP_Physical_AP_Base']),
      physicalAPScaling: parseNumericValue(raw['Physical_AP_Scaling_Total'] ?? raw['AP/SP_Physical_AP_Scaling']),
      physicalAPTotal: parseNumericValue(raw['Physical_AP_Total'] ?? raw['AP/SP_Physical_AP_Total']),
      physicalAPRounded: parseNumericValue(raw['Physical_AP_Rounded'] ?? raw['AP/SP_Physical_AP_Rounded']),
      // Outputs - Magic AP
      magicAPBase: parseNumericValue(raw['Magic_AP_Base'] ?? raw['AP/SP_Magic_AP_Base']),
      magicAPScaling: parseNumericValue(raw['Magic_AP_Scaling_Total'] ?? raw['AP/SP_Magic_AP_Scaling']),
      magicAPTotal: parseNumericValue(raw['Magic_AP_Total'] ?? raw['AP/SP_Magic_AP_Total']),
      magicAPRounded: parseNumericValue(raw['Magic_AP_Rounded'] ?? raw['AP/SP_Magic_AP_Rounded']),
      // Outputs - Fire AP
      fireAPBase: parseNumericValue(raw['Fire_AP_Base'] ?? raw['AP/SP_Fire_AP_Base']),
      fireAPScaling: parseNumericValue(raw['Fire_AP_Scaling_Total'] ?? raw['AP/SP_Fire_AP_Scaling']),
      fireAPTotal: parseNumericValue(raw['Fire_AP_Total'] ?? raw['AP/SP_Fire_AP_Total']),
      fireAPRounded: parseNumericValue(raw['Fire_AP_Rounded'] ?? raw['AP/SP_Fire_AP_Rounded']),
      // Outputs - Lightning AP
      lightningAPBase: parseNumericValue(raw['Lightning_AP_Base'] ?? raw['AP/SP_Lightning_AP_Base']),
      lightningAPScaling: parseNumericValue(raw['Lightning_AP_Scaling_Total'] ?? raw['AP/SP_Lightning_AP_Scaling']),
      lightningAPTotal: parseNumericValue(raw['Lightning_AP_Total'] ?? raw['AP/SP_Lightning_AP_Total']),
      lightningAPRounded: parseNumericValue(raw['Lightning_AP_Rounded'] ?? raw['AP/SP_Lightning_AP_Rounded']),
      // Outputs - Holy AP
      holyAPBase: parseNumericValue(raw['Holy_AP_Base'] ?? raw['AP/SP_Holy_AP_Base']),
      holyAPScaling: parseNumericValue(raw['Holy_AP_Scaling_Total'] ?? raw['AP/SP_Holy_AP_Scaling']),
      holyAPTotal: parseNumericValue(raw['Holy_AP_Total'] ?? raw['AP/SP_Holy_AP_Total']),
      holyAPRounded: parseNumericValue(raw['Holy_AP_Rounded'] ?? raw['AP/SP_Holy_AP_Rounded']),
      // Raw row
      raw,
    };

    rows.push(row);
  }

  return rows;
}

/**
 * Load and parse test cases CSV file
 */
export function loadTestCasesCsv(filePath: string): TestCaseRow[] {
  const content = readFileSync(filePath, 'utf-8');
  return parseTestCasesCsv(content);
}

// ============================================================================
// EquipParamWeapon Parser
// ============================================================================

/**
 * EquipParamWeapon row - weapon definition from game data
 * Contains base damage, scaling values, and CalcCorrectGraph curve IDs
 */
export interface EquipParamWeaponRow {
  id: number;
  name: string;

  // Base attack values
  attackBasePhysics: number;
  attackBaseMagic: number;
  attackBaseFire: number;
  attackBaseThunder: number; // Lightning
  attackBaseDark: number; // Holy
  attackBaseStamina: number;
  saWeaponDamage: number; // Poise damage (Super Armor weapon damage)

  // Scaling correction values (0-100 typically, higher = better scaling)
  correctStrength: number;
  correctAgility: number; // Dexterity
  correctMagic: number; // Intelligence
  correctFaith: number;
  correctLuck: number; // Arcane

  // CalcCorrectGraph curve IDs for each damage type
  // These determine the soft cap curve used for stat scaling
  correctType_Physics: number;
  correctType_Magic: number;
  correctType_Fire: number;
  correctType_Thunder: number;
  correctType_Dark: number; // Holy (uses attackElementCorrectId for lookup)

  // Status effect curve IDs
  correctType_Poison: number;
  correctType_Blood: number; // Bleed
  correctType_Sleep: number;
  correctType_Madness: number;

  // AttackElementCorrectId - determines which stats affect which damage types
  attackElementCorrectId: number;

  // Reinforcement type (determines upgrade path)
  reinforceTypeId: number;

  // Requirements
  properStrength: number;
  properAgility: number;
  properMagic: number;
  properFaith: number;
  properLuck: number;

  // Guard stats
  physGuardCutRate: number;
  magGuardCutRate: number;
  fireGuardCutRate: number;
  thunGuardCutRate: number;
  darkGuardCutRate: number;
  staminaGuardDef: number;
  poisonGuardResist: number;
  diseaseGuardResist: number;
  bloodGuardResist: number;
  freezeGuardResist: number;
  sleepGuardResist: number;
  madnessGuardResist: number;
  curseGuardResist: number;

  // SpEffect references for status effects
  // spEffectBehaviorId0/1 reference SpEffectParam for base status values
  spEffectBehaviorId0: number;
  spEffectBehaviorId1: number;

  // Weapon properties
  isDualBlade: boolean;
  isEnhance: boolean; // Can be buffed with greases/spells (1 = can be buffed, 0 = cannot)
  weaponCategory: number;
  wepmotionCategory: number; // Animation set category - maps to a0XX animation sections
  wepType: number; // Actual weapon type ID for display purposes
  throwAtkRate: number; // Critical attack bonus (0 = base 100, 30 = 130 crit value, etc.)

  // Catalyst properties
  enableMagic: boolean;   // Can cast sorceries (staffs)
  enableMiracle: boolean; // Can cast incantations (seals)
  enableGuard: boolean;   // Can block/guard with this weapon

  // Attack attributes (for AoW damage type resolution)
  atkAttribute: number;   // Primary attack type
  atkAttribute2: number;  // Secondary attack type
  spAtkAttribute: number;

  // Attack type flags (used for atkAttribute=253 resolution)
  // These indicate which physical damage types the weapon can deal
  isNormalAttackType: boolean;  // Can deal Standard damage
  isSlashAttackType: boolean;   // Can deal Slash damage
  isBlowAttackType: boolean;    // Can deal Strike damage
  isThrustAttackType: boolean;  // Can deal Pierce damage

  // AoW-related properties
  gemMountType: number;     // 0/1 = unique weapon, 2 = can mount AoWs
  swordArtsParamId: number; // Weapon skill ID (references SwordArtsParam)

  // Weight (for equip load calculations)
  weight: number;
}

/**
 * Parse EquipParamWeapon param file
 */
export function parseEquipParamWeapon(paramFile: ParamFile): Map<number, EquipParamWeaponRow> {
  const weapons = new Map<number, EquipParamWeaponRow>();

  for (const row of paramFile.rows) {
    const weapon: EquipParamWeaponRow = {
      id: row.id as number,
      name: (row.paramdexName as string) ?? `Weapon_${row.id}`,

      // Base attack values
      attackBasePhysics: (row.attackBasePhysics as number) ?? 0,
      attackBaseMagic: (row.attackBaseMagic as number) ?? 0,
      attackBaseFire: (row.attackBaseFire as number) ?? 0,
      attackBaseThunder: (row.attackBaseThunder as number) ?? 0,
      attackBaseDark: (row.attackBaseDark as number) ?? 0,
      attackBaseStamina: (row.attackBaseStamina as number) ?? 0,
      saWeaponDamage: (row.saWeaponDamage as number) ?? 0,

      // Scaling values
      correctStrength: (row.correctStrength as number) ?? 0,
      correctAgility: (row.correctAgility as number) ?? 0,
      correctMagic: (row.correctMagic as number) ?? 0,
      correctFaith: (row.correctFaith as number) ?? 0,
      correctLuck: (row.correctLuck as number) ?? 0,

      // CalcCorrectGraph curve IDs
      correctType_Physics: (row.correctType_Physics as number) ?? 0,
      correctType_Magic: (row.correctType_Magic as number) ?? 0,
      correctType_Fire: (row.correctType_Fire as number) ?? 0,
      correctType_Thunder: (row.correctType_Thunder as number) ?? 0,
      correctType_Dark: (row.correctType_Dark as number) ?? 0,

      // Status effect curve IDs
      correctType_Poison: (row.correctType_Poison as number) ?? 0,
      correctType_Blood: (row.correctType_Blood as number) ?? 0,
      correctType_Sleep: (row.correctType_Sleep as number) ?? 0,
      correctType_Madness: (row.correctType_Madness as number) ?? 0,

      // AttackElementCorrectId
      attackElementCorrectId: (row.attackElementCorrectId as number) ?? 0,

      // Reinforcement type
      reinforceTypeId: (row.reinforceTypeId as number) ?? 0,

      // Requirements
      properStrength: (row.properStrength as number) ?? 0,
      properAgility: (row.properAgility as number) ?? 0,
      properMagic: (row.properMagic as number) ?? 0,
      properFaith: (row.properFaith as number) ?? 0,
      properLuck: (row.properLuck as number) ?? 0,

      // Guard stats
      physGuardCutRate: (row.physGuardCutRate as number) ?? 0,
      magGuardCutRate: (row.magGuardCutRate as number) ?? 0,
      fireGuardCutRate: (row.fireGuardCutRate as number) ?? 0,
      thunGuardCutRate: (row.thunGuardCutRate as number) ?? 0,
      darkGuardCutRate: (row.darkGuardCutRate as number) ?? 0,
      staminaGuardDef: (row.staminaGuardDef as number) ?? 0,
      poisonGuardResist: (row.poisonGuardResist as number) ?? 0,
      diseaseGuardResist: (row.diseaseGuardResist as number) ?? 0,
      bloodGuardResist: (row.bloodGuardResist as number) ?? 0,
      freezeGuardResist: (row.freezeGuardResist as number) ?? 0,
      sleepGuardResist: (row.sleepGuardResist as number) ?? 0,
      madnessGuardResist: (row.madnessGuardResist as number) ?? 0,
      curseGuardResist: (row.curseGuardResist as number) ?? 0,

      // SpEffect references for status effects
      spEffectBehaviorId0: (row.spEffectBehaviorId0 as number) ?? -1,
      spEffectBehaviorId1: (row.spEffectBehaviorId1 as number) ?? -1,

      // Weapon properties
      isDualBlade: row.isDualBlade === 1,
      isEnhance: row.isEnhance === 1,
      weaponCategory: (row.weaponCategory as number) ?? 0,
      wepmotionCategory: (row.wepmotionCategory as number) ?? 0,
      wepType: (row.wepType as number) ?? 0,
      throwAtkRate: (row.throwAtkRate as number) ?? 0,

      // Catalyst properties
      enableMagic: row.enableMagic === 1,
      enableMiracle: row.enableMiracle === 1,
      enableGuard: row.enableGuard === 1,

      // Attack attributes
      atkAttribute: (row.atkAttribute as number) ?? 0,
      atkAttribute2: (row.atkAttribute2 as number) ?? 0,
      spAtkAttribute: (row.spAtkAttribute as number) ?? 0,

      // Attack type flags (for atkAttribute=253 resolution)
      isNormalAttackType: row.isNormalAttackType === 1,
      isSlashAttackType: row.isSlashAttackType === 1,
      isBlowAttackType: row.isBlowAttackType === 1,
      isThrustAttackType: row.isThrustAttackType === 1,

      // AoW-related properties
      // Default is 2 (can mount AoWs) per XML schema; 0/1 = unique weapon
      gemMountType: (row.gemMountType as number) ?? 2,
      swordArtsParamId: (row.swordArtsParamId as number) ?? 0,

      // Weight (for equip load calculations)
      weight: (row.weight as number) ?? 0,
    };
    weapons.set(weapon.id, weapon);
  }

  return weapons;
}

/**
 * Build a lookup map from weapon name to weapon data
 * Handles affinity variants (Standard, Heavy, Keen, etc.)
 */
export function buildWeaponNameLookup(
  weapons: Map<number, EquipParamWeaponRow>
): Map<string, EquipParamWeaponRow> {
  const nameMap = new Map<string, EquipParamWeaponRow>();

  for (const weapon of weapons.values()) {
    // Skip disabled weapons (no name)
    if (!weapon.name || weapon.name.startsWith('Weapon_')) continue;

    // Use weapon name + affinity as key
    const key = weapon.name;
    nameMap.set(key, weapon);
  }

  return nameMap;
}

// ============================================================================
// AttackElementCorrectParam Parser
// ============================================================================

/**
 * AttackElementCorrectParam row - determines which stats affect which damage types
 * Each row defines a correction pattern (which stats scale which damage types)
 */
export interface AttackElementCorrectRow {
  id: number;
  // Physical damage - which stats affect it (1 = yes, 0 = no)
  isStrengthCorrect_byPhysics: boolean;
  isDexterityCorrect_byPhysics: boolean;
  isMagicCorrect_byPhysics: boolean;
  isFaithCorrect_byPhysics: boolean;
  isLuckCorrect_byPhysics: boolean;

  // Magic damage
  isStrengthCorrect_byMagic: boolean;
  isDexterityCorrect_byMagic: boolean;
  isMagicCorrect_byMagic: boolean;
  isFaithCorrect_byMagic: boolean;
  isLuckCorrect_byMagic: boolean;

  // Fire damage
  isStrengthCorrect_byFire: boolean;
  isDexterityCorrect_byFire: boolean;
  isMagicCorrect_byFire: boolean;
  isFaithCorrect_byFire: boolean;
  isLuckCorrect_byFire: boolean;

  // Lightning damage
  isStrengthCorrect_byThunder: boolean;
  isDexterityCorrect_byThunder: boolean;
  isMagicCorrect_byThunder: boolean;
  isFaithCorrect_byThunder: boolean;
  isLuckCorrect_byThunder: boolean;

  // Holy damage
  isStrengthCorrect_byDark: boolean;
  isDexterityCorrect_byDark: boolean;
  isMagicCorrect_byDark: boolean;
  isFaithCorrect_byDark: boolean;
  isLuckCorrect_byDark: boolean;

  // Override curve IDs for specific stat/damage type combinations
  // -1 means use the weapon's default correctType
  overwriteStrengthCorrectRate_byPhysics: number;
  overwriteDexterityCorrectRate_byPhysics: number;
  overwriteMagicCorrectRate_byPhysics: number;
  overwriteFaithCorrectRate_byPhysics: number;
  overwriteLuckCorrectRate_byPhysics: number;

  overwriteStrengthCorrectRate_byMagic: number;
  overwriteDexterityCorrectRate_byMagic: number;
  overwriteMagicCorrectRate_byMagic: number;
  overwriteFaithCorrectRate_byMagic: number;
  overwriteLuckCorrectRate_byMagic: number;

  overwriteStrengthCorrectRate_byFire: number;
  overwriteDexterityCorrectRate_byFire: number;
  overwriteMagicCorrectRate_byFire: number;
  overwriteFaithCorrectRate_byFire: number;
  overwriteLuckCorrectRate_byFire: number;

  overwriteStrengthCorrectRate_byThunder: number;
  overwriteDexterityCorrectRate_byThunder: number;
  overwriteMagicCorrectRate_byThunder: number;
  overwriteFaithCorrectRate_byThunder: number;
  overwriteLuckCorrectRate_byThunder: number;

  overwriteStrengthCorrectRate_byDark: number;
  overwriteDexterityCorrectRate_byDark: number;
  overwriteMagicCorrectRate_byDark: number;
  overwriteFaithCorrectRate_byDark: number;
  overwriteLuckCorrectRate_byDark: number;
}

/**
 * Parse AttackElementCorrectParam param file
 */
export function parseAttackElementCorrect(paramFile: ParamFile): Map<number, AttackElementCorrectRow> {
  const rows = new Map<number, AttackElementCorrectRow>();

  for (const row of paramFile.rows) {
    const parsed: AttackElementCorrectRow = {
      id: row.id as number,

      // Physical
      isStrengthCorrect_byPhysics: row.isStrengthCorrect_byPhysics === 1,
      isDexterityCorrect_byPhysics: row.isDexterityCorrect_byPhysics === 1,
      isMagicCorrect_byPhysics: row.isMagicCorrect_byPhysics === 1,
      isFaithCorrect_byPhysics: row.isFaithCorrect_byPhysics === 1,
      isLuckCorrect_byPhysics: row.isLuckCorrect_byPhysics === 1,

      // Magic
      isStrengthCorrect_byMagic: row.isStrengthCorrect_byMagic === 1,
      isDexterityCorrect_byMagic: row.isDexterityCorrect_byMagic === 1,
      isMagicCorrect_byMagic: row.isMagicCorrect_byMagic === 1,
      isFaithCorrect_byMagic: row.isFaithCorrect_byMagic === 1,
      isLuckCorrect_byMagic: row.isLuckCorrect_byMagic === 1,

      // Fire
      isStrengthCorrect_byFire: row.isStrengthCorrect_byFire === 1,
      isDexterityCorrect_byFire: row.isDexterityCorrect_byFire === 1,
      isMagicCorrect_byFire: row.isMagicCorrect_byFire === 1,
      isFaithCorrect_byFire: row.isFaithCorrect_byFire === 1,
      isLuckCorrect_byFire: row.isLuckCorrect_byFire === 1,

      // Lightning
      isStrengthCorrect_byThunder: row.isStrengthCorrect_byThunder === 1,
      isDexterityCorrect_byThunder: row.isDexterityCorrect_byThunder === 1,
      isMagicCorrect_byThunder: row.isMagicCorrect_byThunder === 1,
      isFaithCorrect_byThunder: row.isFaithCorrect_byThunder === 1,
      isLuckCorrect_byThunder: row.isLuckCorrect_byThunder === 1,

      // Holy
      isStrengthCorrect_byDark: row.isStrengthCorrect_byDark === 1,
      isDexterityCorrect_byDark: row.isDexterityCorrect_byDark === 1,
      isMagicCorrect_byDark: row.isMagicCorrect_byDark === 1,
      isFaithCorrect_byDark: row.isFaithCorrect_byDark === 1,
      isLuckCorrect_byDark: row.isLuckCorrect_byDark === 1,

      // Overwrite rates - Physical
      overwriteStrengthCorrectRate_byPhysics: (row.overwriteStrengthCorrectRate_byPhysics as number) ?? -1,
      overwriteDexterityCorrectRate_byPhysics: (row.overwriteDexterityCorrectRate_byPhysics as number) ?? -1,
      overwriteMagicCorrectRate_byPhysics: (row.overwriteMagicCorrectRate_byPhysics as number) ?? -1,
      overwriteFaithCorrectRate_byPhysics: (row.overwriteFaithCorrectRate_byPhysics as number) ?? -1,
      overwriteLuckCorrectRate_byPhysics: (row.overwriteLuckCorrectRate_byPhysics as number) ?? -1,

      // Overwrite rates - Magic
      overwriteStrengthCorrectRate_byMagic: (row.overwriteStrengthCorrectRate_byMagic as number) ?? -1,
      overwriteDexterityCorrectRate_byMagic: (row.overwriteDexterityCorrectRate_byMagic as number) ?? -1,
      overwriteMagicCorrectRate_byMagic: (row.overwriteMagicCorrectRate_byMagic as number) ?? -1,
      overwriteFaithCorrectRate_byMagic: (row.overwriteFaithCorrectRate_byMagic as number) ?? -1,
      overwriteLuckCorrectRate_byMagic: (row.overwriteLuckCorrectRate_byMagic as number) ?? -1,

      // Overwrite rates - Fire
      overwriteStrengthCorrectRate_byFire: (row.overwriteStrengthCorrectRate_byFire as number) ?? -1,
      overwriteDexterityCorrectRate_byFire: (row.overwriteDexterityCorrectRate_byFire as number) ?? -1,
      overwriteMagicCorrectRate_byFire: (row.overwriteMagicCorrectRate_byFire as number) ?? -1,
      overwriteFaithCorrectRate_byFire: (row.overwriteFaithCorrectRate_byFire as number) ?? -1,
      overwriteLuckCorrectRate_byFire: (row.overwriteLuckCorrectRate_byFire as number) ?? -1,

      // Overwrite rates - Lightning
      overwriteStrengthCorrectRate_byThunder: (row.overwriteStrengthCorrectRate_byThunder as number) ?? -1,
      overwriteDexterityCorrectRate_byThunder: (row.overwriteDexterityCorrectRate_byThunder as number) ?? -1,
      overwriteMagicCorrectRate_byThunder: (row.overwriteMagicCorrectRate_byThunder as number) ?? -1,
      overwriteFaithCorrectRate_byThunder: (row.overwriteFaithCorrectRate_byThunder as number) ?? -1,
      overwriteLuckCorrectRate_byThunder: (row.overwriteLuckCorrectRate_byThunder as number) ?? -1,

      // Overwrite rates - Holy
      overwriteStrengthCorrectRate_byDark: (row.overwriteStrengthCorrectRate_byDark as number) ?? -1,
      overwriteDexterityCorrectRate_byDark: (row.overwriteDexterityCorrectRate_byDark as number) ?? -1,
      overwriteMagicCorrectRate_byDark: (row.overwriteMagicCorrectRate_byDark as number) ?? -1,
      overwriteFaithCorrectRate_byDark: (row.overwriteFaithCorrectRate_byDark as number) ?? -1,
      overwriteLuckCorrectRate_byDark: (row.overwriteLuckCorrectRate_byDark as number) ?? -1,
    };
    rows.set(parsed.id, parsed);
  }

  return rows;
}

// ============================================================================
// SpEffectParam Parser (Status Effect Values)
// ============================================================================

/**
 * SpEffectParam row - status effect definitions
 * Contains base status values (poison, bleed, frost, sleep, madness, scarlet rot)
 */
export interface SpEffectParamRow {
  id: number;
  // Status effect attack power values
  poizonAttackPower: number;   // Poison
  diseaseAttackPower: number;  // Scarlet Rot
  bloodAttackPower: number;    // Bleed
  freezeAttackPower: number;   // Frost
  sleepAttackPower: number;    // Sleep
  madnessAttackPower: number;  // Madness
}

/**
 * Parse SpEffectParam param file
 * Only extracts status effect values - other fields ignored
 */
export function parseSpEffectParam(paramFile: ParamFile): Map<number, SpEffectParamRow> {
  const rows = new Map<number, SpEffectParamRow>();

  for (const row of paramFile.rows) {
    // Only include rows that have at least one status effect value
    const poizonAttackPower = (row.poizonAttackPower as number) ?? 0;
    const diseaseAttackPower = (row.diseaseAttackPower as number) ?? 0;
    const bloodAttackPower = (row.bloodAttackPower as number) ?? 0;
    const freezeAttackPower = (row.freezeAttackPower as number) ?? 0;
    const sleepAttackPower = (row.sleepAttackPower as number) ?? 0;
    const madnessAttackPower = (row.madnessAttackPower as number) ?? 0;

    // Skip rows with no status effects or negative values (which indicate removal)
    const hasPositiveStatusEffect =
      poizonAttackPower > 0 ||
      diseaseAttackPower > 0 ||
      bloodAttackPower > 0 ||
      freezeAttackPower > 0 ||
      sleepAttackPower > 0 ||
      madnessAttackPower > 0;

    if (!hasPositiveStatusEffect) continue;

    const parsed: SpEffectParamRow = {
      id: row.id as number,
      poizonAttackPower,
      diseaseAttackPower,
      bloodAttackPower,
      freezeAttackPower,
      sleepAttackPower,
      madnessAttackPower,
    };
    rows.set(parsed.id, parsed);
  }

  return rows;
}
