import type { StatConfig, StartingClass } from '../types';
import { INITIAL_CLASS_VALUES, STARTING_CLASS_LIST, getStatValue, isStatLocked, lockAllDamageStats, unlockAllDamageStats } from '../types';
import { Calculator, ChevronDown, ChevronUp, Lock, Unlock } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';
import { NumericInput } from './ui/numeric-input.js';

interface StatInputPanelProps {
  level: number;
  setLevel: (level: number) => void;
  startingClass: StartingClass;
  setStartingClass: (startingClass: StartingClass) => void;
  statConfigs: Record<string, StatConfig>;
  onStatConfigChange: (stat: string, config: StatConfig) => void;
  twoHanding?: boolean;
  onTwoHandingToggle?: (enabled: boolean) => void;
}

export function StatInputPanel({ level, setLevel, startingClass, setStartingClass, statConfigs, onStatConfigChange }: StatInputPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const classData = INITIAL_CLASS_VALUES[startingClass];

  // Calculate available points using the proper formula
  // spendablePoints = classTotal - classLvl + currentLvl - vig - mnd - end
  const vig = getStatValue(statConfigs.vig);
  const mnd = getStatValue(statConfigs.mnd);
  const end = getStatValue(statConfigs.end);
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
    const isError = getStatValue(config) < classMin;

    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[#8b8b8b] text-xs uppercase tracking-wider">
          {label}
        </label>
        <div className="relative">
          <NumericInput
            value={getStatValue(config)}
            onValueChange={(v) => onStatConfigChange(stat, { min: v, max: v })}
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
    const locked = isStatLocked(config);
    const value = getStatValue(config);
    const isError = config.min < classMin;

    const toggleLock = () => {
      if (locked) {
        onStatConfigChange(stat, { min: classMin, max: 99 });
      } else {
        onStatConfigChange(stat, { min: config.min, max: config.min });
      }
    };

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className={`text-xs uppercase tracking-wider ${locked ? 'text-[#8b8b8b]' : 'text-[#d4af37]'}`}>
            {label}
          </label>
          <button
            onClick={toggleLock}
            className="p-0.5 hover:bg-[#2a2a2a] rounded transition-colors"
            title={locked ? 'Unlock (optimize this stat)' : 'Lock (fix this stat)'}
          >
            {locked ? (
              <Lock className="w-3 h-3 text-[#8b8b8b]" />
            ) : (
              <Unlock className="w-3 h-3 text-[#d4af37]" />
            )}
          </button>
        </div>
        {locked ? (
          <div className="relative">
            <NumericInput
              value={value}
              onValueChange={(v) => onStatConfigChange(stat, { min: v, max: v })}
              min={1}
              max={99}
              fallback={10}
              className={`w-full bg-[#1a1a1a] border rounded px-2 py-1.5 text-center text-base md:text-sm focus:outline-none ${isError ? 'input-error' : 'border-[#3a3a3a] focus:border-[#d4af37]'}`}
            />
            {isError && (
              <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-error whitespace-nowrap">
                Min: {classMin}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <NumericInput
                value={config.min}
                onValueChange={(v) => onStatConfigChange(stat, { min: v, max: config.max })}
                min={1}
                max={99}
                fallback={10}
                className={`w-full bg-[#1a1a1a] border rounded px-2 py-1.5 text-center text-base md:text-sm focus:outline-none ${isError ? 'input-error' : 'border-[#3a3a3a] focus:border-[#d4af37]'}`}
              />
              {isError && (
                <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-error whitespace-nowrap">
                  Min: {classMin}
                </div>
              )}
            </div>
            <span className="text-[#4a4a4a] text-[10px]">—</span>
            <NumericInput
              value={config.max}
              onValueChange={(v) => onStatConfigChange(stat, { min: config.min, max: v })}
              min={1}
              max={99}
              fallback={99}
              className="w-[54px] lg:w-[54px] flex-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded px-2 py-1.5 text-center text-base md:text-sm focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        )}
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
            <Calculator className="w-3 h-3 text-[#d4af37]" />
            <span className="text-[#d4af37] text-xs uppercase tracking-wider">Solver</span>
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
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[#d4af37] text-xs uppercase tracking-wider">Damage Stats</div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => lockAllDamageStats(statConfigs, onStatConfigChange)}
                          className="p-0.5 hover:bg-[#2a2a2a] rounded transition-colors"
                          title="Lock all damage stats"
                        >
                          <Lock className="w-3 h-3 text-[#8b8b8b]" />
                        </button>
                        <button
                          onClick={() => unlockAllDamageStats(statConfigs, classData, onStatConfigChange)}
                          className="p-0.5 hover:bg-[#2a2a2a] rounded transition-colors"
                          title="Unlock all damage stats"
                        >
                          <Unlock className="w-3 h-3 text-[#d4af37]" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#6a6a6a] mb-2">Unlock stats for the solver to optimize</p>
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
              </div>

              {/* Desktop Layout */}
              <div className="hidden lg:flex items-start gap-8">
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
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
