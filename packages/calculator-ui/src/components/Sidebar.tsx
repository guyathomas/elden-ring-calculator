import { useMemo, useState, useEffect } from 'react';
import { useIsMobile } from './ui/use-mobile.js';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Columns,
  Skull,
  Sword,
} from 'lucide-react';
import { Checkbox } from './ui/checkbox.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';
import { Combobox } from './ui/combobox.js';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group.js';
import { EnemyWeaknessesCard } from './EnemyWeaknessesCard.js';
import { SolverOptimizationModeToggle } from './SolverOptimizationModeToggle.js';
import { MobileFiltersTab } from './MobileFiltersTab.js';
import { BuildPanel } from './builds/BuildPanel.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs.js';
import { NumericInput } from './ui/numeric-input.js';
import type { StatConfig, StartingClass, WeaponListItem, CharacterStats, PrecomputedDataV2 } from '../types.js';
import type { Build } from '../types/buildTypes.js';
import type { FilterValue } from './ui/column-filter.js';
import { INITIAL_CLASS_VALUES, STARTING_CLASS_LIST, WEAPON_SKILL_FILTER, getStatValue } from '../types.js';
import type { SolverOptimizationMode } from '../types/solverTypes.js';
import { getBossNames, getEnemyByKey, getAvailableAowNames, getUniqueSkillNames } from '../data/index.js';
import type { PrecomputedAowData } from '../data/index.js';
import type { RollType } from '../utils/equipLoad.js';

// Sidebar width constants
const SIDEBAR_WIDTH = '280px';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  showScaling: boolean;
  setShowScaling: (show: boolean) => void;
  showNumericalScaling: boolean;
  setShowNumericalScaling: (show: boolean) => void;
  showRequirements: boolean;
  setShowRequirements: (show: boolean) => void;
  showAttributeInvestments: boolean;
  setShowAttributeInvestments: (show: boolean) => void;
  showEfficiency: boolean;
  setShowEfficiency: (show: boolean) => void;
  showStatusEffects: boolean;
  setShowStatusEffects: (show: boolean) => void;
  showSpellPower: boolean;
  setShowSpellPower: (show: boolean) => void;
  showAowDamage: boolean;
  setShowAowDamage: (show: boolean) => void;
  showGuardStats: boolean;
  setShowGuardStats: (show: boolean) => void;
  showDps: boolean;
  setShowDps: (show: boolean) => void;
  showWeaponStats: boolean;
  setShowWeaponStats: (show: boolean) => void;
  groupBy: 'none' | 'weapon-type' | 'affinity' | 'weapon';
  setGroupBy: (groupBy: 'none' | 'weapon-type' | 'affinity' | 'weapon') => void;

  // Stat Props
  level: number;
  setLevel: (level: number) => void;
  startingClass: StartingClass;
  setStartingClass: (startingClass: StartingClass) => void;
  statConfigs: Record<string, StatConfig>;
  onStatConfigChange: (stat: string, config: StatConfig) => void;
  twoHanding: boolean;
  onTwoHandingToggle: (enabled: boolean) => void;
  upgradeLevel: number;
  onUpgradeLevelChange: (level: number) => void;

  // Enemy selector
  selectedEnemy: string | null;
  onEnemySelect: (enemy: string | null) => void;

  // Ash of War filter
  aowData: PrecomputedAowData | null;
  selectedAowFilter: string | null;
  onAowFilterSelect: (aowName: string | null) => void;

  // Solver-specific props
  rollType: RollType;
  onRollTypeChange: (rollType: RollType) => void;
  armorWeight: number;
  onArmorWeightChange: (weight: number) => void;
  subtractWeaponWeight: boolean;
  onSubtractWeaponWeightChange: (enabled: boolean) => void;

  // Optimization mode props
  optimizationMode: SolverOptimizationMode;
  onOptimizationModeChange: (mode: SolverOptimizationMode) => void;
  hasCatalystsSelected: boolean;
  hasAowSelected: boolean;

  // Column filters (shared between desktop and mobile)
  columnFilters: Record<string, FilterValue>;
  onColumnFilterChange: (columnKey: string, value: FilterValue | undefined) => void;
  // Available options
  availableCategories: string[];
  availableAffinities: string[];
  availableDamageTypes: string[];
  availableStatusEffects: string[];
  // Build props
  builds: Build[];
  activeBuild: Build | null;
  storageAvailable: boolean;
  onSelectBuild: (id: string) => void;
  onCreateBuild: (name: string) => void;
  onRenameBuild: (id: string, name: string) => void;
  onDeleteBuild: (id: string) => void;
  onClearBuild: (id: string) => void;
  onToggleWeapon: (weaponId: string) => void;
  weapons: WeaponListItem[];
  precomputed: PrecomputedDataV2 | null;
  currentStats: CharacterStats;
  onWeaponSelect: (weapon: WeaponListItem) => void;
}

