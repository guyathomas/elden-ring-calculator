import { useMemo } from 'react';
import type { PrecomputedDataV2, WeaponListItem, CharacterStats } from '../types';
import { calculateWeaponAR } from '../utils/damageCalculator';
import { STAT_KEY_TO_FULL_NAME } from '../constants';

// Type for spell scaling result (matches calculator-core's SpellScalingResult)
interface SpellScalingPerStat {
  saturation: number;
  scaling: number;
  rawScaling: number;
}

interface SpellScalingResult {
  base: number;
  scaling: number;
  total: number;
  rounded: number;
  perStat: {
    strength: SpellScalingPerStat;
    dexterity: SpellScalingPerStat;
    intelligence: SpellScalingPerStat;
    faith: SpellScalingPerStat;
    arcane: SpellScalingPerStat;
  };
}

export interface SpellScalingDataPoint {
  level: number;
  [key: string]: number;
}

export interface UseSpellScalingDataResult {
  dataPoints: SpellScalingDataPoint[];
  dataPointsByLevel: Map<number, SpellScalingDataPoint>;
  availableDamageTypes: string[];
}

interface UseSpellScalingDataProps {
  precomputed: PrecomputedDataV2;
  weapon: WeaponListItem;
  currentStats: CharacterStats;
  twoHanding: boolean;
  ignoreRequirements: boolean;
  scalingStats: Array<{ key: string; label: string; color: string }>;
  scalingType: 'sorcery' | 'incantation';
}

// Helper to get spell scaling value from spell scaling result
function getSpellStatScaling(spellScaling: SpellScalingResult | null, statKey: string): number {
  if (!spellScaling) return 0;
  const fullName = STAT_KEY_TO_FULL_NAME[statKey] as keyof typeof spellScaling.perStat;
  return spellScaling.perStat[fullName]?.scaling || 0;
}

export function useSpellScalingData({
  precomputed,
  weapon,
  currentStats,
  twoHanding,
  ignoreRequirements,
  scalingStats,
  scalingType,
}: UseSpellScalingDataProps): UseSpellScalingDataResult {
  return useMemo(() => {
    const emptyResult: UseSpellScalingDataResult = {
      dataPoints: [],
      dataPointsByLevel: new Map(),
      availableDamageTypes: [],
    };

    if (scalingStats.length === 0) return emptyResult;

    const points: SpellScalingDataPoint[] = [];
    const levels = Array.from({ length: 99 }, (_, i) => i + 1);

    // Calculate base spell scaling for each stat at level 1
    const baseValues: Record<string, number> = {};

    scalingStats.forEach(stat => {
      const testStats = { ...currentStats, [stat.key]: levels[0] };
      const arResult = calculateWeaponAR(
        precomputed,
        weapon.name,
        weapon.affinity,
        weapon.upgradeLevel,
        testStats,
        { twoHanding, ignoreRequirements }
      );
      const spellScaling = scalingType === 'sorcery' 
        ? arResult?.sorceryScaling 
        : arResult?.incantationScaling;
      baseValues[stat.key] = spellScaling?.total ?? 100;
    });

    let previousValues: Record<string, number> = { ...baseValues };

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const point: SpellScalingDataPoint = { level };

      scalingStats.forEach(stat => {
        const testStats = { ...currentStats, [stat.key]: level };
        const arResult = calculateWeaponAR(
          precomputed,
          weapon.name,
          weapon.affinity,
          weapon.upgradeLevel,
          testStats,
          { twoHanding, ignoreRequirements }
        );
        const spellScaling = scalingType === 'sorcery' 
          ? arResult?.sorceryScaling 
          : arResult?.incantationScaling;
        const currentValue = spellScaling?.total ?? 100;

        // --- Cumulative and incremental data (similar to useScalingData) ---
        point[`${stat.key}_cum`] = currentValue - baseValues[stat.key];
        point[`${stat.key}_inc`] = i === 0 ? 0 : currentValue - previousValues[stat.key];

        // --- Source breakdown (base + per-stat scaling) ---
        const base = spellScaling?.base ?? 100;
        const thisStatScaling = getSpellStatScaling(spellScaling ?? null, stat.key);
        let otherStatsScaling = 0;
        scalingStats.forEach(otherStat => {
          if (otherStat.key !== stat.key) {
            otherStatsScaling += getSpellStatScaling(spellScaling ?? null, otherStat.key);
          }
        });

        point[`${stat.key}_spellScaling_source_base`] = base;
        point[`${stat.key}_spellScaling_source_${stat.key}`] = thisStatScaling;
        point[`${stat.key}_spellScaling_source_other`] = otherStatsScaling;

        // --- Per-stat efficiency (by damage type view: how much this stat contributes) ---
        point[`spellScaling_${stat.key}_efficiency`] = thisStatScaling;

        // --- Total spell scaling at each stat level ---
        point[`spellScaling_${stat.key}_totalAR`] = currentValue;
        point[`spellScaling_base_totalAR`] = base;

        previousValues[stat.key] = currentValue;
      });

      points.push(point);
    }

    // Create Map for O(1) level lookups
    const dataPointsByLevel = new Map(points.map(p => [p.level, p]));

    return {
      dataPoints: points,
      dataPointsByLevel,
      availableDamageTypes: [],
    };
  }, [precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, currentStats, twoHanding, ignoreRequirements, scalingStats, scalingType]);
}
