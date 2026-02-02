/**
 * Build precomputed AoW data from param files and curated data
 *
 * This combines:
 * - AtkParam_Pc.param.xml - Attack motion values and flat damage
 * - FinalDamageRateParam.param.xml - PvP multipliers
 * - AttackElementCorrectParam.param.xml - Stat scaling for bullet attacks
 * - Curated AoW attack data (loaded from data/aow-atk-data.tsv)
 */

import { join, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  loadAtkParamPc,
  loadFinalDamageRateParam,
  loadAttackElementCorrectParam,
  loadEquipParamGem,
  loadGemDataTsv,
  loadSwordArtsParam,
} from './aowParamParser.js';
import type {
  PrecomputedAowData,
  PrecomputedAow,
  PrecomputedAowAttack,
  AowAtkDataEntry,
  AttackElementCorrectEntry,
  FinalDamageRateEntry,
  AtkParamEntry,
  EquipParamGemEntry,
} from './aowTypes.js';

// ============================================================================
// Curated AoW Attack Data Loading
// ============================================================================

/**
 * Parse the curated AoW attack data TSV file
 */
function loadAowAtkDataTsv(filePath: string): AowAtkDataEntry[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  // Skip header line
  const entries: AowAtkDataEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const [atkIdStr, name, swordArtsParamIdStr] = line.split('\t');
    const atkId = parseInt(atkIdStr, 10);
    const swordArtsParamId = parseInt(swordArtsParamIdStr, 10);

    if (isNaN(atkId) || isNaN(swordArtsParamId)) continue;

    entries.push({
      atkId,
      name: name || '',
      swordArtsParamId,
      // isBullet and isAddBaseAtk will be determined from AtkParam data
      isBullet: false,
      isAddBaseAtk: false,
    });
  }

  return entries;
}

/**
 * Get the path to the data directory
 */
function getDataDir(): string {
  // Handle both ESM and CJS module systems
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return join(__dirname, '..', 'data');
  } catch {
    // Fallback for CJS
    return join(__dirname, '..', 'data');
  }
}

// Load curated data from CSV file
let _aowAtkData: AowAtkDataEntry[] | null = null;

/**
 * Get the curated AoW attack data (lazy loaded)
 */
export function getAowAtkData(): AowAtkDataEntry[] {
  if (_aowAtkData === null) {
    const dataPath = join(getDataDir(), 'aow-atk-data.tsv');
    _aowAtkData = loadAowAtkDataTsv(dataPath);
  }
  return _aowAtkData;
}

/**
 * Build the SWORD_ARTS_MAP from curated data
 * Maps sword art names to their IDs
 */
