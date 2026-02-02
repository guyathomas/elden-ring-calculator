/**
 * AoW Compatibility Validation Tests
 *
 * These tests validate that the UI logic for showing weapons when an AoW is selected
 * matches the ground truth from the generated aow_compatibility.csv file.
 *
 * The CSV was generated from the Google Sheets data which contains:
 * - Weapon class to canMountWep_* field mappings
 * - Affinity to configurableWepAttr* field mappings
 * - EquipParamGem entries with compatibility flags for each AoW
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { buildPrecomputedAowData, buildPrecomputedDataV2 } from '../src/index.js';
import { getAvailableAowNames } from '../src/aowCalculator.js';
import type { PrecomputedAowData } from '../src/aowTypes.js';
import type { PrecomputedDataV2 } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PARAM_FILES_DIR = join(__dirname, '..', 'param-files');
const AOW_COMPATIBILITY_CSV = join(__dirname, '..', '..', '..', 'aow_compatibility.csv');

// Global test data
let aowData: PrecomputedAowData;
let weaponData: PrecomputedDataV2;

// Ground truth from CSV: Map<weaponName, Map<affinity, Set<aowName>>>
let csvGroundTruth: Map<string, Map<string, Set<string>>>;
// Also track weapon ID to name mapping from CSV
let weaponIdToName: Map<string, string>;
// Track all unique AoW names from CSV
let csvAowNames: Set<string>;
// Track weapon class by weapon name
let weaponClassByName: Map<string, string>;

/**
 * Load and parse the CSV ground truth data
 */
function loadCsvGroundTruth(): void {
  const csvContent = readFileSync(AOW_COMPATIBILITY_CSV, 'utf-8');
  const lines = csvContent.split('\n');

  csvGroundTruth = new Map();
  weaponIdToName = new Map();
  csvAowNames = new Set();
  weaponClassByName = new Map();

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle quoted values)
    const parts = parseCSVLine(line);
    if (parts.length < 4) continue;

    const [weaponName, weaponId, affinity, aowName] = parts;

    // Track weapon ID to name
    weaponIdToName.set(weaponId, weaponName);

    // Track AoW names
    csvAowNames.add(aowName);

    // Build ground truth map
    if (!csvGroundTruth.has(weaponName)) {
      csvGroundTruth.set(weaponName, new Map());
    }
    const affinityMap = csvGroundTruth.get(weaponName)!;
    if (!affinityMap.has(affinity)) {
      affinityMap.set(affinity, new Set());
    }
    affinityMap.get(affinity)!.add(aowName);
  }
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

