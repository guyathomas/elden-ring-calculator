/**
 * Unit tests for pure AoW formula functions
 *
 * These tests validate individual formula functions in isolation,
 * making it easier to debug discrepancies with the spreadsheet.
 */

import { describe, it, expect } from 'vitest';
import {
  computePwu,
  computePwuMultiplier,
  computeStatSaturation,
  getStatSaturationFromCurves,
  computeScalingContribution,
  computeScalingWithReinforce,
  computeBulletDamage,
  computeBulletDamageNoScaling,
  computeMotionDamage,
  computeStatPointBonus,
  computeTotalStatPointBonus,
  computeEffectiveStrength,
  computeEffectiveStats,
  computeShieldChip,
  computeStaminaDamage,
  computePoiseDamage,
  roundTo3Decimals,
  roundTo2Decimals,
  roundTo4Decimals,
  isAlwaysTwoHanded,
} from '../src/aowFormulas.js';
import type { CurveDefinition, DamageTypeResult } from '../src/types.js';
import type { AowStatPointBonus } from '../src/aowTypes.js';

describe('PWU Functions', () => {
  describe('computePwu', () => {
    it('should return 0 for level 0', () => {
      expect(computePwu(0, 25)).toBe(0);
      expect(computePwu(0, 10)).toBe(0);
    });

    it('should return 1 for max level', () => {
      expect(computePwu(25, 25)).toBe(1);
      expect(computePwu(10, 10)).toBe(1);
    });

    it('should return correct fractional values', () => {
      expect(computePwu(12, 25)).toBeCloseTo(0.48, 5);
      expect(computePwu(5, 10)).toBe(0.5);
    });

    it('should handle maxLevel of 0', () => {
      expect(computePwu(0, 0)).toBe(0);
    });
  });

  describe('computePwuMultiplier', () => {
    it('should return 1.0 at level 0', () => {
      expect(computePwuMultiplier(0, 25)).toBe(1);
      expect(computePwuMultiplier(0, 10)).toBe(1);
    });

    it('should return 4.0 at max level', () => {
      expect(computePwuMultiplier(25, 25)).toBe(4);
      expect(computePwuMultiplier(10, 10)).toBe(4);
    });

    it('should return correct intermediate values', () => {
      // PWU = 0.5 -> multiplier = 1 + 3 * 0.5 = 2.5
      expect(computePwuMultiplier(5, 10)).toBe(2.5);

      // PWU = 0.48 -> multiplier = 1 + 3 * 0.48 = 2.44
      expect(computePwuMultiplier(12, 25)).toBeCloseTo(2.44, 5);
    });
  });
});

describe('Scaling Functions', () => {
  describe('computeScalingContribution', () => {
    it('should calculate scaling as (percent / 100) * saturation', () => {
      // 25% scaling with 0.8 saturation = 0.2
      expect(computeScalingContribution(25, 0.8)).toBeCloseTo(0.2, 5);

      // 100% scaling with 1.0 saturation = 1.0
      expect(computeScalingContribution(100, 1.0)).toBe(1.0);

      // 50% scaling with 0.5 saturation = 0.25
      expect(computeScalingContribution(50, 0.5)).toBe(0.25);
    });

    it('should return 0 when scaling or saturation is 0', () => {
      expect(computeScalingContribution(0, 0.8)).toBe(0);
      expect(computeScalingContribution(25, 0)).toBe(0);
    });
  });

  describe('computeScalingWithReinforce', () => {
    it('should multiply overwrite by reinforce rate', () => {
      expect(computeScalingWithReinforce(25, 1.0)).toBe(25);
      expect(computeScalingWithReinforce(25, 1.5)).toBe(37.5);
      expect(computeScalingWithReinforce(50, 2.0)).toBe(100);
    });
  });
});

