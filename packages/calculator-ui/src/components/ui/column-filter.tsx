import { Filter, X } from "lucide-react";
import * as React from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

// Types for different filter modes
export type FilterValue =
  | { type: "set"; values: Set<string> } // For categorical columns
  | { type: "range"; min?: number; max?: number } // For numeric columns
  | { type: "boolean"; value: boolean | null } // For boolean columns (null = no filter)
  | { type: "text"; value: string }; // For text search columns

export interface ColumnFilterProps {
  columnKey: string;
  filterType: "set" | "range" | "boolean" | "text";
  value: FilterValue | undefined;
  onChange: (value: FilterValue | undefined) => void;
  // For set filters - the available options
  options?: string[];
  // For range filters - optional bounds
  minBound?: number;
  maxBound?: number;
  // For text filters - placeholder
  placeholder?: string;
  // For boolean filters - custom labels
  booleanLabels?: { true: string; false: string };
  // Visual options
  className?: string;
}

export function ColumnFilter({
  columnKey,
  filterType,
  value,
  onChange,
  options = [],
  minBound,
  maxBound,
  placeholder,
  booleanLabels,
  className,
}: ColumnFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const hasFilter =
    value !== undefined &&
    ((value.type === "set" &&
      value.values.size > 0 &&
      // When there's only 1 option, selecting it IS a filter (not "show all")
      (value.values.size < options.length || options.length === 1)) ||
      (value.type === "range" &&
        (value.min !== undefined || value.max !== undefined)) ||
      (value.type === "boolean" && value.value !== null) ||
      (value.type === "text" && value.value.length > 0));

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(lower));
  }, [options, searchTerm]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center justify-center rounded p-0.5 transition-colors",
            hasFilter
              ? "text-[#d4af37] bg-[#d4af37]/20"
              : "text-[#5a5a5a] hover:text-[#8b8b8b]",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2 bg-[#1a1a1a] border-[#3a3a3a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8b8b8b] uppercase tracking-wider">
              Filter
            </span>
            {hasFilter && filterType !== "set" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-[#8b8b8b] hover:text-[#e8e6e3]"
                onClick={handleClear}
              >
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>

          {filterType === "set" && (
            <SetFilter
              options={filteredOptions}
              allOptions={options}
              value={value?.type === "set" ? value.values : undefined}
              onChange={(values) => {
                if (!values) {
                  onChange(undefined);
                } else {
                  onChange({ type: "set", values });
                }
              }}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          )}

          {filterType === "range" && (
            <RangeFilter
              value={value?.type === "range" ? value : { type: "range" }}
              onChange={(val) => {
                if (val.min === undefined && val.max === undefined) {
                  onChange(undefined);
                } else {
                  onChange(val);
                }
              }}
              minBound={minBound}
              maxBound={maxBound}
            />
          )}

          {filterType === "boolean" && (
            <BooleanFilter
              value={value?.type === "boolean" ? value.value : null}
              onChange={(val) => {
                if (val === null) {
                  onChange(undefined);
                } else {
                  onChange({ type: "boolean", value: val });
                }
              }}
              labels={booleanLabels}
            />
          )}

          {filterType === "text" && (
            <TextFilter
              value={value?.type === "text" ? value.value : ""}
              onChange={(val) => {
                if (val.length === 0) {
                  onChange(undefined);
                } else {
                  onChange({ type: "text", value: val });
                }
              }}
              placeholder={placeholder}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Set filter component for categorical columns
interface SetFilterProps {
  options: string[];
  allOptions: string[];
  value: Set<string> | undefined;
  onChange: (values: Set<string> | undefined) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

function SetFilter({
  options,
  allOptions,
  value,
  onChange,
  searchTerm,
  onSearchChange,
}: SetFilterProps) {
  const allSelected = value === undefined;
  const selectedOption =
    value && value.size === 1 ? [...value][0] : null;

  return (
    <div className="space-y-1">
      {allOptions.length > 8 && (
        <Input
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 text-xs bg-[#0d0d0d] border-[#3a3a3a] text-[#e8e6e3] placeholder:text-[#5a5a5a] mb-1"
        />
      )}
      <label className="flex items-center gap-2 p-1 rounded hover:bg-[#2a2a2a] cursor-pointer">
        <input
          type="radio"
          name="set-filter"
          checked={allSelected}
          onChange={() => onChange(undefined)}
          className="accent-[#d4af37]"
        />
        <span className="text-xs text-[#e8e6e3]">All</span>
      </label>
      <div className="overflow-y-auto space-y-1 max-h-[min(300px,50vh)]">
        {options.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2 p-1 rounded hover:bg-[#2a2a2a] cursor-pointer"
            title={option}
          >
            <input
              type="radio"
              name="set-filter"
              checked={selectedOption === option}
              onChange={() => onChange(new Set([option]))}
              className="accent-[#d4af37]"
            />
            <span className="text-xs text-[#e8e6e3] truncate">
              {option || "(empty)"}
            </span>
          </label>
        ))}
        {options.length === 0 && (
          <div className="text-xs text-[#5a5a5a] text-center py-2">
            No matches
          </div>
        )}
      </div>
    </div>
  );
}

// Range filter component for numeric columns
interface RangeFilterProps {
  value: { type: "range"; min?: number; max?: number };
  onChange: (value: { type: "range"; min?: number; max?: number }) => void;
  minBound?: number;
  maxBound?: number;
}

function RangeFilter({
  value,
  onChange,
  minBound,
  maxBound,
}: RangeFilterProps) {
  const [minInput, setMinInput] = React.useState(value.min?.toString() ?? "");
  const [maxInput, setMaxInput] = React.useState(value.max?.toString() ?? "");

  // Update inputs when value changes externally
  React.useEffect(() => {
    setMinInput(value.min?.toString() ?? "");
    setMaxInput(value.max?.toString() ?? "");
  }, [value.min, value.max]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMinInput(val);
    const num = Number.parseFloat(val);
    onChange({
      type: "range",
      min: Number.isNaN(num) ? undefined : num,
      max: value.max,
    });
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMaxInput(val);
    const num = Number.parseFloat(val);
    onChange({
      type: "range",
      min: value.min,
      max: Number.isNaN(num) ? undefined : num,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs text-[#5a5a5a] block mb-1">Min</label>
          <Input
            type="number"
            placeholder={minBound?.toString() ?? "Min"}
            value={minInput}
            onChange={handleMinChange}
            className="h-7 text-xs bg-[#0d0d0d] border-[#3a3a3a] text-[#e8e6e3] placeholder:text-[#5a5a5a]"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-[#5a5a5a] block mb-1">Max</label>
          <Input
            type="number"
            placeholder={maxBound?.toString() ?? "Max"}
            value={maxInput}
            onChange={handleMaxChange}
            className="h-7 text-xs bg-[#0d0d0d] border-[#3a3a3a] text-[#e8e6e3] placeholder:text-[#5a5a5a]"
          />
        </div>
      </div>
    </div>
  );
}

// Boolean filter component
interface BooleanFilterProps {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  labels?: { true: string; false: string };
}

function BooleanFilter({ value, onChange, labels }: BooleanFilterProps) {
  const trueLabel = labels?.true ?? "Yes";
  const falseLabel = labels?.false ?? "No";

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 p-1 rounded hover:bg-[#2a2a2a] cursor-pointer">
        <input
          type="radio"
          name="boolean-filter"
          checked={value === null}
          onChange={() => onChange(null)}
          className="accent-[#d4af37]"
        />
        <span className="text-xs text-[#e8e6e3]">All</span>
      </label>
      <label className="flex items-center gap-2 p-1 rounded hover:bg-[#2a2a2a] cursor-pointer">
        <input
          type="radio"
          name="boolean-filter"
          checked={value === true}
          onChange={() => onChange(true)}
          className="accent-[#d4af37]"
        />
        <span className="text-xs text-[#e8e6e3]">{trueLabel}</span>
      </label>
      <label className="flex items-center gap-2 p-1 rounded hover:bg-[#2a2a2a] cursor-pointer">
        <input
          type="radio"
          name="boolean-filter"
          checked={value === false}
          onChange={() => onChange(false)}
          className="accent-[#d4af37]"
        />
        <span className="text-xs text-[#e8e6e3]">{falseLabel}</span>
      </label>
    </div>
  );
}

// Text filter component for text search columns
interface TextFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function TextFilter({ value, onChange, placeholder }: TextFilterProps) {
  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder={placeholder ?? "Search..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs bg-[#0d0d0d] border-[#3a3a3a] text-[#e8e6e3] placeholder:text-[#5a5a5a]"
        autoFocus
      />
    </div>
  );
}
