import type { StatConfig, StartingClass } from '../types';
import { INITIAL_CLASS_VALUES, STARTING_CLASS_LIST } from '../types';
import { Calculator, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';
import { NumericInput } from './ui/numeric-input.js';

interface StatInputPanelProps {
  level: number;
  setLevel: (level: number) => void;
  startingClass: StartingClass;
  setStartingClass: (startingClass: StartingClass) => void;
  statConfigs: Record<string, StatConfig>;
  onStatConfigChange: (stat: string, config: StatConfig) => void;
  solverEnabled: boolean;
  onSolverToggle: (enabled: boolean) => void;
  twoHanding?: boolean;
  onTwoHandingToggle?: (enabled: boolean) => void;
}

export function StatInputPanel({ level, setLevel, startingClass, setStartingClass, statConfigs, onStatConfigChange, solverEnabled, onSolverToggle }: StatInputPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const classData = INITIAL_CLASS_VALUES[startingClass];

  const handleModeSwitch = (toSolver: boolean) => {
    if (toSolver === solverEnabled) return;

    onSolverToggle(toSolver);

    if (toSolver) {
      // Switch to Solver mode: unlock all damage stats with ranges based on class minimums
      const damageStatMap: Record<string, keyof typeof classData> = {
        str: 'str', dex: 'dex', int: 'int', fai: 'fai', arc: 'arc'
      };
      Object.entries(damageStatMap).forEach(([stat, classKey]) => {
        const classMin = classData[classKey];
        const currentValue = statConfigs[stat].value || classMin;
        onStatConfigChange(stat, {
          locked: false,
          min: classMin,
          max: Math.min(99, Math.max(currentValue, classMin) + 20)
        });
      });
    } else {
      // Switch to Fixed mode: lock all damage stats to single values
      const damageStats = ['str', 'dex', 'int', 'fai', 'arc'] as const;
      damageStats.forEach(stat => {
        const classMin = classData[stat];
        const value = statConfigs[stat].locked ? statConfigs[stat].value! : statConfigs[stat].min || classMin;
        onStatConfigChange(stat, {
          locked: true,
          value: value
        });
      });
    }
  };

  // Calculate available points for solver mode using the proper formula
  // spendablePoints = classTotal - classLvl + currentLvl - vig - mnd - end
  const vig = statConfigs.vig.locked ? statConfigs.vig.value! : (statConfigs.vig.min ?? classData.vig);
  const mnd = statConfigs.mnd.locked ? statConfigs.mnd.value! : (statConfigs.mnd.min ?? classData.min);
  const end = statConfigs.end.locked ? statConfigs.end.value! : (statConfigs.end.min ?? classData.end);
  const availablePoints = classData.total - classData.lvl + level - vig - mnd - end;

  const FixedStatInput = ({
    label,
    stat,
    config,
    classMin
  }: {
    label: string;
    stat: string;
    config: StatConfig;
    classMin: number;
  }) => {
    const isError = (config.value || 10) < classMin;

    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[#8b8b8b] text-xs uppercase tracking-wider">
          {label}
        </label>
        <div className="relative">
          <NumericInput
            value={config.value || 10}
            onValueChange={(v) => onStatConfigChange(stat, { locked: true, value: v })}
            min={1}
            max={99}
            fallback={10}
            className={`w-[54px] lg:w-[54px] w-full bg-[#1a1a1a] border rounded px-2 py-1.5 text-center text-base md:text-sm focus:outline-none ${isError ? 'input-error' : 'border-[#3a3a3a] focus:border-[#d4af37]'}`}
          />
          {isError && (
            <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-error whitespace-nowrap">
              Min: {classMin}
            </div>
          )}
        </div>
      </div>
    );
  };

  const RangeStatInput = ({
    label,
    stat,
    config,
    classMin
  }: {
    label: string;
    stat: string;
    config: StatConfig;
    classMin: number;
  }) => {
    const isError = (config.min || 10) < classMin;

    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[#d4af37] text-xs uppercase tracking-wider">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <NumericInput
              value={config.min || 10}
              onValueChange={(v) => onStatConfigChange(stat, { ...config, min: v })}
              min={1}
              max={99}
              fallback={10}
              className={`w-full bg-[#1a1a1a] border rounded px-2 py-1.5 text-center text-base md:text-sm focus:outline-none ${isError ? 'input-error' : 'border-[#3a3a3a] focus:border-[#d4af37]'
                }`}
            />
            {isError && (
              <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-error whitespace-nowrap">
                Min: {classMin}
              </div>
            )}
          </div>
          <span className="text-[#4a4a4a] text-[10px]">—</span>
          <NumericInput
            value={config.max || 99}
            onValueChange={(v) => onStatConfigChange(stat, { ...config, max: v })}
            min={1}
            max={99}
            fallback={99}
            className="w-[54px] lg:w-[54px] flex-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded px-2 py-1.5 text-center text-base md:text-sm focus:outline-none focus:border-[#d4af37]"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="border-b border-[#2a2a2a] bg-[#0a0a0a]">
      {/* Mobile: Collapsible Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="lg:hidden w-full px-4 py-3 flex items-center justify-between hover:bg-[#141414] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#3a3a3a] bg-[#141414]">
            {solverEnabled ? (
              <>
                <Calculator className="w-3 h-3 text-[#d4af37]" />
                <span className="text-[#d4af37] text-xs uppercase tracking-wider">Solver</span>
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 text-[#8b8b8b]" />
                <span className="text-[#8b8b8b] text-xs uppercase tracking-wider">Fixed</span>
              </>
            )}
          </div>
          <span className="text-[#6a6a6a] text-xs">Configure Stats</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#6a6a6a]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#6a6a6a]" />
        )}
      </button>

      {/* Desktop & Mobile Expanded: Stats Panel */}
      <AnimatePresence initial={false}>
        {(expanded || typeof window === 'undefined') && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden lg:!block lg:!h-auto lg:!opacity-100"
          >
            <div className="px-4 lg:px-6 py-4">
              {/* Mobile Layout */}
              <div className="flex flex-col gap-4 lg:hidden">
                {/* Mode Toggle */}
                <div className="flex justify-center">
                  <ToggleGroup
                    type="single"
                    value={solverEnabled ? 'solver' : 'fixed'}
                    onValueChange={(v) => { if (v) handleModeSwitch(v === 'solver'); }}
                    variant="subtle"
                    size="touch"
                    className="rounded border border-[#3a3a3a] bg-[#141414] p-0.5"
                  >
                    <ToggleGroupItem value="fixed" className="px-4 text-xs uppercase tracking-wider whitespace-nowrap">
                      <Lock className="w-3 h-3" />
                      <span>Fixed</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="solver" className="px-4 text-xs uppercase tracking-wider whitespace-nowrap ">
                      <Calculator className="w-3 h-3" />
                      <span>Solver</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {!solverEnabled ? (
                  /* Mobile: Fixed Mode */
                  <div className="space-y-3">
                    <div className="text-[#8b8b8b] text-xs uppercase tracking-wider">Attributes</div>
                    <div className="grid grid-cols-5 gap-2">
                      <FixedStatInput label="STR" stat="str" config={statConfigs.str} classMin={classData.str} />
                      <FixedStatInput label="DEX" stat="dex" config={statConfigs.dex} classMin={classData.dex} />
                      <FixedStatInput label="INT" stat="int" config={statConfigs.int} classMin={classData.int} />
                      <FixedStatInput label="FAI" stat="fai" config={statConfigs.fai} classMin={classData.fai} />
                      <FixedStatInput label="ARC" stat="arc" config={statConfigs.arc} classMin={classData.arc} />
                    </div>
                  </div>
                ) : (
                  /* Mobile: Solver Mode */
                  <div className="space-y-4">
                    <div>
                      <div className="text-[#d4af37] text-xs uppercase tracking-wider mb-3">Optimize For</div>
                      <div className="grid grid-cols-2 gap-3">
                        <RangeStatInput label="STR" stat="str" config={statConfigs.str} classMin={classData.str} />
                        <RangeStatInput label="DEX" stat="dex" config={statConfigs.dex} classMin={classData.dex} />
                        <RangeStatInput label="INT" stat="int" config={statConfigs.int} classMin={classData.int} />
                        <RangeStatInput label="FAI" stat="fai" config={statConfigs.fai} classMin={classData.fai} />
                        <RangeStatInput label="ARC" stat="arc" config={statConfigs.arc} classMin={classData.arc} />
                      </div>
                    </div>

                    <div className="border-t border-[#2a2a2a] pt-4">
                      <div className="text-[#8b8b8b] text-xs uppercase tracking-wider mb-3">Budget Constraints</div>
                      {/* Class and Level row */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[#8b8b8b] text-xs uppercase tracking-wider">
                            Class
                          </label>
                          <Select value={startingClass} onValueChange={(v) => setStartingClass(v as StartingClass)}>
                            <SelectTrigger className="w-full bg-[#1a1a1a] border-[#3a3a3a]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                              {STARTING_CLASS_LIST.map(cls => (
                                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[#8b8b8b] text-xs uppercase tracking-wider">
                            Level
                          </label>
                          <NumericInput
                            value={level}
                            onValueChange={setLevel}
                            min={classData.lvl}
                            max={713}
                            fallback={classData.lvl}
                            className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded px-2 py-1.5 text-center text-base md:text-sm focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>
                      {/* VIG/MND/END row */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <FixedStatInput label="VIG" stat="vig" config={statConfigs.vig} classMin={classData.vig} />
                        <FixedStatInput label="MND" stat="mnd" config={statConfigs.mnd} classMin={classData.min} />
                        <FixedStatInput label="END" stat="end" config={statConfigs.end} classMin={classData.end} />
                      </div>
                      <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2">
                        <span className="text-[#8b8b8b] text-xs uppercase tracking-wider">Available Points</span>
                        <span className={`font-medium ${availablePoints < 0
                            ? 'text-[#ff6b6b]'
                            : 'text-[#d4af37]'
                          }`}>
                          {availablePoints}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop Layout */}
              <div className="hidden lg:flex items-start gap-8">
                {/* Mode Toggle */}
                <div className="flex flex-col gap-2">
                  <div className="text-[#6a6a6a] text-[10px] uppercase tracking-wider mb-0.5">Mode</div>
                  <ToggleGroup
                    type="single"
                    value={solverEnabled ? 'solver' : 'fixed'}
                    onValueChange={(v) => { if (v) handleModeSwitch(v === 'solver'); }}
                    variant="subtle"
                    size="sm"
                    className="rounded border border-[#3a3a3a] bg-[#141414] p-0.5"
                  >
                    <ToggleGroupItem value="fixed" className="px-3 text-xs uppercase tracking-wider whitespace-nowrap">
                      <Lock className="w-3 h-3" />
                      <span>Fixed</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="solver" className="px-3 text-xs uppercase tracking-wider whitespace-nowrap ">
                      <Calculator className="w-3 h-3" />
                      <span>Solver</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="h-[52px] w-px bg-[#2a2a2a]"></div>

                {/* Stats Section */}
                {!solverEnabled ? (
                  /* Fixed Attribute Mode */
                  <div className="flex items-start gap-5">
                    <FixedStatInput label="STR" stat="str" config={statConfigs.str} classMin={classData.str} />
                    <FixedStatInput label="DEX" stat="dex" config={statConfigs.dex} classMin={classData.dex} />
                    <FixedStatInput label="INT" stat="int" config={statConfigs.int} classMin={classData.int} />
                    <FixedStatInput label="FAI" stat="fai" config={statConfigs.fai} classMin={classData.fai} />
                    <FixedStatInput label="ARC" stat="arc" config={statConfigs.arc} classMin={classData.arc} />
                  </div>
                ) : (
                  /* Solver Mode */
                  <>
                    <div className="flex items-start gap-5">
                      <RangeStatInput label="STR" stat="str" config={statConfigs.str} classMin={classData.str} />
                      <RangeStatInput label="DEX" stat="dex" config={statConfigs.dex} classMin={classData.dex} />
                      <RangeStatInput label="INT" stat="int" config={statConfigs.int} classMin={classData.int} />
                      <RangeStatInput label="FAI" stat="fai" config={statConfigs.fai} classMin={classData.fai} />
                      <RangeStatInput label="ARC" stat="arc" config={statConfigs.arc} classMin={classData.arc} />
                    </div>

                    <div className="h-[52px] w-px bg-[#2a2a2a]"></div>

                    <div className="flex items-start gap-5">
                      {/* Class */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[#8b8b8b] text-xs uppercase tracking-wider">
                          Class
                        </label>
                        <Select value={startingClass} onValueChange={(v) => setStartingClass(v as StartingClass)}>
                          <SelectTrigger className="w-[100px] bg-[#1a1a1a] border-[#3a3a3a]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                            {STARTING_CLASS_LIST.map(cls => (
                              <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Level */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[#8b8b8b] text-xs uppercase tracking-wider">
                          Level
                        </label>
                        <NumericInput
                          value={level}
                          onValueChange={setLevel}
                          min={classData.lvl}
                          max={713}
                          fallback={classData.lvl}
                          className="w-[54px] bg-[#1a1a1a] border border-[#3a3a3a] rounded px-2 py-1.5 text-center text-base md:text-sm focus:outline-none focus:border-[#d4af37]"
                        />
                      </div>

                      <FixedStatInput label="VIG" stat="vig" config={statConfigs.vig} classMin={classData.vig} />
                      <FixedStatInput label="MND" stat="mnd" config={statConfigs.mnd} classMin={classData.min} />
                      <FixedStatInput label="END" stat="end" config={statConfigs.end} classMin={classData.end} />
                    </div>

                    <div className="h-[52px] w-px bg-[#2a2a2a]"></div>

                    {/* Available Points Display */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[#8b8b8b] text-xs uppercase tracking-wider">
                        Available Points
                      </label>
                      <div className={`px-3 py-1.5 text-center font-medium ${availablePoints < 0
                          ? 'text-[#ff6b6b]'
                          : 'text-[#d4af37]'
                        }`}>
                        {availablePoints}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}