const NumberInput = ({
  value,
  onChange,
  className,
  min,
  max,
  step,
  required
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  required?: boolean;
}) => {
  const [inputValue, setInputValue] = useState(value.toString());

  const isError = required && inputValue === '';

  useEffect(() => {
    // Only update local state if the numeric value differs from the prop
    // This allows "05" or "5." to persist while typing, but syncs external changes
    const parsed = parseInt(inputValue) || 0;
    if (parsed !== value) {
      setInputValue(value.toString());
    }
  }, [value, inputValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInputValue(newVal);

    if (newVal === '') {
      onChange(0);
    } else {
      const parsed = parseInt(newVal);
      if (!isNaN(parsed)) {
        onChange(parsed);
      }
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="number"
        value={inputValue}
        onChange={handleChange}
        className={`${className} ${isError ? 'input-error' : ''}`}
        min={min}
        max={max}
        step={step}
      />
      {isError && (
        <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-error whitespace-nowrap">
          Required
        </div>
      )}
    </div>
  );
};

const FixedStatInput = ({ label, stat, config, onStatConfigChange, classMin }: { label: string; stat: string; config: StatConfig; onStatConfigChange: (stat: string, config: StatConfig) => void; classMin: number }) => {
  const isError = getStatValue(config) < classMin;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium">{label}</label>
      <NumericInput
        value={getStatValue(config)}
        onValueChange={(v) => onStatConfigChange(stat, { min: v, max: v })}
        min={1}
        max={99}
        fallback={10}
        className={`w-full bg-[#1a1a1a] border rounded px-2 py-2 text-center text-base md:text-sm text-[#e8e6e3] focus:outline-none transition-colors ${isError ? 'input-error' : 'border-[#333] focus:border-[#d4af37]'}`}
      />
      {isError && (
        <div className="text-xs text-error mt-0.5">
          Min: {classMin}
        </div>
      )}
    </div>
  );
};

const RangeStatInput = ({ label, stat, config, onStatConfigChange, classMin }: { label: string; stat: string; config: StatConfig; onStatConfigChange: (stat: string, config: StatConfig) => void; classMin: number }) => {
  const isMinError = config.min < classMin;
  const isMaxError = config.max < classMin;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[#d4af37] text-[10px] uppercase tracking-wider font-medium">{label}</label>
      <div className="flex items-center gap-1">
        <NumericInput
          value={config.min}
          onValueChange={(v) => onStatConfigChange(stat, { min: v, max: config.max })}
          min={1}
          max={99}
          fallback={10}
          className={`flex-1 min-w-0 bg-[#1a1a1a] border rounded px-1 py-2 text-center text-base md:text-xs text-[#e8e6e3] focus:outline-none ${isMinError ? 'input-error' : 'border-[#333] focus:border-[#d4af37]'}`}
        />
        <span className="text-[#4a4a4a] text-[10px]">-</span>
        <NumericInput
          value={config.max}
          onValueChange={(v) => onStatConfigChange(stat, { min: config.min, max: v })}
          min={1}
          max={99}
          fallback={99}
          className={`flex-1 min-w-0 bg-[#1a1a1a] border rounded px-1 py-2 text-center text-base md:text-xs text-[#e8e6e3] focus:outline-none ${isMaxError ? 'input-error' : 'border-[#333] focus:border-[#d4af37]'}`}
        />
      </div>
      {(isMinError || isMaxError) && (
        <div className="text-xs text-error mt-0.5">
          Min: {classMin}
        </div>
      )}
    </div>
  );
};

interface SidebarBodyProps {
  showScaling: boolean;
  setShowScaling: (show: boolean) => void;
  showNumericalScaling: boolean;
  setShowNumericalScaling: (show: boolean) => void;
  showRequirements: boolean;
  setShowRequirements: (show: boolean) => void;
  showAttributeInvestments: boolean;
  setShowAttributeInvestments: (show: boolean) => void;
  showEfficiency: boolean;
  setShowEfficiency: (show: boolean) => void;
  showStatusEffects: boolean;
  setShowStatusEffects: (show: boolean) => void;
  showSpellPower: boolean;
  setShowSpellPower: (show: boolean) => void;
  showAowDamage: boolean;
  setShowAowDamage: (show: boolean) => void;
  showGuardStats: boolean;
  setShowGuardStats: (show: boolean) => void;
  showDps: boolean;
  setShowDps: (show: boolean) => void;
  showWeaponStats: boolean;
  setShowWeaponStats: (show: boolean) => void;
  groupBy: 'none' | 'weapon-type' | 'affinity' | 'weapon';
  setGroupBy: (groupBy: 'none' | 'weapon-type' | 'affinity' | 'weapon') => void;
  statConfigs: Record<string, StatConfig>;
  onStatConfigChange: (stat: string, config: StatConfig) => void;
  startingClass: StartingClass;
  setStartingClass: (startingClass: StartingClass) => void;
  level: number;
  setLevel: (level: number) => void;
  twoHanding: boolean;
  onTwoHandingToggle: (enabled: boolean) => void;
  upgradeLevel: number;
  onUpgradeLevelChange: (level: number) => void;
  // Solver-specific props
  rollType: RollType;
  onRollTypeChange: (rollType: RollType) => void;
  armorWeight: number;
  onArmorWeightChange: (weight: number) => void;
  subtractWeaponWeight: boolean;
  onSubtractWeaponWeightChange: (enabled: boolean) => void;
  isMobile?: boolean;

  // Enemy selector
  selectedEnemy: string | null;
  onEnemySelect: (enemy: string | null) => void;

  // Ash of War filter
  aowData: PrecomputedAowData | null;
  selectedAowFilter: string | null;
  onAowFilterSelect: (aowName: string | null) => void;

  // Optimization mode props
  optimizationMode: SolverOptimizationMode;
  onOptimizationModeChange: (mode: SolverOptimizationMode) => void;
  hasCatalystsSelected: boolean;
  hasAowSelected: boolean;
}

// Maps regular weapon upgrade level (0-25) to somber weapon upgrade level (0-10)
function regularToSomberLevel(regularLevel: number): number {
  if (regularLevel === 25) return 10;
  const pairNumber = Math.floor(regularLevel / 5);
  const positionInPair = regularLevel % 5;
  const baseSomber = pairNumber * 2;
  return positionInPair < 2 ? baseSomber : baseSomber + 1;
}

// Generate all weapon level options
const WEAPON_LEVEL_OPTIONS = Array.from({ length: 26 }, (_, i) => ({
  regular: i,
  somber: regularToSomberLevel(i),
  label: `+${i} / +${regularToSomberLevel(i)}`
}));

// Generate boss options dynamically from enemy data, deduplicated by name
const BOSS_OPTIONS = (() => {
  const seen = new Set<string>();
  const options: { label: string; value: string }[] = [];
  for (const bossKey of getBossNames()) {
    const enemy = getEnemyByKey(bossKey);
    const label = enemy?.name ?? bossKey;
    if (!seen.has(label)) {
      seen.add(label);
      options.push({ label, value: bossKey });
    }
  }
  return options;
})();

// Starting class options for Combobox
const STARTING_CLASS_OPTIONS = STARTING_CLASS_LIST.map((cls) => ({ label: cls, value: cls }));

// Weapon level options for Combobox
const WEAPON_LEVEL_COMBOBOX_OPTIONS = WEAPON_LEVEL_OPTIONS.map((option) => ({
  label: option.label,
  value: String(option.regular)
}));

const SidebarBody = ({
  showScaling,
  setShowScaling,
  showNumericalScaling,
  setShowNumericalScaling,
  showRequirements,
  setShowRequirements,
  showAttributeInvestments,
  setShowAttributeInvestments,
  showEfficiency,
  setShowEfficiency,
  showStatusEffects,
  setShowStatusEffects,
  showSpellPower,
  setShowSpellPower,
  showAowDamage,
  setShowAowDamage,
  showGuardStats,
  setShowGuardStats,
  showDps,
  setShowDps,
  showWeaponStats,
  setShowWeaponStats,
  groupBy,
  setGroupBy,
  statConfigs,
  onStatConfigChange,
  startingClass,
  setStartingClass,
  level,
  setLevel,
  twoHanding,
  onTwoHandingToggle,
  upgradeLevel,
  onUpgradeLevelChange,
  rollType,
  onRollTypeChange,
  armorWeight,
  onArmorWeightChange,
  subtractWeaponWeight,
  onSubtractWeaponWeightChange,
  isMobile = false,
  selectedEnemy,
  onEnemySelect,
  aowData,
  selectedAowFilter,
  onAowFilterSelect,
  optimizationMode,
  onOptimizationModeChange,
  hasCatalystsSelected,
  hasAowSelected,
}: SidebarBodyProps) => {
  const classData = INITIAL_CLASS_VALUES[startingClass];

  // Build grouped AoW options from aowData
  const aowGroups = useMemo(() => {
    if (!aowData) return [];

    // Get mountable ashes of war
    const mountableAowNames = getAvailableAowNames(aowData);
    const aowOptions = mountableAowNames.map((name: string) => ({ label: name, value: name }));

    // Get unique weapon skills
    const uniqueSkillsNames = getUniqueSkillNames(aowData);
    const uniqueOptions = uniqueSkillsNames.map((name: string) => ({ label: name, value: name }));

    return [
      { label: 'Ash of War', options: aowOptions },
      { label: 'Unique Skill', options: uniqueOptions },
    ];
  }, [aowData]);

  const handleResetStats = () => {
    // Reset Level
    setLevel(classData.lvl);

    // Reset VIG, MND, END (always fixed, min === max)
    onStatConfigChange('vig', { min: classData.vig, max: classData.vig });
    onStatConfigChange('mnd', { min: classData.min, max: classData.min });
    onStatConfigChange('end', { min: classData.end, max: classData.end });

    // Reset Damage Stats - preserve range nature (min to 99)
    const damageStats = ['str', 'dex', 'int', 'fai', 'arc'] as const;
    damageStats.forEach(stat => {
      onStatConfigChange(stat, { min: classData[stat], max: 99 });
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {/* ============================================ */}
      {/* CALCULATOR SECTION */}
      {/* ============================================ */}
      <div className="space-y-4">
        <label className="text-xs font-medium text-[#8b8b8b] uppercase tracking-wider">Calculator</label>

        {/* Optimization Mode Toggle */}
        <SolverOptimizationModeToggle
          mode={optimizationMode}
          onChange={onOptimizationModeChange}
          spDisabled={!hasCatalystsSelected}
          spDisabledReason="Select Glintstone Staff or Sacred Seal in weapon filter"
          aowDisabled={!hasAowSelected}
          aowDisabledReason="AoW can only be optimized when one is selected below"
        />
      </div>

      {/* ============================================ */}
      {/* CHARACTER SECTION */}
      {/* ============================================ */}
      <div className="space-y-4 pt-4 border-t border-[#2a2a2a]">
        <label className="text-xs font-medium text-[#8b8b8b] uppercase tracking-wider">Character</label>

        <div>
          <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium mb-2 block">Starting Class</label>
          <Combobox
            options={STARTING_CLASS_OPTIONS}
            value={startingClass}
            onChange={(value) => setStartingClass((value || 'Vagabond') as StartingClass)}
            placeholder="Select class..."
            searchPlaceholder="Search classes..."
            emptyText="No class found."
            searchable={false}
          />
        </div>

        {/* Stats Section - Level/Budget + VIG/MND/END + Damage Stats */}
        <div className="space-y-3">
          {/* Level and Budget */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium">Level</label>
              <NumericInput
                value={level}
                onValueChange={setLevel}
                min={1}
                max={713}
                fallback={1}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-2 py-2 text-center text-base md:text-sm text-[#e8e6e3] focus:outline-none focus:border-[#d4af37] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium">Budget</label>
              {(() => {
                const end = getStatValue(statConfigs.end);
                const budget = (level - classData.lvl) -
                  (getStatValue(statConfigs.vig) - classData.vig) -
                  (getStatValue(statConfigs.mnd) - classData.min) -
                  (end - classData.end);
                return (
                  <div
                    className={`w-full bg-[#0a0a0a] border border-[#222] rounded px-2 py-2 text-center text-sm ${budget < 0 ? 'text-[#ef4444]' : 'text-[#d4af37]'
                      }`}
                  >
                    {budget}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FixedStatInput label="VIG" stat="vig" config={statConfigs.vig} onStatConfigChange={onStatConfigChange} classMin={classData.vig} />
            <FixedStatInput label="MND" stat="mnd" config={statConfigs.mnd} onStatConfigChange={onStatConfigChange} classMin={classData.min} />
            <FixedStatInput label="END" stat="end" config={statConfigs.end} onStatConfigChange={onStatConfigChange} classMin={classData.end} />
          </div>

          {/* Damage Stats - Range inputs */}
          <label className="text-[#d4af37] text-[10px] uppercase tracking-wider font-medium pt-2">Damage Stats (min-max)</label>
          <div className="grid grid-cols-2 gap-3">
            <RangeStatInput label="STR" stat="str" config={statConfigs.str} onStatConfigChange={onStatConfigChange} classMin={classData.str} />
            <RangeStatInput label="DEX" stat="dex" config={statConfigs.dex} onStatConfigChange={onStatConfigChange} classMin={classData.dex} />
            <RangeStatInput label="INT" stat="int" config={statConfigs.int} onStatConfigChange={onStatConfigChange} classMin={classData.int} />
            <RangeStatInput label="FAI" stat="fai" config={statConfigs.fai} onStatConfigChange={onStatConfigChange} classMin={classData.fai} />
            <RangeStatInput label="ARC" stat="arc" config={statConfigs.arc} onStatConfigChange={onStatConfigChange} classMin={classData.arc} />
          </div>

          {/* Subtract Weapon Weight Toggle */}
          <div className="pt-3">
            <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
              <Checkbox
                checked={subtractWeaponWeight}
                onCheckedChange={(checked) => onSubtractWeaponWeightChange(checked === true)}
                className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
              />
              Subtract Weapon Weight
            </label>
            <p className="text-[10px] text-[#6a6a6a] mt-1 ml-6">
              Adjusts budget to consider weapon weight
            </p>
          </div>

          {subtractWeaponWeight && (
            <>
              {/* Roll Type Picker */}
              <div className="pt-2">
                <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium block mb-1.5">Roll Type</label>
                <ToggleGroup
                  type="single"
                  value={rollType}
                  onValueChange={(v) => { if (v) onRollTypeChange(v as RollType); }}
                  variant="subtle"
                  size="default"
                  className="rounded border border-[#333] bg-[#141414] p-1"
                >
                  <ToggleGroupItem value="light" className="flex-1 text-xs uppercase tracking-wider">
                    Light
                  </ToggleGroupItem>
                  <ToggleGroupItem value="medium" className="flex-1 text-xs uppercase tracking-wider">
                    Med
                  </ToggleGroupItem>
                  <ToggleGroupItem value="heavy" className="flex-1 text-xs uppercase tracking-wider">
                    Heavy
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Equip Load Input */}
              <div className="flex flex-col gap-1.5 pt-2">
                <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium">Equip Load</label>
                <NumberInput
                  value={armorWeight}
                  onChange={onArmorWeightChange}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded px-2 py-2 text-center text-sm text-[#e8e6e3] focus:outline-none focus:border-[#d4af37] transition-colors"
                  min="0"
                  step="1"
                  required
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* WEAPON SECTION */}
      {/* ============================================ */}
      <div className="space-y-4 pt-4 border-t border-[#2a2a2a]">
        <label className="text-xs font-medium text-[#8b8b8b] uppercase tracking-wider">Weapon</label>

        {/* Weapon Level Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium">Upgrade Level</label>
          <Combobox
            options={WEAPON_LEVEL_COMBOBOX_OPTIONS}
            value={String(upgradeLevel)}
            onChange={(value) => onUpgradeLevelChange(parseInt(value || '25'))}
            placeholder="Select level..."
            searchPlaceholder="Search levels..."
            emptyText="No level found."
            searchable={false}
          />
        </div>

        {/* Two-Handing Toggle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium">Grip</label>
          <ToggleGroup
            type="single"
            value={twoHanding ? '2h' : '1h'}
            onValueChange={(v) => { if (v) onTwoHandingToggle(v === '2h'); }}
            variant="subtle"
            size="default"
            className="rounded border border-[#333] bg-[#141414] p-1"
          >
            <ToggleGroupItem value="1h" className="flex-1 text-xs uppercase tracking-wider">
              1H
            </ToggleGroupItem>
            <ToggleGroupItem value="2h" className="flex-1 text-xs uppercase tracking-wider">
              2H
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Enemy Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5">
            <Skull className="w-3 h-3" />
            Target Enemy
          </label>
          <Combobox
            options={BOSS_OPTIONS}
            value={selectedEnemy}
            onChange={onEnemySelect}
            placeholder="None (AR Only)"
            clearOptionLabel="None (AR Only)"
            searchPlaceholder="Search enemies..."
            emptyText="No enemies found."
          />
          <EnemyWeaknessesCard selectedEnemy={selectedEnemy} />
        </div>

        {/* Ash of War Filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5">
            <Sword className="w-3 h-3" />
            Ash of War
          </label>
          <Combobox
            groups={aowGroups}
            fixedOptions={[{ label: 'Weapon Skill', value: WEAPON_SKILL_FILTER }]}
            value={selectedAowFilter}
            onChange={onAowFilterSelect}
            placeholder="None"
            clearOptionLabel="None"
            searchPlaceholder="Search ashes of war..."
            emptyText="No ashes of war found."
          />
          {selectedAowFilter && (
            <p className="text-[10px] text-[#6a6a6a]">
              {selectedAowFilter === WEAPON_SKILL_FILTER
                ? 'Filtered to weapons with unique skills'
                : 'Filtered to compatible weapons'}
            </p>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* COLUMNS SECTION */}
      {/* ============================================ */}
      <div className="space-y-3 pt-4 pb-4 border-t border-[#2a2a2a]">
        <label className="text-xs font-medium text-[#8b8b8b] uppercase tracking-wider flex items-center gap-2">
          <Columns className="w-3 h-3" />
          Columns
        </label>
        <div className="space-y-2">
          {/* Weapon Stats */}
          <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
            <Checkbox
              checked={showWeaponStats}
              onCheckedChange={(checked) => setShowWeaponStats(checked === true)}
              className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
            />
            Weapon Stats
          </label>
          {/* DPS */}
          <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
            <Checkbox
              checked={showDps}
              onCheckedChange={(checked) => setShowDps(checked === true)}
              className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
            />
            DPS
          </label>
          {/* Spell Power */}
          <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
            <Checkbox
              checked={showSpellPower}
              onCheckedChange={(checked) => setShowSpellPower(checked === true)}
              className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
            />
            Spell Power
          </label>
          {/* Efficiency */}
          <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
            <Checkbox
              checked={showEfficiency}
              onCheckedChange={(checked) => setShowEfficiency(checked === true)}
              className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
            />
            Efficiency
          </label>
          {/* Scaling */}
          <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
            <Checkbox
              checked={showScaling}
              onCheckedChange={(checked) => setShowScaling(checked === true)}
              className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
            />
            Scaling
          </label>
          {showScaling && (
            <label
              className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white ml-2"
            >
              <Checkbox
                checked={showNumericalScaling}
                onCheckedChange={(checked) => setShowNumericalScaling(checked === true)}
                className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
              />
              Show Scaling Values
            </label>
          )}
          {/* Requirements */}
          <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
            <Checkbox
              checked={showRequirements}
              onCheckedChange={(checked) => setShowRequirements(checked === true)}
              className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
            />
            Requirements
          </label>
          {/* Attribute Investments */}
          <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
            <Checkbox
              checked={showAttributeInvestments}
              onCheckedChange={(checked) => setShowAttributeInvestments(checked === true)}
              className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
            />
            Attribute Investments
          </label>
          {/* Status Effects */}
          <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
            <Checkbox
              checked={showStatusEffects}
              onCheckedChange={(checked) => setShowStatusEffects(checked === true)}
              className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
            />
            Status Effects
          </label>
          {/* Ash of War Damage (conditional) */}
          {selectedAowFilter && (
            <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
              <Checkbox
                checked={showAowDamage}
                onCheckedChange={(checked) => setShowAowDamage(checked === true)}
                className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
              />
              Ash of War Damage
            </label>
          )}
          {/* Guard Stats */}
          <label className="flex items-center gap-2 text-sm text-[#e8e6e3] cursor-pointer hover:text-white">
            <Checkbox
              checked={showGuardStats}
              onCheckedChange={(checked) => setShowGuardStats(checked === true)}
              className="border-[#3a3a3a] data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
            />
            Guard Stats
          </label>
        </div>
      </div>

      {/* DISPLAY SECTION */}
      {/* ============================================ */}
      <div className="space-y-3 pt-4 border-t border-[#2a2a2a]">
        <label className="text-xs font-medium text-[#8b8b8b] uppercase tracking-wider">
          Display
        </label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#8b8b8b] whitespace-nowrap">Group by:</label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
              <SelectTrigger className="flex-1 bg-[#1a1a1a] border-[#2a2a2a]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                <SelectItem value="none">No grouping</SelectItem>
                <SelectItem value="weapon-type">Weapon Type</SelectItem>
                <SelectItem value="affinity">Affinity</SelectItem>
                <SelectItem value="weapon">Weapon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Credits */}
      <div className="pt-4 border-t border-[#2a2a2a]">
        <p className="text-xs text-[#5a5a5a] mb-1">Data sources:</p>
        <ul className="text-xs text-[#5a5a5a] space-y-0.5">
          <li>
            <a href="https://docs.google.com/spreadsheets/d/1q8GBymIayKbQivML-k8yCzUSYGm8YWSFGetIH8mDrbQ/copy" target="_blank" rel="noopener noreferrer" className="hover:text-[#8b8b8b] transition-colors">Weapon data</a> by CryptidTracker
          </li>
          <li>
            <a href="https://er-frame-data.nyasu.business/" target="_blank" rel="noopener noreferrer" className="hover:text-[#8b8b8b] transition-colors">Frame data</a> by Emilia
          </li>
          <li>
            <a href="https://eldenring.tclark.io/" target="_blank" rel="noopener noreferrer" className="hover:text-[#8b8b8b] transition-colors">Scaling data</a> by Tom Clarke
          </li>
        </ul>
      </div>

      {/* iOS safe area spacer */}
      {isMobile && <div className="h-[env(safe-area-inset-bottom)]" />}
    </div>
  );
};

export function Sidebar({
  isOpen,
  onClose,
  showScaling,
  setShowScaling,
  showNumericalScaling,
  setShowNumericalScaling,
  showRequirements,
  setShowRequirements,
  showAttributeInvestments,
  setShowAttributeInvestments,
  showEfficiency,
  setShowEfficiency,
  showStatusEffects,
  setShowStatusEffects,
  showSpellPower,
  setShowSpellPower,
  showAowDamage,
  setShowAowDamage,
  showGuardStats,
  setShowGuardStats,
  showDps,
  setShowDps,
  showWeaponStats,
  setShowWeaponStats,
  groupBy,
  setGroupBy,
  statConfigs,
  onStatConfigChange,
  startingClass,
  setStartingClass,
  level,
  setLevel,
  twoHanding,
  onTwoHandingToggle,
  upgradeLevel,
  onUpgradeLevelChange,
  selectedEnemy,
  onEnemySelect,
  aowData,
  selectedAowFilter,
  onAowFilterSelect,
  rollType,
  onRollTypeChange,
  armorWeight,
  onArmorWeightChange,
  subtractWeaponWeight,
  onSubtractWeaponWeightChange,
  optimizationMode,
  onOptimizationModeChange,
  hasCatalystsSelected,
  hasAowSelected,
  // Column filters
  columnFilters,
  onColumnFilterChange,
  // Available options
  availableCategories,
  availableAffinities,
  availableDamageTypes,
  availableStatusEffects,
  // Build props
  builds,
  activeBuild,
  storageAvailable,
  onSelectBuild,
  onCreateBuild,
  onRenameBuild,
  onDeleteBuild,
  onClearBuild,
  onToggleWeapon,
  weapons,
  precomputed,
  currentStats,
  onWeaponSelect,
}: SidebarProps) {
  // Count of starred weapons for badge
  const starredCount = activeBuild?.weapons.length ?? 0;

  const sidebarBodyProps = {
    showScaling,
    setShowScaling,
    showNumericalScaling,
    setShowNumericalScaling,
    showRequirements,
    setShowRequirements,
    showAttributeInvestments,
    setShowAttributeInvestments,
    showEfficiency,
    setShowEfficiency,
    showStatusEffects,
    setShowStatusEffects,
    showSpellPower,
    setShowSpellPower,
    showAowDamage,
    setShowAowDamage,
    showGuardStats,
    setShowGuardStats,
    showDps,
    setShowDps,
    showWeaponStats,
    setShowWeaponStats,
    groupBy,
    setGroupBy,
    statConfigs,
    onStatConfigChange,
    startingClass,
    setStartingClass,
    level,
    setLevel,
    twoHanding,
    onTwoHandingToggle,
    upgradeLevel,
    onUpgradeLevelChange,
    selectedEnemy,
    onEnemySelect,
    aowData,
    selectedAowFilter,
    onAowFilterSelect,
    rollType,
    onRollTypeChange,
    armorWeight,
    onArmorWeightChange,
    subtractWeaponWeight,
    onSubtractWeaponWeightChange,
    optimizationMode,
    onOptimizationModeChange,
    hasCatalystsSelected,
    hasAowSelected,
  };

  const isMobile = useIsMobile();

  // Desktop: render inline sidebar; Mobile: render nothing here (drawer handles it)
  if (!isMobile) {
    return (
      <div className="h-full overflow-hidden">
        <Tabs defaultValue="settings" className="flex flex-col h-full bg-[#111111] border-r border-[#2a2a2a] text-[#e8e6e3] gap-0">
          <TabsList className="bg-transparent border-b border-[#2a2a2a] rounded-none h-auto p-0 w-full shrink-0">
            <TabsTrigger
              value="settings"
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-0 border-b-2 border-transparent transition-colors -mb-px uppercase tracking-wider rounded-none bg-transparent text-[#6a6a6a] hover:text-[#8b8b8b] data-[state=active]:text-[#d4af37] data-[state=active]:border-[#d4af37] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="build"
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-0 border-b-2 border-transparent transition-colors -mb-px uppercase tracking-wider rounded-none bg-transparent text-[#6a6a6a] hover:text-[#8b8b8b] data-[state=active]:text-[#d4af37] data-[state=active]:border-[#d4af37] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Build
              {starredCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#d4af37] text-black font-medium">
                  {starredCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="p-0 mt-0 flex-1 overflow-hidden flex flex-col">
            <SidebarBody {...sidebarBodyProps} />
          </TabsContent>
          <TabsContent value="build" className="p-0 mt-0 flex-1 overflow-hidden flex flex-col">
            <BuildPanel
              builds={builds}
              activeBuild={activeBuild}
              storageAvailable={storageAvailable}
              onSelectBuild={onSelectBuild}
              onCreateBuild={onCreateBuild}
              onRenameBuild={onRenameBuild}
              onDeleteBuild={onDeleteBuild}
              onClearBuild={onClearBuild}
              onToggleWeapon={onToggleWeapon}
              weapons={weapons}
              precomputed={precomputed}
              currentStats={currentStats}
              twoHanding={twoHanding}
              onWeaponSelect={onWeaponSelect}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Mobile: render drawer (no Dialog/portal to avoid stacking context issues with dropdowns)
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{ width: SIDEBAR_WIDTH, maxWidth: SIDEBAR_WIDTH }}
            className="fixed inset-y-0 left-0 z-[101] h-[100dvh] bg-[#111111] shadow-xl border-r border-[#2a2a2a] focus:outline-none overflow-hidden"
          >
              <div className="flex flex-col h-full w-full bg-[#111111] text-[#e8e6e3] overflow-hidden">
                {/* Header with close button */}
                <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-[#2a2a2a] rounded text-[#8b8b8b] hover:text-[#e8e6e3] transition-colors ml-auto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                    {/* Tabs */}
                    <Tabs defaultValue="settings" className="flex flex-col flex-1 overflow-hidden gap-0">
                      <TabsList className="bg-transparent border-b border-[#2a2a2a] rounded-none h-auto p-0 w-full px-4 shrink-0">
                        <TabsTrigger
                          value="settings"
                          className="mobile-sidebar-tab"
                        >
                          Settings
                        </TabsTrigger>
                        <TabsTrigger
                          value="filters"
                          className="mobile-sidebar-tab"
                        >
                          Filters
                          {Object.keys(columnFilters).length > 0 && (
                            <span className="w-2 h-2 rounded-full bg-[#d4af37]" />
                          )}
                        </TabsTrigger>
                        <TabsTrigger
                          value="build"
                          className="mobile-sidebar-tab"
                        >
                          Build
                          {starredCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[#d4af37] text-black font-medium">
                              {starredCount}
                            </span>
                          )}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="settings" className="p-0 mt-0 flex-1 flex flex-col overflow-hidden">
                        <SidebarBody {...sidebarBodyProps} isMobile />
                      </TabsContent>
                      <TabsContent value="filters" className="p-0 mt-0 flex-1 flex flex-col overflow-hidden">
                        <MobileFiltersTab
                          sortKey="name"
                          onSortKeyChange={() => {}}
                          sortDirection="asc"
                          onSortDirectionChange={() => {}}
                          categoryFilter={(columnFilters.categoryName?.type === 'set' ? columnFilters.categoryName.values : new Set()) as Set<string>}
                          onCategoryFilterChange={(cats) => {
                            if (cats.size === 0) {
                              onColumnFilterChange('categoryName', undefined);
                            } else {
                              onColumnFilterChange('categoryName', { type: 'set', values: cats });
                            }
                          }}
                          affinityFilter={(columnFilters.affinity?.type === 'set' ? columnFilters.affinity.values : new Set()) as Set<string>}
                          onAffinityFilterChange={(affs) => {
                            if (affs.size === 0) {
                              onColumnFilterChange('affinity', undefined);
                            } else {
                              onColumnFilterChange('affinity', { type: 'set', values: affs });
                            }
                          }}
                          searchText={columnFilters.name?.type === 'text' ? columnFilters.name.value : ''}
                          onSearchTextChange={(text) => {
                            if (text.length === 0) {
                              onColumnFilterChange('name', undefined);
                            } else {
                              onColumnFilterChange('name', { type: 'text', value: text });
                            }
                          }}
                          weightRange={{
                            min: columnFilters.weight?.type === 'range' ? columnFilters.weight.min : undefined,
                            max: columnFilters.weight?.type === 'range' ? columnFilters.weight.max : undefined,
                          }}
                          onWeightRangeChange={(range) => {
                            if (range.min === undefined && range.max === undefined) {
                              onColumnFilterChange('weight', undefined);
                            } else {
                              onColumnFilterChange('weight', { type: 'range', min: range.min, max: range.max });
                            }
                          }}
                          arRange={{
                            min: columnFilters.totalAR?.type === 'range' ? columnFilters.totalAR.min : undefined,
                            max: columnFilters.totalAR?.type === 'range' ? columnFilters.totalAR.max : undefined,
                          }}
                          onARRangeChange={(range) => {
                            if (range.min === undefined && range.max === undefined) {
                              onColumnFilterChange('totalAR', undefined);
                            } else {
                              onColumnFilterChange('totalAR', { type: 'range', min: range.min, max: range.max });
                            }
                          }}
                          buffableFilter={columnFilters.buffable?.type === 'boolean' ? columnFilters.buffable.value : null}
                          onBuffableFilterChange={(val) => {
                            if (val === null) {
                              onColumnFilterChange('buffable', undefined);
                            } else {
                              onColumnFilterChange('buffable', { type: 'boolean', value: val });
                            }
                          }}
                          meetsReqsFilter={columnFilters.meetsReqs?.type === 'boolean' ? columnFilters.meetsReqs.value : null}
                          onMeetsReqsFilterChange={(val) => {
                            if (val === null) {
                              onColumnFilterChange('meetsReqs', undefined);
                            } else {
                              onColumnFilterChange('meetsReqs', { type: 'boolean', value: val });
                            }
                          }}
                          damageTypeFilter={(columnFilters.damageType?.type === 'set' ? columnFilters.damageType.values : new Set()) as Set<string>}
                          onDamageTypeFilterChange={(types) => {
                            if (types.size === 0) {
                              onColumnFilterChange('damageType', undefined);
                            } else {
                              onColumnFilterChange('damageType', { type: 'set', values: types });
                            }
                          }}
                          statusEffectFilter={(() => {
                            const filter = columnFilters.statusEffects;
                            if (filter?.type === 'set') return filter.values;
                            return new Set<string>();
                          })()}
                          onStatusEffectFilterChange={(effects) => {
                            if (effects.size === 0) {
                              onColumnFilterChange('statusEffects', undefined);
                            } else {
                              onColumnFilterChange('statusEffects', { type: 'set', values: effects });
                            }
                          }}
                          availableCategories={availableCategories}
                          availableAffinities={availableAffinities}
                          availableDamageTypes={availableDamageTypes}
                          availableStatusEffects={availableStatusEffects}
                        />
                      </TabsContent>
                      <TabsContent value="build" className="p-0 mt-0 flex-1 flex flex-col overflow-hidden">
                        <BuildPanel
                          builds={builds}
                          activeBuild={activeBuild}
                          storageAvailable={storageAvailable}
                          onSelectBuild={onSelectBuild}
                          onCreateBuild={onCreateBuild}
                          onRenameBuild={onRenameBuild}
                          onDeleteBuild={onDeleteBuild}
                          onClearBuild={onClearBuild}
                          onToggleWeapon={onToggleWeapon}
                          weapons={weapons}
                          precomputed={precomputed}
                          currentStats={currentStats}
                          twoHanding={twoHanding}
                          onWeaponSelect={onWeaponSelect}
                          isMobile
                        />
                      </TabsContent>
                    </Tabs>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
  );
}
