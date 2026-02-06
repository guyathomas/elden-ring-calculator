import { useState, useEffect, useMemo, useDeferredValue, useCallback, Profiler } from 'react';
import { WeaponList } from './components/WeaponList.js';
import { WeaponDetailPanel } from './components/WeaponDetailPanel.js';

import { Sidebar } from './components/Sidebar.js';
import { useIsMobile } from './components/ui/use-mobile.js';
import { startTiming, timeSync, printDiagnostics, onRenderCallback } from './utils/diagnostics.js';

import type { StatConfig, CharacterStats, WeaponListItem, PrecomputedDataV2, StartingClass } from './types.js';
import { INITIAL_CLASS_VALUES, WEAPON_SKILL_FILTER, isStatLocked, getStatValue } from './types.js';
import type { FilterValue } from './components/ui/column-filter.js';
import { getDefaultFilters } from './components/ui/active-filter-chips.js';
import type { SolverOptimizationMode } from './types/solverTypes.js';
import type { PrecomputedAowData, EnemyData } from './data/index.js';
import { loadPrecomputedData, loadAowData, getEnemyByKey, getAvailableAowNames, canWeaponMountAoW, getWeaponSkillName } from './data/index.js';
import { buildWeaponList, findOptimalStats } from './utils/damageCalculator.js';
import type { RollType } from './utils/equipLoad.js';
import { Github, Menu } from 'lucide-react';
import { useWeaponQueryParam } from './hooks/useWeaponQueryParam.js';
import { useBuilds } from './hooks/useBuilds.js';

