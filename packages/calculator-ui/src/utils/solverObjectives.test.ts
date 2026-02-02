/**
 * Tests for solver objective factory functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createARObjective,
  createSPObjective,
  createAoWObjective,
  createObjective,
  type ObjectiveContext,
} from './solverObjectives';
import type { CharacterStats, PrecomputedDataV2 } from '../types';
import type { PrecomputedAowData } from '../data/index';

// Mock the dependencies
vi.mock('./damageCalculator', () => ({
  calculateWeaponAR: vi.fn(),
}));

vi.mock('../data/index', () => ({
  calculateAowDamage: vi.fn(),
}));

import { calculateWeaponAR } from './damageCalculator';
import { calculateAowDamage } from '../data/index';

const mockCalculateWeaponAR = vi.mocked(calculateWeaponAR);
const mockCalculateAowDamage = vi.mocked(calculateAowDamage);

// Test fixtures
const testStats: CharacterStats = {
  vig: 40,
  mnd: 20,
  end: 25,
  str: 50,
  dex: 40,
  int: 10,
  fai: 10,
  arc: 10,
};

const baseContext: ObjectiveContext = {
  precomputed: {} as PrecomputedDataV2,
  aowData: null,
  weaponName: 'Uchigatana',
  affinity: 'Keen',
  upgradeLevel: 25,
  categoryName: 'Katana',
  twoHanding: false,
  aowName: null,
};

describe('solverObjectives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createARObjective', () => {
    it('returns a function that calculates total AR', () => {
      mockCalculateWeaponAR.mockReturnValue({
        total: 450.5,
        rounded: 451,
        requirementsMet: true,
      } as any);

      const objective = createARObjective(baseContext);
      const result = objective(testStats);

      expect(mockCalculateWeaponAR).toHaveBeenCalledWith(
        baseContext.precomputed,
        'Uchigatana',
        'Keen',
        25,
        testStats,
        { twoHanding: false }
      );
      expect(result).toBe(450.5);
    });

    it('returns 0 when AR calculation fails', () => {
      mockCalculateWeaponAR.mockReturnValue(null);

      const objective = createARObjective(baseContext);
      const result = objective(testStats);

      expect(result).toBe(0);
    });

    it('respects twoHanding option', () => {
      mockCalculateWeaponAR.mockReturnValue({ total: 500 } as any);

      const ctx = { ...baseContext, twoHanding: true };
      const objective = createARObjective(ctx);
      objective(testStats);

      expect(mockCalculateWeaponAR).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        { twoHanding: true }
      );
    });
  });

  describe('createSPObjective', () => {
    it('returns max of sorcery and incantation scaling', () => {
      mockCalculateWeaponAR.mockReturnValue({
        total: 100,
        sorceryScaling: { total: 300 },
        incantationScaling: { total: 250 },
      } as any);

      const objective = createSPObjective(baseContext);
      const result = objective(testStats);

      expect(result).toBe(300);
    });

    it('returns incantation scaling when higher', () => {
      mockCalculateWeaponAR.mockReturnValue({
        total: 100,
        sorceryScaling: { total: 200 },
        incantationScaling: { total: 350 },
      } as any);

      const objective = createSPObjective(baseContext);
      const result = objective(testStats);

      expect(result).toBe(350);
    });

    it('returns 0 when no spell scaling exists', () => {
      mockCalculateWeaponAR.mockReturnValue({
        total: 100,
        sorceryScaling: null,
        incantationScaling: null,
      } as any);

      const objective = createSPObjective(baseContext);
      const result = objective(testStats);

      expect(result).toBe(0);
    });

    it('returns 0 when AR calculation fails', () => {
      mockCalculateWeaponAR.mockReturnValue(null);

      const objective = createSPObjective(baseContext);
      const result = objective(testStats);

      expect(result).toBe(0);
    });
  });

  describe('createAoWObjective', () => {
    it('sums total damage across all attacks', () => {
      mockCalculateAowDamage.mockReturnValue({
        attacks: [
          { motionDamage: 150, bulletDamage: 50 },  // 200 total
          { motionDamage: 100, bulletDamage: 50 },  // 150 total
          { motionDamage: 80, bulletDamage: 20 },   // 100 total
        ],
      } as any);

      const ctx: ObjectiveContext = {
        ...baseContext,
        aowData: {} as PrecomputedAowData,
        aowName: 'Transient Moonlight',
      };

      const objective = createAoWObjective(ctx);
      const result = objective(testStats);

      expect(result).toBe(450);
    });

    it('passes correct parameters to calculateAowDamage', () => {
      mockCalculateAowDamage.mockReturnValue({ attacks: [] } as any);

      const ctx: ObjectiveContext = {
        ...baseContext,
        aowData: { test: 'data' } as any,
        aowName: 'Lion\'s Claw',
        twoHanding: true,
      };

      const objective = createAoWObjective(ctx);
      objective(testStats);

      expect(mockCalculateAowDamage).toHaveBeenCalledWith(
        { test: 'data' },
        ctx.precomputed,
        {
          weaponName: 'Uchigatana',
          affinity: 'Keen',
          upgradeLevel: 25,
          weaponClass: 'Katana',
          strength: 50,
          dexterity: 40,
          intelligence: 10,
          faith: 10,
          arcane: 10,
          twoHanding: true,
          aowName: 'Lion\'s Claw',
          ignoreRequirements: false,
          pvpMode: false,
          showLackingFp: false,
        }
      );
    });

    it('falls back to AR objective when no aowData', () => {
      mockCalculateWeaponAR.mockReturnValue({ total: 400 } as any);

      const ctx: ObjectiveContext = {
        ...baseContext,
        aowData: null,
        aowName: 'Some AoW',
      };

      const objective = createAoWObjective(ctx);
      const result = objective(testStats);

      // Should call AR calculation, not AoW
      expect(mockCalculateWeaponAR).toHaveBeenCalled();
      expect(mockCalculateAowDamage).not.toHaveBeenCalled();
      expect(result).toBe(400);
    });

    it('falls back to AR objective when no aowName', () => {
      mockCalculateWeaponAR.mockReturnValue({ total: 400 } as any);

      const ctx: ObjectiveContext = {
        ...baseContext,
        aowData: {} as PrecomputedAowData,
        aowName: null,
      };

      const objective = createAoWObjective(ctx);
      const result = objective(testStats);

      expect(mockCalculateWeaponAR).toHaveBeenCalled();
      expect(mockCalculateAowDamage).not.toHaveBeenCalled();
      expect(result).toBe(400);
    });
  });

  describe('createObjective', () => {
    it('creates AR objective for AR mode', () => {
      mockCalculateWeaponAR.mockReturnValue({ total: 500 } as any);

      const objective = createObjective('AR', baseContext);
      const result = objective(testStats);

      expect(result).toBe(500);
    });

    it('creates SP objective for SP mode', () => {
      mockCalculateWeaponAR.mockReturnValue({
        total: 100,
        sorceryScaling: { total: 300 },
        incantationScaling: null,
      } as any);

      const objective = createObjective('SP', baseContext);
      const result = objective(testStats);

      expect(result).toBe(300);
    });

    it('creates AoW objective for AoW mode', () => {
      mockCalculateAowDamage.mockReturnValue({
        attacks: [{ motionDamage: 400, bulletDamage: 200 }],
      } as any);

      const ctx: ObjectiveContext = {
        ...baseContext,
        aowData: {} as PrecomputedAowData,
        aowName: 'Test AoW',
      };

      const objective = createObjective('AoW', ctx);
      const result = objective(testStats);

      expect(result).toBe(600);
    });

    it('defaults to AR for unknown mode', () => {
      mockCalculateWeaponAR.mockReturnValue({ total: 500 } as any);

      // @ts-expect-error - testing invalid mode
      const objective = createObjective('INVALID', baseContext);
      const result = objective(testStats);

      expect(result).toBe(500);
    });
  });
});
