import { useState, useMemo } from 'react';
import { Skull } from 'lucide-react';
import type { WeaponListItem, CharacterStats, PrecomputedDataV2 } from '../types';
import type { SolverOptimizationMode } from '../types/solverTypes';
import { calculateWeaponAR } from '../utils/damageCalculator';
import type { EnemyData } from '../data';
import { calculateEnemyDamage, getPhysicalDefenseType } from '../data';

interface DamageBreakdownProps {
  precomputed: PrecomputedDataV2;
  weapon: WeaponListItem;
  stats: CharacterStats;
  twoHanding?: boolean;
  /** Pre-computed stat gains from useStatGains hook to avoid duplicate calculations */
  statGains?: Record<string, number>;
  /** Selected enemy for damage calculation */
  selectedEnemy?: EnemyData | null;
  /** Primary attack attribute for physical defense type */
  attackAttribute?: string;
  /** Optimization mode - when 'SP', shows spell power breakdown instead of AR */
  optimizationMode?: SolverOptimizationMode;
}

const damageColors = {
  physical: 'text-[#9a9a9a]',
  magic: 'text-[#5bc0de]',
  fire: 'text-[#f0ad4e]',
  lightning: 'text-[#f4e04d]',
  holy: 'text-[#d4af37]',
};

const statKeys = {
  str: 'strength',
  dex: 'dexterity',
  int: 'intelligence',
  fai: 'faith',
  arc: 'arcane',
} as const;

type StatAbbrev = keyof typeof statKeys;
const statAbbrevs: StatAbbrev[] = ['str', 'dex', 'int', 'fai', 'arc'];

const damageTypeKeys = ['physical', 'magic', 'fire', 'lightning', 'holy'] as const;
type DamageTypeKey = typeof damageTypeKeys[number];

const damageTypeLabels: Record<DamageTypeKey, string> = {
  physical: 'Physical',
  magic: 'Magic',
  fire: 'Fire',
  lightning: 'Lightning',
  holy: 'Holy',
};

// Get color for efficacy percentage
function getEfficacyColor(efficacy: number): string {
  if (efficacy >= 70) return '#4ade80'; // Green - good matchup
  if (efficacy >= 40) return '#f0ad4e'; // Yellow - neutral
  return '#ef4444'; // Red - poor matchup
}

// Format negation for display
function formatNegation(value: number): { text: string; color: string } {
  if (value < 0) {
    return { text: `${value}%`, color: '#ef4444' }; // Red for weakness
  }
  if (value >= 50) {
    return { text: `${value}%`, color: '#4ade80' }; // Green for strong resistance
  }
  return { text: `${value}%`, color: '#8b8b8b' }; // Neutral
}

