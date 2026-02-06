import { Skull } from 'lucide-react';
import type { WeaponListItem, StatConfig, CharacterStats, PrecomputedDataV2, StartingClass, AnimationEventData } from '../types';
import { toCalculatorStats, INITIAL_CLASS_VALUES } from '../types';
import { ScalingCurve } from './ScalingCurve';
import { SpellScalingCurve } from './SpellScalingCurve';
import { StatusEffectScalingCurve } from './StatusEffectScalingCurve';
import { OptimalInvestmentChart } from './OptimalInvestmentChart';
import { CatalystComparisonChart } from './CatalystComparisonChart';
import { DamageBreakdown } from './DamageBreakdown';
import { AshOfWarSelector } from './AshOfWarSelector';
import { AshAttackTable } from './AshAttackTable';
import { AoWScalingCurve } from './AoWScalingCurve';
import { WeaponAttacksTable } from './WeaponAttacksTable';
import { WeaponCombosTable } from './WeaponCombosTable';
import { WeaponDpsTable } from './WeaponDpsTable';
import { AnimationTimeline } from './AnimationTimeline';
import { RelatedWeaponsPanel } from './RelatedWeaponsPanel';
import { Loader2 } from 'lucide-react';
import { calculateWeaponAR } from '../utils/damageCalculator';
import { getAnimationId } from '../utils/animationMapping';
import { useStatGains } from '../hooks/useStatGains';
import { useSolverWorker } from '../hooks/useSolverWorker';
import { useInvestmentPath } from '../hooks/useInvestmentPath';
import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group.js';
import { NumericInput } from './ui/numeric-input.js';

const AffinityComparisonChart = lazy(() =>
  import('./AffinityComparisonChart').then(m => ({ default: m.AffinityComparisonChart }))
);
import type { PrecomputedAowData, AowCalculatorResult, AowAttackResult, EnemyData, AnimationUsersData } from '../data';
import type { SolverOptimizationMode } from '../types/solverTypes';
import { calculateAowDamage, canWeaponMountAoW, getWeaponSkillName, getWeaponDamageTypes, fetchAnimationData, loadAnimationUsers } from '../data';
import { fetchWeaponAttacks, type WeaponAttack } from '../data/weaponAttacks';
import type { StatusEffectResult } from '../data';


const statusEffectConfig = [
  { key: 'bleed', label: 'Blood Loss', color: '#c9302c' },
  { key: 'frost', label: 'Frostbite', color: '#5bc0de' },
  { key: 'poison', label: 'Poison', color: '#9c6' },
  { key: 'scarletRot', label: 'Scarlet Rot', color: '#d9534f' },
  { key: 'sleep', label: 'Sleep', color: '#a8a8d8' },
  { key: 'madness', label: 'Madness', color: '#f0ad4e' },
] as const;

type StatusEffectKey = typeof statusEffectConfig[number]['key'];

interface WeaponDetailProps {
  precomputed: PrecomputedDataV2;
  aowData: PrecomputedAowData | null;
  weapon: WeaponListItem;
  statConfigs: Record<string, StatConfig>;
  currentStats: CharacterStats;
  hasUnlockedStats: boolean;
  twoHanding?: boolean;
  selectedEnemy?: EnemyData | null;
  startingClass?: StartingClass;
  defaultAow?: string | null;
  /** Optimal stats from solver mode - used to initialize stat inputs when opening from solver */
  initialOptimalStats?: Record<string, number> | null;
  /** Current character level - used to calculate available stat budget in optimal mode */
  level?: number;
  /** Called when user changes the level in the detail panel (solver mode only) */
  onLevelChange?: (level: number) => void;
  /** Called when user selects a related weapon to navigate to it */
  onWeaponSelect?: (weapon: WeaponListItem) => void;
  /** All weapons at current upgrade level (for related weapons navigation) */
  allWeapons?: WeaponListItem[];
}

const DAMAGE_STATS = ['str', 'dex', 'int', 'fai', 'arc'] as const;
type DamageStat = typeof DAMAGE_STATS[number];