export default function App() {
  const isMobile = useIsMobile();

  // Build management
  const {
    builds,
    activeBuild,
    storageAvailable,
    createBuild,
    renameBuild,
    deleteBuild,
    setActiveBuild,
    toggleWeapon,
    isWeaponStarred,
    clearBuild,
  } = useBuilds();

  // Data loading state
  const [precomputed, setPrecomputed] = useState<PrecomputedDataV2 | null>(null);
  const [aowData, setAowData] = useState<PrecomputedAowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    const doneAll = startTiming('App data load (total)', 'data-load');
    Promise.all([loadPrecomputedData(), loadAowData()])
      .then(([weaponData, aowDataResult]) => {
        doneAll();
        setPrecomputed(weaponData);
        setAowData(aowDataResult);
        setLoading(false);
      })
      .catch((err) => {
        doneAll();
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const [startingClass, setStartingClass] = useState<StartingClass>('Vagabond');
  const [level, setLevel] = useState(INITIAL_CLASS_VALUES['Vagabond'].lvl);
  const [upgradeLevel, setUpgradeLevel] = useState<number>(25);
  const [twoHanding, setTwoHanding] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<SolverOptimizationMode>('AR');

  // Solver-specific state
  const [rollType, setRollType] = useState<RollType>('medium');
  const [armorWeight, setArmorWeight] = useState(30);
  const [subtractWeaponWeight, setSubtractWeaponWeight] = useState(false);

  // Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Column Visibility State
  const [showScaling, setShowScaling] = useState(true);
  const [showNumericalScaling, setShowNumericalScaling] = useState(false);
  const [showRequirements, setShowRequirements] = useState(true);
  const [showAttributeInvestments, setShowAttributeInvestments] = useState(false);  // Default to hidden
  const [showEfficiency, setShowEfficiency] = useState(true);
  const [showStatusEffects, setShowStatusEffects] = useState(true);
  const [showSpellPower, setShowSpellPower] = useState(true);
  const [showAowDamage, setShowAowDamage] = useState(true);
  const [showGuardStats, setShowGuardStats] = useState(false);  // Default to hidden
  const [showDps, setShowDps] = useState(false);  // Default to hidden
  const [showWeaponStats, setShowWeaponStats] = useState(false);  // Dmg, Wgt, TC, Buff, Uniq columns - default to hidden

  // Table grouping state
  const [groupBy, setGroupBy] = useState<'none' | 'weapon-type' | 'affinity' | 'weapon'>('none');

  // Enemy selector state
  const [selectedEnemyKey, setSelectedEnemyKey] = useState<string | null>(null);

  // Ash of War filter state
  const [selectedAowFilter, setSelectedAowFilter] = useState<string | null>(null);

  // Whether an AoW is selected in the filter
  const hasAowSelected = selectedAowFilter !== null;

  // Column filters state - shared between desktop table and mobile views
  const [columnFilters, setColumnFilters] = useState<Record<string, FilterValue>>(getDefaultFilters);

  // Helper to update a single column filter
  const updateColumnFilter = useCallback(
    (columnKey: string, value: FilterValue | undefined) => {
      setColumnFilters((prev) => {
        if (value === undefined) {
          const { [columnKey]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [columnKey]: value };
      });
    },
    [],
  );

  // Get enemy data from selected key
  const selectedEnemy = useMemo<EnemyData | null>(() => {
    if (!selectedEnemyKey) return null;
    return getEnemyByKey(selectedEnemyKey);
  }, [selectedEnemyKey]);

  // Initialize stats with Vagabond class defaults (the initial startingClass)
  // VIG/MND/END start as fixed (min === max), damage stats start as fixed too
  const initialClassData = INITIAL_CLASS_VALUES['Vagabond'];
  const [statConfigs, setStatConfigs] = useState<Record<string, StatConfig>>({
    vig: { min: initialClassData.vig, max: initialClassData.vig },
    mnd: { min: initialClassData.min, max: initialClassData.min },
    end: { min: initialClassData.end, max: initialClassData.end },
    str: { min: 30, max: 30 },
    dex: { min: 30, max: 30 },
    int: { min: 30, max: 30 },
    fai: { min: 30, max: 30 },
    arc: { min: 30, max: 30 },
  });

  // Handle class change - bump stats to class minimums if needed
  const handleStartingClassChange = (newClass: StartingClass) => {
    const classData = INITIAL_CLASS_VALUES[newClass];
    const statToClassKey: Record<string, keyof typeof classData> = {
      vig: 'vig', mnd: 'min', end: 'end', str: 'str', dex: 'dex', int: 'int', fai: 'fai', arc: 'arc'
    };

    setStatConfigs(prev => {
      const updated = { ...prev };
      for (const [stat, classKey] of Object.entries(statToClassKey)) {
        const classMin = classData[classKey];
        const config = prev[stat];

        if (config.min < classMin) {
          updated[stat] = { min: classMin, max: Math.max(config.max, classMin) };
        }
      }
      return updated;
    });

    setStartingClass(newClass);
  };

  // Build weapon list from precomputed data
  const weapons = useMemo(() => {
    if (!precomputed) return [];
    return timeSync('buildWeaponList', 'memo', () => buildWeaponList(precomputed, upgradeLevel));
  }, [precomputed, upgradeLevel]);

  // Extract unique categories and affinities for mobile filters
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    weapons.forEach(w => categories.add(w.categoryName));
    return Array.from(categories).sort();
  }, [weapons]);

  const availableAffinities = useMemo(() => {
    const affinities = new Set<string>();
    // Use "Unique" pseudo-affinity for unique weapons, matching WeaponListImproved behavior
    weapons.forEach(w => affinities.add(w.isUnique ? 'Unique' : w.affinity));
    return Array.from(affinities).sort();
  }, [weapons]);

  const availableDamageTypes = useMemo(() => {
    const types = new Set<string>();
    weapons.forEach(w => {
      if (w.damageType) types.add(w.damageType);
    });
    return Array.from(types).sort();
  }, [weapons]);

  // Status effect names for filtering
  const availableStatusEffects = ['Bleed', 'Frost', 'Poison', 'Scarlet Rot', 'Sleep', 'Madness'];

  // Selected weapon state synced with URL query parameters
  const [selectedWeapon, setSelectedWeapon] = useWeaponQueryParam(weapons);

  // Defer filter values for responsiveness
  const deferredAowFilter = useDeferredValue(selectedAowFilter);

  // Filter weapons by Ash of War compatibility (other filtering done in table)
  // Also filter out unique weapon affinity variants (they only work with Standard affinity)
  const filteredWeapons = useMemo(() => {
    return timeSync('filteredWeapons', 'memo', () => weapons.filter(weapon => {
      // Filter by Ash of War compatibility
      if (deferredAowFilter && aowData && precomputed) {
        if (deferredAowFilter === WEAPON_SKILL_FILTER) {
          // "Weapon Skill" filter: only show unique weapons that have a built-in skill
          if (!weapon.isUnique) return false;
          const skillName = getWeaponSkillName(aowData, precomputed, weapon.name);
          if (!skillName) return false;
        } else if (weapon.isUnique) {
          // For unique weapons, check if the built-in skill matches the selected AoW
          const skillName = getWeaponSkillName(aowData, precomputed, weapon.name);
          if (skillName !== deferredAowFilter) {
            return false;
          }
        } else {
          // For non-unique weapons, check if the AoW is available for this weapon class and affinity
          const availableAows = getAvailableAowNames(aowData, weapon.categoryName, weapon.affinity);
          if (!availableAows.includes(deferredAowFilter)) {
            return false;
          }
        }
      }

      // Filter out unique weapon affinity variants (they only work with Standard affinity)
      // The game data includes placeholder affinity variants for unique weapons that can't be used
      if (weapon.isUnique && weapon.affinity !== 'Standard') {
        return false;
      }

      return true;
    }));
  }, [weapons, deferredAowFilter, aowData, precomputed]);

  // Calculate points budget based on starting class and level
  // Formula: classTotal - classLvl + currentLvl - vig - end - mnd
  const pointsBudget = useMemo(() => {
    const classData = INITIAL_CLASS_VALUES[startingClass];
    const vig = getStatValue(statConfigs.vig);
    const mnd = getStatValue(statConfigs.mnd);
    const end = getStatValue(statConfigs.end);

    return classData.total - classData.lvl + level - vig - end - mnd;
  }, [startingClass, level, statConfigs]);

  // Calculate if any damage stats are unlocked (have a range, i.e. min !== max)
  const hasUnlockedStats = Object.entries(statConfigs)
    .filter(([key]) => ['str', 'dex', 'int', 'fai', 'arc'].includes(key))
    .some(([_, config]) => !isStatLocked(config));

  // Get current stats for calculations - memoized to maintain stable reference
  // Always uses the min value (the committed floor for each stat)
  const classData = INITIAL_CLASS_VALUES[startingClass];
  const currentStats = useMemo((): CharacterStats => {
    return {
      vig: getStatValue(statConfigs.vig),
      mnd: getStatValue(statConfigs.mnd),
      end: getStatValue(statConfigs.end),
      str: getStatValue(statConfigs.str),
      dex: getStatValue(statConfigs.dex),
      int: getStatValue(statConfigs.int),
      fai: getStatValue(statConfigs.fai),
      arc: getStatValue(statConfigs.arc),
    };
  }, [statConfigs]);

  const handleStatConfigChange = (stat: string, config: StatConfig) => {
    setStatConfigs(prev => ({ ...prev, [stat]: config }));
  };

  // Memoize weapon select handler to maintain stable reference for WeaponList memoization
  const handleWeaponSelect = useCallback((weapon: WeaponListItem) => {
    setSelectedWeapon(weapon);
  }, [setSelectedWeapon]);

  // Print diagnostics after initial data load + first render
  useEffect(() => {
    if (!loading && !error) {
      // Defer to allow the first render to complete before printing
      requestAnimationFrame(() => {
        printDiagnostics();
      });
    }
  }, [loading, error]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#e8e6e3] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-[#d4af37] text-2xl mb-4">Elden Ring Weapon Calculator (Beta)</h1>
          <p className="text-[#8b8b8b]">Loading weapon data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#e8e6e3] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-[#d4af37] text-2xl mb-4">Elden Ring Weapon Calculator (Beta)</h1>
          <p className="text-[#d9534f]">Error loading data: {error}</p>
          <p className="text-[#8b8b8b] mt-2 text-sm">
            Try running: npm run generate-data
          </p>
        </div>
      </div>
    );
  }

  return (
    <Profiler id="App" onRender={onRenderCallback}>
    <div className="h-screen bg-[#0a0a0a] text-[#e8e6e3] grid grid-rows-[auto_1fr]">
      <header className="border-b border-[#2a2a2a] bg-[#111111]">
        <div
          className="flex items-center justify-between"
          style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem' }}
        >
          {/* Mobile Menu Button - only show on mobile */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="relative p-2 hover:bg-[#2a2a2a] rounded text-[#8b8b8b] hover:text-[#e8e6e3] transition-colors mr-4"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex-1">
            <h1
              className="text-[#d4af37] tracking-wide"
              style={{ fontSize: isMobile ? '1rem' : '1.25rem' }}
            >
              Elden Ring Weapon Calculator (Beta)
            </h1>
          </div>
          <a
            href="https://github.com/guyathomas/elden-ring-calculator"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-[#2a2a2a] rounded text-[#8b8b8b] hover:text-[#e8e6e3] transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main
        className="overflow-hidden grid"
        style={{ gridTemplateColumns: isMobile ? '1fr' : '280px 1fr' }}
      >
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          showScaling={showScaling}
          setShowScaling={setShowScaling}
          showNumericalScaling={showNumericalScaling}
          setShowNumericalScaling={setShowNumericalScaling}
          showRequirements={showRequirements}
          setShowRequirements={setShowRequirements}
          showAttributeInvestments={showAttributeInvestments}
          setShowAttributeInvestments={setShowAttributeInvestments}
          showEfficiency={showEfficiency}
          setShowEfficiency={setShowEfficiency}
          showStatusEffects={showStatusEffects}
          setShowStatusEffects={setShowStatusEffects}
          showSpellPower={showSpellPower}
          setShowSpellPower={setShowSpellPower}
          showAowDamage={showAowDamage}
          setShowAowDamage={setShowAowDamage}
          showGuardStats={showGuardStats}
          setShowGuardStats={setShowGuardStats}
          showDps={showDps}
          setShowDps={setShowDps}
          showWeaponStats={showWeaponStats}
          setShowWeaponStats={setShowWeaponStats}
          groupBy={groupBy}
          setGroupBy={setGroupBy}

          // Stat Props
          level={level}
          setLevel={setLevel}
          startingClass={startingClass}
          setStartingClass={handleStartingClassChange}
          statConfigs={statConfigs}
          onStatConfigChange={handleStatConfigChange}
          twoHanding={twoHanding}
          onTwoHandingToggle={setTwoHanding}
          upgradeLevel={upgradeLevel}
          onUpgradeLevelChange={setUpgradeLevel}
          selectedEnemy={selectedEnemyKey}
          onEnemySelect={setSelectedEnemyKey}

          // Ash of War filter props
          aowData={aowData}
          selectedAowFilter={selectedAowFilter}
          onAowFilterSelect={setSelectedAowFilter}

          // Solver-specific props
          rollType={rollType}
          onRollTypeChange={setRollType}
          armorWeight={armorWeight}
          onArmorWeightChange={setArmorWeight}
          subtractWeaponWeight={subtractWeaponWeight}
          onSubtractWeaponWeightChange={setSubtractWeaponWeight}

          // Optimization mode props
          optimizationMode={optimizationMode}
          onOptimizationModeChange={setOptimizationMode}
          hasCatalystsSelected={true}
          hasAowSelected={hasAowSelected}

          // Column filters (shared between desktop and mobile)
          columnFilters={columnFilters}
          onColumnFilterChange={updateColumnFilter}
          // Available options
          availableCategories={availableCategories}
          availableAffinities={availableAffinities}
          availableDamageTypes={availableDamageTypes}
          availableStatusEffects={availableStatusEffects}
          // Build props
          builds={builds}
          activeBuild={activeBuild}
          storageAvailable={storageAvailable}
          onSelectBuild={setActiveBuild}
          onCreateBuild={createBuild}
          onRenameBuild={renameBuild}
          onDeleteBuild={deleteBuild}
          onClearBuild={clearBuild}
          onToggleWeapon={toggleWeapon}
          weapons={filteredWeapons}
          precomputed={precomputed}
          currentStats={currentStats}
          onWeaponSelect={handleWeaponSelect}
        />

        {/* Weapon List */}
        <div
          className="h-full overflow-auto min-w-0"
          style={{ padding: isMobile ? '0.75rem' : '1.5rem' }}
        >
          {precomputed && (
            <WeaponList
              precomputed={precomputed}
              aowData={aowData}
              weapons={filteredWeapons}
              statConfigs={statConfigs}
              currentStats={currentStats}
              selectedWeapon={selectedWeapon}
              onWeaponSelect={handleWeaponSelect}
              hasUnlockedStats={hasUnlockedStats}
              twoHanding={twoHanding}
              pointsBudget={pointsBudget}
              startingClass={startingClass}
              showScaling={showScaling}
              showNumericalScaling={showNumericalScaling}
              showRequirements={showRequirements}
              showAttributeInvestments={showAttributeInvestments}
              showEfficiency={showEfficiency}
              showStatusEffects={showStatusEffects}
              showSpellPower={showSpellPower}
              showAowDamage={showAowDamage}
              showGuardStats={showGuardStats}
              showDps={showDps}
              showWeaponStats={showWeaponStats}
              groupBy={groupBy}
              level={level}
              selectedEnemyKey={selectedEnemyKey}
              selectedAowFilter={selectedAowFilter}
              // Solver weight subtraction props
              subtractWeaponWeight={subtractWeaponWeight}
              armorWeight={armorWeight}
              rollType={rollType}
              // Optimization mode for solver
              optimizationMode={optimizationMode}
              // Column filters (shared between desktop and mobile)
              columnFilters={columnFilters}
              onColumnFilterChange={updateColumnFilter}
              onColumnFiltersReset={() => setColumnFilters(getDefaultFilters())}
              // Build/star functionality
              isWeaponStarred={isWeaponStarred}
              onToggleWeaponStar={toggleWeapon}
              builds={builds}
            />
          )}
        </div>
      </main>

      {/* Weapon Detail Panel (Sheet-based, responsive) */}
      {selectedWeapon && precomputed && (
        <WeaponDetailPanel
          precomputed={precomputed}
          aowData={aowData}
          weapon={selectedWeapon}
          statConfigs={statConfigs}
          currentStats={currentStats}
          hasUnlockedStats={hasUnlockedStats}
          twoHanding={twoHanding}
          onClose={() => setSelectedWeapon(null)}
          selectedEnemy={selectedEnemy}
          onClearEnemy={() => setSelectedEnemyKey(null)}
          startingClass={startingClass}
          defaultAow={selectedAowFilter === WEAPON_SKILL_FILTER ? null : selectedAowFilter}
          initialOptimalStats={hasUnlockedStats ? (selectedWeapon as unknown as { optimalStats?: Record<string, number> }).optimalStats : null}
          level={level}
          onLevelChange={setLevel}
          onWeaponSelect={handleWeaponSelect}
          allWeapons={weapons}
        />
      )}
    </div>
    </Profiler>
  );
}