export function DamageBreakdown({ precomputed, weapon, stats, twoHanding = false, statGains: precomputedGains, selectedEnemy, attackAttribute = 'Standard', optimizationMode = 'AR' }: DamageBreakdownProps) {
  const [showIncremental, setShowIncremental] = useState(false);

  const arResult = useMemo(
    () => calculateWeaponAR(precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, stats, { twoHanding }),
    [precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, stats, twoHanding]
  );

  // Calculate incremental AR for each stat (+1 from current level) - only when toggle is active
  const incrementalResults = useMemo(() => {
    if (!showIncremental || !arResult) return null;

    const results: Record<StatAbbrev, ReturnType<typeof calculateWeaponAR>> = {
      str: null,
      dex: null,
      int: null,
      fai: null,
      arc: null,
    };

    for (const abbrev of statAbbrevs) {
      const newStats = { ...stats, [abbrev]: stats[abbrev] + 1 };
      results[abbrev] = calculateWeaponAR(precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, newStats, { twoHanding });
    }

    return results;
  }, [showIncremental, arResult, precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, stats, twoHanding]);

  // Build damage types array with per-stat scaling
  const damageTypes = useMemo(() => {
    if (!arResult) return [];
    return damageTypeKeys
      .map(key => ({
        type: damageTypeLabels[key],
        key,
        value: arResult[key].total,
        base: arResult[key].base,
        scaling: arResult[key].scaling,
        color: damageColors[key],
        perStat: arResult[key].perStat,
      }))
      .filter(d => d.value > 0);
  }, [arResult]);

  // Calculate total scaling contributions per stat (for total mode)
  const statTotals = useMemo(() => ({
    str: damageTypes.reduce((sum, d) => sum + (d.perStat.strength.scaling || 0), 0),
    dex: damageTypes.reduce((sum, d) => sum + (d.perStat.dexterity.scaling || 0), 0),
    int: damageTypes.reduce((sum, d) => sum + (d.perStat.intelligence.scaling || 0), 0),
    fai: damageTypes.reduce((sum, d) => sum + (d.perStat.faith.scaling || 0), 0),
    arc: damageTypes.reduce((sum, d) => sum + (d.perStat.arcane.scaling || 0), 0),
  }), [damageTypes]);

  // Calculate total incremental for each stat
  // Use pre-computed gains if available to avoid duplicate calculations
  const incrementalTotals = useMemo(() => {
    if (!arResult) return { str: 0, dex: 0, int: 0, fai: 0, arc: 0 };

    // If pre-computed gains are provided, use those
    if (precomputedGains) {
      return {
        str: precomputedGains.str ?? 0,
        dex: precomputedGains.dex ?? 0,
        int: precomputedGains.int ?? 0,
        fai: precomputedGains.fai ?? 0,
        arc: precomputedGains.arc ?? 0,
      };
    }

    // Otherwise calculate from incrementalResults (lazy calculation)
    return {
      str: incrementalResults?.str ? incrementalResults.str.total - arResult.total : 0,
      dex: incrementalResults?.dex ? incrementalResults.dex.total - arResult.total : 0,
      int: incrementalResults?.int ? incrementalResults.int.total - arResult.total : 0,
      fai: incrementalResults?.fai ? incrementalResults.fai.total - arResult.total : 0,
      arc: incrementalResults?.arc ? incrementalResults.arc.total - arResult.total : 0,
    };
  }, [arResult, incrementalResults, precomputedGains]);

  // Determine which stats have any scaling contribution (either total or incremental)
  const activeStats = useMemo(
    () => statAbbrevs.filter(stat => statTotals[stat] > 0.5 || incrementalTotals[stat] > 0),
    [statTotals, incrementalTotals]
  );

  // Calculate enemy damage breakdown when enemy is selected
  const enemyBreakdown = useMemo(() => {
    if (!arResult || !selectedEnemy) return null;

    const weaponAR = {
      physical: arResult.physical.total,
      magic: arResult.magic.total,
      fire: arResult.fire.total,
      lightning: arResult.lightning.total,
      holy: arResult.holy.total,
    };

    const result = calculateEnemyDamage({
      baseAR: weaponAR,
      motionValues: { physical: 100, magic: 100, fire: 100, lightning: 100, holy: 100 },
      attackAttribute,
      enemyDefenses: selectedEnemy.defenses,
    });

    const totalAR = weaponAR.physical + weaponAR.magic + weaponAR.fire + weaponAR.lightning + weaponAR.holy;
    const overallEfficacy = totalAR > 0 ? (result.total / totalAR) * 100 : 0;
    const physDefenseType = getPhysicalDefenseType(attackAttribute);

    const typeBreakdown = damageTypeKeys.map(type => {
      const ar = weaponAR[type];
      if (ar <= 0) return null;

      const damage = result.byType[type];
      const efficacy = ar > 0 ? (damage / ar) * 100 : 0;

      let defense: number;
      let negation: number;

      if (type === 'physical') {
        defense = selectedEnemy.defenses.defense[physDefenseType];
        negation = selectedEnemy.defenses.negation[physDefenseType];
      } else {
        defense = selectedEnemy.defenses.defense[type];
        negation = selectedEnemy.defenses.negation[type];
      }

      return {
        type,
        label: type === 'physical' ? `Physical (${attackAttribute})` : damageTypeLabels[type],
        color: damageColors[type],
        ar,
        defense,
        negation,
        damage,
        efficacy,
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    return { typeBreakdown, totalAR, totalDamage: result.rounded, overallEfficacy };
  }, [arResult, selectedEnemy, attackAttribute]);

  // Calculate incremental scaling per stat per damage type
  const getIncrementalScaling = (stat: StatAbbrev, damageKey: DamageTypeKey): number => {
    if (!arResult || !incrementalResults || !incrementalResults[stat]) return 0;
    const currentDamage = arResult[damageKey].total;
    const newDamage = incrementalResults[stat]![damageKey].total;
    return newDamage - currentDamage;
  };

  if (!arResult) {
    return (
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
        <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-3">Damage Breakdown</h3>
        <p className="text-[#6a6a6a]">Could not calculate damage</p>
      </div>
    );
  }

  // SP Mode: Spell Power Breakdown
  if (optimizationMode === 'SP') {
    const sorceryScaling = arResult.sorceryScaling;
    const incantScaling = arResult.incantationScaling;
    const hasBoth = sorceryScaling && incantScaling;

    // Build spell scaling entries to render
    const spellEntries: Array<{
      label: string;
      color: string;
      base: number;
      total: number;
      rounded: number;
      perStat: Record<string, number>;
    }> = [];

    if (sorceryScaling) {
      const perStat: Record<string, number> = {};
      for (const abbrev of statAbbrevs) {
        const fullName = statKeys[abbrev];
        perStat[abbrev] = sorceryScaling.perStat[fullName]?.scaling ?? 0;
      }
      spellEntries.push({
        label: 'Sorcery',
        color: '#5bc0de',
        base: sorceryScaling.base,
        total: sorceryScaling.total,
        rounded: sorceryScaling.rounded,
        perStat,
      });
    }

    if (incantScaling) {
      const perStat: Record<string, number> = {};
      for (const abbrev of statAbbrevs) {
        const fullName = statKeys[abbrev];
        perStat[abbrev] = incantScaling.perStat[fullName]?.scaling ?? 0;
      }
      spellEntries.push({
        label: 'Incantation',
        color: '#d4af37',
        base: incantScaling.base,
        total: incantScaling.total,
        rounded: incantScaling.rounded,
        perStat,
      });
    }

    // Determine which stats have scaling
    const spActiveStats = statAbbrevs.filter(stat =>
      spellEntries.some(entry => entry.perStat[stat] > 0.5) ||
      (precomputedGains && (precomputedGains[stat] ?? 0) > 0)
    );

    // Calculate incremental SP gains per stat per spell type
    const spIncrementalResults = showIncremental ? (() => {
      const results: Record<StatAbbrev, ReturnType<typeof calculateWeaponAR>> = {
        str: null, dex: null, int: null, fai: null, arc: null,
      };
      for (const abbrev of statAbbrevs) {
        const newStats = { ...stats, [abbrev]: stats[abbrev] + 1 };
        results[abbrev] = calculateWeaponAR(precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, newStats, { twoHanding });
      }
      return results;
    })() : null;

    const getSpIncrementalScaling = (stat: StatAbbrev, type: 'sorcery' | 'incantation'): number => {
      if (!spIncrementalResults || !spIncrementalResults[stat]) return 0;
      const newResult = spIncrementalResults[stat]!;
      const newScaling = type === 'sorcery' ? newResult.sorceryScaling : newResult.incantationScaling;
      const currentScaling = type === 'sorcery' ? sorceryScaling : incantScaling;
      if (!newScaling || !currentScaling) return 0;
      return newScaling.total - currentScaling.total;
    };

    return (
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs">SP Breakdown</h3>
          {spActiveStats.length > 0 && (
            <button
              onClick={() => setShowIncremental(!showIncremental)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                showIncremental
                  ? 'bg-[#2a4a2a] border-[#3a5a3a] text-[#7bc96f]'
                  : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#6a6a6a] hover:text-[#8b8b8b]'
              }`}
              title={showIncremental ? 'Showing SP gain per +1 stat' : 'Showing total scaling at current stats'}
            >
              {showIncremental ? '+1 Stat' : 'Total'}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#6a6a6a] text-xs uppercase">
                <th className="text-left pb-2 font-normal">Type</th>
                <th className="text-right pb-2 font-normal">Base</th>
                {spActiveStats.map(stat => (
                  <th key={stat} className="text-right pb-2 font-normal px-1">
                    {stat}
                    {showIncremental && <span className="text-[#4a4a4a] normal-case">+1</span>}
                  </th>
                ))}
                <th className="text-right pb-2 font-normal pl-2">Total</th>
              </tr>
            </thead>
            <tbody className="border-t border-[#2a2a2a]">
              {spellEntries.map((entry) => (
                <tr key={entry.label} className="border-b border-[#1a1a1a]">
                  <td className="py-2" style={{ color: entry.color }}>{entry.label}</td>
                  <td className="text-right py-2 text-[#9b9b9b]">{Math.round(entry.base)}</td>
                  {spActiveStats.map(stat => {
                    const scalingValue = showIncremental
                      ? getSpIncrementalScaling(stat, entry.label.toLowerCase() as 'sorcery' | 'incantation')
                      : entry.perStat[stat];
                    return (
                      <td key={stat} className="text-right py-2 px-1">
                        {showIncremental ? (
                          scalingValue >= 0.005
                            ? <span className="text-[#7bc96f]">+{scalingValue.toFixed(2)}</span>
                            : <span className="text-[#4a4a4a]">-</span>
                        ) : (
                          Math.round(scalingValue) > 0
                            ? <span className="text-[#7bc96f]">+{Math.round(scalingValue)}</span>
                            : <span className="text-[#4a4a4a]">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right py-2 text-[#e8e6e3] pl-2 font-medium">
                    {entry.rounded}
                  </td>
                </tr>
              ))}
            </tbody>
            {!hasBoth && spellEntries.length === 1 && (
              <tfoot>
                <tr className="border-t border-[#2a2a2a]">
                  <td className="pt-3 text-[#d4af37] uppercase tracking-wider text-xs">Total</td>
                  <td className="pt-3 text-right text-[#6a6a6a]">{Math.round(spellEntries[0].base)}</td>
                  {spActiveStats.map(stat => {
                    const totalValue = showIncremental
                      ? (precomputedGains?.[stat] ?? 0)
                      : spellEntries[0].perStat[stat];
                    return (
                      <td key={stat} className="pt-3 text-right px-1">
                        {showIncremental ? (
                          totalValue >= 0.005
                            ? <span className="text-[#7bc96f]">+{totalValue.toFixed(2)}</span>
                            : <span className="text-[#4a4a4a]">-</span>
                        ) : (
                          Math.round(totalValue) > 0
                            ? <span className="text-[#7bc96f]">+{Math.round(totalValue)}</span>
                            : <span className="text-[#4a4a4a]">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="pt-3 text-right text-[#d4af37] font-medium pl-2">
                    {spellEntries[0].rounded}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  const totalDamage = arResult.rounded;

  const renderScalingValue = (value: number, isIncremental: boolean) => {
    if (isIncremental) {
      // For incremental, show values with 2 decimal places
      if (value >= 0.005) {
        return <span className="text-[#7bc96f]">+{value.toFixed(2)}</span>;
      }
      return <span className="text-[#4a4a4a]">-</span>;
    }
    // For total, show rounded values
    const rounded = Math.round(value);
    if (rounded > 0) {
      return <span className="text-[#7bc96f]">+{rounded}</span>;
    }
    return <span className="text-[#4a4a4a]">-</span>;
  };

  // Show enemy damage table when enemy selected, otherwise show AR breakdown
  const showEnemyDamage = enemyBreakdown && enemyBreakdown.typeBreakdown.length > 0;

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
      {showEnemyDamage ? (
        /* Enemy Damage Breakdown Table */
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs">
              Damage Breakdown
            </h3>
            <div className="flex items-center gap-2 text-[#e06666]">
              <Skull className="w-3 h-3" />
              <span className="text-xs">{selectedEnemy!.name}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#6a6a6a] text-xs uppercase">
                  <th className="text-left pb-2 font-normal">Type</th>
                  <th className="text-right pb-2 font-normal">AR</th>
                  <th className="text-right pb-2 font-normal">Def</th>
                  <th className="text-right pb-2 font-normal">Neg</th>
                  <th className="text-right pb-2 font-normal">Dmg</th>
                  <th className="text-right pb-2 font-normal">Eff%</th>
                </tr>
              </thead>
              <tbody className="border-t border-[#2a2a2a]">
                {enemyBreakdown.typeBreakdown.map(({ type, label, color, ar, defense, negation, damage, efficacy }) => {
                  const negationDisplay = formatNegation(negation);
                  return (
                    <tr key={type} className="border-b border-[#1a1a1a]">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color.replace('text-[', '').replace(']', '') }}
                          />
                          <span className={color}>{label}</span>
                        </div>
                      </td>
                      <td className="text-right py-2 text-[#9b9b9b]">{Math.round(ar)}</td>
                      <td className="text-right py-2 text-[#9b9b9b]">{Math.round(defense)}</td>
                      <td className="text-right py-2" style={{ color: negationDisplay.color }}>{negationDisplay.text}</td>
                      <td className="text-right py-2 text-[#e06666]">{Math.round(damage)}</td>
                      <td className="text-right py-2" style={{ color: getEfficacyColor(efficacy) }}>{efficacy.toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#2a2a2a]">
                  <td className="pt-3 text-[#d4af37] uppercase tracking-wider text-xs">Total</td>
                  <td className="pt-3 text-right text-[#9b9b9b]">{Math.round(enemyBreakdown.totalAR)}</td>
                  <td className="pt-3 text-right text-[#4a4a4a]">—</td>
                  <td className="pt-3 text-right text-[#4a4a4a]">—</td>
                  <td className="pt-3 text-right text-[#e06666] font-medium">{enemyBreakdown.totalDamage}</td>
                  <td className="pt-3 text-right font-medium" style={{ color: getEfficacyColor(enemyBreakdown.overallEfficacy) }}>{enemyBreakdown.overallEfficacy.toFixed(0)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        /* AR Breakdown Table (no enemy selected) */
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs">AR Breakdown</h3>
            {activeStats.length > 0 && (
              <button
                onClick={() => setShowIncremental(!showIncremental)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  showIncremental
                    ? 'bg-[#2a4a2a] border-[#3a5a3a] text-[#7bc96f]'
                    : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#6a6a6a] hover:text-[#8b8b8b]'
                }`}
                title={showIncremental ? 'Showing AR gain per +1 stat' : 'Showing total scaling at current stats'}
              >
                {showIncremental ? '+1 Stat' : 'Total'}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#6a6a6a] text-xs uppercase">
                  <th className="text-left pb-2 font-normal">Type</th>
                  <th className="text-right pb-2 font-normal">Base</th>
                  {activeStats.map(stat => (
                    <th key={stat} className="text-right pb-2 font-normal px-1">
                      {stat}
                      {showIncremental && <span className="text-[#4a4a4a] normal-case">+1</span>}
                    </th>
                  ))}
                  <th className="text-right pb-2 font-normal pl-2">Total</th>
                </tr>
              </thead>
              <tbody className="border-t border-[#2a2a2a]">
                {damageTypes.map(({ type, key, value, base, perStat, color }) => (
                  <tr key={type} className="border-b border-[#1a1a1a]">
                    <td className={`py-2 ${color}`}>{type}</td>
                    <td className="text-right py-2 text-[#9b9b9b]">{showIncremental ? base.toFixed(2) : Math.round(base)}</td>
                    {activeStats.map(stat => {
                      const scalingValue = showIncremental
                        ? getIncrementalScaling(stat, key)
                        : perStat[statKeys[stat]].scaling || 0;
                      return (
                        <td key={stat} className="text-right py-2 px-1">
                          {renderScalingValue(scalingValue, showIncremental)}
                        </td>
                      );
                    })}
                    <td className="text-right py-2 text-[#e8e6e3] pl-2">
                      {showIncremental
                        ? (() => {
                            const rowIncrementalSum = activeStats.reduce((sum, stat) => sum + getIncrementalScaling(stat, key), 0);
                            return rowIncrementalSum >= 0.005
                              ? <span className="text-[#7bc96f]">+{rowIncrementalSum.toFixed(2)}</span>
                              : <span className="text-[#4a4a4a]">-</span>;
                          })()
                        : Math.round(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#2a2a2a]">
                  <td className="pt-3 text-[#d4af37] uppercase tracking-wider text-xs">Total</td>
                  <td className="pt-3 text-right text-[#6a6a6a]">{showIncremental ? damageTypes.reduce((sum, d) => sum + d.base, 0).toFixed(2) : Math.round(damageTypes.reduce((sum, d) => sum + d.base, 0))}</td>
                  {activeStats.map(stat => {
                    const totalValue = showIncremental ? incrementalTotals[stat] : statTotals[stat];
                    return (
                      <td key={stat} className="pt-3 text-right px-1">
                        {renderScalingValue(totalValue, showIncremental)}
                      </td>
                    );
                  })}
                  <td className="pt-3 text-right text-[#d4af37] font-medium pl-2">
                    {showIncremental
                      ? (() => {
                          const totalIncrementalSum = activeStats.reduce((sum, stat) => sum + incrementalTotals[stat], 0);
                          return totalIncrementalSum >= 0.005
                            ? <span className="text-[#7bc96f]">+{totalIncrementalSum.toFixed(2)}</span>
                            : <span className="text-[#4a4a4a]">-</span>;
                        })()
                      : arResult.rounded}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
