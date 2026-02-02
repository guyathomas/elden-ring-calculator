import { useState, useMemo } from 'react';
import type { WeaponListItem, CharacterStats, PrecomputedDataV2 } from '../types';
import { STAT_COLORS } from '../constants';
import { useSpellScalingData } from '../hooks/useSpellScalingData';
import { ScalingChart } from './ScalingChart';
import { calculateWeaponAR } from '../utils/damageCalculator';

// ============================================================================
// Types
// ============================================================================

interface SpellScalingCurveProps {
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

export function SpellScalingCurve({ precomputed, weapon, currentStats, twoHanding = false, optimalStats }: SpellScalingCurveProps) {
  const [ignoreRequirements, setIgnoreRequirements] = useState(true);

  // Determine which type of spell scaling this weapon has
  const arResult = useMemo(() => 
    calculateWeaponAR(precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, currentStats, { twoHanding }),
    [precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, currentStats, twoHanding]
  );

  const hasSorceryScaling = arResult?.sorceryScaling !== null;
  const hasIncantationScaling = arResult?.incantationScaling !== null;
  const scalingType = hasSorceryScaling ? 'sorcery' : 'incantation';

  // Determine which stats affect spell scaling by checking perStat values
  const spellScaling = hasSorceryScaling ? arResult?.sorceryScaling : arResult?.incantationScaling;
  
  // Get stats that have spell scaling
  const scalingStats = useMemo(() => {
    if (!spellScaling) return [];
    
    const stats = [
      { key: 'str' as const, label: 'STR', color: STAT_COLORS.str, hasScaling: spellScaling.perStat.strength.rawScaling > 0 },
      { key: 'dex' as const, label: 'DEX', color: STAT_COLORS.dex, hasScaling: spellScaling.perStat.dexterity.rawScaling > 0 },
      { key: 'int' as const, label: 'INT', color: STAT_COLORS.int, hasScaling: spellScaling.perStat.intelligence.rawScaling > 0 },
      { key: 'fai' as const, label: 'FAI', color: STAT_COLORS.fai, hasScaling: spellScaling.perStat.faith.rawScaling > 0 },
      { key: 'arc' as const, label: 'ARC', color: STAT_COLORS.arc, hasScaling: spellScaling.perStat.arcane.rawScaling > 0 },
    ];
    
    return stats.filter(s => s.hasScaling).map(({ hasScaling, ...rest }) => rest);
  }, [spellScaling]);

  // Generate data points
  const { dataPoints, dataPointsByLevel, availableDamageTypes } = useSpellScalingData({
    precomputed,
    weapon,
    currentStats,
    twoHanding,
    ignoreRequirements,
    scalingStats,
    scalingType,
  });

  // Build requirements object
  const requirements = useMemo(() => ({
    str: weapon.requirements.str,
    dex: weapon.requirements.dex,
    int: weapon.requirements.int,
    fai: weapon.requirements.fai,
    arc: weapon.requirements.arc,
  }), [weapon.requirements]);

  // Don't render if no scaling stats
  if (scalingStats.length === 0) {
    return null;
  }

  const title = hasSorceryScaling && hasIncantationScaling 
    ? 'Spell Scaling Curves' 
    : hasSorceryScaling 
      ? 'Sorcery Scaling Curves' 
      : 'Incantation Scaling Curves';

  return (
    <ScalingChart
      dataPoints={dataPoints}
      dataPointsByLevel={dataPointsByLevel}
      scalingStats={scalingStats}
      availableDamageTypes={availableDamageTypes}
      currentStats={currentStats}
      optimalStats={optimalStats}
      requirements={requirements}
      title={title}
      showIgnoreRequirements={true}
      ignoreRequirements={ignoreRequirements}
      onIgnoreRequirementsChange={setIgnoreRequirements}
      yAxisLabels={{
        perPoint: 'Scaling per Point',
        scaling: 'Scaling Bonus',
      }}
    />
  );
}
