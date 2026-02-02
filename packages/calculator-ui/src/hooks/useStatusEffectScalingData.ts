import { useMemo } from 'react';
import type { PrecomputedDataV2, WeaponListItem, CharacterStats } from '../types';
import { calculateWeaponAR } from '../utils/damageCalculator';
import type { ScalingDataPoint } from '../types/scaling';

export interface StatusEffectInfo {
  key: string;
  label: string;
  color: string;
  hasArcaneScaling: boolean;
}

export interface UseStatusEffectScalingDataResult {
  dataPoints: ScalingDataPoint[];
  dataPointsByLevel: Map<number, ScalingDataPoint>;
  activeStatusEffects: StatusEffectInfo[];
  hasAnyArcaneScaling: boolean;
}

interface UseStatusEffectScalingDataProps {
  precomputed: PrecomputedDataV2;
  weapon: WeaponListItem;
  currentStats: CharacterStats;
  twoHanding: boolean;
  ignoreRequirements: boolean;
  statusEffectConfig: readonly { key: string; label: string; color: string }[];
}

export function useStatusEffectScalingData({
  precomputed,
  weapon,
  currentStats,
  twoHanding,
  ignoreRequirements,
  statusEffectConfig,
}: UseStatusEffectScalingDataProps): UseStatusEffectScalingDataResult {
  return useMemo(() => {
    const emptyResult: UseStatusEffectScalingDataResult = {
      dataPoints: [],
      dataPointsByLevel: new Map(),
      activeStatusEffects: [],
      hasAnyArcaneScaling: false,
    };

    // First, determine which status effects are active and have arcane scaling
    // by checking the weapon at a low arcane level vs a high arcane level
    const lowArcaneStats = { ...currentStats, arc: 10 };
    const highArcaneStats = { ...currentStats, arc: 99 };

    const lowResult = calculateWeaponAR(
      precomputed,
      weapon.name,
      weapon.affinity,
      weapon.upgradeLevel,
      lowArcaneStats,
      { twoHanding, ignoreRequirements: true }
    );

    const highResult = calculateWeaponAR(
      precomputed,
      weapon.name,
      weapon.affinity,
      weapon.upgradeLevel,
      highArcaneStats,
      { twoHanding, ignoreRequirements: true }
    );

    if (!lowResult || !highResult) return emptyResult;

    // Find status effects that are active and scale with arcane
    const activeStatusEffects: StatusEffectInfo[] = [];

    for (const { key, label, color } of statusEffectConfig) {
      const lowEffect = lowResult[key as keyof typeof lowResult] as { base: number; scaling: number; rounded: number };
      const highEffect = highResult[key as keyof typeof highResult] as { base: number; scaling: number; rounded: number };

      // Status effect is active if it has a base value > 0
      if (lowEffect.base > 0) {
        // Has arcane scaling if the value changes between low and high arcane
        const hasArcaneScaling = highEffect.rounded > lowEffect.rounded;
        activeStatusEffects.push({
          key,
          label,
          color,
          hasArcaneScaling,
        });
      }
    }

    // Check if any status effects have arcane scaling
    const hasAnyArcaneScaling = activeStatusEffects.some(e => e.hasArcaneScaling);

    // Return empty if no active status effects at all
    if (activeStatusEffects.length === 0) {
      return emptyResult;
    }

    // Generate data points for arcane levels 1-99
    const points: ScalingDataPoint[] = [];
    const levels = Array.from({ length: 99 }, (_, i) => i + 1);

    // Get base values at arcane 1 for cumulative calculation
    const baseResult = calculateWeaponAR(
      precomputed,
      weapon.name,
      weapon.affinity,
      weapon.upgradeLevel,
      { ...currentStats, arc: 1 },
      { twoHanding, ignoreRequirements }
    );

    const baseValues: Record<string, number> = {};
    if (baseResult) {
      for (const { key } of activeStatusEffects) {
        const effect = baseResult[key as keyof typeof baseResult] as { total: number };
        baseValues[key] = effect.total;
      }
    }

    let previousValues: Record<string, number> = { ...baseValues };

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const point: ScalingDataPoint = { level };

      const testStats = { ...currentStats, arc: level };
      const arResult = calculateWeaponAR(
        precomputed,
        weapon.name,
        weapon.affinity,
        weapon.upgradeLevel,
        testStats,
        { twoHanding, ignoreRequirements }
      );

      if (arResult) {
        for (const { key } of activeStatusEffects) {
          const effect = arResult[key as keyof typeof arResult] as { base: number; scaling: number; total: number; rounded: number };

          // Total value at this arcane level
          point[`${key}_total`] = effect.total;

          // Cumulative scaling from base (arcane 1)
          point[`${key}_cum`] = effect.total - (baseValues[key] ?? 0);

          // Per-point increment
          point[`${key}_inc`] = i === 0 ? 0 : effect.total - (previousValues[key] ?? 0);

          previousValues[key] = effect.total;
        }
      }

      points.push(point);
    }

    // Create Map for O(1) level lookups
    const dataPointsByLevel = new Map(points.map(p => [p.level, p]));

    return {
      dataPoints: points,
      dataPointsByLevel,
      activeStatusEffects,
      hasAnyArcaneScaling,
    };
  }, [precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, currentStats, twoHanding, ignoreRequirements, statusEffectConfig]);
}