describe('Bullet Damage Functions', () => {
  describe('computeBulletDamage', () => {
    it('should calculate damage as flat * pwuMult * (1 + scaling)', () => {
      // 100 flat, 2.0 pwu mult, 0.5 scaling
      // = 100 * 2.0 * (1 + 0.5) = 300
      expect(computeBulletDamage(100, 2.0, 0.5)).toBe(300);

      // 50 flat, 4.0 pwu mult (max level), 0 scaling
      // = 50 * 4.0 * 1.0 = 200
      expect(computeBulletDamage(50, 4.0, 0)).toBe(200);
    });

    it('should return 0 for 0 flat damage', () => {
      expect(computeBulletDamage(0, 4.0, 1.0)).toBe(0);
    });
  });

  describe('computeBulletDamageNoScaling', () => {
    it('should calculate damage as flat * pwuMult', () => {
      expect(computeBulletDamageNoScaling(100, 2.0)).toBe(200);
      expect(computeBulletDamageNoScaling(50, 4.0)).toBe(200);
    });

    it('should return 0 for 0 flat damage', () => {
      expect(computeBulletDamageNoScaling(0, 4.0)).toBe(0);
    });
  });
});

describe('Motion Damage Functions', () => {
  describe('computeMotionDamage', () => {
    it('should calculate damage as weaponTotal * motionValue', () => {
      expect(computeMotionDamage(200, 1.5)).toBe(300);
      expect(computeMotionDamage(100, 2.0)).toBe(200);
    });

    it('should return 0 for 0 motion value', () => {
      expect(computeMotionDamage(200, 0)).toBe(0);
    });
  });
});

describe('Stat Point Bonus Functions', () => {
  describe('computeStatPointBonus', () => {
    it('should calculate bonus as base * saturation * (points/100)', () => {
      // 100 base, 0.8 saturation, 5 points
      // = 100 * 0.8 * 0.05 = 4
      expect(computeStatPointBonus(100, 0.8, 5)).toBe(4);

      // 200 base, 1.0 saturation, 10 points
      // = 200 * 1.0 * 0.10 = 20
      expect(computeStatPointBonus(200, 1.0, 10)).toBe(20);
    });

    it('should return 0 when any input is 0', () => {
      expect(computeStatPointBonus(0, 0.8, 5)).toBe(0);
      expect(computeStatPointBonus(100, 0, 5)).toBe(0);
      expect(computeStatPointBonus(100, 0.8, 0)).toBe(0);
    });
  });

  describe('computeTotalStatPointBonus', () => {
    it('should return 0 for undefined statBonus', () => {
      const damageType: DamageTypeResult = {
        base: 100,
        scaling: 50,
        total: 150,
        perStat: {
          strength: { scaling: 25, saturation: 0.8 },
          dexterity: { scaling: 0, saturation: 0 },
          intelligence: { scaling: 0, saturation: 0 },
          faith: { scaling: 0, saturation: 0 },
          arcane: { scaling: 0, saturation: 0 },
        },
      };
      expect(computeTotalStatPointBonus(damageType, undefined)).toBe(0);
    });

    it('should return 0 for base = 0', () => {
      const damageType: DamageTypeResult = {
        base: 0,
        scaling: 0,
        total: 0,
        perStat: {
          strength: { scaling: 25, saturation: 0.8 },
          dexterity: { scaling: 0, saturation: 0 },
          intelligence: { scaling: 0, saturation: 0 },
          faith: { scaling: 0, saturation: 0 },
          arcane: { scaling: 0, saturation: 0 },
        },
      };
      const statBonus: AowStatPointBonus = {
        strength: 5,
        dexterity: 0,
        intelligence: 0,
        faith: 0,
        arcane: 0,
      };
      expect(computeTotalStatPointBonus(damageType, statBonus)).toBe(0);
    });

    it('should calculate bonus for single stat', () => {
      const damageType: DamageTypeResult = {
        base: 100,
        scaling: 50,
        total: 150,
        perStat: {
          strength: { scaling: 25, saturation: 0.8 },
          dexterity: { scaling: 0, saturation: 0 },
          intelligence: { scaling: 0, saturation: 0 },
          faith: { scaling: 0, saturation: 0 },
          arcane: { scaling: 0, saturation: 0 },
        },
      };
      const statBonus: AowStatPointBonus = {
        strength: 5,
        dexterity: 0,
        intelligence: 0,
        faith: 0,
        arcane: 0,
      };
      // 100 * 0.8 * 0.05 = 4
      expect(computeTotalStatPointBonus(damageType, statBonus)).toBe(4);
    });

    it('should sum bonuses from multiple stats', () => {
      const damageType: DamageTypeResult = {
        base: 100,
        scaling: 50,
        total: 150,
        perStat: {
          strength: { scaling: 25, saturation: 0.8 },
          dexterity: { scaling: 25, saturation: 0.6 },
          intelligence: { scaling: 0, saturation: 0 },
          faith: { scaling: 0, saturation: 0 },
          arcane: { scaling: 0, saturation: 0 },
        },
      };
      const statBonus: AowStatPointBonus = {
        strength: 5,
        dexterity: 3,
        intelligence: 0,
        faith: 0,
        arcane: 0,
      };
      // STR: 100 * 0.8 * 0.05 = 4
      // DEX: 100 * 0.6 * 0.03 = 1.8
      // Total: 5.8
      expect(computeTotalStatPointBonus(damageType, statBonus)).toBeCloseTo(5.8, 5);
    });
  });
});

