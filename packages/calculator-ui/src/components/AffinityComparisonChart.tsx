/**
 * Affinity Comparison Chart
 *
 * Shows a multi-line chart comparing total AR (or effective damage against a
 * selected enemy) across all available affinities for a weapon, using the
 * optimal greedy investment path for each affinity.
 */

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Skull } from 'lucide-react';
import type { CharacterStats, PrecomputedDataV2, WeaponListItem } from '../types';
import { AFFINITY_ORDER } from '../types';
import type { EnemyData } from '../data';
import { calculateSimpleEnemyDamage } from '../data';
import { calculateWeaponAR } from '../utils/damageCalculator';
import { selectBestAllocation } from '../utils/solver';
import { computeYAxisWidth } from '../utils/axisWidth';

// ============================================================================
// Constants
// ============================================================================

const AFFINITY_COLORS: Record<string, string> = {
  Standard: '#9a9a9a',
  Heavy: '#c47d20',
  Keen: '#ef4444',
  Quality: '#22c55e',
  Magic: '#3b82f6',
  Cold: '#67e8f9',
  Fire: '#f97316',
  'Flame Art': '#e85d75',
  Lightning: '#eab308',
  Sacred: '#fbbf24',
  Poison: '#84cc16',
  Blood: '#be123c',
  Occult: '#a855f7',
};

const CHART_COLORS = {
  grid: '#2a2a2a',
  axis: '#6a6a6a',
  axisLabel: '#8b8b8b',
  currentBudgetMarker: '#d4af37',
} as const;

const STAT_MAP: Record<string, 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane'> = {
  str: 'strength',
  dex: 'dexterity',
  int: 'intelligence',
  fai: 'faith',
  arc: 'arcane',
};

// ============================================================================
// Types
// ============================================================================

export interface AffinityComparisonChartProps {
  precomputed: PrecomputedDataV2;
  weapon: WeaponListItem;
  currentStats: CharacterStats;
  baseStats: CharacterStats;
  twoHanding?: boolean;
  selectedEnemy?: EnemyData | null;
}

type ChartDataPoint = {
  pointsInvested: number;
  [affinity: string]: number;
};

interface PerTypeAR {
  physical: number;
  magic: number;
  fire: number;
  lightning: number;
  holy: number;
}

