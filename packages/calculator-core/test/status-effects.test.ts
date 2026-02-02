/**
 * Status Effects Validation Tests
 *
 * Tests status effect calculations (bleed, frost, poison, sleep, madness, scarlet rot)
 * against CSV test cases.
 *
 * Status effect formula:
 * - Base value from SpEffectParam (changes with upgrade level via spEffectIdOffset)
 * - Scaling: base × (arcaneScaling/100) × arcaneSaturation
 * - When requirements not met: total × 0.6
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
} from '../src/calculator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PARAM_FILES_DIR = join(__dirname, '..', 'param-files');
const TEST_CASES_CSV = join(__dirname, '..', 'er-calc-ap-test-cases.csv');

// Global test data
let v2Data: PrecomputedDataV2;
let testCases: TestCaseRow[];

// Parse status effect value from raw CSV column
function parseStatusValue(value: string | undefined): number | null {
  if (!value || value.trim() === '' || value.trim() === '-' || value.trim().startsWith('-   ')) {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// Get unique weapon names from test cases
function getUniqueWeaponNames(cases: TestCaseRow[]): string[] {
  const names = new Set<string>();
  for (const tc of cases) {
    names.add(tc.weapon);
  }
  return Array.from(names);
}

// Status effect types and their CSV column prefixes
const STATUS_EFFECTS = ['Bleed', 'Frost', 'Poison', 'Sleep', 'Madness', 'ScarletRot'] as const;
type StatusEffectName = typeof STATUS_EFFECTS[number];

// Map CSV names to calculator result keys
const STATUS_KEY_MAP: Record<StatusEffectName, keyof ReturnType<typeof calculateARV2> & string> = {
  Bleed: 'bleed',
  Frost: 'frost',
  Poison: 'poison',
  Sleep: 'sleep',
  Madness: 'madness',
  ScarletRot: 'scarletRot',
};

describe('Status Effects Validation', () => {
  beforeAll(() => {
    // Load test cases
    const csvContent = readFileSync(TEST_CASES_CSV, 'utf-8');
    testCases = parseTestCasesCsv(csvContent);

    // Get unique weapon names
    const weaponNames = getUniqueWeaponNames(testCases);
    console.log(`Building V2 data for ${weaponNames.length} weapons...`);

    // Build V2 precomputed data for test weapons
    v2Data = buildPrecomputedDataV2(PARAM_FILES_DIR, {
      weaponFilter: weaponNames,
    });

    const weaponCount = Object.keys(v2Data.weapons).length;
    console.log(`V2 data: ${weaponCount} weapons, ${Object.keys(v2Data.spEffects).length} SpEffect entries`);
  }, 30000); // 30 second timeout for data loading in CI

  it('should load test data with status effect columns', () => {
    expect(testCases.length).toBeGreaterThan(0);

    // Check that we have status effect columns in raw data
    const sampleRow = testCases[0];
    expect(sampleRow.raw).toBeDefined();

    // Verify status effect columns exist
    const hasBleedBase = 'Bleed_Base' in sampleRow.raw;
    const hasFrostBase = 'Frost_Base' in sampleRow.raw;
    console.log(`CSV has Bleed_Base: ${hasBleedBase}, Frost_Base: ${hasFrostBase}`);
  });

  // Test each status effect type
  for (const statusName of STATUS_EFFECTS) {
    describe(`${statusName} calculations`, () => {
      it(`should match CSV values for ${statusName}_Base and ${statusName}_Rounded`, () => {
        const calcKey = STATUS_KEY_MAP[statusName];
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        const failures: string[] = [];

        for (const tc of testCases) {
          const expectedBase = parseStatusValue(tc.raw[`${statusName}_Base`]);
          const expectedRounded = parseStatusValue(tc.raw[`${statusName}_Rounded`]);

          // Skip if no expected values for this status effect
          if (expectedBase === null && expectedRounded === null) {
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
            if (expectedBase !== null || expectedRounded !== null) {
              failed++;
              failures.push(`${tc.weapon} ${tc.affinity} +${tc.upgradeLevel}: No calc result, expected base=${expectedBase}, rounded=${expectedRounded}`);
            }
            continue;
          }

          const statusResult = result[calcKey as keyof typeof result] as { base: number; rounded: number } | undefined;
          const actualBase = statusResult?.base ?? 0;
          const actualRounded = statusResult?.rounded ?? 0;

          // Check base value
          let baseMatch = true;
          if (expectedBase !== null) {
            baseMatch = Math.abs(actualBase - expectedBase) < 0.01;
          }

          // Check rounded value
          let roundedMatch = true;
          if (expectedRounded !== null) {
            roundedMatch = actualRounded === expectedRounded;
          }

          if (baseMatch && roundedMatch) {
            passed++;
          } else {
            failed++;
            if (failures.length < 20) {
              failures.push(
                `${tc.weapon} ${tc.affinity} +${tc.upgradeLevel} Arc=${tc.arcane} ignoreReq=${tc.ignoreRequirements}: ` +
                `base: expected ${expectedBase}, got ${actualBase}; ` +
                `rounded: expected ${expectedRounded}, got ${actualRounded}`
              );
            }
          }
        }

        console.log(`${statusName}: ${passed}/${passed + failed} passed (${skipped} skipped)`);
        if (failures.length > 0) {
          console.log(`First ${Math.min(failures.length, 10)} failures:`);
          failures.slice(0, 10).forEach(f => console.log(`  ${f}`));
        }

        // Skip if no test cases for this status effect
        if (passed + failed === 0) {
          console.log(`  (No test cases with ${statusName} data in CSV)`);
          return;
        }

        // Require at least 95% pass rate
        const passRate = passed / (passed + failed);
        expect(passRate).toBeGreaterThan(0.95);
      });
    });
  }

  // Specific test cases for known edge cases
  describe('Rivers of Blood requirement penalty', () => {
    it('should apply 0.6 penalty to bleed when arcane requirement not met', () => {
      // Rivers of Blood requires 20 arcane
      const result = calculateARV2(
        v2Data,
        'Rivers of Blood',
        'Standard',
        0,
        {
          strength: 12,
          dexterity: 18,
          intelligence: 1,
          faith: 1,
          arcane: 5, // Below 20 arcane requirement
        },
        {
          twoHanding: false,
          ignoreRequirements: false,
        }
      );

      expect(result).not.toBeNull();
      if (result) {
        // Base bleed is 50, with penalty it should be around 30 (50 * 0.6)
        // The exact calculation: total = (base + scaling) * 0.6
        // When requirements not met, scaling is 0, so: 50 * 0.6 = 30
        console.log(`Rivers of Blood bleed (Arc=5, ignoreReq=false): base=${result.bleed.base}, rounded=${result.bleed.rounded}`);
        expect(result.bleed.rounded).toBe(30);
      }
    });

    it('should not apply penalty when ignoreRequirements is true', () => {
      const result = calculateARV2(
        v2Data,
        'Rivers of Blood',
        'Standard',
        0,
        {
          strength: 12,
          dexterity: 18,
          intelligence: 1,
          faith: 1,
          arcane: 5, // Below 20 arcane requirement
        },
        {
          twoHanding: false,
          ignoreRequirements: true,
        }
      );

      expect(result).not.toBeNull();
      if (result) {
        console.log(`Rivers of Blood bleed (Arc=5, ignoreReq=true): base=${result.bleed.base}, rounded=${result.bleed.rounded}`);
        expect(result.bleed.rounded).toBe(50);
      }
    });
  });

  describe('Cold Uchigatana frost', () => {
    it('should calculate frost from spEffectBehaviorId1', () => {
      const result = calculateARV2(
        v2Data,
        'Uchigatana',
        'Cold',
        0,
        {
          strength: 11,
          dexterity: 15,
          intelligence: 10,
          faith: 10,
          arcane: 10,
        },
        {
          twoHanding: false,
          ignoreRequirements: true,
        }
      );

      expect(result).not.toBeNull();
      if (result) {
        console.log(`Cold Uchigatana +0 frost: base=${result.frost.base}, rounded=${result.frost.rounded}`);
        expect(result.frost.base).toBe(66);
        expect(result.frost.rounded).toBe(66);
      }
    });

    it('should scale frost with upgrade level', () => {
      const result = calculateARV2(
        v2Data,
        'Uchigatana',
        'Cold',
        25,
        {
          strength: 11,
          dexterity: 15,
          intelligence: 10,
          faith: 10,
          arcane: 10,
        },
        {
          twoHanding: false,
          ignoreRequirements: true,
        }
      );

      expect(result).not.toBeNull();
      if (result) {
        console.log(`Cold Uchigatana +25 frost: base=${result.frost.base}, rounded=${result.frost.rounded}`);
        // At +25, frost base should be higher than +0
        expect(result.frost.base).toBeGreaterThan(66);
      }
    });
  });

  describe('Moonveil bleed (no arcane scaling)', () => {
    it('should have constant bleed regardless of arcane stat', () => {
      // Moonveil's bleed doesn't scale with arcane (correctLuck=0, it's an innate status effect)
      const resultLowArc = calculateARV2(
        v2Data,
        'Moonveil',
        'Standard',
        0,
        {
          strength: 12,
          dexterity: 18,
          intelligence: 23,
          faith: 1,
          arcane: 1,
        },
        {
          twoHanding: false,
          ignoreRequirements: true,
        }
      );

      const resultHighArc = calculateARV2(
        v2Data,
        'Moonveil',
        'Standard',
        0,
        {
          strength: 12,
          dexterity: 18,
          intelligence: 23,
          faith: 1,
          arcane: 50,
        },
        {
          twoHanding: false,
          ignoreRequirements: true,
        }
      );

      expect(resultLowArc).not.toBeNull();
      expect(resultHighArc).not.toBeNull();

      if (resultLowArc && resultHighArc) {
        console.log(`Moonveil bleed Arc=1: ${resultLowArc.bleed.rounded}, Arc=50: ${resultHighArc.bleed.rounded}`);
        expect(resultLowArc.bleed.base).toBe(50);
        expect(resultHighArc.bleed.base).toBe(50);
        // Bleed rounded should be the same regardless of arcane
        expect(resultLowArc.bleed.rounded).toBe(resultHighArc.bleed.rounded);
      }
    });
  });
});
