/**
 * MobileFiltersTab - Filter and sort controls for mobile weapon card view
 *
 * This component provides filtering and sorting capabilities optimized for
 * mobile devices, displayed in a tab within the mobile drawer.
 */

import { Search, ArrowUpDown, ChevronUp, ChevronDown, Sword, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.js';
import { Checkbox } from './ui/checkbox.js';

// Sort options for the mobile card view
export const SORT_OPTIONS = [
  { value: 'totalAR', label: 'Attack Power' },
  { value: 'name', label: 'Name' },
  { value: 'physical', label: 'Physical' },
  { value: 'magic', label: 'Magic' },
  { value: 'fire', label: 'Fire' },
  { value: 'lightning', label: 'Lightning' },
  { value: 'holy', label: 'Holy' },
  { value: 'weight', label: 'Weight' },
  { value: 'bleed', label: 'Bleed' },
  { value: 'frost', label: 'Frost' },
  { value: 'poison', label: 'Poison' },
  { value: 'strReq', label: 'STR Required' },
  { value: 'dexReq', label: 'DEX Required' },
  { value: 'intReq', label: 'INT Required' },
  { value: 'faiReq', label: 'FAI Required' },
  { value: 'arcReq', label: 'ARC Required' },
  { value: 'spellScaling', label: 'Spell Scaling' },
];

// Props interface for MobileFiltersTab
export interface MobileFiltersTabProps {
  // Sort
  sortKey: string;
  onSortKeyChange: (key: string) => void;
  sortDirection: 'asc' | 'desc';
  onSortDirectionChange: (direction: 'asc' | 'desc') => void;
  // Search
  searchText: string;
  onSearchTextChange: (text: string) => void;
  // Range filters
  weightRange: { min?: number; max?: number };
  onWeightRangeChange: (range: { min?: number; max?: number }) => void;
  arRange: { min?: number; max?: number };
  onARRangeChange: (range: { min?: number; max?: number }) => void;
  // Boolean filters
  buffableFilter: boolean | null;
  onBuffableFilterChange: (value: boolean | null) => void;
  meetsReqsFilter: boolean | null;
  onMeetsReqsFilterChange: (value: boolean | null) => void;
  // Set filters
  categoryFilter: Set<string>;
  onCategoryFilterChange: (categories: Set<string>) => void;
  affinityFilter: Set<string>;
  onAffinityFilterChange: (affinities: Set<string>) => void;
  damageTypeFilter: Set<string>;
  onDamageTypeFilterChange: (types: Set<string>) => void;
  statusEffectFilter: Set<string>;
  onStatusEffectFilterChange: (effects: Set<string>) => void;
  // Available options
  availableCategories: string[];
  availableAffinities: string[];
  availableDamageTypes: string[];
  availableStatusEffects: string[];
}

// Range filter input component
function RangeFilterInput({
  label,
  min,
  max,
  onChange,
}: {
  label: string;
  min?: number;
  max?: number;
  onChange: (range: { min?: number; max?: number }) => void;
}) {
  return (
    <div className="mb-4">
      <label className="text-xs text-[#8b8b8b] uppercase tracking-wider mb-2 block">{label}</label>
      <div className="flex flex-row items-center gap-2">
        <input
          type="number"
          placeholder="Min"
          value={min ?? ''}
          onChange={(e) => onChange({ min: e.target.value ? Number(e.target.value) : undefined, max })}
          className="flex-1 min-w-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-base md:text-sm text-[#e8e6e3] placeholder-[#6a6a6a] focus:outline-none focus:border-[#d4af37]"
        />
        <span className="text-[#6a6a6a] flex-shrink-0">–</span>
        <input
          type="number"
          placeholder="Max"
          value={max ?? ''}
          onChange={(e) => onChange({ min, max: e.target.value ? Number(e.target.value) : undefined })}
          className="flex-1 min-w-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-base md:text-sm text-[#e8e6e3] placeholder-[#6a6a6a] focus:outline-none focus:border-[#d4af37]"
        />
      </div>
    </div>
  );
}

// Boolean filter component
function BooleanFilterSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <div className="mb-4">
      <label className="text-xs text-[#8b8b8b] uppercase tracking-wider mb-2 block">{label}</label>
      <Select
        value={value === null ? 'all' : value ? 'yes' : 'no'}
        onValueChange={(v) => onChange(v === 'all' ? null : v === 'yes')}
      >
        <SelectTrigger className="w-full bg-[#1a1a1a] border-[#2a2a2a]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent portal={false} className="bg-[#1a1a1a] border-[#2a2a2a] text-[#e8e6e3]">
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="yes">Yes</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// Checkbox list filter component
function CheckboxListFilter({
  label,
  icon: Icon,
  items,
  selectedItems,
  onToggle,
  onSetAll,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: string[];
  selectedItems: Set<string>;
  onToggle: (item: string) => void;
  onSetAll: (items: Set<string>) => void;
}) {
  if (items.length === 0) return null;

  const allSelected = items.length > 0 && items.every((item) => selectedItems.has(item));

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-[#8b8b8b] uppercase tracking-wider flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
          {selectedItems.size > 0 && (
            <span className="text-[#d4af37]">({selectedItems.size})</span>
          )}
        </label>
        <button
          type="button"
          onClick={() => onSetAll(allSelected ? new Set() : new Set(items))}
          className="text-xs text-[#d4af37] hover:text-[#e8c44a]"
        >
          {allSelected ? 'Clear' : 'All'}
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto border border-[#2a2a2a] rounded bg-[#0a0a0a]">
        {items.map((item) => (
          <label
            key={item}
            className="flex items-center gap-2 px-3 py-2 hover:bg-[#1a1a1a] cursor-pointer border-b border-[#1a1a1a] last:border-b-0"
          >
            <Checkbox
              checked={selectedItems.has(item)}
              onCheckedChange={() => onToggle(item)}
              className="data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]"
              style={{ borderColor: selectedItems.has(item) ? '#d4af37' : 'rgba(212,175,55,0.5)' }}
            />
            <span className="text-sm text-[#e8e6e3]">{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function MobileFiltersTab({
  sortKey,
  onSortKeyChange,
  sortDirection,
  onSortDirectionChange,
  searchText,
  onSearchTextChange,
  weightRange,
  onWeightRangeChange,
  arRange,
  onARRangeChange,
  buffableFilter,
  onBuffableFilterChange,
  meetsReqsFilter,
  onMeetsReqsFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  affinityFilter,
  onAffinityFilterChange,
  damageTypeFilter,
  onDamageTypeFilterChange,
  statusEffectFilter,
  onStatusEffectFilterChange,
  availableCategories,
  availableAffinities,
  availableDamageTypes,
  availableStatusEffects,
}: MobileFiltersTabProps) {
  const handleSetToggle = (set: Set<string>, value: string, onChange: (s: Set<string>) => void) => {
    const newSet = new Set(set);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    onChange(newSet);
  };

  const clearAllFilters = () => {
    onCategoryFilterChange(new Set());
    onAffinityFilterChange(new Set());
    onSearchTextChange('');
    onWeightRangeChange({});
    onARRangeChange({});
    onBuffableFilterChange(null);
    onMeetsReqsFilterChange(null);
    onDamageTypeFilterChange(new Set());
    onStatusEffectFilterChange(new Set());
  };

  const hasActiveFilters =
    categoryFilter.size > 0 ||
    affinityFilter.size > 0 ||
    searchText.length > 0 ||
    weightRange.min !== undefined ||
    weightRange.max !== undefined ||
    arRange.min !== undefined ||
    arRange.max !== undefined ||
    buffableFilter !== null ||
    meetsReqsFilter !== null ||
    damageTypeFilter.size > 0 ||
    statusEffectFilter.size > 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {/* Sort */}
      <div className="mb-4">
        <label className="text-xs text-[#8b8b8b] uppercase tracking-wider mb-2 flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5" />
          Sort By
        </label>
        <div className="flex gap-2">
          <Select value={sortKey} onValueChange={onSortKeyChange}>
            <SelectTrigger className="flex-1 bg-[#1a1a1a] border-[#2a2a2a]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent portal={false} className="bg-[#1a1a1a] border-[#2a2a2a] text-[#e8e6e3]">
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded hover:bg-[#2a2a2a] transition-colors"
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDirection === 'asc' ? (
              <ChevronUp className="w-4 h-4 text-[#e8e6e3]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#e8e6e3]" />
            )}
          </button>
        </div>
      </div>

      {/* Clear Filters Button - shown when filters are active */}
      {hasActiveFilters && (
        <button
          onClick={clearAllFilters}
          className="w-full mb-4 px-3 py-2 text-sm text-[#c9302c] border border-[#c9302c]/30 rounded hover:bg-[#c9302c]/10 transition-colors"
        >
          Clear All Filters
        </button>
      )}

      {/* Search */}
      <div className="mb-4">
        <label className="text-xs text-[#8b8b8b] uppercase tracking-wider mb-2 flex items-center gap-2">
          <Search className="w-3.5 h-3.5" />
          Search
        </label>
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchTextChange(e.target.value)}
          placeholder="Search weapons..."
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-base md:text-sm text-[#e8e6e3] placeholder-[#6a6a6a] focus:outline-none focus:border-[#d4af37]"
        />
      </div>

      {/* Range Filters */}
      <RangeFilterInput
        label="Attack Power"
        min={arRange.min}
        max={arRange.max}
        onChange={onARRangeChange}
      />
      <RangeFilterInput
        label="Weight"
        min={weightRange.min}
        max={weightRange.max}
        onChange={onWeightRangeChange}
      />

      {/* Boolean Filters */}
      <BooleanFilterSelect
        label="Buffable"
        value={buffableFilter}
        onChange={onBuffableFilterChange}
      />
      <BooleanFilterSelect
        label="Meets Requirements"
        value={meetsReqsFilter}
        onChange={onMeetsReqsFilterChange}
      />

      {/* Category Filter */}
      <CheckboxListFilter
        label="Weapon Type"
        icon={Sword}
        items={availableCategories}
        selectedItems={categoryFilter}
        onToggle={(item) => handleSetToggle(categoryFilter, item, onCategoryFilterChange)}
        onSetAll={onCategoryFilterChange}
      />

      {/* Affinity Filter */}
      <CheckboxListFilter
        label="Affinity"
        icon={Filter}
        items={availableAffinities}
        selectedItems={affinityFilter}
        onToggle={(item) => handleSetToggle(affinityFilter, item, onAffinityFilterChange)}
        onSetAll={onAffinityFilterChange}
      />

      {/* Damage Type Filter */}
      <CheckboxListFilter
        label="Damage Type"
        items={availableDamageTypes}
        selectedItems={damageTypeFilter}
        onToggle={(item) => handleSetToggle(damageTypeFilter, item, onDamageTypeFilterChange)}
        onSetAll={onDamageTypeFilterChange}
      />

      {/* Status Effect Filter */}
      <CheckboxListFilter
        label="Status Effects"
        items={availableStatusEffects}
        selectedItems={statusEffectFilter}
        onToggle={(item) => handleSetToggle(statusEffectFilter, item, onStatusEffectFilterChange)}
        onSetAll={onStatusEffectFilterChange}
      />

      {/* iOS safe area spacer */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
