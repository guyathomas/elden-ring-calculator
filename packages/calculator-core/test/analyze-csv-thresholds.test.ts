/**
 * Analyze CSV data to extract actual grade thresholds and saturation behavior
 * Run with: npx vitest run test/analyze-csv-thresholds.ts
 */

import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { parseTestCasesCsv, type TestCaseRow } from '../src/paramParser.js';
import { buildPrecomputedDataV2 } from '../src/paramBuilder.js';
import { hasWeaponAffinityV2, resolveWeaponAtLevel, calculateARV2 } from '../src/calculator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PARAM_FILES_DIR = join(__dirname, '..', 'param-files');
const TEST_CASES_CSV = join(__dirname, '..', 'er-calc-ap-test-cases.csv');

// Skip in CI - these are analysis/debugging tests that just print console output
// They have no assertions and take too long on slower CI runners
describe.skipIf(process.env.CI)('CSV Data Analysis', () => {
  it('should extract grade thresholds from CSV data', () => {
    const csv = readFileSync(TEST_CASES_CSV, 'utf-8');
    const testCases = parseTestCasesCsv(csv);

    const weaponNames = [...new Set(testCases.map(tc => tc.weapon))];
    const v2Data = buildPrecomputedDataV2(PARAM_FILES_DIR, { weaponFilter: weaponNames });

    // Collect grade -> displayScaling mappings
    const gradeToScaling = new Map<string, { min: number; max: number; values: number[] }>();
    const stats = ['Strength', 'Dexterity', 'Intelligence', 'Faith', 'Arcane'];
    const statKeys = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane'] as const;

    for (const tc of testCases) {
      if (!hasWeaponAffinityV2(v2Data, tc.weapon, tc.affinity)) continue;

      const resolved = resolveWeaponAtLevel(v2Data, tc.weapon, tc.affinity, tc.upgradeLevel);
      if (!resolved) continue;

      for (let i = 0; i < stats.length; i++) {
        const csvColumn = `Scaling_Physical_AP_${stats[i]}`;
        const grade = tc.raw[csvColumn]?.trim();

        if (!grade || grade === '-') continue;

        const displayValue = resolved.weaponScaling[statKeys[i]];

        if (!gradeToScaling.has(grade)) {
          gradeToScaling.set(grade, { min: Infinity, max: -Infinity, values: [] });
        }

        const entry = gradeToScaling.get(grade)!;
        entry.min = Math.min(entry.min, displayValue);
        entry.max = Math.max(entry.max, displayValue);
        entry.values.push(displayValue);
      }
    }

    console.log('\n========================================');
    console.log('Grade thresholds from CSV data (Physical):');
    console.log('========================================');

    const sortedGrades = [...gradeToScaling.entries()].sort((a, b) => a[1].min - b[1].min);

    for (const [grade, data] of sortedGrades) {
      const uniqueValues = [...new Set(data.values)].sort((a, b) => a - b);
      console.log(`\nGrade ${grade}:`);
      console.log(`  Range: ${data.min.toFixed(2)} - ${data.max.toFixed(2)}`);
      console.log(`  Sample count: ${data.values.length}`);
      console.log(`  Unique values: ${uniqueValues.length}`);
      if (uniqueValues.length <= 20) {
        console.log(`  Values: ${uniqueValues.map(v => v.toFixed(1)).join(', ')}`);
      } else {
        console.log(`  First 10: ${uniqueValues.slice(0, 10).map(v => v.toFixed(1)).join(', ')}`);
        console.log(`  Last 10: ${uniqueValues.slice(-10).map(v => v.toFixed(1)).join(', ')}`);
      }
    }

    // Print threshold boundaries
    console.log('\n========================================');
    console.log('Inferred thresholds:');
    console.log('========================================');
    for (let i = 0; i < sortedGrades.length; i++) {
      const [grade, data] = sortedGrades[i];
      const nextGrade = sortedGrades[i + 1];
      if (nextGrade) {
        const gap = nextGrade[1].min - data.max;
        console.log(`${grade} -> ${nextGrade[0]}: threshold between ${data.max.toFixed(2)} and ${nextGrade[1].min.toFixed(2)} (gap: ${gap.toFixed(2)})`);
      }
    }
  });

  it('should analyze saturation for stats without scaling', () => {
    const csv = readFileSync(TEST_CASES_CSV, 'utf-8');
    const testCases = parseTestCasesCsv(csv);

    const weaponNames = [...new Set(testCases.map(tc => tc.weapon))];
    const v2Data = buildPrecomputedDataV2(PARAM_FILES_DIR, { weaponFilter: weaponNames });

    const stats = ['Strength', 'Dexterity', 'Intelligence', 'Faith', 'Arcane'];
    const statKeys = ['strength', 'dexterity', 'intelligence', 'faith', 'arcane'] as const;

    // Analyze all saturation values in CSV
    let totalCsvSaturationValues = 0;
    let csvSaturationWithValue = 0;
    let csvSaturationZeroOrEmpty = 0;
    let ourRawScalingZeroCount = 0;
    let mismatchCount = 0;

    // Find cases where CSV has saturation but our calculator has rawScaling=0
    const saturationWithoutScaling: Array<{
      weapon: string;
      affinity: string;
      stat: string;
      csvSaturation: number;
      csvSaturationStr: string;
      ourSaturation: number;
      ourRawScaling: number;
    }> = [];

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

      // Check Physical damage
      const damageResult = result.physical;
      if (damageResult.base === 0) continue;

      for (let i = 0; i < stats.length; i++) {
        const csvColumn = `AttributeSaturation_Physical_AP_${stats[i]}`;
        const csvValueStr = tc.raw[csvColumn] ?? '';
        totalCsvSaturationValues++;

        const ourSaturation = damageResult.perStat[statKeys[i]].saturation;
        const ourRawScaling = damageResult.perStat[statKeys[i]].rawScaling;

        if (ourRawScaling === 0) {
          ourRawScalingZeroCount++;
        }

        // Check if CSV has a value
        if (!csvValueStr || csvValueStr.trim() === '' || csvValueStr.trim() === '-') {
          csvSaturationZeroOrEmpty++;
          continue;
        }

        const csvSaturation = parseFloat(csvValueStr);
        if (isNaN(csvSaturation)) {
          csvSaturationZeroOrEmpty++;
          continue;
        }

        if (csvSaturation === 0) {
          csvSaturationZeroOrEmpty++;
        } else {
          csvSaturationWithValue++;
        }

        // If CSV has non-zero saturation but we have zero rawScaling
        if (csvSaturation > 0 && ourRawScaling === 0) {
          mismatchCount++;
          saturationWithoutScaling.push({
            weapon: tc.weapon,
            affinity: tc.affinity,
            stat: stats[i],
            csvSaturation,
            csvSaturationStr: csvValueStr,
            ourSaturation,
            ourRawScaling,
          });
        }
      }
    }

    console.log('\n========================================');
    console.log('Saturation Analysis Summary:');
    console.log('========================================');
    console.log(`Total CSV saturation cells checked: ${totalCsvSaturationValues}`);
    console.log(`CSV cells with non-zero saturation: ${csvSaturationWithValue}`);
    console.log(`CSV cells empty/zero/-: ${csvSaturationZeroOrEmpty}`);
    console.log(`Our rawScaling=0 count: ${ourRawScalingZeroCount}`);
    console.log(`Mismatches (CSV has value, we have rawScaling=0): ${mismatchCount}`);

    if (saturationWithoutScaling.length > 0) {
      console.log('\nMismatch examples:');
      for (let i = 0; i < Math.min(10, saturationWithoutScaling.length); i++) {
        const item = saturationWithoutScaling[i];
        console.log(`  ${item.weapon} ${item.affinity} ${item.stat}: CSV="${item.csvSaturationStr}" (${item.csvSaturation}), our rawScaling=${item.ourRawScaling}`);
      }
    }
  });

  it('should check what CSV shows for stats that dont affect damage', () => {
    const csv = readFileSync(TEST_CASES_CSV, 'utf-8');
    const testCases = parseTestCasesCsv(csv);

    // Just look at Flame Art Uchigatana - we know Faith doesn't affect Physical
    const flameArtCases = testCases.filter(tc =>
      tc.weapon === 'Uchigatana' && tc.affinity === 'Flame Art'
    );

    console.log('\n========================================');
    console.log('Flame Art Uchigatana - Faith vs Physical:');
    console.log('(Faith affects Fire, NOT Physical)');
    console.log('========================================');

    for (const tc of flameArtCases.slice(0, 5)) {
      const satStr = tc.raw['AttributeSaturation_Physical_AP_Faith'];
      const scalingStr = tc.raw['AttributeScaling_Physical_AP_Faith'];
      const gradeStr = tc.raw['Scaling_Physical_AP_Faith'];

      console.log(`\n+${tc.upgradeLevel} STR=${tc.strength} DEX=${tc.dexterity} FTH=${tc.faith}:`);
      console.log(`  Saturation: "${satStr}"`);
      console.log(`  Scaling: "${scalingStr}"`);
      console.log(`  Grade: "${gradeStr}"`);
    }
  });
});
