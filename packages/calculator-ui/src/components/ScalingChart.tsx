import { useState, useMemo, useEffect } from 'react';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Checkbox } from './ui/checkbox.js';
import { DAMAGE_COLORS, DAMAGE_TYPE_LABELS } from '../constants';
import type { CharacterStats } from '../types';
import type { ScalingDataPoint, ScalingStat, ViewMode } from '../types/scaling';

// Re-export types for convenience
export type { ScalingDataPoint, ScalingStat, ViewMode } from '../types/scaling';

// ============================================================================
// Constants
// ============================================================================

const CHART_COLORS = {
  grid: '#2a2a2a',
  axis: '#6a6a6a',
  axisLabel: '#8b8b8b',
  requirementMarker: '#6a6a6a',
  currentStatMarker: '#d4af37',
  markerStroke: '#0a0a0a',
  baseDamage: '#8b8b8b',
} as const;

export interface ScalingChartProps {
  /** Data points for the chart */
  dataPoints: ScalingDataPoint[];
  /** Map for O(1) level lookups */
  dataPointsByLevel: Map<number, ScalingDataPoint>;
  /** Stats that have scaling */
  scalingStats: ScalingStat[];
  /** Available damage types for filtering */
  availableDamageTypes: string[];
  /** Current character stats (for markers) */
  currentStats: CharacterStats;
  /** Optimal stat levels from investment path (for markers along optimal path) */
  optimalStats?: CharacterStats;
  /** Stat requirements (for requirement markers) */
  requirements: Record<string, number>;
  /** Title for the chart section */
  title?: string;
  /** Whether to show the ignore requirements toggle */
  showIgnoreRequirements?: boolean;
  /** Controlled ignore requirements state */
  ignoreRequirements?: boolean;
  /** Callback when ignore requirements changes */
  onIgnoreRequirementsChange?: (value: boolean) => void;
  /** Y-axis label override for different modes */
  yAxisLabels?: {
    perPoint?: string;
    scaling?: string;
  };
}

interface ChartConfig {
  lines: Array<{
    key: string;
    dataKey: string;
    name: string;
    color: string;
  }>;
  xAxisLabel: string;
  requirementMarkers: Array<{
    statKey: string;
    requirement: number;
    dataKeyFn: (level: number) => string;
  }>;
  currentStatMarkers: Array<{
    statKey: string;
    level: number;
    dataKeyFn: (level: number) => string;
    color: string;
  }>;
}

// ============================================================================
// Types for unified selection
// ============================================================================

type CompareSelection =
  | { type: 'all-stats' }
  | { type: 'stat'; stat: string }
  | { type: 'damage'; damageType: string };

