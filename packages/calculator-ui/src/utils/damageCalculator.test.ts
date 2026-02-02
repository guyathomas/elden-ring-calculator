import { describe, it, expect } from 'vitest';
import { findOptimalStats, buildWeaponList } from './damageCalculator.js';
import type { PrecomputedDataV2, CurveDefinition } from '../../../calculator-core/dist/client.js';
import type { StatConfig } from '../types.js';
import { BUFFABLE_AFFINITIES, AFFINITY_ORDER } from '../types.js';

// Mock data
const mockCurve: CurveDefinition = {
  id: 1,
  stageMaxVal: [25, 60, 80, 150, 150],
  stageMaxGrowVal: [25, 60, 80, 100, 100],
  adjPt_maxGrowVal: [1.2, -1.2, 1, 1, 1],  // Real curves use non-zero values for proper interpolation
};

const mockData: PrecomputedDataV2 = {
  version: '2.0',
  generatedAt: new Date().toISOString(),
  weapons: {
    'TestWeapon': {
      maxUpgradeLevel: 25,
      wepType: 1,
      isDualBlade: false,
      isEnhance: true,
      attackBaseStamina: 100,
      saWeaponDamage: 100,
      atkAttribute: 0,
      atkAttribute2: 0,
      criticalValue: 100,
      gemMountType: 2,
      swordArtsParamId: 0,
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
    },
    // Quality weapon with equal STR/DEX scaling (like a longsword)
    'QualityWeapon': {
      maxUpgradeLevel: 25,
      wepType: 1,
      isDualBlade: false,
      isEnhance: true,
      attackBaseStamina: 100,
      saWeaponDamage: 100,
      atkAttribute: 0,
      atkAttribute2: 0,
      criticalValue: 100,
      gemMountType: 2,
      swordArtsParamId: 0,
      requirements: { strength: 12, dexterity: 12, intelligence: 0, faith: 0, arcane: 0 },
      affinities: {
        'Quality': {
          id: 200,
          reinforceTypeId: 0,
          physical: {
            attackBase: 100,
            scaling: {
              strength: { base: 80, curveId: 1, isOverride: false },
              dexterity: { base: 80, curveId: 1, isOverride: false },
              intelligence: null, faith: null, arcane: null
            },
          },
          magic: null, fire: null, lightning: null, holy: null,
          poison: null, scarletRot: null, bleed: null, frost: null, sleep: null, madness: null,
          sorceryScaling: null, incantationScaling: null,
          weaponScaling: { strength: 80, dexterity: 80, intelligence: 0, faith: 0, arcane: 0 },
        }
      }
    },
    // Magic weapon with INT scaling and split damage
    'MagicWeapon': {
      maxUpgradeLevel: 25,
      wepType: 1,
      isDualBlade: false,
      isEnhance: false,
      attackBaseStamina: 100,
      saWeaponDamage: 100,
      atkAttribute: 0,
      atkAttribute2: 0,
      criticalValue: 100,
      gemMountType: 2,
      swordArtsParamId: 0,
      requirements: { strength: 8, dexterity: 8, intelligence: 20, faith: 0, arcane: 0 },
      affinities: {
        'Magic': {
          id: 300,
          reinforceTypeId: 0,
          physical: {
            attackBase: 60,
            scaling: {
              strength: { base: 30, curveId: 1, isOverride: false },
              dexterity: null, intelligence: null, faith: null, arcane: null
            },
          },
          magic: {
            attackBase: 80,
            scaling: {
              strength: null, dexterity: null,
              intelligence: { base: 100, curveId: 1, isOverride: false },
              faith: null, arcane: null
            },
          },
          fire: null, lightning: null, holy: null,
          poison: null, scarletRot: null, bleed: null, frost: null, sleep: null, madness: null,
          sorceryScaling: null, incantationScaling: null,
          weaponScaling: { strength: 30, dexterity: 0, intelligence: 100, faith: 0, arcane: 0 },
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

const allLocked: Record<string, StatConfig> = {
  str: { value: 20, min: 10, max: 99, locked: true },
  dex: { value: 15, min: 10, max: 99, locked: true },
  int: { value: 10, min: 10, max: 99, locked: true },
  fai: { value: 10, min: 10, max: 99, locked: true },
  arc: { value: 10, min: 10, max: 99, locked: true },
  vig: { value: 10, min: 10, max: 99, locked: true },
  mnd: { value: 10, min: 10, max: 99, locked: true },
  end: { value: 10, min: 10, max: 99, locked: true },
};

const defaultStatConfig: Record<string, StatConfig> = {
  vig: { value: 40, locked: true },
  mnd: { value: 20, locked: true },
  end: { value: 25, locked: true },
  str: { min: 10, max: 99, locked: false },
  dex: { min: 10, max: 99, locked: false },
  int: { min: 10, max: 99, locked: false },
  fai: { min: 10, max: 99, locked: false },
  arc: { min: 10, max: 99, locked: false },
};

describe('findOptimalStats', () => {
  it('should maximize stats that provide scaling', () => {
    const result = findOptimalStats(
      mockData,
      'TestWeapon',
      'Standard',
      0,
      defaultStatConfig
    );

    // Should maximize Strength because it has scaling
    expect(result.stats.str).toBe(99);
    // Early termination stops when gains <= 0.01, so other stats may not reach max
    expect(result.damage).toBeGreaterThan(100);
  });

  it('should respect locked stats', () => {
    const config = {
      ...defaultStatConfig,
      str: { value: 50, locked: true }, // Locked at 50
    };

    const result = findOptimalStats(
      mockData,
      'TestWeapon',
      'Standard',
      0,
      config
    );

    expect(result.stats.str).toBe(50);
  });

  it('should respect max config', () => {
    const config = {
      ...defaultStatConfig,
      str: { min: 10, max: 60, locked: false }, // Max 60
    };

    const result = findOptimalStats(
      mockData,
      'TestWeapon',
      'Standard',
      0,
      config
    );

    expect(result.stats.str).toBe(60);
  });

  it('should meet requirements even if locked below (if logic allows, currently it bumps base)', () => {
    // Requirements are Str 10
    // If we pass min 5, it should bump to 10
    const config = {
      ...defaultStatConfig,
      str: { min: 5, max: 99, locked: false },
    };

    // But wait, findOptimalStats uses baseStats from config.
    // If locked is false, it uses min.
    // Then it checks requirements and bumps if needed.
    
    // Let's test with a weapon requiring 20 Str
    const highReqData = JSON.parse(JSON.stringify(mockData));
    highReqData.weapons['TestWeapon'].requirements.strength = 20;

    const result = findOptimalStats(
      highReqData,
      'TestWeapon',
      'Standard',
      0,
      config
    );

    expect(result.stats.str).toBeGreaterThanOrEqual(20);
  });

  it('should respect points budget', () => {
    // pointsBudget represents the TOTAL budget for all unlocked damage stats
    // All 5 damage stats are unlocked with min=10 each, so baseStatsSum = 50
    // With budget of 60, we have 10 additional points to allocate
    // We expect it to allocate all 10 additional points to Str (the only scaling stat)
    const result = findOptimalStats(
      mockData,
      'TestWeapon',
      'Standard',
      0,
      defaultStatConfig,
      { pointsBudget: 60 }
    );

    // Should have added 10 points to Str (10 -> 20)
    expect(result.stats.str).toBe(20);
    // Should not have touched other stats
    expect(result.stats.dex).toBe(10);
  });

  it('should handle budget of 0 (return base stats)', () => {
    const result = findOptimalStats(
      mockData,
      'TestWeapon',
      'Standard',
      0,
      defaultStatConfig,
      { pointsBudget: 0 }
    );

    // Should not allocate any points
    expect(result.stats.str).toBe(10);
    expect(result.stats.dex).toBe(10);
    expect(result.stats.int).toBe(10);
  });

  it('should handle excessive budget (allocate until max)', () => {
    const result = findOptimalStats(
      mockData,
      'TestWeapon',
      'Standard',
      0,
      defaultStatConfig,
      { pointsBudget: 1000 } // Way more than needed
    );

    // With excessive budget, should allocate to str first (best scaling)
    // Early termination will stop when gains become negligible
    expect(result.stats.str).toBeGreaterThan(10); // At least some allocation
  });

  it('should handle all stats locked', () => {
    const result = findOptimalStats(
      mockData,
      'TestWeapon',
      'Standard',
      0,
      allLocked,
      { pointsBudget: 100 }
    );

    // Should not change any locked stats
    expect(result.stats.str).toBe(20);
    expect(result.stats.dex).toBe(15);
  });

  it('should handle negative budget gracefully', () => {
    const result = findOptimalStats(
      mockData,
      'TestWeapon',
      'Standard',
      0,
      defaultStatConfig,
      { pointsBudget: -10 }
    );

    // Should treat negative as 0 (or at least not break)
    expect(result.stats.str).toBeGreaterThanOrEqual(10);
    expect(result.stats.dex).toBeGreaterThanOrEqual(10);
  });
});

describe('findOptimalStats - multi-stat scaling', () => {
  it('should allocate points to both STR and DEX for quality weapons', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 12, max: 99, locked: false },
      dex: { min: 12, max: 99, locked: false },
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    const result = findOptimalStats(
      mockData,
      'QualityWeapon',
      'Quality',
      0,
      config
    );

    // Both STR and DEX should be leveled since they have equal scaling
    expect(result.stats.str).toBeGreaterThan(12);
    expect(result.stats.dex).toBeGreaterThan(12);
    // INT/FAI/ARC should stay at base since they have no scaling
    expect(result.stats.int).toBe(10);
    expect(result.stats.fai).toBe(10);
    expect(result.stats.arc).toBe(10);
  });

  it('should distribute budget between STR and DEX for quality weapons', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 12, max: 99, locked: false },
      dex: { min: 12, max: 99, locked: false },
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    // baseStatsSum = 12 + 12 + 10 + 10 + 10 = 54
    // To have 20 additional points, budget should be 74
    const result = findOptimalStats(
      mockData,
      'QualityWeapon',
      'Quality',
      0,
      config,
      { pointsBudget: 74 }
    );

    // With 20 additional points budget and equal scaling, points should be split between STR and DEX
    const strPoints = result.stats.str - 12;
    const dexPoints = result.stats.dex - 12;
    const totalSpent = strPoints + dexPoints;

    expect(totalSpent).toBeLessThanOrEqual(20);
    // Both should receive points (greedy algorithm alternates when gains are equal)
    expect(strPoints).toBeGreaterThan(0);
    expect(dexPoints).toBeGreaterThan(0);
  });

  it('should prioritize INT for magic weapons with split damage', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 8, max: 99, locked: false },
      dex: { min: 8, max: 99, locked: false },
      int: { min: 20, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    const result = findOptimalStats(
      mockData,
      'MagicWeapon',
      'Magic',
      0,
      config
    );

    // INT should be maxed since it has the highest scaling (100 on magic damage)
    // STR has only 30 scaling on the smaller physical portion
    expect(result.stats.int).toBe(99);
    // STR may or may not be leveled depending on relative gains
    expect(result.stats.str).toBeGreaterThanOrEqual(8);
  });

  it('should favor INT over STR when budget is limited for magic weapons', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 8, max: 99, locked: false },
      dex: { min: 8, max: 99, locked: false },
      int: { min: 20, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    // baseStatsSum = 8 + 8 + 20 + 10 + 10 = 56
    // To have 30 additional points, budget should be 86
    const result = findOptimalStats(
      mockData,
      'MagicWeapon',
      'Magic',
      0,
      config,
      { pointsBudget: 86 }
    );

    const intPoints = result.stats.int - 20;
    const strPoints = result.stats.str - 8;

    // INT should receive more points since it has better scaling
    expect(intPoints).toBeGreaterThan(strPoints);
  });
});

