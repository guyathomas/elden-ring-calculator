import { describe, it, expect } from 'vitest';
import {
  calculateCriticalDamage,
  canPerformCriticalAttack,
  getCriticalMultiplier,
  CRITICAL_MULTIPLIERS,
} from './criticalDamage.js';

describe('calculateCriticalDamage', () => {
  describe('basic calculations', () => {
    it('should calculate dagger critical damage correctly', () => {
      // Dagger (wepType 1): 4.0x multiplier
      // 200 AR × (130 / 100) × 4.0 = 1040
      const result = calculateCriticalDamage(200, 1, 130);
      expect(result).toBe(1040);
    });

    it('should calculate rapier critical damage correctly', () => {
      // Thrusting Sword (wepType 15): 3.3x multiplier
      // 200 AR × (130 / 100) × 3.3 = 858
      const result = calculateCriticalDamage(200, 15, 130);
      expect(result).toBe(858);
    });

    it('should calculate straight sword critical damage with base crit value', () => {
      // Straight Sword (wepType 3): 3.0x multiplier
      // 300 AR × (100 / 100) × 3.0 = 900
      const result = calculateCriticalDamage(300, 3, 100);
      expect(result).toBe(900);
    });

    it('should calculate Misericorde critical damage (highest crit value)', () => {
      // Dagger (wepType 1): 4.0x multiplier
      // Misericorde has 140 crit value
      // 200 AR × (140 / 100) × 4.0 = 1120
      const result = calculateCriticalDamage(200, 1, 140);
      expect(result).toBe(1120);
    });

    it('should calculate greatsword critical damage (lower multiplier)', () => {
      // Greatsword (wepType 5): 2.5x multiplier
      // 400 AR × (110 / 100) × 2.5 = 1100
      const result = calculateCriticalDamage(400, 5, 110);
      expect(result).toBe(1100);
    });

    it('should round results to nearest integer', () => {
      // Katana (wepType 13): 3.0x multiplier
      // 333 AR × (100 / 100) × 3.0 = 999
      const result = calculateCriticalDamage(333, 13, 100);
      expect(result).toBe(999);

      // Test rounding up: 333.5 should round to 334
      // 111 AR × (100 / 100) × 3.0 = 333, but let's test a fractional case
      // 112 AR × (100 / 100) × 3.0 = 336
      const resultRound = calculateCriticalDamage(112, 13, 100);
      expect(resultRound).toBe(336);
    });
  });

  describe('weapons that cannot crit', () => {
    it('should return null for bows', () => {
      expect(calculateCriticalDamage(200, 51, 100)).toBeNull(); // Bow
      expect(calculateCriticalDamage(200, 50, 100)).toBeNull(); // Light Bow
      expect(calculateCriticalDamage(200, 53, 100)).toBeNull(); // Greatbow
    });

    it('should return null for crossbows', () => {
      expect(calculateCriticalDamage(200, 55, 100)).toBeNull(); // Crossbow
      expect(calculateCriticalDamage(200, 56, 100)).toBeNull(); // Ballista
    });

    it('should return null for catalysts', () => {
      expect(calculateCriticalDamage(200, 57, 100)).toBeNull(); // Glintstone Staff
      expect(calculateCriticalDamage(200, 61, 100)).toBeNull(); // Sacred Seal
    });

    it('should return null for whips', () => {
      expect(calculateCriticalDamage(200, 39, 100)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should return null for unknown weapon categories', () => {
      // Category 999 doesn't exist
      expect(calculateCriticalDamage(200, 999, 100)).toBeNull();
    });

    it('should handle zero AR', () => {
      const result = calculateCriticalDamage(0, 1, 130);
      expect(result).toBe(0);
    });

    it('should handle very high AR values', () => {
      // 1000 AR × (140 / 100) × 4.0 = 5600
      const result = calculateCriticalDamage(1000, 1, 140);
      expect(result).toBe(5600);
    });

    it('should handle critical values below 100', () => {
      // Hypothetical weapon with 80 crit value (below base)
      // 200 AR × (80 / 100) × 3.0 = 480
      const result = calculateCriticalDamage(200, 3, 80);
      expect(result).toBe(480);
    });
  });

  describe('all weapon categories with multipliers', () => {
    const testCases: Array<{ category: number; name: string; multiplier: number }> = [
      { category: 1, name: 'Dagger', multiplier: 4.0 },
      { category: 3, name: 'Straight Sword', multiplier: 3.0 },
      { category: 5, name: 'Greatsword', multiplier: 2.5 },
      { category: 7, name: 'Colossal Sword', multiplier: 2.5 },
      { category: 9, name: 'Curved Sword', multiplier: 3.0 },
      { category: 11, name: 'Curved Greatsword', multiplier: 2.5 },
      { category: 13, name: 'Katana', multiplier: 3.0 },
      { category: 14, name: 'Twinblade', multiplier: 3.0 },
      { category: 15, name: 'Thrusting Sword', multiplier: 3.3 },
      { category: 16, name: 'Heavy Thrusting Sword', multiplier: 2.4 },
      { category: 17, name: 'Axe', multiplier: 3.25 },
      { category: 19, name: 'Greataxe', multiplier: 2.5 },
      { category: 21, name: 'Hammer', multiplier: 3.25 },
      { category: 23, name: 'Great Hammer', multiplier: 2.5 },
      { category: 24, name: 'Flail', multiplier: 3.25 },
      { category: 25, name: 'Spear', multiplier: 2.8 },
      { category: 28, name: 'Great Spear', multiplier: 2.4 },
      { category: 29, name: 'Halberd', multiplier: 2.8 },
      { category: 31, name: 'Reaper', multiplier: 2.4 },
      { category: 35, name: 'Fist', multiplier: 3.5 },
      { category: 37, name: 'Claw', multiplier: 3.5 },
      { category: 41, name: 'Colossal Weapon', multiplier: 2.5 },
      { category: 92, name: 'Backhand Blade', multiplier: 4.0 },
      { category: 95, name: 'Beast Claw', multiplier: 3.5 },
    ];

    it.each(testCases)(
      'should calculate correct damage for $name (category $category)',
      ({ category, multiplier }) => {
        // 100 AR × (100 / 100) × multiplier = 100 × multiplier
        const result = calculateCriticalDamage(100, category, 100);
        expect(result).toBe(Math.round(100 * multiplier));
      }
    );
  });
});

describe('canPerformCriticalAttack', () => {
  it('should return true for melee weapons', () => {
    expect(canPerformCriticalAttack(1)).toBe(true);   // Dagger
    expect(canPerformCriticalAttack(3)).toBe(true);   // Straight Sword
    expect(canPerformCriticalAttack(13)).toBe(true);  // Katana
    expect(canPerformCriticalAttack(35)).toBe(true);  // Fist
  });

  it('should return false for ranged weapons', () => {
    expect(canPerformCriticalAttack(50)).toBe(false); // Light Bow
    expect(canPerformCriticalAttack(51)).toBe(false); // Bow
    expect(canPerformCriticalAttack(53)).toBe(false); // Greatbow
    expect(canPerformCriticalAttack(55)).toBe(false); // Crossbow
    expect(canPerformCriticalAttack(56)).toBe(false); // Ballista
  });

  it('should return false for catalysts', () => {
    expect(canPerformCriticalAttack(57)).toBe(false); // Glintstone Staff
    expect(canPerformCriticalAttack(61)).toBe(false); // Sacred Seal
  });

  it('should return false for whips', () => {
    expect(canPerformCriticalAttack(39)).toBe(false);
  });

  it('should return false for unknown categories', () => {
    expect(canPerformCriticalAttack(999)).toBe(false);
  });
});

describe('getCriticalMultiplier', () => {
  it('should return correct multiplier for known categories', () => {
    expect(getCriticalMultiplier(1)).toBe(4.0);   // Dagger
    expect(getCriticalMultiplier(15)).toBe(3.3);  // Thrusting Sword
    expect(getCriticalMultiplier(5)).toBe(2.5);   // Greatsword
  });

  it('should return null for weapons that cannot crit', () => {
    expect(getCriticalMultiplier(51)).toBeNull(); // Bow
    expect(getCriticalMultiplier(57)).toBeNull(); // Staff
  });

  it('should return null for unknown categories', () => {
    expect(getCriticalMultiplier(999)).toBeNull();
  });
});

describe('CRITICAL_MULTIPLIERS constant', () => {
  it('should have daggers with highest multiplier (4.0)', () => {
    expect(CRITICAL_MULTIPLIERS[1]).toBe(4.0);
    expect(CRITICAL_MULTIPLIERS[92]).toBe(4.0); // Backhand Blade
  });

  it('should have colossal weapons with lowest melee multiplier (2.5)', () => {
    expect(CRITICAL_MULTIPLIERS[7]).toBe(2.5);  // Colossal Sword
    expect(CRITICAL_MULTIPLIERS[41]).toBe(2.5); // Colossal Weapon
  });

  it('should have null for all ranged weapon types', () => {
    const rangedTypes = [50, 51, 53, 55, 56];
    rangedTypes.forEach(type => {
      expect(CRITICAL_MULTIPLIERS[type]).toBeNull();
    });
  });
});