interface AffinityPathResult {
  /** Total AR at each budget point (floored) */
  ar: number[];
  /** Per-damage-type AR at each budget point (unrounded, for enemy damage calc) */
  perTypeAR: PerTypeAR[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get scaling stats for a specific affinity by checking which stats
 * have non-null scaling in any damage type.
 */
function getAffinityScalingStats(
  precomputed: PrecomputedDataV2,
  weaponName: string,
  affinity: string,
): string[] {
  const weaponData = precomputed.weapons[weaponName];
  const affinityData = weaponData?.affinities[affinity];
  if (!affinityData) return [];

  const scalingStats: string[] = [];
  const damageTypes = ['physical', 'magic', 'fire', 'lightning', 'holy'] as const;

  for (const [shortStat, longStat] of Object.entries(STAT_MAP)) {
    let hasScaling = false;
    for (const dt of damageTypes) {
      const dmg = affinityData[dt];
      if (dmg && dmg.scaling[longStat] !== null) {
        hasScaling = true;
        break;
      }
    }
    if (hasScaling) {
      scalingStats.push(shortStat);
    }
  }

  return scalingStats;
}

const EMPTY_PER_TYPE: PerTypeAR = { physical: 0, magic: 0, fire: 0, lightning: 0, holy: 0 };

/**
 * Compute the optimal investment path for a given affinity.
 * Returns total AR and per-type AR at each budget point.
 */
function computeAffinityPath(
  precomputed: PrecomputedDataV2,
  weaponName: string,
  affinity: string,
  upgradeLevel: number,
  baseStats: CharacterStats,
  twoHanding: boolean,
): AffinityPathResult {
  const scalingStats = getAffinityScalingStats(precomputed, weaponName, affinity);
  if (scalingStats.length === 0) return { ar: [], perTypeAR: [] };

  const weaponData = precomputed.weapons[weaponName];
  if (!weaponData) return { ar: [], perTypeAR: [] };

  const requirements: Record<string, number> = {
    str: weaponData.requirements.strength,
    dex: weaponData.requirements.dexterity,
    int: weaponData.requirements.intelligence,
    fai: weaponData.requirements.faith,
    arc: weaponData.requirements.arcane,
  };

  const maxBudget = Math.min(
    400,
    scalingStats.reduce((sum, stat) => {
      return sum + (99 - baseStats[stat as keyof CharacterStats]);
    }, 0)
  );

  const minLevels: Record<string, number> = {};
  for (const stat of scalingStats) {
    const base = baseStats[stat as keyof CharacterStats];
    const req = requirements[stat] ?? 0;
    minLevels[stat] = Math.max(base, req);
  }

  const currentLevels: Record<string, number> = {};
  for (const stat of scalingStats) {
    currentLevels[stat] = baseStats[stat as keyof CharacterStats];
  }

  // Build stats object from current levels
  const buildStats = (levels: Record<string, number>): CharacterStats => {
    const stats: CharacterStats = { ...baseStats };
    for (const stat of scalingStats) {
      stats[stat as keyof CharacterStats] = levels[stat];
    }
    return stats;
  };

  // Lightweight probe: returns only total AR (used by greedy selection)
  const getObjectiveValue = (levels: Record<string, number>): number => {
    const result = calculateWeaponAR(
      precomputed, weaponName, affinity, upgradeLevel, buildStats(levels),
      { twoHanding, ignoreRequirements: true }
    );
    return result?.total ?? 0;
  };

  // Full calculation: returns total + per-type AR (used for recording path points)
  const recordPoint = (levels: Record<string, number>): { total: number; perType: PerTypeAR } => {
    const result = calculateWeaponAR(
      precomputed, weaponName, affinity, upgradeLevel, buildStats(levels),
      { twoHanding, ignoreRequirements: true }
    );
    if (!result) return { total: 0, perType: EMPTY_PER_TYPE };
    return {
      total: result.total,
      perType: {
        physical: result.physical.total,
        magic: result.magic.total,
        fire: result.fire.total,
        lightning: result.lightning.total,
        holy: result.holy.total,
      },
    };
  };

  // Record starting point
  const initial = recordPoint(currentLevels);
  let currentValue = initial.total;
  const arValues: number[] = [Math.floor(currentValue)];
  const perTypeValues: PerTypeAR[] = [initial.perType];

  const maxLookahead = twoHanding ? 2 : 1;
  let budget = 0;

  // Phase 1: Invest to meet weapon requirements for scaling stats
  while (budget < maxBudget) {
    const statsNeedingReqs = scalingStats.filter(
      stat => currentLevels[stat] < minLevels[stat]
    );
    if (statsNeedingReqs.length === 0) break;

    let bestStat: string | null = null;
    let bestGain = -Infinity;
    for (const stat of statsNeedingReqs) {
      const testLevels = { ...currentLevels, [stat]: currentLevels[stat] + 1 };
      const gain = getObjectiveValue(testLevels) - currentValue;
      if (gain > bestGain) {
        bestGain = gain;
        bestStat = stat;
      }
    }
    if (!bestStat) break;

    currentLevels[bestStat] += 1;
    const point = recordPoint(currentLevels);
    currentValue = point.total;
    budget++;
    arValues.push(Math.floor(currentValue));
    perTypeValues.push(point.perType);
  }

  // Phase 2: Greedy optimization with lookahead
  while (budget < maxBudget) {
    const step = selectBestAllocation({
      stats: scalingStats,
      currentLevels,
      currentValue,
      getObjective: getObjectiveValue,
      maxLookahead,
      remainingBudget: maxBudget - budget,
    });

    if (!step) break;

    for (let p = 1; p <= step.points; p++) {
      currentLevels[step.stat] += 1;
      const point = recordPoint(currentLevels);
      currentValue = point.total;
      budget++;
      arValues.push(Math.floor(currentValue));
      perTypeValues.push(point.perType);
    }
  }

  return { ar: arValues, perTypeAR: perTypeValues };
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface ComparisonTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: number;
  currentAffinity: string;
  valueLabel: string;
}

function ComparisonTooltip({ active, payload, label, currentAffinity, valueLabel }: ComparisonTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const sorted = [...payload]
    .filter(entry => entry.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg p-3 text-sm max-h-[300px] overflow-y-auto">
      <div className="text-[#d4af37] font-medium mb-1">
        {label} Points Invested
      </div>
      <div className="text-[#6a6a6a] text-xs mb-2">{valueLabel}</div>
      {sorted.map(entry => {
        const isCurrent = entry.name === currentAffinity;
        return (
          <div
            key={entry.name}
            className="flex justify-between gap-4"
          >
            <span style={{
              color: entry.color,
              fontWeight: isCurrent ? 600 : 400,
            }}>
              {entry.name}{isCurrent ? ' \u25CF' : ''}
            </span>
            <span className="text-[#c8c8c8] font-mono">
              {Math.round(entry.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AffinityComparisonChart({
  precomputed,
  weapon,
  currentStats,
  baseStats,
  twoHanding = false,
  selectedEnemy,
}: AffinityComparisonChartProps) {
  // Get available affinities for this weapon, ordered consistently
  const availableAffinities = useMemo(() => {
    const weaponData = precomputed.weapons[weapon.name];
    if (!weaponData) return [];
    const available = new Set(Object.keys(weaponData.affinities));
    return AFFINITY_ORDER.filter(aff => available.has(aff));
  }, [precomputed, weapon.name]);

  // Derive attack attribute from weapon (same across all affinities)
  const attackAttribute = weapon.damageType !== '-' ? weapon.damageType : 'Standard';

  // Step 1: Compute investment paths for all affinities (independent of enemy)
  const affinityPaths = useMemo(() => {
    const paths: Record<string, AffinityPathResult> = {};
    for (const aff of availableAffinities) {
      paths[aff] = computeAffinityPath(
        precomputed, weapon.name, aff, weapon.upgradeLevel, baseStats, twoHanding
      );
    }
    return paths;
  }, [precomputed, weapon.name, weapon.upgradeLevel, baseStats, twoHanding, availableAffinities]);

  // Step 2: Build chart data (reacts to enemy selection without recomputing paths)
  const { chartData, maxBudget } = useMemo(() => {
    const hasEnemy = !!selectedEnemy;
    let maxPoints = 0;

    for (const aff of availableAffinities) {
      const path = affinityPaths[aff];
      maxPoints = Math.max(maxPoints, path.ar.length - 1);
    }

    const data: ChartDataPoint[] = [];
    for (let i = 0; i <= maxPoints; i++) {
      const point: ChartDataPoint = { pointsInvested: i };
      for (const aff of availableAffinities) {
        const path = affinityPaths[aff];
        if (hasEnemy) {
          const perType = i < path.perTypeAR.length
            ? path.perTypeAR[i]
            : path.perTypeAR[path.perTypeAR.length - 1];
          point[aff] = perType
            ? calculateSimpleEnemyDamage(perType, attackAttribute, selectedEnemy!.defenses)
            : 0;
        } else {
          point[aff] = i < path.ar.length
            ? path.ar[i]
            : (path.ar.length > 0 ? path.ar[path.ar.length - 1] : 0);
        }
      }
      data.push(point);
    }

    return { chartData: data, maxBudget: maxPoints };
  }, [affinityPaths, availableAffinities, selectedEnemy, attackAttribute]);

  // Calculate current investment for reference line
  const currentInvestment = useMemo(() => {
    const damageStats = ['str', 'dex', 'int', 'fai', 'arc'] as const;
    return damageStats.reduce((sum, stat) => {
      const current = currentStats[stat];
      const base = baseStats[stat];
      return sum + Math.max(0, current - base);
    }, 0);
  }, [currentStats, baseStats]);

  // Don't render if there's only one affinity (unique weapons) or no data
  if (availableAffinities.length <= 1 || chartData.length === 0) return null;

  const hasEnemy = !!selectedEnemy;
  const yAxisLabel = hasEnemy ? 'Effective Damage' : 'Total AR';

  const yAxisWidth = useMemo(() => {
    if (chartData.length === 0) return 60;
    return computeYAxisWidth(chartData, availableAffinities);
  }, [chartData, availableAffinities]);
  const tooltipLabel = hasEnemy ? `Damage vs ${selectedEnemy!.name}` : 'Total AR';

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs">
          Affinity Comparison
        </h3>
        {selectedEnemy && (
          <div className="flex items-center gap-2 text-[#e06666]">
            <Skull className="w-3 h-3" />
            <span className="text-xs font-medium">{selectedEnemy.name}</span>
          </div>
        )}
      </div>
      <p className="text-[#6a6a6a] text-xs mb-4">
        {hasEnemy
          ? 'Effective damage per affinity against selected enemy'
          : 'Optimal AR per affinity as stat points are invested'}
      </p>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="pointsInvested"
            type="number"
            interval={0}
            domain={[0, 'dataMax']}
            tickCount={10}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
            label={{
              value: 'Points Invested',
              position: 'insideBottom',
              offset: -5,
              fill: CHART_COLORS.axisLabel,
              fontSize: 11,
            }}
          />
          <YAxis
            width={yAxisWidth}
            interval={0}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              fill: CHART_COLORS.axisLabel,
              fontSize: 11,
            }}
          />
          <Tooltip
            content={<ComparisonTooltip currentAffinity={weapon.affinity} valueLabel={tooltipLabel} />}
          />
          {availableAffinities.map(aff => (
            <Line
              key={aff}
              type="monotone"
              dataKey={aff}
              name={aff}
              stroke={AFFINITY_COLORS[aff] ?? '#888'}
              strokeWidth={aff === weapon.affinity ? 3 : 1.5}
              strokeOpacity={aff === weapon.affinity ? 1 : 0.5}
              dot={false}
              activeDot={aff === weapon.affinity ? { r: 4 } : { r: 2 }}
            />
          ))}
          {currentInvestment > 0 && currentInvestment <= maxBudget && (
            <ReferenceLine
              x={currentInvestment}
              stroke={CHART_COLORS.currentBudgetMarker}
              strokeDasharray="5 5"
              label={{
                value: 'Current',
                position: 'top',
                fill: CHART_COLORS.currentBudgetMarker,
                fontSize: 10,
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