function buildSwordArtsMap(entries: AowAtkDataEntry[]): Record<string, number> {
  const map: Record<string, number> = {};

  for (const entry of entries) {
    // Extract base name from attack name
    // e.g., "Lion's Claw" from "Lion's Claw (Lacking FP)"
    // e.g., "Stamp (Upward Cut)" from "Stamp (Upward Cut)"
    // e.g., "Wild Strikes" from "Wild Strikes - Loop [1]"
    // e.g., "War Cry" from "[Greatsword] War Cry 1h R2 #1"

    let baseName = entry.name;

    // Remove weapon class prefix like "[Greatsword] "
    baseName = baseName.replace(/^\[[^\]]+\]\s*/, '');

    // Remove "(Lacking FP)" suffix
    baseName = baseName.replace(/\s*\(Lacking FP\)\s*$/, '');

    // Remove numbered suffixes like " [1]", " #1", " - Loop", etc.
    baseName = baseName.replace(/\s*(?:\[[\d]+\]|#\d+|\s*-\s*.+)$/, '');

    // Remove R1/R2 suffixes
    baseName = baseName.replace(/\s*(?:R[12]|1h|2h|Charged).*$/, '');

    baseName = baseName.trim();

    if (baseName && !map[baseName]) {
      map[baseName] = entry.swordArtsParamId;
    }
  }

  return map;
}

// Export the SWORD_ARTS_MAP (built from curated data)
let _swordArtsMap: Record<string, number> | null = null;

export function getSwordArtsMap(): Record<string, number> {
  if (_swordArtsMap === null) {
    _swordArtsMap = buildSwordArtsMap(getAowAtkData());
  }
  return _swordArtsMap;
}

// Load EquipParamGem data (lazy loaded)
let _equipParamGem: Map<number, EquipParamGemEntry> | null = null;

/**
 * Get EquipParamGem data (lazy loaded)
 */
export function getEquipParamGem(): Map<number, EquipParamGemEntry> {
  if (_equipParamGem === null) {
    const dataPath = join(getDataDir(), '..', 'param-files', 'EquipParamGem.param.xml');
    _equipParamGem = loadEquipParamGem(dataPath);
  }
  return _equipParamGem;
}

// For backwards compatibility, export as a constant (lazy initialized)
export const SWORD_ARTS_MAP: Record<string, number> = new Proxy({} as Record<string, number>, {
  get(_, prop) {
    return getSwordArtsMap()[prop as string];
  },
  has(_, prop) {
    return prop in getSwordArtsMap();
  },
  ownKeys() {
    return Object.keys(getSwordArtsMap());
  },
  getOwnPropertyDescriptor(_, prop) {
    const map = getSwordArtsMap();
    if (prop in map) {
      return { enumerable: true, configurable: true, value: map[prop as string] };
    }
    return undefined;
  },
});

// Also export AOW_ATK_DATA for backwards compatibility
export const AOW_ATK_DATA: AowAtkDataEntry[] = new Proxy([] as AowAtkDataEntry[], {
  get(_, prop) {
    const data = getAowAtkData();
    if (prop === 'length') return data.length;
    if (typeof prop === 'string' && !isNaN(parseInt(prop))) {
      return data[parseInt(prop)];
    }
    if (prop === Symbol.iterator) {
      return data[Symbol.iterator].bind(data);
    }
    return (data as any)[prop];
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract weapon class from attack name
 * e.g., "[Dagger] Spinning Slash #1" -> "Dagger"
 * e.g., "Lion's Claw" -> null
 */
function extractWeaponClass(attackName: string): string | null {
  const match = attackName.match(/^\[([^\]]+)\]/);
  return match ? match[1] : null;
}

// ============================================================================
// Build Functions
// ============================================================================

/**
 * Build precomputed AoW attack from param data
 */
function buildPrecomputedAowAttack(
  atkId: number,
  name: string,
  atkParams: Map<number, AtkParamEntry>,
  finalDamageRates: Map<number, FinalDamageRateEntry>
): PrecomputedAowAttack | null {
  const atk = atkParams.get(atkId);
  if (!atk) return null;

  // Get PvP multiplier from FinalDamageRateParam
  const finalDamageRate = finalDamageRates.get(atk.finalDamageRateId);
  const pvpMultiplier = finalDamageRate?.physRate ?? 0.8; // Default for AoW is 0.8 (ID 10000)

  // Extract weapon class from name
  const weaponClass = extractWeaponClass(name);

  return {
    atkId,
    name,
    weaponClass,

    // Motion values (divide by 100 to get multiplier)
    motionPhys: atk.atkPhysCorrection / 100,
    motionMag: atk.atkMagCorrection / 100,
    motionFire: atk.atkFireCorrection / 100,
    motionThun: atk.atkThunCorrection / 100,
    motionDark: atk.atkDarkCorrection / 100,
    motionStam: atk.atkStamCorrection / 100,
    motionPoise: atk.atkSuperArmorCorrection / 100,

    // Flat damage
    flatPhys: atk.atkPhys,
    flatMag: atk.atkMag,
    flatFire: atk.atkFire,
    flatThun: atk.atkThun,
    flatDark: atk.atkDark,
    flatStam: atk.atkStam,
    flatPoise: atk.atkSuperArmor,

    // Attack properties
    atkAttribute: atk.atkAttribute,
    guardCutCancelRate: atk.guardCutCancelRate,
    isAddBaseAtk: atk.isAddBaseAtk,
    overwriteAttackElementCorrectId: atk.overwriteAttackElementCorrectId,
    isDisableBothHandsAtkBonus: atk.isDisableBothHandsAtkBonus,

    pvpMultiplier,
  };
}

/**
 * Get the canonical sword art name from a curated attack entry name
 */
function getSwordArtName(attackName: string, swordArtsMap: Record<string, number>, swordArtsId: number): string {
  // First, try to find an exact match in the map with this ID
  for (const [name, id] of Object.entries(swordArtsMap)) {
    if (id === swordArtsId) {
      return name;
    }
  }

  // Fallback: extract base name from attack name
  let baseName = attackName;
  baseName = baseName.replace(/^\[[^\]]+\]\s*/, ''); // Remove weapon class prefix
  baseName = baseName.replace(/\s*\(Lacking FP\)\s*$/, ''); // Remove Lacking FP
  baseName = baseName.replace(/\s*(?:\[[\d]+\]|#\d+|\s*-\s*.+)$/, ''); // Remove suffixes
  baseName = baseName.replace(/\s*(?:R[12]|1h|2h|Charged).*$/, ''); // Remove R1/R2

  return baseName.trim() || attackName;
}

/**
 * Build precomputed AoW data from param files
 */
export function buildPrecomputedAowData(
  paramFilesDir: string
): PrecomputedAowData {
  // Load param files
  const atkParams = loadAtkParamPc(join(paramFilesDir, 'AtkParam_Pc.param.xml'));
  const finalDamageRates = loadFinalDamageRateParam(join(paramFilesDir, 'FinalDamageRateParam.param.xml'));
  const attackElementCorrect = loadAttackElementCorrectParam(join(paramFilesDir, 'AttackElementCorrectParam.param.xml'));
  const equipParamGem = loadEquipParamGem(join(paramFilesDir, 'EquipParamGem.param.xml'));

  // Get curated data
  const aowAtkData = getAowAtkData();
  const swordArtsMap = getSwordArtsMap();

  // Build attacks map and sword arts from curated data ONLY
  const attacks: Record<number, PrecomputedAowAttack> = {};
  const swordArts: Record<number, PrecomputedAow> = {};
  const swordArtsByName: Record<string, number> = {};

  // Process curated data to build sword arts
  for (const entry of aowAtkData) {
    const attack = buildPrecomputedAowAttack(entry.atkId, entry.name, atkParams, finalDamageRates);
    if (!attack) continue;

    // Store attack
    attacks[entry.atkId] = attack;

    // Create sword art entry if needed
    if (!swordArts[entry.swordArtsParamId]) {
      const swordArtName = getSwordArtName(entry.name, swordArtsMap, entry.swordArtsParamId);

      swordArts[entry.swordArtsParamId] = {
        swordArtsId: entry.swordArtsParamId,
        name: swordArtName,
        attacks: [],
      };

      if (swordArtName) {
        swordArtsByName[swordArtName] = entry.swordArtsParamId;
      }
    }

    swordArts[entry.swordArtsParamId].attacks.push(attack);
  }

  // Convert attackElementCorrect map to record
  const aecRecord: Record<number, AttackElementCorrectEntry> = {};
  for (const [id, entry] of attackElementCorrect) {
    aecRecord[id] = entry;
  }

  // Convert finalDamageRates map to record
  const fdrRecord: Record<number, FinalDamageRateEntry> = {};
  for (const [id, entry] of finalDamageRates) {
    fdrRecord[id] = entry;
  }

  // Convert equipParamGem map to record
  const epgRecord: Record<number, EquipParamGemEntry> = {};
  for (const [id, entry] of equipParamGem) {
    epgRecord[id] = entry;
  }

  // Load GemData
  const gemData = loadGemDataTsv(join(paramFilesDir, '..', 'data', 'gem-data.tsv'));

  // Build mappings from GemData
  const weaponClassMountFieldMap: Record<string, string> = {};
  const affinityConfigFieldMap: Record<string, string> = {};

  for (const entry of gemData) {
    if (entry.name && entry.canMountWep) {
      weaponClassMountFieldMap[entry.name] = entry.canMountWep;
    }
    if (entry.infusion && entry.equipParamGem) {
      affinityConfigFieldMap[entry.infusion] = entry.equipParamGem;
    }
  }

  // Build aowExplicitWeaponClasses mapping
  // For each AoW, find which weapon classes have explicit [WeaponClass] attacks
  // (as opposed to [VarN] fallback attacks)
  const aowExplicitWeaponClasses: Record<string, string[]> = {};

  for (const [swordArtsId, swordArt] of Object.entries(swordArts)) {
    const explicitClasses = new Set<string>();

    for (const attack of swordArt.attacks) {
      if (attack.weaponClass) {
        // Check if this is a variant marker (Var1, Var2, etc.) or an explicit weapon class
        const isVariant = /^Var\d+$/i.test(attack.weaponClass);
        if (!isVariant) {
          explicitClasses.add(attack.weaponClass);
        }
      }
    }

    if (explicitClasses.size > 0) {
      aowExplicitWeaponClasses[swordArt.name] = Array.from(explicitClasses);
    }
  }

  // Build swordArtsIdToGemId mapping
  // Maps each sword arts ID to its corresponding gem ID in EquipParamGem
  const swordArtsIdToGemId: Record<number, number> = {};
  for (const [gemIdStr, gemEntry] of Object.entries(epgRecord)) {
    const gemId = parseInt(gemIdStr);
    const saId = gemEntry.swordArtsParamId;
    // Only map if there's a valid swordArtsParamId
    // Prefer HIGHER gem IDs (10000+) as they are the actual "Ash of War:" items
    // Lower IDs (< 1000) are internal/dev gems that don't have proper affinity restrictions
    if (saId > 0 && (!swordArtsIdToGemId[saId] || gemId > swordArtsIdToGemId[saId])) {
      swordArtsIdToGemId[saId] = gemId;
    }
  }

  // Build aowStatPointBonuses mapping from GemData changeAttributePoint columns
  // These are stat point bonuses applied to certain buff AoWs (War Cry, Barbaric Roar, etc.)
  const aowStatPointBonuses: Record<string, import('./aowTypes.js').AowStatPointBonus> = {};
  for (const entry of gemData) {
    if (entry.changeAttributePoint) {
      const aowName = entry.changeAttributePoint;
      // Only add if there's at least one non-zero bonus
      if (entry.changeStrengthPoint || entry.changeAgilityPoint || entry.changeMagicPoint ||
          entry.changeFaithPoint || entry.changeLuckPoint) {
        aowStatPointBonuses[aowName] = {
          strength: entry.changeStrengthPoint,
          dexterity: entry.changeAgilityPoint, // GemData calls it Agility
          intelligence: entry.changeMagicPoint, // GemData calls it Magic
          faith: entry.changeFaithPoint,
          arcane: entry.changeLuckPoint, // GemData calls it Luck
        };
      }
    }
  }

  // Fix swordArtsByName to prefer entries with valid EquipParamGem entries
  // This handles cases where multiple sword arts have the same name but only one is a "real" AoW
  // (e.g., Spinning Slash has both ID 103 with gems and ID 1166 without)
  const fixedSwordArtsByName: Record<string, number> = {};
  const nameToIds: Record<string, number[]> = {};

  // Group sword arts IDs by name
  for (const [idStr, swordArt] of Object.entries(swordArts)) {
    const id = parseInt(idStr);
    const name = swordArt.name;
    if (!nameToIds[name]) {
      nameToIds[name] = [];
    }
    nameToIds[name].push(id);
  }

  // For each name, prefer the ID that has a gem entry
  for (const [name, ids] of Object.entries(nameToIds)) {
    // Find IDs that have corresponding gem entries
    const idsWithGems = ids.filter(id => swordArtsIdToGemId[id] !== undefined);

    if (idsWithGems.length > 0) {
      // Use the lowest ID with a gem entry (typically the base version)
      fixedSwordArtsByName[name] = Math.min(...idsWithGems);
    } else {
      // No gem entries, use the lowest ID
      fixedSwordArtsByName[name] = Math.min(...ids);
    }
  }

  // Build skillNames mapping from ALL skills in SwordArtsParam
  // This includes unique weapon skills that aren't in the AoW list
  const swordArtsParamData = loadSwordArtsParam(join(paramFilesDir, 'SwordArtsParam.param.xml'));
  const skillNames: Record<number, string> = {};
  for (const [id, entry] of swordArtsParamData) {
    if (entry.name) {
      skillNames[id] = entry.name;
    }
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    swordArts,
    attacks,
    swordArtsByName: fixedSwordArtsByName,
    attackElementCorrect: aecRecord,
    finalDamageRates: fdrRecord,
    equipParamGem: epgRecord,
    weaponClassMountFieldMap,
    affinityConfigFieldMap,
    aowExplicitWeaponClasses,
    swordArtsIdToGemId,
    aowStatPointBonuses,
    skillNames,
  };
}

/**
 * Options for building AoW data
 */
export interface BuildAowDataOptions {
  // Additional attack data to include (from spreadsheet export)
  additionalAtkData?: AowAtkDataEntry[];
}

/**
 * Build precomputed AoW data with additional options
 */
export function buildPrecomputedAowDataWithOptions(
  paramFilesDir: string,
  options: BuildAowDataOptions = {}
): PrecomputedAowData {
  const data = buildPrecomputedAowData(paramFilesDir);

  // Add any additional attack data
  if (options.additionalAtkData) {
    const atkParams = loadAtkParamPc(join(paramFilesDir, 'AtkParam_Pc.param.xml'));
    const finalDamageRates = loadFinalDamageRateParam(join(paramFilesDir, 'FinalDamageRateParam.param.xml'));
    const swordArtsMap = getSwordArtsMap();

    for (const entry of options.additionalAtkData) {
      const attack = buildPrecomputedAowAttack(entry.atkId, entry.name, atkParams, finalDamageRates);
      if (attack) {
        data.attacks[entry.atkId] = attack;

        // Add to sword art
        if (!data.swordArts[entry.swordArtsParamId]) {
          const swordArtName = getSwordArtName(entry.name, swordArtsMap, entry.swordArtsParamId);

          data.swordArts[entry.swordArtsParamId] = {
            swordArtsId: entry.swordArtsParamId,
            name: swordArtName,
            attacks: [],
          };
          data.swordArtsByName[swordArtName] = entry.swordArtsParamId;
        }
        data.swordArts[entry.swordArtsParamId].attacks.push(attack);
      }
    }
  }

  return data;
}
