/**
 * Optimal Investment Path Chart
 *
 * Visualizes how to optimally distribute stat points for a weapon,
 * showing the best AR achievable at each budget level (0 to max investable points).
 */

import { useState, useMemo } from 'react';
import {
  LineChart,
  AreaChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Check } from 'lucide-react';
import { STAT_COLORS } from '../constants';
import type { CharacterStats, PrecomputedDataV2, WeaponListItem } from '../types';
import { calculateWeaponAR } from '../utils/damageCalculator';
import { selectBestAllocation } from '../utils/solver';
import type { SolverOptimizationMode } from '../types/solverTypes';
import { STAT_KEY_TO_FULL_NAME } from '../constants';

// ============================================================================
// Constants
// ============================================================================

const CHART_COLORS = {
  grid: '#2a2a2a',
  axis: '#6a6a6a',
  axisLabel: '#8b8b8b',
  currentStatMarker: '#d4af37',
  totalLine: '#4ade80',
  baseDamage: '#8b8b8b',
} as const;

const STAT_LABELS: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  int: 'Intelligence',
  fai: 'Faith',
  arc: 'Arcane',
};

const DAMAGE_LABELS: Record<string, string> = {
  physical: 'Physical',
  magic: 'Magic',
  fire: 'Fire',
  lightning: 'Lightning',
  holy: 'Holy',
};

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'perPoint' | 'breakdown' | 'statLevels';

interface InvestmentDataPoint {
  pointsInvested: number;
  value: number;
  /** Raw unrounded value for accurate per-point calculations */
  rawValue: number;
  stats: CharacterStats;
  statContributions: Record<string, number>;
  baseDamage: number;
  // Per-stat point allocation (cumulative from base)
  statAllocation: Record<string, number>;
}

export interface OptimalInvestmentChartProps {
  precomputed: PrecomputedDataV2;
  weapon: WeaponListItem;
  currentStats: CharacterStats;
  twoHanding?: boolean;
  /** Base stats for the starting class (determines minimum stats) */
  baseStats?: CharacterStats;
  /** External optimization mode from parent (syncs with local state) */
  optimizationMode?: SolverOptimizationMode;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get scaling stats for a weapon (stats that have non-zero scaling)
 */
function getScalingStats(weapon: WeaponListItem): string[] {
  const scalingStats: string[] = [];
  const damageStats = ['str', 'dex', 'int', 'fai', 'arc'] as const;

  for (const stat of damageStats) {
    if (weapon.rawScaling[stat] > 0) {
      scalingStats.push(stat);
    }
  }

  return scalingStats;
}

/**
 * Get stats that contribute to spell scaling for a weapon.
 */
function getSpellScalingStats(
  precomputed: PrecomputedDataV2,
  weapon: WeaponListItem
): string[] {
  const weaponData = precomputed.weapons[weapon.name];
  const affinityData = weaponData?.affinities[weapon.affinity];
  if (!affinityData) return [];

  const spellScaling = affinityData.sorceryScaling ?? affinityData.incantationScaling;
  if (!spellScaling) return [];

  const statMap: Record<string, 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane'> = {
    str: 'strength', dex: 'dexterity', int: 'intelligence', fai: 'faith', arc: 'arcane',
  };

  const result: string[] = [];
  for (const [short, long] of Object.entries(statMap)) {
    if (spellScaling[long] !== null) {
      result.push(short);
    }
  }
  return result;
}

/**
 * Calculate current investment from base stats
 */
function calculateCurrentInvestment(
  currentStats: CharacterStats,
  baseStats: CharacterStats,
  scalingStats: string[]
): number {
  let total = 0;
  for (const stat of scalingStats) {
    const current = currentStats[stat as keyof CharacterStats];
    const base = baseStats[stat as keyof CharacterStats];
    total += Math.max(0, current - base);
  }
  return total;
}

/**
 * Calculate stat contributions from AR or SP breakdown
 *
 * In AR mode: returns contributions from weapon damage scaling
 * In SP mode: returns contributions from spell scaling (sorcery or incantation)
 */
