import { useMemo } from 'react';
import type { PrecomputedDataV2, CharacterStats } from '../types';
import { toCalculatorStats } from '../types';
import type { PrecomputedAowData, AowAttackResult } from '../data';
import { calculateAowDamage } from '../data';
import type { ScalingDataPoint, ScalingStat } from '../types/scaling';
import { TOTAL_ATK_ID } from '../components/AshAttackTable';

// ============================================================================
// Types
// ============================================================================

export interface UseAoWScalingDataResult {
  dataPoints: ScalingDataPoint[];
  dataPointsByLevel: Map<number, ScalingDataPoint>;
  availableDamageTypes: string[];
}

interface UseAoWScalingDataProps {
  precomputed: PrecomputedDataV2;
  aowData: PrecomputedAowData;
  weaponName: string;
  affinity: string;
  upgradeLevel: number;
  categoryName: string;
  currentStats: CharacterStats;
  twoHanding: boolean;
  ignoreRequirements: boolean;
  scalingStats: ScalingStat[];
  aowName: string;
  selectedAttackId: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

const DAMAGE_TYPES = ['physical', 'magic', 'fire', 'lightning', 'holy'] as const;
type DamageType = typeof DAMAGE_TYPES[number];

function getAttackDamage(attack: AowAttackResult, damageType: DamageType): number {
  const value = attack[damageType];
  return value === '-' ? 0 : value;
}

function getTotalDamage(attack: AowAttackResult): number {
  return DAMAGE_TYPES.reduce((sum, type) => sum + getAttackDamage(attack, type), 0);
}

function findAttack(attacks: AowAttackResult[], atkId: number): AowAttackResult | null {
  return attacks.find(a => a.atkId === atkId) ?? null;
}

// Sum damage across all attacks for "Total" selection
function sumAllAttacksDamage(attacks: AowAttackResult[]): number {
  return attacks.reduce((sum, attack) => sum + getTotalDamage(attack), 0);
}

function sumAllAttacksDamageByType(attacks: AowAttackResult[], damageType: DamageType): number {
  return attacks.reduce((sum, attack) => sum + getAttackDamage(attack, damageType), 0);
}

// Get damage values - either for a single attack or sum of all attacks
function getDamageForSelection(
  attacks: AowAttackResult[],
  selectedAttackId: number
): { total: number; byType: Record<DamageType, number> } {
  if (selectedAttackId === TOTAL_ATK_ID) {
    // Sum all attacks
    const byType: Record<DamageType, number> = {} as Record<DamageType, number>;
    DAMAGE_TYPES.forEach(type => {
      byType[type] = sumAllAttacksDamageByType(attacks, type);
    });
    return {
      total: sumAllAttacksDamage(attacks),
      byType,
    };
  } else {
    // Single attack
    const attack = findAttack(attacks, selectedAttackId);
    if (!attack) {
      const byType: Record<DamageType, number> = {} as Record<DamageType, number>;
      DAMAGE_TYPES.forEach(type => { byType[type] = 0; });
      return { total: 0, byType };
    }
    const byType: Record<DamageType, number> = {} as Record<DamageType, number>;
    DAMAGE_TYPES.forEach(type => {
      byType[type] = getAttackDamage(attack, type);
    });
    return {
      total: getTotalDamage(attack),
      byType,
    };
  }
}

// ============================================================================
// Main Hook
// ============================================================================

export function useAoWScalingData({
  precomputed,
  aowData,
  weaponName,
  affinity,
  upgradeLevel,
  categoryName,
  currentStats,
  twoHanding,
  ignoreRequirements,
  scalingStats,
  aowName,
  selectedAttackId,
}: UseAoWScalingDataProps): UseAoWScalingDataResult {
  return useMemo(() => {
    const emptyResult: UseAoWScalingDataResult = {
      dataPoints: [],
      dataPointsByLevel: new Map(),
      availableDamageTypes: ['total'],
    };

    if (scalingStats.length === 0) return emptyResult;

    const points: ScalingDataPoint[] = [];
    const levels = Array.from({ length: 99 }, (_, i) => i + 1);

    // Determine available damage types from first calculation
    const firstCalcStats = toCalculatorStats(currentStats);
    const firstResult = calculateAowDamage(aowData, precomputed, {
      weaponName,
      affinity,
      upgradeLevel,
      weaponClass: categoryName,
      ...firstCalcStats,
      twoHanding,
      ignoreRequirements: true,
      pvpMode: false,
      showLackingFp: false,
      aowName,
    });

    const firstDamage = firstResult
      ? getDamageForSelection(firstResult.attacks, selectedAttackId)
      : { total: 0, byType: {} as Record<DamageType, number> };
    // Include 'total' plus any specific damage types that have values
    const specificDamageTypes = DAMAGE_TYPES.filter(type => firstDamage.byType[type] > 0);
    const availableDamageTypes = ['total', ...specificDamageTypes];

    // Calculate base damage for each stat at level 1
    const baseTotals: Record<string, number> = {};
    const baseDamageByType: Record<string, Record<string, number>> = {};

    scalingStats.forEach(stat => {
      const testStats = toCalculatorStats({ ...currentStats, [stat.key]: levels[0] });
      const result = calculateAowDamage(aowData, precomputed, {
        weaponName,
        affinity,
        upgradeLevel,
        weaponClass: categoryName,
        ...testStats,
        twoHanding,
        ignoreRequirements,
        pvpMode: false,
        showLackingFp: false,
        aowName,
      });

      const damage = result
        ? getDamageForSelection(result.attacks, selectedAttackId)
        : { total: 0, byType: {} as Record<DamageType, number> };
      baseTotals[stat.key] = damage.total;

      baseDamageByType[stat.key] = {};
      DAMAGE_TYPES.forEach(type => {
        baseDamageByType[stat.key][type] = damage.byType[type] ?? 0;
      });
    });

    // Generate data points for each level
    for (const level of levels) {
      const point: ScalingDataPoint = { level };

      scalingStats.forEach(stat => {
        const testStats = toCalculatorStats({ ...currentStats, [stat.key]: level });
        const result = calculateAowDamage(aowData, precomputed, {
          weaponName,
          affinity,
          upgradeLevel,
          weaponClass: categoryName,
          ...testStats,
          twoHanding,
          ignoreRequirements,
          pvpMode: false,
          showLackingFp: false,
          aowName,
        });

        const damage = result
          ? getDamageForSelection(result.attacks, selectedAttackId)
          : { total: 0, byType: {} as Record<DamageType, number> };
        const currentTotal = damage.total;

        // Cumulative scaling (total - base at level 1)
        const cumulativeScaling = currentTotal - baseTotals[stat.key];
        point[`${stat.key}_cum`] = cumulativeScaling;

        // Total damage at this level (for totalAR view)
        point[`total_${stat.key}_totalAR`] = currentTotal;

        // Total efficiency (for "By Damage Type" + "Total" selection)
        point[`total_${stat.key}_efficiency`] = cumulativeScaling;

        // Per damage type data (no base line for AoW - conceptually doesn't have "base" damage)
        availableDamageTypes.forEach(dtype => {
          if (dtype !== 'total') {
            const damageType = dtype as DamageType;
            const currentDamage = damage.byType[damageType] ?? 0;
            const baseDamage = baseDamageByType[stat.key][damageType];

            // Efficiency: contribution from this stat to this damage type
            point[`${dtype}_${stat.key}_efficiency`] = currentDamage - baseDamage;

            // Total damage of this type at this level
            point[`${dtype}_${stat.key}_totalAR`] = currentDamage;
          }
        });
      });

      points.push(point);
    }

    return {
      dataPoints: points,
      dataPointsByLevel: new Map(points.map(p => [p.level, p])),
      availableDamageTypes,
    };
  }, [
    precomputed,
    aowData,
    weaponName,
    affinity,
    upgradeLevel,
    categoryName,
    currentStats,
    twoHanding,
    ignoreRequirements,
    scalingStats,
    aowName,
    selectedAttackId,
  ]);
}