describe('findOptimalStats - catalyst spell scaling', () => {
  // Mock catalyst with INT requirement 28 and sorcery scaling
  const mockCatalystData: PrecomputedDataV2 = {
    version: '2.0',
    generatedAt: new Date().toISOString(),
    weapons: {
      'TestCatalyst': {
        maxUpgradeLevel: 25,
        wepType: 23, // Glintstone Staff
        isDualBlade: false,
        isEnhance: false,
        attackBaseStamina: 100,
        saWeaponDamage: 100,
        atkAttribute: 0,
        atkAttribute2: 0,
        criticalValue: 100,
        gemMountType: 0, // Unique weapon
        swordArtsParamId: 0,
        requirements: { strength: 6, dexterity: 0, intelligence: 28, faith: 0, arcane: 0 },
        affinities: {
          'Standard': {
            id: 100,
            reinforceTypeId: 0,
            physical: {
              attackBase: 45,
              scaling: {
                strength: { base: 25, curveId: 1, isOverride: false },
                dexterity: null, intelligence: null, faith: null, arcane: null
              },
            },
            magic: null, fire: null, lightning: null, holy: null,
            poison: null, scarletRot: null, bleed: null, frost: null, sleep: null, madness: null,
            // BaseSpellScaling format - stats directly at top level, no attackBase (base is 100 constant)
            sorceryScaling: {
              strength: null,
              dexterity: null,
              intelligence: { base: 185, curveId: 1, isOverride: false },
              faith: null,
              arcane: null
            },
            incantationScaling: null,
            weaponScaling: { strength: 25, dexterity: 0, intelligence: 185, faith: 0, arcane: 0 },
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

  it('should allocate additional points after requirements are met', () => {
    // Simulates Astrologer class: INT base 16, STR base 8
    // TestCatalyst requires INT 28
    // At level 29 with Astrologer:
    //   - calculatedBudget = classData.total - classData.lvl + level - vig - mnd - end
    //   - = 85 - 6 + 29 - 9 - 15 - 9 = 75
    //   - baseStatsSum = 8 + 12 + 16 + 7 + 9 = 52
    //   - startStatsSum (after req) = 8 + 12 + 28 + 7 + 9 = 64
    //   - pointsBudget passed to solver = 75 - 64 = 11
    // BUG: Solver sees pointsUsed = (28 - 16) = 12 > budget (11), so doesn't allocate!

    const config: Record<string, StatConfig> = {
      vig: { value: 9, locked: true },
      mnd: { value: 15, locked: true },
      end: { value: 9, locked: true },
      str: { min: 8, max: 99, locked: false },
      dex: { min: 12, max: 99, locked: false },
      int: { min: 16, max: 99, locked: false }, // Astrologer base INT
      fai: { min: 7, max: 99, locked: false },
      arc: { min: 9, max: 99, locked: false },
    };

    // Total budget = baseStatsSum + additional points we want to allocate
    // baseStatsSum = 8 + 12 + 16 + 7 + 9 = 52
    // After requirements: int goes 16 -> 28, so startStatsSum = 64
    // We want 11 additional points beyond requirements = budget of 75
    const result = findOptimalStats(
      mockCatalystData,
      'TestCatalyst',
      'Standard',
      0,
      config,
      { pointsBudget: 75, optimizationMode: 'SP' }
    );

    // After meeting INT 28 requirement, we should have 11 points to allocate
    // The solver should put all 11 into INT (since it has sorcery scaling)
    // Expected: INT = 28 + 11 = 39
    expect(result.stats.int).toBeGreaterThan(28);
    expect(result.stats.int).toBe(39);
  });

  it('should continue allocating points as level increases beyond requirements', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 9, locked: true },
      mnd: { value: 15, locked: true },
      end: { value: 9, locked: true },
      str: { min: 8, max: 99, locked: false },
      dex: { min: 12, max: 99, locked: false },
      int: { min: 16, max: 99, locked: false },
      fai: { min: 7, max: 99, locked: false },
      arc: { min: 9, max: 99, locked: false },
    };

    // At level 35: budget = 85 - 6 + 35 - 9 - 15 - 9 = 81
    // startStatsSum = 64 (after INT 28 requirement)
    // Additional points = 81 - 64 = 17
    const result = findOptimalStats(
      mockCatalystData,
      'TestCatalyst',
      'Standard',
      0,
      config,
      { pointsBudget: 81, optimizationMode: 'SP' }
    );

    // Should allocate 17 additional points to INT: 28 + 17 = 45
    expect(result.stats.int).toBe(45);
  });

  it('should handle budget exactly at requirements boundary', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 9, locked: true },
      mnd: { value: 15, locked: true },
      end: { value: 9, locked: true },
      str: { min: 8, max: 99, locked: false },
      dex: { min: 12, max: 99, locked: false },
      int: { min: 16, max: 99, locked: false },
      fai: { min: 7, max: 99, locked: false },
      arc: { min: 9, max: 99, locked: false },
    };

    // Budget exactly equals startStatsSum (64) - no additional points to allocate
    const result = findOptimalStats(
      mockCatalystData,
      'TestCatalyst',
      'Standard',
      0,
      config,
      { pointsBudget: 64, optimizationMode: 'SP' }
    );

    // Should meet requirements but not allocate beyond
    expect(result.stats.int).toBe(28);
    // Other stats should stay at minimums
    expect(result.stats.str).toBe(8);
    expect(result.stats.dex).toBe(12);
    expect(result.stats.fai).toBe(7);
    expect(result.stats.arc).toBe(9);
  });

  it('should use ignoreRequirements when budget is below requirements', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 9, locked: true },
      mnd: { value: 15, locked: true },
      end: { value: 9, locked: true },
      str: { min: 8, max: 99, locked: false },
      dex: { min: 12, max: 99, locked: false },
      int: { min: 16, max: 99, locked: false },
      fai: { min: 7, max: 99, locked: false },
      arc: { min: 9, max: 99, locked: false },
    };

    // Budget below requirements (need 64, only have 58)
    // This gives 6 points above baseStatsSum (52): 58 - 52 = 6
    const result = findOptimalStats(
      mockCatalystData,
      'TestCatalyst',
      'Standard',
      0,
      config,
      { pointsBudget: 58, optimizationMode: 'SP' }
    );

    // Should allocate points toward INT even though requirements can't be met
    // With ignoreRequirements=true, solver sees INT scaling and allocates there
    expect(result.stats.int).toBe(22); // 16 + 6 = 22
    // Other stats stay at minimums
    expect(result.stats.str).toBe(8);
    expect(result.stats.dex).toBe(12);
  });

  it('should increase damage as points are allocated', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 9, locked: true },
      mnd: { value: 15, locked: true },
      end: { value: 9, locked: true },
      str: { min: 8, max: 99, locked: false },
      dex: { min: 12, max: 99, locked: false },
      int: { min: 16, max: 99, locked: false },
      fai: { min: 7, max: 99, locked: false },
      arc: { min: 9, max: 99, locked: false },
    };

    // Test at different budget levels to verify damage increases
    const result64 = findOptimalStats(mockCatalystData, 'TestCatalyst', 'Standard', 0, config,
      { pointsBudget: 64, optimizationMode: 'SP' });
    const result75 = findOptimalStats(mockCatalystData, 'TestCatalyst', 'Standard', 0, config,
      { pointsBudget: 75, optimizationMode: 'SP' });
    const result90 = findOptimalStats(mockCatalystData, 'TestCatalyst', 'Standard', 0, config,
      { pointsBudget: 90, optimizationMode: 'SP' });

    // Damage should increase as we allocate more points
    expect(result75.damage).toBeGreaterThan(result64.damage);
    expect(result90.damage).toBeGreaterThan(result75.damage);

    // Stats should also increase
    expect(result75.stats.int).toBeGreaterThan(result64.stats.int);
    expect(result90.stats.int).toBeGreaterThan(result75.stats.int);
  });
});