function getStatContributions(
  precomputed: PrecomputedDataV2,
  weapon: WeaponListItem,
  stats: CharacterStats,
  twoHanding: boolean,
  optimizationMode: SolverOptimizationMode = 'AR'
): { contributions: Record<string, number>; baseDamage: number } {
  const arResult = calculateWeaponAR(
    precomputed,
    weapon.name,
    weapon.affinity,
    weapon.upgradeLevel,
    stats,
    { twoHanding, ignoreRequirements: true }
  );

  if (!arResult) {
    return { contributions: {}, baseDamage: 0 };
  }

  // For SP mode, use spell scaling instead of AR
  if (optimizationMode === 'SP') {
    const sorceryScaling = arResult.sorceryScaling;
    const incantScaling = arResult.incantationScaling;

    // Pick the higher spell scaling (matches createSPObjective behavior)
    const sorceryTotal = sorceryScaling?.total ?? 0;
    const incantTotal = incantScaling?.total ?? 0;
    const spellScaling = sorceryTotal >= incantTotal ? sorceryScaling : incantScaling;

    if (!spellScaling) {
      return { contributions: {}, baseDamage: 100 }; // Base spell scaling is always 100
    }

    // Base spell scaling is always 100
    const baseDamage = spellScaling.base;

    // Extract per-stat contributions from spell scaling
    const contributions: Record<string, number> = {};
    for (const shortStat of ['str', 'dex', 'int', 'fai', 'arc']) {
      const fullName = STAT_KEY_TO_FULL_NAME[shortStat] as keyof typeof spellScaling.perStat;
      contributions[shortStat] = spellScaling.perStat[fullName]?.scaling ?? 0;
    }

    return { contributions, baseDamage };
  }

  // AR mode: Sum base damage across all damage types
  const baseDamage =
    arResult.physical.base +
    arResult.magic.base +
    arResult.fire.base +
    arResult.lightning.base +
    arResult.holy.base;

  // Calculate contribution from each stat (scaling portion)
  const contributions: Record<string, number> = {};
  const statMap: Record<string, 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane'> = {
    str: 'strength',
    dex: 'dexterity',
    int: 'intelligence',
    fai: 'faith',
    arc: 'arcane',
  };

  for (const [shortStat, longStat] of Object.entries(statMap)) {
    let totalContribution = 0;

    // Sum scaling contribution from each damage type
    for (const damageType of ['physical', 'magic', 'fire', 'lightning', 'holy'] as const) {
      const damage = arResult[damageType];
      if (damage.perStat[longStat]) {
        totalContribution += damage.perStat[longStat].scaling;
      }
    }

    contributions[shortStat] = totalContribution;
  }

  return { contributions, baseDamage };
}

// ============================================================================
// Investment Path Algorithm (Greedy with Lookahead)
// ============================================================================

/**
 * Compute optimal investment path using a greedy algorithm with fresh calculations.
 *
 * This matches the solver's `runGreedyWithLookahead` behavior:
 * - Fresh calculation at each step to handle two-handing STR rounding
 * - 2-point lookahead when two-handing to capture floor(STR * 1.5) jumps
 *
 * Supports both AR (Attack Rating) and SP (Spell Power) optimization modes.
 *
 * Complexity: O(budget × numStats × calc) - still efficient at ~4000 calculations
 */
