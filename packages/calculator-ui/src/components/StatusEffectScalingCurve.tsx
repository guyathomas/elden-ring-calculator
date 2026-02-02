import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Check } from 'lucide-react';
import type { WeaponListItem, CharacterStats, PrecomputedDataV2 } from '../types';
import { useStatusEffectScalingData } from '../hooks/useStatusEffectScalingData';
import type { ViewMode } from '../types/scaling';

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
} as const;

const STATUS_EFFECT_CONFIG = [
  { key: 'bleed', label: 'Blood Loss', color: '#c9302c' },
  { key: 'frost', label: 'Frostbite', color: '#5bc0de' },
  { key: 'poison', label: 'Poison', color: '#9c6' },
  { key: 'scarletRot', label: 'Scarlet Rot', color: '#d9534f' },
  { key: 'sleep', label: 'Sleep', color: '#a8a8d8' },
  { key: 'madness', label: 'Madness', color: '#f0ad4e' },
] as const;

// ============================================================================
// Types
// ============================================================================

interface StatusEffectScalingCurveProps {
  precomputed: PrecomputedDataV2;
  weapon: WeaponListItem;
  currentStats: CharacterStats;
  twoHanding?: boolean;
  optimalStats?: CharacterStats;
}

// ============================================================================
// Main Component
// ============================================================================

export function StatusEffectScalingCurve({
  precomputed,
  weapon,
  currentStats,
  twoHanding = false,
  optimalStats,
}: StatusEffectScalingCurveProps) {
  const [ignoreRequirements, setIgnoreRequirements] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('total');

  // Get status effect scaling data
  const { dataPoints: rawDataPoints, dataPointsByLevel: rawDataPointsByLevel, activeStatusEffects, hasAnyArcaneScaling } = useStatusEffectScalingData({
    precomputed,
    weapon,
    currentStats,
    twoHanding,
    ignoreRequirements,
    statusEffectConfig: STATUS_EFFECT_CONFIG,
  });

  // Calculate per-point (marginal) gains if enabled
  const { dataPoints, dataPointsByLevel } = useMemo(() => {
    // For 'total' and 'scaling' modes, use raw data as-is
    if (viewMode !== 'perPoint') {
      return { dataPoints: rawDataPoints, dataPointsByLevel: rawDataPointsByLevel };
    }

    // For 'perPoint' mode, calculate marginal gains per arcane point
    const perPointData = rawDataPoints.map((point, index) => {
      if (index === 0) {
        const newPoint: Record<string, number> = { level: point.level };
        Object.keys(point).forEach(key => {
          if (key !== 'level') newPoint[key] = 0;
        });
        return newPoint;
      }

      const prevPoint = rawDataPoints[index - 1];
      const newPoint: Record<string, number> = { level: point.level };

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

  // Don't render if no status effects are active
  if (activeStatusEffects.length === 0) {
    return null;
  }

  const arcaneRequirement = weapon.requirements.arc;
  const currentArcane = currentStats.arc;
  const markerArcane = optimalStats?.arc ?? currentArcane;

  // Get the correct dataKey suffix based on view mode
  const getDataKeySuffix = () => {
    switch (viewMode) {
      case 'total':
        return '_total';
      case 'perPoint':
        return '_total'; // perPoint mode uses _total then transforms in useMemo
      case 'scaling':
        return '_cum';
    }
  };

  // Build chart lines for all active status effects
  const lines = activeStatusEffects.map(effect => ({
    key: effect.key,
    dataKey: `${effect.key}${getDataKeySuffix()}`,
    name: effect.label,
    color: effect.color,
  }));

  // Build requirement marker
  const requirementMarkerData = arcaneRequirement > 0 ? (() => {
    const dataPoint = dataPointsByLevel.get(arcaneRequirement);
    if (!dataPoint) return null;
    // Use first status effect for the marker Y value
    const firstEffect = activeStatusEffects[0];
    if (!firstEffect) return null;
    const dataKey = `${firstEffect.key}${getDataKeySuffix()}`;
    const yVal = dataPoint[dataKey];
    if (yVal === undefined) return null;
    return { x: arcaneRequirement, y: yVal };
  })() : null;

  // Build current stat marker
  const currentStatMarkerData = markerArcane >= 1 && markerArcane <= 99 ? (() => {
    const dataPoint = dataPointsByLevel.get(markerArcane);
    if (!dataPoint) return null;
    // Use first status effect for the marker Y value
    const firstEffect = activeStatusEffects[0];
    if (!firstEffect) return null;
    const dataKey = `${firstEffect.key}${getDataKeySuffix()}`;
    const yVal = dataPoint[dataKey];
    if (yVal === undefined) return null;
    return { x: markerArcane, y: yVal };
  })() : null;

  const getYAxisLabel = () => {
    switch (viewMode) {
      case 'total':
        return 'Status Buildup';
      case 'perPoint':
        return 'Buildup per Point';
      case 'scaling':
        return 'Scaling Bonus';
    }
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#1a1a1a',
      border: '1px solid #3a3a3a',
      borderRadius: '4px',
      fontSize: '12px'
    },
    labelStyle: { color: '#d4af37' },
    formatter: (value: number, name: string) => {
      switch (viewMode) {
        case 'total':
          return [value.toFixed(1), name] as [string, string];
        case 'perPoint':
          return [`+${value.toFixed(2)}/pt`, name] as [string, string];
        case 'scaling':
          return [`+${value.toFixed(1)}`, name] as [string, string];
      }
    },
    labelFormatter: (label: number) => `Arcane ${label}`
  };

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
      {/* Header */}
      <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-3">Status Effect Buildup</h3>

      {/* View mode toggle */}
      <div className="flex items-center gap-3 mb-4">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5"
        >
          <ToggleGroupItem value="total" size="xs">
            Total
          </ToggleGroupItem>
          <ToggleGroupItem value="perPoint" size="xs">
            Per Point
          </ToggleGroupItem>
          <ToggleGroupItem value="scaling" size="xs">
            Cumulative
          </ToggleGroupItem>
        </ToggleGroup>
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
          <span className="text-[#6a6a6a] text-xs group-hover:text-[#8b8b8b] transition-colors">Ignore Reqs</span>
        </label>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={dataPoints} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          {requirementMarkerData && (
            <ReferenceDot
              x={requirementMarkerData.x}
              y={requirementMarkerData.y}
              r={4}
              fill={CHART_COLORS.requirementMarker}
              stroke={CHART_COLORS.markerStroke}
              strokeWidth={1}
            />
          )}
          <XAxis
            dataKey="level"
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
            label={{ value: 'Arcane Level', position: 'insideBottom', offset: -5, fill: CHART_COLORS.axisLabel, fontSize: 11 }}
          />
          <YAxis
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
            label={{ value: getYAxisLabel(), angle: -90, position: 'insideLeft', fill: CHART_COLORS.axisLabel, fontSize: 11 }}
          />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} iconType="square" />
          {lines.map(line => (
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
          {currentStatMarkerData && (
            <ReferenceDot
              x={currentStatMarkerData.x}
              y={currentStatMarkerData.y}
              r={5}
              fill={CHART_COLORS.currentStatMarker}
              stroke={CHART_COLORS.markerStroke}
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
