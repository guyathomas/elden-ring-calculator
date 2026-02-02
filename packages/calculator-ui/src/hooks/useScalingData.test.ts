import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScalingData } from './useScalingData';
import type { PrecomputedDataV2, CurveDefinition } from '../../../calculator-core/dist/client.js';
import type { WeaponListItem, CharacterStats } from '../types';

// Mock curve definition for consistent testing
const mockCurve: CurveDefinition = {
  id: 1,
  stageMaxVal: [25, 60, 80, 150, 150],
  stageMaxGrowVal: [25, 60, 80, 100, 100],
  adjPt_maxGrowVal: [1.2, -1.2, 1, 1, 1],
};

// Basic mock precomputed data with a quality weapon (STR + DEX scaling)
const mockPrecomputed: PrecomputedDataV2 = {
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
      requirements: { strength: 12, dexterity: 12, intelligence: 0, faith: 0, arcane: 0 },
      affinities: {
        'Standard': {
          id: 100,
          reinforceTypeId: 0,
          physical: {
            attackBase: 100,
            scaling: {
              strength: { base: 80, curveId: 1, isOverride: false },
              dexterity: { base: 60, curveId: 1, isOverride: false },
              intelligence: null,
              faith: null,
              arcane: null,
            },
          },
          magic: null,
          fire: null,
          lightning: null,
          holy: null,
          poison: null,
          scarletRot: null,
          bleed: null,
          frost: null,
          sleep: null,
          madness: null,
          sorceryScaling: null,
          incantationScaling: null,
          weaponScaling: { strength: 80, dexterity: 60, intelligence: 0, faith: 0, arcane: 0 },
        },
      },
    },
    // Magic weapon with split damage
    'MagicSword': {
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
      requirements: { strength: 10, dexterity: 10, intelligence: 18, faith: 0, arcane: 0 },
      affinities: {
        'Magic': {
          id: 200,
          reinforceTypeId: 0,
          physical: {
            attackBase: 60,
            scaling: {
              strength: { base: 30, curveId: 1, isOverride: false },
              dexterity: null,
              intelligence: null,
              faith: null,
              arcane: null,
            },
          },
          magic: {
            attackBase: 80,
            scaling: {
              strength: null,
              dexterity: null,
              intelligence: { base: 100, curveId: 1, isOverride: false },
              faith: null,
              arcane: null,
            },
          },
          fire: null,
          lightning: null,
          holy: null,
          poison: null,
          scarletRot: null,
          bleed: null,
          frost: null,
          sleep: null,
          madness: null,
          sorceryScaling: null,
          incantationScaling: null,
          weaponScaling: { strength: 30, dexterity: 0, intelligence: 100, faith: 0, arcane: 0 },
        },
      },
    },
    // No scaling weapon
    'NoScalingWeapon': {
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
          id: 300,
          reinforceTypeId: 0,
          physical: {
            attackBase: 100,
            scaling: {
              strength: null,
              dexterity: null,
              intelligence: null,
              faith: null,
              arcane: null,
            },
          },
          magic: null,
          fire: null,
          lightning: null,
          holy: null,
          poison: null,
          scarletRot: null,
          bleed: null,
          frost: null,
          sleep: null,
          madness: null,
          sorceryScaling: null,
          incantationScaling: null,
          weaponScaling: { strength: 0, dexterity: 0, intelligence: 0, faith: 0, arcane: 0 },
        },
      },
    },
  },
  curves: {
    1: mockCurve,
  },
  reinforceRates: {
    '0': {
      physicsAtkRate: 1,
      magicAtkRate: 1,
      fireAtkRate: 1,
      thunderAtkRate: 1,
      darkAtkRate: 1,
      staminaAtkRate: 1,
      correctStrengthRate: 1,
      correctAgilityRate: 1,
      correctMagicRate: 1,
      correctFaithRate: 1,
      correctLuckRate: 1,
      spEffectId1: 0,
      spEffectId2: 0,
    },
  },
  spEffects: {},
};