function computeInvestmentPathGreedy(
  precomputed: PrecomputedDataV2,
  weapon: WeaponListItem,
  baseStats: CharacterStats,
  scalingStats: string[],
  twoHanding: boolean,
  ignoreRequirements: boolean,
  optimizationMode: SolverOptimizationMode = 'AR'
): InvestmentDataPoint[] {
  const dataPoints: InvestmentDataPoint[] = [];

  // In SP mode, filter to only stats that contribute to spell scaling.
  // This prevents allocating budget to stats like DEX that have AR scaling but no spell scaling.
  let effectiveScalingStats = scalingStats;
  if (optimizationMode === 'SP') {
    const spellStats = getSpellScalingStats(precomputed, weapon);
    if (spellStats.length > 0) {
      effectiveScalingStats = scalingStats.filter(stat => spellStats.includes(stat));
      if (effectiveScalingStats.length === 0) effectiveScalingStats = scalingStats;
    }
  }

  // Calculate max budget
  const maxPointsPerStat = 99;
  const maxBudget = effectiveScalingStats.reduce((sum, stat) => {
    const base = baseStats[stat as keyof CharacterStats];
    return sum + (maxPointsPerStat - base);
  }, 0);
  const effectiveMaxBudget = Math.min(maxBudget, 400);

  // Get minimum stat levels - respect weapon requirements for contributing stats
  const minLevels: Record<string, number> = {};
  for (const stat of effectiveScalingStats) {
    const base = baseStats[stat as keyof CharacterStats];
    const req = weapon.requirements[stat as keyof typeof weapon.requirements] ?? 0;
    minLevels[stat] = Math.max(base, req);
  }

  // Initialize current levels at base stats
  const currentLevels: Record<string, number> = {};
  for (const stat of effectiveScalingStats) {
    currentLevels[stat] = baseStats[stat as keyof CharacterStats];
  }

  // Helper to calculate the objective value (AR or SP) for current levels
  const getObjectiveValue = (levels: Record<string, number>): number => {
    const stats: CharacterStats = { ...baseStats };
    for (const stat of effectiveScalingStats) {
      stats[stat as keyof CharacterStats] = levels[stat];
    }
    const result = calculateWeaponAR(
      precomputed,
      weapon.name,
      weapon.affinity,
      weapon.upgradeLevel,
      stats,
      { twoHanding, ignoreRequirements }
    );

    if (optimizationMode === 'SP') {
      // For SP mode, return spell power (max of sorcery or incantation scaling)
      // This matches the behavior in solverObjectives.ts createSPObjective
      if (!result) return 0;
      const sorceryVal = result.sorceryScaling?.total ?? 0;
      const incantVal = result.incantationScaling?.total ?? 0;
      return Math.max(sorceryVal, incantVal);
    }
    // For AR mode, return total attack rating
    return result?.total ?? 0;
  };

  // Helper to get stat contributions from AR or SP result
  const getStatContributionsFromResult = (stats: CharacterStats): { contributions: Record<string, number>; baseDamage: number } => {
    return getStatContributions(precomputed, weapon, stats, twoHanding, optimizationMode);
  };

  // Get base AR (at base stats)
  let currentObjValue = getObjectiveValue(currentLevels);

  // Get base damage (constant throughout)
  const { baseDamage } = getStatContributionsFromResult(baseStats);

  // Add starting point (budget = 0)
  const initialContributions: Record<string, number> = {};
  for (const stat of effectiveScalingStats) {
    initialContributions[stat] = 0;
  }
  dataPoints.push({
    pointsInvested: 0,
    value: Math.floor(currentObjValue),
    rawValue: currentObjValue,
    stats: { ...baseStats },
    statContributions: initialContributions,
    baseDamage,
    statAllocation: Object.fromEntries(effectiveScalingStats.map(s => [s, 0])),
  });

  // Lookahead config - use 2-point lookahead when two-handing for STR rounding
  const maxLookahead = twoHanding ? 2 : 1;

  let budget = 0;

  // Phase 1: Invest to meet minimum requirements for contributing stats
  {
    const needsInvestment = effectiveScalingStats.some(stat => currentLevels[stat] < minLevels[stat]);

    while (needsInvestment && budget < effectiveMaxBudget) {
      const statsNeedingReqs = effectiveScalingStats.filter(stat => currentLevels[stat] < minLevels[stat]);

      if (statsNeedingReqs.length === 0) break;

      // Among stats needing requirements, pick the one that gives best AR gain
      let bestStat: string | null = null;
      let bestGain = -Infinity; // Allow negative gains since we MUST invest in requirements

      for (const stat of statsNeedingReqs) {
        const testLevels = { ...currentLevels, [stat]: currentLevels[stat] + 1 };
        const gain = getObjectiveValue(testLevels) - currentObjValue;
        if (gain > bestGain) {
          bestGain = gain;
          bestStat = stat;
        }
      }

      if (!bestStat) break;

      // Invest 1 point in the best requirement stat
      currentLevels[bestStat] += 1;
      currentObjValue = getObjectiveValue(currentLevels);
      budget++;

      // Build full stats object
      const fullStats: CharacterStats = { ...baseStats };
      for (const stat of effectiveScalingStats) {
        fullStats[stat as keyof CharacterStats] = currentLevels[stat];
      }

      // Calculate stat allocation (points from base)
      const statAllocation: Record<string, number> = {};
      for (const stat of effectiveScalingStats) {
        statAllocation[stat] = currentLevels[stat] - baseStats[stat as keyof CharacterStats];
      }

      // Get stat contributions
      const { contributions } = getStatContributionsFromResult(fullStats);

      dataPoints.push({
        pointsInvested: budget,
        value: Math.floor(currentObjValue),
        rawValue: currentObjValue,
        stats: fullStats,
        statContributions: contributions,
        baseDamage,
        statAllocation,
      });
    }
  }

  // Phase 2: Greedy optimization for remaining budget using shared selection logic
  while (budget < effectiveMaxBudget) {
    const step = selectBestAllocation({
      stats: effectiveScalingStats,
      currentLevels,
      currentValue: currentObjValue,
      getObjective: getObjectiveValue,
      maxLookahead,
      remainingBudget: effectiveMaxBudget - budget,
    });

    // Early termination if no progress
    if (!step) {
      break;
    }

    // Apply points incrementally (one at a time) to record progressive values
    for (let p = 1; p <= step.points; p++) {
      currentLevels[step.stat] += 1;
      currentObjValue = getObjectiveValue(currentLevels);
      budget++;

      // Build full stats object
      const fullStats: CharacterStats = { ...baseStats };
      for (const stat of effectiveScalingStats) {
        fullStats[stat as keyof CharacterStats] = currentLevels[stat];
      }

      // Calculate stat allocation (points from base)
      const statAllocation: Record<string, number> = {};
      for (const stat of effectiveScalingStats) {
        statAllocation[stat] = currentLevels[stat] - baseStats[stat as keyof CharacterStats];
      }

      // Get stat contributions from fresh AR calculation
      const { contributions } = getStatContributionsFromResult(fullStats);

      dataPoints.push({
        pointsInvested: budget,
        value: Math.floor(currentObjValue),
        rawValue: currentObjValue,
        stats: fullStats,
        statContributions: contributions,
        baseDamage,
        statAllocation,
      });
    }
  }

  return dataPoints;
}

