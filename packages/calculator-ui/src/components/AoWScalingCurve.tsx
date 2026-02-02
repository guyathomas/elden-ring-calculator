import { useMemo, useState } from 'react';
import type { CharacterStats, PrecomputedDataV2, WeaponListItem } from '../types';
import { toCalculatorStats } from '../types';
import type { PrecomputedAowData, AowAttackResult } from '../data';
import { calculateAowDamage } from '../data';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { STAT_COLORS } from '../constants';
import { useAoWScalingData } from '../hooks/useAoWScalingData';
import { ScalingChart } from './ScalingChart';
import type { ScalingStat } from '../types/scaling';
import { TOTAL_ATK_ID } from './AshAttackTable';

// ============================================================================
// Types
// ============================================================================

interface AoWScalingCurveProps {
  precomputed: PrecomputedDataV2;
  aowData: PrecomputedAowData;
  weapon: WeaponListItem;
  currentStats: CharacterStats;
  twoHanding?: boolean;
  aowName: string;
  selectedAttack: AowAttackResult;
}

// ============================================================================
// Constants
// ============================================================================

const STAT_CONFIG = [
  { key: 'str' as const, label: 'STR', calcKey: 'strength' as const },
  { key: 'dex' as const, label: 'DEX', calcKey: 'dexterity' as const },
  { key: 'int' as const, label: 'INT', calcKey: 'intelligence' as const },
  { key: 'fai' as const, label: 'FAI', calcKey: 'faith' as const },
  { key: 'arc' as const, label: 'ARC', calcKey: 'arcane' as const },
] as const;