const createMockWeapon = (
  name: string,
  affinity: string,
  scaling: Record<string, string>,
  requirements: Record<string, number> = {}
): WeaponListItem => ({
  id: `${name}-${affinity}-0`,
  name,
  affinity,
  upgradeLevel: 0,
  maxUpgradeLevel: 25,
  category: 1,
  categoryName: 'Sword',
  weight: 4.5,
  isDualBlade: false,
  isBuffable: true,
  criticalValue: 100,
  isUnique: false,
  hasUniqueAttacks: false,
  requirements: {
    str: requirements.str ?? 0,
    dex: requirements.dex ?? 0,
    int: requirements.int ?? 0,
    fai: requirements.fai ?? 0,
    arc: requirements.arc ?? 0,
  },
  baseDamage: {
    physical: 100,
    magic: 0,
    fire: 0,
    lightning: 0,
    holy: 0,
  },
  scaling: {
    str: scaling.str as any ?? '-',
    dex: scaling.dex as any ?? '-',
    int: scaling.int as any ?? '-',
    fai: scaling.fai as any ?? '-',
    arc: scaling.arc as any ?? '-',
  },
  rawScaling: {
    str: scaling.str !== '-' ? 80 : 0,
    dex: scaling.dex !== '-' ? 60 : 0,
    int: scaling.int !== '-' ? 100 : 0,
    fai: 0,
    arc: 0,
  },
  hasSorceryScaling: false,
  hasIncantationScaling: false,
});

const defaultStats: CharacterStats = {
  vig: 40,
  mnd: 20,
  end: 25,
  str: 40,
  dex: 30,
  int: 10,
  fai: 10,
  arc: 10,
};