// ============================================================================
// Custom Tooltip Component
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: InvestmentDataPoint;
  }>;
  label?: number;
  viewMode: ViewMode;
  scalingStats: string[];
  optimizationMode: SolverOptimizationMode;
}

function CustomTooltip({ active, payload, label, viewMode, scalingStats, optimizationMode }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const dataPoint = payload[0].payload;
  const valueLabel = optimizationMode === 'SP' ? 'SP' : 'AR';

  return (
    <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg p-3 text-sm">
      <div className="text-[#d4af37] font-medium mb-2">
        {label} Points Invested
      </div>

      {viewMode === 'perPoint' && payload[0] && (
        <div className="text-[#4ade80] text-lg font-semibold">
          +{payload[0].value.toFixed(2)} {valueLabel}/pt
        </div>
      )}

      {viewMode === 'statLevels' ? (
        <div className="mt-2">
          <div className="text-[#8b8b8b] text-xs uppercase mb-1">Stat Levels</div>
          {scalingStats.map(stat => {
            const level = dataPoint.stats[stat as keyof CharacterStats];
            const invested = dataPoint.statAllocation[stat] ?? 0;
            return (
              <div key={stat} className="flex justify-between gap-4">
                <span style={{ color: STAT_COLORS[stat as keyof typeof STAT_COLORS] }}>
                  {STAT_LABELS[stat]}:
                </span>
                <span className="text-[#c8c8c8]">
                  {level} <span className="text-[#6a6a6a]">(+{invested})</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 pt-2 border-t border-[#2a2a2a]">
          <div className="text-[#8b8b8b] text-xs uppercase mb-1">Stat Levels</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {scalingStats.map(stat => (
              <div key={stat} className="flex justify-between gap-2">
                <span style={{ color: STAT_COLORS[stat as keyof typeof STAT_COLORS] }}>
                  {STAT_LABELS[stat]}:
                </span>
                <span className="text-[#c8c8c8]">
                  {dataPoint.stats[stat as keyof CharacterStats]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'breakdown' && (
        <div className="mt-2 pt-2 border-t border-[#2a2a2a]">
          <div className="text-[#8b8b8b] text-xs uppercase mb-1">{valueLabel} Breakdown</div>
          <div className="flex justify-between gap-2">
            <span className="text-[#8b8b8b]">Base:</span>
            <span className="text-[#c8c8c8]">{Math.round(dataPoint.baseDamage)}</span>
          </div>
          {scalingStats.map(stat => {
            const contrib = dataPoint.statContributions[stat] ?? 0;
            if (contrib > 0) {
              return (
                <div key={stat} className="flex justify-between gap-2">
                  <span style={{ color: STAT_COLORS[stat as keyof typeof STAT_COLORS] }}>
                    {STAT_LABELS[stat]}:
                  </span>
                  <span className="text-[#c8c8c8]">+{Math.round(contrib)}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function OptimalInvestmentChart({
  precomputed,
  weapon,
  currentStats,
  twoHanding = false,
  baseStats: providedBaseStats,
  optimizationMode: externalOptimizationMode,
}: OptimalInvestmentChartProps) {
  // Use provided base stats or fall back to current stats
  const baseStats = providedBaseStats ?? currentStats;

  // Get scaling stats for this weapon
  const scalingStats = useMemo(() => getScalingStats(weapon), [weapon]);

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('breakdown');
  const [ignoreRequirements, setIgnoreRequirements] = useState(true);

  // Use external optimization mode from parent (defaults to AR)
  const optimizationMode = externalOptimizationMode ?? 'AR';

  // Compute investment path data
  // Uses greedy algorithm for both AR and SP modes (fast and efficient)
  const investmentData = useMemo(() => {
    if (scalingStats.length === 0) {
      return [];
    }

    // Use the fast greedy algorithm for both AR and SP modes
    return computeInvestmentPathGreedy(
      precomputed,
      weapon,
      baseStats,
      scalingStats,
      twoHanding,
      ignoreRequirements,
      optimizationMode
    );
  }, [precomputed, weapon, baseStats, scalingStats, twoHanding, optimizationMode, ignoreRequirements]);

  // Calculate per-point gains for perPoint view
  const perPointData = useMemo(() => {
    if (viewMode !== 'perPoint' || investmentData.length < 2) {
      return investmentData;
    }

    return investmentData.map((point, index) => {
      if (index === 0) {
        return { ...point, perPointGain: 0 };
      }
      const prevPoint = investmentData[index - 1];
      const pointDiff = point.pointsInvested - prevPoint.pointsInvested;
      // Use rawValue for accurate per-point gain calculations (not rounded)
      const valueDiff = point.rawValue - prevPoint.rawValue;
      const perPointGain = pointDiff > 0 ? valueDiff / pointDiff : 0;
      return { ...point, perPointGain };
    });
  }, [investmentData, viewMode]);

  // Filter to only stats that actually received investment or have contributions
  // This prevents showing irrelevant stats in the legend (e.g., str/dex in SP mode for a catalyst)
  const activeChartStats = useMemo(() => {
    if (investmentData.length === 0) return scalingStats;
    return scalingStats.filter(stat => {
      // Check if this stat ever received any investment in the computed path
      return investmentData.some(point => (point.statAllocation[stat] ?? 0) > 0);
    });
  }, [investmentData, scalingStats]);

  // Calculate current investment level
  const currentInvestment = useMemo(() => {
    return calculateCurrentInvestment(currentStats, baseStats, scalingStats);
  }, [currentStats, baseStats, scalingStats]);

  // Tooltip styling
  const tooltipStyle = useMemo(() => ({
    contentStyle: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #3a3a3a',
      borderRadius: '4px',
      fontSize: '12px',
    },
    labelStyle: { color: '#d4af37' },
  }), []);

  // Empty state
  if (scalingStats.length === 0) {
    return (
      <div>
        <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-4">
          Optimal Investment Path
        </h3>
        <p className="text-[#6a6a6a] text-sm">No scaling attributes</p>
      </div>
    );
  }

  const maxBudget = investmentData.length > 0
    ? investmentData[investmentData.length - 1].pointsInvested
    : 0;

  const yAxisLabel = viewMode === 'perPoint'
    ? (optimizationMode === 'SP' ? 'SP Gain/pt' : 'AR Gain/pt')
    : viewMode === 'statLevels'
      ? 'Stat Level'
      : (optimizationMode === 'SP' ? 'Spell Power' : 'Attack Rating');

  return (
    <div>
      {/* Header */}
      <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-3">
        Optimal Investment Path
      </h3>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* View mode toggle */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5"
        >
          <ToggleGroupItem value="perPoint" size="xs">
            Per Point
          </ToggleGroupItem>
          <ToggleGroupItem value="breakdown" size="xs">
            Breakdown
          </ToggleGroupItem>
          <ToggleGroupItem value="statLevels" size="xs">
            Stat Levels
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Ignore Requirements checkbox */}
        <label className="flex items-center gap-2 cursor-pointer group">
          <div
            className="w-4 h-4 border rounded flex items-center justify-center transition-colors"
            style={{
              backgroundColor: 'transparent',
              borderColor: ignoreRequirements ? '#d4af37' : 'rgba(212,175,55,0.5)',
            }}
          >
            {ignoreRequirements && <Check className="w-3 h-3 text-[#d4af37]" />}
          </div>
          <input
            type="checkbox"
            checked={ignoreRequirements}
            onChange={(e) => setIgnoreRequirements(e.target.checked)}
            className="hidden"
          />
          <span className="text-[#6a6a6a] text-xs group-hover:text-[#8b8b8b] transition-colors">
            Ignore Reqs
          </span>
        </label>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        {viewMode === 'perPoint' ? (
          <LineChart data={perPointData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="pointsInvested"
              type="number"
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
              content={<CustomTooltip viewMode={viewMode} scalingStats={activeChartStats} optimizationMode={optimizationMode} />}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} iconType="square" />
            <Line
              type="monotone"
              dataKey="perPointGain"
              name={optimizationMode === 'SP' ? 'SP/point' : 'AR/point'}
              stroke={CHART_COLORS.totalLine}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            {currentInvestment > 0 && currentInvestment <= maxBudget && (
              <ReferenceLine
                x={currentInvestment}
                stroke={CHART_COLORS.currentStatMarker}
                strokeDasharray="5 5"
                label={{
                  value: 'Current',
                  position: 'top',
                  fill: CHART_COLORS.currentStatMarker,
                  fontSize: 10,
                }}
              />
            )}
          </LineChart>
        ) : viewMode === 'breakdown' ? (
          <AreaChart data={investmentData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="pointsInvested"
              type="number"
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
              content={<CustomTooltip viewMode={viewMode} scalingStats={activeChartStats} optimizationMode={optimizationMode} />}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} iconType="square" />
            <Area
              type="monotone"
              dataKey="baseDamage"
              name="Base"
              stackId="1"
              stroke={CHART_COLORS.baseDamage}
              fill={CHART_COLORS.baseDamage}
              fillOpacity={0.6}
            />
            {activeChartStats.map(stat => (
              <Area
                key={stat}
                type="monotone"
                dataKey={`statContributions.${stat}`}
                name={STAT_LABELS[stat]}
                stackId="1"
                stroke={STAT_COLORS[stat as keyof typeof STAT_COLORS]}
                fill={STAT_COLORS[stat as keyof typeof STAT_COLORS]}
                fillOpacity={0.6}
              />
            ))}
            {currentInvestment > 0 && currentInvestment <= maxBudget && (
              <ReferenceLine
                x={currentInvestment}
                stroke={CHART_COLORS.currentStatMarker}
                strokeDasharray="5 5"
                label={{
                  value: 'Current',
                  position: 'top',
                  fill: CHART_COLORS.currentStatMarker,
                  fontSize: 10,
                }}
              />
            )}
          </AreaChart>
        ) : (
          /* Stat Levels view - multi-line chart showing each stat's level over budget */
          <LineChart data={investmentData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="pointsInvested"
              type="number"
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
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
              domain={[0, 99]}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                fill: CHART_COLORS.axisLabel,
                fontSize: 11,
              }}
            />
            <Tooltip
              content={<CustomTooltip viewMode={viewMode} scalingStats={activeChartStats} optimizationMode={optimizationMode} />}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} iconType="square" />
            {activeChartStats.map(stat => (
              <Line
                key={stat}
                type="stepAfter"
                dataKey={`stats.${stat}`}
                name={STAT_LABELS[stat]}
                stroke={STAT_COLORS[stat as keyof typeof STAT_COLORS]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
            {currentInvestment > 0 && currentInvestment <= maxBudget && (
              <ReferenceLine
                x={currentInvestment}
                stroke={CHART_COLORS.currentStatMarker}
                strokeDasharray="5 5"
                label={{
                  value: 'Current',
                  position: 'top',
                  fill: CHART_COLORS.currentStatMarker,
                  fontSize: 10,
                }}
              />
            )}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
