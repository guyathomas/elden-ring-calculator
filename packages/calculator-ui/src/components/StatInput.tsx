import { Lock, Unlock } from 'lucide-react';
import type { StatConfig } from '../types';
import { isStatLocked, getStatValue } from '../types';
import { NumericInput } from './ui/numeric-input.js';

interface StatInputProps {
  label: string;
  stat: string;
  config: StatConfig;
  onChange: (config: StatConfig) => void;
  isDamageStat: boolean;
}

export function StatInput({ label, config, onChange, isDamageStat }: StatInputProps) {
  const locked = isStatLocked(config);

  const toggleLock = () => {
    if (locked) {
      // Unlock: convert to range
      const value = getStatValue(config);
      onChange({
        min: Math.max(10, value - 10),
        max: Math.min(99, value + 10),
      });
    } else {
      // Lock: pin to single value (use min as the locked value)
      onChange({
        min: config.min,
        max: config.min,
      });
    }
  };

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded p-2">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[#d4af37] text-xs uppercase tracking-wider">{label}</label>
        {isDamageStat && (
          <button
            onClick={toggleLock}
            className="p-2 hover:bg-[#2a2a2a] rounded transition-colors"
            title={locked ? 'Unlock (optimize)' : 'Lock (fixed)'}
          >
            {locked ? (
              <Lock className="w-3 h-3 text-[#8b8b8b]" />
            ) : (
              <Unlock className="w-3 h-3 text-[#d4af37]" />
            )}
          </button>
        )}
      </div>

      {locked ? (
        <NumericInput
          value={getStatValue(config)}
          onValueChange={(v) => onChange({ min: v, max: v })}
          min={1}
          max={99}
          fallback={10}
          className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded px-2 py-1.5 text-center text-base md:text-sm focus:outline-none focus:border-[#d4af37]"
        />
      ) : (
        <div className="flex flex-col gap-1">
          <div>
            <div className="text-[10px] text-[#6a6a6a] mb-0.5">Min</div>
            <NumericInput
              value={config.min}
              onValueChange={(v) => onChange({ min: v, max: config.max })}
              min={1}
              max={99}
              fallback={10}
              className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded px-2 py-1 text-center text-base md:text-xs focus:outline-none focus:border-[#d4af37]"
            />
          </div>
          <div>
            <div className="text-[10px] text-[#6a6a6a] mb-0.5">Max</div>
            <NumericInput
              value={config.max}
              onValueChange={(v) => onChange({ min: config.min, max: v })}
              min={1}
              max={99}
              fallback={99}
              className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded px-2 py-1 text-center text-base md:text-xs focus:outline-none focus:border-[#d4af37]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