describe('Effective Stats Functions', () => {
  // Weapon type constants for testing
  const FIST_WEP_TYPE = 35;
  const LIGHT_BOW_WEP_TYPE = 50;
  const BOW_WEP_TYPE = 51;
  const GREATBOW_WEP_TYPE = 53;
  const BALLISTA_WEP_TYPE = 56;

  describe('isAlwaysTwoHanded', () => {
    it('should return true for light bows', () => {
      expect(isAlwaysTwoHanded(LIGHT_BOW_WEP_TYPE)).toBe(true);
    });

    it('should return true for bows', () => {
      expect(isAlwaysTwoHanded(BOW_WEP_TYPE)).toBe(true);
    });

    it('should return true for greatbows', () => {
      expect(isAlwaysTwoHanded(GREATBOW_WEP_TYPE)).toBe(true);
    });

    it('should return true for ballistae', () => {
      expect(isAlwaysTwoHanded(BALLISTA_WEP_TYPE)).toBe(true);
    });

    it('should return false for other weapons', () => {
      expect(isAlwaysTwoHanded(0)).toBe(false);  // generic
      expect(isAlwaysTwoHanded(1)).toBe(false);  // dagger
      expect(isAlwaysTwoHanded(FIST_WEP_TYPE)).toBe(false);  // fist
      expect(isAlwaysTwoHanded(55)).toBe(false); // crossbow
    });
  });

  describe('computeEffectiveStrength', () => {
    it('should return base strength when not two-handing', () => {
      expect(computeEffectiveStrength(40, false, 0, false)).toBe(40);
    });

    it('should apply 1.5x multiplier when two-handing', () => {
      // 40 * 1.5 = 60
      expect(computeEffectiveStrength(40, true, 0, false)).toBe(60);
      // 30 * 1.5 = 45
      expect(computeEffectiveStrength(30, true, 0, false)).toBe(45);
    });

    it('should floor the result', () => {
      // 33 * 1.5 = 49.5 -> 49
      expect(computeEffectiveStrength(33, true, 0, false)).toBe(49);
      // 27 * 1.5 = 40.5 -> 40
      expect(computeEffectiveStrength(27, true, 0, false)).toBe(40);
    });

    it('should cap effective strength at 148', () => {
      // 99 * 1.5 = 148.5 -> 148 (capped)
      expect(computeEffectiveStrength(99, true, 0, false)).toBe(148);
      // 100 * 1.5 = 150 -> 148 (capped)
      expect(computeEffectiveStrength(100, true, 0, false)).toBe(148);
      // 148 * 1.5 = 222 -> 148 (capped)
      expect(computeEffectiveStrength(148, true, 0, false)).toBe(148);
    });

    it('should not apply bonus for fist weapons (wepType 35)', () => {
      expect(computeEffectiveStrength(40, true, FIST_WEP_TYPE, false)).toBe(40);
    });

    it('should not apply bonus for dual blade weapons', () => {
      expect(computeEffectiveStrength(40, true, 0, true)).toBe(40);
    });

    it('should always apply 2H bonus for bows (even when twoHanding=false)', () => {
      // Light bow
      expect(computeEffectiveStrength(40, false, LIGHT_BOW_WEP_TYPE, false)).toBe(60);
      // Bow
      expect(computeEffectiveStrength(40, false, BOW_WEP_TYPE, false)).toBe(60);
      // Greatbow
      expect(computeEffectiveStrength(40, false, GREATBOW_WEP_TYPE, false)).toBe(60);
    });

    it('should always apply 2H bonus for ballistae (even when twoHanding=false)', () => {
      expect(computeEffectiveStrength(40, false, BALLISTA_WEP_TYPE, false)).toBe(60);
    });

    it('should cap at 148 even for bows with high strength', () => {
      expect(computeEffectiveStrength(99, false, BOW_WEP_TYPE, false)).toBe(148);
    });
  });

  describe('computeEffectiveStats', () => {
    it('should only modify strength', () => {
      const stats = {
        strength: 40,
        dexterity: 30,
        intelligence: 20,
        faith: 15,
        arcane: 10,
      };
      const result = computeEffectiveStats(stats, true, 0, false);

      expect(result.strength).toBe(60);
      expect(result.dexterity).toBe(30);
      expect(result.intelligence).toBe(20);
      expect(result.faith).toBe(15);
      expect(result.arcane).toBe(10);
    });

    it('should apply bow forced 2H bonus', () => {
      const stats = {
        strength: 40,
        dexterity: 30,
        intelligence: 20,
        faith: 15,
        arcane: 10,
      };
      const result = computeEffectiveStats(stats, false, BOW_WEP_TYPE, false);

      expect(result.strength).toBe(60); // 40 * 1.5 = 60, even though twoHanding=false
    });
  });
});

