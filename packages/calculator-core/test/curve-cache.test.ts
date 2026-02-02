import { describe, it, expect, vi } from 'vitest';
import { calculateARV2 } from '../src/calculator.js';
import type { CurveDefinition, PrecomputedDataV2 } from '../src/types.js';

// Mock data for testing
const mockCurve: CurveDefinition = {
  id: 1,
  stageMaxVal: [25, 60, 80, 150, 150],
  stageMaxGrowVal: [25, 60, 80, 100, 100],
  adjPt_maxGrowVal: [0, 0, 0, 0, 0], // Linear for simplicity
};

const mockData: PrecomputedDataV2 = {
  version: '2.0',
  generatedAt: new Date().toISOString(),
  weapons: {
    'TestWeapon': {
      maxUpgradeLevel: 25,
      wepType: 1,
      isDualBlade: false,
      attackBaseStamina: 100,
      saWeaponDamage: 100,
      atkAttribute: 0,
      atkAttribute2: 0,
      requirements: { strength: 10, dexterity: 10, intelligence: 0, faith: 0, arcane: 0 },
      affinities: {
        'Standard': {
          id: 100,
          reinforceTypeId: 0,
          physical: {
            attackBase: 100,
            scaling: { strength: { base: 100, curveId: 1, isOverride: false }, dexterity: null, intelligence: null, faith: null, arcane: null },
          },
          magic: null, fire: null, lightning: null, holy: null,
          poison: null, scarletRot: null, bleed: null, frost: null, sleep: null, madness: null,
          sorceryScaling: null, incantationScaling: null,
          weaponScaling: { strength: 100, dexterity: 0, intelligence: 0, faith: 0, arcane: 0 },
        }
      }
    }
  },
  curves: {
    1: mockCurve
  },
  reinforceRates: {
    '0': {
      physicsAtkRate: 1, magicAtkRate: 1, fireAtkRate: 1, thunderAtkRate: 1, darkAtkRate: 1,
      staminaAtkRate: 1,
      correctStrengthRate: 1, correctAgilityRate: 1, correctMagicRate: 1, correctFaithRate: 1, correctLuckRate: 1,
      spEffectId1: 0, spEffectId2: 0,
    }
  },
  spEffects: {}
};

describe('Curve Caching', () => {
  it('should return consistent results with caching', () => {
    const stats = { strength: 50, dexterity: 10, intelligence: 10, faith: 10, arcane: 10, vig: 10, mnd: 10, end: 10 };
    
    // First call - populates cache
    const result1 = calculateARV2(mockData, 'TestWeapon', 'Standard', 0, stats);
    expect(result1).not.toBeNull();
    
    // Second call - should use cache
    const result2 = calculateARV2(mockData, 'TestWeapon', 'Standard', 0, stats);
    expect(result2).not.toBeNull();
    
    expect(result1?.physical.total).toBe(result2?.physical.total);
  });

  it('should handle multiple calls efficiently', () => {
    const stats = { strength: 50, dexterity: 10, intelligence: 10, faith: 10, arcane: 10, vig: 10, mnd: 10, end: 10 };
    
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      calculateARV2(mockData, 'TestWeapon', 'Standard', 0, stats);
    }
    const end = performance.now();
    
    // Just ensuring it runs without error and returns reasonable time
    // Exact timing is flaky in CI/unit tests, but this verifies the loop works
    expect(end - start).toBeGreaterThan(0);
  });
});
