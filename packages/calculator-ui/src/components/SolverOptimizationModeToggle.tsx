import { cn } from './ui/utils.js';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group.js';
import type { SolverOptimizationMode } from '../types/solverTypes.js';

interface SolverOptimizationModeToggleProps {
  mode: SolverOptimizationMode;
  onChange: (mode: SolverOptimizationMode) => void;
  spDisabled?: boolean;
  spDisabledReason?: string;
  aowDisabled?: boolean;
  aowDisabledReason?: string;
  className?: string;
}

/**
 * Toggle component for selecting what the solver should optimize for.
 * 
 * - AR: Attack Rating (always available)
 * - SP: Spell Power (disabled unless catalysts are in weapon filter)
 * - AoW: Ash of War damage (disabled unless an AoW is selected)
 */
export function SolverOptimizationModeToggle({
  mode,
  onChange,
  spDisabled = false,
  spDisabledReason = 'Select a catalyst weapon type to enable',
  aowDisabled = false,
  aowDisabledReason = 'Select an Ash of War to enable',
  className,
}: SolverOptimizationModeToggleProps) {
  const options = [
    { value: 'AR' as const, label: 'AR', disabled: false },
    { value: 'SP' as const, label: 'SP', disabled: spDisabled },
    { value: 'AoW' as const, label: 'AoW', disabled: aowDisabled },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-[#8b8b8b] text-[10px] uppercase tracking-wider font-medium">
        Optimize For
      </label>
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => { if (v) onChange(v as SolverOptimizationMode); }}
        variant="subtle"
        size="touch"
        className="rounded border border-[#333] bg-[#141414] p-1"
      >
        {options.map(({ value, label, disabled }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            disabled={disabled}
            className="flex-1 text-xs uppercase tracking-wider"
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {aowDisabled && (
        <p className="text-[#8b8b8b] text-[10px]">{aowDisabledReason}</p>
      )}
    </div>
  );
}
