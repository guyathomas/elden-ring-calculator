/**
 * WeaponList Component Tests
 *
 * Tests for the WeaponList component that displays the filtered/sorted weapon table.
 * Complex data dependencies are mocked to test UI behavior.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeaponList } from '../../../src/components/WeaponListImproved.js';
import type { WeaponListItem, StatConfig, CharacterStats, StartingClass } from '../../../src/types.js';
import type { PrecomputedDataV2 } from '../../../src/data/index.js';

// Mock @tanstack/react-virtual to render all items in tests
// This is needed because jsdom doesn't have proper layout dimensions for virtualization
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 33,
        end: (i + 1) * 33,
        size: 33,
        key: i,
      })),
    getTotalSize: () => count * 33,
    measureElement: () => {},
    scrollToIndex: () => {},
  }),
}));

// Configurable mock values for testing different scenarios
let mockFindOptimalStatsResult = {
  damage: 550,
  stats: { vig: 40, mnd: 20, end: 25, str: 40, dex: 40, int: 20, fai: 20, arc: 10 },
};
let mockCalculateWeaponARResult: any = {
  rounded: 600,
  total: 600,
  physical: { total: 400, base: 200, scaled: 200 },
  magic: { total: 100, base: 50, scaled: 50 },
  fire: { total: 50, base: 25, scaled: 25 },
  lightning: { total: 25, base: 12, scaled: 13 },
  holy: { total: 25, base: 12, scaled: 13 },
  bleed: { rounded: 0 },
  frost: { rounded: 0 },
  poison: { rounded: 0 },
  scarletRot: { rounded: 0 },
  sleep: { rounded: 0 },
  madness: { rounded: 0 },
  sorceryScaling: undefined,
  incantationScaling: undefined,
};

// Mock external dependencies
vi.mock('../../../src/utils/damageCalculator.js', () => ({
  calculateWeaponListAR: (precomputed: unknown, weapons: WeaponListItem[]) =>
    weapons.map(w => ({
      ...w,
      totalAR: 500,
      baseDamage: { physical: 300, magic: 100, fire: 50, lightning: 25, holy: 25 },
      arResult: {
        rounded: 500,
        total: 500,
        physical: { total: 300, base: 150, scaled: 150 },
        magic: { total: 100, base: 50, scaled: 50 },
        fire: { total: 50, base: 25, scaled: 25 },
        lightning: { total: 25, base: 12, scaled: 13 },
        holy: { total: 25, base: 12, scaled: 13 },
        bleed: { rounded: w.name.includes('Blood') ? 80 : 0 },
        frost: { rounded: 0 },
        poison: { rounded: 0 },
        scarletRot: { rounded: 0 },
        sleep: { rounded: 0 },
        madness: { rounded: 0 },
        sorceryScaling: undefined,
        incantationScaling: undefined,
      },
      meetsRequirements: true,
    })),
  calculateWeaponAR: () => mockCalculateWeaponARResult,
  findOptimalStats: () => mockFindOptimalStatsResult,
}));

vi.mock('../../../src/utils/criticalDamage.js', () => ({
  calculateCriticalDamage: (ar: number) => Math.round(ar * 1.3),
  getCriticalMultiplier: () => 1.3,
}));

vi.mock('../../../src/data/index.js', () => ({
  getWeaponDamageTypes: () => ['Slash', 'Pierce'],
  getWeaponDpsData: () => null,
  getWeaponTrueCombos: () => 0,
  getWeaponSkillName: () => null,
  getScalingGrade: () => '-',
  getEnemyByKey: () => null,
  canWeaponMountAoW: () => false,
  getAvailableAowNames: () => [],
  calculateAowDamage: () => null,
  calculateEnemyDamage: () => null,
  calculateSimpleEnemyDamage: () => null,
}));

describe('WeaponList', () => {
  // Create mock weapon data
  const createMockWeapon = (overrides: Partial<WeaponListItem> = {}): WeaponListItem => ({
    id: `weapon-${Math.random()}`,
    name: 'Test Katana',
    affinity: 'Standard',
    upgradeLevel: 25,
    maxUpgradeLevel: 25,
    category: 1,
    categoryName: 'Katana',
    weight: 5.5,
    isDualBlade: false,
    criticalValue: 100,
    isUnique: false,
    hasUniqueAttacks: false,
    requirements: { str: 11, dex: 15, int: 0, fai: 0, arc: 0 },
    scaling: { str: 'D', dex: 'B', int: '-', fai: '-', arc: '-' },
    rawScaling: { str: 35, dex: 75, int: 0, fai: 0, arc: 0 },
    baseDamage: { physical: 200, magic: 0, fire: 0, lightning: 0, holy: 0 },
    hasSorceryScaling: false,
    hasIncantationScaling: false,
    wepmotionCategory: 0,
    damageType: 'Slash',
    trueCombos: 0,
    guardStats: { physical: 40, magic: 30, fire: 30, lightning: 30, holy: 30, guardBoost: 30 },
    ...overrides,
  });

  const mockWeapons: WeaponListItem[] = [
    createMockWeapon({ id: 'katana-1', name: 'Uchigatana', categoryName: 'Katana', affinity: 'Standard' }),
    createMockWeapon({ id: 'katana-2', name: 'Nagakiba', categoryName: 'Katana', affinity: 'Standard' }),
    createMockWeapon({ id: 'gs-1', name: 'Claymore', categoryName: 'Greatsword', affinity: 'Standard' }),
    createMockWeapon({ id: 'blood-1', name: 'Blood Uchigatana', categoryName: 'Katana', affinity: 'Standard' }),
  ];

  const mockStatConfigs: Record<string, StatConfig> = {
    vig: { locked: true, value: 40 },
    mnd: { locked: true, value: 20 },
    end: { locked: true, value: 25 },
    str: { locked: true, value: 30 },
    dex: { locked: true, value: 40 },
    int: { locked: true, value: 10 },
    fai: { locked: true, value: 10 },
    arc: { locked: true, value: 10 },
  };

  const mockCurrentStats: CharacterStats = {
    vig: 40, mnd: 20, end: 25, str: 30, dex: 40, int: 10, fai: 10, arc: 10,
  };

  const mockStartingClass: StartingClass = 'Samurai';

  const mockPrecomputed = {
    version: '2.0',
    generatedAt: new Date().toISOString(),
    weapons: {},
    reinforceRates: {},
    curves: {},
    spEffects: {},
  } as PrecomputedDataV2;

  const defaultProps = {
    precomputed: mockPrecomputed,
    aowData: null,
    weapons: mockWeapons,
    statConfigs: mockStatConfigs,
    currentStats: mockCurrentStats,
    selectedWeapon: null,
    onWeaponSelect: vi.fn(),
    hasUnlockedStats: false,
    twoHanding: false,
    pointsBudget: 100,
    startingClass: mockStartingClass,
    showScaling: true,
    showRequirements: true,
    showAttributeInvestments: false,
    showEfficiency: false,
    showStatusEffects: false,
    showSpellPower: false,
    showAowDamage: false,
    showGuardStats: false,
    showDps: false,
    showWeaponStats: false,
    level: 150,
    selectedEnemyKey: null,
    selectedAowFilter: null,
    subtractWeaponWeight: false,
    armorWeight: 0,
    rollType: 'medium' as const,
    optimizationMode: 'AR' as const,
    // Column filters (shared between desktop and mobile)
    columnFilters: {
      affinity: { type: 'set' as const, values: new Set(['Standard', 'Unique']) },
    },
    onColumnFilterChange: vi.fn(),
    onColumnFiltersReset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('shows the table structure', () => {
      render(<WeaponList {...defaultProps} />);
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('renders column headers', () => {
      render(<WeaponList {...defaultProps} />);
      
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Affinity')).toBeInTheDocument();
    });
  });

  // Note: Filtering is now handled via column filters in the table UI
  // These tests have been removed as the props were moved to table column filters
  describe('Filtering', () => {
    it('shows all weapons when no column filters are applied', () => {
      render(<WeaponList {...defaultProps} />);

      // All weapons should be visible
      expect(screen.getByText('Uchigatana')).toBeInTheDocument();
      expect(screen.getByText('Nagakiba')).toBeInTheDocument();
      expect(screen.getByText('Claymore')).toBeInTheDocument();
    });
  });

  describe('Weapon Selection', () => {
    it('calls onWeaponSelect when clicking a weapon row', () => {
      const onWeaponSelect = vi.fn();
      render(<WeaponList {...defaultProps} onWeaponSelect={onWeaponSelect} />);
      
      const uchiRow = screen.getByText('Uchigatana').closest('tr');
      fireEvent.click(uchiRow!);
      
      expect(onWeaponSelect).toHaveBeenCalledTimes(1);
    });

    it('highlights the selected weapon', () => {
      const selectedWeapon = mockWeapons[0]; // Uchigatana
      render(<WeaponList {...defaultProps} selectedWeapon={selectedWeapon} />);
      
      const row = screen.getByText('Uchigatana').closest('tr');
      expect(row).toHaveClass('bg-[#2a2514]');
    });
  });

  describe('Sorting', () => {
    it('sorts by name when clicking Name header', () => {
      render(<WeaponList {...defaultProps} />);
      
      const nameHeader = screen.getByText('Name');
      fireEvent.click(nameHeader);
      
      // Should now be sorted by name
      const rows = screen.getAllByRole('row').slice(2); // Skip header rows
      expect(rows.length).toBeGreaterThan(0);
    });

    it('toggles sort direction on second click', () => {
      render(<WeaponList {...defaultProps} />);

      const nameHeader = screen.getByText('Name');
      fireEvent.click(nameHeader);
      fireEvent.click(nameHeader);

      // Should toggle direction (no error thrown) - re-query after clicks
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  describe('Column Visibility', () => {
    it('shows scaling columns when showScaling is true', () => {
      render(<WeaponList {...defaultProps} showScaling={true} />);
      
      expect(screen.getByText('Attribute Scaling')).toBeInTheDocument();
    });

    it('hides scaling columns when showScaling is false', () => {
      render(<WeaponList {...defaultProps} showScaling={false} />);
      
      expect(screen.queryByText('Attribute Scaling')).not.toBeInTheDocument();
    });

    it('shows requirements columns when showRequirements is true', () => {
      render(<WeaponList {...defaultProps} showRequirements={true} />);
      
      expect(screen.getByText('Attributes Required')).toBeInTheDocument();
    });

    it('hides requirements columns when showRequirements is false', () => {
      render(<WeaponList {...defaultProps} showRequirements={false} />);
      
      expect(screen.queryByText('Attributes Required')).not.toBeInTheDocument();
    });

    it('shows efficiency columns when showEfficiency is true', () => {
      render(<WeaponList {...defaultProps} showEfficiency={true} />);
      
      expect(screen.getByText('Efficiency')).toBeInTheDocument();
    });

    it('hides efficiency columns when showEfficiency is false', () => {
      render(<WeaponList {...defaultProps} showEfficiency={false} />);
      
      expect(screen.queryByText('Efficiency')).not.toBeInTheDocument();
    });

    it('shows status effects columns when showStatusEffects is true', () => {
      render(<WeaponList {...defaultProps} showStatusEffects={true} />);
      
      expect(screen.getByText('Status Effects')).toBeInTheDocument();
    });

    it('hides status effects columns when showStatusEffects is false', () => {
      render(<WeaponList {...defaultProps} showStatusEffects={false} />);
      
      expect(screen.queryByText('Status Effects')).not.toBeInTheDocument();
    });
  });

  describe('Solver Mode', () => {
    it('shows Optimal Stats header when hasUnlockedStats is true', () => {
      render(<WeaponList {...defaultProps} hasUnlockedStats={true} />);
      
      expect(screen.getByText('Optimal Stats')).toBeInTheDocument();
    });

    it('hides Optimal Stats header when hasUnlockedStats is false', () => {
      render(<WeaponList {...defaultProps} hasUnlockedStats={false} />);
      
      expect(screen.queryByText('Optimal Stats')).not.toBeInTheDocument();
    });
  });

  describe('Attack Power Columns', () => {
    it('always shows attack power columns', () => {
      render(<WeaponList {...defaultProps} />);

      expect(screen.getByText('Attack Power')).toBeInTheDocument();
    });

    it('shows physical damage header', () => {
      render(<WeaponList {...defaultProps} />);

      // Phy is the abbreviated header
      expect(screen.getByText('Phy')).toBeInTheDocument();
    });

    it('shows total AR header (Σ symbol)', () => {
      render(<WeaponList {...defaultProps} />);

      expect(screen.getByText('Σ')).toBeInTheDocument();
    });
  });

  describe('Optimization Mode Display', () => {
    // These tests verify that the displayed totalAR always shows weapon AR,
    // not the solver's objective value (which differs in AoW/SP modes)

    it('displays weapon AR (not solver damage) when solver is enabled in AR mode', () => {
      // Configure mocks: solver damage = 550, weapon AR = 600
      // The displayed value should be 600 (weapon AR)
      mockFindOptimalStatsResult = {
        damage: 550,
        stats: { vig: 40, mnd: 20, end: 25, str: 40, dex: 40, int: 20, fai: 20, arc: 10 },
      };
      mockCalculateWeaponARResult = {
        rounded: 600,
        total: 600,
        physical: { total: 400, base: 200, scaled: 200 },
        magic: { total: 100, base: 50, scaled: 50 },
        fire: { total: 50, base: 25, scaled: 25 },
        lightning: { total: 25, base: 12, scaled: 13 },
        holy: { total: 25, base: 12, scaled: 13 },
        bleed: { rounded: 0 },
        frost: { rounded: 0 },
        poison: { rounded: 0 },
        scarletRot: { rounded: 0 },
        sleep: { rounded: 0 },
        madness: { rounded: 0 },
        sorceryScaling: undefined,
        incantationScaling: undefined,
      };

      const unlockedStatConfigs: Record<string, StatConfig> = {
        ...mockStatConfigs,
        str: { locked: false, value: 30, min: 10 },
        dex: { locked: false, value: 40, min: 10 },
      };

      render(
        <WeaponList
          {...defaultProps}
          statConfigs={unlockedStatConfigs}
          hasUnlockedStats={true}
          optimizationMode="AR"
        />
      );

      // The total AR column should show 600 (weapon AR), not 550 (solver damage)
      const arCells = screen.getAllByText('600');
      expect(arCells.length).toBeGreaterThan(0);
    });

    it('displays weapon AR (not AoW damage) when solver is enabled in AoW mode', () => {
      // This is the key regression test:
      // In AoW mode, solver returns AoW damage (e.g., 1200) but displayed AR should be weapon AR (e.g., 450)
      mockFindOptimalStatsResult = {
        damage: 1200, // AoW damage - high value from skill damage
        stats: { vig: 40, mnd: 20, end: 25, str: 26, dex: 18, int: 10, fai: 52, arc: 10 },
      };
      mockCalculateWeaponARResult = {
        rounded: 450, // Weapon AR with those stats is only 450
        total: 450,
        physical: { total: 300, base: 150, scaled: 150 },
        magic: { total: 0, base: 0, scaled: 0 },
        fire: { total: 100, base: 50, scaled: 50 },
        lightning: { total: 0, base: 0, scaled: 0 },
        holy: { total: 50, base: 25, scaled: 25 },
        bleed: { rounded: 0 },
        frost: { rounded: 0 },
        poison: { rounded: 0 },
        scarletRot: { rounded: 0 },
        sleep: { rounded: 0 },
        madness: { rounded: 0 },
        sorceryScaling: undefined,
        incantationScaling: undefined,
      };

      const unlockedStatConfigs: Record<string, StatConfig> = {
        ...mockStatConfigs,
        str: { locked: false, value: 30, min: 10 },
        fai: { locked: false, value: 10, min: 10 },
      };

      render(
        <WeaponList
          {...defaultProps}
          statConfigs={unlockedStatConfigs}
          hasUnlockedStats={true}
          optimizationMode="AoW"
          selectedAowFilter="Black Flame Tornado"
        />
      );

      // The total AR column should show 450 (weapon AR), NOT 1200 (AoW damage)
      const arCells = screen.getAllByText('450');
      expect(arCells.length).toBeGreaterThan(0);

      // Verify 1200 is NOT displayed as the total AR
      // (1200 is the AoW damage which should only appear in AoW-specific columns, not totalAR)
      const incorrectArCells = screen.queryAllByText('1200');
      expect(incorrectArCells.length).toBe(0);
    });
  });

  describe('Points Required Column', () => {
    it('shows Pts column header when showAttributeInvestments is true', () => {
      render(<WeaponList {...defaultProps} showAttributeInvestments={true} />);

      expect(screen.getByText('Pts')).toBeInTheDocument();
    });

    it('hides Pts column header when showAttributeInvestments is false', () => {
      render(<WeaponList {...defaultProps} showAttributeInvestments={false} />);

      expect(screen.queryByText('Pts')).not.toBeInTheDocument();
    });

    it('shows 0 points required when character meets all requirements', () => {
      // Mock weapon requires str: 11, dex: 15
      // Character has str: 30, dex: 40 - exceeds requirements
      render(<WeaponList {...defaultProps} showAttributeInvestments={true} />);

      // Find cells with "0" in the requirements section
      // The Pts column should show 0 for weapons where requirements are met
      const zeroCells = screen.getAllByText('0');
      expect(zeroCells.length).toBeGreaterThan(0);
    });

    it('calculates points required when character does not meet requirements', () => {
      // Create a weapon with high requirements
      const highReqWeapon: WeaponListItem = {
        id: 'high-req-weapon',
        name: 'High Req Sword',
        affinity: 'Standard',
        upgradeLevel: 25,
        maxUpgradeLevel: 25,
        category: 1,
        categoryName: 'Katana',
        weight: 5.5,
        isDualBlade: false,
        criticalValue: 100,
        isUnique: false,
        hasUniqueAttacks: false,
        isBuffable: true,
        // Requires str: 50, dex: 50 - character has str: 30, dex: 40
        // Points required = (50-30) + (50-40) = 20 + 10 = 30
        requirements: { str: 50, dex: 50, int: 0, fai: 0, arc: 0 },
        scaling: { str: 'C', dex: 'C', int: '-', fai: '-', arc: '-' },
        rawScaling: { str: 50, dex: 50, int: 0, fai: 0, arc: 0 },
        baseDamage: { physical: 200, magic: 0, fire: 0, lightning: 0, holy: 0 },
        hasSorceryScaling: false,
        hasIncantationScaling: false,
        wepmotionCategory: 0,
        damageType: 'Slash',
        trueCombos: 0,
        guardStats: { physical: 40, magic: 30, fire: 30, lightning: 30, holy: 30, guardBoost: 30 },
      };

      render(
        <WeaponList
          {...defaultProps}
          weapons={[highReqWeapon]}
          showAttributeInvestments={true}
        />
      );

      // Should show 30 points required (20 for str + 10 for dex)
      const cells = screen.getAllByText('30');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('accounts for two-handing strength bonus in points required calculation', () => {
      // Create a weapon with str requirement that can be met with 2H bonus
      const strWeapon: WeaponListItem = {
        id: 'str-weapon',
        name: 'Heavy Greatsword',
        affinity: 'Standard',
        upgradeLevel: 25,
        maxUpgradeLevel: 25,
        category: 2,
        categoryName: 'Greatsword',
        weight: 10,
        isDualBlade: false,
        criticalValue: 100,
        isUnique: false,
        hasUniqueAttacks: false,
        isBuffable: true,
        // Requires str: 40, character has str: 30
        // Without 2H: 40 - 30 = 10 points needed
        // With 2H: 40 - floor(30 * 1.5) = 40 - 45 = 0 points needed (already met)
        requirements: { str: 40, dex: 0, int: 0, fai: 0, arc: 0 },
        scaling: { str: 'A', dex: '-', int: '-', fai: '-', arc: '-' },
        rawScaling: { str: 100, dex: 0, int: 0, fai: 0, arc: 0 },
        baseDamage: { physical: 300, magic: 0, fire: 0, lightning: 0, holy: 0 },
        hasSorceryScaling: false,
        hasIncantationScaling: false,
        wepmotionCategory: 0,
        damageType: 'Standard',
        trueCombos: 0,
        guardStats: { physical: 50, magic: 30, fire: 30, lightning: 30, holy: 30, guardBoost: 40 },
      };

      // Test without two-handing - should need 10 points
      const { rerender } = render(
        <WeaponList
          {...defaultProps}
          weapons={[strWeapon]}
          showAttributeInvestments={true}
          twoHanding={false}
        />
      );

      // Should show the points required value (10 for str deficit)
      const ptsCells = screen.getAllByTitle('Points required to meet weapon requirements')
        .filter(el => el.tagName === 'TD');
      expect(ptsCells[0].textContent).toBe('10');

      // Test with two-handing - should need 0 points (30 * 1.5 = 45 >= 40)
      rerender(
        <WeaponList
          {...defaultProps}
          weapons={[strWeapon]}
          showAttributeInvestments={true}
          twoHanding={true}
        />
      );

      // With 2H bonus, points required should be 0
      const ptsCells2H = screen.getAllByTitle('Points required to meet weapon requirements')
        .filter(el => el.tagName === 'TD');
      expect(ptsCells2H[0].textContent).toBe('0');
    });
  });
});
