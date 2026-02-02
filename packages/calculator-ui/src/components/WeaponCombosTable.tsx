import { useMemo, useState, useEffect, Fragment } from 'react';
import { Loader2, ChevronDown, ChevronRight, Info, ArrowUp, ArrowDown } from 'lucide-react';
import type { ComboData } from '../types';
import { fetchWeaponCombos } from '../data';
import { ComboTimeline } from './ComboTimeline';

type SortColumn = 'poiseDamage' | 'gap' | 'type' | null;
type SortDirection = 'asc' | 'desc';

interface WeaponCombosTableProps {
  weaponName: string;
  twoHanding: boolean;
}

type ComboFilter = 'all' | 'true' | 'pseudo';
type GripFilter = 'auto' | '1h' | '2h' | 'paired';

const FILTER_LABELS: Record<ComboFilter, string> = {
  all: 'All Combos',
  true: 'True Combos',
  pseudo: 'Pseudo Combos',
};

const GRIP_LABELS: Record<GripFilter, string> = {
  auto: 'Auto',
  '1h': '1H',
  '2h': '2H',
  paired: 'Paired',
};

function getComboTypeLabel(type: 'true' | 'pseudo' | 'none'): string {
  switch (type) {
    case 'true': return 'True Combo';
    case 'pseudo': return 'Pseudo Combo';
    case 'none': return 'No Combo';
  }
}

function getComboTypeColor(type: 'true' | 'pseudo' | 'none'): string {
  switch (type) {
    case 'true': return 'text-[#4ade80]';
    case 'pseudo': return 'text-[#f0ad4e]';
    case 'none': return 'text-[#6a6a6a]';
  }
}

function getComboTypeBgColor(type: 'true' | 'pseudo' | 'none'): string {
  switch (type) {
    case 'true': return 'bg-[#1a2a1a]';
    case 'pseudo': return 'bg-[#2a2a1a]';
    case 'none': return 'bg-[#1a1a1a]';
  }
}

// Check if attack is 1H, 2H, or Paired based on type number
function isOneHanded(attackType: number): boolean {
  return attackType < 200 || (attackType >= 500 && attackType < 600);
}

function isTwoHanded(attackType: number): boolean {
  return attackType >= 200 && attackType < 400;
}

function isPaired(attackType: number): boolean {
  return attackType >= 400 && attackType < 500;
}

function getAttackGrip(attackType: number): '1h' | '2h' | 'paired' {
  if (isPaired(attackType)) return 'paired';
  if (isTwoHanded(attackType)) return '2h';
  return '1h';
}