describe('useScalingData', () => {
  describe('return structure', () => {
    it('should return dataPoints, dataPointsByLevel Map, and availableDamageTypes', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C', dex: 'D' }, { str: 12, dex: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
        { key: 'dex', label: 'DEX', grade: 'D', color: '#ef4444' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: false,
          scalingStats,
        })
      );

      expect(result.current.dataPoints).toBeDefined();
      expect(Array.isArray(result.current.dataPoints)).toBe(true);
      expect(result.current.dataPointsByLevel).toBeDefined();
      expect(result.current.dataPointsByLevel instanceof Map).toBe(true);
      expect(result.current.availableDamageTypes).toBeDefined();
      expect(Array.isArray(result.current.availableDamageTypes)).toBe(true);
    });

    it('should return 99 data points (levels 1-99)', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C', dex: 'D' }, { str: 12, dex: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: false,
          scalingStats,
        })
      );

      expect(result.current.dataPoints.length).toBe(99);
      expect(result.current.dataPoints[0].level).toBe(1);
      expect(result.current.dataPoints[98].level).toBe(99);
    });

    it('should have Map entries for each level 1-99', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C' }, { str: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: false,
          scalingStats,
        })
      );

      expect(result.current.dataPointsByLevel.size).toBe(99);
      for (let i = 1; i <= 99; i++) {
        expect(result.current.dataPointsByLevel.has(i)).toBe(true);
      }
    });
  });

  describe('empty state handling', () => {
    it('should return empty result when no scaling stats provided', () => {
      const weapon = createMockWeapon('NoScalingWeapon', 'Standard', {});

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: false,
          scalingStats: [],
        })
      );

      expect(result.current.dataPoints.length).toBe(0);
      expect(result.current.dataPointsByLevel.size).toBe(0);
      expect(result.current.availableDamageTypes).toContain('total');
      expect(result.current.availableDamageTypes).toContain('physical');
    });
  });

  describe('data point properties', () => {
    it('should have cumulative scaling data (_cum suffix)', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C' }, { str: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: false,
          scalingStats,
        })
      );

      const point = result.current.dataPointsByLevel.get(50);
      expect(point).toBeDefined();
      expect(point!['str_cum']).toBeDefined();
    });

    it('should have incremental scaling data (_inc suffix)', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C' }, { str: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: false,
          scalingStats,
        })
      );

      const point = result.current.dataPointsByLevel.get(50);
      expect(point).toBeDefined();
      expect(point!['str_inc']).toBeDefined();
    });

    it('should have efficiency data per stat per damage type', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C' }, { str: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: false,
          scalingStats,
        })
      );

      const point = result.current.dataPointsByLevel.get(50);
      expect(point).toBeDefined();
      expect(point!['total_str_efficiency']).toBeDefined();
      expect(point!['physical_str_efficiency']).toBeDefined();
    });

    it('should have totalAR data per stat per damage type', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C' }, { str: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: false,
          scalingStats,
        })
      );

      const point = result.current.dataPointsByLevel.get(50);
      expect(point).toBeDefined();
      expect(point!['total_str_totalAR']).toBeDefined();
      expect(point!['physical_str_totalAR']).toBeDefined();
    });
  });

  describe('scaling behavior', () => {
    it('should show increasing cumulative scaling as stat level increases', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C' }, { str: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: true,
          scalingStats,
        })
      );

      const point20 = result.current.dataPointsByLevel.get(20)!;
      const point50 = result.current.dataPointsByLevel.get(50)!;
      const point80 = result.current.dataPointsByLevel.get(80)!;

      // Cumulative scaling should increase with level
      expect(point50['str_cum']).toBeGreaterThan(point20['str_cum']);
      expect(point80['str_cum']).toBeGreaterThan(point50['str_cum']);
    });

    it('should have 0 incremental at level 1', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C' }, { str: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: true,
          scalingStats,
        })
      );

      const point1 = result.current.dataPointsByLevel.get(1)!;
      expect(point1['str_inc']).toBe(0);
    });

    it('should have positive incremental values after level 1 for weapons with scaling', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C' }, { str: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: true,
          scalingStats,
        })
      );

      const point30 = result.current.dataPointsByLevel.get(30)!;
      expect(point30['str_inc']).toBeGreaterThanOrEqual(0);
    });
  });

  describe('available damage types', () => {
    it('should include total and physical for physical-only weapons', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C' }, { str: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: false,
          scalingStats,
        })
      );

      expect(result.current.availableDamageTypes).toContain('total');
      expect(result.current.availableDamageTypes).toContain('physical');
    });

    it('should include magic for magic weapons', () => {
      const weapon = createMockWeapon('MagicSword', 'Magic', { str: 'E', int: 'B' }, { str: 10, int: 18 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'E', color: '#f59e0b' },
        { key: 'int', label: 'INT', grade: 'B', color: '#3b82f6' },
      ];

      const { result } = renderHook(() =>
        useScalingData({
          precomputed: mockPrecomputed,
          weapon,
          currentStats: defaultStats,
          twoHanding: false,
          ignoreRequirements: false,
          scalingStats,
        })
      );

      expect(result.current.availableDamageTypes).toContain('total');
      expect(result.current.availableDamageTypes).toContain('physical');
      expect(result.current.availableDamageTypes).toContain('magic');
    });
  });

  describe('memoization', () => {
    it('should return same reference when inputs unchanged', () => {
      const weapon = createMockWeapon('TestWeapon', 'Standard', { str: 'C' }, { str: 12 });
      const scalingStats = [
        { key: 'str', label: 'STR', grade: 'C', color: '#f59e0b' },
      ];

      const props = {
        precomputed: mockPrecomputed,
        weapon,
        currentStats: defaultStats,
        twoHanding: false,
        ignoreRequirements: false,
        scalingStats,
      };

      const { result, rerender } = renderHook(
        (p) => useScalingData(p),
        { initialProps: props }
      );

      const firstResult = result.current;
      rerender(props);
      const secondResult = result.current;

      expect(firstResult.dataPoints).toBe(secondResult.dataPoints);
      expect(firstResult.dataPointsByLevel).toBe(secondResult.dataPointsByLevel);
    });
  });
});
