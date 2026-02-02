import { useMemo } from 'react';
import type { PrecomputedDataV2, WeaponListItem, CharacterStats } from '../types';
import { calculateWeaponAR } from '../utils/damageCalculator';
import { DAMAGE_COLORS, STAT_KEY_TO_FULL_NAME } from '../constants';

export interface ScalingDataPoint {
  level: number;
  [key: string]: number;
}

export interface UseScalingDataResult {
  dataPoints: ScalingDataPoint[];
  dataPointsByLevel: Map<number, ScalingDataPoint>;
  availableDamageTypes: string[];
}

interface UseScalingDataProps {
  precomputed: PrecomputedDataV2;
  weapon: WeaponListItem;
  currentStats: CharacterStats;
  twoHanding: boolean;
  ignoreRequirements: boolean;
  scalingStats: Array<{ key: string; label: string; grade: string; color: string }>;
}

// Helper to safely get scaling for a specific stat key
function getStatScaling(damageResult: any, statKey: string): number {
  const fullName = STAT_KEY_TO_FULL_NAME[statKey];
  return damageResult.perStat[fullName]?.scaling || 0;
}

export function useScalingData({
  precomputed,
  weapon,
  currentStats,
  twoHanding,
  ignoreRequirements,
  scalingStats,
}: UseScalingDataProps): UseScalingDataResult {
  return useMemo(() => {
    const emptyResult: UseScalingDataResult = {
      dataPoints: [],
      dataPointsByLevel: new Map(),
      availableDamageTypes: ['total', 'physical'],
    };

    if (scalingStats.length === 0) return emptyResult;

    const points: ScalingDataPoint[] = [];
    const levels = Array.from({ length: 99 }, (_, i) => i + 1);

    // Determine available damage types from first calculation
    const firstArResult = calculateWeaponAR(
      precomputed,
      weapon.name,
      weapon.affinity,
      weapon.upgradeLevel,
      currentStats,
      { twoHanding, ignoreRequirements }
    );

    const availableDamageTypes = firstArResult
      ? ['total', ...Object.keys(DAMAGE_COLORS).filter(type => {
          const result = firstArResult[type as keyof typeof DAMAGE_COLORS];
          return result.base > 0 || result.scaling > 0;
        })]
      : ['total', 'physical'];

    // Calculate base AR for each stat at level 1
    const baseARs: Record<string, number> = {};
    const baseDamageTypes: Record<string, Record<string, number>> = {};

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
      baseARs[stat.key] = arResult?.rounded ?? 0;
      
      baseDamageTypes[stat.key] = {};
      if (arResult) {
        Object.entries(DAMAGE_COLORS).forEach(([type]) => {
          baseDamageTypes[stat.key][type] = arResult[type as keyof typeof DAMAGE_COLORS].rounded;
        });
      }
    });

    let previousARs: Record<string, number> = { ...baseARs };
    let previousDamageTypes: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(baseDamageTypes));

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const point: ScalingDataPoint = { level };

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
        const currentAR = arResult?.total ?? 0;

        // --- All Stats View Data (By Stat → All Stats tab) ---
        point[`${stat.key}_cum`] = currentAR - baseARs[stat.key];
        point[`${stat.key}_inc`] = i === 0 ? 0 : currentAR - previousARs[stat.key];
        
        // --- Composition View Data (By Stat → Single Stat → Composition) ---
        if (arResult) {
          Object.entries(DAMAGE_COLORS).forEach(([type]) => {
            const currentVal = arResult[type as keyof typeof DAMAGE_COLORS].total;
            const baseVal = baseDamageTypes[stat.key][type];
            const prevVal = previousDamageTypes[stat.key][type];

            point[`${stat.key}_${type}_cum`] = Math.max(0, currentVal - baseVal);
            point[`${stat.key}_${type}_inc`] = i === 0 ? 0 : Math.max(0, currentVal - prevVal);
            
            previousDamageTypes[stat.key][type] = currentVal;
          });
        }

        // --- Source Breakdown View Data (By Stat → Single Stat → Source) ---
        if (arResult) {
          availableDamageTypes.forEach(dtype => {
            let base = 0;
            let thisStatScaling = 0;
            let otherStatsScaling = 0;

            if (dtype === 'total') {
              // Aggregate across all damage types
              Object.keys(DAMAGE_COLORS).forEach(type => {
                const damageResult = arResult[type as keyof typeof DAMAGE_COLORS];
                base += damageResult.base;
                thisStatScaling += getStatScaling(damageResult, stat.key);
                
                scalingStats.forEach(otherStat => {
                  if (otherStat.key !== stat.key) {
                    otherStatsScaling += getStatScaling(damageResult, otherStat.key);
                  }
                });
              });
            } else {
              // Specific damage type
              const damageResult = arResult[dtype as keyof typeof DAMAGE_COLORS];
              base = damageResult.base;
              thisStatScaling = getStatScaling(damageResult, stat.key);
              
              scalingStats.forEach(otherStat => {
                if (otherStat.key !== stat.key) {
                  otherStatsScaling += getStatScaling(damageResult, otherStat.key);
                }
              });
            }

            point[`${stat.key}_${dtype}_source_base`] = base;
            point[`${stat.key}_${dtype}_source_${stat.key}`] = thisStatScaling;
            point[`${stat.key}_${dtype}_source_other`] = otherStatsScaling;
          });
        }

        // --- Efficiency View Data (By Damage Type → Single Type → Efficiency) ---
        // Shows how each stat contributes to the selected damage type
        // When requirements aren't met, actual contribution is 0 (perStat shows potential)
        if (arResult) {
          availableDamageTypes.forEach(dtype => {
            if (dtype === 'total') {
              // Total AR contribution from this stat
              let totalScaling = 0;
              if (arResult.requirementsMet) {
                Object.keys(DAMAGE_COLORS).forEach(type => {
                  const damageResult = arResult[type as keyof typeof DAMAGE_COLORS];
                  totalScaling += getStatScaling(damageResult, stat.key);
                });
              }
              point[`${dtype}_${stat.key}_efficiency`] = totalScaling;
            } else {
              // Specific damage type contribution from this stat
              if (arResult.requirementsMet) {
                const damageResult = arResult[dtype as keyof typeof DAMAGE_COLORS];
                point[`${dtype}_${stat.key}_efficiency`] = getStatScaling(damageResult, stat.key);
              } else {
                point[`${dtype}_${stat.key}_efficiency`] = 0;
              }
            }
          });
        }

        // --- Total AR View Data (absolute damage at each stat level) ---
        if (arResult) {
          availableDamageTypes.forEach(dtype => {
            if (dtype === 'total') {
              point[`${dtype}_${stat.key}_totalAR`] = arResult.total;
              // Base damage (constant across all levels) - sum of all base damages
              let totalBase = 0;
              Object.keys(DAMAGE_COLORS).forEach(type => {
                totalBase += arResult[type as keyof typeof DAMAGE_COLORS].base;
              });
              point[`${dtype}_base_totalAR`] = totalBase;
            } else {
              const damageResult = arResult[dtype as keyof typeof DAMAGE_COLORS];
              point[`${dtype}_${stat.key}_totalAR`] = damageResult.total;
              // Base damage for this specific damage type
              point[`${dtype}_base_totalAR`] = damageResult.base;
            }
          });
        }

        previousARs[stat.key] = currentAR;
      });

      points.push(point);
    }

    // Create Map for O(1) level lookups
    const dataPointsByLevel = new Map(points.map(p => [p.level, p]));

    return {
      dataPoints: points,
      dataPointsByLevel,
      availableDamageTypes,
    };
  }, [precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, currentStats, twoHanding, ignoreRequirements, scalingStats]);
}