describe('Shield/Guard Functions', () => {
  describe('computeShieldChip', () => {
    it('should return 0 for 0 rate', () => {
      expect(computeShieldChip(0)).toBe(0);
    });

    it('should calculate chip correctly', () => {
      // -100 rate: 1 - (1 + (-100/100)) = 1 - 0 = 1
      expect(computeShieldChip(-100)).toBe(1);

      // -50 rate: 1 - (1 + (-50/100)) = 1 - 0.5 = 0.5
      expect(computeShieldChip(-50)).toBe(0.5);

      // 50 rate: 1 - (1 + (50/100)) = 1 - 1.5 = -0.5
      expect(computeShieldChip(50)).toBe(-0.5);
    });
  });
});

describe('Stamina/Poise Functions', () => {
  describe('computeStaminaDamage', () => {
    it('should calculate stamina damage correctly', () => {
      // 66 base * 1.0 rate * 2.0 motion + 0 flat = 132
      expect(computeStaminaDamage(66, 1.0, 2.0, 0)).toBe(132);

      // 66 base * 1.5 rate * 1.0 motion + 10 flat = 109
      expect(computeStaminaDamage(66, 1.5, 1.0, 10)).toBe(109);
    });
  });

  describe('computePoiseDamage', () => {
    it('should calculate poise damage correctly', () => {
      // 5.5 base * 1.0 rate * 2.0 motion + 0 flat = 11
      expect(computePoiseDamage(5.5, 1.0, 2.0, 0)).toBe(11);

      // 5.5 base * 1.5 rate * 1.0 motion + 5 flat = 13.25
      expect(computePoiseDamage(5.5, 1.5, 1.0, 5)).toBe(13.25);
    });
  });
});

describe('Rounding Functions', () => {
  describe('roundTo3Decimals', () => {
    it('should round to 3 decimal places', () => {
      expect(roundTo3Decimals(1.23456)).toBe(1.235);
      expect(roundTo3Decimals(1.2344)).toBe(1.234);
      expect(roundTo3Decimals(1.2345)).toBe(1.235);
    });
  });

  describe('roundTo2Decimals', () => {
    it('should round to 2 decimal places', () => {
      expect(roundTo2Decimals(1.234)).toBe(1.23);
      expect(roundTo2Decimals(1.235)).toBe(1.24);
      expect(roundTo2Decimals(1.2349)).toBe(1.23);
    });
  });

  describe('roundTo4Decimals', () => {
    it('should round to 4 decimal places', () => {
      expect(roundTo4Decimals(1.23456)).toBe(1.2346);
      expect(roundTo4Decimals(1.23454)).toBe(1.2345);
    });
  });
});

