import { useMemo } from 'react';
import type { PrecomputedDataV2, CharacterStats } from '../types';
import type { SolverOptimizationMode } from '../types/solverTypes';
import { calculateWeaponAR } from '../utils/damageCalculator';
import { timeSync } from '../utils/diagnostics';

export interface StatGain {
  stat: keyof CharacterStats;
  gain: number;
  currentValue: number;
  atMax: boolean;
}

export interface StatGainsResult {
  /** All stat gains sorted by gain (highest first) */
  gains: StatGain[];
  /** The best stat to level (highest gain), or null if no positive gains */
  bestStat: keyof CharacterStats | null;
  /** The AR gain from leveling the best stat */
  bestGain: number;
  /** Quick lookup of gain by stat key */
  gainByStat: Record<string, number>;
  /** Current total AR */
  currentAR: number;
  /** Whether weapon requirements are met */
  requirementsMet: boolean;
}

interface UseStatGainsProps {
  precomputed: PrecomputedDataV2;
  weaponName: string;
  affinity: string;
  upgradeLevel: number;
  stats: CharacterStats;
  twoHanding?: boolean;
  optimizationMode?: SolverOptimizationMode;
}

const DAMAGE_STATS = ['str', 'dex', 'int', 'fai', 'arc'] as const;

/**
 * Helper to extract spell power from an AR result.
 * SP = max(sorceryScaling.total, incantationScaling.total)
 */
function getSpellPower(result: ReturnType<typeof calculateWeaponAR>): number {
  if (!result) return 0;
  const sorcery = result.sorceryScaling?.total ?? 0;
  const incant = result.incantationScaling?.total ?? 0;
  return Math.max(sorcery, incant);
}

/**
 * Hook to calculate marginal gains for each damage stat.
 * Computes how much AR (or SP in SP mode) would increase if each stat was raised by 1 point.
 *
 * This hook should be used as the single source of truth for stat gain
 * calculations, avoiding duplicate AR computations across components.
 */
export function useStatGains({
  precomputed,
  weaponName,
  affinity,
  upgradeLevel,
  stats,
  twoHanding = false,
  optimizationMode = 'AR',
}: UseStatGainsProps): StatGainsResult {
  // Memoize with primitive dependencies to avoid unnecessary recalculations
  return useMemo(() => timeSync("useStatGains", "compute", () => {
    const currentResult = calculateWeaponAR(
      precomputed,
      weaponName,
      affinity,
      upgradeLevel,
      stats,
      { twoHanding }
    );

    const currentAR = currentResult?.total ?? 0;
    const currentValue_objective = optimizationMode === 'SP'
      ? getSpellPower(currentResult)
      : currentAR;
    const requirementsMet = currentResult?.requirementsMet ?? false;

    const gains: StatGain[] = [];
    const gainByStat: Record<string, number> = {};

    for (const stat of DAMAGE_STATS) {
      const currentValue = stats[stat];
      const atMax = currentValue >= 99;

      if (atMax) {
        gains.push({ stat, gain: 0, currentValue, atMax });
        gainByStat[stat] = 0;
        continue;
      }

      // Calculate AR with +1 to this stat
      const testStats = { ...stats, [stat]: currentValue + 1 };
      const result = calculateWeaponAR(
        precomputed,
        weaponName,
        affinity,
        upgradeLevel,
        testStats,
        { twoHanding }
      );

      const newValue = optimizationMode === 'SP'
        ? getSpellPower(result)
        : (result?.total ?? 0);
      const gain = Math.round((newValue - currentValue_objective) * 100) / 100;

      gains.push({ stat, gain, currentValue, atMax });
      gainByStat[stat] = gain;
    }

    // Sort by gain descending
    gains.sort((a, b) => b.gain - a.gain);

    const bestStat = gains[0]?.gain > 0 ? gains[0].stat : null;
    const bestGain = gains[0]?.gain > 0 ? gains[0].gain : 0;

    return {
      gains,
      bestStat,
      bestGain,
      gainByStat,
      currentAR,
      requirementsMet,
    };
  }), [
    precomputed,
    weaponName,
    affinity,
    upgradeLevel,
    // Only damage-affecting stats are included as dependencies.
    // AR calculations only depend on str/dex/int/fai/arc, so changes to
    // vig/mnd/end won't affect the result and shouldn't trigger recalculation.
    stats.str,
    stats.dex,
    stats.int,
    stats.fai,
    stats.arc,
    twoHanding,
    optimizationMode,
  ]);
}