const CHART_COLORS = {
  grid: '#2a2a2a',
  axis: '#6a6a6a',
  axisLabel: '#8b8b8b',
  line: '#d4af37',
  markerStroke: '#0a0a0a',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

function getTotalDamage(attack: AowAttackResult): number {
  let total = 0;
  if (attack.physical !== '-') total += attack.physical;
  if (attack.magic !== '-') total += attack.magic;
  if (attack.fire !== '-') total += attack.fire;
  if (attack.lightning !== '-') total += attack.lightning;
  if (attack.holy !== '-') total += attack.holy;
  return total;
}

function getMaxUpgradeLevel(precomputed: PrecomputedDataV2, weaponName: string): number | null {
  const weapon = precomputed.weapons[weaponName];
  return weapon?.maxUpgradeLevel ?? null;
}

// ============================================================================
// Upgrade Level Chart (for attacks without stat scaling)
// ============================================================================

interface UpgradeLevelChartProps {
  precomputed: PrecomputedDataV2;
  aowData: PrecomputedAowData;
  weapon: WeaponListItem;
  currentStats: CharacterStats;
  twoHanding: boolean;
  aowName: string;
  selectedAttack: AowAttackResult;
  maxUpgradeLevel: number;
}

function UpgradeLevelChart({
  precomputed,
  aowData,
  weapon,
  currentStats,
  twoHanding,
  aowName,
  selectedAttack,
  maxUpgradeLevel,
}: UpgradeLevelChartProps) {
  const dataPoints = useMemo(() => {
    const points = [];
    const calcStats = toCalculatorStats(currentStats);

    for (let level = 0; level <= maxUpgradeLevel; level++) {
      const result = calculateAowDamage(aowData, precomputed, {
        weaponName: weapon.name,
        affinity: weapon.affinity,
        upgradeLevel: level,
        weaponClass: weapon.categoryName,
        ...calcStats,
        twoHanding,
        ignoreRequirements: true,
        pvpMode: false,
        showLackingFp: false,
        aowName,
      });

      const attack = result?.attacks.find(a => a.atkId === selectedAttack.atkId);
      const damage = attack ? getTotalDamage(attack) : 0;

      points.push({
        level,
        damage: Math.round(damage * 10) / 10,
      });
    }

    return points;
  }, [aowData, precomputed, weapon, currentStats, twoHanding, aowName, selectedAttack.atkId, maxUpgradeLevel]);

  const hasUpgradeScaling = dataPoints.length > 1 &&
    dataPoints[dataPoints.length - 1].damage !== dataPoints[0].damage;

  if (!hasUpgradeScaling) {
    return (
      <div>
        <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-4">
          {selectedAttack.name} - Damage Scaling
        </h3>
        <p className="text-[#6a6a6a] text-sm">Fixed damage (no scaling)</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-4">
        {selectedAttack.name} - Damage vs Upgrade Level
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={dataPoints} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis
            dataKey="level"
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
            label={{ value: 'Upgrade Level', position: 'insideBottom', offset: -5, fill: CHART_COLORS.axisLabel, fontSize: 11 }}
          />
          <YAxis
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
            label={{ value: 'Damage', angle: -90, position: 'insideLeft', fill: CHART_COLORS.axisLabel, fontSize: 11 }}
            domain={['dataMin - 10', 'dataMax + 10']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #3a3a3a',
              borderRadius: '4px',
              fontSize: '12px'
            }}
            labelStyle={{ color: '#d4af37' }}
            formatter={(value: number) => [value.toFixed(1), 'Damage']}
            labelFormatter={(label) => `+${label}`}
          />
          <Line
            type="monotone"
            dataKey="damage"
            name="Damage"
            stroke={CHART_COLORS.line}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.line }}
            activeDot={{ r: 5 }}
          />
          {weapon.upgradeLevel >= 0 && weapon.upgradeLevel <= maxUpgradeLevel && (
            <ReferenceDot
              x={weapon.upgradeLevel}
              y={dataPoints[weapon.upgradeLevel]?.damage ?? 0}
              r={6}
              fill={CHART_COLORS.line}
              stroke={CHART_COLORS.markerStroke}
              strokeWidth={2}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[#6a6a6a] text-xs mt-2 italic">
        This attack scales with weapon upgrade level only (no stat scaling)
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AoWScalingCurve({
  precomputed,
  aowData,
  weapon,
  currentStats,
  twoHanding = false,
  aowName,
  selectedAttack
}: AoWScalingCurveProps) {
  const [ignoreRequirements, setIgnoreRequirements] = useState(true);

  const maxUpgradeLevel = getMaxUpgradeLevel(precomputed, weapon.name);
  const hasStatScaling = selectedAttack.hasStatScaling;

  // Helper to get total damage for selection (single attack or sum of all)
  const getDamageForAttackSelection = (attacks: AowAttackResult[], atkId: number): number => {
    if (atkId === TOTAL_ATK_ID) {
      // Sum all attacks
      return attacks.reduce((sum, attack) => sum + getTotalDamage(attack), 0);
    } else {
      const attack = attacks.find(a => a.atkId === atkId);
      return attack ? getTotalDamage(attack) : 0;
    }
  };

  // Determine which stats have scaling (only for stat-scaling attacks)
  const scalingStats = useMemo<ScalingStat[]>(() => {
    if (!hasStatScaling) return [];

    return STAT_CONFIG.filter(stat => {
      const calcStats = toCalculatorStats(currentStats);

      // Test with low value
      const lowStats = { ...calcStats, [stat.calcKey]: 10 };
      const lowResult = calculateAowDamage(aowData, precomputed, {
        weaponName: weapon.name,
        affinity: weapon.affinity,
        upgradeLevel: weapon.upgradeLevel,
        weaponClass: weapon.categoryName,
        ...lowStats,
        twoHanding,
        ignoreRequirements: true,
        pvpMode: false,
        showLackingFp: false,
        aowName,
      });

      // Test with high value
      const highStats = { ...calcStats, [stat.calcKey]: 80 };
      const highResult = calculateAowDamage(aowData, precomputed, {
        weaponName: weapon.name,
        affinity: weapon.affinity,
        upgradeLevel: weapon.upgradeLevel,
        weaponClass: weapon.categoryName,
        ...highStats,
        twoHanding,
        ignoreRequirements: true,
        pvpMode: false,
        showLackingFp: false,
        aowName,
      });

      if (!lowResult || !highResult) return false;

      const lowDamage = getDamageForAttackSelection(lowResult.attacks, selectedAttack.atkId);
      const highDamage = getDamageForAttackSelection(highResult.attacks, selectedAttack.atkId);

      return Math.abs(highDamage - lowDamage) > 0.1;
    }).map(stat => ({
      key: stat.key,
      label: stat.label,
      color: STAT_COLORS[stat.key],
    }));
  }, [hasStatScaling, aowData, precomputed, weapon, currentStats, twoHanding, aowName, selectedAttack.atkId]);

  // Generate scaling data using the shared hook
  const { dataPoints, dataPointsByLevel, availableDamageTypes } = useAoWScalingData({
    precomputed,
    aowData,
    weaponName: weapon.name,
    affinity: weapon.affinity,
    upgradeLevel: weapon.upgradeLevel,
    categoryName: weapon.categoryName,
    currentStats,
    twoHanding,
    ignoreRequirements,
    scalingStats,
    aowName,
    selectedAttackId: selectedAttack.atkId,
  });

  // Build requirements from weapon
  const requirements = useMemo(() => ({
    str: weapon.requirements.str,
    dex: weapon.requirements.dex,
    int: weapon.requirements.int,
    fai: weapon.requirements.fai,
    arc: weapon.requirements.arc,
  }), [weapon.requirements]);

  // Show upgrade level chart if no stat scaling
  if (!hasStatScaling && maxUpgradeLevel !== null) {
    return (
      <UpgradeLevelChart
        precomputed={precomputed}
        aowData={aowData}
        weapon={weapon}
        currentStats={currentStats}
        twoHanding={twoHanding}
        aowName={aowName}
        selectedAttack={selectedAttack}
        maxUpgradeLevel={maxUpgradeLevel}
      />
    );
  }

  // Empty state for attacks without any scaling
  if (scalingStats.length === 0) {
    return (
      <div>
        <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-4">
          {selectedAttack.name} - Damage Scaling
        </h3>
        <p className="text-[#6a6a6a] text-sm">No scaling detected for this attack</p>
      </div>
    );
  }

  // Stat scaling chart using shared component
  return (
    <ScalingChart
      dataPoints={dataPoints}
      dataPointsByLevel={dataPointsByLevel}
      scalingStats={scalingStats}
      availableDamageTypes={availableDamageTypes}
      currentStats={currentStats}
      requirements={requirements}
      title={`${selectedAttack.name} - Damage Scaling`}
      showIgnoreRequirements={true}
      ignoreRequirements={ignoreRequirements}
      onIgnoreRequirementsChange={setIgnoreRequirements}
      yAxisLabels={{
        perPoint: 'Damage per Point',
        scaling: 'Scaling Bonus',
      }}
    />
  );
}