export function WeaponCombosTable({ weaponName, twoHanding }: WeaponCombosTableProps) {
  const [allCombos, setAllCombos] = useState<ComboData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ComboFilter>('true');
  const [gripFilter, setGripFilter] = useState<GripFilter>('auto');
  const [expandedCombo, setExpandedCombo] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [opponentPoise, setOpponentPoise] = useState<number>(51);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Determine effective grip filter (auto uses twoHanding prop)
  const effectiveGrip = gripFilter === 'auto' ? (twoHanding ? '2h' : '1h') : gripFilter;

  // Load combos from pre-generated static data
  useEffect(() => {
    let cancelled = false;

    async function loadCombos() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchWeaponCombos(weaponName);
        if (!cancelled) {
          setAllCombos(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load combos');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCombos();

    return () => {
      cancelled = true;
    };
  }, [weaponName]);

  // Filter and sort combos
  const filteredCombos = useMemo(() => {
    const filtered = allCombos.filter(combo => {
      // Filter by grip (1H vs 2H vs Paired)
      const gripA = getAttackGrip(combo.attackAType);
      const gripB = getAttackGrip(combo.attackBType);
      if (gripA !== effectiveGrip || gripB !== effectiveGrip) return false;

      // Filter by poise (combo only works if poise damage >= opponent poise)
      if (opponentPoise > 0 && combo.poiseDamageA < opponentPoise) return false;

      // Filter by combo type
      if (filter !== 'all' && combo.comboType !== filter) return false;

      return true;
    });

    // Apply sorting
    if (sortColumn) {
      const comboTypeOrder = { true: 0, pseudo: 1, none: 2 };
      filtered.sort((a, b) => {
        let comparison = 0;
        switch (sortColumn) {
          case 'poiseDamage':
            comparison = a.poiseDamageA - b.poiseDamageA;
            break;
          case 'gap':
            comparison = a.gap - b.gap;
            break;
          case 'type':
            comparison = comboTypeOrder[a.comboType] - comboTypeOrder[b.comboType];
            break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [allCombos, effectiveGrip, opponentPoise, filter, sortColumn, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction or clear sort
      if (sortDirection === 'desc') {
        setSortColumn(null);
      } else {
        setSortDirection('desc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Count combos by type (after grip and poise filtering)
  const comboCounts = useMemo(() => {
    const gripAndPoiseFiltered = allCombos.filter(combo => {
      const gripA = getAttackGrip(combo.attackAType);
      const gripB = getAttackGrip(combo.attackBType);
      if (gripA !== effectiveGrip || gripB !== effectiveGrip) return false;
      if (opponentPoise > 0 && combo.poiseDamageA < opponentPoise) return false;
      return true;
    });

    return {
      all: gripAndPoiseFiltered.length,
      true: gripAndPoiseFiltered.filter(c => c.comboType === 'true').length,
      pseudo: gripAndPoiseFiltered.filter(c => c.comboType === 'pseudo').length,
    };
  }, [allCombos, effectiveGrip, opponentPoise]);

  // Count combos by grip (for showing counts in grip filter)
  const gripCounts = useMemo(() => {
    const poiseFiltered = allCombos.filter(combo => {
      if (opponentPoise > 0 && combo.poiseDamageA < opponentPoise) return false;
      return true;
    });

    const countByGrip = (grip: '1h' | '2h' | 'paired') =>
      poiseFiltered.filter(c =>
        getAttackGrip(c.attackAType) === grip && getAttackGrip(c.attackBType) === grip
      ).length;

    return {
      '1h': countByGrip('1h'),
      '2h': countByGrip('2h'),
      paired: countByGrip('paired'),
    };
  }, [allCombos, opponentPoise]);

  // Determine which grips have combos
  const availableGrips = useMemo(() => {
    const grips: GripFilter[] = ['auto'];
    if (gripCounts['1h'] > 0) grips.push('1h');
    if (gripCounts['2h'] > 0) grips.push('2h');
    if (gripCounts.paired > 0) grips.push('paired');
    return grips;
  }, [gripCounts]);

  // Create unique key for combo
  const getComboKey = (combo: ComboData) =>
    `${combo.attackAType}-${combo.attackBType}`;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#8b8b8b]">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading combo data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-[#c9302c] text-sm">{error}</div>
    );
  }

  if (allCombos.length === 0) {
    return (
      <div className="text-[#6a6a6a] text-sm italic">
        No combo data available for this weapon
      </div>
    );
  }

  return (
    <div>
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Combo type filter */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'true', 'pseudo'] as ComboFilter[]).map(filterType => {
              const count = comboCounts[filterType];
              return (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${filter === filterType
                    ? filterType === 'true'
                      ? 'bg-[#1a3a1a] text-[#4ade80] border border-[#4ade80]/30'
                      : filterType === 'pseudo'
                        ? 'bg-[#3a2a1a] text-[#f0ad4e] border border-[#f0ad4e]/30'
                        : 'bg-[#d4af37] text-[#0a0a0a] font-medium'
                    : 'bg-[#1a1a1a] text-[#8b8b8b] hover:bg-[#252525] hover:text-[#cccccc]'
                    }`}
                >
                  {FILTER_LABELS[filterType]} ({count})
                </button>
              );
            })}
          </div>

          {/* Grip filter */}
          {availableGrips.length > 2 && (
            <>
              <div className="w-px h-5 bg-[#2a2a2a]" />
              <div className="flex gap-1">
                {availableGrips.map(grip => {
                  const isActive = gripFilter === grip;
                  const label = grip === 'auto'
                    ? `${GRIP_LABELS.auto} (${twoHanding ? '2H' : '1H'})`
                    : `${GRIP_LABELS[grip]} (${gripCounts[grip as keyof typeof gripCounts] || 0})`;
                  return (
                    <button
                      key={grip}
                      onClick={() => setGripFilter(grip)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${isActive
                        ? 'bg-[#2a2a2a] text-[#d4af37] border border-[#d4af37]/30'
                        : 'bg-[#1a1a1a] text-[#6a6a6a] hover:bg-[#252525] hover:text-[#8b8b8b]'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Poise input and info */}
        <div className="flex items-center gap-3">
          {/* Poise input */}
          <div className="flex items-center gap-2">
            <label htmlFor="opponent-poise" className="text-xs text-[#6a6a6a]">
              Enemy Poise:
            </label>
            <input
              id="opponent-poise"
              type="number"
              min={0}
              max={999}
              value={opponentPoise}
              onChange={(e) => setOpponentPoise(parseInt(e.target.value) || 0)}
              onBlur={(e) => setOpponentPoise(Math.max(0, Math.min(999, parseInt(e.target.value) || 0)))}
              className="w-16 text-center text-xs py-1 px-2 rounded border bg-[#0a0a0a] border-[#2a2a2a] text-[#c8c8c8] focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
            />
          </div>

          {/* Info tooltip */}
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="p-1 text-[#6a6a6a] hover:text-[#8b8b8b] transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-full mt-1 z-10 w-80 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg text-xs">
                <p className="text-[#c8c8c8] mb-2">
                  <strong className="text-[#4ade80]">True Combo:</strong> Inescapable if stagger occurs (Gap ≤ 0)
                </p>
                <p className="text-[#c8c8c8] mb-2">
                  <strong className="text-[#f0ad4e]">Pseudo Combo:</strong> Tight roll catch (Gap 1-5 frames)
                </p>
                <p className="text-[#c8c8c8] mb-2">
                  <strong className="text-[#8b8b8b]">Enemy Poise:</strong> Combos only work if your poise damage ≥ enemy poise. Set to 0 to show all combos.
                </p>
                <p className="text-[#6a6a6a] text-[10px] mt-2 border-t border-[#2a2a2a] pt-2">
                  Gap = (Cancel + Startup) - (Hit + Stun)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Combos table */}
      {filteredCombos.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="px-1.5 md:px-3 py-2 text-left text-xs uppercase tracking-wider text-[#8b8b8b] w-6 md:w-8"></th>
                <th className="px-1.5 md:px-3 py-2 text-left text-xs uppercase tracking-wider text-[#8b8b8b]">
                  Attack A
                </th>
                <th className="px-1 md:px-3 py-2 text-center text-xs uppercase tracking-wider text-[#6a6a6a]">
                  →
                </th>
                <th className="px-1.5 md:px-3 py-2 text-left text-xs uppercase tracking-wider text-[#8b8b8b]">
                  Attack B
                </th>
                <th
                  className="hidden md:table-cell px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b] cursor-pointer hover:text-[#cccccc] select-none"
                  onClick={() => handleSort('poiseDamage')}
                >
                  <span className="inline-flex items-center gap-1">
                    Poise Dmg
                    {sortColumn === 'poiseDamage' && (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </span>
                </th>
                <th
                  className="px-1.5 md:px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b] cursor-pointer hover:text-[#cccccc] select-none"
                  onClick={() => handleSort('gap')}
                >
                  <span className="inline-flex items-center gap-1">
                    Gap
                    {sortColumn === 'gap' && (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </span>
                </th>
                <th
                  className="hidden md:table-cell px-3 py-2 text-right text-xs uppercase tracking-wider text-[#8b8b8b] cursor-pointer hover:text-[#cccccc] select-none"
                  onClick={() => handleSort('type')}
                >
                  <span className="inline-flex items-center gap-1">
                    Type
                    {sortColumn === 'type' && (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCombos.map((combo) => {
                const key = getComboKey(combo);
                const isExpanded = expandedCombo === key;

                return (
                  <Fragment key={key}>
                    <tr
                      className={`border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors cursor-pointer ${getComboTypeBgColor(combo.comboType)}`}
                      onClick={() => setExpandedCombo(isExpanded ? null : key)}
                    >
                      <td className="px-1.5 md:px-3 py-2.5 text-[#6a6a6a]">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-1.5 md:px-3 py-2.5">
                        <span className="text-[#cccccc]">{combo.attackAName}</span>
                        <span className="text-[#6a6a6a] text-xs ml-1 md:ml-2 capitalize hidden md:inline">({combo.attackACategory})</span>
                      </td>
                      <td className="px-1 md:px-3 py-2.5 text-center text-[#6a6a6a]">
                        →
                      </td>
                      <td className="px-1.5 md:px-3 py-2.5">
                        <span className="text-[#cccccc]">{combo.attackBName}</span>
                        <span className="text-[#6a6a6a] text-xs ml-1 md:ml-2 capitalize hidden md:inline">({combo.attackBCategory})</span>
                      </td>
                      <td className="hidden md:table-cell px-3 py-2.5 text-right text-[#9b9b9b] font-mono">
                        {combo.poiseDamageA}
                      </td>
                      <td className={`px-1.5 md:px-3 py-2.5 text-right font-mono ${getComboTypeColor(combo.comboType)}`}>
                        {combo.gap > 0 ? `+${combo.gap}` : combo.gap}
                      </td>
                      <td className={`hidden md:table-cell px-3 py-2.5 text-right font-medium ${getComboTypeColor(combo.comboType)}`}>
                        {getComboTypeLabel(combo.comboType)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#0a0a0a]">
                        <td colSpan={999} className="px-4 py-3 max-w-0">
                          <ComboTimeline combo={combo} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-[#6a6a6a] text-sm italic text-center py-4">
          {opponentPoise > 0
            ? `No combos found with poise damage ≥ ${opponentPoise}`
            : `No ${filter === 'all' ? '' : filter + ' '}combos found for ${effectiveGrip.toUpperCase()} attacks`}
        </div>
      )}
    </div>
  );
}