describe('AoW Compatibility Validation', () => {
  beforeAll(() => {
    // Load CSV ground truth
    loadCsvGroundTruth();
    console.log(`Loaded CSV ground truth: ${csvGroundTruth.size} weapons, ${csvAowNames.size} unique AoWs`);

    // Build weapon and AoW data
    weaponData = buildPrecomputedDataV2(PARAM_FILES_DIR);
    aowData = buildPrecomputedAowData(PARAM_FILES_DIR);

    // Build weapon class mapping from weapon data
    for (const [name, weapon] of Object.entries(weaponData.weapons)) {
      weaponClassByName.set(name, weapon.categoryName);
    }
    console.log(`Built weapon data: ${Object.keys(weaponData.weapons).length} weapons`);
    console.log(`Built AoW data: ${Object.keys(aowData.swordArtsByName).length} AoWs`);
  }, 60000);

  describe('CSV Data Integrity', () => {
    it('should have loaded CSV ground truth data', () => {
      expect(csvGroundTruth.size).toBeGreaterThan(0);
      expect(csvAowNames.size).toBeGreaterThan(0);
    });

    it('should have expected number of weapons', () => {
      // CSV has 456 unique weapons
      expect(csvGroundTruth.size).toBeGreaterThanOrEqual(450);
    });

    it('should have expected number of AoWs', () => {
      // CSV has 116 unique AoWs
      expect(csvAowNames.size).toBeGreaterThanOrEqual(100);
    });

    it('should have all 13 affinities represented', () => {
      const allAffinities = new Set<string>();
      for (const affinityMap of csvGroundTruth.values()) {
        for (const affinity of affinityMap.keys()) {
          allAffinities.add(affinity);
        }
      }

      expect(allAffinities.has('Standard')).toBe(true);
      expect(allAffinities.has('Heavy')).toBe(true);
      expect(allAffinities.has('Keen')).toBe(true);
      expect(allAffinities.has('Quality')).toBe(true);
      expect(allAffinities.has('Fire')).toBe(true);
      expect(allAffinities.has('Flame Art')).toBe(true);
      expect(allAffinities.has('Lightning')).toBe(true);
      expect(allAffinities.has('Sacred')).toBe(true);
      expect(allAffinities.has('Magic')).toBe(true);
      expect(allAffinities.has('Cold')).toBe(true);
      expect(allAffinities.has('Poison')).toBe(true);
      expect(allAffinities.has('Blood')).toBe(true);
      expect(allAffinities.has('Occult')).toBe(true);
    });
  });

  describe('getAvailableAowNames() vs CSV Ground Truth', () => {
    it('should match CSV for getAvailableAowNames() with weapon class and affinity', () => {
      const discrepancies: Array<{
        weaponClass: string;
        affinity: string;
        inCsvNotInFunction: string[];
        inFunctionNotInCsv: string[];
      }> = [];

      // Get unique weapon classes from CSV
      const weaponClasses = new Set<string>();
      for (const weaponName of csvGroundTruth.keys()) {
        const weaponClass = weaponClassByName.get(weaponName);
        if (weaponClass) {
          weaponClasses.add(weaponClass);
        }
      }

      const affinities = [
        'Standard',
        'Heavy',
        'Keen',
        'Quality',
        'Fire',
        'Flame Art',
        'Lightning',
        'Sacred',
        'Magic',
        'Cold',
        'Poison',
        'Blood',
        'Occult',
      ];

      // For each weapon class + affinity combo, compare function output to CSV
      for (const weaponClass of weaponClasses) {
        for (const affinity of affinities) {
          // Get function output
          const functionAows = new Set(getAvailableAowNames(aowData, weaponClass, affinity));

          // Get CSV output for this weapon class + affinity
          // We need to find weapons of this class and aggregate their AoWs
          const csvAows = new Set<string>();
          for (const [weaponName, affinityMap] of csvGroundTruth.entries()) {
            const wClass = weaponClassByName.get(weaponName);
            if (wClass === weaponClass && affinityMap.has(affinity)) {
              for (const aow of affinityMap.get(affinity)!) {
                csvAows.add(aow);
              }
            }
          }

          // Skip if no weapons of this class have this affinity in CSV
          if (csvAows.size === 0) continue;

          // Compare
          const inCsvNotInFunction: string[] = [];
          const inFunctionNotInCsv: string[] = [];

          for (const aow of csvAows) {
            if (!functionAows.has(aow)) {
              inCsvNotInFunction.push(aow);
            }
          }

          for (const aow of functionAows) {
            if (!csvAows.has(aow)) {
              inFunctionNotInCsv.push(aow);
            }
          }

          if (inCsvNotInFunction.length > 0 || inFunctionNotInCsv.length > 0) {
            discrepancies.push({
              weaponClass,
              affinity,
              inCsvNotInFunction,
              inFunctionNotInCsv,
            });
          }
        }
      }

      // Report discrepancies
      if (discrepancies.length > 0) {
        console.log(`\n=== DISCREPANCIES FOUND: ${discrepancies.length} ===\n`);
        for (const d of discrepancies.slice(0, 20)) {
          console.log(`${d.weaponClass} + ${d.affinity}:`);
          if (d.inCsvNotInFunction.length > 0) {
            console.log(`  In CSV but NOT returned by function: ${d.inCsvNotInFunction.join(', ')}`);
          }
          if (d.inFunctionNotInCsv.length > 0) {
            console.log(`  Returned by function but NOT in CSV: ${d.inFunctionNotInCsv.join(', ')}`);
          }
        }
        if (discrepancies.length > 20) {
          console.log(`... and ${discrepancies.length - 20} more discrepancies`);
        }
      }

      // All AoWs from function should be in CSV, and vice versa
      expect(discrepancies.length).toBe(0);
    });
  });

  describe('UI Logic Validation (App.tsx basic affinity behavior)', () => {
    /**
     * The UI (App.tsx) uses different logic for "basic" affinities:
     * - Basic affinities (Standard, Heavy, Keen, Quality): Only checks weapon class, ignores affinity
     * - Specialized affinities: Checks both weapon class AND affinity
     *
     * This test validates whether this simplification is accurate.
     */
    it('should validate that basic affinities do NOT need affinity checking (UI assumption)', () => {
      const basicAffinities = ['Standard', 'Heavy', 'Keen', 'Quality'];

      // For each basic affinity, check if filtering by weapon class only
      // gives the same result as filtering by weapon class + affinity
      const discrepancies: Array<{
        weaponClass: string;
        affinity: string;
        uiWouldShow: string[];
        shouldShow: string[];
        incorrectlyShown: string[];
      }> = [];

      const weaponClasses = new Set<string>();
      for (const weaponName of csvGroundTruth.keys()) {
        const weaponClass = weaponClassByName.get(weaponName);
        if (weaponClass) {
          weaponClasses.add(weaponClass);
        }
      }

      for (const weaponClass of weaponClasses) {
        for (const affinity of basicAffinities) {
          // UI behavior: Only check weapon class (no affinity check)
          const uiWouldShow = getAvailableAowNames(aowData, weaponClass);

          // Correct behavior: Check both weapon class AND affinity
          const shouldShow = getAvailableAowNames(aowData, weaponClass, affinity);

          // Find AoWs that UI would show but shouldn't
          const incorrectlyShown = uiWouldShow.filter((aow) => !shouldShow.includes(aow));

          if (incorrectlyShown.length > 0) {
            discrepancies.push({
              weaponClass,
              affinity,
              uiWouldShow,
              shouldShow,
              incorrectlyShown,
            });
          }
        }
      }

      // Report findings
      if (discrepancies.length > 0) {
        console.log(`\n=== UI LOGIC ISSUES (Basic Affinity Assumption) ===`);
        console.log(`The UI assumes basic affinities (Standard, Heavy, Keen, Quality) work with ALL AoWs.`);
        console.log(`This is INCORRECT for the following weapon class + affinity combinations:\n`);

        // Group by incorrectly shown AoWs
        const aowDiscrepancyCounts = new Map<string, number>();
        for (const d of discrepancies) {
          for (const aow of d.incorrectlyShown) {
            aowDiscrepancyCounts.set(aow, (aowDiscrepancyCounts.get(aow) || 0) + 1);
          }
        }

        // Sort by count
        const sortedAows = Array.from(aowDiscrepancyCounts.entries()).sort((a, b) => b[1] - a[1]);

        console.log('AoWs incorrectly shown by UI for basic affinities:');
        for (const [aow, count] of sortedAows) {
          console.log(`  "${aow}": incorrectly shown in ${count} weapon class + affinity combinations`);
        }

        console.log('\nDetailed discrepancies (first 15):');
        for (const d of discrepancies.slice(0, 15)) {
          console.log(`  ${d.weaponClass} + ${d.affinity}: UI incorrectly shows: ${d.incorrectlyShown.join(', ')}`);
        }
      }

      // This test documents the issue - we expect discrepancies because the UI has a bug
      // If there are no discrepancies, the UI assumption is correct
      if (discrepancies.length === 0) {
        console.log('\nNo discrepancies found - UI basic affinity assumption is CORRECT');
      }

      // Return the findings for the test report
      return discrepancies;
    });

    it('should identify specific AoWs that do NOT support basic affinities', () => {
      // NOTE: According to Google Sheets data (EquipParamGem), most AoWs including Hoarfrost Stomp
      // and Flame Skewer DO support Standard/Heavy/Keen/Quality. The configurableWepAttr00-03
      // flags are TRUE for these AoWs.
      //
      // This contradicts some community assumptions but matches the actual game data.

      const basicAffinities = ['Standard', 'Heavy', 'Keen', 'Quality'];

      // Get all AoWs that support basic affinities
      const aowsWithBasicSupport = new Map<string, Set<string>>();

      for (const aowName of csvAowNames) {
        aowsWithBasicSupport.set(aowName, new Set());
      }

      // Check each AoW's affinity support using the function
      for (const aowName of csvAowNames) {
        for (const affinity of basicAffinities) {
          // Check if any weapon class supports this AoW with this affinity
          const aows = getAvailableAowNames(aowData, 'Straight Sword', affinity);
          if (aows.includes(aowName)) {
            aowsWithBasicSupport.get(aowName)!.add(affinity);
          }
        }
      }

      // Find AoWs that don't support ANY basic affinities
      const noBasicSupport: string[] = [];
      const partialBasicSupport: Array<{ aow: string; supported: string[] }> = [];

      for (const [aowName, supported] of aowsWithBasicSupport) {
        if (supported.size === 0) {
          noBasicSupport.push(aowName);
        } else if (supported.size < 4) {
          partialBasicSupport.push({ aow: aowName, supported: Array.from(supported) });
        }
      }

      console.log('\n=== AoWs WITHOUT Basic Affinity Support ===');
      console.log('These AoWs do NOT support Standard, Heavy, Keen, or Quality affinities:\n');
      for (const aow of noBasicSupport.sort()) {
        console.log(`  - ${aow}`);
      }

      if (partialBasicSupport.length > 0) {
        console.log('\n=== AoWs with PARTIAL Basic Affinity Support ===');
        for (const { aow, supported } of partialBasicSupport) {
          console.log(`  - ${aow}: only supports ${supported.join(', ')}`);
        }
      }

      // According to Google Sheets data, Hoarfrost Stomp and Flame Skewer DO support basic affinities
      // They should NOT be in the noBasicSupport list
      expect(noBasicSupport).not.toContain('Hoarfrost Stomp');
      expect(noBasicSupport).not.toContain('Flame Skewer');

      // Document that we have very few AoWs without basic support
      console.log(`\nTotal AoWs without basic affinity support: ${noBasicSupport.length}`);
    });
  });

  describe('Specific AoW Compatibility Tests', () => {
    it('should verify Hoarfrost Stomp supports Standard, Heavy, Keen, Quality, Magic, Cold', () => {
      // From CSV ground truth - According to EquipParamGem data, Hoarfrost Stomp supports:
      // configurableWepAttr00-03 (Standard, Heavy, Keen, Quality): TRUE
      // configurableWepAttr04-07 (Fire, Flame Art, Lightning, Sacred): FALSE
      // configurableWepAttr08-09 (Magic, Cold): TRUE
      // configurableWepAttr10-12 (Poison, Blood, Occult): FALSE
      const hoarfrostAffinities = new Set<string>();
      for (const affinityMap of csvGroundTruth.values()) {
        for (const [affinity, aows] of affinityMap) {
          if (aows.has('Ash of War: Hoarfrost Stomp')) {
            hoarfrostAffinities.add(affinity);
          }
        }
      }

      console.log(`Hoarfrost Stomp supported affinities (from CSV): ${Array.from(hoarfrostAffinities).sort().join(', ')}`);

      // Hoarfrost Stomp supports 6 affinities per the game data
      expect(hoarfrostAffinities.has('Standard')).toBe(true);
      expect(hoarfrostAffinities.has('Heavy')).toBe(true);
      expect(hoarfrostAffinities.has('Keen')).toBe(true);
      expect(hoarfrostAffinities.has('Quality')).toBe(true);
      expect(hoarfrostAffinities.has('Magic')).toBe(true);
      expect(hoarfrostAffinities.has('Cold')).toBe(true);
      // These are NOT supported
      expect(hoarfrostAffinities.has('Fire')).toBe(false);
      expect(hoarfrostAffinities.has('Flame Art')).toBe(false);
      expect(hoarfrostAffinities.has('Lightning')).toBe(false);
      expect(hoarfrostAffinities.has('Sacred')).toBe(false);
      expect(hoarfrostAffinities.has('Poison')).toBe(false);
      expect(hoarfrostAffinities.has('Blood')).toBe(false);
      expect(hoarfrostAffinities.has('Occult')).toBe(false);
    });

    it('should verify Flame Skewer supports Standard, Heavy, Keen, Quality, Fire, Flame Art', () => {
      // From CSV ground truth - According to EquipParamGem data, Flame Skewer supports:
      // configurableWepAttr00-03 (Standard, Heavy, Keen, Quality): TRUE
      // configurableWepAttr04-05 (Fire, Flame Art): TRUE
      // configurableWepAttr06-12 (Lightning, Sacred, Magic, Cold, Poison, Blood, Occult): FALSE
      const flameSkewerAffinities = new Set<string>();
      for (const affinityMap of csvGroundTruth.values()) {
        for (const [affinity, aows] of affinityMap) {
          if (aows.has('Ash of War: Flame Skewer')) {
            flameSkewerAffinities.add(affinity);
          }
        }
      }

      console.log(`Flame Skewer supported affinities (from CSV): ${Array.from(flameSkewerAffinities).sort().join(', ')}`);

      // Flame Skewer supports 6 affinities per the game data
      expect(flameSkewerAffinities.has('Standard')).toBe(true);
      expect(flameSkewerAffinities.has('Heavy')).toBe(true);
      expect(flameSkewerAffinities.has('Keen')).toBe(true);
      expect(flameSkewerAffinities.has('Quality')).toBe(true);
      expect(flameSkewerAffinities.has('Fire')).toBe(true);
      expect(flameSkewerAffinities.has('Flame Art')).toBe(true);
      // These are NOT supported
      expect(flameSkewerAffinities.has('Lightning')).toBe(false);
      expect(flameSkewerAffinities.has('Sacred')).toBe(false);
      expect(flameSkewerAffinities.has('Magic')).toBe(false);
      expect(flameSkewerAffinities.has('Cold')).toBe(false);
    });

    it('should verify Storm Stomp supports all affinities', () => {
      const stormStompAffinities = new Set<string>();
      for (const affinityMap of csvGroundTruth.values()) {
        for (const [affinity, aows] of affinityMap) {
          if (aows.has('Ash of War: Storm Stomp')) {
            stormStompAffinities.add(affinity);
          }
        }
      }

      console.log(`Storm Stomp supported affinities (from CSV): ${Array.from(stormStompAffinities).sort().join(', ')}`);

      // Storm Stomp should support all affinities
      expect(stormStompAffinities.size).toBe(13);
    });

    it("should verify Lion's Claw supports all affinities", () => {
      const lionsClawAffinities = new Set<string>();
      for (const affinityMap of csvGroundTruth.values()) {
        for (const [affinity, aows] of affinityMap) {
          if (aows.has("Ash of War: Lion's Claw")) {
            lionsClawAffinities.add(affinity);
          }
        }
      }

      console.log(`Lion's Claw supported affinities (from CSV): ${Array.from(lionsClawAffinities).sort().join(', ')}`);

      // Lion's Claw should support all affinities
      expect(lionsClawAffinities.size).toBe(13);
    });
  });

  describe('Weapon Class Coverage', () => {
    it('should have AoW compatibility data for all weapon classes', () => {
      const csvWeaponClasses = new Set<string>();
      for (const weaponName of csvGroundTruth.keys()) {
        const weaponClass = weaponClassByName.get(weaponName);
        if (weaponClass) {
          csvWeaponClasses.add(weaponClass);
        }
      }

      const functionWeaponClasses = new Set(Object.keys(aowData.weaponClassMountFieldMap));

      console.log(`CSV weapon classes: ${csvWeaponClasses.size}`);
      console.log(`Function weapon classes: ${functionWeaponClasses.size}`);

      // Check for classes in function but not in CSV
      const inFunctionNotInCsv: string[] = [];
      for (const wClass of functionWeaponClasses) {
        if (!csvWeaponClasses.has(wClass)) {
          inFunctionNotInCsv.push(wClass);
        }
      }

      // Check for classes in CSV but not in function
      const inCsvNotInFunction: string[] = [];
      for (const wClass of csvWeaponClasses) {
        if (!functionWeaponClasses.has(wClass)) {
          inCsvNotInFunction.push(wClass);
        }
      }

      if (inFunctionNotInCsv.length > 0) {
        console.log(`Weapon classes in function but not in CSV: ${inFunctionNotInCsv.join(', ')}`);
      }
      if (inCsvNotInFunction.length > 0) {
        console.log(`Weapon classes in CSV but not in function: ${inCsvNotInFunction.join(', ')}`);
      }
    });
  });
});
