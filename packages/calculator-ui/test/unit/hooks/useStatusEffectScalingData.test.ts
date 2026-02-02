/**
 * useStatusEffectScalingData Hook Tests
 *
 * Tests for the hook that generates status effect scaling data points
 * for weapons with arcane-scaling status effects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStatusEffectScalingData } from '../../../src/hooks/useStatusEffectScalingData.js';
import type { PrecomputedDataV2, WeaponListItem, CharacterStats } from '../../../src/types.js';

// Mock the damageCalculator
vi.mock('../../../src/utils/damageCalculator.js', () => ({
  calculateWeaponAR: vi.fn(),
}));

import { calculateWeaponAR } from '../../../src/utils/damageCalculator.js';

const mockCalculateWeaponAR = vi.mocked(calculateWeaponAR);

const STATUS_EFFECT_CONFIG = [
  { key: 'bleed', label: 'Blood Loss', color: '#c9302c' },
  { key: 'frost', label: 'Frostbite', color: '#5bc0de' },
  { key: 'poison', label: 'Poison', color: '#9c6' },
  { key: 'scarletRot', label: 'Scarlet Rot', color: '#d9534f' },
  { key: 'sleep', label: 'Sleep', color: '#a8a8d8' },
  { key: 'madness', label: 'Madness', color: '#f0ad4e' },
] as const;

describe('useStatusEffectScalingData', () => {
  const mockPrecomputed = {} as PrecomputedDataV2;

  const mockWeapon: WeaponListItem = {
    id: 'blood-venomous-fang-0',
    name: 'Venomous Fang',
    affinity: 'Blood',
    upgradeLevel: 0,
    maxUpgradeLevel: 25,
    category: 9,
    categoryName: 'Claw',
    wepmotionCategory: 22,
    weight: 2.5,
    isDualBlade: true,
    isBuffable: false,
    hasUniqueAttacks: false,
    ashOfWar: null,
    requirements: { str: 9, dex: 9, int: 0, fai: 0, arc: 0 },
    baseDamage: { physical: 93, magic: 0, fire: 0, lightning: 0, holy: 0 },
    scaling: { str: 'D', dex: 'C', int: '-', fai: '-', arc: '-' },
    damageTypes: ['slash', 'pierce'],
    guardStats: { physical: 36, magic: 21, fire: 21, lightning: 21, holy: 21, guardBoost: 19 },
  };

  const mockCurrentStats: CharacterStats = {
    vig: 40, mnd: 20, end: 25, str: 20, dex: 20, int: 10, fai: 10, arc: 30,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detecting arcane scaling', () => {
    it('identifies status effects that scale with arcane', () => {
      // Mock: bleed scales with arcane (different values at low vs high arcane)
      mockCalculateWeaponAR.mockImplementation((_precomputed, _name, _affinity, _level, stats) => {
        const arcane = stats.arc;
        return {
          total: 200,
          rounded: 200,
          requirementsMet: true,
          bleed: { base: 57, scaling: arcane * 0.5, total: 57 + arcane * 0.5, rounded: Math.floor(57 + arcane * 0.5) },
          poison: { base: 66, scaling: 0, total: 66, rounded: 66 }, // No scaling
          frost: { base: 0, scaling: 0, total: 0, rounded: 0 },
          scarletRot: { base: 0, scaling: 0, total: 0, rounded: 0 },
          sleep: { base: 0, scaling: 0, total: 0, rounded: 0 },
          madness: { base: 0, scaling: 0, total: 0, rounded: 0 },
          physical: { base: 93, scaling: 20, total: 113, rounded: 113, perStat: {} },
          magic: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          fire: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          lightning: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          holy: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
        } as any;
      });

      const { result } = renderHook(() =>
        useStatusEffectScalingData({
          precomputed: mockPrecomputed,
          weapon: mockWeapon,
          currentStats: mockCurrentStats,
          twoHanding: false,
          ignoreRequirements: true,
          statusEffectConfig: STATUS_EFFECT_CONFIG,
        })
      );

      // Bleed should scale, poison should not
      expect(result.current.hasAnyArcaneScaling).toBe(true);
      expect(result.current.activeStatusEffects).toHaveLength(2);

      const bleed = result.current.activeStatusEffects.find(e => e.key === 'bleed');
      const poison = result.current.activeStatusEffects.find(e => e.key === 'poison');

      expect(bleed?.hasArcaneScaling).toBe(true);
      expect(poison?.hasArcaneScaling).toBe(false);
    });

    it('returns hasAnyArcaneScaling=false but still generates data when status effects do not scale', () => {
      // Mock: bleed has a base value but doesn't scale with arcane
      mockCalculateWeaponAR.mockReturnValue({
        total: 200,
        rounded: 200,
        requirementsMet: true,
        bleed: { base: 45, scaling: 0, total: 45, rounded: 45 },
        poison: { base: 0, scaling: 0, total: 0, rounded: 0 },
        frost: { base: 0, scaling: 0, total: 0, rounded: 0 },
        scarletRot: { base: 0, scaling: 0, total: 0, rounded: 0 },
        sleep: { base: 0, scaling: 0, total: 0, rounded: 0 },
        madness: { base: 0, scaling: 0, total: 0, rounded: 0 },
        physical: { base: 93, scaling: 20, total: 113, rounded: 113, perStat: {} },
        magic: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
        fire: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
        lightning: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
        holy: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
      } as any);

      const { result } = renderHook(() =>
        useStatusEffectScalingData({
          precomputed: mockPrecomputed,
          weapon: mockWeapon,
          currentStats: mockCurrentStats,
          twoHanding: false,
          ignoreRequirements: true,
          statusEffectConfig: STATUS_EFFECT_CONFIG,
        })
      );

      expect(result.current.hasAnyArcaneScaling).toBe(false);
      // Still generates data for the constant status effect
      expect(result.current.activeStatusEffects).toHaveLength(1);
      expect(result.current.dataPoints).toHaveLength(99);
      // The value should be constant across all levels
      expect(result.current.dataPoints[0].bleed_total).toBe(45);
      expect(result.current.dataPoints[98].bleed_total).toBe(45);
    });

    it('returns empty data when no status effects are active', () => {
      // Mock: no status effects at all
      mockCalculateWeaponAR.mockReturnValue({
        total: 200,
        rounded: 200,
        requirementsMet: true,
        bleed: { base: 0, scaling: 0, total: 0, rounded: 0 },
        poison: { base: 0, scaling: 0, total: 0, rounded: 0 },
        frost: { base: 0, scaling: 0, total: 0, rounded: 0 },
        scarletRot: { base: 0, scaling: 0, total: 0, rounded: 0 },
        sleep: { base: 0, scaling: 0, total: 0, rounded: 0 },
        madness: { base: 0, scaling: 0, total: 0, rounded: 0 },
        physical: { base: 93, scaling: 20, total: 113, rounded: 113, perStat: {} },
        magic: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
        fire: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
        lightning: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
        holy: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
      } as any);

      const { result } = renderHook(() =>
        useStatusEffectScalingData({
          precomputed: mockPrecomputed,
          weapon: mockWeapon,
          currentStats: mockCurrentStats,
          twoHanding: false,
          ignoreRequirements: true,
          statusEffectConfig: STATUS_EFFECT_CONFIG,
        })
      );

      expect(result.current.hasAnyArcaneScaling).toBe(false);
      expect(result.current.activeStatusEffects).toHaveLength(0);
      expect(result.current.dataPoints).toHaveLength(0);
    });
  });

  describe('generating data points', () => {
    it('generates 99 data points for arcane levels 1-99', () => {
      // Mock: bleed scales with arcane
      mockCalculateWeaponAR.mockImplementation((_precomputed, _name, _affinity, _level, stats) => {
        const arcane = stats.arc;
        return {
          total: 200,
          rounded: 200,
          requirementsMet: true,
          bleed: { base: 57, scaling: arcane * 0.5, total: 57 + arcane * 0.5, rounded: Math.floor(57 + arcane * 0.5) },
          poison: { base: 0, scaling: 0, total: 0, rounded: 0 },
          frost: { base: 0, scaling: 0, total: 0, rounded: 0 },
          scarletRot: { base: 0, scaling: 0, total: 0, rounded: 0 },
          sleep: { base: 0, scaling: 0, total: 0, rounded: 0 },
          madness: { base: 0, scaling: 0, total: 0, rounded: 0 },
          physical: { base: 93, scaling: 20, total: 113, rounded: 113, perStat: {} },
          magic: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          fire: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          lightning: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          holy: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
        } as any;
      });

      const { result } = renderHook(() =>
        useStatusEffectScalingData({
          precomputed: mockPrecomputed,
          weapon: mockWeapon,
          currentStats: mockCurrentStats,
          twoHanding: false,
          ignoreRequirements: true,
          statusEffectConfig: STATUS_EFFECT_CONFIG,
        })
      );

      expect(result.current.dataPoints).toHaveLength(99);
      expect(result.current.dataPoints[0].level).toBe(1);
      expect(result.current.dataPoints[98].level).toBe(99);
    });

    it('includes total, cumulative, and incremental values for each status effect', () => {
      // Mock: bleed scales with arcane
      mockCalculateWeaponAR.mockImplementation((_precomputed, _name, _affinity, _level, stats) => {
        const arcane = stats.arc;
        const bleedTotal = 57 + arcane * 0.5;
        return {
          total: 200,
          rounded: 200,
          requirementsMet: true,
          bleed: { base: 57, scaling: arcane * 0.5, total: bleedTotal, rounded: Math.floor(bleedTotal) },
          poison: { base: 0, scaling: 0, total: 0, rounded: 0 },
          frost: { base: 0, scaling: 0, total: 0, rounded: 0 },
          scarletRot: { base: 0, scaling: 0, total: 0, rounded: 0 },
          sleep: { base: 0, scaling: 0, total: 0, rounded: 0 },
          madness: { base: 0, scaling: 0, total: 0, rounded: 0 },
          physical: { base: 93, scaling: 20, total: 113, rounded: 113, perStat: {} },
          magic: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          fire: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          lightning: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          holy: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
        } as any;
      });

      const { result } = renderHook(() =>
        useStatusEffectScalingData({
          precomputed: mockPrecomputed,
          weapon: mockWeapon,
          currentStats: mockCurrentStats,
          twoHanding: false,
          ignoreRequirements: true,
          statusEffectConfig: STATUS_EFFECT_CONFIG,
        })
      );

      // Check that data points have the expected keys
      const firstPoint = result.current.dataPoints[0];
      expect(firstPoint).toHaveProperty('bleed_total');
      expect(firstPoint).toHaveProperty('bleed_cum');
      expect(firstPoint).toHaveProperty('bleed_inc');
    });

    it('creates dataPointsByLevel map for O(1) lookups', () => {
      // Mock: bleed scales with arcane
      mockCalculateWeaponAR.mockImplementation((_precomputed, _name, _affinity, _level, stats) => {
        const arcane = stats.arc;
        return {
          total: 200,
          rounded: 200,
          requirementsMet: true,
          bleed: { base: 57, scaling: arcane * 0.5, total: 57 + arcane * 0.5, rounded: Math.floor(57 + arcane * 0.5) },
          poison: { base: 0, scaling: 0, total: 0, rounded: 0 },
          frost: { base: 0, scaling: 0, total: 0, rounded: 0 },
          scarletRot: { base: 0, scaling: 0, total: 0, rounded: 0 },
          sleep: { base: 0, scaling: 0, total: 0, rounded: 0 },
          madness: { base: 0, scaling: 0, total: 0, rounded: 0 },
          physical: { base: 93, scaling: 20, total: 113, rounded: 113, perStat: {} },
          magic: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          fire: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          lightning: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
          holy: { base: 0, scaling: 0, total: 0, rounded: 0, perStat: {} },
        } as any;
      });

      const { result } = renderHook(() =>
        useStatusEffectScalingData({
          precomputed: mockPrecomputed,
          weapon: mockWeapon,
          currentStats: mockCurrentStats,
          twoHanding: false,
          ignoreRequirements: true,
          statusEffectConfig: STATUS_EFFECT_CONFIG,
        })
      );

      expect(result.current.dataPointsByLevel).toBeInstanceOf(Map);
      expect(result.current.dataPointsByLevel.size).toBe(99);
      expect(result.current.dataPointsByLevel.get(30)).toBeDefined();
      expect(result.current.dataPointsByLevel.get(30)?.level).toBe(30);
    });
  });

  describe('handles null results from calculator', () => {
    it('returns empty result when calculator returns null', () => {
      mockCalculateWeaponAR.mockReturnValue(null);

      const { result } = renderHook(() =>
        useStatusEffectScalingData({
          precomputed: mockPrecomputed,
          weapon: mockWeapon,
          currentStats: mockCurrentStats,
          twoHanding: false,
          ignoreRequirements: true,
          statusEffectConfig: STATUS_EFFECT_CONFIG,
        })
      );

      expect(result.current.hasAnyArcaneScaling).toBe(false);
      expect(result.current.activeStatusEffects).toHaveLength(0);
      expect(result.current.dataPoints).toHaveLength(0);
    });
  });
});