describe('findOptimalStats - 2H vs 1H scenarios', () => {
  it('should allocate points differently for 2H vs 1H with quality weapon', () => {
    // Quality weapon has equal STR/DEX scaling
    // 2H gives STR a 1.5x bonus, so it may prefer different allocation
    const config: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 12, max: 99, locked: false },
      dex: { min: 12, max: 99, locked: false },
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    // Budget that allows some allocation beyond requirements
    // baseStatsSum = 12 + 12 + 10 + 10 + 10 = 54
    const budget = 84; // 30 points to allocate

    const result1H = findOptimalStats(
      mockData,
      'QualityWeapon',
      'Quality',
      0,
      config,
      { pointsBudget: budget, twoHanding: false }
    );

    const result2H = findOptimalStats(
      mockData,
      'QualityWeapon',
      'Quality',
      0,
      config,
      { pointsBudget: budget, twoHanding: true }
    );

    // Both should allocate points (not stay at minimums)
    expect(result1H.stats.str + result1H.stats.dex).toBeGreaterThan(24);
    expect(result2H.stats.str + result2H.stats.dex).toBeGreaterThan(24);

    // Both should produce reasonable damage
    expect(result1H.damage).toBeGreaterThan(100);
    expect(result2H.damage).toBeGreaterThan(100);

    // 2H should generally produce higher damage due to STR bonus
    expect(result2H.damage).toBeGreaterThanOrEqual(result1H.damage);
  });

  it('should handle 1H and 2H consistently at various budget levels', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 12, max: 99, locked: false },
      dex: { min: 12, max: 99, locked: false },
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    // Test at multiple budget levels
    const budgets = [54, 64, 74, 84, 104]; // From min (54) to higher levels

    for (const budget of budgets) {
      const result1H = findOptimalStats(mockData, 'QualityWeapon', 'Quality', 0, config,
        { pointsBudget: budget, twoHanding: false });
      const result2H = findOptimalStats(mockData, 'QualityWeapon', 'Quality', 0, config,
        { pointsBudget: budget, twoHanding: true });

      // Total allocated should not exceed budget
      const total1H = result1H.stats.str + result1H.stats.dex + result1H.stats.int + result1H.stats.fai + result1H.stats.arc;
      const total2H = result2H.stats.str + result2H.stats.dex + result2H.stats.int + result2H.stats.fai + result2H.stats.arc;
      expect(total1H).toBeLessThanOrEqual(budget);
      expect(total2H).toBeLessThanOrEqual(budget);

      // Damage should increase with higher budget
      if (budget > 54) {
        const prevResult1H = findOptimalStats(mockData, 'QualityWeapon', 'Quality', 0, config,
          { pointsBudget: budget - 10, twoHanding: false });
        expect(result1H.damage).toBeGreaterThanOrEqual(prevResult1H.damage);
      }
    }
  });
});

