/**
 * ScalingChart Component Tests
 *
 * Tests for the ScalingChart component that displays weapon scaling curves.
 * Recharts is mocked to avoid SVG rendering issues in jsdom.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScalingChart } from '../../../src/components/ScalingChart.js';
import type { ScalingDataPoint, ScalingStat } from '../../../src/types/scaling.js';
import type { CharacterStats } from '../../../src/types.js';

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

describe('ScalingChart', () => {
  // Mock data
  const mockDataPoints: ScalingDataPoint[] = [
    { level: 10, str_cum: 50, dex_cum: 45 },
    { level: 20, str_cum: 80, dex_cum: 75 },
    { level: 30, str_cum: 100, dex_cum: 95 },
    { level: 40, str_cum: 115, dex_cum: 110 },
  ];

  const mockDataPointsByLevel = new Map(mockDataPoints.map(p => [p.level, p]));

  const mockScalingStats: ScalingStat[] = [
    { key: 'str', label: 'STR', color: '#ff6b6b' },
    { key: 'dex', label: 'DEX', color: '#4ecdc4' },
  ];

  const mockCurrentStats: CharacterStats = {
    vig: 40, mnd: 20, end: 25, str: 30, dex: 25, int: 10, fai: 10, arc: 10,
  };

  const mockRequirements: Record<string, number> = {
    str: 15, dex: 12, int: 0, fai: 0, arc: 0,
  };

  const defaultProps = {
    dataPoints: mockDataPoints,
    dataPointsByLevel: mockDataPointsByLevel,
    scalingStats: mockScalingStats,
    availableDamageTypes: ['total', 'physical'],
    currentStats: mockCurrentStats,
    requirements: mockRequirements,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header and Title', () => {
    it('renders with default title', () => {
      render(<ScalingChart {...defaultProps} />);
      expect(screen.getByText('Scaling Curves')).toBeInTheDocument();
    });

    it('renders with custom title', () => {
      render(<ScalingChart {...defaultProps} title="Weapon Damage Analysis" />);
      expect(screen.getByText('Weapon Damage Analysis')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    it('renders view mode toggle buttons', () => {
      render(<ScalingChart {...defaultProps} />);

      expect(screen.getByRole('radio', { name: 'Per Point' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Cumulative' })).toBeInTheDocument();
    });

    it('starts with Per Point mode selected', () => {
      render(<ScalingChart {...defaultProps} />);

      const perPointButton = screen.getByRole('radio', { name: 'Per Point' });
      expect(perPointButton).toHaveAttribute('data-state', 'on');
    });

    it('switches to Cumulative mode when clicked', () => {
      render(<ScalingChart {...defaultProps} />);

      const cumulativeButton = screen.getByRole('radio', { name: 'Cumulative' });
      fireEvent.click(cumulativeButton);

      expect(cumulativeButton).toHaveAttribute('data-state', 'on');
    });
  });

  describe('Unified Selector', () => {
    it('renders All button and individual stat buttons', () => {
      render(<ScalingChart {...defaultProps} />);

      expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'STR' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'DEX' })).toBeInTheDocument();
    });

    it('renders damage type buttons when available', () => {
      render(<ScalingChart {...defaultProps} />);

      expect(screen.getByRole('radio', { name: 'Physical' })).toBeInTheDocument();
    });

    it('starts with All selected', () => {
      render(<ScalingChart {...defaultProps} />);

      const allButton = screen.getByRole('radio', { name: 'All' });
      expect(allButton).toHaveAttribute('data-state', 'on');
    });

    it('can select individual stat', () => {
      render(<ScalingChart {...defaultProps} />);

      const strButton = screen.getByRole('radio', { name: 'STR' });
      fireEvent.click(strButton);

      expect(strButton).toHaveAttribute('data-state', 'on');
    });

    it('can select damage type', () => {
      render(<ScalingChart {...defaultProps} />);

      const physicalButton = screen.getByRole('radio', { name: 'Physical' });
      fireEvent.click(physicalButton);

      expect(physicalButton).toHaveAttribute('data-state', 'on');
    });

    it('does not show damage type buttons when no damage types available', () => {
      render(<ScalingChart {...defaultProps} availableDamageTypes={['total']} />);

      expect(screen.queryByRole('radio', { name: 'Physical' })).not.toBeInTheDocument();
    });
  });

  describe('Ignore Requirements Checkbox', () => {
    it('renders ignore requirements checkbox by default', () => {
      render(<ScalingChart {...defaultProps} />);

      expect(screen.getByText('Ignore Reqs')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('checkbox is checked by default (ignore requirements)', () => {
      render(<ScalingChart {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('can toggle ignore requirements off', () => {
      render(<ScalingChart {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(checkbox).not.toBeChecked();
    });

    it('hides checkbox when showIgnoreRequirements is false', () => {
      render(<ScalingChart {...defaultProps} showIgnoreRequirements={false} />);

      expect(screen.queryByText('Ignore Reqs')).not.toBeInTheDocument();
    });

    it('calls onIgnoreRequirementsChange when toggled (controlled mode)', () => {
      const onChange = vi.fn();
      render(
        <ScalingChart
          {...defaultProps}
          ignoreRequirements={true}
          onIgnoreRequirementsChange={onChange}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Chart Rendering', () => {
    it('renders the responsive container', () => {
      render(<ScalingChart {...defaultProps} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders the line chart', () => {
      render(<ScalingChart {...defaultProps} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows no scaling message when scalingStats is empty', () => {
      render(<ScalingChart {...defaultProps} scalingStats={[]} />);

      expect(screen.getByText('No scaling attributes')).toBeInTheDocument();
    });

    it('still shows title in empty state', () => {
      render(<ScalingChart {...defaultProps} scalingStats={[]} title="My Chart" />);

      expect(screen.getByText('My Chart')).toBeInTheDocument();
    });
  });
});