export function WeaponDetail({
  precomputed,
  aowData,
  weapon,
  statConfigs: _statConfigs,
  currentStats,
  hasUnlockedStats,
  twoHanding = false,
  selectedEnemy,
  startingClass,
  defaultAow,
  initialOptimalStats,
  level: parentLevel = 120,
  onLevelChange,
  onWeaponSelect,
  allWeapons = [],
}: WeaponDetailProps) {
  // Note: statConfigs is unused but kept for interface compatibility
  void _statConfigs;

  // Mode toggle: "optimal" uses calculated optimal stats, "fixed" uses manual overrides
  const [isOptimalMode, setIsOptimalMode] = useState(false);

  // Whether the weapon has spell scaling (is a catalyst)
  const hasSpellScaling = weapon.hasSorceryScaling || weapon.hasIncantationScaling;

  // Determine which stats contribute to spell scaling (for SP mode stat locking)
  const spellScalingStats = useMemo(() => {
    const weaponData = precomputed.weapons[weapon.name];
    const affinityData = weaponData?.affinities[weapon.affinity];
    if (!affinityData) return new Set<string>();

    const spellScaling = affinityData.sorceryScaling ?? affinityData.incantationScaling;
    if (!spellScaling) return new Set<string>();

    const statMap: Record<string, 'strength' | 'dexterity' | 'intelligence' | 'faith' | 'arcane'> = {
      str: 'strength', dex: 'dexterity', int: 'intelligence', fai: 'faith', arc: 'arcane',
    };

    const result = new Set<string>();
    for (const [short, long] of Object.entries(statMap)) {
      if (spellScaling[long] !== null) {
        result.add(short);
      }
    }
    return result;
  }, [precomputed, weapon.name, weapon.affinity]);

  // AR/SP optimization mode (only relevant for catalysts)
  const [optimizationMode, setOptimizationMode] = useState<SolverOptimizationMode>(
    hasSpellScaling ? 'SP' : 'AR'
  );

  // Manual stat overrides for "fixed" mode
  // Initialize with optimal stats from solver if available, otherwise use current stats
  const [fixedStats, setFixedStats] = useState<CharacterStats>(() => {
    if (initialOptimalStats) {
      return {
        ...currentStats,
        str: initialOptimalStats.str ?? currentStats.str,
        dex: initialOptimalStats.dex ?? currentStats.dex,
        int: initialOptimalStats.int ?? currentStats.int,
        fai: initialOptimalStats.fai ?? currentStats.fai,
        arc: initialOptimalStats.arc ?? currentStats.arc,
      };
    }
    return { ...currentStats };
  });

  // Get full class data for budget calculation
  // Falls back to Wretch (the base class with 10 in all stats) when no starting class is selected
  const classData = useMemo(() => {
    return INITIAL_CLASS_VALUES[startingClass ?? 'Wretch'];
  }, [startingClass]);

  // Calculate class minimums for damage stats
  const classMinMap = useMemo(() => {
    return {
      str: classData.str,
      dex: classData.dex,
      int: classData.int,
      fai: classData.fai,
      arc: classData.arc,
    };
  }, [classData]);

  // Compute investment path for the weapon (used for scaling curve markers)
  // This provides consistent optimal stats at each budget level
  // Note: classData uses 'min' for mnd, so we convert to CharacterStats format
  const investmentBaseStats = useMemo((): CharacterStats => ({
    vig: classData.vig,
    mnd: classData.min,
    end: classData.end,
    str: classData.str,
    dex: classData.dex,
    int: classData.int,
    fai: classData.fai,
    arc: classData.arc,
  }), [classData]);

  const { getOptimalStatsAtBudget } = useInvestmentPath({
    precomputed,
    weapon,
    baseStats: investmentBaseStats,
    twoHanding,
    optimizationMode,
  });

  // Local level state for optimal mode (defaults to parent level)
  const [detailLevel, setDetailLevel] = useState<number>(parentLevel);

  // Calculate implied level in Fixed mode based on damage stat investments
  // Formula: starting level + sum of (current damage stat - class base damage stat)
  const calculatedFixedLevel = useMemo(() => {
    const damageStatInvestment = DAMAGE_STATS.reduce((sum, stat) => {
      return sum + (fixedStats[stat] - classData[stat]);
    }, 0);
    const survivalStatInvestment =
      (currentStats.vig - classData.vig) +
      (currentStats.mnd - classData.min) +
      (currentStats.end - classData.end);
    return classData.lvl + damageStatInvestment + survivalStatInvestment;
  }, [classData, fixedStats, currentStats]);

  // Calculate points budget for damage stats (matching App.tsx formula)
  // Formula: classTotal - classLvl + currentLvl - vig - end - mnd
  // This gives total stat points available for damage stats (including class base)
  const calculatedBudget = useMemo(() => {
    const vig = currentStats.vig;
    const mnd = currentStats.mnd;
    const end = currentStats.end;
    return classData.total - classData.lvl + detailLevel - vig - end - mnd;
  }, [classData, detailLevel, currentStats]);

  // Solver worker for off-main-thread optimization
  const { isReady: solverReady, isCalculating, findOptimalStats } = useSolverWorker({ precomputed, aowData });

  // Store optimal stats in state (computed async by worker)
  const [optimalStatsForBudget, setOptimalStatsForBudget] = useState<CharacterStats | null>(null);

  // Track if we should show the optimizing indicator
  const isOptimizing = isCalculating;

  // Track whether we should run the local solver for this weapon
  // In Fixed mode: only when "Optimal" sub-mode is selected
  // In Solver mode: always run to compute optimal stats for the local detailLevel
  const shouldRunLocalSolver = (isOptimalMode && !hasUnlockedStats) || hasUnlockedStats;

  // Calculate optimal stats async when dependencies change
  useEffect(() => {
    // Skip if not in a mode that needs local solving, no starting class, or worker not ready
    if (!shouldRunLocalSolver || !startingClass || !solverReady) {
      if (!shouldRunLocalSolver) {
        // Don't clear stats when switching modes - preserves last computed value
        return;
      }
      setOptimalStatsForBudget(null);
      return;
    }

    let cancelled = false;

    // In SP mode, lock stats that don't contribute to spell scaling to their class minimum.
    // This prevents the solver from wasting budget on non-contributing stats.
    const damageStatConfig = (stat: 'str' | 'dex' | 'int' | 'fai' | 'arc'): StatConfig => {
      if (optimizationMode === 'SP' && spellScalingStats.size > 0 && !spellScalingStats.has(stat)) {
        return { min: classMinMap[stat], max: classMinMap[stat] };
      }
      return { min: classMinMap[stat], max: 99 };
    };

    const optimizerStatConfigs: Record<string, StatConfig> = {
      vig: { min: currentStats.vig, max: currentStats.vig },
      mnd: { min: currentStats.mnd, max: currentStats.mnd },
      end: { min: currentStats.end, max: currentStats.end },
      str: damageStatConfig('str'),
      dex: damageStatConfig('dex'),
      int: damageStatConfig('int'),
      fai: damageStatConfig('fai'),
      arc: damageStatConfig('arc'),
    };

    findOptimalStats({
      weaponName: weapon.name,
      affinity: weapon.affinity,
      upgradeLevel: weapon.upgradeLevel,
      statConfigs: optimizerStatConfigs,
      options: { twoHanding, pointsBudget: Math.max(0, calculatedBudget), optimizationMode },
    })
      .then((result) => {
        if (!cancelled && result) {
          setOptimalStatsForBudget(result.stats);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Solver error:', error);
        }
      });

    return () => {
      cancelled = true;
    };
    // Note: classMinMap is intentionally excluded - its values are derived from startingClass
  }, [shouldRunLocalSolver, startingClass, solverReady, weapon.name, weapon.affinity, weapon.upgradeLevel, twoHanding, calculatedBudget, currentStats, findOptimalStats, classMinMap, optimizationMode, spellScalingStats]);

  // The displayed stats depend on the mode
  // In Fixed mode: use optimal stats when in Optimal sub-mode, otherwise use fixedStats
  // In Solver mode: always use optimal stats (computed for local detailLevel)
  const displayedStats = shouldRunLocalSolver && optimalStatsForBudget ? optimalStatsForBudget : fixedStats;

  // Calculate current investment budget (points invested in damage stats from base)
  // Used to get optimal stats for the scaling curve markers
  const currentInvestmentBudget = useMemo(() => {
    return DAMAGE_STATS.reduce((sum, stat) => {
      return sum + Math.max(0, displayedStats[stat] - classData[stat]);
    }, 0);
  }, [displayedStats, classData]);

  // Get optimal stats at current budget for scaling curve markers
  const optimalStatsForMarkers = useMemo(() => {
    return getOptimalStatsAtBudget(currentInvestmentBudget);
  }, [getOptimalStatsAtBudget, currentInvestmentBudget]);

  // Reset optimization mode when weapon spell scaling changes
  useEffect(() => {
    setOptimizationMode(hasSpellScaling ? 'SP' : 'AR');
  }, [hasSpellScaling, weapon.name, weapon.affinity]);

  // Reset when weapon, current stats, or initial optimal stats change
  useEffect(() => {
    const newStats = initialOptimalStats
      ? {
        ...currentStats,
        str: initialOptimalStats.str ?? currentStats.str,
        dex: initialOptimalStats.dex ?? currentStats.dex,
        int: initialOptimalStats.int ?? currentStats.int,
        fai: initialOptimalStats.fai ?? currentStats.fai,
        arc: initialOptimalStats.arc ?? currentStats.arc,
      }
      : { ...currentStats };
    setFixedStats(newStats);
    if (hasUnlockedStats) {
      setDetailLevel(parentLevel);
    } else {
      // In fixed mode, compute implied level from all stat investments
      const damageStatInvestment = DAMAGE_STATS.reduce((sum, stat) => {
        return sum + (newStats[stat] - classData[stat]);
      }, 0);
      const survivalStatInvestment =
        (currentStats.vig - classData.vig) +
        (currentStats.mnd - classData.min) +
        (currentStats.end - classData.end);
      setDetailLevel(classData.lvl + damageStatInvestment + survivalStatInvestment);
    }
    setIsOptimalMode(false);
  }, [currentStats, weapon.name, weapon.affinity, parentLevel, initialOptimalStats, hasUnlockedStats, classData]);

  // Handler for stat input changes - allows typing any value
  const handleStatChange = (stat: DamageStat, value: number) => {
    setFixedStats(prev => ({ ...prev, [stat]: value }));
  };

  // Handler for stat input blur - clamps to valid range
  // Reset to current character stats
  const handleResetStats = () => {
    setFixedStats({ ...currentStats });
    // Compute level from currentStats (what we're resetting to)
    const damageStatInvestment = DAMAGE_STATS.reduce((sum, stat) => {
      return sum + (currentStats[stat] - classData[stat]);
    }, 0);
    const survivalStatInvestment =
      (currentStats.vig - classData.vig) +
      (currentStats.mnd - classData.min) +
      (currentStats.end - classData.end);
    setDetailLevel(classData.lvl + damageStatInvestment + survivalStatInvestment);
    setIsOptimalMode(false);
  };

  // AoW selection state
  const [selectedAow, setSelectedAow] = useState<string | null>(null);
  // Selected attack for scaling curve
  const [selectedAttack, setSelectedAttack] = useState<AowAttackResult | null>(null);
  // Show motion/bullet breakdown in attack table
  const [showAowBreakdown, setShowAowBreakdown] = useState(false);
  // Selected animation ID from clicking an attack
  const [selectedAnimationId, setSelectedAnimationId] = useState<string | null>(null);
  // Animation data for inline display
  const [inlineAnimationData, setInlineAnimationData] = useState<AnimationEventData | null>(null);
  const [inlineAnimationLoading, setInlineAnimationLoading] = useState(false);
  const [inlineAnimationError, setInlineAnimationError] = useState<string | null>(null);

  // Handle attack row click to show animation inline
  const handleAttackClick = useCallback(async (attackType: number) => {
    const animationId = getAnimationId(weapon.wepmotionCategory, attackType);
    if (!animationId) {
      setInlineAnimationError('No animation mapping for this attack type');
      return;
    }

    // If clicking the same animation, toggle it off
    if (selectedAnimationId === animationId) {
      setSelectedAnimationId(null);
      setInlineAnimationData(null);
      return;
    }

    setSelectedAnimationId(animationId);
    setInlineAnimationLoading(true);
    setInlineAnimationError(null);

    try {
      const data = await fetchAnimationData(animationId);
      setInlineAnimationData(data);
    } catch (err) {
      setInlineAnimationError(err instanceof Error ? err.message : 'Failed to load animation');
      setInlineAnimationData(null);
    } finally {
      setInlineAnimationLoading(false);
    }
  }, [weapon.wepmotionCategory, selectedAnimationId]);

  // Reset animation selection when weapon changes
  useEffect(() => {
    setSelectedAnimationId(null);
    setInlineAnimationData(null);
    setInlineAnimationError(null);
  }, [weapon.name, weapon.affinity]);

  // Check if this is a unique weapon (cannot mount AoWs)
  const isUniqueWeapon = useMemo(() => {
    return !canWeaponMountAoW(precomputed, weapon.name);
  }, [precomputed, weapon.name]);

  // Get the built-in skill name for unique weapons
  const uniqueSkillName = useMemo(() => {
    if (!isUniqueWeapon || !aowData) return null;
    return getWeaponSkillName(aowData, precomputed, weapon.name);
  }, [aowData, precomputed, weapon.name, isUniqueWeapon]);

  // Reset AoW selection when weapon or affinity changes
  // For unique weapons, auto-select their built-in skill
  // If defaultAow is provided (from filter), pre-select it
  useEffect(() => {
    if (isUniqueWeapon && uniqueSkillName) {
      setSelectedAow(uniqueSkillName);
    } else if (defaultAow) {
      // Pre-select the AoW from the filter
      setSelectedAow(defaultAow);
    } else {
      setSelectedAow(null);
    }
    setSelectedAttack(null);
  }, [weapon.name, weapon.affinity, isUniqueWeapon, uniqueSkillName, defaultAow]);

  // Reset selected attack when AoW changes
  useEffect(() => {
    setSelectedAttack(null);
  }, [selectedAow]);

  // Calculate AoW damage when an AoW is selected (uses override stats)
  const aowResult = useMemo<AowCalculatorResult | null>(() => {
    if (!aowData || !selectedAow) return null;

    const calcStats = toCalculatorStats(displayedStats);

    return calculateAowDamage(
      aowData,
      precomputed,
      {
        weaponName: weapon.name,
        affinity: weapon.affinity,
        upgradeLevel: weapon.upgradeLevel,
        weaponClass: weapon.categoryName,
        strength: calcStats.strength,
        dexterity: calcStats.dexterity,
        intelligence: calcStats.intelligence,
        faith: calcStats.faith,
        arcane: calcStats.arcane,
        twoHanding,
        ignoreRequirements: false,
        pvpMode: false,
        showLackingFp: false,
        aowName: selectedAow,
      }
    );
  }, [aowData, selectedAow, displayedStats, weapon, twoHanding, precomputed]);

  // Fetch weapon attacks on demand
  const [weaponAttacks, setWeaponAttacks] = useState<WeaponAttack[]>([]);
  const [attacksLoading, setAttacksLoading] = useState(true);
  const [attacksError, setAttacksError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAttacksLoading(true);
    setAttacksError(null);

    fetchWeaponAttacks(weapon.name).then(result => {
      if (!cancelled) {
        setWeaponAttacks(result.attacks);
        setAttacksError(result.error);
        setAttacksLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [weapon.name]);

  // Load animation users data (for per-attack sharing counts)
  const [animationUsers, setAnimationUsers] = useState<AnimationUsersData | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAnimationUsers().then(data => {
      if (!cancelled) {
        setAnimationUsers(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate AR with displayed stats (memoized to avoid recalculating on unrelated re-renders)
  const arResult = useMemo(() => calculateWeaponAR(
    precomputed,
    weapon.name,
    weapon.affinity,
    weapon.upgradeLevel,
    displayedStats,
    { twoHanding }
  ), [precomputed, weapon.name, weapon.affinity, weapon.upgradeLevel, displayedStats, twoHanding]);

  // Calculate marginal gains for each stat (based on displayed stats)
  // In SP mode, computes spell power gains instead of AR gains
  const statGains = useStatGains({
    precomputed,
    weaponName: weapon.name,
    affinity: weapon.affinity,
    upgradeLevel: weapon.upgradeLevel,
    stats: displayedStats,
    twoHanding,
    optimizationMode,
  });

  return (
    <div className="flex flex-col gap-3 md:gap-5">
      {/* Stats Section with Optimal/Fixed toggle */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-[#6a6a6a] text-xs uppercase tracking-wider">Stats</span>
            {/* Mode toggle - only shown when not in solver mode */}
            {!hasUnlockedStats && startingClass && (
              <ToggleGroup
                type="single"
                value={isOptimalMode ? 'optimal' : 'fixed'}
                onValueChange={(v) => {
                  if (!v) return;
                  if (v === 'optimal') {
                    setDetailLevel(calculatedFixedLevel);
                    setIsOptimalMode(true);
                  } else {
                    setIsOptimalMode(false);
                  }
                }}
                variant="subtle"
                size="xs"
                className="bg-[#0a0a0a] rounded border border-[#2a2a2a] p-0.5"
              >
                <ToggleGroupItem value="fixed" className="text-[10px]">
                  Fixed
                </ToggleGroupItem>
                <ToggleGroupItem value="optimal" className="text-[10px]">
                  Optimal
                </ToggleGroupItem>
              </ToggleGroup>
            )}

            {/* AR/SP optimization mode toggle - shown for catalysts */}
            {hasSpellScaling && (
              <ToggleGroup
                type="single"
                value={optimizationMode}
                onValueChange={(v) => { if (v) setOptimizationMode(v as SolverOptimizationMode); }}
                variant="subtle"
                size="xs"
                className="bg-[#0a0a0a] rounded border border-[#2a2a2a] p-0.5"
              >
                <ToggleGroupItem value="AR" className="text-[10px]">
                  AR
                </ToggleGroupItem>
                <ToggleGroupItem value="SP" className="text-[10px]">
                  SP
                </ToggleGroupItem>
              </ToggleGroup>
            )}

            {/* Level display/input - calculated in Fixed mode, editable in Optimal mode */}
            {!hasUnlockedStats && startingClass && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#6a6a6a]">Level:</span>
                <NumericInput
                  min={classData.lvl}
                  max={713}
                  fallback={classData.lvl}
                  value={isOptimalMode ? detailLevel : calculatedFixedLevel}
                  disabled={!isOptimalMode}
                  onValueChange={setDetailLevel}
                  className={`w-14 text-center text-base md:text-xs py-0.5 px-1 rounded border bg-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#d4af37] ${isOptimalMode
                    ? 'border-[#2a2a2a] text-[#c8c8c8]'
                    : 'border-[#1a1a1a] text-[#6a6a6a] cursor-not-allowed'
                    }`}
                />
                {isOptimalMode && (
                  <span className="text-[10px] text-[#6a6a6a]">(+{detailLevel - classData.lvl} pts)</span>
                )}
              </div>
            )}

            {/* Level input for solver mode - editable to explore different levels locally */}
            {hasUnlockedStats && startingClass && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#6a6a6a]">Level:</span>
                <NumericInput
                  min={classData.lvl}
                  max={713}
                  fallback={classData.lvl}
                  value={detailLevel}
                  onValueChange={setDetailLevel}
                  className="w-14 text-center text-base md:text-xs py-0.5 px-1 rounded border bg-[#0a0a0a] border-[#2a2a2a] text-[#c8c8c8] focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
                />
                <span className="text-[10px] text-[#6a6a6a]">(+{detailLevel - classData.lvl} pts)</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {/* Reset button - only shown in Fixed mode */}
            {!hasUnlockedStats && !isOptimalMode && (() => {
              const isAtOriginal = DAMAGE_STATS.every(stat => displayedStats[stat] === currentStats[stat]);
              return (
                <button
                  onClick={handleResetStats}
                  disabled={isAtOriginal}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${isAtOriginal
                    ? 'border-[#222] bg-[#0a0a0a] text-[#4a4a4a] cursor-not-allowed'
                    : 'border-[#2a2a2a] bg-[#1a1a1a] text-[#8b8b8b] hover:text-[#c8c8c8] hover:border-[#3a3a3a]'
                    }`}
                >
                  Reset
                </button>
              );
            })()}
          </div>
        </div>
        {/* VIG, MND, END display - as disabled inputs */}
        <div className="grid grid-cols-5 gap-2 mb-2">
          {(['vig', 'mnd', 'end'] as const).map((stat) => {
            const value = currentStats[stat];
            return (
              <div key={stat} className="flex flex-col items-center gap-1">
                <label className="text-xs uppercase tracking-wider text-[#6a6a6a]">
                  {stat}
                </label>
                <input
                  type="number"
                  value={value}
                  disabled
                  className="w-full text-center text-base md:text-sm py-1.5 px-2 rounded border bg-[#0a0a0a] border-[#1a1a1a] text-[#6a6a6a] cursor-not-allowed"
                />
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-5 gap-2">

          {DAMAGE_STATS.map((stat) => {
            const value = displayedStats[stat];
            const originalValue = currentStats[stat];
            const classMin = classMinMap[stat];
            const weaponReq = weapon.requirements[stat];
            const isModified = value !== originalValue;
            const isBelowClassMin = value < classMin;
            const isBelowWeaponReq = value < weaponReq;
            const gain = statGains.gainByStat[stat] ?? 0;
            const isBest = statGains.bestStat === stat;
            const isDisabled = isOptimalMode;
            return (
              <div key={stat} className="flex flex-col items-center gap-1">
                <label
                  htmlFor={`stat-${stat}`}
                  className={`text-xs uppercase tracking-wider ${isBelowClassMin ? 'text-error' : isBest ? 'text-[#4ade80]' : isModified ? 'text-[#c8c8c8]' : 'text-[#6a6a6a]'}`}
                >
                  {stat}
                </label>
                <NumericInput
                  id={`stat-${stat}`}
                  min={1}
                  max={99}
                  fallback={1}
                  value={value}
                  disabled={isDisabled}
                  onValueChange={(v) => handleStatChange(stat, v)}
                  className={`w-full text-center text-base md:text-sm py-1.5 px-2 rounded border bg-[#0a0a0a] focus:outline-none ${isDisabled
                    ? 'border-[#1a1a1a] text-[#6a6a6a] cursor-not-allowed'
                    : isBelowClassMin
                      ? 'input-error text-error'
                      : 'border-[#2a2a2a] text-[#c8c8c8] focus:ring-1 focus:ring-[#d4af37]'
                    }`}
                />
                {isBelowClassMin && !isDisabled && (
                  <span className="text-[9px] text-error">Min: {classMin}</span>
                )}
                {/* AR gain per point */}
                <span className={`text-[10px] ${isBest ? 'text-[#4ade80] font-medium' : gain > 0 ? 'text-[#6a6a6a]' : 'text-[#3a3a3a]'}`}>
                  {gain > 0 ? `+${gain.toFixed(2)}` : '—'}
                </span>
                {/* Weapon requirement indicator */}
                {weaponReq > 0 && (
                  <span className={`text-[10px] ${isBelowWeaponReq ? 'text-error' : 'text-[#6a6a6a]'}`}>
                    Req: {weaponReq}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Damage Breakdown */}
      {arResult && (() => {
        const primaryAttackAttribute = weapon.damageType !== '-' ? weapon.damageType : 'Standard';
        return (
          <DamageBreakdown
              precomputed={precomputed}
              weapon={weapon}
              stats={displayedStats}
              twoHanding={twoHanding}
              statGains={statGains.gainByStat}
              selectedEnemy={selectedEnemy}
              attackAttribute={primaryAttackAttribute}
              optimizationMode={optimizationMode}
            />
        );
      })()}

      {/* Scaling Curves - AR mode shows damage scaling, SP mode shows spell scaling */}
      {/* Only pass optimalStats for markers when displayed stats match the optimal allocation
          (Optimal sub-mode or solver mode). In Fixed mode, user manually sets stats so markers
          should reflect their actual input, not the investment path's optimal allocation. */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
        {optimizationMode === 'SP' && hasSpellScaling ? (
            <SpellScalingCurve
              precomputed={precomputed}
              weapon={weapon}
              currentStats={displayedStats}
              twoHanding={twoHanding}
              optimalStats={shouldRunLocalSolver ? (optimalStatsForMarkers ?? undefined) : undefined}
            />
        ) : (
            <ScalingCurve
              precomputed={precomputed}
              weapon={weapon}
              currentStats={displayedStats}
              twoHanding={twoHanding}
              optimalStats={shouldRunLocalSolver ? (optimalStatsForMarkers ?? undefined) : undefined}
            />
        )}
      </div>

      {/* Optimal Investment Path */}
      {startingClass && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
            <OptimalInvestmentChart
              precomputed={precomputed}
              weapon={weapon}
              currentStats={displayedStats}
              twoHanding={twoHanding}
              baseStats={{
                vig: classData.vig,
                mnd: classData.min,
                end: classData.end,
                str: classData.str,
                dex: classData.dex,
                int: classData.int,
                fai: classData.fai,
                arc: classData.arc,
              }}
              optimizationMode={optimizationMode}
            />
        </div>
      )}

      {/* Catalyst Comparison (only in SP mode for catalysts) */}
      {optimizationMode === 'SP' && hasSpellScaling && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
            <CatalystComparisonChart
              precomputed={precomputed}
              weapon={weapon}
              currentStats={displayedStats}
              allWeapons={allWeapons}
            />
        </div>
      )}

      {/* Affinity Comparison Chart */}
      {startingClass && (
        <Suspense fallback={null}>
            <AffinityComparisonChart
              precomputed={precomputed}
              weapon={weapon}
              currentStats={displayedStats}
              twoHanding={twoHanding}
              baseStats={investmentBaseStats}
              selectedEnemy={selectedEnemy}
            />
        </Suspense>
      )}

      {/* Ash of War / Weapon Skill Section (hidden in SP mode) */}
      {optimizationMode !== 'SP' && aowData && (!isUniqueWeapon || uniqueSkillName) && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs">
              {isUniqueWeapon ? 'Weapon Skill' : 'Ash of War'}
            </h3>
            <button
              onClick={() => setShowAowBreakdown(!showAowBreakdown)}
              className={`text-xs px-2 py-1 rounded transition-colors ${showAowBreakdown
                ? 'bg-[#2a2a1a] text-[#d4af37] border border-[#d4af37]/30'
                : 'bg-[#1a1a1a] text-[#6a6a6a] border border-[#2a2a2a] hover:text-[#8b8b8b]'
                }`}
            >
              Breakdown
            </button>
          </div>
          <AshOfWarSelector
            aowData={aowData}
            precomputed={precomputed}
            weaponName={weapon.name}
            weaponClass={weapon.categoryName}
            affinity={weapon.affinity}
            selectedAow={selectedAow}
            onSelect={setSelectedAow}
          />

          {/* AoW Attack Table */}
          {aowResult && aowResult.attacks.length > 0 && (
            <div className="mt-4">
              <AshAttackTable
                attacks={aowResult.attacks}
                aowName={aowResult.aowName}
                selectedAttack={selectedAttack}
                onSelectAttack={setSelectedAttack}
                showBreakdown={showAowBreakdown}
                selectedEnemy={selectedEnemy}
              />
              <p className="text-[#6a6a6a] text-xs mt-2 italic">
                Click a row to view damage scaling curve
              </p>
            </div>
          )}

          {/* AoW Scaling Curve - shown when an attack is selected */}
          {selectedAow && selectedAttack && (
            <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                <AoWScalingCurve
                  precomputed={precomputed}
                  aowData={aowData}
                  weapon={weapon}
                  currentStats={displayedStats}
                  twoHanding={twoHanding}
                  aowName={selectedAow}
                  selectedAttack={selectedAttack}
                />
                </div>
          )}

          {/* AoW with no attacks message */}
          {selectedAow && aowResult && aowResult.attacks.length === 0 && (
            <div className="mt-4 text-[#6a6a6a] text-sm italic">
              No attack data available for this Ash of War
            </div>
          )}
        </div>
      )}


      {/* Status Effects (if any, hidden in SP mode) */}
      {optimizationMode !== 'SP' && arResult && statusEffectConfig.some(({ key }) => arResult[key as StatusEffectKey].rounded > 0) && (() => {
        // Get active status effects
        const activeEffects = statusEffectConfig
          .map(({ key, label, color }) => ({
            key,
            label,
            color,
            effect: arResult[key as StatusEffectKey] as StatusEffectResult,
          }))
          .filter(({ effect }) => effect.rounded > 0);

        return (
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
            <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-3">Status Effects</h3>
            <table className="w-full">
              <thead>
                <tr className="text-[#6a6a6a] text-[10px] uppercase tracking-wider">
                  <th className="text-left pb-2 font-normal">Effect</th>
                  <th className="text-right pb-2 font-normal">Base</th>
                  <th className="text-right pb-2 font-normal">Scale</th>
                  <th className="text-right pb-2 font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {activeEffects.map(({ key, label, color, effect }) => (
                  <tr key={key} className="border-t border-[#2a2a2a]">
                    <td className="py-2 font-medium" style={{ color }}>{label}</td>
                    <td className="py-2 text-right text-[#c8c8c8]">{Math.round(effect.base)}</td>
                    <td className="py-2 text-right text-[#9370db]">{Math.round(effect.scaling)}</td>
                    <td className="py-2 text-right text-lg font-medium" style={{ color }}>{effect.rounded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Status Effect Scaling Curve (if any status effects scale with arcane, hidden in SP mode) */}
      {optimizationMode !== 'SP' && (
          <StatusEffectScalingCurve
            precomputed={precomputed}
            weapon={weapon}
            currentStats={displayedStats}
            twoHanding={twoHanding}
            optimalStats={shouldRunLocalSolver ? (optimalStatsForMarkers ?? undefined) : undefined}
          />
      )}

      {/* Guard Stats (hidden in SP mode) */}
      {optimizationMode !== 'SP' && (
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs">Guard Stats</h3>
          <div className="flex items-center gap-2">
            <span className="text-[#6a6a6a] text-xs">Guard Boost</span>
            <span className="text-[#c8c8c8] text-lg font-semibold">{weapon.guardStats.guardBoost}</span>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider">
              {[
                { key: 'physical', label: 'Phys', color: '#9a9a9a' },
                { key: 'magic', label: 'Magic', color: '#5bc0de' },
                { key: 'fire', label: 'Fire', color: '#f0ad4e' },
                { key: 'lightning', label: 'Ltn', color: '#f4e04d' },
                { key: 'holy', label: 'Holy', color: '#d4af37' },
              ].map(({ key, label, color }) => (
                <th key={key} className="text-center pb-2 font-normal" style={{ color }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#2a2a2a]">
              {[
                { key: 'physical', value: weapon.guardStats.physical },
                { key: 'magic', value: weapon.guardStats.magic },
                { key: 'fire', value: weapon.guardStats.fire },
                { key: 'lightning', value: weapon.guardStats.lightning },
                { key: 'holy', value: weapon.guardStats.holy },
              ].map(({ key, value }) => (
                <td key={key} className="py-3 text-center">
                  <span className="text-[#c8c8c8] font-medium">{value.toFixed(1)}%</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      )}

      {/* Weapon Attacks Section (hidden in SP mode) */}
      {optimizationMode !== 'SP' && (attacksLoading || attacksError || weaponAttacks.length > 0) && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs">
              Weapon Attacks
            </h3>
            {/* Enemy name display */}
            {selectedEnemy && (
              <div className="flex items-center justify-end gap-2 text-[#e06666]">
                <Skull className="w-3 h-3" />
                <span className="text-xs font-medium">{selectedEnemy.name}</span>
              </div>
            )}
          </div>
          {attacksLoading ? (
            <div className="text-[#6a6a6a] text-sm italic">Loading attacks...</div>
          ) : attacksError ? (
            <div className="text-[#c9302c] text-sm">{attacksError}</div>
          ) : (
            <>
                <WeaponAttacksTable
                  attacks={weaponAttacks}
                  twoHanding={twoHanding}
                  selectedEnemy={selectedEnemy ?? null}
                  weaponAR={arResult ? {
                    physical: arResult.physical.total,
                    magic: arResult.magic.total,
                    fire: arResult.fire.total,
                    lightning: arResult.lightning.total,
                    holy: arResult.holy.total,
                  } : null}
                  onAttackClick={handleAttackClick}
                  wepmotionCategory={weapon.wepmotionCategory}
                  currentWeaponName={weapon.name}
                  precomputed={precomputed}
                  onWeaponSelect={onWeaponSelect}
                  allWeapons={allWeapons}
                  animationUsers={animationUsers ?? undefined}
                />
                  <p className="text-[#6a6a6a] text-xs mt-2 italic">
                Click a row to view animation timeline. Click the sharing count to see weapons with the same attack.
              </p>
            </>
          )}

          {/* Inline Animation Timeline - shown when an attack is selected */}
          {inlineAnimationLoading && (
            <div className="mt-4 pt-4 border-t border-[#2a2a2a] flex items-center gap-2 text-[#8b8b8b]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading animation data...</span>
            </div>
          )}

          {inlineAnimationError && !inlineAnimationLoading && (
            <div className="mt-4 pt-4 border-t border-[#2a2a2a] text-[#c9302c] text-sm">
              {inlineAnimationError}
            </div>
          )}

          {inlineAnimationData && !inlineAnimationLoading && !inlineAnimationError && (
            <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[#d4af37] text-sm font-medium">
                  {inlineAnimationData.name}
                </h4>
                <span className="text-[#6a6a6a] text-xs">
                  {inlineAnimationData.maxFrame} frames
                </span>
              </div>
              <AnimationTimeline animation={inlineAnimationData} />

              {/* Related Weapons Section */}
              <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                <RelatedWeaponsPanel
                  wepmotionCategory={weapon.wepmotionCategory}
                  currentWeaponName={weapon.name}
                  precomputed={precomputed}
                  upgradeLevel={weapon.upgradeLevel}
                  onWeaponSelect={onWeaponSelect}
                  allWeapons={allWeapons}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weapon DPS Section (hidden in SP mode) */}
      {optimizationMode !== 'SP' && arResult && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs">
              Attack DPS
            </h3>
            {selectedEnemy && (
              <div className="flex items-center justify-end gap-2 text-[#e06666]">
                <Skull className="w-3 h-3" />
                <span className="text-xs font-medium">{selectedEnemy.name}</span>
              </div>
            )}
          </div>
            <WeaponDpsTable
              weaponName={weapon.name}
              totalAR={arResult.rounded}
              twoHanding={twoHanding}
              weaponAR={{
                physical: arResult.physical.total,
                magic: arResult.magic.total,
                fire: arResult.fire.total,
                lightning: arResult.lightning.total,
                holy: arResult.holy.total,
              }}
              attackAttribute={weapon.damageType !== '-' ? weapon.damageType : 'Standard'}
              selectedEnemy={selectedEnemy}
            />
        </div>
      )}

      {/* Weapon Combos Section (hidden in SP mode) */}
      {optimizationMode !== 'SP' && weaponAttacks.length > 0 && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-lg p-5">
          <h3 className="text-[#8b8b8b] uppercase tracking-wider text-xs mb-3">
            Attack Combos
          </h3>
            <WeaponCombosTable
              weaponName={weapon.name}
              twoHanding={twoHanding}
            />
          <p className="text-[#6a6a6a] text-xs mt-2 italic">
            Click a combo to view frame data details
          </p>
        </div>
      )}

      {/* Animation Browser Drawer functionality removed as requested */}

    </div>
  );
}
