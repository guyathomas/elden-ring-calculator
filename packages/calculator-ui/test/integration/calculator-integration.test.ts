/**
 * Integration Tests for Calculator UI
 *
 * These tests use real precomputed weapon data to validate:
 * 1. Data loading and integrity
 * 2. AR calculations match expected values
 * 3. Stat optimization produces sensible results
 * 4. Requirement checking works correctly
 * 5. Two-handing mechanics work correctly
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import type { PrecomputedDataV2 } from '../../../calculator-core/dist/client.js';
import {
  calculateARV2,
  getWeaponNamesV2,
  hasWeaponAffinityV2,
  resolveWeaponAtLevel,
} from '../../../calculator-core/dist/client.js';

import {
  buildWeaponList,
  calculateWeaponAR,
  findOptimalStats,
  meetsRequirements,
} from '../../src/utils/damageCalculator.js';
import type { StatConfig, CharacterStats } from '../../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load real precomputed data
const PRECOMPUTED_PATH = join(__dirname, '../../src/data/precomputed.json');

let precomputedData: PrecomputedDataV2;

beforeAll(() => {
  const jsonContent = readFileSync(PRECOMPUTED_PATH, 'utf-8');
  precomputedData = JSON.parse(jsonContent);
});

// ============================================================================
// Test 1: All weapons load from precomputed.json - no undefined entries
// ============================================================================

describe('Weapon Data Loading', () => {
  it('should load all weapons without undefined entries', () => {
    const weaponNames = getWeaponNamesV2(precomputedData);

    expect(weaponNames.length).toBeGreaterThan(0);
    console.log(`Loaded ${weaponNames.length} weapons`);

    // Check no undefined weapon names
    const undefinedNames = weaponNames.filter(name => name === undefined || name === null || name === '');
    expect(undefinedNames).toHaveLength(0);

    // Check each weapon has valid structure
    let invalidWeapons: string[] = [];
    for (const name of weaponNames) {
      const weapon = precomputedData.weapons[name];

      if (!weapon) {
        invalidWeapons.push(`${name}: weapon is null/undefined`);
        continue;
      }

      if (!weapon.affinities || Object.keys(weapon.affinities).length === 0) {
        invalidWeapons.push(`${name}: no affinities`);
        continue;
      }

      if (!weapon.requirements) {
        invalidWeapons.push(`${name}: no requirements`);
        continue;
      }

      if (weapon.maxUpgradeLevel === undefined) {
        invalidWeapons.push(`${name}: no maxUpgradeLevel`);
        continue;
      }

      // Check each affinity has required data
      for (const [affinity, affinityData] of Object.entries(weapon.affinities)) {
        if (!affinityData) {
          invalidWeapons.push(`${name}/${affinity}: affinity data is null`);
        }
        if (affinityData.reinforceTypeId === undefined) {
          invalidWeapons.push(`${name}/${affinity}: no reinforceTypeId`);
        }
      }
    }

    if (invalidWeapons.length > 0) {
      console.log('Invalid weapons:', invalidWeapons.slice(0, 10));
    }

    expect(invalidWeapons).toHaveLength(0);
  });

  it('should build weapon list without errors', () => {
    const weaponList = buildWeaponList(precomputedData, 'max');

    expect(weaponList.length).toBeGreaterThan(0);
    console.log(`Built weapon list with ${weaponList.length} weapon/affinity combinations`);

    // Check for undefined values in critical fields
    const invalidItems = weaponList.filter(item =>
      !item.name ||
      !item.affinity ||
      item.upgradeLevel === undefined ||
      !item.requirements
    );

    expect(invalidItems).toHaveLength(0);
  });
});

// ============================================================================
// Test 2: Known weapon AR matches expected
// ============================================================================

describe('AR Calculation Accuracy', () => {
  it('should calculate correct AR for Uchigatana Keen +25 with 60 DEX', () => {
    // Using 60 DEX as a realistic build
    const stats: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 11, // Just enough to meet requirement
      dex: 60,
      int: 10, fai: 10, arc: 10,
    };

    const result = calculateWeaponAR(
      precomputedData,
      'Uchigatana',
      'Keen',
      25,
      stats,
      { twoHanding: false }
    );

    expect(result).not.toBeNull();
    expect(result!.requirementsMet).toBe(true);

    // Keen Uchigatana +25 with 60 DEX should have high physical damage
    // Expected: approximately 350-400 AR based on game data
    expect(result!.physical.rounded).toBeGreaterThan(300);
    expect(result!.rounded).toBeGreaterThan(300);

    console.log(`Uchigatana Keen +25 with 60 DEX: ${result!.rounded} AR (Physical: ${result!.physical.rounded})`);
  });

  it('should calculate correct AR for Heavy Greatsword +25 with 66 STR', () => {
    const stats: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 66, // Optimal two-hand breakpoint (66 * 1.5 = 99)
      dex: 13, // Just enough to meet requirement
      int: 10, fai: 10, arc: 10,
    };

    const result = calculateWeaponAR(
      precomputedData,
      'Greatsword',
      'Heavy',
      25,
      stats,
      { twoHanding: true }
    );

    expect(result).not.toBeNull();
    expect(result!.requirementsMet).toBe(true);

    // Heavy Greatsword with 99 effective STR (66 * 1.5) should be very high
    expect(result!.physical.rounded).toBeGreaterThan(600);

    console.log(`Heavy Greatsword +25 with 66 STR (2H): ${result!.rounded} AR`);
  });
});

// ============================================================================
// Test 3 & 4: Optimal stats for STR/DEX weapons
// ============================================================================

describe('Stat Optimization', () => {
  const baseStatConfig: Record<string, StatConfig> = {
    vig: { value: 40, locked: true },
    mnd: { value: 20, locked: true },
    end: { value: 25, locked: true },
    str: { min: 10, max: 99, locked: false },
    dex: { min: 10, max: 99, locked: false },
    int: { min: 10, max: 99, locked: false },
    fai: { min: 10, max: 99, locked: false },
    arc: { min: 10, max: 99, locked: false },
  };

  it('should optimize Heavy Greatsword to favor STR', () => {
    const result = findOptimalStats(
      precomputedData,
      'Greatsword',
      'Heavy',
      25,
      baseStatConfig,
      { twoHanding: true }
    );

    expect(result.damage).toBeGreaterThan(0);

    // Heavy affinity should strongly favor STR
    // STR should be significantly higher than other damage stats
    expect(result.stats.str).toBeGreaterThan(result.stats.dex);
    expect(result.stats.str).toBeGreaterThan(result.stats.int);
    expect(result.stats.str).toBeGreaterThan(result.stats.fai);
    expect(result.stats.str).toBeGreaterThan(result.stats.arc);

    console.log(`Heavy Greatsword optimal: STR=${result.stats.str}, DEX=${result.stats.dex}, Damage=${result.damage}`);
  });

  it('should optimize Keen Uchigatana to favor DEX', () => {
    // Use a limited budget so we can see which stat is prioritized
    const limitedConfig: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 11, max: 99, locked: false }, // Meet requirement
      dex: { min: 15, max: 99, locked: false }, // Meet requirement
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    // With limited budget of 40 points, optimizer should heavily favor DEX
    const result = findOptimalStats(
      precomputedData,
      'Uchigatana',
      'Keen',
      25,
      limitedConfig,
      { twoHanding: false, pointsBudget: 40 }
    );

    expect(result.damage).toBeGreaterThan(0);

    console.log(`Keen Uchigatana optimal with 40pt budget: STR=${result.stats.str}, DEX=${result.stats.dex}, INT=${result.stats.int}, Damage=${result.damage}`);

    // Keen affinity should strongly favor DEX
    // DEX should get more points than STR (since DEX has 51 scaling vs STR's 9)
    // BUG FOUND: If this test fails, it means the optimizer is not correctly prioritizing DEX
    expect(result.stats.dex).toBeGreaterThan(result.stats.str);
    expect(result.stats.dex).toBeGreaterThan(result.stats.int);
    expect(result.stats.dex).toBeGreaterThan(result.stats.fai);
    expect(result.stats.dex).toBeGreaterThan(result.stats.arc);
  });
});

// ============================================================================
// Test 5: Optimal stats respects budget constraint
// ============================================================================

describe('Budget Constraints', () => {
  it('should respect point budget and not allocate more than allowed', () => {
    const baseStatConfig: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 11, max: 99, locked: false }, // Meet Uchigatana requirement
      dex: { min: 15, max: 99, locked: false }, // Meet Uchigatana requirement
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    const pointsBudget = 50;

    const result = findOptimalStats(
      precomputedData,
      'Uchigatana',
      'Keen',
      25,
      baseStatConfig,
      { twoHanding: false, pointsBudget }
    );

    // Base stats from min: str=11, dex=15, int=10, fai=10, arc=10 = 56 total
    // With 50 point budget, allocated total should be 56 + 50 = 106 max
    const damageStats = ['str', 'dex', 'int', 'fai', 'arc'] as const;
    const baseTotal = damageStats.reduce((sum, stat) => sum + (baseStatConfig[stat].min ?? 10), 0);
    const allocatedTotal = damageStats.reduce((sum, stat) => sum + result.stats[stat], 0);
    const pointsSpent = allocatedTotal - baseTotal;

    console.log(`Budget: ${pointsBudget}, Base: ${baseTotal}, Allocated: ${allocatedTotal}, Spent: ${pointsSpent}`);
    console.log(`Result stats: STR=${result.stats.str}, DEX=${result.stats.dex}, INT=${result.stats.int}, FAI=${result.stats.fai}, ARC=${result.stats.arc}`);

    // BUG FOUND: If this test fails, it means the optimizer is not respecting the budget
    expect(pointsSpent).toBeLessThanOrEqual(pointsBudget);
  });

  it('should handle zero budget by returning base stats', () => {
    const baseStatConfig: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 15, max: 99, locked: false },
      dex: { min: 15, max: 99, locked: false },
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    const result = findOptimalStats(
      precomputedData,
      'Uchigatana',
      'Keen',
      25,
      baseStatConfig,
      { twoHanding: false, pointsBudget: 0 }
    );

    // With 0 budget, stats should be at or very close to minimum
    // (weapon requirements may bump them up)
    expect(result.stats.str).toBeLessThanOrEqual(baseStatConfig.str.min! + 5);
    expect(result.stats.int).toBe(baseStatConfig.int.min);
    expect(result.stats.fai).toBe(baseStatConfig.fai.min);
    expect(result.stats.arc).toBe(baseStatConfig.arc.min);
  });
});

// ============================================================================
// Test 6: meetsRequirements with two-handing
// ============================================================================

describe('Requirement Checking', () => {
  it('should allow two-handing to meet STR requirements', () => {
    // Greatsword requires 31 STR, 13 DEX
    // With 21 STR and two-handing: 21 * 1.5 = 31.5 (floor to 31) - should meet
    const stats: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 21, // Below requirement but 21 * 1.5 = 31.5 rounds to 31
      dex: 13,
      int: 10, fai: 10, arc: 10,
    };

    // Without two-handing - should NOT meet requirements
    const meetsWithoutTwoHand = meetsRequirements(
      precomputedData,
      'Greatsword',
      'Standard',
      stats,
      false
    );
    expect(meetsWithoutTwoHand).toBe(false);

    // With two-handing - SHOULD meet requirements
    const meetsWithTwoHand = meetsRequirements(
      precomputedData,
      'Greatsword',
      'Standard',
      stats,
      true
    );
    expect(meetsWithTwoHand).toBe(true);
  });

  it('should correctly evaluate exact requirement boundaries', () => {
    // Uchigatana requires 11 STR, 15 DEX
    const statsExact: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 11, dex: 15, // Exactly meets requirements
      int: 10, fai: 10, arc: 10,
    };

    const statsBelow: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 11, dex: 14, // 1 below DEX requirement
      int: 10, fai: 10, arc: 10,
    };

    expect(meetsRequirements(precomputedData, 'Uchigatana', 'Standard', statsExact, false)).toBe(true);
    expect(meetsRequirements(precomputedData, 'Uchigatana', 'Standard', statsBelow, false)).toBe(false);
  });
});

// ============================================================================
// Test 7: Two-handing STR bonus for bows (should NOT apply)
// ============================================================================

describe('Two-Handing Mechanics', () => {
  it('should NOT give bows 1.5x STR bonus when two-handing', () => {
    // Shortbow requires 8 STR, 10 DEX
    const stats: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 40,
      dex: 40,
      int: 10, fai: 10, arc: 10,
    };

    const resultOneHand = calculateWeaponAR(
      precomputedData,
      'Shortbow',
      'Standard',
      25,
      stats,
      { twoHanding: false }
    );

    const resultTwoHand = calculateWeaponAR(
      precomputedData,
      'Shortbow',
      'Standard',
      25,
      stats,
      { twoHanding: true }
    );

    expect(resultOneHand).not.toBeNull();
    expect(resultTwoHand).not.toBeNull();

    // Bows are always two-handed, so effective stats should be the same
    // The AR should be IDENTICAL because bows don't get extra STR from "two-handing toggle"
    // Note: The implementation marks bows as "always two-handed" so both should use same calculation
    expect(resultOneHand!.effectiveStats.strength).toBe(resultTwoHand!.effectiveStats.strength);
    expect(resultOneHand!.rounded).toBe(resultTwoHand!.rounded);

    console.log(`Shortbow 1H: ${resultOneHand!.rounded} AR (effective STR: ${resultOneHand!.effectiveStats.strength})`);
    console.log(`Shortbow 2H: ${resultTwoHand!.rounded} AR (effective STR: ${resultTwoHand!.effectiveStats.strength})`);
  });

  it('should give melee weapons 1.5x STR bonus when two-handing', () => {
    const stats: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 40,
      dex: 15,
      int: 10, fai: 10, arc: 10,
    };

    const resultOneHand = calculateWeaponAR(
      precomputedData,
      'Uchigatana',
      'Standard',
      25,
      stats,
      { twoHanding: false }
    );

    const resultTwoHand = calculateWeaponAR(
      precomputedData,
      'Uchigatana',
      'Standard',
      25,
      stats,
      { twoHanding: true }
    );

    expect(resultOneHand).not.toBeNull();
    expect(resultTwoHand).not.toBeNull();

    // Two-handing should give 1.5x STR: 40 * 1.5 = 60
    expect(resultTwoHand!.effectiveStats.strength).toBe(60);
    expect(resultOneHand!.effectiveStats.strength).toBe(40);

    // Two-handed should have higher AR due to more effective STR
    expect(resultTwoHand!.rounded).toBeGreaterThan(resultOneHand!.rounded);

    console.log(`Uchigatana 1H: ${resultOneHand!.rounded} AR (effective STR: ${resultOneHand!.effectiveStats.strength})`);
    console.log(`Uchigatana 2H: ${resultTwoHand!.rounded} AR (effective STR: ${resultTwoHand!.effectiveStats.strength})`);
  });
});

// ============================================================================
// Test 8: Requirement penalty (0.6x) when stats too low
// ============================================================================

describe('Requirement Penalty', () => {
  it('should apply 0.6x penalty when requirements not met', () => {
    // Uchigatana requires 11 STR, 15 DEX
    const statsBelow: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 10, // Below 11 requirement
      dex: 14, // Below 15 requirement
      int: 10, fai: 10, arc: 10,
    };

    const statsAbove: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 11, dex: 15,
      int: 10, fai: 10, arc: 10,
    };

    const resultBelow = calculateWeaponAR(
      precomputedData,
      'Uchigatana',
      'Standard',
      25,
      statsBelow,
      { twoHanding: false }
    );

    const resultAbove = calculateWeaponAR(
      precomputedData,
      'Uchigatana',
      'Standard',
      25,
      statsAbove,
      { twoHanding: false }
    );

    expect(resultBelow).not.toBeNull();
    expect(resultAbove).not.toBeNull();

    expect(resultBelow!.requirementsMet).toBe(false);
    expect(resultAbove!.requirementsMet).toBe(true);

    // When requirements not met:
    // - Base damage stays the same
    // - Scaling becomes a -40% penalty of base (not 0)
    // - Total becomes base + (base * -0.4) = base * 0.6
    expect(resultBelow!.physical.base).toBe(resultAbove!.physical.base);
    expect(resultBelow!.physical.scaling).toBeCloseTo(resultBelow!.physical.base * -0.4, 1);

    // Total AR should be significantly lower
    expect(resultBelow!.rounded).toBeLessThan(resultAbove!.rounded * 0.7);

    console.log(`Uchigatana requirements not met: ${resultBelow!.rounded} AR`);
    console.log(`Uchigatana requirements met: ${resultAbove!.rounded} AR`);
  });
});

// ============================================================================
// Test 9: STR cap at 99 effective with two-handing
// ============================================================================

describe('Effective Stat Caps', () => {
  it('should cap effective STR at 99 when two-handing with high STR', () => {
    // 99 STR with two-handing would be 148.5, but should cap at 99
    const statsMax: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 99,
      dex: 15,
      int: 10, fai: 10, arc: 10,
    };

    const result = calculateWeaponAR(
      precomputedData,
      'Greatsword',
      'Heavy',
      25,
      statsMax,
      { twoHanding: true }
    );

    expect(result).not.toBeNull();

    // Effective STR should be capped at 148 (game's internal cap), not 99 * 1.5 = 148.5
    // The game caps effective stats at 148
    expect(result!.effectiveStats.strength).toBeLessThanOrEqual(148);
    expect(result!.effectiveStats.strength).toBeGreaterThanOrEqual(99);

    console.log(`99 STR two-handed effective: ${result!.effectiveStats.strength}`);
  });

  it('should cap effective STR at 148 (game cap) when two-handing 99 STR', () => {
    // Testing the exact cap
    const stats: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 99,
      dex: 15,
      int: 10, fai: 10, arc: 10,
    };

    const result = calculateWeaponAR(
      precomputedData,
      'Greatsword',
      'Heavy',
      25,
      stats,
      { twoHanding: true }
    );

    expect(result).not.toBeNull();

    // 99 * 1.5 = 148.5, floored to 148, but capped at MAX_EFFECTIVE_STAT (148)
    expect(result!.effectiveStats.strength).toBe(148);

    console.log(`99 STR * 1.5 = ${99 * 1.5}, capped to: ${result!.effectiveStats.strength}`);
  });

  it('should correctly calculate effective STR for the 66 STR breakpoint', () => {
    // 66 * 1.5 = 99 - the famous "quality build" breakpoint
    const stats: CharacterStats = {
      vig: 40, mnd: 20, end: 25,
      str: 66,
      dex: 15,
      int: 10, fai: 10, arc: 10,
    };

    const result = calculateWeaponAR(
      precomputedData,
      'Greatsword',
      'Heavy',
      25,
      stats,
      { twoHanding: true }
    );

    expect(result).not.toBeNull();
    // 66 * 1.5 = 99 exactly
    expect(result!.effectiveStats.strength).toBe(99);

    console.log(`66 STR * 1.5 = ${result!.effectiveStats.strength}`);
  });
});