describe('findOptimalStats - high requirement weapons', () => {
  // Create a weapon with high STR requirement
  const highReqWeaponData: PrecomputedDataV2 = {
    version: '2.0',
    generatedAt: new Date().toISOString(),
    weapons: {
      'HighReqWeapon': {
        maxUpgradeLevel: 25,
        wepType: 1,
        isDualBlade: false,
        isEnhance: true,
        attackBaseStamina: 100,
        saWeaponDamage: 100,
        atkAttribute: 0,
        atkAttribute2: 0,
        criticalValue: 100,
        gemMountType: 2,
        swordArtsParamId: 0,
        requirements: { strength: 40, dexterity: 10, intelligence: 0, faith: 0, arcane: 0 },
        affinities: {
          'Standard': {
            id: 100,
            reinforceTypeId: 0,
            physical: {
              attackBase: 150,
              scaling: {
                strength: { base: 120, curveId: 1, isOverride: false },
                dexterity: { base: 40, curveId: 1, isOverride: false },
                intelligence: null, faith: null, arcane: null
              },
            },
            magic: null, fire: null, lightning: null, holy: null,
            poison: null, scarletRot: null, bleed: null, frost: null, sleep: null, madness: null,
            sorceryScaling: null, incantationScaling: null,
            weaponScaling: { strength: 120, dexterity: 40, intelligence: 0, faith: 0, arcane: 0 },
          }
        }
      }
    },
    curves: { 1: mockCurve },
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

  it('should allocate toward requirements when budget is below requirements', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 10, locked: true },
      mnd: { value: 10, locked: true },
      end: { value: 10, locked: true },
      str: { min: 10, max: 99, locked: false },
      dex: { min: 10, max: 99, locked: false },
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    // baseStatsSum = 50, requirement needs STR 40 (startStatsSum would be 80)
    // Budget of 60 is below requirements (80), so requirementsExceedBudget=true
    const result = findOptimalStats(
      highReqWeaponData,
      'HighReqWeapon',
      'Standard',
      0,
      config,
      { pointsBudget: 60 }
    );

    // Should allocate 10 points (60 - 50) primarily toward STR (the scaling stat)
    expect(result.stats.str).toBeGreaterThan(10);
    // Total should equal budget
    const total = result.stats.str + result.stats.dex + result.stats.int + result.stats.fai + result.stats.arc;
    expect(total).toBe(60);
  });

  it('should allocate beyond requirements when budget allows', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 10, locked: true },
      mnd: { value: 10, locked: true },
      end: { value: 10, locked: true },
      str: { min: 10, max: 99, locked: false },
      dex: { min: 10, max: 99, locked: false },
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    // Budget of 100 exceeds requirements (80), so 20 additional points available
    const result = findOptimalStats(
      highReqWeaponData,
      'HighReqWeapon',
      'Standard',
      0,
      config,
      { pointsBudget: 100 }
    );

    // Should meet STR 40 requirement and allocate 20 more points
    expect(result.stats.str).toBeGreaterThanOrEqual(40);
    // Total allocation should use the full budget
    const total = result.stats.str + result.stats.dex + result.stats.int + result.stats.fai + result.stats.arc;
    expect(total).toBe(100);
  });

  it('should handle 2H reducing effective STR requirement', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 10, locked: true },
      mnd: { value: 10, locked: true },
      end: { value: 10, locked: true },
      str: { min: 10, max: 99, locked: false },
      dex: { min: 10, max: 99, locked: false },
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    // STR 40 requirement, but 2H gives 1.5x bonus
    // So effective requirement is ceil(40/1.5) = 27
    // baseStatsSum = 50, startStatsSum = 50 + (27-10) = 67
    // With budget 70, we have 3 additional points to allocate
    const result2H = findOptimalStats(
      highReqWeaponData,
      'HighReqWeapon',
      'Standard',
      0,
      config,
      { pointsBudget: 70, twoHanding: true }
    );

    // 2H: effective req is 27, so STR should be at least 27
    expect(result2H.stats.str).toBeGreaterThanOrEqual(27);

    // Compare with 1H at same budget (which can't meet requirements)
    const result1H = findOptimalStats(
      highReqWeaponData,
      'HighReqWeapon',
      'Standard',
      0,
      config,
      { pointsBudget: 70, twoHanding: false }
    );

    // 2H should have better damage since requirements can be met
    expect(result2H.damage).toBeGreaterThan(result1H.damage);
  });
});

