/**
 * Enemy Damage Calculator Tests
 *
 * Test cases derived from the Desmos calculator:
 * https://www.desmos.com/calculator/npbqcl9apw
 *
 * These tests validate our implementation matches the documented
 * Elden Ring damage formulas exactly.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDefenseReduction,
  applyNegation,
  calculateSingleTypeDamage,
  calculateEnemyDamage,
} from '../src/enemyDamageCalculator.js';

describe('calculateDefenseReduction', () => {
  // Defense multiplier formula: m(r) where r = ATK/DEF
  // Tier 1 (r < 0.125): 0.1
  // Tier 2 (0.125 ≤ r < 1): 0.1 + (r - 0.125)² / 2.552
  // Tier 3 (1 ≤ r < 2.5): 0.7 - (2.5 - r)² / 7.5
  // Tier 4 (2.5 ≤ r < 8): 0.9 - (8 - r)² / 151.25
  // Tier 5 (r ≥ 8): 0.9

  it('should calculate tier 4 correctly (ratio 2.7949)', () => {
    // 2H Lordsworn: ATK=327, DEF=117, ratio=2.7949
    const result = calculateDefenseReduction(327, 117);
    const multiplier = result / 327;
    expect(multiplier).toBeCloseTo(0.7208703495416782, 10);
    expect(result).toBeCloseTo(235.7246043001288, 6);
  });

  it('should calculate tier 4 correctly (ratio 2.5128)', () => {
    // 1H Lordsworn: ATK=294, DEF=117, ratio=2.5128
    const result = calculateDefenseReduction(294, 117);
    const multiplier = result / 294;
    expect(multiplier).toBeCloseTo(0.7009313142180275, 10);
    expect(result).toBeCloseTo(206.07380638010008, 6);
  });

  it('should calculate tier 3 correctly (ratio 1.28)', () => {
    // Low AR: ATK=150, DEF=117, ratio=1.28
    const result = calculateDefenseReduction(150, 117);
    const multiplier = result / 150;
    expect(multiplier).toBeCloseTo(0.5022134560596099, 10);
    expect(result).toBeCloseTo(75.33201840894148, 6);
  });

  it('should calculate tier 2 correctly (ratio 0.85)', () => {
    // Very low AR: ATK=100, DEF=117, ratio=0.85
    // Note: Tier 2 formula has slight precision differences between implementations
    const result = calculateDefenseReduction(100, 117);
    const multiplier = result / 100;
    expect(multiplier).toBeCloseTo(0.3086, 4);
    expect(result).toBeCloseTo(30.86, 2);
  });

  it('should calculate tier 4 upper range correctly (ratio 4.27)', () => {
    // High AR: ATK=500, DEF=117, ratio=4.27
    const result = calculateDefenseReduction(500, 117);
    const multiplier = result / 500;
    expect(multiplier).toBeCloseTo(0.8081866419861757, 10);
    expect(result).toBeCloseTo(404.0933209930879, 6);
  });

  it('should handle zero attack', () => {
    expect(calculateDefenseReduction(0, 117)).toBe(0);
  });

  it('should handle zero defense (cap at 90%)', () => {
    const result = calculateDefenseReduction(327, 0);
    expect(result).toBe(327 * 0.9);
  });

  it('should calculate tier 1 correctly (ratio < 0.125 - "wall" tier)', () => {
    // ATK=10, DEF=117, ratio=0.085 (very high defense relative to attack)
    const result = calculateDefenseReduction(10, 117);
    const multiplier = result / 10;
    // Tier 1: multiplier = 0.1 (minimum)
    expect(multiplier).toBeCloseTo(0.1, 6);
    expect(result).toBeCloseTo(1, 6);
  });

  it('should calculate tier 5 correctly (ratio >= 8 - "cap" tier)', () => {
    // ATK=1000, DEF=117, ratio=8.55 (very high attack relative to defense)
    const result = calculateDefenseReduction(1000, 117);
    const multiplier = result / 1000;
    // Tier 5: multiplier = 0.9 (maximum)
    expect(multiplier).toBeCloseTo(0.9, 6);
    expect(result).toBeCloseTo(900, 6);
  });
});

describe('applyNegation', () => {
  it('should apply 0% negation (no reduction)', () => {
    expect(applyNegation(100, 0)).toBe(100);
  });

  it('should apply 20% negation', () => {
    expect(applyNegation(100, 20)).toBe(80);
  });

  it('should apply negative negation (vulnerability)', () => {
    expect(applyNegation(100, -10)).toBeCloseTo(110, 5);
  });
});

describe('calculateSingleTypeDamage', () => {
  it('should calculate damage with MV=100, no negation', () => {
    // 2H Lordsworn: AR=327, MV=100, DEF=117, NEG=0
    const result = calculateSingleTypeDamage(327, 100, 117, 0);
    expect(result).toBeCloseTo(235.7246043001288, 6);
  });

  it('should calculate damage with 20% negation', () => {
    // 2H with 20% negation: AR=327, MV=100, DEF=117, NEG=20
    const result = calculateSingleTypeDamage(327, 100, 117, 20);
    expect(result).toBeCloseTo(188.57968344010303, 6);
  });

  it('should calculate damage with MV=130 (heavy attack)', () => {
    // Heavy attack: AR=327, MV=130, DEF=117, NEG=0
    const result = calculateSingleTypeDamage(327, 130, 117, 0);
    expect(result).toBeCloseTo(328.9985134986226, 6);
  });

  it('should return 0 for zero base damage', () => {
    expect(calculateSingleTypeDamage(0, 100, 117, 0)).toBe(0);
  });
});

describe('calculateEnemyDamage', () => {
  const defaultDefenses = {
    defense: {
      physical: 117,
      strike: 117,
      slash: 117,
      pierce: 117,
      magic: 117,
      fire: 117,
      lightning: 117,
      holy: 117,
    },
    negation: {
      physical: 0,
      strike: 0,
      slash: 0,
      pierce: 0,
      magic: 0,
      fire: 0,
      lightning: 0,
      holy: 0,
    },
  };

  it('should calculate pure physical damage (2H Lordsworn)', () => {
    const result = calculateEnemyDamage({
      baseAR: { physical: 327, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: defaultDefenses,
    });

    expect(result.total).toBeCloseTo(235.7246043001288, 6);
    expect(result.rounded).toBe(236); // ceil(235.72)
    expect(result.byType.physical).toBeCloseTo(235.7246043001288, 6);
    expect(result.byType.fire).toBe(0);
  });

  it('should calculate pure physical damage (1H Lordsworn)', () => {
    const result = calculateEnemyDamage({
      baseAR: { physical: 294, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: defaultDefenses,
    });

    expect(result.total).toBeCloseTo(206.07380638010008, 6);
    expect(result.rounded).toBe(207); // ceil(206.07)
  });

  it('should calculate split damage (physical + fire)', () => {
    const result = calculateEnemyDamage({
      baseAR: { physical: 200, magic: 0, fire: 200, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: defaultDefenses,
    });

    // Each type: 200 AR vs 117 DEF = ratio 1.71 (tier 3)
    // Multiplier = 0.7 - (2.5 - 1.71)² / 7.5 = 0.6167
    // Damage per type = 200 * 0.6167 = 123.33
    // Total = 246.66
    expect(result.byType.physical).toBeCloseTo(123.33211581074829, 6);
    expect(result.byType.fire).toBeCloseTo(123.33211581074829, 6);
    expect(result.total).toBeCloseTo(246.66423162149658, 6);
    expect(result.rounded).toBe(247); // ceil(246.66)
  });

  it('should apply negation correctly', () => {
    const defensesWithNegation = {
      ...defaultDefenses,
      negation: {
        ...defaultDefenses.negation,
        physical: 20, // 20% physical negation
      },
    };

    const result = calculateEnemyDamage({
      baseAR: { physical: 327, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: defensesWithNegation,
    });

    expect(result.total).toBeCloseTo(188.57968344010303, 6);
    expect(result.rounded).toBe(189); // ceil(188.58)
  });

  it('should handle different motion values per type', () => {
    // Test that physical MV=130 and fire MV=100 work correctly
    const result = calculateEnemyDamage({
      baseAR: { physical: 327, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 130, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: defaultDefenses,
    });

    expect(result.total).toBeCloseTo(328.9985134986226, 6);
    expect(result.rounded).toBe(329); // ceil(328.99)
  });

  it('should handle tier 3 damage (low AR)', () => {
    const result = calculateEnemyDamage({
      baseAR: { physical: 150, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: defaultDefenses,
    });

    expect(result.total).toBeCloseTo(75.33201840894148, 6);
    expect(result.rounded).toBe(76); // ceil(75.33)
  });

  it('should handle tier 2 damage (very low AR)', () => {
    const result = calculateEnemyDamage({
      baseAR: { physical: 100, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: defaultDefenses,
    });

    expect(result.total).toBeCloseTo(30.86, 2);
    expect(result.rounded).toBe(31); // ceil(30.86)
  });

  it('should handle high AR (tier 4 upper range)', () => {
    const result = calculateEnemyDamage({
      baseAR: { physical: 500, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: defaultDefenses,
    });

    expect(result.total).toBeCloseTo(404.0933209930879, 6);
    expect(result.rounded).toBe(405); // ceil(404.09)
  });

  /**
   * CRITICAL: Verify ceiling rounding is used, not floor
   * The game displays damage rounded UP (ceil), not down (floor)
   * This was a bug fix - previously used Math.floor
   */
  it('should use ceiling (round UP) for displayed damage, not floor', () => {
    // Use values that produce a fractional result to verify rounding direction
    const result = calculateEnemyDamage({
      baseAR: { physical: 294, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: defaultDefenses,
    });

    // Raw total is 206.07..., which should ceil to 207, NOT floor to 206
    expect(result.total).toBeCloseTo(206.07, 1);
    expect(result.rounded).toBe(207); // ceil(206.07) = 207
    expect(result.rounded).not.toBe(206); // floor(206.07) = 206 would be WRONG
  });

  /**
   * CRITICAL: Verify per-type motion values are applied correctly
   * This was the primary bug - previously all types used physicalMV
   */
  it('should apply different motion values to each damage type independently', () => {
    // Split damage: 200 physical + 200 fire
    // Physical MV=100, Fire MV=50
    // If bug exists (using physicalMV for all), fire damage would be same as physical
    const result = calculateEnemyDamage({
      baseAR: { physical: 200, magic: 0, fire: 200, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 50, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: defaultDefenses,
    });

    // Physical: 200 AR * 100% MV = 200 effective attack
    // Fire: 200 AR * 50% MV = 100 effective attack
    // Fire damage should be significantly less than physical due to lower MV AND
    // non-linear defense reduction (lower attack = lower multiplier)
    expect(result.byType.fire).toBeLessThan(result.byType.physical * 0.6);

    // If the bug existed, fire would equal physical (both using 100% MV)
    expect(result.byType.fire).not.toBeCloseTo(result.byType.physical, 0);
  });
});
