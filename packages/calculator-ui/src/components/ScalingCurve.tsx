import { useState, useMemo } from 'react';
import type { WeaponListItem, CharacterStats, PrecomputedDataV2 } from '../types';
import { STAT_COLORS } from '../constants';
import { useScalingData } from '../hooks/useScalingData';
import { ScalingChart } from './ScalingChart';

// ============================================================================
// Types
// ============================================================================

interface ScalingCurveProps {
  precomputed: PrecomputedDataV2;
  weapon: WeaponListItem;
  currentStats: CharacterStats;
  twoHanding?: boolean;
  /** Optimal stat levels from investment path (for markers along optimal path) */
  optimalStats?: CharacterStats;
}

// ============================================================================
// Main Component
// ============================================================================

export function ScalingCurve({ precomputed, weapon, currentStats, twoHanding = false, optimalStats }: ScalingCurveProps) {
  const [ignoreRequirements, setIgnoreRequirements] = useState(true);

  // Get stats that have scaling
  const scalingStats = useMemo(() => [
    { key: 'str' as const, label: 'STR', grade: weapon.scaling.str, color: STAT_COLORS.str },
    { key: 'dex' as const, label: 'DEX', grade: weapon.scaling.dex, color: STAT_COLORS.dex },
    { key: 'int' as const, label: 'INT', grade: weapon.scaling.int, color: STAT_COLORS.int },
    { key: 'fai' as const, label: 'FAI', grade: weapon.scaling.fai, color: STAT_COLORS.fai },
    { key: 'arc' as const, label: 'ARC', grade: weapon.scaling.arc, color: STAT_COLORS.arc },
  ].filter(s => s.grade !== '-'), [weapon.scaling]);

  // Generate data points
  const { dataPoints, dataPointsByLevel, availableDamageTypes } = useScalingData({
    precomputed,
    weapon,
    currentStats,
    twoHanding,
    ignoreRequirements,
    scalingStats,
  });

  // Build requirements object
  const requirements = useMemo(() => ({
    str: weapon.requirements.str,
    dex: weapon.requirements.dex,
    int: weapon.requirements.int,
    fai: weapon.requirements.fai,
    arc: weapon.requirements.arc,
  }), [weapon.requirements]);

  return (
    <ScalingChart
      dataPoints={dataPoints}
      dataPointsByLevel={dataPointsByLevel}
      scalingStats={scalingStats}
      availableDamageTypes={availableDamageTypes}
      currentStats={currentStats}
      optimalStats={optimalStats}
      requirements={requirements}
      title="Scaling Curves"
      showIgnoreRequirements={true}
      ignoreRequirements={ignoreRequirements}
      onIgnoreRequirementsChange={setIgnoreRequirements}
      yAxisLabels={{
        perPoint: 'AR per Point',
        scaling: 'Scaling Bonus (AR)',
      }}
    />
  );
}