function parseSelection(value: string): CompareSelection {
  if (value === 'all-stats') return { type: 'all-stats' };
  if (value.startsWith('stat:')) return { type: 'stat', stat: value.slice(5) };
  if (value.startsWith('damage:')) return { type: 'damage', damageType: value.slice(7) };
  return { type: 'all-stats' };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDataKey(
  statKey: string,
  selection: CompareSelection,
  damageType?: string
): string {
  if (selection.type === 'all-stats') {
    return `${statKey}_cum`;
  }

  if (selection.type === 'stat') {
    // Showing damage breakdown for a single stat
    const dtype = damageType || 'total';
    return `${dtype}_${statKey}_efficiency`;
  }

  // Showing stat contributions to a damage type
  return `${selection.damageType}_${statKey}_efficiency`;
}

// ============================================================================
// Inner Chart Component
// ============================================================================

interface ScalingLineChartProps {
  dataPoints: ScalingDataPoint[];
  dataPointsByLevel: Map<number, ScalingDataPoint>;
  config: ChartConfig;
  yAxisLabel: string;
  tooltipStyle: {
    contentStyle: React.CSSProperties;
    labelStyle: React.CSSProperties;
    formatter: (value: number, name: string) => [string, string];
    labelFormatter: (label: number) => string;
  };
  viewMode: ViewMode;
  width?: number;
  height?: number;
}

function ScalingLineChart({
  dataPoints,
  dataPointsByLevel,
  config,
  yAxisLabel,
  tooltipStyle,
  width,
  height,
}: ScalingLineChartProps) {
  const requirementMarkerData = config.requirementMarkers
    .filter(({ requirement }) => requirement > 0)
    .map(({ statKey, requirement, dataKeyFn }) => {
      const dataPoint = dataPointsByLevel.get(requirement);
      if (!dataPoint) return null;
      const yVal = dataPoint[dataKeyFn(requirement)];
      if (yVal === undefined) return null;
      return { key: `req-${statKey}`, x: requirement, y: yVal };
    })
    .filter(Boolean) as Array<{ key: string; x: number; y: number }>;

  const currentStatMarkerData = config.currentStatMarkers
    .filter(({ level }) => level >= 1 && level <= 99)
    .map(({ statKey, level, dataKeyFn, color }) => {
      const dataPoint = dataPointsByLevel.get(level);
      if (!dataPoint) return null;
      const yVal = dataPoint[dataKeyFn(level)];
      if (yVal === undefined) return null;
      return { key: `dot-${statKey}`, x: level, y: yVal, color };
    })
    .filter(Boolean) as Array<{ key: string; x: number; y: number; color: string }>;

  return (
    <LineChart data={dataPoints} width={width} height={height} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
      {requirementMarkerData.map(({ key, x, y }) => (
        <ReferenceDot
          key={key}
          x={x}
          y={y}
          r={4}
          fill={CHART_COLORS.requirementMarker}
          stroke={CHART_COLORS.markerStroke}
          strokeWidth={1}
        />
      ))}
      <XAxis
        dataKey="level"
        stroke={CHART_COLORS.axis}
        tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
        label={{ value: config.xAxisLabel, position: 'insideBottom', offset: -5, fill: CHART_COLORS.axisLabel, fontSize: 11 }}
      />
      <YAxis
        stroke={CHART_COLORS.axis}
        tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
        label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: CHART_COLORS.axisLabel, fontSize: 11 }}
      />
      <Tooltip {...tooltipStyle} />
      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} iconType="square" />
      {config.lines.map(line => (
        <Line
          key={line.key}
          type="monotone"
          dataKey={line.dataKey}
          name={line.name}
          stroke={line.color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      ))}
      {currentStatMarkerData.map(({ key, x, y, color }) => (
        <ReferenceDot
          key={key}
          x={x}
          y={y}
          r={5}
          fill={color}
          stroke={CHART_COLORS.markerStroke}
          strokeWidth={2}
        />
      ))}
    </LineChart>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ScalingChart({
  dataPoints: rawDataPoints,
  dataPointsByLevel: rawDataPointsByLevel,
  scalingStats,
  availableDamageTypes,
  currentStats,
  optimalStats,
  requirements,
  title = 'Scaling Curves',
  showIgnoreRequirements = true,
  ignoreRequirements: controlledIgnoreRequirements,
  onIgnoreRequirementsChange,
  yAxisLabels = {},
}: ScalingChartProps) {
  // Internal state for uncontrolled mode
  const [internalIgnoreRequirements, setInternalIgnoreRequirements] = useState(true);
  const ignoreRequirements = controlledIgnoreRequirements ?? internalIgnoreRequirements;
  const setIgnoreRequirements = onIgnoreRequirementsChange ?? setInternalIgnoreRequirements;

  const [viewMode, setViewMode] = useState<ViewMode>('perPoint');
  const [selectionValue, setSelectionValue] = useState<string>('all-stats');

  const selection = parseSelection(selectionValue);

  // Reset to all-stats if selected damage type is no longer available
  useEffect(() => {
    if (selection.type === 'damage' && !availableDamageTypes.includes(selection.damageType)) {
      setSelectionValue('all-stats');
    }
  }, [availableDamageTypes, selection]);

  // Calculate per-point (marginal) gains if enabled
  const { dataPoints, dataPointsByLevel } = useMemo(() => {
    if (viewMode !== 'perPoint') {
      return { dataPoints: rawDataPoints, dataPointsByLevel: rawDataPointsByLevel };
    }

    const perPointData = rawDataPoints.map((point, index) => {
      if (index === 0) {
        const newPoint: ScalingDataPoint = { level: point.level };
        Object.keys(point).forEach(key => {
          if (key !== 'level') newPoint[key] = 0;
        });
        return newPoint;
      }

      const prevPoint = rawDataPoints[index - 1];
      const newPoint: ScalingDataPoint = { level: point.level };

      Object.keys(point).forEach(key => {
        if (key !== 'level') {
          newPoint[key] = (point[key] ?? 0) - (prevPoint[key] ?? 0);
        }
      });

      return newPoint;
    });

    return {
      dataPoints: perPointData,
      dataPointsByLevel: new Map(perPointData.map(p => [p.level, p])),
    };
  }, [rawDataPoints, rawDataPointsByLevel, viewMode]);

  const yAxisLabel = useMemo(() => {
    return viewMode === 'perPoint'
      ? (yAxisLabels.perPoint ?? 'Damage per Point')
      : (yAxisLabels.scaling ?? 'Scaling Bonus');
  }, [viewMode, yAxisLabels]);

  const tooltipStyle = useMemo(() => ({
    contentStyle: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #3a3a3a',
      borderRadius: '4px',
      fontSize: '12px'
    },
    labelStyle: { color: '#d4af37' },
    formatter: (value: number, name: string) => {
      return viewMode === 'perPoint'
        ? [`+${value.toFixed(2)}/pt`, name] as [string, string]
        : [`+${value.toFixed(1)}`, name] as [string, string];
    },
    labelFormatter: (label: number) => `Level ${label}`
  }), [viewMode]);

  // Build chart configuration based on current selection
  // Use optimalStats for marker positions if provided, otherwise fall back to currentStats
  const markerStats = optimalStats ?? currentStats;

  const chartConfig = useMemo((): ChartConfig => {
    // All Stats view: compare all scaling stats
    if (selection.type === 'all-stats') {
      const statLines = scalingStats.map(stat => ({
        key: stat.key,
        dataKey: getDataKey(stat.key, selection),
        name: stat.label,
        color: stat.color,
      }));
      return {
        lines: statLines,
        xAxisLabel: 'Stat Level',
        requirementMarkers: scalingStats.map(stat => ({
          statKey: stat.key,
          requirement: requirements[stat.key] ?? 0,
          dataKeyFn: () => getDataKey(stat.key, selection),
        })),
        currentStatMarkers: scalingStats.map(stat => ({
          statKey: stat.key,
          level: markerStats[stat.key as keyof CharacterStats],
          dataKeyFn: () => getDataKey(stat.key, selection),
          color: stat.color,
        })),
      };
    }

    // Single Stat view: show damage type breakdown for selected stat
    if (selection.type === 'stat') {
      const statLabel = scalingStats.find(s => s.key === selection.stat)?.label || '';
      const firstDamageType = availableDamageTypes.find(t => t !== 'total') || '';
      const damageLines = availableDamageTypes.filter(t => t !== 'total').map(type => ({
        key: type,
        dataKey: getDataKey(selection.stat, selection, type),
        name: DAMAGE_TYPE_LABELS[type as keyof typeof DAMAGE_TYPE_LABELS],
        color: DAMAGE_COLORS[type as keyof typeof DAMAGE_COLORS],
      }));
      return {
        lines: damageLines,
        xAxisLabel: `${statLabel} Level`,
        requirementMarkers: [{
          statKey: selection.stat,
          requirement: requirements[selection.stat] ?? 0,
          dataKeyFn: () => firstDamageType ? getDataKey(selection.stat, selection, firstDamageType) : '',
        }],
        currentStatMarkers: [{
          statKey: selection.stat,
          level: markerStats[selection.stat as keyof CharacterStats],
          dataKeyFn: () => firstDamageType ? getDataKey(selection.stat, selection, firstDamageType) : '',
          color: CHART_COLORS.currentStatMarker,
        }],
      };
    }

    // Damage Type view: show stat contributions to selected damage type
    const statLines = scalingStats.map(stat => ({
      key: stat.key,
      dataKey: getDataKey(stat.key, selection),
      name: stat.label,
      color: stat.color,
    }));
    return {
      lines: statLines,
      xAxisLabel: 'Stat Level',
      requirementMarkers: scalingStats.map(stat => ({
        statKey: stat.key,
        requirement: requirements[stat.key] ?? 0,
        dataKeyFn: () => getDataKey(stat.key, selection),
      })),
      currentStatMarkers: scalingStats.map(stat => ({
        statKey: stat.key,
        level: markerStats[stat.key as keyof CharacterStats],
        dataKeyFn: () => getDataKey(stat.key, selection),
        color: stat.color,
      })),
    };
  }, [selection, scalingStats, availableDamageTypes, requirements, markerStats]);

  // Empty state
  if (scalingStats.length === 0) {
    return (
      <div>
        <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-4">{title}</h3>
        <p className="text-[#6a6a6a] text-sm">No scaling attributes</p>
      </div>
    );
  }

  // Filter damage types to only show non-total types
  const damageTypeOptions = availableDamageTypes.filter(t => t !== 'total');

  return (
    <div>
      {/* Header */}
      <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-3">{title}</h3>

      {/* View mode toggle */}
      <div className="flex items-center gap-3 mb-4">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5"
        >
          <ToggleGroupItem value="perPoint" size="xs">
            Per Point
          </ToggleGroupItem>
          <ToggleGroupItem value="scaling" size="xs">
            Cumulative
          </ToggleGroupItem>
        </ToggleGroup>
        {showIgnoreRequirements && (
          <label className="flex items-center gap-2 cursor-pointer group">
            <Checkbox
              checked={ignoreRequirements}
              onCheckedChange={(checked) => setIgnoreRequirements(checked === true)}
              className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
            />
            <span className="text-[#6a6a6a] text-xs group-hover:text-[#8b8b8b] transition-colors">Ignore Reqs</span>
          </label>
        )}
      </div>

      {/* Unified selector: Stats and Damage Types stacked */}
      <div className="flex flex-col gap-2 mb-4">
        {/* Stat options row */}
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={selectionValue}
            onValueChange={(value) => value && setSelectionValue(value)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5"
          >
            <ToggleGroupItem value="all-stats" size="xs">
              All
            </ToggleGroupItem>
            {scalingStats.map(stat => (
              <ToggleGroupItem key={stat.key} value={`stat:${stat.key}`} size="xs">
                {stat.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Damage type options row */}
        {damageTypeOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={selectionValue}
              onValueChange={(value) => value && setSelectionValue(value)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5"
            >
              {damageTypeOptions.map(type => (
                <ToggleGroupItem key={type} value={`damage:${type}`} size="xs">
                  {DAMAGE_TYPE_LABELS[type as keyof typeof DAMAGE_TYPE_LABELS]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ScalingLineChart
          dataPoints={dataPoints}
          dataPointsByLevel={dataPointsByLevel}
          config={chartConfig}
          yAxisLabel={yAxisLabel}
          tooltipStyle={tooltipStyle}
          viewMode={viewMode}
        />
      </ResponsiveContainer>
    </div>
  );
}
