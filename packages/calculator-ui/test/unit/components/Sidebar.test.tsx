/**
 * Sidebar Component Tests
 *
 * Tests for the Sidebar component including:
 * - Stat input behavior
 * - Column toggles
 * - Two-handing toggle
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from '../../../src/components/Sidebar.js';
import {
  createMockStatConfigs,
  DEFAULT_STARTING_CLASS
} from '../../utils/testHelpers.js';

// Mock the data module to avoid fetch errors in tests
vi.mock('../../../src/data/index.js', () => ({
  getBossNames: () => ['Test Boss 1 (Location A)', 'Test Boss 2 (Location B)'],
  getEnemyByKey: (key: string) => {
    const enemies: Record<string, { name: string; location: string }> = {
      'Test Boss 1 (Location A)': { name: 'Test Boss 1', location: 'Location A' },
      'Test Boss 2 (Location B)': { name: 'Test Boss 2', location: 'Location B' },
    };
    return enemies[key] ?? null;
  },
  getAvailableAowNames: () => ['Ash of War 1', 'Ash of War 2'],
  getUniqueSkillNames: () => ['Skill 1', 'Skill 2'],
}));

// Default props factory
function createDefaultProps(overrides = {}) {
  return {
    isOpen: false,
    onClose: vi.fn(),
    // Column visibility toggles
    showScaling: false,
    setShowScaling: vi.fn(),
    showNumericalScaling: false,
    setShowNumericalScaling: vi.fn(),
    showRequirements: false,
    setShowRequirements: vi.fn(),
    showEfficiency: false,
    setShowEfficiency: vi.fn(),
    showStatusEffects: false,
    setShowStatusEffects: vi.fn(),
    showSpellPower: false,
    setShowSpellPower: vi.fn(),
    showAowDamage: false,
    setShowAowDamage: vi.fn(),
    showGuardStats: false,
    setShowGuardStats: vi.fn(),
    showDps: false,
    setShowDps: vi.fn(),
    showWeaponStats: false,
    setShowWeaponStats: vi.fn(),
    groupBy: 'none' as const,
    setGroupBy: vi.fn(),
    // Stat props
    level: 150,
    setLevel: vi.fn(),
    startingClass: DEFAULT_STARTING_CLASS,
    setStartingClass: vi.fn(),
    statConfigs: createMockStatConfigs(),
    onStatConfigChange: vi.fn(),
    twoHanding: false,
    onTwoHandingToggle: vi.fn(),
    upgradeLevel: 25,
    onUpgradeLevelChange: vi.fn(),
    // Enemy selector
    selectedEnemy: null,
    onEnemySelect: vi.fn(),
    // Ash of War filter
    aowData: null,
    selectedAowFilter: null,
    onAowFilterSelect: vi.fn(),
    // Solver-specific props
    rollType: 'medium' as const,
    onRollTypeChange: vi.fn(),
    armorWeight: 30,
    onArmorWeightChange: vi.fn(),
    subtractWeaponWeight: false,
    onSubtractWeaponWeightChange: vi.fn(),
    // Optimization mode props
    optimizationMode: 'AR' as const,
    onOptimizationModeChange: vi.fn(),
    hasCatalystsSelected: false,
    hasAowSelected: false,
    // Column visibility extras
    showAttributeInvestments: false,
    setShowAttributeInvestments: vi.fn(),
    // Column filters
    columnFilters: {},
    onColumnFilterChange: vi.fn(),
    // Available options
    availableCategories: ['Katana', 'Greatsword', 'Dagger'],
    availableAffinities: ['Standard', 'Heavy', 'Keen'],
    availableDamageTypes: ['Slash', 'Pierce', 'Strike'],
    availableStatusEffects: ['Bleed', 'Frost', 'Poison'],
    // Build props
    builds: [],
    activeBuild: null,
    storageAvailable: true,
    onSelectBuild: vi.fn(),
    onCreateBuild: vi.fn(),
    onRenameBuild: vi.fn(),
    onDeleteBuild: vi.fn(),
    onClearBuild: vi.fn(),
    onToggleWeapon: vi.fn(),
    weapons: [],
    precomputed: null,
    currentStats: { vig: 40, mnd: 20, end: 25, str: 20, dex: 20, int: 10, fai: 10, arc: 10 },
    onWeaponSelect: vi.fn(),
    ...overrides,
  };
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop Rendering', () => {
    it('renders the desktop sidebar with settings content', () => {
      const props = createDefaultProps();
      render(<Sidebar {...props} />);

      // Check for stat labels which are always present
      expect(screen.getByText('STR')).toBeInTheDocument();
    });
  });

  describe('Two-Handing Toggle', () => {
    it('renders 1H/2H toggle items', () => {
      const props = createDefaultProps();
      render(<Sidebar {...props} />);

      // Radix ToggleGroupItem renders as buttons with aria-checked, not role="button"
      expect(screen.getByText('1H')).toBeInTheDocument();
      expect(screen.getByText('2H')).toBeInTheDocument();
    });

    it('shows 1H as active when twoHanding is false', () => {
      const props = createDefaultProps({ twoHanding: false });
      render(<Sidebar {...props} />);

      const oneHandButton = screen.getByText('1H').closest('button');
      expect(oneHandButton).toHaveAttribute('data-state', 'on');
    });

    it('shows 2H as active when twoHanding is true', () => {
      const props = createDefaultProps({ twoHanding: true });
      render(<Sidebar {...props} />);

      const twoHandButton = screen.getByText('2H').closest('button');
      expect(twoHandButton).toHaveAttribute('data-state', 'on');
    });

    it('calls onTwoHandingToggle when clicking 2H', async () => {
      const onTwoHandingToggle = vi.fn();
      const props = createDefaultProps({
        twoHanding: false,
        onTwoHandingToggle
      });
      render(<Sidebar {...props} />);

      await userEvent.click(screen.getByText('2H'));

      expect(onTwoHandingToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('Column Toggles', () => {
    it('renders all column toggle checkboxes', () => {
      const props = createDefaultProps();
      render(<Sidebar {...props} />);

      expect(screen.getByText('Scaling')).toBeInTheDocument();
      expect(screen.getByText('Requirements')).toBeInTheDocument();
      expect(screen.getByText('Efficiency')).toBeInTheDocument();
      expect(screen.getByText('Status Effects')).toBeInTheDocument();
    });

    it('calls setShowScaling when toggling Scaling checkbox', async () => {
      const setShowScaling = vi.fn();
      const props = createDefaultProps({
        showScaling: false,
        setShowScaling
      });
      render(<Sidebar {...props} />);

      // Find the Scaling label and click it (or its checkbox)
      const scalingLabel = screen.getByText('Scaling').closest('label');
      await userEvent.click(scalingLabel!);

      expect(setShowScaling).toHaveBeenCalledWith(true);
    });

    it('shows checked state for enabled columns', () => {
      const props = createDefaultProps({ showScaling: true });
      render(<Sidebar {...props} />);

      // Radix Checkbox renders as <button role="checkbox">, not <input type="checkbox">
      const scalingLabel = screen.getByText('Scaling').closest('label');
      const checkbox = scalingLabel?.querySelector('[role="checkbox"]');

      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('Stat Inputs', () => {
    it('renders stat inputs', () => {
      const props = createDefaultProps();
      render(<Sidebar {...props} />);

      // Should have stat labels
      expect(screen.getByText('STR')).toBeInTheDocument();
      expect(screen.getByText('DEX')).toBeInTheDocument();
      expect(screen.getByText('INT')).toBeInTheDocument();
      expect(screen.getByText('FAI')).toBeInTheDocument();
      expect(screen.getByText('ARC')).toBeInTheDocument();
    });

    it('calls onStatConfigChange when changing stat value', async () => {
      const onStatConfigChange = vi.fn();
      const props = createDefaultProps({
        onStatConfigChange,
        statConfigs: createMockStatConfigs({ str: { min: 20, max: 99 } })
      });
      render(<Sidebar {...props} />);

      // In the unified layout, spinbutton order is:
      // 0: Level, 1: VIG, 2: MND, 3: END,
      // 4: STR-min, 5: STR-max, 6: DEX-min, 7: DEX-max, ...
      const inputs = screen.getAllByRole('spinbutton');
      const strMinInput = inputs[4]; // STR min input

      fireEvent.change(strMinInput, { target: { value: '40' } });

      expect(onStatConfigChange).toHaveBeenCalled();
    });
  });

});
