/**
 * StatusEffectScalingCurve Component Tests
 *
 * Tests for the StatusEffectScalingCurve component that displays status effect
 * scaling curves for weapons with arcane-scaling status effects.
 * Recharts is mocked to avoid SVG rendering issues in jsdom.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusEffectScalingCurve } from '../../../src/components/StatusEffectScalingCurve.js';
import type { WeaponListItem, CharacterStats, PrecomputedDataV2 } from '../../../src/types.js';

// Mock Recharts - it doesn't render well in jsdom
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: ({ dataKey, name }: { dataKey: string; name: string }) => <div data-testid={`line-${dataKey}`}>{name}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  ReferenceDot: () => <div data-testid="reference-dot" />,
}));

// Mock the hook to control test data
vi.mock('../../../src/hooks/useStatusEffectScalingData.js', () => ({
  useStatusEffectScalingData: vi.fn(),
}));

import { useStatusEffectScalingData } from '../../../src/hooks/useStatusEffectScalingData.js';

const mockUseStatusEffectScalingData = vi.mocked(useStatusEffectScalingData);

describe('StatusEffectScalingCurve', () => {
  // Mock weapon data
  const mockWeapon: WeaponListItem = {
    id: 'blood-venomous-fang-0',
    name: 'Venomous Fang',
    affinity: 'Blood',
    upgradeLevel: 0,
    maxUpgradeLevel: 25,
    category: 9,
    categoryName: 'Claw',
    wepmotionCategory: 22,
    weight: 2.5,
    isDualBlade: true,
    isBuffable: false,
    hasUniqueAttacks: false,
    ashOfWar: null,
    requirements: { str: 9, dex: 9, int: 0, fai: 0, arc: 0 },
    baseDamage: { physical: 93, magic: 0, fire: 0, lightning: 0, holy: 0 },
    scaling: { str: 'D', dex: 'C', int: '-', fai: '-', arc: '-' },
    damageTypes: ['slash', 'pierce'],
    guardStats: { physical: 36, magic: 21, fire: 21, lightning: 21, holy: 21, guardBoost: 19 },
  };

  const mockCurrentStats: CharacterStats = {
    vig: 40, mnd: 20, end: 25, str: 20, dex: 20, int: 10, fai: 10, arc: 30,
  };

  const mockPrecomputed = {} as PrecomputedDataV2;

  const defaultProps = {
    precomputed: mockPrecomputed,
    weapon: mockWeapon,
    currentStats: mockCurrentStats,
    twoHanding: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('When weapon has arcane-scaling status effects', () => {
    beforeEach(() => {
      // Mock data for a weapon with arcane-scaling bleed
      const mockDataPoints = Array.from({ length: 99 }, (_, i) => ({
        level: i + 1,
        bleed_total: 57 + (i * 0.5),
        bleed_cum: i * 0.5,
        bleed_inc: 0.5,
      }));

      mockUseStatusEffectScalingData.mockReturnValue({
        dataPoints: mockDataPoints,
        dataPointsByLevel: new Map(mockDataPoints.map(p => [p.level, p])),
        activeStatusEffects: [
          { key: 'bleed', label: 'Blood Loss', color: '#c9302c', hasArcaneScaling: true },
          { key: 'poison', label: 'Poison', color: '#9c6', hasArcaneScaling: false },
        ],
        hasAnyArcaneScaling: true,
      });
    });

    it('renders the component with title', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);
      expect(screen.getByText('Status Effect Buildup')).toBeInTheDocument();
    });

    it('renders view mode toggle buttons', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      expect(screen.getByRole('radio', { name: 'Total' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Per Point' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Cumulative' })).toBeInTheDocument();
    });

    it('starts with Total mode selected', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      const totalButton = screen.getByRole('radio', { name: 'Total' });
      expect(totalButton).toHaveAttribute('data-state', 'on');
    });

    it('switches to Per Point mode when clicked', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      const perPointButton = screen.getByRole('radio', { name: 'Per Point' });
      fireEvent.click(perPointButton);

      expect(perPointButton).toHaveAttribute('data-state', 'on');
    });

    it('switches to Cumulative mode when clicked', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      const cumulativeButton = screen.getByRole('radio', { name: 'Cumulative' });
      fireEvent.click(cumulativeButton);

      expect(cumulativeButton).toHaveAttribute('data-state', 'on');
    });

    it('renders ignore requirements checkbox', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      expect(screen.getByText('Ignore Reqs')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('checkbox is checked by default (ignore requirements)', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('can toggle ignore requirements off', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(checkbox).not.toBeChecked();
    });

    it('renders the chart container', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('passes correct props to useStatusEffectScalingData hook', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      expect(mockUseStatusEffectScalingData).toHaveBeenCalledWith(
        expect.objectContaining({
          precomputed: mockPrecomputed,
          weapon: mockWeapon,
          currentStats: mockCurrentStats,
          twoHanding: false,
          ignoreRequirements: true,
        })
      );
    });

    it('updates hook call when ignore requirements changes', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Should be called again with ignoreRequirements: false
      expect(mockUseStatusEffectScalingData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          ignoreRequirements: false,
        })
      );
    });
  });

  describe('When weapon has non-scaling status effects only', () => {
    beforeEach(() => {
      // Mock data for a weapon with constant (non-scaling) status effect
      const mockDataPoints = Array.from({ length: 99 }, (_, i) => ({
        level: i + 1,
        bleed_total: 45, // Constant value - doesn't scale with arcane
        bleed_cum: 0,
        bleed_inc: 0,
      }));

      mockUseStatusEffectScalingData.mockReturnValue({
        dataPoints: mockDataPoints,
        dataPointsByLevel: new Map(mockDataPoints.map(p => [p.level, p])),
        activeStatusEffects: [
          { key: 'bleed', label: 'Blood Loss', color: '#c9302c', hasArcaneScaling: false },
        ],
        hasAnyArcaneScaling: false,
      });
    });

    it('renders the chart with constant status effect as horizontal line', () => {
      render(<StatusEffectScalingCurve {...defaultProps} />);

      // Component should render with title
      expect(screen.getByText('Status Effect Buildup')).toBeInTheDocument();
      // Chart should be rendered
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('When weapon has no status effects at all', () => {
    beforeEach(() => {
      mockUseStatusEffectScalingData.mockReturnValue({
        dataPoints: [],
        dataPointsByLevel: new Map(),
        activeStatusEffects: [],
        hasAnyArcaneScaling: false,
      });
    });

    it('returns null (renders nothing)', () => {
      const { container } = render(<StatusEffectScalingCurve {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('With optimalStats prop', () => {
    beforeEach(() => {
      const mockDataPoints = Array.from({ length: 99 }, (_, i) => ({
        level: i + 1,
        bleed_total: 57 + (i * 0.5),
        bleed_cum: i * 0.5,
        bleed_inc: 0.5,
      }));

      mockUseStatusEffectScalingData.mockReturnValue({
        dataPoints: mockDataPoints,
        dataPointsByLevel: new Map(mockDataPoints.map(p => [p.level, p])),
        activeStatusEffects: [
          { key: 'bleed', label: 'Blood Loss', color: '#c9302c', hasArcaneScaling: true },
        ],
        hasAnyArcaneScaling: true,
      });
    });

    it('renders with optimalStats for marker positioning', () => {
      const optimalStats: CharacterStats = {
        vig: 40, mnd: 20, end: 25, str: 20, dex: 20, int: 10, fai: 10, arc: 45,
      };

      render(<StatusEffectScalingCurve {...defaultProps} optimalStats={optimalStats} />);

      // Component should render successfully
      expect(screen.getByText('Status Effect Buildup')).toBeInTheDocument();
    });
  });
});