describe('findOptimalStats - multi-stat allocation', () => {
  it('should properly distribute points across multiple scaling stats', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 8, max: 99, locked: false },
      dex: { min: 8, max: 99, locked: false },
      int: { min: 20, max: 99, locked: false }, // Magic requirement
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    // MagicWeapon has STR scaling (30) and INT scaling (100)
    // baseStatsSum = 8 + 8 + 20 + 10 + 10 = 56
    const result = findOptimalStats(
      mockData,
      'MagicWeapon',
      'Magic',
      0,
      config,
      { pointsBudget: 106 } // 50 additional points
    );

    // Should allocate more to INT (higher scaling) than STR
    expect(result.stats.int).toBeGreaterThan(result.stats.str);

    // Both should get some allocation since both scale
    expect(result.stats.int).toBeGreaterThan(20);
    expect(result.stats.str).toBeGreaterThanOrEqual(8);

    // Total should match budget
    const total = result.stats.str + result.stats.dex + result.stats.int + result.stats.fai + result.stats.arc;
    expect(total).toBeLessThanOrEqual(106);
  });

  it('should not allocate to non-scaling stats', () => {
    const config: Record<string, StatConfig> = {
      vig: { value: 40, locked: true },
      mnd: { value: 20, locked: true },
      end: { value: 25, locked: true },
      str: { min: 10, max: 99, locked: false },
      dex: { min: 10, max: 99, locked: false },
      int: { min: 10, max: 99, locked: false },
      fai: { min: 10, max: 99, locked: false },
      arc: { min: 10, max: 99, locked: false },
    };

    // TestWeapon only has STR scaling
    const result = findOptimalStats(
      mockData,
      'TestWeapon',
      'Standard',
      0,
      config,
      { pointsBudget: 80 } // 30 additional points
    );

    // Only STR should be leveled (it's the only scaling stat)
    expect(result.stats.str).toBeGreaterThan(10);
    // Other damage stats should stay at minimum
    expect(result.stats.dex).toBe(10);
    expect(result.stats.int).toBe(10);
    expect(result.stats.fai).toBe(10);
    expect(result.stats.arc).toBe(10);
  });
});

