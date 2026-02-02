/**
 * Sidebar Component Tests
 *
 * Tests for the Sidebar component including:
 * - Mode switching (Fixed vs Solver)
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
    solverEnabled: false,
    onSolverToggle: vi.fn(),
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
    // Unified weapon filters
    weaponFilters: {
      searchText: '',
      sortKey: 'totalAR',
      sortDirection: 'desc' as const,
      categoryFilter: new Set<string>(),
      affinityFilter: new Set<string>(),
      damageTypeFilter: new Set<string>(),
      statusEffectFilter: new Set<string>(),
      weightRange: {},
      arRange: {},
      buffableFilter: null,
      meetsReqsFilter: true,
    },
    onFilterChange: vi.fn(),
    // Available options
    availableCategories: ['Katana', 'Greatsword', 'Dagger'],
    availableAffinities: ['Standard', 'Heavy', 'Keen'],
    availableDamageTypes: ['Slash', 'Pierce', 'Strike'],
    availableStatusEffects: ['Bleed', 'Frost', 'Poison'],
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

  describe('Mode Switching', () => {
    it('renders Fixed mode by default when solverEnabled is false', () => {
      const props = createDefaultProps({ solverEnabled: false });
      render(<Sidebar {...props} />);

      const fixedButton = screen.getByRole('button', { name: /fixed/i });
      const solverButton = screen.getByRole('button', { name: /solver/i });

      // Fixed button should have active styling (bg-[#2a2a2a])
      expect(fixedButton).toHaveClass('bg-[#2a2a2a]');
      // Solver should not have active styling
      expect(solverButton).not.toHaveClass('bg-[#1a1505]');
    });

    it('renders Solver mode when solverEnabled is true', () => {
      const props = createDefaultProps({ solverEnabled: true });
      render(<Sidebar {...props} />);

      const solverButton = screen.getByRole('button', { name: /solver/i });

      // Solver button should have golden active styling
      expect(solverButton).toHaveClass('bg-[#1a1505]');
    });

    it('calls onSolverToggle when switching to Solver mode', async () => {
      const onSolverToggle = vi.fn();
      const props = createDefaultProps({
        solverEnabled: false,
        onSolverToggle
      });
      render(<Sidebar {...props} />);

      const solverButton = screen.getByRole('button', { name: /solver/i });
      await userEvent.click(solverButton);

      expect(onSolverToggle).toHaveBeenCalledWith(true);
    });

    it('calls onSolverToggle when switching to Fixed mode', async () => {
      const onSolverToggle = vi.fn();
      const props = createDefaultProps({
        solverEnabled: true,
        onSolverToggle
      });
      render(<Sidebar {...props} />);

      const fixedButton = screen.getByRole('button', { name: /fixed/i });
      await userEvent.click(fixedButton);

      expect(onSolverToggle).toHaveBeenCalledWith(false);
    });
  });

  describe('Two-Handing Toggle', () => {
    it('renders 1H/2H toggle buttons', () => {
      const props = createDefaultProps();
      render(<Sidebar {...props} />);

      expect(screen.getByRole('button', { name: '1H' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2H' })).toBeInTheDocument();
    });

    it('shows 1H as active when twoHanding is false', () => {
      const props = createDefaultProps({ twoHanding: false });
      render(<Sidebar {...props} />);

      const oneHandButton = screen.getByRole('button', { name: '1H' });
      expect(oneHandButton).toHaveClass('bg-[#2a2a2a]');
    });

    it('shows 2H as active when twoHanding is true', () => {
      const props = createDefaultProps({ twoHanding: true });
      render(<Sidebar {...props} />);

      const twoHandButton = screen.getByRole('button', { name: '2H' });
      expect(twoHandButton).toHaveClass('bg-[#2a2a2a]');
    });

    it('calls onTwoHandingToggle when clicking 2H', async () => {
      const onTwoHandingToggle = vi.fn();
      const props = createDefaultProps({
        twoHanding: false,
        onTwoHandingToggle
      });
      render(<Sidebar {...props} />);

      await userEvent.click(screen.getByRole('button', { name: '2H' }));

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

      const scalingLabel = screen.getByText('Scaling').closest('label');
      const checkbox = scalingLabel?.querySelector('input[type="checkbox"]') as HTMLInputElement;

      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Fixed Mode Stats', () => {
    it('renders stat inputs in Fixed mode', () => {
      const props = createDefaultProps({ solverEnabled: false });
      render(<Sidebar {...props} />);

      // Should have stat labels
      expect(screen.getByText('STR')).toBeInTheDocument();
      expect(screen.getByText('DEX')).toBeInTheDocument();
      expect(screen.getByText('INT')).toBeInTheDocument();
      expect(screen.getByText('FAI')).toBeInTheDocument();
      expect(screen.getByText('ARC')).toBeInTheDocument();
    });

    it('calls onStatConfigChange when changing stat value in Fixed mode', async () => {
      const onStatConfigChange = vi.fn();
      const props = createDefaultProps({
        solverEnabled: false,
        onStatConfigChange,
        statConfigs: createMockStatConfigs({ str: { locked: true, value: 20 } })
      });
      render(<Sidebar {...props} />);

      // Find STR input - in Fixed mode, inputs are: Level, STR, DEX, INT, FAI, ARC
      // So STR is at index 1 (Level is at index 0)
      const inputs = screen.getAllByRole('spinbutton');
      const strInput = inputs[1]; // Second input is STR (first is Level)

      fireEvent.change(strInput, { target: { value: '40' } });

      expect(onStatConfigChange).toHaveBeenCalled();
    });
  });

  describe('Solver Mode Stats', () => {
    it('renders range inputs in Solver mode', () => {
      const props = createDefaultProps({
        solverEnabled: true,
        statConfigs: createMockStatConfigs({
          str: { locked: false, min: 10, max: 99 },
          dex: { locked: false, min: 10, max: 99 },
          int: { locked: false, min: 10, max: 99 },
          fai: { locked: false, min: 10, max: 99 },
          arc: { locked: false, min: 10, max: 99 },
        })
      });
      render(<Sidebar {...props} />);

      // In solver mode, we have:
      // - Level input (1)
      // - VIG, MND, END inputs (3)
      // - Armor Weight input (1)
      // - 5 damage stats × 2 range inputs (10)
      // Total spinbuttons should be 15 (Budget is now a div, not an input)
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs.length).toBe(15);
    });
  });
});