describe('Stat Saturation Functions', () => {
  // Mock curve definition for testing - based on typical CalcCorrectGraph
  // This is a simplified curve with linear growth for predictable testing
  const linearCurve: CurveDefinition = {
    stageMaxVal: [0, 20, 60, 80, 150],
    stageMaxGrowVal: [0, 25, 75, 90, 100],
    adjPt_maxGrowVal: [1.0, 1.0, 1.0, 1.0], // Linear interpolation (adjPt=1)
  };

  // Curve with acceleration (common for soft caps)
  const acceleratingCurve: CurveDefinition = {
    stageMaxVal: [0, 20, 60, 80, 150],
    stageMaxGrowVal: [0, 25, 75, 90, 100],
    adjPt_maxGrowVal: [1.2, 1.1, 1.0, 1.0], // Starts slower, accelerates
  };

  describe('computeStatSaturation', () => {
    it('should return 0 for undefined curve', () => {
      expect(computeStatSaturation(undefined, 50)).toBe(0);
    });

    it('should return saturation as decimal (divided by 100)', () => {
      // At stat level 80, linearCurve gives stageMaxGrowVal[3] = 90
      // So saturation = 90 / 100 = 0.9
      expect(computeStatSaturation(linearCurve, 80)).toBe(0.9);
    });

    it('should return max saturation at max stat level', () => {
      // At stat level 150+, should return stageMaxGrowVal[4] = 100
      // So saturation = 100 / 100 = 1.0
      expect(computeStatSaturation(linearCurve, 150)).toBe(1.0);
      expect(computeStatSaturation(linearCurve, 99)).toBeLessThan(1.0);
    });

    it('should return 0 at stat level 0', () => {
      expect(computeStatSaturation(linearCurve, 0)).toBe(0);
    });

    it('should interpolate between breakpoints', () => {
      // At stat 40 (midway between 20 and 60 breakpoints)
      // Linear curve: should be midway between 25 and 75 = 50
      // Saturation = 50 / 100 = 0.5
      const sat = computeStatSaturation(linearCurve, 40);
      expect(sat).toBeCloseTo(0.5, 2);
    });
  });

  describe('getStatSaturationFromCurves', () => {
    it('should return 0 for missing curve ID', () => {
      const curves = { 0: linearCurve };
      expect(getStatSaturationFromCurves(curves, 999, 50)).toBe(0);
    });

    it('should find curve by ID and compute saturation', () => {
      const curves = {
        0: linearCurve,
        7: acceleratingCurve
      };
      // Curve 0 at stat 80 should give 0.9
      expect(getStatSaturationFromCurves(curves, 0, 80)).toBe(0.9);
    });
  });
});

describe('Integration: End-to-end bullet damage calculation', () => {
  it('should calculate bullet damage matching spreadsheet formula', () => {
    // Example: Chilling Mist bullet at +25 with 50 INT
    // This test validates the full chain of functions
    const flatDamage = 80;
    const upgradeLevel = 25;
    const maxUpgradeLevel = 25;
    const scalingPercent = 25; // from AEC overwrite
    const reinforceRate = 1.5; // at +25
    const statSaturation = 0.75; // for 50 INT on curve

    // Step 1: PWU multiplier
    const pwuMult = computePwuMultiplier(upgradeLevel, maxUpgradeLevel);
    expect(pwuMult).toBe(4.0);

    // Step 2: Scaling with reinforce
    const scalingValue = computeScalingWithReinforce(scalingPercent, reinforceRate);
    expect(scalingValue).toBe(37.5);

    // Step 3: Scaling contribution
    const scalingContrib = computeScalingContribution(scalingValue, statSaturation);
    expect(scalingContrib).toBeCloseTo(0.28125, 5);

    // Step 4: Final bullet damage
    const damage = computeBulletDamage(flatDamage, pwuMult, scalingContrib);
    // 80 * 4.0 * (1 + 0.28125) = 80 * 4.0 * 1.28125 = 410
    expect(damage).toBe(410);
  });
});
