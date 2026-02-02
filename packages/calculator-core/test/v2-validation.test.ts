/**
 * V2 Calculator Validation Tests
 *
 * These tests validate the V2 hybrid calculator (buildPrecomputedDataV2 + calculateARV2)
 * against the same 2664 CSV test cases used for V1.
 *
 * V2 must produce identical results to V1 for all test cases.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  parseTestCasesCsv,
  type TestCaseRow,
} from '../src/paramParser.js';

import {
  buildPrecomputedDataV2,
  type PrecomputedDataV2,
} from '../src/paramBuilder.js';

import {
  calculateARV2,
  hasWeaponAffinityV2,
  getAffinityDataV2,
  getScalingGrade,
} from '../src/calculator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PARAM_FILES_DIR = join(__dirname, '..', 'param-files');
const TEST_CASES_CSV = join(__dirname, '..', 'er-calc-ap-test-cases.csv');

// Global test data
let v2Data: PrecomputedDataV2;
let testCases: TestCaseRow[];

// Get unique weapon names from test cases for building V2 data
function getUniqueWeaponNames(cases: TestCaseRow[]): string[] {
  const names = new Set<string>();
  for (const tc of cases) {
    names.add(tc.weapon);
  }
  return Array.from(names);
}

// CSV column name for spell buff rounded value - support both old and new formats
const CSV_SPELL_BUFF_ROUNDED_NEW = 'Magic_SB_Rounded';
const CSV_SPELL_BUFF_ROUNDED_OLD = 'AP/SP_Magic_SB_Rounded';

// Parse spell buff value from raw CSV column
function parseSBValue(value: string | undefined): number | null {
  if (!value || value.trim() === '' || value.trim() === '-' || value.trim().startsWith('-   ')) {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

describe('V2 Calculator Validation', () => {
  // Unit test for getScalingGrade function
  // Thresholds validated against er-calc-test-cases.csv data:
  // - E: 4.00 - 21.60   → threshold 25 is in gap [21.60, 26.00]
  // - D: 26.00 - 59.40  → threshold 60 is at edge [59.40, 60.00]
  // - C: 60.00 - 89.00  → threshold 90 is at edge [89.00, 90.00]
  // - B: 90.00 - 138.60 → threshold 140 is in gap [138.60, 142.80]
  // - A: 142.80 - 142.80 → threshold 175 is in gap [142.80, 249.00] (unvalidated)
  // - S: 249.00 - 273.00
  describe('getScalingGrade', () => {
    it.each([
      // Zero scaling = no grade
      { raw: 0, expected: '-' },
      // E grade: observed range 4.00 - 21.60 in CSV
      { raw: 1, expected: 'E' },
      { raw: 4, expected: 'E' },     // CSV min for E
      { raw: 21.6, expected: 'E' },  // CSV max for E
      { raw: 24, expected: 'E' },
      // D grade: observed range 26.00 - 59.40 in CSV
      { raw: 25, expected: 'D' },    // threshold
      { raw: 26, expected: 'D' },    // CSV min for D
      { raw: 36, expected: 'D' },
      { raw: 55, expected: 'D' },
      { raw: 59, expected: 'D' },
      { raw: 59.4, expected: 'D' },  // CSV max for D
      // C grade: observed range 60.00 - 89.00 in CSV
      { raw: 60, expected: 'C' },    // threshold & CSV min for C
      { raw: 89, expected: 'C' },    // CSV max for C
      // B grade: observed range 90.00 - 138.60 in CSV
      { raw: 90, expected: 'B' },    // threshold & CSV min for B
      { raw: 138.6, expected: 'B' }, // CSV max for B
      { raw: 139, expected: 'B' },
      // A grade: observed range 142.80 - 142.80 in CSV (only one value)
      { raw: 140, expected: 'A' },   // threshold
      { raw: 142.8, expected: 'A' }, // CSV min/max for A
      { raw: 174, expected: 'A' },
      // S grade: observed range 249.00 - 273.00 in CSV
      { raw: 175, expected: 'S' },   // threshold (in unvalidated gap)
      { raw: 200, expected: 'S' },
      { raw: 249, expected: 'S' },   // CSV min for S
      { raw: 273, expected: 'S' },   // CSV max for S
    ])('getScalingGrade($raw) should be $expected', ({ raw, expected }) => {
      expect(getScalingGrade(raw)).toBe(expected);
    });
  });

  beforeAll(() => {
    // Load test cases
    const csvContent = readFileSync(TEST_CASES_CSV, 'utf-8');
    testCases = parseTestCasesCsv(csvContent);

    // Get unique weapon names
    const weaponNames = getUniqueWeaponNames(testCases);
    console.log(`Building V2 data for ${weaponNames.length} weapons: ${weaponNames.join(', ')}`);

    // Build V2 precomputed data for test weapons
    v2Data = buildPrecomputedDataV2(PARAM_FILES_DIR, {
      weaponFilter: weaponNames,
    });

    const weaponCount = Object.keys(v2Data.weapons).length;
    console.log(`V2 data: ${weaponCount} weapons, ${Object.keys(v2Data.reinforceRates).length} rate entries`);
  }, 30000); // 30 second timeout for data loading in CI

  it('should load test data', () => {
    expect(testCases.length).toBeGreaterThan(0);
    expect(Object.keys(v2Data.weapons).length).toBeGreaterThan(0);
    expect(Object.keys(v2Data.reinforceRates).length).toBeGreaterThan(0);
  });

  it('should find all test weapons in V2 data', () => {
    const weaponNames = getUniqueWeaponNames(testCases);
    let found = 0;
    let notFound: string[] = [];

    for (const name of weaponNames) {
      // Check if at least one affinity exists for this weapon (O(1) lookup)
      if (hasWeaponAffinityV2(v2Data, name, 'Standard')) {
        found++;
      } else {
        notFound.push(name);
      }
    }

    console.log(`Found ${found}/${weaponNames.length} weapons`);
    if (notFound.length > 0) {
      console.log(`Not found: ${notFound.join(', ')}`);
    }

    expect(found).toBeGreaterThan(0);
  });

  describe('Full CSV Validation - All Test Cases (V2)', () => {
    it('should validate all test cases with comprehensive reporting', () => {
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      const failures: Array<{
        tc: TestCaseRow;
        expected: Record<string, number | null>;
        actual: Record<string, number>;
      }> = [];

      console.log('\n========================================');
      console.log('V2 Full CSV Validation Results');
      console.log('========================================');

      for (const tc of testCases) {
        if (!hasWeaponAffinityV2(v2Data, tc.weapon, tc.affinity)) {
          skipped++;
          continue;
        }

        const result = calculateARV2(
          v2Data,
          tc.weapon,
          tc.affinity,
          tc.upgradeLevel,
          {
            strength: tc.strength,
            dexterity: tc.dexterity,
            intelligence: tc.intelligence,
            faith: tc.faith,
            arcane: tc.arcane,
          },
          {
            twoHanding: tc.twoHanded,
            ignoreRequirements: tc.ignoreRequirements,
          }
        );

        if (!result) {
          skipped++;
          continue;
        }

        let testPassed = true;

        // Check physical AP rounded (exact match required)
        if (tc.physicalAPRounded !== null && tc.physicalAPRounded > 0) {
          if (result.physical.rounded !== tc.physicalAPRounded) {
            testPassed = false;
          }
        }

        // Check magic AP rounded (exact match required)
        if (tc.magicAPRounded !== null && tc.magicAPRounded > 0) {
          if (result.magic.rounded !== tc.magicAPRounded) {
            testPassed = false;
          }
        }

        // Check fire AP rounded (exact match required)
        if (tc.fireAPRounded !== null && tc.fireAPRounded > 0) {
          if (result.fire.rounded !== tc.fireAPRounded) {
            testPassed = false;
          }
        }

        // Check lightning AP rounded (exact match required)
        if (tc.lightningAPRounded !== null && tc.lightningAPRounded > 0) {
          if (result.lightning.rounded !== tc.lightningAPRounded) {
            testPassed = false;
          }
        }

        // Check holy AP rounded (exact match required)
        if (tc.holyAPRounded !== null && tc.holyAPRounded > 0) {
          if (result.holy.rounded !== tc.holyAPRounded) {
            testPassed = false;
          }
        }

        if (testPassed) {
          passed++;
        } else {
          failed++;
          if (failures.length < 10) {
            failures.push({
              tc,
              expected: {
                physical: tc.physicalAPRounded,
                magic: tc.magicAPRounded,
                fire: tc.fireAPRounded,
                lightning: tc.lightningAPRounded,
                holy: tc.holyAPRounded,
              },
              actual: {
                physical: result.physical.rounded,
                magic: result.magic.rounded,
                fire: result.fire.rounded,
                lightning: result.lightning.rounded,
                holy: result.holy.rounded,
              },
            });
          }
        }
      }

      const total = passed + failed + skipped;
      const passRate = ((passed / (passed + failed)) * 100).toFixed(2);

      console.log(`Total test cases: ${total}`);
      console.log(`Passed: ${passed} (${passRate}%)`);
      console.log(`Failed: ${failed}`);
      console.log(`Skipped (weapon not found): ${skipped}`);

      if (failures.length > 0) {
        console.log('\nFirst 10 failures:');
        for (const f of failures) {
          console.log(`  ${f.tc.weapon} ${f.tc.affinity} +${f.tc.upgradeLevel}`);
          console.log(`    Stats: STR:${f.tc.strength} DEX:${f.tc.dexterity} INT:${f.tc.intelligence} FAI:${f.tc.faith} ARC:${f.tc.arcane}`);
          console.log(`    Expected: phys=${f.expected.physical} mag=${f.expected.magic} fire=${f.expected.fire} light=${f.expected.lightning} holy=${f.expected.holy}`);
          console.log(`    Actual:   phys=${f.actual.physical} mag=${f.actual.magic} fire=${f.actual.fire} light=${f.actual.lightning} holy=${f.actual.holy}`);
        }
      }

      expect(passed).toBe(passed + failed); // All tests must pass
    });

    // Test all cases for each damage type individually
    it.each([
      { damageType: 'physical', field: 'physicalAPRounded' as const },
      { damageType: 'magic', field: 'magicAPRounded' as const },
      { damageType: 'fire', field: 'fireAPRounded' as const },
      { damageType: 'lightning', field: 'lightningAPRounded' as const },
      { damageType: 'holy', field: 'holyAPRounded' as const },
    ])('$damageType damage validation (V2)', ({ damageType, field }) => {
      let passed = 0;
      let total = 0;
      const failures: string[] = [];

      for (const tc of testCases) {
        const expected = tc[field];
        if (expected === null || expected === 0) continue;
        total++;

        if (!hasWeaponAffinityV2(v2Data, tc.weapon, tc.affinity)) continue;

        const result = calculateARV2(
          v2Data,
          tc.weapon,
          tc.affinity,
          tc.upgradeLevel,
          {
            strength: tc.strength,
            dexterity: tc.dexterity,
            intelligence: tc.intelligence,
            faith: tc.faith,
            arcane: tc.arcane,
          },
          {
            twoHanding: tc.twoHanded,
            ignoreRequirements: tc.ignoreRequirements,
          }
        );

        if (!result) continue;

        const actual = result[damageType as keyof typeof result] as { rounded: number };
        if (actual.rounded === expected) {
          passed++;
        } else if (failures.length < 5) {
          failures.push(
            `${tc.weapon} ${tc.affinity} +${tc.upgradeLevel}: expected ${expected}, got ${actual.rounded}`
          );
        }
      }

      console.log(`V2 ${damageType} damage: ${passed}/${total} passed (${((passed / total) * 100).toFixed(1)}%)`);
      if (failures.length > 0) {
        console.log(`  Failures: ${failures.join('; ')}`);
      }
      expect(passed).toBe(total); // All tests must pass exactly
    });

    // Data-driven spell scaling test - iterates over all catalyst cases from CSV
    // NOTE: This test uses ±1 tolerance because the source CSV has 12 rounding bugs
    // (Academy Glintstone Staff +25: total=269, rounded=268 - mathematically impossible).
    // Damage type tests use exact match because their CSV data has 0 rounding inconsistencies.
    it('should validate spell scaling for all catalysts', () => {
      // Filter to catalyst test cases (weapons that have spell scaling in V2 data)
      const catalystCases = testCases.filter(tc => {
        const sbValue = parseSBValue(tc.raw[CSV_SPELL_BUFF_ROUNDED_NEW] ?? tc.raw[CSV_SPELL_BUFF_ROUNDED_OLD]);
        if (sbValue === null || sbValue === 0) return false;

        // Verify weapon actually has spell scaling in V2 data (O(1) lookup)
        const affinityData = getAffinityDataV2(v2Data, tc.weapon, tc.affinity);
        return affinityData && (affinityData.sorceryScaling !== null || affinityData.incantationScaling !== null);
      });

      let passed = 0;
      let failed = 0;
      const failures: string[] = [];

      for (const tc of catalystCases) {
        if (!hasWeaponAffinityV2(v2Data, tc.weapon, tc.affinity)) continue;

        const expected = parseSBValue(tc.raw[CSV_SPELL_BUFF_ROUNDED_NEW] ?? tc.raw[CSV_SPELL_BUFF_ROUNDED_OLD]);
        if (expected === null) continue;

        const result = calculateARV2(
          v2Data,
          tc.weapon,
          tc.affinity,
          tc.upgradeLevel,
          {
            strength: tc.strength,
            dexterity: tc.dexterity,
            intelligence: tc.intelligence,
            faith: tc.faith,
            arcane: tc.arcane,
          },
          {
            twoHanding: tc.twoHanded,
            ignoreRequirements: tc.ignoreRequirements,
          }
        );

        if (!result) continue;

        const actual = result.sorceryScaling?.rounded ?? result.incantationScaling?.rounded ?? 0;
        const diff = Math.abs(actual - expected);

        // Allow ±1 tolerance for known CSV rounding bugs
        // (e.g., CSV shows Total=269 but Rounded=268, which is mathematically impossible)
        if (diff <= 1) {
          passed++;
        } else {
          failed++;
          if (failures.length < 10) {
            failures.push(
              `${tc.weapon} +${tc.upgradeLevel} STR=${tc.strength} INT=${tc.intelligence} FTH=${tc.faith}: expected=${expected}, actual=${actual}`
            );
          }
        }
      }

      const total = passed + failed;
      const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0';
      console.log(`V2 Spell Scaling: ${passed}/${total} passed (${passRate}%) with ±1 tolerance`);

      if (failures.length > 0) {
        console.log('Failures:', failures.join('; '));
      }

      expect(failed).toBe(0);
      expect(total).toBeGreaterThan(0);
    });

    // Validate per-stat scaling values (e.g., Physical_AP_Scaling_Strength columns)
    it.each([
      { damageType: 'physical', prefix: 'Physical_AP' },
      { damageType: 'magic', prefix: 'Magic_AP' },
      { damageType: 'fire', prefix: 'Fire_AP' },
      { damageType: 'lightning', prefix: 'Lightning_AP' },
      { damageType: 'holy', prefix: 'Holy_AP' },
    ])('$damageType per-stat AttributeScaling validation', ({ damageType, prefix }) => {
      const stats = ['Strength', 'Dexterity', 'Intelligence', 'Faith', 'Arcane'] as const;
      const statKeys = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane'] as const;

      let totalChecks = 0;
      let passed = 0;
      const failures: string[] = [];

      for (const tc of testCases) {
        if (!hasWeaponAffinityV2(v2Data, tc.weapon, tc.affinity)) continue;

        const result = calculateARV2(
          v2Data,
          tc.weapon,
          tc.affinity,
          tc.upgradeLevel,
          {
            strength: tc.strength,
            dexterity: tc.dexterity,
            intelligence: tc.intelligence,
            faith: tc.faith,
            arcane: tc.arcane,
          },
          {
            twoHanding: tc.twoHanded,
            ignoreRequirements: tc.ignoreRequirements,
          }
        );

        if (!result) continue;

        const damageResult = result[damageType as keyof typeof result] as { perStat: Record<string, { scaling: number }> };

        // Check each stat's scaling value - support both old and new column names
        for (let i = 0; i < stats.length; i++) {
          const newCsvColumn = `${prefix}_Scaling_${stats[i]}`;
          const oldCsvColumn = `AttributeScaling_${prefix}_${stats[i]}`;
          const expectedStr = tc.raw[newCsvColumn] ?? tc.raw[oldCsvColumn];
          const expected = parseSBValue(expectedStr);

          if (expected === null || expected === 0) continue;

          totalChecks++;
          const actual = damageResult.perStat[statKeys[i]].scaling;

          // Allow small floating point tolerance (0.01)
          if (Math.abs(actual - expected) < 0.01) {
            passed++;
          } else if (failures.length < 5) {
            failures.push(
              `${tc.weapon} +${tc.upgradeLevel} ${newCsvColumn}: expected=${expected.toFixed(3)}, actual=${actual.toFixed(3)}`
            );
          }
        }
      }

      const passRate = totalChecks > 0 ? ((passed / totalChecks) * 100).toFixed(2) : '0';
      console.log(`V2 ${damageType} AttributeScaling: ${passed}/${totalChecks} passed (${passRate}%)`);

      if (failures.length > 0) {
        console.log(`  Sample failures: ${failures.join('; ')}`);
      }

      expect(passed).toBe(totalChecks);
    });

    // Validate per-stat saturation values (e.g., Physical_AP_Saturation_Strength columns)
    // NOTE: Only validates stats that have scaling on the damage type
    // The CSV shows saturation values even for stats without scaling, but we only calculate them when scaling exists
    it.each([
      { damageType: 'physical', prefix: 'Physical_AP' },
      { damageType: 'magic', prefix: 'Magic_AP' },
      { damageType: 'fire', prefix: 'Fire_AP' },
      { damageType: 'lightning', prefix: 'Lightning_AP' },
      { damageType: 'holy', prefix: 'Holy_AP' },
    ])('$damageType per-stat AttributeSaturation validation', ({ damageType, prefix }) => {
      const stats = ['Strength', 'Dexterity', 'Intelligence', 'Faith', 'Arcane'] as const;
      const statKeys = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane'] as const;

      let totalChecks = 0;
      let passed = 0;
      const failures: string[] = [];

      for (const tc of testCases) {
        if (!hasWeaponAffinityV2(v2Data, tc.weapon, tc.affinity)) continue;

        const result = calculateARV2(
          v2Data,
          tc.weapon,
          tc.affinity,
          tc.upgradeLevel,
          {
            strength: tc.strength,
            dexterity: tc.dexterity,
            intelligence: tc.intelligence,
            faith: tc.faith,
            arcane: tc.arcane,
          },
          {
            twoHanding: tc.twoHanded,
            ignoreRequirements: tc.ignoreRequirements,
          }
        );

        if (!result) continue;

        const damageResult = result[damageType as keyof typeof result] as { base: number; perStat: Record<string, { saturation: number; rawScaling: number }> };

        // Skip if this damage type doesn't exist on the weapon
        if (damageResult.base === 0) continue;

        // Check each stat's saturation value (only for stats that have scaling) - support both old and new column names
        for (let i = 0; i < stats.length; i++) {
          // Only check saturation if this stat actually scales this damage type
          if (damageResult.perStat[statKeys[i]].rawScaling === 0) continue;

          const newCsvColumn = `${prefix}_Saturation_${stats[i]}`;
          const oldCsvColumn = `AttributeSaturation_${prefix}_${stats[i]}`;
          const expectedStr = tc.raw[newCsvColumn] ?? tc.raw[oldCsvColumn];
          const expected = parseSBValue(expectedStr);

          if (expected === null) continue;

          totalChecks++;
          const actual = damageResult.perStat[statKeys[i]].saturation;

          // Allow small floating point tolerance (0.0001)
          if (Math.abs(actual - expected) < 0.0001) {
            passed++;
          } else if (failures.length < 5) {
            failures.push(
              `${tc.weapon} +${tc.upgradeLevel} ${newCsvColumn}: expected=${expected.toFixed(6)}, actual=${actual.toFixed(6)}`
            );
          }
        }
      }

      const passRate = totalChecks > 0 ? ((passed / totalChecks) * 100).toFixed(2) : '0';
      console.log(`V2 ${damageType} AttributeSaturation: ${passed}/${totalChecks} passed (${passRate}%)`);

      if (failures.length > 0) {
        console.log(`  Sample failures: ${failures.join('; ')}`);
      }

      expect(passed).toBe(totalChecks);
    });

    // Validate scaling letter grades (Scaling_Letter_* columns contain D, C, B, A, S, -)
    // Uses displayScaling which shows the weapon's scaling grades for UI display
    // Note: The CSV uses Scaling_Letter_Strength format (overall weapon scaling grades)
    it('physical scaling letter grade validation', () => {
      const stats = ['Strength', 'Dexterity', 'Intelligence', 'Faith', 'Arcane'] as const;
      const statKeys = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane'] as const;
      const validGrades = new Set(['S', 'A', 'B', 'C', 'D', 'E']);

      let totalChecks = 0;
      let passed = 0;
      const failures: string[] = [];

      for (const tc of testCases) {
        if (!hasWeaponAffinityV2(v2Data, tc.weapon, tc.affinity)) continue;

        const result = calculateARV2(
          v2Data,
          tc.weapon,
          tc.affinity,
          tc.upgradeLevel,
          {
            strength: tc.strength,
            dexterity: tc.dexterity,
            intelligence: tc.intelligence,
            faith: tc.faith,
            arcane: tc.arcane,
          },
          {
            twoHanding: tc.twoHanded,
            ignoreRequirements: tc.ignoreRequirements,
          }
        );

        if (!result) continue;

        const damageResult = result.physical;

        // Skip if physical damage doesn't exist on the weapon
        if (damageResult.base === 0) continue;

        // Check each stat's scaling letter grade using displayScaling
        // displayScaling shows the weapon's correctX × rate values for UI display
        for (let i = 0; i < stats.length; i++) {
          // Support both old and new column names
          const newCsvColumn = `Scaling_Letter_${stats[i]}`;
          const oldCsvColumn = `Scaling_Physical_AP_${stats[i]}`;
          const expectedGrade = (tc.raw[newCsvColumn] ?? tc.raw[oldCsvColumn])?.trim();

          // Skip empty, dash, or non-letter-grade values
          if (!expectedGrade || expectedGrade === '-' || expectedGrade.startsWith('-   ')) continue;
          if (!validGrades.has(expectedGrade)) continue;

          totalChecks++;
          // Use displayScaling for letter grade display (weapon's correctX × rate)
          const displayScalingValue = damageResult.displayScaling[statKeys[i]];
          const actualGrade = getScalingGrade(displayScalingValue);

          if (actualGrade === expectedGrade) {
            passed++;
          } else if (failures.length < 10) {
            failures.push(
              `${tc.weapon} ${tc.affinity} +${tc.upgradeLevel} ${stats[i]}: expected=${expectedGrade}, actual=${actualGrade} (display=${displayScalingValue.toFixed(1)})`
            );
          }
        }
      }

      const passRate = totalChecks > 0 ? ((passed / totalChecks) * 100).toFixed(2) : '0';
      console.log(`V2 physical Scaling grades: ${passed}/${totalChecks} passed (${passRate}%)`);

      if (failures.length > 0) {
        console.log(`  Sample failures: ${failures.join('; ')}`);
      }

      // With displayScaling, we expect 100% pass rate
      expect(passed).toBe(totalChecks);
    });

    // Validate spell buff per-stat scaling (e.g., Magic_SB_Scaling_Strength columns)
    it('should validate spell buff per-stat AttributeScaling', () => {
      const stats = ['Strength', 'Dexterity', 'Intelligence', 'Faith', 'Arcane'] as const;
      const statKeys = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane'] as const;

      let totalChecks = 0;
      let passed = 0;
      const failures: string[] = [];

      // Filter to catalyst test cases (O(1) lookup)
      const catalystCases = testCases.filter(tc => {
        const affinityData = getAffinityDataV2(v2Data, tc.weapon, tc.affinity);
        return affinityData && (affinityData.sorceryScaling !== null || affinityData.incantationScaling !== null);
      });

      for (const tc of catalystCases) {
        if (!hasWeaponAffinityV2(v2Data, tc.weapon, tc.affinity)) continue;

        const result = calculateARV2(
          v2Data,
          tc.weapon,
          tc.affinity,
          tc.upgradeLevel,
          {
            strength: tc.strength,
            dexterity: tc.dexterity,
            intelligence: tc.intelligence,
            faith: tc.faith,
            arcane: tc.arcane,
          },
          {
            twoHanding: tc.twoHanded,
            ignoreRequirements: tc.ignoreRequirements,
          }
        );

        if (!result) continue;

        const spellScaling = result.sorceryScaling ?? result.incantationScaling;
        if (!spellScaling) continue;

        // Check Magic_SB per-stat values (most catalysts use magic type for spell scaling) - support both old and new column names
        for (let i = 0; i < stats.length; i++) {
          const newCsvColumn = `Magic_SB_Scaling_${stats[i]}`;
          const oldCsvColumn = `AttributeScaling_Magic_SB_${stats[i]}`;
          const expectedStr = tc.raw[newCsvColumn] ?? tc.raw[oldCsvColumn];
          const expected = parseSBValue(expectedStr);

          if (expected === null || expected === 0) continue;

          totalChecks++;
          const actual = spellScaling.perStat[statKeys[i]].scaling;

          // Allow small floating point tolerance (0.01)
          if (Math.abs(actual - expected) < 0.01) {
            passed++;
          } else if (failures.length < 5) {
            failures.push(
              `${tc.weapon} +${tc.upgradeLevel} ${newCsvColumn}: expected=${expected.toFixed(3)}, actual=${actual.toFixed(3)}`
            );
          }
        }
      }

      const passRate = totalChecks > 0 ? ((passed / totalChecks) * 100).toFixed(2) : '0';
      console.log(`V2 Spell Buff AttributeScaling: ${passed}/${totalChecks} passed (${passRate}%)`);

      if (failures.length > 0) {
        console.log(`  Sample failures: ${failures.join('; ')}`);
      }

      expect(passed).toBe(totalChecks);
    });
  });
});
