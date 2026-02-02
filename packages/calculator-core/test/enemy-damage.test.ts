/**
 * Unit tests for enemy damage calculation functions
 *
 * Tests the 3-phase damage calculation:
 * Phase 1: Total Attack Power (AR × Motion Value)
 * Phase 2: Defense Calculation (step function with 5 tiers)
 * Phase 3: Negation Calculation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDefenseReduction,
  applyNegation,
  calculateSingleTypeDamage,
  getPhysicalDefenseType,
  calculateEnemyDamage,
  calculateSimpleEnemyDamage,
} from '../src/enemyDamageCalculator.js';
import type { EnemyDefenseData } from '../src/enemyTypes.js';

describe('Defense Step Function', () => {
  describe('calculateDefenseReduction', () => {
    it('should return 0 for 0 attack', () => {
      expect(calculateDefenseReduction(0, 100)).toBe(0);
    });

    it('should return 90% of attack when defense is 0', () => {
      expect(calculateDefenseReduction(100, 0)).toBe(90);
    });

    // Tier 1: The "Wall" Tier - DEF > 8 × ATK (ratio < 0.125)
    describe('Tier 1: Wall (DEF > 8 × ATK)', () => {
      it('should return 10% of attack when defense is extremely high', () => {
        // DEF = 1000, ATK = 100 → DEF > 8 × ATK (1000 > 800) ✓
        const result = calculateDefenseReduction(100, 1000);
        expect(result).toBeCloseTo(10, 1); // 0.10 × 100 = 10
      });

      it('should return 10% at exactly 8× defense', () => {
        // DEF = 800, ATK = 100 → DEF = 8 × ATK (boundary)
        // This is Tier 2 boundary, should be slightly above 10
        const result = calculateDefenseReduction(100, 800);
        // At ratio = 0.125, Tier 2 formula: (19.2/49)×(0.125-0.125)² + 0.1 = 0.1
        expect(result).toBeCloseTo(10, 1);
      });
    });

    // Tier 2: High Defense Tier - ATK < DEF ≤ 8 × ATK (0.125 ≤ ratio < 1)
    describe('Tier 2: High Defense (ATK < DEF ≤ 8 × ATK)', () => {
      it('should use correct formula at mid-range defense', () => {
        // DEF = 200, ATK = 100 → ratio = 0.5 (in Tier 2: 0.125 ≤ 0.5 < 1)
        // Formula: (19.2/49)×(0.5 - 0.125)² + 0.1 = 0.155 approx
        const result = calculateDefenseReduction(100, 200);
        const expected = ((19.2 / 49) * Math.pow(0.5 - 0.125, 2) + 0.1) * 100;
        expect(result).toBeCloseTo(expected, 2);
      });

      it('should approach 0.1 at the low end of ratio', () => {
        // DEF = 400, ATK = 100 → ratio = 0.25 (near low end of Tier 2)
        const result = calculateDefenseReduction(100, 400);
        // Should be close to but above 10
        expect(result).toBeGreaterThan(10);
        expect(result).toBeLessThan(20);
      });
    });

    // Tier 3: Standard Tier - 0.4 × ATK < DEF ≤ ATK (1 ≤ ratio ≤ 2.5)
    describe('Tier 3: Standard (0.4 × ATK < DEF ≤ ATK)', () => {
      it('should use correct formula when attack equals defense', () => {
        // DEF = 100, ATK = 100 → ratio = 1 (boundary between Tier 2 and 3)
        // Tier 3 formula: (-0.4/3)×(1 - 2.5)² + 0.7 = 0.7 - 0.3 = 0.4
        const result = calculateDefenseReduction(100, 100);
        const expected = ((-0.4 / 3) * Math.pow(1 - 2.5, 2) + 0.7) * 100;
        expect(result).toBeCloseTo(expected, 2);
      });

      it('should handle mid-range standard tier', () => {
        // DEF = 50, ATK = 100 → ratio = 2 (in Tier 3: 1 ≤ 2 ≤ 2.5)
        // Formula: (-0.4/3)×(2 - 2.5)² + 0.7 = 0.7 - 0.0333 ≈ 0.667
        const result = calculateDefenseReduction(100, 50);
        const expected = ((-0.4 / 3) * Math.pow(2 - 2.5, 2) + 0.7) * 100;
        expect(result).toBeCloseTo(expected, 2);
      });
    });

    // Tier 4: High Damage Tier - 0.125 × ATK < DEF ≤ 0.4 × ATK (2.5 < ratio ≤ 8)
    describe('Tier 4: High Damage (0.125 × ATK < DEF ≤ 0.4 × ATK)', () => {
      it('should use correct formula at low defense', () => {
        // DEF = 20, ATK = 100 → ratio = 5 (in Tier 4: 2.5 < 5 ≤ 8)
        // Formula: (-0.8/121)×(5 - 8)² + 0.9 ≈ 0.84
        const result = calculateDefenseReduction(100, 20);
        const expected = ((-0.8 / 121) * Math.pow(5 - 8, 2) + 0.9) * 100;
        expect(result).toBeCloseTo(expected, 2);
      });
    });

    // Tier 5: Cap Tier - DEF < 0.125 × ATK (ratio > 8)
    describe('Tier 5: Cap (DEF < 0.125 × ATK)', () => {
      it('should return 90% of attack when defense is very low', () => {
        // DEF = 10, ATK = 100 → DEF < 0.125 × ATK (10 < 12.5) ✓
        const result = calculateDefenseReduction(100, 10);
        expect(result).toBeCloseTo(90, 1);
      });

      it('should cap at 90% even with 0 defense', () => {
        const result = calculateDefenseReduction(100, 0);
        expect(result).toBe(90);
      });
    });

    // Continuity tests - formulas should meet at tier boundaries
    describe('Tier Boundary Continuity', () => {
      it('should be continuous at Tier 1/2 boundary (ratio = 0.125)', () => {
        // DEF = 800, ATK = 100 → ratio = 0.125 exactly
        const result = calculateDefenseReduction(100, 800);
        // At this boundary, Tier 2 formula gives: (19.2/49)×0 + 0.1 = 0.1 = 10%
        // Tier 1 formula also gives: 0.1 = 10%
        expect(result).toBeCloseTo(10, 1);
      });

      it('should be continuous at Tier 2/3 boundary (ratio = 1)', () => {
        // DEF = 100, ATK = 100 → ratio = 1 exactly
        const tier2Result = calculateDefenseReduction(100, 100.01);
        const tier3Result = calculateDefenseReduction(100, 99.99);
        // Should be very close at the boundary
        expect(Math.abs(tier2Result - tier3Result)).toBeLessThan(0.5);
      });

      it('should be continuous at Tier 3/4 boundary (ratio = 2.5)', () => {
        // DEF = 40, ATK = 100 → ratio = 2.5 exactly
        const tier3Result = calculateDefenseReduction(100, 40.01);
        const tier4Result = calculateDefenseReduction(100, 39.99);
        // Should be very close at the boundary
        expect(Math.abs(tier3Result - tier4Result)).toBeLessThan(0.5);
      });
    });
  });
});

describe('Negation Calculation', () => {
  describe('applyNegation', () => {
    it('should reduce damage by negation percentage', () => {
      // 20% negation on 100 damage = 80 damage
      expect(applyNegation(100, 20)).toBe(80);
    });

    it('should handle 0 negation', () => {
      expect(applyNegation(100, 0)).toBe(100);
    });

    it('should handle negative negation (vulnerability)', () => {
      // -20% negation means +20% damage taken
      expect(applyNegation(100, -20)).toBe(120);
    });

    it('should handle 100% negation (immunity)', () => {
      expect(applyNegation(100, 100)).toBe(0);
    });

    it('should handle fractional negation', () => {
      expect(applyNegation(100, 15.5)).toBeCloseTo(84.5, 5);
    });
  });
});

describe('Physical Damage Type Mapping', () => {
  describe('getPhysicalDefenseType', () => {
    it('should map Strike to strike', () => {
      expect(getPhysicalDefenseType('Strike')).toBe('strike');
    });

    it('should map Slash to slash', () => {
      expect(getPhysicalDefenseType('Slash')).toBe('slash');
    });

    it('should map Pierce to pierce', () => {
      expect(getPhysicalDefenseType('Pierce')).toBe('pierce');
    });

    it('should map Standard to physical', () => {
      expect(getPhysicalDefenseType('Standard')).toBe('physical');
    });

    it('should be case-insensitive', () => {
      expect(getPhysicalDefenseType('STRIKE')).toBe('strike');
      expect(getPhysicalDefenseType('slash')).toBe('slash');
    });

    it('should default to physical for unknown types', () => {
      expect(getPhysicalDefenseType('Unknown')).toBe('physical');
    });
  });
});

describe('Single Type Damage Calculation', () => {
  describe('calculateSingleTypeDamage', () => {
    it('should return 0 for 0 base damage', () => {
      expect(calculateSingleTypeDamage(0, 100, 100, 0)).toBe(0);
    });

    it('should apply motion value correctly', () => {
      // 100 damage × 150% MV = 150 attack power
      // Against 0 defense, 0 negation: 150 × 0.9 = 135
      const result = calculateSingleTypeDamage(100, 150, 0, 0);
      expect(result).toBeCloseTo(135, 1);
    });

    it('should combine all three phases', () => {
      // 100 damage × 100% MV = 100 attack power
      // Against 100 defense (equal), expect ~40% of 100 = 40
      // With 10% negation: 40 × 0.9 = 36
      const result = calculateSingleTypeDamage(100, 100, 100, 10);
      // Defense at 1:1 ratio gives roughly 40%
      const expectedAfterDef = ((-0.4 / 3) * Math.pow(1 - 2.5, 2) + 0.7) * 100;
      expect(result).toBeCloseTo(expectedAfterDef * 0.9, 1);
    });

    it('should never return negative damage', () => {
      // Even with extreme negation
      const result = calculateSingleTypeDamage(100, 100, 1000, 99);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Full Enemy Damage Calculation', () => {
  const mockDefenses: EnemyDefenseData = {
    defense: {
      physical: 100,
      strike: 90,
      slash: 110,
      pierce: 80,
      magic: 120,
      fire: 80,
      lightning: 100,
      holy: 100,
    },
    negation: {
      physical: 10,
      strike: 5,
      slash: 15,
      pierce: 0,
      magic: 20,
      fire: -10, // Vulnerability to fire
      lightning: 10,
      holy: 10,
    },
  };

  describe('calculateEnemyDamage', () => {
    it('should calculate damage for all types', () => {
      const result = calculateEnemyDamage({
        baseAR: {
          physical: 200,
          magic: 100,
          fire: 0,
          lightning: 0,
          holy: 0,
        },
        motionValues: {
          physical: 100,
          magic: 100,
          fire: 100,
          lightning: 100,
          holy: 100,
        },
        attackAttribute: 'Standard',
        enemyDefenses: mockDefenses,
      });

      expect(result.byType.physical).toBeGreaterThan(0);
      expect(result.byType.magic).toBeGreaterThan(0);
      expect(result.byType.fire).toBe(0); // No base fire damage
      expect(result.total).toBeCloseTo(result.byType.physical + result.byType.magic, 5);
      expect(result.rounded).toBe(Math.ceil(result.total));
    });

    it('should use correct defense type for physical damage based on attack attribute', () => {
      const strikeResult = calculateEnemyDamage({
        baseAR: { physical: 100, magic: 0, fire: 0, lightning: 0, holy: 0 },
        motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
        attackAttribute: 'Strike',
        enemyDefenses: mockDefenses,
      });

      const slashResult = calculateEnemyDamage({
        baseAR: { physical: 100, magic: 0, fire: 0, lightning: 0, holy: 0 },
        motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
        attackAttribute: 'Slash',
        enemyDefenses: mockDefenses,
      });

      // Strike should do more damage (lower defense 90 vs 110, lower negation 5 vs 15)
      expect(strikeResult.total).toBeGreaterThan(slashResult.total);
    });

    it('should apply different motion values per damage type', () => {
      const result = calculateEnemyDamage({
        baseAR: { physical: 100, magic: 100, fire: 0, lightning: 0, holy: 0 },
        motionValues: {
          physical: 150, // 150% for physical
          magic: 50,     // 50% for magic
          fire: 100,
          lightning: 100,
          holy: 100,
        },
        attackAttribute: 'Standard',
        enemyDefenses: mockDefenses,
      });

      // With equal base AR but different MVs, physical should do more damage
      // (accounting for different defenses/negations)
      expect(result.byType.physical).toBeGreaterThan(0);
      expect(result.byType.magic).toBeGreaterThan(0);
    });

    it('should handle fire vulnerability (negative negation)', () => {
      const result = calculateEnemyDamage({
        baseAR: { physical: 0, magic: 0, fire: 100, lightning: 0, holy: 0 },
        motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
        attackAttribute: 'Standard',
        enemyDefenses: mockDefenses,
      });

      // Fire has -10% negation (vulnerability), so damage should be boosted
      // Fire defense is 80, so ratio is 1.25 (Tier 3)
      expect(result.byType.fire).toBeGreaterThan(0);
    });
  });

  describe('calculateSimpleEnemyDamage', () => {
    it('should use MV=100 for all damage types', () => {
      const result = calculateSimpleEnemyDamage(
        { physical: 200, magic: 100, fire: 50, lightning: 0, holy: 0 },
        'Standard',
        mockDefenses
      );

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(Number.isInteger(result)).toBe(true);
    });

    it('should match full calculation with MV=100', () => {
      const baseARs = { physical: 200, magic: 100, fire: 50, lightning: 0, holy: 0 };

      const simpleResult = calculateSimpleEnemyDamage(
        baseARs,
        'Slash',
        mockDefenses
      );

      const fullResult = calculateEnemyDamage({
        baseAR: baseARs,
        motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
        attackAttribute: 'Slash',
        enemyDefenses: mockDefenses,
      });

      expect(simpleResult).toBe(fullResult.rounded);
    });
  });
});

describe('Real-world Damage Scenarios', () => {
  // Test with realistic boss defense values (from enemy-data.tsv)
  const margitDefenses: EnemyDefenseData = {
    defense: {
      physical: 112,
      strike: 112,
      slash: 112,
      pierce: 112,
      magic: 112,
      fire: 112,
      lightning: 112,
      holy: 112,
    },
    negation: {
      physical: 0,
      strike: 10,
      slash: 0,
      pierce: 0,
      magic: 40,
      fire: 40,
      lightning: 0,
      holy: 0,
    },
  };

  it('should calculate reasonable damage against a boss', () => {
    // A +25 longsword with 30/30 quality build might have ~400 AR
    const result = calculateEnemyDamage({
      baseAR: { physical: 400, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Slash',
      enemyDefenses: margitDefenses,
    });

    // Should deal meaningful damage
    expect(result.rounded).toBeGreaterThan(100);
    expect(result.rounded).toBeLessThan(400); // Should be reduced by defense
  });

  it('should show magic is less effective against high magic negation', () => {
    const physicalResult = calculateEnemyDamage({
      baseAR: { physical: 300, magic: 0, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: margitDefenses,
    });

    const magicResult = calculateEnemyDamage({
      baseAR: { physical: 0, magic: 300, fire: 0, lightning: 0, holy: 0 },
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute: 'Standard',
      enemyDefenses: margitDefenses,
    });

    // Equal base AR, but magic has 40% negation vs 0% for physical
    expect(physicalResult.rounded).toBeGreaterThan(magicResult.rounded);
  });
});