describe('buildWeaponList - affinity-based buffability', () => {
  // Shared mock guard stats for all weapons
  const mockGuardStats = {
    physical: 50, magic: 30, fire: 30, lightning: 30, holy: 30, guardBoost: 30
  };
  const mockGuardResistance = {
    poison: 20, scarletRot: 20, bleed: 20, frost: 20, sleep: 20, madness: 20
  };

  // Shared reinforcement rates with guard properties
  const mockReinforceRates = {
    physicsAtkRate: 1, magicAtkRate: 1, fireAtkRate: 1, thunderAtkRate: 1, darkAtkRate: 1,
    staminaAtkRate: 1,
    correctStrengthRate: 1, correctAgilityRate: 1, correctMagicRate: 1, correctFaithRate: 1, correctLuckRate: 1,
    spEffectId1: 0, spEffectId2: 0,
    physicsGuardCutRate: 1, magicGuardCutRate: 1, fireGuardCutRate: 1, thunderGuardCutRate: 1, darkGuardCutRate: 1,
    staminaGuardDefRate: 1,
  };

  // Helper to create basic affinity data
  const createAffinity = (id: number, scaling: any = { strength: { base: 100, curveId: 1, isOverride: false }, dexterity: null, intelligence: null, faith: null, arcane: null }) => ({
    id, reinforceTypeId: 0,
    physical: { attackBase: 100, scaling },
    magic: null, fire: null, lightning: null, holy: null,
    poison: null, scarletRot: null, bleed: null, frost: null, sleep: null, madness: null,
    sorceryScaling: null, incantationScaling: null,
    weaponScaling: { strength: 100, dexterity: 0, intelligence: 0, faith: 0, arcane: 0 },
  });

  // Create mock data with a weapon that has isEnhance=true and multiple affinities
  const mockBuffableWeaponData: PrecomputedDataV2 = {
    version: '2.0',
    generatedAt: new Date().toISOString(),
    weapons: {
      'BuffableWeapon': {
        maxUpgradeLevel: 25,
        wepType: 1,
        isDualBlade: false,
        isEnhance: true, // Base weapon is buffable
        attackBaseStamina: 100,
        saWeaponDamage: 100,
        atkAttribute: 0,
        atkAttribute2: 0,
        criticalValue: 100,
        gemMountType: 2,
        swordArtsParamId: 0,
        guardStats: mockGuardStats,
        guardResistance: mockGuardResistance,
        requirements: { strength: 10, dexterity: 10, intelligence: 0, faith: 0, arcane: 0 },
        affinities: {
          'Standard': createAffinity(100),
          'Heavy': createAffinity(101),
          'Keen': createAffinity(102),
          'Quality': createAffinity(103),
          'Occult': createAffinity(104),
          // Non-buffable affinities
          'Magic': createAffinity(200),
          'Cold': createAffinity(201),
          'Fire': createAffinity(202),
          'Flame Art': createAffinity(203),
          'Lightning': createAffinity(204),
          'Sacred': createAffinity(205),
          'Poison': createAffinity(206),
          'Blood': createAffinity(207),
        }
      },
      'NonBuffableWeapon': {
        maxUpgradeLevel: 25,
        wepType: 1,
        isDualBlade: false,
        isEnhance: false, // Base weapon is NOT buffable
        attackBaseStamina: 100,
        saWeaponDamage: 100,
        atkAttribute: 0,
        atkAttribute2: 0,
        criticalValue: 100,
        gemMountType: 2,
        swordArtsParamId: 0,
        guardStats: mockGuardStats,
        guardResistance: mockGuardResistance,
        requirements: { strength: 10, dexterity: 10, intelligence: 0, faith: 0, arcane: 0 },
        affinities: {
          'Standard': createAffinity(300),
        }
      }
    },
    curves: { 1: mockCurve },
    reinforceRates: {
      '0': mockReinforceRates
    },
    spEffects: {}
  };

  it('should mark weapons with buffable affinities as buffable when base isEnhance is true', () => {
    const weaponList = buildWeaponList(mockBuffableWeaponData, 0);

    // Buffable affinities: Standard, Heavy, Keen, Quality, Occult
    const buffableAffinities = ['Standard', 'Heavy', 'Keen', 'Quality', 'Occult'];

    for (const affinity of buffableAffinities) {
      const weapon = weaponList.find(w => w.name === 'BuffableWeapon' && w.affinity === affinity);
      expect(weapon, `Expected to find BuffableWeapon with ${affinity} affinity`).toBeDefined();
      expect(weapon!.isBuffable, `Expected ${affinity} affinity to be buffable`).toBe(true);
    }
  });

  it('should mark weapons with non-buffable affinities as not buffable even when base isEnhance is true', () => {
    const weaponList = buildWeaponList(mockBuffableWeaponData, 0);

    // Non-buffable affinities: Magic, Cold, Fire, Flame Art, Lightning, Sacred, Poison, Blood
    const nonBuffableAffinities = ['Magic', 'Cold', 'Fire', 'Flame Art', 'Lightning', 'Sacred', 'Poison', 'Blood'];

    for (const affinity of nonBuffableAffinities) {
      const weapon = weaponList.find(w => w.name === 'BuffableWeapon' && w.affinity === affinity);
      expect(weapon, `Expected to find BuffableWeapon with ${affinity} affinity`).toBeDefined();
      expect(weapon!.isBuffable, `Expected ${affinity} affinity to NOT be buffable`).toBe(false);
    }
  });

  it('should mark weapons as not buffable when base isEnhance is false regardless of affinity', () => {
    const weaponList = buildWeaponList(mockBuffableWeaponData, 0);

    const weapon = weaponList.find(w => w.name === 'NonBuffableWeapon' && w.affinity === 'Standard');
    expect(weapon).toBeDefined();
    expect(weapon!.isBuffable).toBe(false);
  });

  it('should cover all 13 affinities between buffable and non-buffable sets', () => {
    // This test ensures we haven't missed any affinity
    const buffableAffinities = ['Standard', 'Heavy', 'Keen', 'Quality', 'Occult'];
    const nonBuffableAffinities = ['Magic', 'Cold', 'Fire', 'Flame Art', 'Lightning', 'Sacred', 'Poison', 'Blood'];
    const allAffinities = [...buffableAffinities, ...nonBuffableAffinities];

    // Should have exactly 13 affinities total (matching AFFINITY_ORDER)
    expect(allAffinities.length).toBe(13);

    // No duplicates
    const uniqueAffinities = new Set(allAffinities);
    expect(uniqueAffinities.size).toBe(13);
  });

  it('should handle weapons with only Standard affinity correctly', () => {
    // Create a weapon that only has Standard affinity (like some unique weapons)
    const singleAffinityData: PrecomputedDataV2 = {
      ...mockBuffableWeaponData,
      weapons: {
        'SingleAffinityWeapon': {
          maxUpgradeLevel: 10,
          wepType: 1,
          isDualBlade: false,
          isEnhance: true,
          attackBaseStamina: 100,
          saWeaponDamage: 100,
          atkAttribute: 0,
          atkAttribute2: 0,
          criticalValue: 100,
          gemMountType: 0, // Unique weapon - can't change affinity
          swordArtsParamId: 0,
          guardStats: mockGuardStats,
          guardResistance: mockGuardResistance,
          requirements: { strength: 10, dexterity: 10, intelligence: 0, faith: 0, arcane: 0 },
          affinities: {
            'Standard': createAffinity(100),
          }
        }
      }
    };

    const weaponList = buildWeaponList(singleAffinityData, 0);
    const weapon = weaponList.find(w => w.name === 'SingleAffinityWeapon');

    expect(weapon).toBeDefined();
    expect(weapon!.isBuffable).toBe(true);
    expect(weapon!.affinity).toBe('Standard');
  });

  it('should correctly identify buffability for each weapon-affinity combination independently', () => {
    const weaponList = buildWeaponList(mockBuffableWeaponData, 0);

    // Get all BuffableWeapon entries
    const buffableWeapons = weaponList.filter(w => w.name === 'BuffableWeapon');

    // Should have 13 entries (one for each affinity)
    expect(buffableWeapons.length).toBe(13);

    // Count buffable vs non-buffable
    const buffableCount = buffableWeapons.filter(w => w.isBuffable).length;
    const nonBuffableCount = buffableWeapons.filter(w => !w.isBuffable).length;

    // Should have 5 buffable (Standard, Heavy, Keen, Quality, Occult)
    expect(buffableCount).toBe(5);
    // Should have 8 non-buffable (Magic, Cold, Fire, Flame Art, Lightning, Sacred, Poison, Blood)
    expect(nonBuffableCount).toBe(8);
  });
});

describe('BUFFABLE_AFFINITIES constant', () => {
  it('should contain exactly the 4 buffable affinities', () => {
    expect(BUFFABLE_AFFINITIES.size).toBe(4);
    expect(BUFFABLE_AFFINITIES.has('Standard')).toBe(true);
    expect(BUFFABLE_AFFINITIES.has('Heavy')).toBe(true);
    expect(BUFFABLE_AFFINITIES.has('Keen')).toBe(true);
    expect(BUFFABLE_AFFINITIES.has('Quality')).toBe(true);
    expect(BUFFABLE_AFFINITIES.has('Occult')).toBe(false);
  });

  it('should NOT contain elemental affinities', () => {
    expect(BUFFABLE_AFFINITIES.has('Magic')).toBe(false);
    expect(BUFFABLE_AFFINITIES.has('Fire')).toBe(false);
    expect(BUFFABLE_AFFINITIES.has('Lightning')).toBe(false);
    expect(BUFFABLE_AFFINITIES.has('Sacred')).toBe(false);
    expect(BUFFABLE_AFFINITIES.has('Flame Art')).toBe(false);
    expect(BUFFABLE_AFFINITIES.has('Cold')).toBe(false);
  });

  it('should NOT contain status affinities', () => {
    expect(BUFFABLE_AFFINITIES.has('Poison')).toBe(false);
    expect(BUFFABLE_AFFINITIES.has('Blood')).toBe(false);
  });

  it('should be a subset of AFFINITY_ORDER', () => {
    // Every buffable affinity should exist in the full affinity list
    for (const affinity of BUFFABLE_AFFINITIES) {
      expect(AFFINITY_ORDER).toContain(affinity);
    }
  });

  it('should partition AFFINITY_ORDER into buffable and non-buffable', () => {
    // Every affinity in AFFINITY_ORDER should be either buffable or non-buffable (not both, not neither)
    const nonBuffableAffinities = AFFINITY_ORDER.filter(a => !BUFFABLE_AFFINITIES.has(a));

    // Total should equal AFFINITY_ORDER length
    expect(BUFFABLE_AFFINITIES.size + nonBuffableAffinities.length).toBe(AFFINITY_ORDER.length);

    // Non-buffable should have 9 affinities
    expect(nonBuffableAffinities.length).toBe(9);
    expect(nonBuffableAffinities).toEqual(
      expect.arrayContaining(['Occult', 'Magic', 'Cold', 'Fire', 'Flame Art', 'Lightning', 'Sacred', 'Poison', 'Blood'])
    );
  });
});
